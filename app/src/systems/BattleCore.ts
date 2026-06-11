import Phaser from 'phaser';
import type { UnitDef, Side, PheromoneZone, PheromoneKind, EliteSlot, IParticleManager } from '../types';
import { UNIT_DEFS } from '../units/registry';
import { ENEMY_DEFS } from '../config/EnemyDefs';
import { PHEROMONE_DEFS } from '../config/PheromoneDefs';
import { Unit } from '../entities/Unit';
import { BaseStructure } from '../entities/BaseStructure';
import { CombatSystem } from './CombatSystem';
import { AudioManager } from './AudioManager';
import { EventBus } from './EventBus';
import { UnitPool } from './UnitPool';
import { SpatialIndex } from './SpatialIndex';
import { signatureHasTarget } from './Targeting';
import { setSpawnDispatcher } from './CombatDispatch';

/**
 * Unit render depth — units sit ABOVE the pheromone scent layer (50) and the
 * Royal control ring (51), inside the biome's 2.5D sandwich (ground strip at
 * 60.5, tunnel veil at 62): far lane 60, near lane 61, so the near row draws
 * over the far row where they overlap.
 */
const UNIT_DEPTH_BASE = 60;

/**
 * The battle SUBSTRATE — everything every battle has, regardless of who's
 * driving it: the unit roster (pooled + spatially indexed), the combat sim,
 * and the pheromone zone field. Exactly two drivers compose over it:
 *
 *   - GameManager (the real run loop): adds economy, incubation, waves/AI,
 *     player abilities, the Royal lifecycle, and win/loss.
 *   - SandboxScene (the lab): adds free placement, presets, fight/reset.
 *
 * One substrate, two drivers — combat features land HERE once and exist in
 * both. (Before this seam, the sandbox owned a parallel CombatSystem/unit/zone
 * stack and every feature had to be wired twice; the stacks drifted.)
 *
 * Presentation stays with the driver (particles, audio, FX director, HUD) —
 * the substrate is deterministic sim + bookkeeping.
 */
export class BattleCore {
  /** Live roster. STABLE reference — reaped in place (splice), never
   *  reassigned, so closures handed out (AI controller, HpHud) stay valid. */
  readonly units: Unit[] = [];
  readonly unitPool: UnitPool;
  readonly spatialIndex: SpatialIndex;
  readonly combat: CombatSystem;

  /** Active pheromone zones (commands + courier trail blobs). Drivers may
   *  push (sandbox zone painting); decay happens in tickZones. */
  pheromoneZones: PheromoneZone[] = [];

  /** Tide sanity cap — generative spawning (β broods) stops adding bodies to a
   *  side at this roster size; a runaway-spawn backstop, not a balance knob. */
  private static readonly SPAWN_SOFT_CAP = 48;

  constructor(scene: Phaser.Scene, events: EventBus, worldW: number) {
    this.unitPool = new UnitPool(scene);
    this.spatialIndex = new SpatialIndex();
    this.combat = new CombatSystem(scene, events, worldW);

    // Generative-spawn seam — the sim's birth requests (spawner passives,
    // spawn-wave signatures) become real pooled units here, in BOTH drivers.
    setSpawnDispatcher((key, side, x, lane) => {
      let count = 0;
      for (const u of this.units) if (u.side === side && !u.dead) count++;
      if (count >= BattleCore.SPAWN_SOFT_CAP) return;
      const resolvedKey = side === 'enemy' ? 'e' + key : key;
      const def = side === 'enemy' ? ENEMY_DEFS[resolvedKey] : UNIT_DEFS[resolvedKey];
      if (!def) return;
      // SPAWNED units cost cap 0 (β capacity ruling): the brood is a parallel
      // economy, not a squeeze on your deploy capacity. Deployed copies of the
      // same unit keep their def cap. The 48 soft-cap above is the backstop.
      this.createUnit(resolvedKey, side, { ...def, cap: 0 }, x, lane);
    });
  }

  /** Spawn a unit from the pool into the battle (roster + spatial index +
   *  the lane depth sandwich). The ONLY unit-creation path. */
  createUnit(key: string, side: Side, def: UnitDef, x: number, lane = 0): Unit {
    const unit = this.unitPool.spawn({ ...def, _key: key }, side, x, lane);
    unit.setDepth(UNIT_DEPTH_BASE + lane);
    this.units.push(unit);
    this.spatialIndex.add(unit);
    return unit;
  }

  /**
   * Deploy a pheromone courier — a Scout carrying `kind` that runs forward
   * laying a fading scent-trail (the sim drops blobs in CombatSystem.resolve).
   * The Scout IS the delivery: vulnerable, interceptable; killing it stops the
   * trail, laid scent fades on its own (deposit-fade, VISION §5).
   */
  spawnCourier(kind: PheromoneKind, side: Side, x: number, lane: number): Unit | null {
    const def = side === 'enemy' ? ENEMY_DEFS['escout'] : UNIT_DEFS['scout'];
    if (!def) return null;
    const scout = this.createUnit('scout', side, def, x, lane);
    scout.pheromoneKind = kind;
    scout.primary = PHEROMONE_DEFS[kind].color; // tint to its command
    return scout;
  }

  /** Decay pheromone zones; expired ones drop. Run BEFORE resolve each tick
   *  (resolve only READS zones + appends fresh trail blobs). */
  tickZones(dt: number): void {
    if (this.pheromoneZones.length === 0) return;
    for (const z of this.pheromoneZones) z.remaining -= dt;
    this.pheromoneZones = this.pheromoneZones.filter(z => z.remaining > 0);
  }

  /** One combat step over the live roster. */
  resolve(
    dt: number,
    playerBase: BaseStructure,
    enemyBase: BaseStructure,
    particles: IParticleManager | null,
    wallActive: number,
    audio: AudioManager | null,
  ): void {
    this.combat.resolve(this.units, dt, playerBase, enemyBase, particles, wallActive, audio, this.pheromoneZones);
  }

  /**
   * Post-combat bookkeeping: re-sort movers in the spatial index (sweep-and-
   * prune bubbles toward sorted — amortized O(n) per frame), then reap the
   * dead in place back to the pool.
   */
  postResolve(): void {
    for (const u of this.units) {
      if (!u.dead) this.spatialIndex.update(u);
    }
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.dead) {
        this.spatialIndex.remove(u);
        this.unitPool.despawn(u);
        this.units.splice(i, 1);
      }
    }
  }

  /** Despawn EVERY unit (alive included) — the sandbox reset/refight path. */
  clear(): void {
    for (const u of this.units) {
      this.spatialIndex.remove(u);
      this.unitPool.despawn(u);
    }
    this.units.length = 0;
  }

  /**
   * Per-Elite signature-slot state for a HUD trigger row: one entry per LIVE
   * Elite of `side` (Royals have their own profile panel). Clicking a slot
   * fires that unit's signature via requestSignature(id).
   */
  getEliteSlots(side: Side = 'player'): EliteSlot[] {
    const slots: EliteSlot[] = [];
    for (const u of this.units) {
      if (u.side !== side || u.dead) continue;
      if (u.caste !== 'elite') continue;
      const frac = u.signatureCooldown > 0 ? u.sigCd / u.signatureCooldown : 0;
      slots.push({
        id: u.id,
        key: u.key,
        name: u.unitName,
        ready: u.canSignature(),
        cdFrac: frac < 0 ? 0 : frac > 1 ? 1 : frac,
        firable: !!u.signatureAbility,
        inRange: signatureHasTarget(u, this.units),
      });
    }
    return slots;
  }
}
