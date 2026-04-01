// Shared type definitions for Hivyss

import Phaser from 'phaser';

// --- Tier System ---

export type TierKey = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type CasteKey = 'soldier' | 'elite' | 'royal';
export type GeneLine = 'alpha';
export type Route = 'air' | 'land' | 'tunnel';
export type AttackRange = 'melee' | 'ranged';

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

export interface UnitDef {
  name: string;
  ico: string;
  hp: number;              // [num] raw hit points
  atk: number;             // [num] raw damage per hit (±3 random variance applied at combat time)
  spd: number;             // [num] movement speed (scaled by SPD_MULT at runtime)
  range: number;           // [px] attack range in pixels
  atkRate: number;         // [num] attacks per second (interval = 1/atkRate seconds)
  cost: number;            // [num] nectar cost to deploy
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
  _key?: string;           // injected at runtime by BattleScene
}

// --- Combat System ---

export type DamageType = 'melee' | 'ranged' | 'aoe' | 'poison' | 'burn' | 'heal' | 'nectar' | 'blocked' | 'base';
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
  hitUnit: (target: IUnit, dmg: number, dmgType: DamageType) => void;
  playHitSound: (type: HitSoundType) => void;
}

export interface CombatHooks {
  onSpawn?: (u: IUnit, ctx: CombatContext) => void;
  onUpdate?: (u: IUnit, dt: number, ctx: CombatContext) => boolean | void;
  onAttack?: (u: IUnit, target: IUnit, foes: IUnit[], dmg: number, ctx: CombatContext) => void;
  afterHit?: (u: IUnit, target: IUnit, dmg: number, ctx: CombatContext) => void;
  onDeath?: (u: IUnit, ctx: CombatContext) => void;
  modifyDamage?: (u: IUnit, dmg: number, ctx: CombatContext) => number;
  modifyAllyDamage?: (auraUnit: IUnit, target: IUnit, dmg: number, ctx: CombatContext) => number;
  getAtk?: (u: IUnit) => number;
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
  hitCount?: number;
  foreswingTimer: number;
  backswingTimer: number;
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
  combat?: CombatHooks;
  draw: DrawFunction;
  spriteAnim?: SpriteAnimDef; // future — when sprite sheet is available
}

// --- Status Effects ---

export interface StatusEffect {
  duration: number;
  accumulator?: number;
}

// --- IUnit interface (implemented by Unit class) ---

export interface IUnit {
  id: number;
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
  hitCount: number;
  knockback: number;
  dmgFlash: number;
  x: number;
  y: number;
  route: Route;
  currentRoute: Route;
  attackRange: AttackRange;

  // Status effect timers (backward compat — will become effect Map accessors)
  slowTimer: number;
  poisonTimer: number;
  poisonDmgAcc: number;
  burnTimer: number;
  burnDmgAcc: number;
  stunTimer: number;
  shieldAbsorbTimer: number;
  burrowTimer: number;
  summonTimer: number;
  regenTimer: number;
  healTimer: number;

  // Dynamic properties set by combat system
  _spawned?: boolean;
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
  doAttack(): number;
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

// --- Ability System ---

export interface AbilityDef {
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

export type AbilityKey = 'nuke' | 'wall' | 'slow' | 'repair';

// --- Wave System ---

export interface WaveDef {
  units: string[];
  interval: number;
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

export type DamageColorMap = Record<DamageType, number>;
