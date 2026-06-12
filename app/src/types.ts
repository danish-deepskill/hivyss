// Shared type definitions for Hivyss

import Phaser from 'phaser';
import type { DamageType } from './config/combat/damageTypes';
import type { ResistanceTier } from './config/combat/resistances';
// Phase 5 primitive types for the IUnit interface's Phase 5 fields.
// Type-only imports — TypeScript erases these at compile time, so the
// runtime circular (ModifierSystem.ts → types.ts → ModifierSystem.ts)
// is a compile-only cycle and resolves cleanly. Same applies to
// ActiveEffect from the effects types barrel.
import type { Modifier } from './systems/ModifierSystem';
import type { ActiveEffect } from './config/combat/effects/types';
import type { Motion } from './units/motions';

// --- ECS-lite components (Combat Rewrite Decision 1) ---
// Component tags are declared here so any type in this file (e.g. IUnit,
// WorldEntity) can reference them without crossing back through a
// systems/ import cycle. Helpers and defaults live in
// systems/EntityComponents.ts.

export type ComponentTag =
  | 'HasHP'
  | 'HasResistance'
  | 'IsTargetable'
  | 'HasOnDeath'
  | 'HasZoneShape'
  | 'HasAI'
  | 'HasTrajectory'
  | 'HasAllegiance'
  | 'HasSourceAttribution'
  | 'HasCapacityCost'
  | 'HasModifiers';

/**
 * Minimal contract every entity the combat rewrite can address must
 * satisfy. Units extend this; future Pylons, Zones, Projectiles, Trail
 * segments will too. The base carries only what is truly universal —
 * identity, world position, liveness, and component tags. Anything
 * system-specific (side, route, hp, movement, etc.) is opt-in via
 * components or subtype fields.
 */
export interface WorldEntity {
  id: number;
  x: number;
  y: number;
  dead: boolean;
  components: Set<ComponentTag>;
}

// --- Tier System ---

export type TierKey = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type CasteKey = 'soldier' | 'elite' | 'royal' | 'worker';
// Full 24-letter Greek alphabet + 'normal' as the untagged baseline.
// Only a few are populated in UNIT_DEFS today (alpha + normal); the
// rest are declared up front so future content additions typecheck
// without touching this file.
export type GeneLine =
  | 'alpha' | 'beta' | 'gamma' | 'delta' | 'epsilon'
  | 'zeta' | 'eta' | 'theta' | 'iota' | 'kappa'
  | 'lambda' | 'mu' | 'nu' | 'xi' | 'omicron'
  | 'pi' | 'rho' | 'sigma' | 'tau' | 'upsilon'
  | 'phi' | 'chi' | 'psi' | 'omega' | 'normal'
  // Not a real geneline — a parking bucket for retired/legacy units (the old
  // "military alpha" roster) kept registered for combat tests. See units/archive.ts.
  | 'archive';
export type Route = 'air' | 'land' | 'tunnel';
export type AttackRange = 'melee' | 'ranged';
export type UnitRole = 'tank' | 'dps' | 'support' | 'ranged';
export type AIPersonality = 'aggressive' | 'defensive' | 'swarm';

export interface TierDef {
  label: string;
  name: string;
  color: string;
}

export interface GeneLineDef {
  symbol: string;  // Greek letter
  name: string;
  color: string;
}

// --- Geneline Palette ---

export interface GenePalette {
  primary: number;  // [hex] body fill
  secondary: number; // [hex] dark body shade
  accent: number;   // [hex] signature highlight (bone for alpha)
  shadow: number;   // [hex] deepest shadow
}

// --- Unit Definitions ---

/**
 * Per-unit self-modifier. The updatePassives self-modifier branch
 * adds/removes a source-tagged modifier (`self:${id}:${stat}`) on the
 * unit based on a named predicate. Step-function at the predicate
 * level — condition transitions flip the modifier cleanly.
 * Predicates live in PassivePredicates.ts's PREDICATE_TABLE.
 */
export interface SelfModifierConfig {
  /** Stat to modify — e.g. 'atkRate', 'atk', 'spd'. */
  stat: string;
  /** Modifier type — matches ModifierSystem `ModifierType`. */
  type: 'flat' | 'percent' | 'override';
  /** Modifier value — e.g. 50 for +50%. */
  value: number;
  /** Named predicate lookup key into `PREDICATE_TABLE`. */
  condition: string;
}

/**
 * Per-unit continuously-active aura. The updatePassives aura branch
 * walks in-range same-side allies and maintains a source-tagged
 * modifier (`aura:${ownerId}:${stat}`) on each. Multi-source stacks
 * additively. Dead owner runs a ONE-TIME cleanup pass gated on
 * `IUnit._auraCleanedUp`.
 */
export interface AuraModifierConfig {
  /** Stat to modify on covered allies — e.g. 'dmg_taken', 'atk'. */
  stat: string;
  /** Modifier type — matches ModifierSystem `ModifierType`. */
  type: 'flat' | 'percent' | 'override';
  /** Modifier value — e.g. -20 for -20%, 20 for +20%. */
  value: number;
  /**
   * Aura radius in pixels (center-to-center). Distance `>= range`
   * is OUT of range (strict less-than inclusivity matches legacy
   * `Math.abs(...) < range`).
   */
  range: number;
}

/**
 * Per-unit cooldown-gated passive heal. The updatePassives heal
 * branch ticks `u.healTimer` by dt; when >= cooldown AND the ability's
 * selector returns a target, queues the heal via the pipeline and
 * resets the timer. On empty-target frames the timer stays at/above
 * cooldown — next-frame target acquisition fires immediately.
 * Range lives on the AbilityDef, not here.
 */
export interface PassiveHealConfig {
  abilityName: string;
  cooldown: number;
}

/**
 * Discriminator for the per-frame passive tick band. Each kind has a
 * registered handler in `PASSIVE_HANDLERS` (systems/PassiveHandlers.ts)
 * that knows how to tick it. Add a new kind here + a handler there —
 * no new UnitDef field, no new branch wired into the combat loop.
 *
 * SCOPE: this union is ONLY the per-frame tick band (auras, self-buff
 * toggles, heal casts, future regen/shield-pulse). Event-driven
 * behaviors (reflect, thorns, lifesteal — fire on a damage/hit event)
 * belong in PIPELINE PHASES, not here. Terrain/structures belong in the
 * WorldEntity layer. T6+ apex behaviors are bespoke subsystems.
 */
/**
 * Pack Cohesion (α Primal) — a self-modifier whose magnitude scales with
 * the number of same-geneline allies massed within `radius`. The herd
 * gets stronger the tighter it packs. See `app/docs/mvp/ALPHA.md`.
 */
export interface CohesionConfig {
  /** Stat boosted per nearby pack-ally (e.g. 'atk'). */
  stat: string;
  type: 'flat' | 'percent' | 'override';
  /** Bonus per ally inside the herd radius. */
  perAlly: number;
  /** Herd radius in px (center-to-center). */
  radius: number;
  /** Max allies counted — caps the bonus. */
  maxAllies: number;
}

/**
 * Spawner (β Swarm) — the unit periodically BIRTHS other units (Broodmother's
 * passive brood). Generative power is T4+/Royal-tier per the self-vs-ally rule;
 * spawning routes through the spawn dispatcher (CombatDispatch), so it's a
 * no-op in tests and works in both battle drivers.
 */
export interface SpawnerConfig {
  /** Unit key to birth (the player/enemy mirror is resolved by side). */
  unitKey: string;
  /** Seconds between broods. */
  interval: number;
  /** Units per brood. */
  count: number;
}

export type PassiveKind = 'self_modifier' | 'aura_modifier' | 'heal_cast' | 'cohesion' | 'spawner';

/**
 * A single always-on passive behavior, discriminated by `kind`. Variant
 * payloads reuse the existing config interfaces verbatim.
 *
 * Authoring shape lives on `UnitDef.passives`; `Unit.init()` copies the
 * array onto the runtime unit, where the registry driver dispatches each
 * entry to its handler every frame.
 *
 * Multi-instance note: modifier passives (self/aura) support multiple
 * entries via distinct source tags (`aura:${id}:${stat}`). Timer/latch
 * passives (heal_cast via `healTimer`, aura dead-cleanup via
 * `_auraCleanedUp`) carry single-instance per-unit state — one entry of
 * those kinds per unit. All current units are single-passive.
 */
export type PassiveDef =
  | ({ kind: 'self_modifier' } & SelfModifierConfig)
  | ({ kind: 'aura_modifier' } & AuraModifierConfig)
  | ({ kind: 'heal_cast' } & PassiveHealConfig)
  | ({ kind: 'cohesion' } & CohesionConfig)
  | ({ kind: 'spawner' } & SpawnerConfig);

export interface UnitDef {
  name: string;
  ico: string;
  hp: number;              // [num] raw hit points
  atk: number;             // [num] raw damage per hit (±3 random variance applied at combat time)
  spd: number;             // [num] movement speed (scaled by SPD_MULT at runtime)
  range: number;           // [px] attack range in pixels
  atkRate: number;         // [num] attacks per second (interval = 1/atkRate seconds)
  cost: number;            // [num] nectar cost to deploy
  cap?: number;            // [num] capacity weight (omit = 0; bases/tokens uncapped)
  reward: number;          // [num] nectar earned when enemy version is killed
  w: number;               // [px] sprite width in pixels
  h: number;               // [px] sprite height in pixels
  primary?: number;        // [hex] per-unit body color override (resolved from palette if omitted)
  secondary?: number;      // [hex] per-unit dark accent override (resolved from palette if omitted)
  palette?: GenePalette;   // geneline color palette (geneline units use this instead of primary/secondary)
  trait: string;
  desc: string;
  tier: TierKey;
  incubation: number;      // [sec] seconds to hatch in Larva Mound (0 = instant, for enemies)
  caste?: CasteKey;
  /** Elite "phase-2" trigger — HP fraction (0..1) at/below which the unit
   *  enrages. Drives the `in_phase_2` predicate, the HP-bar divider, and the
   *  enrage tint. Configurable per Elite; omit = no phase-2 (most units). */
  phaseThreshold?: number;
  /** Per-unit fitted attack SOUND — overrides the default-ability's `sfx` so
   *  units that share an attack (the whole herd line is on jaw_strike) can still
   *  have distinct voices. Presentation-only; omit = use the ability's recipe. */
  sfx?: SfxKey;
  /** Corpse-economy yield on death — overrides the tier default
   *  (VYSS_TIER_YIELD). Bigger vyssids are bigger tactical windfalls. */
  vyssYield?: number;
  /**
   * Carrion feeding (β Carrionling): each same-geneline ally death within
   * `radius` permanently feeds this unit `perDeath` flat atk, up to `max`
   * stacks. EVENT-driven (the death phase applies it), so it lives as a
   * UnitDef field like deathAbility — NOT in the per-frame passive band.
   */
  deathFeed?: { perDeath: number; radius: number; max: number };
  geneline: GeneLine;
  unlock?: string;
  foreswing?: number;      // [sec] wind-up time before damage lands (default: 30% of 1/atkRate)
  backswing?: number;      // [sec] cosmetic recovery after damage (default: 0.15)
  route?: Route;           // native route (default: 'land')
  attackRange?: AttackRange; // melee or ranged (default: 'melee')
  role: UnitRole;           // combat role: tank, dps, support, ranged

  /** Ability key routed through the pipeline for this unit's basic attack. */
  defaultAbility?: string;

  /** Ability key queued on death via applyDeathTriggerPhase. */
  deathAbility?: string;

  /**
   * Player-triggered signature ability (the Elite/Royal "active"). Unlike
   * `defaultAbility` (auto on attack) and `deathAbility` (auto on death),
   * this fires only when the player triggers it, gated by `sigCd`. Routed
   * through the pipeline like any other ability. Only meaningful on
   * caste 'elite'/'royal'; the trigger system ignores it otherwise.
   */
  signatureAbility?: string;
  /** Cooldown (seconds) between signature casts. Defaults to 8 in init(). */
  signatureCooldown?: number;
  /**
   * Body animation for the signature (UNIT_ANIMATION_SYSTEM.md) — a composed
   * motion primitive, e.g. `charge({ rear: 0.3, lunge: 0.6 })`. When present,
   * triggering the signature plays a windup→active→recover telegraph and the
   * ability's damage + FX fire at the windup→active boundary (the lunge peak)
   * instead of instantly. Omit → the signature fires immediately (no telegraph).
   */
  signatureAnim?: Motion;
  /** Phase durations (seconds) for the signature animation. */
  signatureAnimPhases?: { windup: number; active: number; recover: number };

  /**
   * Always-on passive behaviors (per-frame tick band). Discriminated by
   * `kind`; dispatched by the PASSIVE_HANDLERS registry each frame. See
   * `PassiveDef` for the scope fence (event-passives → pipeline phases).
   */
  passives?: PassiveDef[];

  /** Per-damage-type resistance tier. Omitted types default to 'normal'. */
  resistance?: Partial<Record<DamageType, ResistanceTier>>;
  /** Shifts target resistance DOWN by N ladder steps for this damage type. */
  penetration?: Partial<Record<DamageType, number>>;

  _key?: string;
}

// --- Combat System ---

// HitFlavor routes damage indicators (float text color / sound
// channel). NOT the same axis as DamageType (blunt/sharp/…) in
// config/combat/damageTypes.ts.
export type HitFlavor = 'melee' | 'ranged' | 'aoe' | 'poison' | 'burn' | 'heal' | 'nectar' | 'blocked' | 'base';
export type HitSoundType = 'melee' | 'ranged' | 'aoe' | 'heal';

// SfxKey — names a *fitted* synth recipe (AudioManager.playSfx), one per
// distinct attack/ability verb (a jaw bite, a spine shot, a head ram, a
// stampede shockwave). Presentation-only; the sim never reads it. The same
// recipe serves every caster — per-unit timbre is layered on at play time via
// pitch (body size), so there's no per-unit sound entry to maintain.
export type SfxKey = 'jaw' | 'gore' | 'clack' | 'needle' | 'ram' | 'stampede';

// EliteSlot — per-Elite signature-slot state the battle publishes to the HUD
// (registry `elite.slots`); one per LIVE player Elite. The HUD renders a trigger
// button per slot. UI data, computed by GameManager.getEliteSlots(); rendering
// is per-HUD (the data is shared, the look is not).
export interface EliteSlot {
  id: number;        // unit id — echoed back on click to fire THIS Elite
  key: string;       // unit key — for the portrait preview (the real procedural draw)
  name: string;
  ready: boolean;    // signature off cooldown
  cdFrac: number;    // 0..1 cooldown remaining (drives the fill bar)
  firable: boolean;  // carries a signature ability at all
  inRange: boolean;  // an enemy is in the signature's range (would connect)
}
// RoyalStatus — the player's Royal state published to the HUD (registry
// 'royal.status'), driving the Royal profile panel: alive/down, HP, respawn
// countdown, and ult (signature) readiness. Computed by GameManager.getRoyalStatus().
export interface RoyalStatus {
  present: boolean;   // a Royal exists in this run at all (else hide the panel)
  alive: boolean;
  key: string;        // unit key — for the portrait preview lookup (the real draw)
  name: string;
  hp: number;
  maxHp: number;
  hpFrac: number;     // 0..1
  respawnIn: number;  // seconds until the next lineage (0 when alive)
  id: number;         // unit id to fire the ult (-1 when down)
  sigName: string;    // ult display name (Primal Roar)
  sigReady: boolean;  // ult off cooldown
  sigCdFrac: number;  // 0..1 cooldown remaining
}

export type UnitState = 'march' | 'attack';
export type Side = 'player' | 'enemy';

// --- Pheromone Command ---
// Lane/movement commands the player paints onto the field (HIVYSS.md §8).
// Own-side units inside a zone change BEHAVIOR (movement), not stats:
//   rally   → mass toward the zone center (cohesion spikes)
//   charge  → advance forward at boosted speed (attacks AND pushes)
//   retreat → fall back (scatter to dodge incoming AOE)
//   frenzy  → α's SIGNATURE: charge movement + cohesion carriers CASH their
//             banked pack-bonus into a doubled, frozen surge (frenzy_surge)
export type PheromoneKind = 'rally' | 'charge' | 'retreat' | 'frenzy';

export interface PheromoneZone {
  kind: PheromoneKind;
  /** World-space center x of the zone. */
  x: number;
  /** Influence radius in px (1D center-x distance, side-scoped). */
  radius: number;
  /** Only own-side units obey. */
  side: Side;
  /** Lane the zone applies to (0 = upper, 1 = lower). Same-lane scoped. */
  lane: number;
  /** Seconds of life left; decremented in the caller's tick (GameManager /
   *  SandboxScene), NOT in resolve. For a trail blob this is its fade timer. */
  remaining: number;
}

// --- Royal command (MOBA-lite click control) ---
// The player's direct order to the controllable Royal (VISION §3): walk to a
// spot, or focus (chase + attack) a specific enemy. One active order at a time
// — a new click replaces the old. Only caste 'royal' carries one today; the
// field is generic so any future directly-commanded unit reuses the seam.
export type RoyalOrder =
  | { kind: 'move'; x: number }
  | { kind: 'focus'; target: IUnit };

export interface CombatContext {
  particles: IParticleManager | null;
  audio: IAudioManager | null;
  scene: Phaser.Scene;
  events: { emit(event: string, data: unknown): void };
  allAlive: IUnit[];
  S: number;
  sourceUnit: IUnit | null;
  playHitSound: (type: HitSoundType) => void;
}

// --- Rendering ---

export interface RenderUnit {
  w: number;
  h: number;
  primary: number;
  secondary: number;
  palette?: GenePalette;
  facing: number;
  bob: number;
  state: UnitState;
  atkCd: number;
  atkRate: number;
  trait: string;
  hp: number;
  maxHp: number;
  burrowed: boolean;
  // Normalized attack-swing progress — a semantic signal, NOT raw timers.
  // `windup` ramps 0→1 across the foreswing (1 = the impact frame);
  // `recover` falls 1→0 across the backswing; both 0 when idle. The
  // simulation owns the normalization (`Unit.swingProgress`); draws / FX /
  // sound apply visual easing via `getStrike` (units/renderUtils.ts).
  windup: number;
  recover: number;
  // Optional — Stormfly's draw reads resources.castCount for the
  // overcharge anticipation ring.
  resources?: Record<string, number>;
}

export type DrawFunction = (g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number) => void;

// --- Hive body rendering ---
// The hive mirrors the unit draw seam: a per-geneline body draw dispatched
// from a registry, fed a flat state payload (no entity refs — same contract
// as DrawFunction). BaseStructure owns the shared STATE CHROME (shadow, hit
// flash, shield membrane); the body draw owns GENELINE IDENTITY. The payload
// is an object (not positional args) so a later field — e.g. a maturation
// `phase` for the doc'd hive-grows-across-the-run progression — extends it
// without churning any body signature.
export interface HiveRenderState {
  side: Side;
  /** hp / maxHp — drives the damage state (cracks, ooze, ruptured cells). */
  frac: number;
  /** Hive footprint width in px (the body draws within x ∈ [0, bw]). */
  bw: number;
  /** Ground baseline in px (the body sits on it). */
  groundY: number;
}
export type HiveDrawFunction = (g: Phaser.GameObjects.Graphics, s: HiveRenderState) => void;

// --- Sprite Animation (future — type foundations only, no runtime code yet) ---

export type AnimState =
  | 'idle' | 'walk'
  | 'attack_windup' | 'attack_strike' | 'attack_recovery'
  | 'death'
  | string; // unit-specific: 'burrow', 'surface', 'rally', etc.

export type AnimTrigger =
  | 'state:march' | 'state:attack'
  | 'foreswing_start' | 'foreswing_end' | 'backswing_end'
  | 'death' | 'burrowed:true' | 'burrowed:false'
  | 'anim_complete'
  | string; // unit-specific

export interface AnimClip {
  key: string;           // Phaser animation key, e.g. 'grunt_walk'
  frameRate: number;
  repeat: number;        // -1 = loop, 0 = once
  yoyo?: boolean;
}

export interface AnimTransition {
  from: AnimState | '*';
  to: AnimState;
  on: AnimTrigger;
  priority?: number;     // higher wins when multiple triggers fire (default: 0)
}

export interface SpriteAnimDef {
  atlas: string;         // texture atlas key, e.g. 'atlas_alpha'
  prefix: string;        // frame prefix in atlas, e.g. 'grunt_'
  anchor: { x: number; y: number };
  clips: Record<AnimState, AnimClip>;
  transitions: AnimTransition[];
  defaultState: AnimState;
  flipForFacing: boolean;
}

// --- Unit Module (what each unit file exports) ---

export interface UnitModule {
  def: UnitDef;
  draw: DrawFunction;
  spriteAnim?: SpriteAnimDef; // future — when sprite sheet is available
}

// Persistent unit state — survives pool recycle (Unit.init() does
// NOT clear it). Reserved for data that must cross battle boundaries
// (Soul Graft, Imago Awakening). Default new fields to battle-scope;
// promote to persistent only when required.
export interface UnitPersistent {
  /** Death-triggered abilities grafted onto this unit by Soul Graft. */
  graftedDeathAbilities?: string[];
}

// --- IUnit interface (implemented by Unit class) ---

export interface IUnit extends WorldEntity {
  key: string;
  side: Side;
  /**
   * Battle lane (0 = upper, 1 = lower). Identity set by the spawner each
   * spawn (NOT persistent — recycled units are re-laned in init()). Units
   * only fight same-lane enemies and render at a lane-offset ground Y.
   */
  lane: number;
  geneline: GeneLine;
  hp: number;
  maxHp: number;
  atk: number;
  spd: number;
  range: number;
  atkRate: number;
  atkCd: number;
  unitW: number;
  unitH: number;
  primary: number;
  secondary: number;
  unitName: string;
  ico: string;
  reward: number;
  trait: string;
  cost: number;
  state: UnitState;
  facing: number;
  bob: number;
  dead: boolean;
  burrowed: boolean;
  knockback: number;
  dmgFlash: number;
  x: number;
  y: number;
  route: Route;
  currentRoute: Route;
  attackRange: AttackRange;

  /** Ability key routed through the pipeline for this unit's basic attack. */
  defaultAbility?: string;

  // Optional so test fixtures and future non-Unit entities (Pylons,
  // Zones, Projectiles) can satisfy the EffectBearer / ModifierBearer
  // structural contracts without having to stub these fields.
  activeEffects?: ActiveEffect[];
  modifiers?: Modifier[];
  resources?: Record<string, number>;

  /** Mendwing passive-heal cooldown accumulator (plain field, not an effect). */
  healTimer: number;
  /** Spawner-passive brood accumulator (β Broodmother). */
  spawnTimer?: number;
  /** Carrion-feed config (copied from the def); applied by the death phase. */
  deathFeed?: { perDeath: number; radius: number; max: number };

  _spawned?: boolean;
  /**
   * Death-trigger re-entry latch. Asymmetric ownership:
   *   - applyDeathTriggerPhase CHECKS then SETS (arms for every dying
   *     unit BEFORE the `!deathAbility` early-return).
   *   - _applyDeathEffectsPhase CHECKS this latch to bail on event 2+
   *     against an already-dead target (double-fire guard).
   * Resets in Unit.init() on pool recycle.
   */
  _deathTriggerFired?: boolean;
  deathAbility?: string;
  /** Caste tag (copied from the def). Combat reads it to keep `worker` units
   *  non-combatant — they advance + emit their pheromone but never attack. */
  caste?: CasteKey;
  /** Elite phase-2 HP-fraction trigger (copied from the def). Read by the
   *  `in_phase_2` predicate + the HP-bar divider + the enrage tint. */
  phaseThreshold?: number;
  /** Per-unit fitted attack sound (copied from the def); overrides the
   *  default-ability's `sfx`. */
  sfx?: SfxKey;
  /** Foe captured at foreswing-start so the hit commits to it (windup-drift fix);
   *  null/undefined = re-find nearest at impact. */
  lockedTarget?: IUnit | null;
  /** If set, this unit is a courier Scout laying a fading pheromone trail of this
   *  command as it moves (the sim drops scent-blobs in CombatSystem.resolve). */
  pheromoneKind?: PheromoneKind;
  /** x of the last trail blob dropped — the deposit-spacing tracker. */
  _lastDepositX?: number;
  /** Player's direct click-order (MOBA-lite Royal control); null = autonomous.
   *  Read by resolveRoyalOrder each frame to override target + march. */
  order?: RoyalOrder | null;
  /** Visual lane position (float) while mid lane-switch — eases toward `_laneTarget`.
   *  `lane` (the combat row) is round(_laneVisual), so it flips at the midpoint:
   *  enemies engage her by physical position during a cross. Drives the depth slide. */
  _laneVisual?: number;
  /** Destination lane of a Royal lane-switch (where `_laneVisual` is heading).
   *  Equals `lane` when settled; set by commandRoyalClick. */
  _laneTarget?: number;
  /** Player-triggered signature ability key (Elite/Royal active). */
  signatureAbility?: string;
  /** Signature cooldown length (seconds). */
  signatureCooldown: number;
  /** Live signature cooldown timer; counts down in update(). 0 = ready. */
  sigCd: number;
  /** Signature body animation (UNIT_ANIMATION_SYSTEM.md); undefined = no telegraph. */
  signatureAnim?: Motion;
  passives?: PassiveDef[];
  /**
   * Aura death-cleanup re-entry latch. Flipped to true after
   * updatePassives runs its ONE-TIME cleanup pass removing the dead
   * owner's source-tagged modifiers from every same-side ally.
   * Resets in Unit.init() on pool recycle.
   */
  _auraCleanedUp?: boolean;
  _swinging: boolean;
  passedEnemies: number;
  ambush: boolean;
  foreswing: number;
  backswing: number;
  foreswingTimer: number;
  backswingTimer: number;
  poiseAccum: number;

  // Methods
  update(dt: number): void;
  getSpeed(): number;
  march(dt: number): void;
  startAttack(): void;
  canAttack(): boolean;
  /** True when this unit has a signature ability off cooldown and is alive. */
  canSignature(): boolean;
  /** Pack-cohesion level (0..1 frac) — drives FX magnitude. Optional: not all
   *  IUnit implementers (test fixtures) carry it. */
  cohesionLevel?(): { stacks: number; frac: number };
  /** Begin the signature body animation (windup→active→recover). Optional. */
  startSignatureAnim?(): void;
  /** True the first frame the signature animation reaches the active phase
   *  (the lunge peak) — the sim fires damage + FX then. One-shot latch. */
  signatureImpactReady?(): boolean;
  takeDamage(dmg: number): void;
  heal(amount: number): number;
  getEffectiveAtk(): number;
  redraw(): void;
  kill(): void;
  destroy(): void;
}

// --- IParticleManager interface ---

export interface IParticleManager {
  burst(x: number, y: number, color: number, count: number): void;
  float(x: number, y: number, txt: string, color: number, big?: boolean): void;
  update(dt: number): void;
  destroy(): void;
}

// --- IAudioManager interface ---

export interface IAudioManager {
  muted: boolean;
  spawn(): void;
  meleeHit(): void;
  rangedShot(): void;
  aoeHit(): void;
  heal(): void;
  unitDeath(): void;
  nectarEarn(): void;
  waveStart(): void;
  abilityNuke(): void;
  abilityWall(): void;
  abilitySlow(): void;
  abilityRepair(): void;
  uiClick(): void;
  defeat(): void;
  toggleMute(): void;
  /** Fitted per-ability sound (pitch = body size, intensity = signature magnitude). */
  playSfx(key: SfxKey, opts?: { pitch?: number; intensity?: number }): void;
}

// Player Command Abilities — UI-triggered spells (nuke, wall, slow,
// repair) owned by AbilityManager. NOT the per-unit AbilityDef system.
export interface PlayerAbilityDef {
  name: string;
  icon: string;
  cost: number;
  cooldown: number;
  desc: string;
  damage?: number;
  baseDmg?: number;
  duration?: number;
  speedMult?: number;
  healAmount?: number;
}

export type PlayerAbilityKey = 'nuke' | 'wall' | 'slow' | 'repair';

// AbilityDef — reusable attack / heal / passive template that any
// unit can reference via string key. Targeting is a string reference
// into the SELECTORS registry. Tier tables are keyed by the TARGET's
// resistance tier for the ability's damage type:
//   1. effectiveTier = shiftTier(target.resistance[dmgType] ?? 'normal',
//                                -(attacker.penetration[dmgType] ?? 0))
//   2. stats = ability.tiers[effectiveTier] ?? ability.tiers.normal
//   3. finalDamage = casterBaseDamage × stats.dmgMult × targetFalloff
//                    × event.damageMultiplier

export interface AbilityTierStats {
  /** Multiplier on the caster's base damage. */
  dmgMult: number;
  /** Probability (0..1) that `appliesEffects` fires. Omit = 1. */
  effectChance?: number;
  /** Uniform ±variancePct multiplier on finalDamage. Omit = deterministic. */
  variancePct?: number;
  /** Crit chance (0..1). Omit = no crit. */
  critChance?: number;
  /** Crit multiplier. Defaults to 2.0 when critChance is set and this is omitted. */
  critMult?: number;
  /** Poise accumulation per hit for knockback.onApply. Omit = no knockback. */
  knockForce?: number;
}

export interface AbilityDef {
  name: string;
  /**
   * `damage`  → 7-phase damage queue
   * `heal`    → applyHealPhase pre_apply subscriber
   * `utility` → one-shot active with custom effects, no damage calc
   * `passive` → driven by updatePassives; never via queueAbility
   */
  category: 'damage' | 'heal' | 'utility' | 'passive';
  /** Required for `damage` category. Distinct axis from HitFlavor. */
  dmgType?: DamageType;
  /** String reference into the SELECTORS registry. */
  targeting: string;
  range?: number;
  targetCount?: number;
  /** Per-target damage scale indexed by selector output order. Missing → 1.0. */
  targetFalloff?: number[];
  /** Every-Nth-cast damage doubling via ResourceSystem castCount. */
  overchargeEvery?: number;
  /** Chain abilities: secondary-target range measured from PRIMARY, not attacker. */
  chainRange?: number;
  /** AOE effect spread — applies `effect` to up to `targetCount` enemies within `radius` of primary. */
  aoeRider?: {
    effect: string;
    radius: number;
    targetCount: number;
    excludePrimary: boolean;
  };
  /**
   * Three-state effect list:
   *   undefined → DEFAULT_EFFECTS[dmgType] (if mapped)
   *   []        → explicit opt-out
   *   [...]     → verbatim override
   */
  appliesEffects?: string[];
  tiers?: Partial<Record<ResistanceTier, AbilityTierStats>>;
  trigger?: 'onAttack' | 'onDeath' | 'passive';
  /** Heal-category payload. */
  healAmount?: number;
  /** Passive aura stat dials read by the aura handler. */
  auraMods?: Partial<Record<'atkMult' | 'dmgTakenMult', number>>;
  /** Fast-path: calculate phase uses baseDamageOverride instead of tier lookup. */
  skipsResistance?: boolean;
  /**
   * Presentation-only FX descriptor (see `app/docs/active/FX_SYSTEM.md`).
   * `undefined` → the dmgType's default FX; set to override per-ability
   * (signatures like Stampede). NEVER read by the simulation — the impact
   * dispatcher consumes it. Same 3-state convention as `appliesEffects`.
   */
  fx?: { kind: string };
  /**
   * Presentation-only IMPACT FX — played once per damage event at the hit
   * (via `dispatchImpactFx`). Kept SEPARATE from `fx` (the per-cast, caster-
   * anchored seam) so a signature that casts an `fx` never ALSO double-fires
   * it per-hit. Use this for regular-attack hit bursts (Fire Bite's flame).
   */
  impactFx?: { kind: string };
  /**
   * Presentation-only FITTED SOUND key (AudioManager.playSfx) — parallel to
   * `fx`. The impact/cast path plays it; the simulation NEVER reads it. Absent
   * → the category fallback (melee/ranged/aoe). Per-unit timbre is applied at
   * play time via pitch-by-body-size, so one key fits every caster.
   */
  sfx?: SfxKey;
  /** Death-trigger damage for `deathAbility` casts (the dispatcher's
   *  baseDamageOverride). Absent → the legacy 65 (death_bomb's tuning). */
  deathDamage?: number;
  /** Generative payload (β): the cast BIRTHS units at the caster via the
   *  spawn dispatcher — Broodlord's Spawn-Wave, Broodmother's Brood Surge. */
  spawns?: { key: string; count: number };
  /**
   * Sacrifice payload (β Swarmlord's Tide): CONSUME same-geneline soldier
   * allies within `radius` (they vanish — eaten, no corpses, no death
   * triggers) and permanently gain `perUnitAtk` flat atk per body.
   */
  sacrifice?: { radius: number; perUnitAtk: number };
}

// DamageEvent — envelope flowing through the 7-phase pipeline. Any
// phase can set `cancelled = true` to short-circuit the rest. Pending
// events (Quantum Strike, Silence Lash, Probability Well) sit in the
// queue but are skipped by resolveFrame until demoted via
// updatePendingEvents or an external trigger.

export interface DamageEvent {
  id: number;
  attacker: WorldEntity;
  target: WorldEntity;
  ability: AbilityDef;
  dmgType: DamageType;
  /** Pre-modifier damage set by the calculate phase. */
  baseDamage: number;
  /** Post-all-phases damage — what apply subtracts from HP. */
  finalDamage: number;
  /** Tier used after penetration shift. */
  effectiveTier: ResistanceTier;
  effects: string[];
  cancelled: boolean;
  isReflected: boolean;
  isRedirected: boolean;
  /** Cumulative multiplier — overcharge writes here for multi-target abilities. */
  damageMultiplier: number;

  /** Pending events are held in the queue until demoted. */
  pending?: boolean;
  pendingGroupId?: string;
  /** Seconds remaining until auto-demotion. updatePendingEvents decrements. */
  pendingCollapseAt?: number;
  pendingTriggers?: {
    onTargetDamage?: boolean;
    onTargetMove?: { from: { x: number; y: number }; threshold: number };
  };

  /** Override-path damage; bypasses the tier lookup in the calculate phase. */
  _baseDamageOverride?: number;
  /** Carried through for apply-phase FX routing. */
  _legacyHitFlavor?: HitFlavor;
  /** Selector output index for multi-target abilities (primary = 0). */
  _targetIndex?: number;
}

// --- Wave System ---

export interface WaveDef {
  units: string[];
  interval: number;
}

export interface IWaveController {
  stage: number;
  totalWaves: number;
  isComplete: boolean;
  enemyQueue: string[];
  waveTimer: number;
  waveInterval: number;
  waveIdx: number;
  getScaleFactor(): number;
  update(dt: number, particles: IParticleManager | null): void;
}

// --- AI Hive System ---

export interface HiveProfile {
  roster: string[];              // enemy unit keys (e.g. ['egrunt', 'emandible'])
  personality: AIPersonality;
  startNectar: number;
  baseIncome: number;
  maxIncome: number;
  incomeRampTime: number;        // seconds per income step
}

// --- Save System ---

export interface SaveData {
  version: number;
  colonyPoints: number;
  deck: string[];
  stats: GameStats;
  settings: GameSettings;
}

export interface GameStats {
  totalKills: number;
  totalGamesPlayed: number;
  totalWins: number;
  bestWave: number;
  bestTime: number;
  totalPlayTime: number;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

// --- Damage color map ---

export type DamageColorMap = Record<HitFlavor, number>;
