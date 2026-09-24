// Terrain orchestrator — the impure half of the engine. Owns the grid, listens
// for terrain events, runs the decay tick, applies pulses + passive DoT to
// units, and answers the movement query. The reaction MATH is pure
// (ReactionRegistry.resolve); this file does the side effects: grid writes,
// emits, and damage/CC via the EXISTING EffectSystem + DoT seam (so terrain
// kills feed the same death economy as any other damage — delta #3).
//
// Lives on the battle SUBSTRATE (BattleCore), so both drivers (run + sandbox)
// get terrain for free. Presentation (TerrainRenderer) stays with the driver.

import type { Route, IUnit } from '../types';
import type { DamageType } from '../config/combat/damageTypes';
import { resistanceDamageMult, type ResistanceTier } from '../config/combat/resistances';
import type { EventBus, GameEvents } from './EventBus';
import type { TerrainEffect, Pulse } from '../config/TerrainDefs';
import { TerrainGrid, emptyCell } from './TerrainGrid';
import { resolve } from './ReactionRegistry';
import { TERRAIN_TYPES, TERRAIN_DAMAGE_FLAVOR } from '../config/TerrainDefs';
import { applyEffect } from './EffectSystem';
import { dispatchDotDamage } from '../config/combat/effects/dispatch';
import { setTerrainQuery, setTerrainTick } from './TerrainDispatch';
import { setTerrainGridRef } from './TerrainDebug';

// Optional biome-law modifier (delta #5) — a future BiomeRules hook can adjust
// applied terrain before resolve (e.g. "Fetid Pool deepens all floods"). v1
// accepts the seam but ships no rules.
export interface BiomeRules {
  /** Transform an incoming apply event before it resolves. Return null to veto. */
  onApply?(ev: GameEvents['terrainApply']): GameEvents['terrainApply'] | null;
}

/** Structural read of a unit's per-type resistance (IUnit exposes it optionally). */
interface Resistant {
  resistance?: Partial<Record<DamageType, ResistanceTier>>;
}

export class TerrainSystem {
  readonly grid: TerrainGrid;
  private readonly events: EventBus;
  /** STABLE live-roster reference (BattleCore.units) — pulses scan it for targets. */
  private readonly units: IUnit[];
  private biome: BiomeRules | null;

  // Per-unit terrain scratch (catalyst last-segment `_terrainSeg`, fractional
  // DoT carry `_terrainDotAccum`, the onReach lay latch `_terrainLaid`) lives ON
  // the unit and is reset in Unit.init() — so pool recycle auto-clears it for
  // EVERY death/recycle path (sacrifice, despawn, refight), making stale-id
  // mis-fire impossible by construction. No system-side maps to prune.

  // Bound handlers (stable identity for off()/clear()).
  private readonly onApply = (ev: GameEvents['terrainApply']) => this.applyTerrain(ev);
  private readonly onUnitDied = (ev: GameEvents['unitDied']) => this.layFootprint(ev);

  constructor(events: EventBus, worldW: number, units: IUnit[], biome: BiomeRules | null = null) {
    this.events = events;
    this.units = units;
    this.biome = biome;
    this.grid = new TerrainGrid(worldW);

    events.on('terrainApply', this.onApply);
    events.on('unitDied', this.onUnitDied);

    // Register the integration seams (movement query + per-frame tick).
    setTerrainQuery((route, x) => this.getEffect(route, x));
    setTerrainTick((u, dt) => this.tickUnits(u, dt));
    setTerrainGridRef(this.grid); // expose to the global `terrain` debug command
  }

  /** Swap the biome-law modifier (declared seam; v1 never calls this). */
  setBiome(biome: BiomeRules | null): void {
    this.biome = biome;
  }

  // --- Movement query (the narrow TerrainQuery, delta #7) -------------------

  /** The passive effect a unit suffers standing at (route, x), or null if empty. */
  getEffect(route: Route, x: number): TerrainEffect | null {
    const cell = this.grid.cellAt(route, x);
    if (cell.state === 'empty' || cell.element === null) return null;
    return TERRAIN_TYPES[cell.element]?.passive ?? null;
  }

  // --- Decay tick (NO reactions — those fire on events) ---------------------

  update(dt: number): void {
    this.grid.forEach((route, index, cell) => {
      if (cell.state === 'empty') return;
      if (cell.ttl !== Infinity) cell.ttl -= dt;

      const type = cell.element ? TERRAIN_TYPES[cell.element] : null;
      const isWall = !!type && type.hp != null && type.hp > 0;
      const expired = (cell.ttl !== Infinity && cell.ttl <= 0) || (isWall && cell.hp <= 0);

      if (expired) {
        const cleared = emptyCell();
        this.grid.set(route, index, cleared);
        this.events.emit('terrainChanged', { route, index, cell: cleared });
      }
    });

    // SPREAD pass (declared seam, delta #5): a future fire-creep / flood-flow
    // walk over grid.neighbors() of cells whose reaction set result.spread.
    // v1 ships no spreading reaction, so this is intentionally a no-op.
  }

  // --- Per-frame unit interaction (called INSIDE resolve via the seam) ------

  /**
   * Runs at CombatSystem's effect-tick point (ctx live), so DoT routes through
   * the existing DoT dispatcher and kills feed the death economy.
   *   - passive DoT: damage units standing in a damaging cell.
   *   - catalyst: a catalyst unit entering a NEW segment applies its element
   *     there (electrifying a flood it walks into, etc.).
   */
  tickUnits(units: IUnit[], dt: number): void {
    for (const u of units) {
      if (u.dead) continue;
      const cx = u.x + u.unitW / 2;

      // Shaper onReach — lay ONCE, the first time the unit engages an enemy
      // (attack state, set by tickAttackSwing this same frame), placed FORWARD
      // toward that enemy rather than in the backline. The shaper sits at the
      // pool's back edge, so its own terrain mostly catches the foe it's
      // fighting, not its allies. (onDeploy still lays at spawn for any unit
      // that wants a backline structure.)
      const shaper = u.terrainAbility;
      if (shaper && shaper.trigger === 'onReach' && !u._terrainLaid && u.state === 'attack') {
        u._terrainLaid = true;
        const layX = cx + u.facing * (u.unitW / 2 + u.range + 12);
        this.events.emit('terrainApply', { route: u.currentRoute, x: layX, element: shaper.element });
      }

      // Catalyst — react to whatever cell it just stepped into (segment-entry).
      if (u.catalyst) {
        const seg = this.grid.segmentOf(cx);
        const prev = u._terrainSeg;
        if (prev === undefined) {
          u._terrainSeg = seg; // first sight — record, don't fire (no spawn-cell lay)
        } else if (prev !== seg) {
          u._terrainSeg = seg;
          this.events.emit('terrainApply', { route: u.currentRoute, x: cx, element: u.catalyst });
        }
      }

      // Passive DoT — standing in a damaging cell. Scale by the unit's
      // resistance to the DoT's damage type (reuses the resistance ladder — a
      // toxic-'strongest' unit shrugs off acid), then accumulate the fractional
      // per-frame amount and dispatch only WHOLE chunks: the pipeline floors
      // every hit to ≥1, so raw dps*dt each frame would turn a 6-dps pool into
      // 60 dps at 60fps. Framerate-independent (same model as burn/poison).
      const te = this.getEffect(u.currentRoute, cx);
      if (te?.dot) {
        const dps = te.dot.dps * resistanceDamageMult(this.resolveTier(u, te.dot.type));
        const acc = (u._terrainDotAccum ?? 0) + dps * dt;
        const whole = Math.floor(acc);
        if (whole >= 1) {
          dispatchDotDamage(null, u, whole, TERRAIN_DAMAGE_FLAVOR[te.dot.type]);
        }
        u._terrainDotAccum = acc - whole;
      } else if (u._terrainDotAccum) {
        u._terrainDotAccum = 0; // left the damaging cell — drop the carry
      }
    }
  }

  // --- Event handlers -------------------------------------------------------

  private applyTerrain(raw: GameEvents['terrainApply']): void {
    const ev = this.biome?.onApply ? this.biome.onApply(raw) : raw;
    if (!ev) return; // biome veto

    const index = this.grid.segmentOf(ev.x);
    const cell = this.grid.cell(ev.route, index);
    const { cell: next, pulses } = resolve(cell, ev.element);

    // Author overrides (intensity / hp) apply only when terrain remains.
    if (next.state !== 'empty') {
      if (ev.intensity != null) next.intensity = ev.intensity;
      if (ev.hp != null) next.hp = ev.hp;
    }

    this.grid.set(ev.route, index, next);
    this.events.emit('terrainChanged', { route: ev.route, index, cell: next });

    for (const p of pulses) this.applyPulse(p, ev.route, index);
  }

  /** Corpse footprint — a fallen unit with a terrain affinity lays/ignites its element. */
  private layFootprint(ev: GameEvents['unitDied']): void {
    if (!ev.element || !ev.route) return;
    this.events.emit('terrainApply', { route: ev.route, x: ev.x, element: ev.element });
  }

  /** A unit's resistance tier for a damage type ('normal' default). */
  private resolveTier(u: IUnit, type: DamageType): ResistanceTier {
    return (u as Resistant).resistance?.[type] ?? 'normal';
  }

  // --- Pulse application (units in the reacting cell/segment) ---------------

  private applyPulse(pulse: Pulse, route: Route, index: number): void {
    for (const u of this.units) {
      if (u.dead) continue;
      if (u.currentRoute !== route) continue;
      if (this.grid.segmentOf(u.x + u.unitW / 2) !== index) continue;

      const tier: ResistanceTier = pulse.type === 'none' ? 'normal' : this.resolveTier(u, pulse.type);

      if (pulse.dmg && pulse.type !== 'none') {
        // Resistance-scaled burst; floor to ≥1 AFTER scaling (a fully-resistant
        // unit still takes a token hit, like any min-1 damage in the sim).
        const dmg = Math.max(1, Math.floor(pulse.dmg * resistanceDamageMult(tier)));
        dispatchDotDamage(null, u, dmg, TERRAIN_DAMAGE_FLAVOR[pulse.type]);
      }
      if (pulse.stun) {
        applyEffect(u, 'stun', { remaining: pulse.stun, appliedTier: tier, source: TERRAIN_SOURCE });
      }
      if (pulse.slow) {
        applyEffect(u, 'slow', { remaining: pulse.slow, appliedTier: tier, source: TERRAIN_SOURCE });
      }
    }
  }

  // --- Lifecycle ------------------------------------------------------------

  /** Clear all terrain (battle refight). Per-unit scratch resets in Unit.init(). */
  reset(): void {
    this.grid.reset();
  }

  /** Unsubscribe + unregister the seams (battle teardown). */
  destroy(): void {
    this.events.off('terrainApply', this.onApply);
    this.events.off('unitDied', this.onUnitDied);
    setTerrainQuery(null);
    setTerrainTick(null);
    setTerrainGridRef(null);
  }
}

/** Attribution marker for terrain-applied effects (a non-unit source). */
const TERRAIN_SOURCE = { terrain: true };
