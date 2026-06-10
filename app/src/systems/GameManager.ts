import Phaser from 'phaser';
import type { UnitDef, WaveDef, Side, PlayerAbilityKey, RenderUnit, IWaveController, HiveProfile, PheromoneZone, PheromoneKind, EliteSlot, RoyalStatus } from '../types';
import { PHEROMONE_DEFS } from '../config/PheromoneDefs';
import { resolveColors } from '../config/Palettes';
import { W, DEFAULT_WORLD_W, SBW as SBW_CONST } from '../config/Constants';
import type { RunBuff } from './RunState';
// W = viewport width (used for camera), worldW = per-battle battlefield width
import { UNIT_DEFS, drawUnit } from '../units/registry';
import { lookupAbility } from '../config/combat/abilities';
import { ENEMY_DEFS } from '../config/EnemyDefs';
import { BaseStructure } from '../entities/BaseStructure';
import { BaseEntity } from '../entities/BaseEntity';
import { Unit, resetUid } from '../entities/Unit';
import { CombatSystem } from './CombatSystem';
import { WaveManager } from './WaveManager';
import { AIHiveController } from './AIHiveController';
import { SeededRNG } from './SeededRNG';
import { EconomyManager } from './EconomyManager';
import { AbilityManager } from './AbilityManager';
import { ParticleManager } from './ParticleManager';
import { AudioManager } from './AudioManager';
import { SaveManager } from './SaveManager';
import { IncubationManager, MAX_CHAMBERS } from './IncubationManager';
import { capUsed, canDeploy, MAX_CAPACITY } from './Capacity';
import { EventBus } from './EventBus';
import { addModifier, removeModifiersBySource } from './ModifierSystem';
import { UnitPool } from './UnitPool';
import { SpatialIndex } from './SpatialIndex';
import { CocoonVisuals } from '../entities/CocoonVisuals';
import { LarvaVisuals } from '../entities/LarvaVisuals';
import { registerDebugCommand, unregisterDebugCommand } from './DebugConsole';
import { HpHud } from './HpHud';

// Royal lifecycle (VISION §3) — playtest knobs.
const ROYAL_RESPAWN_TIME = 15;   // [sec] dead-window before the next lineage arrives
const LEADERLESS_ATK_PCT = -20;  // [%] herd atk penalty while the Royal is gone
const LEADERLESS_SOURCE = 'leaderless:player';

export interface HiveView {
  base: BaseStructure;
  larvae: LarvaVisuals;
  cocoons: CocoonVisuals;
}

export interface SpawnResult {
  success: boolean;
  message: string;
}

export class GameManager {
  scene: Phaser.Scene;
  events: EventBus;
  audio: AudioManager;
  combat: CombatSystem;
  waves: IWaveController;
  economy: EconomyManager;
  abilities: AbilityManager;
  particles: ParticleManager;
  incubation: IncubationManager;
  playerHive: HiveView;
  enemyHive: HiveView;
  private enemyChamberSnapshot: boolean[];
  unitPool: UnitPool;
  spatialIndex: SpatialIndex;
  units: Unit[];
  // Phase 6 follow-up #2 — WorldEntity wrappers around the hive
  // structures so ranged units' targeting includes the base.
  playerBaseEntity: BaseEntity;
  enemyBaseEntity: BaseEntity;
  deckKeys: string[];
  SBW: number;
  worldW: number;

  // Active pheromone command zones. Decayed each tick; passed to
  // combat.resolve so own-side units obey the painted lane commands.
  pheromoneZones: PheromoneZone[] = [];

  /** The player's controllable Royal (VISION §3), cached at spawn for
   *  click-control. Null until spawned / after death (until respawn lands). */
  playerRoyal: Unit | null = null;
  /** Royal key for respawn (the lineage continues); set at the first auto-spawn. */
  private royalKey: string | null = null;
  /** Seconds until the next Matriarch respawns; > 0 == the leaderless window. */
  private royalRespawnTimer = 0;
  /** Royal command mode (R / profile toggle). Clicks only order her while true;
   *  cleared on her death. Published to the HUD as 'royal.selected'. */
  royalSelected = false;

  // Round-robin lane cursor for wave/AI enemy spawns so both lanes populate.
  private _enemyLaneCursor = 0;

  // Game state
  running: boolean;
  won: string | null;
  kills: number;
  elapsed: number;

  constructor(scene: Phaser.Scene, deckKeys: string[], startWave: number = 1, worldW: number = DEFAULT_WORLD_W, customWaves?: WaveDef[], runBuffs?: RunBuff[], hiveProfile?: HiveProfile, hiveSeed?: number) {
    this.scene = scene;
    this.events = new EventBus();
    this.worldW = worldW;
    resetUid();

    // Deck
    this.deckKeys = deckKeys;

    const SBW = SBW_CONST;
    this.SBW = SBW;

    // Units
    this.unitPool = new UnitPool(scene);
    this.spatialIndex = new SpatialIndex();
    this.units = [];

    // Systems
    this.audio = new AudioManager();
    this.combat = new CombatSystem(scene, this.events, worldW);
    this.waves = hiveProfile && hiveSeed !== undefined
      ? new AIHiveController(scene, hiveProfile, this.events, new SeededRNG(hiveSeed), () => this.units)
      : new WaveManager(scene, startWave, this.events, customWaves);
    this.economy = new EconomyManager(scene);
    this.abilities = new AbilityManager(scene, this.events, worldW);
    this.particles = new ParticleManager(scene);
    this.incubation = new IncubationManager();
    const isAIMode = !!(hiveProfile && hiveSeed !== undefined);
    this.playerHive = {
      base: new BaseStructure(scene, 0, 'player'),
      larvae: new LarvaVisuals(scene),
      cocoons: new CocoonVisuals(scene),
    };
    this.enemyHive = {
      base: new BaseStructure(scene, worldW - SBW, 'enemy'),
      larvae: isAIMode ? new LarvaVisuals(scene, worldW - SBW_CONST) : new LarvaVisuals(scene, worldW - SBW_CONST),
      cocoons: new CocoonVisuals(scene),
    };
    this.enemyChamberSnapshot = new Array(MAX_CHAMBERS).fill(false);

    // Phase 6 follow-up #2 — wrap bases as WorldEntity instances and
    // register them in the spatial index. The wall positions are:
    //   playerBase wall: x = SBW          (enemy units approach from right, attack when u.x ≤ SBW)
    //   enemyBase wall:  x = worldW - SBW (player units approach from left, attack when u.x + u.unitW ≥ worldW - SBW)
    // Bases are dropped with the GameManager — no explicit deregister
    // is needed since the spatial index is owned by this instance.
    this.playerBaseEntity = new BaseEntity(this.playerHive.base, SBW);
    this.enemyBaseEntity = new BaseEntity(this.enemyHive.base, worldW - SBW);
    this.spatialIndex.add(this.playerBaseEntity);
    this.spatialIndex.add(this.enemyBaseEntity);
    this.combat.setBaseEntities(this.playerBaseEntity, this.enemyBaseEntity);

    // Apply run buffs (hive buildings from roguelike rewards)
    if (runBuffs) {
      for (const buff of runBuffs) {
        if (buff.type === 'nectar_income') this.economy.addBaseIncome(buff.value);
      }
    }

    // Game state
    this.running = true;
    this.won = null;
    this.kills = 0;
    this.elapsed = 0;

    // Attach this battle's units to the HpHud overlay (DEV only — the
    // HpHud command is registered at module load and is a no-op until a
    // source is attached). Detached in cleanupDebugCommands.
    if (import.meta.env.DEV) {
      HpHud.attachSource(() => this.units);
    }

    // Debug commands (dev only — tree-shaken in production)
    if (import.meta.env.DEV) {
      registerDebugCommand('win', 'Instant victory', () => { this.debugWin(); return 'Victory triggered.'; });
      registerDebugCommand('nectar', 'Set nectar (e.g. nectar 999)', (args) => {
        const n = parseInt(args[0]); if (isNaN(n)) return 'Usage: nectar <amount>';
        this.economy.nectar = n; return `Nectar set to ${n}`;
      });
      registerDebugCommand('wave', 'Skip to wave end', () => {
        this.waves.enemyQueue.length = 0;
        this.waves.waveTimer = this.waves.waveInterval - 0.1;
        return 'Wave skipped.';
      });
      registerDebugCommand('hp', 'Set player base HP (e.g. hp 9999)', (args) => {
        const n = parseInt(args[0]); if (isNaN(n)) return 'Usage: hp <amount>';
        this.playerHive.base.setHp(n); return `Base HP set to ${n}`;
      });
      registerDebugCommand('ai', 'Toggle live AI hive overlay', () => {
        if (!(this.waves instanceof AIHiveController)) return 'Not an AI battle.';
        const existing = document.getElementById('ai-debug-overlay');
        if (existing) { existing.remove(); return 'AI overlay hidden.'; }
        const overlay = document.createElement('div');
        overlay.id = 'ai-debug-overlay';
        overlay.style.cssText = 'position:fixed; top:4px; right:4px; background:rgba(0,0,0,0.8); color:#0f0; font-family:"Courier New",monospace; font-size:10px; padding:6px 10px; z-index:9999; white-space:pre; pointer-events:none; border:1px solid #333; border-radius:3px;';
        document.body.appendChild(overlay);
        const ai = this.waves as AIHiveController;
        const updateOverlay = () => {
          if (!document.getElementById('ai-debug-overlay')) return;
          const chambers = ai.incubation.chambers
            .filter(c => c !== null)
            .map(c => `${c!.key} ${Math.ceil(c!.remaining)}s`)
            .join(', ') || 'empty';
          const larvaNext = ai.incubation.larvaCount < 10
            ? `(${Math.ceil(5 - ai.incubation.larvaTimer)}s)`
            : 'MAX';
          const aiCapUsed = capUsed(this.units, 'enemy', ai.incubation.chambers);
          const capWarn = aiCapUsed >= MAX_CAPACITY ? ' [FULL]' : aiCapUsed >= MAX_CAPACITY * 0.8 ? ' [HIGH]' : '';
          overlay.textContent = [
            `AI: ${(ai as any).profile.personality}`,
            `Nectar: ${Math.floor(ai.nectar)} +${ai.income}/s`,
            `Larvae: ${ai.incubation.larvaCount} ${larvaNext}`,
            `Chambers: ${chambers}`,
            `Cap: ${aiCapUsed} / ${MAX_CAPACITY}${capWarn}`,
            `Base HP: ${this.enemyHive.base.hp}/${this.enemyHive.base.maxHp}`,
            `Intent: [${ai.intent.action}] ${ai.intent.details}`,
            `---`,
            ...ai.debugLog,
          ].join('\n');
          requestAnimationFrame(updateOverlay);
        };
        updateOverlay();
        return 'AI overlay shown. Type "ai" again to hide.';
      });
    }

    // Wire up event listeners
    this.events.on('enemyKilled', (data) => {
      this.economy.earn(data.unit.reward);
      this.kills++;
      this.audio.nectarEarn();
    });

    this.events.on('unitSpawned', (data) => {
      if (data.side === 'enemy') this.spawnEnemy(data.key);
    });

    this.events.on('waveStart', (data) => {
      this.audio.waveStart();
      this.events.emit('logMessage', { message: `\u26A0 Wave ${data.wave} incoming!` });
    });

    // The Royal is on the field from the opening bell (VISION \u00A73): find her key
    // and auto-spawn her, held at the hive (she doesn't auto-march). Hidden from
    // the deploy bar (WorldScene) \u2014 not incubated like other units.
    this.royalKey = this.deckKeys.find(k => UNIT_DEFS[k]?.caste === 'royal') ?? null;
    this.playerRoyal = this.spawnPlayerRoyal();
  }

  /**
   * Spawn the player's Royal at the hive and give her a HOLD order on the spot \u2014
   * she does NOT auto-march like rank-and-file; she waits + guards home until the
   * player commits her (a move/focus click). Shared by the opening spawn + respawn.
   */
  private spawnPlayerRoyal(): Unit | null {
    if (!this.royalKey) return null;
    const def = UNIT_DEFS[this.royalKey];
    if (!def) return null;
    const royal = this.createUnit(this.royalKey, 'player', def, this.SBW + 40, 0);
    royal.order = { kind: 'move', x: royal.x + royal.unitW / 2 }; // hold at spawn, guard the hive
    return royal;
  }

  tick(dt: number): void {
    if (!this.running) return;

    this.elapsed += dt;

    // Update systems
    this.economy.update(dt);
    this.abilities.update(dt);
    this.waves.update(dt, this.particles);

    // Incubation — hatch ready units
    const hatched = this.incubation.update(dt);
    for (const h of hatched) {
      this.createUnit(h.key, 'player', h.def, this.SBW + 2, h.lane);
    }
    this.playerHive.cocoons.update(dt, this.incubation.chambers, this.incubation.numChambers);
    this.playerHive.larvae.update(dt, this.incubation.larvaCount);

    // Update enemy visuals (AI hive mode)
    if (this.waves instanceof AIHiveController) {
      const ai = this.waves as AIHiveController;
      const aiInc = ai.incubation;

      // Detect newly filled chambers → set cocoon positions from consumed larvae
      for (let i = 0; i < aiInc.numChambers; i++) {
        const wasEmpty = !this.enemyChamberSnapshot[i];
        const nowFull = aiInc.chambers[i] !== null;
        if (wasEmpty && nowFull) {
          const pos = this.enemyHive.larvae.consumeLarva(aiInc.larvaCount + 1);
          this.enemyHive.cocoons.setCocoonPosition(i, pos.x, pos.y);
        }
        this.enemyChamberSnapshot[i] = nowFull;
      }
      this.enemyHive.cocoons.update(dt, aiInc.chambers, aiInc.numChambers);
      this.enemyHive.larvae.update(dt, aiInc.larvaCount);
    }

    // Update wall shield visual
    this.playerHive.base.shielded = this.abilities.wallActive > 0;

    // Pheromone zones — decay then drop expired BEFORE resolve reads
    // them. resolve() only READS zones; lifetime lives here.
    if (this.pheromoneZones.length > 0) {
      for (const z of this.pheromoneZones) z.remaining -= dt;
      this.pheromoneZones = this.pheromoneZones.filter(z => z.remaining > 0);
    }

    // Combat resolution
    this.combat.resolve(
      this.units, dt,
      this.playerHive.base, this.enemyHive.base,
      this.particles,
      this.abilities.wallActive,
      this.audio,
      this.pheromoneZones
    );

    // Re-sort live units in the spatial index after combat moved them.
    // Sweep-and-prune bubbles each entity toward its sorted position,
    // so this loop is amortized O(n) across typical per-frame movement.
    for (const u of this.units) {
      if (!u.dead) this.spatialIndex.update(u);
    }

    // Clean up dead units — return to pool.
    this.units = this.units.filter(u => {
      if (u.dead) {
        this.spatialIndex.remove(u);
        this.unitPool.despawn(u);
        return false;
      }
      return true;
    });

    // Royal lifecycle (VISION §3) — death → respawn countdown + leaderless window.
    this.updateRoyalLifecycle(dt);

    // Update particles
    this.particles.update(dt);

    // Update bases
    this.playerHive.base.update(dt);
    this.enemyHive.base.update(dt);

    // Phase 6 follow-up #2 — re-derive `dead` on the base entities so
    // spatial-index queries (which exclude dead via matchesFilter) and
    // _findTarget's base check stop returning a destroyed hive on the
    // next frame. Cheap derivation; no separate state.
    this.playerBaseEntity.syncDead();
    this.enemyBaseEntity.syncDead();

    // Check defeat
    if (this.playerHive.base.hp <= 0) {
      this.running = false;
      this.won = 'enemy';
      this.audio.defeat();
    }

    // Check victory: enemy base destroyed
    if (!this.won && this.enemyHive.base.hp <= 0) {
      this.running = false;
      this.won = 'player';
      this.audio.waveStart();
    }

    // Check victory: attrition (all waves/AI depleted + no living enemies)
    if (!this.won && this.waves.isComplete) {
      const livingEnemies = this.units.some(u => u.side === 'enemy' && !u.dead);
      if (!livingEnemies) {
        this.running = false;
        this.won = 'player';
        this.audio.waveStart();
      }
    }
  }

  playerSpawn(key: string, lane = 0): SpawnResult {
    const def = UNIT_DEFS[key];
    if (!def) return { success: false, message: '' };
    if (!this.economy.canAfford(def.cost)) {
      return { success: false, message: 'Not enough nectar!' };
    }
    if (this.incubation.larvaCount <= 0) {
      return { success: false, message: 'No larvae available!' };
    }
    if (this.incubation.isFull()) {
      return { success: false, message: 'All chambers full!' };
    }
    const used = capUsed(this.units, 'player', this.incubation.chambers);
    if (!canDeploy(def, used)) {
      return { success: false, message: 'HIVE FULL' };
    }
    this.economy.spend(def.cost);
    // Capture larva position before consuming it
    const larvaPos = this.playerHive.larvae.consumeLarva(this.incubation.larvaCount);
    const chamberIdx = this.incubation.queue(key, def, lane);
    if (chamberIdx >= 0) {
      this.playerHive.cocoons.setCocoonPosition(chamberIdx, larvaPos.x, larvaPos.y);
    }
    this.audio.spawn();
    return { success: true, message: `Incubating ${def.name}...` };
  }

  cancelIncubation(index: number): SpawnResult {
    const refund = this.incubation.cancel(index);
    if (refund < 0) return { success: false, message: '' };
    this.economy.earn(refund);
    return { success: true, message: `Cancelled! +${refund} nectar refunded.` };
  }

  spawnEnemy(key: string): void {
    const def = ENEMY_DEFS[key];
    if (!def) return;

    const scale = this.waves.getScaleFactor();
    let scaledDef = def;
    if (scale > 1) {
      scaledDef = { ...def, hp: Math.ceil(def.hp * scale), atk: Math.ceil(def.atk * scale) };
    }

    // Round-robin enemies across both lanes so the front splits across the field.
    const lane = this._enemyLaneCursor;
    this._enemyLaneCursor ^= 1;
    this.createUnit(key, 'enemy', scaledDef, this.worldW - this.SBW - def.w - 2, lane);
  }

  createUnit(key: string, side: Side, def: UnitDef, x: number, lane = 0): Unit {
    const unitDef = { ...def, _key: key };
    const unit = this.unitPool.spawn(unitDef, side, x, lane);
    this.units.push(unit);
    this.spatialIndex.add(unit);
    return unit;
  }

  /**
   * Per-Elite signature-slot state for the HUD (published to registry
   * `elite.slots`). One entry per LIVE player Elite — the HUD renders a trigger
   * button per slot; clicking emits `triggerSignature` → combat.requestSignature.
   */
  getEliteSlots(): EliteSlot[] {
    const slots: EliteSlot[] = [];
    for (const u of this.units) {
      if (u.side !== 'player' || u.dead) continue;
      if (UNIT_DEFS[u.key]?.caste !== 'elite') continue; // Royal has its own profile panel
      const frac = u.signatureCooldown > 0 ? u.sigCd / u.signatureCooldown : 0;
      slots.push({
        id: u.id,
        key: u.key,
        name: u.unitName,
        ready: u.canSignature(),
        cdFrac: frac < 0 ? 0 : frac > 1 ? 1 : frac,
        firable: !!u.signatureAbility,
        inRange: this.signatureHasTarget(u),
      });
    }
    return slots;
  }

  /** True if an enemy sits within the unit's signature range (same lane) — i.e.
   *  firing would actually connect, so the slot can light up as "ready". */
  private signatureHasTarget(u: Unit): boolean {
    if (!u.signatureAbility) return false;
    const ability = lookupAbility(u.signatureAbility);
    // Buff/utility signatures (Primal Roar) buff allies — always "connects".
    if (ability.category !== 'damage') return true;
    const range = ability.range ?? 0;
    if (range <= 0) return false;
    const ux = u.x + u.unitW / 2;
    for (const e of this.units) {
      if (e.side === u.side || e.dead || e.lane !== u.lane) continue;
      if (Math.abs((e.x + e.unitW / 2) - ux) < range) return true;
    }
    return false;
  }

  /**
   * Cast a pheromone command (VISION §5 deposit-fade): spawn a courier Scout from
   * the player hive in `lane`, carrying the command — it runs forward laying a
   * fading scent-trail the sim deposits as it moves (CombatSystem.resolve). The
   * Scout IS the cost: a vulnerable non-combatant, so intercepting it before it
   * lays the scent is the counterplay. Killing it stops the trail; laid scent fades.
   */
  castPheromone(kind: PheromoneKind, lane = 0): { success: boolean; message: string } {
    if (!this.running) return { success: false, message: '' };
    const def = UNIT_DEFS['scout'];
    if (!def) return { success: false, message: '' };
    const scout = this.createUnit('scout', 'player', def, this.SBW + 2, lane);
    scout.pheromoneKind = kind;
    scout.primary = PHEROMONE_DEFS[kind].color; // tint to its command
    return { success: true, message: `${PHEROMONE_DEFS[kind].name} scout sent!` };
  }

  /**
   * Player click on the battlefield (MOBA-lite Royal control, VISION §3):
   *   - click the ROYAL herself → enter command mode (the discoverable select;
   *     R and the profile card toggle it too). Issues no move.
   *   - then, while selected: an enemy under the click (same lane, within its
   *     body) = focus + chase; open ground = move to that spot.
   *   - a field click while NOT selected does nothing (you must pick her up first).
   * `lane` comes from the click's world-Y. No-op when she's dead / the battle's over.
   */
  commandRoyalClick(worldX: number, lane: number): void {
    const r = this.playerRoyal;
    if (!r || r.dead || !this.running) return;

    // Clicked on/near the Royal IN HER LANE → select her (don't move her onto
    // herself). Lane-scoped so a click in the OTHER lane at her x is read as a
    // lane-switch command, not a select. Generous x hit-box — a fumbled "almost
    // hit her" click should select, not silently no-op.
    const grabHalf = Math.max(24, r.unitW);
    if (lane === r.lane && Math.abs(worldX - (r.x + r.unitW / 2)) <= grabHalf) {
      this.royalSelected = true;
      return;
    }

    // Field clicks only command her once she's selected. Say so — a silent
    // no-op here reads as "clicking is broken".
    if (!this.royalSelected) {
      this.events.emit('logMessage', { message: 'Select the Matriarch first — click her, her card, or press R.' });
      return;
    }

    let focus: Unit | null = null;
    for (const u of this.units) {
      if (u.side !== 'enemy' || u.dead || u.lane !== lane) continue;
      if (worldX >= u.x - 4 && worldX <= u.x + u.unitW + 4) { focus = u; break; }
    }
    // Clamp ground-clicks to the playable field — a click past the hive walls
    // means "all the way back/forward", not "stand inside the hive".
    const x = Math.max(this.SBW, Math.min(this.worldW - this.SBW, worldX));
    // Set the destination lane — if it differs, this kicks off the cross-lane slide
    // (Unit eases _laneVisual across; her combat row flips at the midpoint, so the
    // front she's LEAVING threatens her first, then the one she's ENTERING).
    r._laneTarget = lane;
    r.order = focus ? { kind: 'focus', target: focus } : { kind: 'move', x };
  }

  /** Toggle Royal command mode (R key / profile click). Only a living Royal can
   *  be selected; deselect always allowed. */
  toggleRoyalSelect(): void {
    if (this.royalSelected) { this.royalSelected = false; return; }
    if (this.playerRoyal && !this.playerRoyal.dead) this.royalSelected = true;
  }

  /** Royal state for the HUD profile panel (registry 'royal.status'). */
  getRoyalStatus(): RoyalStatus {
    const r = this.playerRoyal;
    const key = this.royalKey ?? '';
    const def = key ? UNIT_DEFS[key] : undefined;
    if (!r || r.dead) {
      return {
        present: this.royalKey != null, alive: false,
        key, name: def?.name ?? 'Royal',
        hp: 0, maxHp: def?.hp ?? 0, hpFrac: 0,
        respawnIn: Math.max(0, Math.ceil(this.royalRespawnTimer)),
        id: -1, sigName: '', sigReady: false, sigCdFrac: 0,
      };
    }
    const sigName = r.signatureAbility ? lookupAbility(r.signatureAbility).name : '';
    const frac = r.signatureCooldown > 0 ? r.sigCd / r.signatureCooldown : 0;
    return {
      present: true, alive: true,
      key, name: r.unitName,
      hp: r.hp, maxHp: r.maxHp, hpFrac: r.maxHp > 0 ? r.hp / r.maxHp : 0,
      respawnIn: 0, id: r.id, sigName,
      sigReady: r.canSignature(),
      sigCdFrac: frac < 0 ? 0 : frac > 1 ? 1 : frac,
    };
  }

  /**
   * Royal lifecycle (VISION §3). Three tiers around the authored baseline:
   * baseline (no Royal) < amplified (Royal alive, via her cohesion-amplifier
   * aura) — and, transiently, leaderless (she just died) BELOW baseline.
   *
   *   - Death → start the respawn countdown (which IS the leaderless window).
   *   - Countdown elapses → a fresh lineage Matriarch emerges.
   *   - Leaderless penalty is maintained per-frame on every living player unit
   *     while she's gone, so units deployed mid-gap inherit it; lifted the frame
   *     she returns. DEATH-triggered, not "no Royal present" — a skirmish that
   *     never had a Queen (legacy / sandbox) sits at clean baseline, no penalty.
   * The cohesion-amplifier DROP is automatic (her aura's death-cleanup), so it's
   * not handled here — this only adds the extra leaderless penalty + respawn.
   */
  private updateRoyalLifecycle(dt: number): void {
    if (this.playerRoyal && this.playerRoyal.dead) {
      this.playerRoyal = null;
      this.royalSelected = false; // can't command a corpse
      this.royalRespawnTimer = ROYAL_RESPAWN_TIME;
      this.events.emit('logMessage', { message: 'The Matriarch has fallen — the herd is leaderless!' });
    }

    if (this.royalRespawnTimer > 0) {
      this.royalRespawnTimer -= dt;
      if (this.royalRespawnTimer <= 0) {
        this.royalRespawnTimer = 0;
        this.playerRoyal = this.spawnPlayerRoyal();
        if (this.playerRoyal) this.events.emit('logMessage', { message: 'A new Matriarch emerges!' });
      }
    }

    const leaderless = this.royalRespawnTimer > 0;
    for (const u of this.units) {
      if (u.side !== 'player' || u.dead) continue;
      const has = u.modifiers?.some(m => m.source === LEADERLESS_SOURCE) ?? false;
      if (leaderless && !has) {
        addModifier(u, { stat: 'atk', type: 'percent', value: LEADERLESS_ATK_PCT, source: LEADERLESS_SOURCE });
      } else if (!leaderless && has) {
        removeModifiersBySource(u, LEADERLESS_SOURCE);
      }
    }
  }

  castAbility(key: PlayerAbilityKey): { success: boolean; message: string } {
    if (!this.running) return { success: false, message: '' };
    let success = false;
    let message = '';
    switch (key) {
      case 'nuke':
        success = this.abilities.castNuke(this.economy, this.units, this.enemyHive.base, this.particles);
        if (success) { message = '\u2622 Acid Nuke hits ALL enemies!'; this.audio.abilityNuke(); }
        break;
      case 'wall':
        success = this.abilities.castWall(this.economy, this.playerHive.base, this.particles);
        if (success) { message = '\u{1F9F1} Steel Wall active! Base invincible!'; this.audio.abilityWall(); }
        break;
      case 'slow':
        success = this.abilities.castSlow(this.economy, this.units, this.particles);
        if (success) { message = '\u{1F33F} Pheromone! Enemy speed halved!'; this.audio.abilitySlow(); }
        break;
      case 'repair':
        success = this.abilities.castRepair(this.economy, this.playerHive.base, this.particles);
        if (success) { message = '\u{1F527} Base repaired!'; this.audio.abilityRepair(); }
        break;
    }
    return { success, message };
  }

  generateUnitPreviews(): Record<string, string> {
    const previews: Record<string, string> = {};
    this.deckKeys.forEach(key => {
      const def = UNIT_DEFS[key];
      if (!def) return;
      const pad = 10;
      const pw = def.w + pad * 2;
      const ph = def.h + pad * 2 + 10;
      const g = this.scene.add.graphics();
      const renderUnit: RenderUnit = {
        w: def.w, h: def.h,
        ...resolveColors(def),
        palette: def.palette,
        facing: 1, bob: 0,
        state: 'march', atkCd: 0, atkRate: def.atkRate,
        trait: def.trait, hp: def.hp, maxHp: def.hp,
        burrowed: false, windup: 0, recover: 0,
      };
      drawUnit(g, renderUnit, pw / 2, pad);
      const texKey = '_preview_' + key;
      g.generateTexture(texKey, pw, ph);
      g.destroy();
      const src = this.scene.textures.get(texKey).getSourceImage() as HTMLCanvasElement;
      previews[key] = src.toDataURL();
      this.scene.textures.remove(texKey);
    });
    return previews;
  }

  getGameOverData(): { wavesCleared: number; kills: number; won: boolean; elapsed: number } {
    return {
      wavesCleared: this.waves.stage - 1,
      kills: this.kills,
      won: this.won === 'player',
      elapsed: this.elapsed,
    };
  }

  debugWin(): void {
    // Destroy enemy base — triggers victory condition next tick
    this.enemyHive.base.setHp(0);
    this.units.forEach(u => { if (u.side === 'enemy' && !u.dead) u.kill(); });
  }

  cleanupDebugCommands(): void {
    if (import.meta.env.DEV) {
      unregisterDebugCommand('win');
      unregisterDebugCommand('nectar');
      unregisterDebugCommand('wave');
      unregisterDebugCommand('hp');
      unregisterDebugCommand('ai');
      HpHud.detachSource();
    }
  }

  saveAndGetPoints(): number {
    const save = new SaveManager();
    const data = this.getGameOverData();
    return save.recordGameResult(data.wavesCleared, data.kills, data.won, data.elapsed);
  }

}
