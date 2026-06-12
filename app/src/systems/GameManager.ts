import Phaser from 'phaser';
import type { WaveDef, Side, PlayerAbilityKey, IWaveController, HiveProfile, PheromoneZone, PheromoneKind, EliteSlot, RoyalStatus, UnitDef } from '../types';
import { PHEROMONE_DEFS } from '../config/PheromoneDefs';
import { DEFAULT_WORLD_W, SBW as SBW_CONST } from '../config/Constants';
import type { RunBuff } from './RunState';
import { UNIT_DEFS, hiveGenelineOf } from '../units/registry';
import { ENEMY_DEFS } from '../config/EnemyDefs';
import { BaseStructure } from '../entities/BaseStructure';
import { BaseEntity } from '../entities/BaseEntity';
import { Unit, resetUid } from '../entities/Unit';
import { BattleCore } from './BattleCore';
import { RoyalLifecycle } from './RoyalLifecycle';
import { Forage } from './Forage';
import { FORAGE_ENABLED, PASSIVE_FLOOR, AI_INCOME_MULT, BLOOM_CLICK_RADIUS } from '../config/ForageDefs';
import { VyssEconomy } from './VyssEconomy';
import { Maturation } from './Maturation';
import { MATURATION_ENABLED } from '../config/MaturationDefs';
import { vyssYieldOf, PHEROMONE_VYSS_COST } from '../config/VyssDefs';
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
import { registerBattleDebugCommands, unregisterBattleDebugCommands } from './BattleDebugCommands';
import { previewDataURL } from '../ui/UnitPreviews';
import { CocoonVisuals } from '../entities/CocoonVisuals';
import { LarvaVisuals } from '../entities/LarvaVisuals';
import { HpHud } from './HpHud';

export interface HiveView {
  base: BaseStructure;
  larvae: LarvaVisuals;
  cocoons: CocoonVisuals;
}

export interface SpawnResult {
  success: boolean;
  message: string;
}

/**
 * Composition root for the REAL battle (the run loop). The battle substrate
 * (units / combat / pheromone zones) lives in BattleCore — shared with the
 * sandbox — and GameManager layers the run game on top: economy, incubation,
 * waves/AI opponent, player abilities, the Royal lifecycle, and win/loss.
 */
export class GameManager {
  scene: Phaser.Scene;
  events: EventBus;
  audio: AudioManager;
  /** The shared battle substrate (units + combat + zones). */
  core: BattleCore;
  /** The controllable Royal's lifecycle (VISION §3). */
  royal: RoyalLifecycle;
  /** The active economy (gatherer workers + nectar blooms); null when the
   *  FORAGE_ENABLED knob is off (legacy passive ramp). */
  forage: Forage | null = null;
  /** The tactical currency — VYSS, the essence of the fallen, spent on commands. */
  vyss: VyssEconomy;
  /** The per-battle tech-up arc (VISION §2.1); null when the knob is off. */
  maturation: Maturation | null = null;
  /** G-mode: clicks set the gather priority instead of commanding the Royal.
   *  Mutually exclusive with Royal command mode. */
  gatherMode = false;
  waves: IWaveController;
  economy: EconomyManager;
  abilities: AbilityManager;
  particles: ParticleManager;
  incubation: IncubationManager;
  playerHive: HiveView;
  enemyHive: HiveView;
  private enemyChamberSnapshot: boolean[];
  // Phase 6 follow-up #2 — WorldEntity wrappers around the hive
  // structures so ranged units' targeting includes the base.
  playerBaseEntity: BaseEntity;
  enemyBaseEntity: BaseEntity;
  deckKeys: string[];
  SBW: number;
  worldW: number;

  // Round-robin lane cursor for wave/AI enemy spawns so both lanes populate.
  private _enemyLaneCursor = 0;

  // Game state
  running: boolean;
  won: string | null;
  kills: number;
  elapsed: number;

  /** Live hive capacity — grows with the maturation phase. */
  get maxCapacity(): number {
    return this.maturation?.capacity ?? MAX_CAPACITY;
  }

  // --- Substrate / Royal delegates (the scenes' stable API surface) ---
  get units(): Unit[] { return this.core.units; }
  get combat(): CombatSystem { return this.core.combat; }
  get pheromoneZones(): PheromoneZone[] { return this.core.pheromoneZones; }
  get playerRoyal(): Unit | null { return this.royal.royal; }
  get royalSelected(): boolean { return this.royal.selected; }

  constructor(scene: Phaser.Scene, deckKeys: string[], startWave: number = 1, worldW: number = DEFAULT_WORLD_W, customWaves?: WaveDef[], runBuffs?: RunBuff[], hiveProfile?: HiveProfile, hiveSeed?: number) {
    this.scene = scene;
    this.events = new EventBus();
    this.worldW = worldW;
    resetUid();

    // Deck
    this.deckKeys = deckKeys;

    const SBW = SBW_CONST;
    this.SBW = SBW;

    // The battle substrate + the systems layered on it.
    this.core = new BattleCore(scene, this.events, worldW);
    this.royal = new RoyalLifecycle(this.core, this.events, {
      spawnX: SBW + 40,
      minX: SBW,
      maxX: worldW - SBW,
    });
    this.audio = new AudioManager();
    // AI economy under forage: the AI doesn't gather (v1), so its passive-era
    // income curve is consciously tuned down toward a plausible built eco.
    const aiProfile = hiveProfile && FORAGE_ENABLED
      ? { ...hiveProfile, baseIncome: Math.max(1, Math.round(hiveProfile.baseIncome * AI_INCOME_MULT)), maxIncome: Math.max(2, Math.round(hiveProfile.maxIncome * AI_INCOME_MULT)) }
      : hiveProfile;
    this.waves = aiProfile && hiveSeed !== undefined
      ? new AIHiveController(scene, aiProfile, this.events, new SeededRNG(hiveSeed), () => this.core.units)
      : new WaveManager(scene, startWave, this.events, customWaves);
    this.economy = new EconomyManager(scene);
    this.vyss = new VyssEconomy();
    if (MATURATION_ENABLED) this.maturation = new Maturation();
    this.abilities = new AbilityManager(scene, this.events, worldW);
    this.particles = new ParticleManager(scene);
    if (FORAGE_ENABLED) {
      // Active economy: built income (gatherers) replaces the passive ramp;
      // the floor prevents softlock, nothing more — and it GROWS with the
      // hive's maturation phase (the mature hive secretes more).
      this.economy.rampEnabled = false;
      this.economy.income = this.maturation?.passiveIncome ?? PASSIVE_FLOOR;
      this.forage = new Forage(
        this.core, this.economy, this.vyss, this.particles, this.events,
        new SeededRNG((hiveSeed ?? startWave * 7919) + 1), // distinct stream from the AI's
        { homeX: SBW + 10, worldW },
      );
    }
    this.incubation = new IncubationManager();
    // Each hive wears its geneline's body: the player's from their deck's
    // Royal, the enemy's from its AI roster (both via hiveGenelineOf).
    this.playerHive = {
      base: new BaseStructure(scene, 0, 'player', hiveGenelineOf(deckKeys)),
      larvae: new LarvaVisuals(scene),
      cocoons: new CocoonVisuals(scene),
    };
    this.enemyHive = {
      base: new BaseStructure(scene, worldW - SBW, 'enemy', hiveGenelineOf(hiveProfile?.roster ?? [])),
      larvae: new LarvaVisuals(scene, worldW - SBW_CONST),
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
    this.core.spatialIndex.add(this.playerBaseEntity);
    this.core.spatialIndex.add(this.enemyBaseEntity);
    this.core.combat.setBaseEntities(this.playerBaseEntity, this.enemyBaseEntity);

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
      HpHud.attachSource(() => this.core.units);
      registerBattleDebugCommands(this);
    }

    // Wire up event listeners.
    // Kill income is VYSS (via corpse pickups), not nectar (the anti-snowball: winning fights
    // buys PLAYS, not more army). Deaths drop PHYSICAL remains the gatherers
    // scavenge — ownership is whoever hauls it home, so your own dead (near
    // home, safe) are the comeback and your kills (deep) are the risk pay.
    this.events.on('enemyKilled', () => {
      this.kills++;
      this.audio.nectarEarn();
    });
    this.events.on('unitDied', (data) => {
      const def = UNIT_DEFS[data.key] ?? ENEMY_DEFS[data.key];
      if (!def) return;
      const vyssYield = vyssYieldOf(def);
      if (vyssYield <= 0) return;
      if (this.forage) this.forage.dropCorpse(data.x, data.lane, vyssYield);
      else this.vyss.earn(vyssYield); // forage off → instant credit fallback
    });

    this.events.on('unitSpawned', (data) => {
      if (data.side === 'enemy') this.spawnEnemy(data.key);
    });

    this.events.on('waveStart', (data) => {
      this.audio.waveStart();
      this.events.emit('logMessage', { message: `⚠ Wave ${data.wave} incoming!` });
    });

    // The Royal is on the field from the opening bell (VISION §3), held at
    // the hive until commanded. Hidden from the deploy bar (WorldScene) —
    // not incubated like other units.
    this.royal.spawnFromDeck(deckKeys);
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
      this.core.createUnit(h.key, 'player', h.def, this.SBW + 2, h.lane);
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

    // Forage — flip gatherer destinations / tick harvests BEFORE the combat
    // step so this frame's movement follows the fresh orders.
    this.forage?.tick(dt);

    // The battle substrate: decay zones → combat step → spatial re-sort +
    // reap the dead back to the pool.
    this.core.tickZones(dt);
    this.core.resolve(
      dt,
      this.playerHive.base, this.enemyHive.base,
      this.particles,
      this.abilities.wallActive,
      this.audio,
    );
    this.core.postResolve();

    // Royal lifecycle (VISION §3) — death → leaderless window → respawn.
    this.royal.update(dt);

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
      const livingEnemies = this.core.units.some(u => u.side === 'enemy' && !u.dead);
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
    // Maturation gate — high tiers wait for the hive to tech up.
    if (this.maturation && !this.maturation.canDeployTier(def.tier)) {
      return { success: false, message: `${def.name} needs the ${this.maturation.phaseNameForTier(def.tier)} Phase — MATURE the hive!` };
    }
    if (!this.economy.canAfford(def.cost)) {
      return { success: false, message: 'Not enough nectar!' };
    }
    if (this.incubation.larvaCount <= 0) {
      return { success: false, message: 'No larvae available!' };
    }
    if (this.incubation.isFull()) {
      return { success: false, message: 'All chambers full!' };
    }
    const used = capUsed(this.core.units, 'player', this.incubation.chambers);
    if (!canDeploy(def, used, this.maxCapacity)) {
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
    this.core.createUnit(key, 'enemy', scaledDef, this.worldW - this.SBW - def.w - 2, lane);
  }

  /** Substrate delegate — spawn a unit into the battle. */
  createUnit(key: string, side: Side, def: UnitDef, x: number, lane = 0): Unit {
    return this.core.createUnit(key, side, def, x, lane);
  }

  /** Per-Elite signature-slot state for the HUD (registry `elite.slots`). */
  getEliteSlots(): EliteSlot[] {
    return this.core.getEliteSlots('player');
  }

  /**
   * Cast a pheromone command (VISION §5 deposit-fade): a courier Scout runs
   * from the player hive in `lane`, laying a fading scent-trail. The Scout IS
   * the cost — vulnerable, interceptable.
   */
  castPheromone(kind: PheromoneKind, lane = 0): { success: boolean; message: string } {
    if (!this.running) return { success: false, message: '' };
    // Commands cost VYSS — the tactical currency the battle itself yields.
    const cost = PHEROMONE_VYSS_COST[kind];
    if (!this.vyss.canAfford(cost)) {
      return { success: false, message: `Not enough vyss (${cost}✦ for ${PHEROMONE_DEFS[kind].name})!` };
    }
    const scout = this.core.spawnCourier(kind, 'player', this.SBW + 2, lane);
    if (!scout) return { success: false, message: '' };
    this.vyss.spend(cost);
    return { success: true, message: `${PHEROMONE_DEFS[kind].name} scout sent!` };
  }

  /**
   * Deploy a GATHERER worker (the active economy). Costs nectar + a LARVA +
   * a capacity slot (the larva *becomes* the worker — instant, no chamber),
   * plus the standing risk: a killed carrier deposits nothing. Forage assigns
   * its bloom (which decides its lane) + runs the loop.
   */
  deployGatherer(): SpawnResult {
    if (!this.running || !this.forage) return { success: false, message: '' };
    const def = UNIT_DEFS['gatherer'];
    if (!def) return { success: false, message: '' };
    if (!this.economy.canAfford(def.cost)) {
      return { success: false, message: 'Not enough nectar!' };
    }
    if (this.incubation.larvaCount <= 0) {
      return { success: false, message: 'No larvae available!' };
    }
    const used = capUsed(this.core.units, 'player', this.incubation.chambers);
    if (!canDeploy(def, used, this.maxCapacity)) {
      return { success: false, message: 'HIVE FULL' };
    }
    this.economy.spend(def.cost);
    this.playerHive.larvae.consumeLarva(this.incubation.larvaCount);
    this.incubation.larvaCount -= 1;
    const u = this.core.createUnit('gatherer', 'player', def, this.SBW + 2, 0);
    this.forage.assign(u); // sets its bloom + lane + the move order
    this.audio.spawn();
    return { success: true, message: 'Gatherer sent to forage!' };
  }

  /** Toggle G-mode (gather priority). Mutually exclusive with Royal command. */
  toggleGatherMode(): void {
    this.gatherMode = !this.gatherMode;
    if (this.gatherMode) {
      this.royal.selected = false;
      this.events.emit('logMessage', { message: 'GATHER — click a bloom to prioritize it; empty field = auto.' });
    }
  }

  /**
   * Battlefield click, routed by mode: G-mode → set the gather priority
   * (a bloom under the click, or AUTO on empty field); otherwise the click
   * belongs to Royal control.
   */
  commandFieldClick(worldX: number, lane: number): void {
    if (!this.running) return;
    if (this.gatherMode && this.forage) {
      // Nearest forage target under the click — a bloom OR a corpse (same-lane
      // preferred). Corpse → all gatherers to corpse-duty (with its built-in
      // fallback chain); bloom → prioritize it; empty field → auto.
      let bestBloom: { id: number; rich: boolean } | null = null;
      let bestDist = BLOOM_CLICK_RADIUS;
      let corpse = false;
      for (const b of this.forage.blooms) {
        const d = Math.abs(b.x - worldX) + (b.lane === lane ? 0 : 30);
        if (d <= bestDist) { bestDist = d; bestBloom = { id: b.id, rich: b.rich }; corpse = false; }
      }
      for (const c of this.forage.corpsePickups) {
        const d = Math.abs(c.x - worldX) + (c.lane === lane ? 0 : 30);
        if (d <= bestDist) { bestDist = d; bestBloom = null; corpse = true; }
      }
      if (corpse) {
        this.forage.setCorpseStance();
        this.events.emit('logMessage', { message: 'Gatherers scavenging corpses!' });
      } else {
        this.forage.setPriority(bestBloom ? bestBloom.id : null);
        this.events.emit('logMessage', {
          message: bestBloom
            ? `Gatherers prioritizing the ${bestBloom.rich ? 'rich' : 'near'} bloom.`
            : 'Gatherers on auto-forage.',
        });
      }
      this.gatherMode = false;
      return;
    }
    this.royal.commandClick(worldX, lane);
  }

  // --- Royal control delegates (RoyalLifecycle owns the behavior) ---

  /** Toggle Royal command mode (R key / profile click). Exits G-mode. */
  toggleRoyalSelect(): void {
    this.royal.toggleSelect();
    if (this.royal.selected) this.gatherMode = false;
  }

  /** Royal state for the HUD profile panel (registry 'royal.status') —
   *  the ultimate stays LOCKED until the hive reaches its final phase. */
  getRoyalStatus(): RoyalStatus {
    const st = this.royal.getStatus();
    if (st.alive && this.maturation && !this.maturation.royalUltUnlocked) {
      st.sigReady = false;
      st.sigName = `${st.sigName} 🔒${this.maturation.lastPhaseName}`;
    }
    return st;
  }

  /** Fire a unit's signature — with the Royal-ultimate maturation gate. */
  requestSignature(unitId: number): void {
    if (!this.running) return;
    if (this.maturation && !this.maturation.royalUltUnlocked
      && this.playerRoyal && unitId === this.playerRoyal.id) {
      this.events.emit('logMessage', { message: `The ultimate awakens in the ${this.maturation.lastPhaseName} Phase — MATURE the hive!` });
      return;
    }
    this.core.combat.requestSignature(unitId);
  }

  /** Spend to advance the hive phase (the MATURE button). */
  matureHive(): SpawnResult {
    if (!this.running || !this.maturation) return { success: false, message: '' };
    const cost = this.maturation.nextCost;
    if (!cost) return { success: false, message: '' };
    const prevIncome = this.maturation.passiveIncome;
    const newPhase = this.maturation.mature(this.economy, this.incubation, this.vyss);
    if (newPhase == null) {
      return { success: false, message: `Maturing needs ${cost.nectar}⬡${cost.larvae > 0 ? ` + ${cost.larvae}🐛` : ''}${cost.vyss > 0 ? ` + ${cost.vyss}✦` : ''}!` };
    }
    // The mature hive secretes more — apply the passive-income step as a
    // DELTA so run-buff income (+2/s building) stacks untouched. Forage mode
    // only; the legacy ramp owns income otherwise.
    if (FORAGE_ENABLED) this.economy.addBaseIncome(this.maturation.passiveIncome - prevIncome);
    this.audio.waveStart();
    return {
      success: true,
      message: newPhase >= this.maturation.phaseCount
        ? `🛕 The hive reaches its ${this.maturation.phaseName} Phase — the ultimate awakens!`
        : `🛕 The hive matures — ${this.maturation.phaseName} Phase: tier ${this.maturation.tierCap} unlocked!`,
    };
  }

  castAbility(key: PlayerAbilityKey): { success: boolean; message: string } {
    if (!this.running) return { success: false, message: '' };
    let success = false;
    let message = '';
    switch (key) {
      case 'nuke':
        success = this.abilities.castNuke(this.vyss, this.core.units, this.enemyHive.base, this.particles);
        if (success) { message = '☢ Acid Nuke hits ALL enemies!'; this.audio.abilityNuke(); }
        break;
      case 'wall':
        success = this.abilities.castWall(this.vyss, this.playerHive.base, this.particles);
        if (success) { message = '\u{1F9F1} Steel Wall active! Base invincible!'; this.audio.abilityWall(); }
        break;
      case 'slow':
        success = this.abilities.castSlow(this.vyss, this.core.units, this.particles);
        if (success) { message = '\u{1F33F} Pheromone! Enemy speed halved!'; this.audio.abilitySlow(); }
        break;
      case 'repair':
        success = this.abilities.castRepair(this.vyss, this.playerHive.base, this.particles);
        if (success) { message = '\u{1F527} Base repaired!'; this.audio.abilityRepair(); }
        break;
    }
    return { success, message };
  }

  /** Data-URL portraits of each deck unit's actual procedural draw — the
   *  shared preview renderer (also used by the brood cards + sandbox). The
   *  worker keys ride along for the WORKERS deploy cards (not in the deck). */
  generateUnitPreviews(): Record<string, string> {
    const previews: Record<string, string> = {};
    for (const key of new Set([...this.deckKeys, 'scout', 'gatherer'])) {
      const def = UNIT_DEFS[key];
      if (!def) continue;
      previews[key] = previewDataURL(this.scene, key, def);
    }
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
    this.core.units.forEach(u => { if (u.side === 'enemy' && !u.dead) u.kill(); });
  }

  cleanupDebugCommands(): void {
    if (import.meta.env.DEV) {
      unregisterBattleDebugCommands();
      HpHud.detachSource();
    }
  }

  saveAndGetPoints(): number {
    const save = new SaveManager();
    const data = this.getGameOverData();
    return save.recordGameResult(data.wavesCleared, data.kills, data.won, data.elapsed);
  }

}
