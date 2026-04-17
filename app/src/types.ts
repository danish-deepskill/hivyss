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

export type TierKey = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type CasteKey = 'soldier' | 'elite' | 'royal';
export type GeneLine = 'alpha';
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
  geneline?: GeneLine;
  unlock?: string;
  foreswing?: number;      // [sec] wind-up time before damage lands (default: 30% of 1/atkRate)
  backswing?: number;      // [sec] cosmetic recovery after damage (default: 0.15)
  knockForce?: number;     // [poise] fills target's poise meter per hit, 100 = instant stagger vs 0 resist (default: 0)
  knockResist?: number;    // [poise] subtracted from incoming knockForce (default: 0)
  route?: Route;           // native route (default: 'land')
  attackRange?: AttackRange; // melee or ranged (default: 'melee')
  role: UnitRole;           // combat role: tank, dps, support, ranged

  /** Ability key routed through the pipeline for this unit's basic attack. */
  defaultAbility?: string;

  /** Ability key queued on death via applyDeathTriggerPhase. */
  deathAbility?: string;

  /** Self-modifier applied/removed by updatePassives based on a named predicate. */
  selfModifier?: SelfModifierConfig;

  /** Continuously-active aura applied to in-range same-side allies. */
  auraModifier?: AuraModifierConfig;

  /** Cooldown-gated passive heal cast. */
  passiveHeal?: PassiveHealConfig;

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
export type UnitState = 'march' | 'attack';
export type Side = 'player' | 'enemy';

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
  foreswingTimer: number;
  backswingTimer: number;
  // Optional — Stormfly's draw reads resources.castCount for the
  // overcharge anticipation ring.
  resources?: Record<string, number>;
}

export type DrawFunction = (g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number) => void;

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
  selfModifier?: SelfModifierConfig;
  auraModifier?: AuraModifierConfig;
  passiveHeal?: PassiveHealConfig;
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
  knockForce: number;
  knockResist: number;

  // Methods
  update(dt: number): void;
  getSpeed(): number;
  march(dt: number): void;
  startAttack(): void;
  canAttack(): boolean;
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
