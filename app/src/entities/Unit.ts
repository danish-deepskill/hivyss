import Phaser from 'phaser';
import type { UnitDef, Side, UnitState, RenderUnit, Route, AttackRange, GenePalette, ComponentTag, UnitPersistent, SelfModifierConfig, AuraModifierConfig, PassiveHealConfig } from '../types';
import { hasActiveEffect } from '../systems/EffectSystem';
import type { DamageType } from '../config/combat/damageTypes';
import type { ResistanceTier } from '../config/combat/resistances';
import type { Modifier } from '../systems/ModifierSystem';
import type { ActiveEffect } from '../config/combat/effects/types';
import { resolveColors } from '../config/Palettes';
import { SPD_MULT } from '../config/Constants';
import { getGroundY } from '../config/RouteMatrix';
import { drawUnit } from '../units/registry';
import { UNIT_COMPONENTS } from '../systems/EntityComponents';

let _uid = 0;
function uid(): number { return ++_uid; }
export function resetUid(): void { _uid = 0; }

export class Unit extends Phaser.GameObjects.Container {
  // Identity
  id: number;
  key: string;
  side: Side;

  // Stats
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
  palette?: GenePalette;
  unitName: string;
  ico: string;
  reward: number;
  trait: string;
  cost: number;
  cap: number;
  route: Route;
  currentRoute: Route;
  attackRange: AttackRange;

  // State
  state: UnitState;
  facing: number;
  bob: number;
  knockback: number;
  dmgFlash: number;
  dead: boolean;

  // Per-unit ability/behavior fields copied from def in init().
  defaultAbility?: string;
  deathAbility?: string;
  selfModifier?: SelfModifierConfig;
  auraModifier?: AuraModifierConfig;
  passiveHeal?: PassiveHealConfig;

  // Direct properties (hot-path / rendering)
  burrowed: boolean;
  passedEnemies: number;
  ambush: boolean;
  _swinging: boolean;
  foreswing: number;
  backswing: number;
  foreswingTimer: number;
  backswingTimer: number;
  poiseAccum: number;

  // Mendwing passive-heal cooldown (plain field, not an effect).
  healTimer: number;

  components: Set<ComponentTag>;

  // Per-damage-type resistance tiers. baseResistance is the immutable
  // spawn-time copy (for revert paths); resistance is the live
  // mutable view modifiers can shift.
  baseResistance: Partial<Record<DamageType, ResistanceTier>>;
  resistance: Partial<Record<DamageType, ResistanceTier>>;

  // Battle-scope primitives — cleared by init() on pool recycle.
  activeEffects: ActiveEffect[];
  modifiers: Modifier[];
  resources: Record<string, number>;
  /** Persistent state that SURVIVES pool recycle. Do not reset in init(). */
  persistent: UnitPersistent;

  _spawned?: boolean;
  /**
   * Death-trigger re-entry latch. _applyDeathEffectsPhase CHECKS only;
   * applyDeathTriggerPhase CHECKS then SETS before the `!deathAbility`
   * early-return. Resets in init() on pool recycle.
   */
  _deathTriggerFired?: boolean;
  /** Aura death-cleanup re-entry latch. Resets in init(). */
  _auraCleanedUp?: boolean;

  // Graphics
  gfx: Phaser.GameObjects.Graphics;
  hpBar: Phaser.GameObjects.Graphics;

  /** Pool-friendly constructor. If def is provided, initializes immediately. Otherwise, call init() later. */
  constructor(scene: Phaser.Scene, def?: UnitDef, side?: Side, x?: number) {
    super(scene, 0, 0);

    // Defaults for all fields (satisfy TS — will be set properly in init())
    this.id = 0;
    this.key = '';
    this.side = 'player';
    this.hp = 0;
    this.maxHp = 0;
    this.atk = 0;
    this.spd = 0;
    this.range = 0;
    this.atkRate = 1;
    this.atkCd = 0;
    this.unitW = 0;
    this.unitH = 0;
    this.primary = 0;
    this.secondary = 0;
    this.palette = undefined;
    this.unitName = '';
    this.ico = '';
    this.reward = 0;
    this.trait = '';
    this.cost = 0;
    this.cap = 0;
    this.route = 'land';
    this.currentRoute = 'land';
    this.attackRange = 'melee';
    this.state = 'march';
    this.facing = 1;
    this.bob = 0;
    this.knockback = 0;
    this.dmgFlash = 0;
    this.dead = false;
    this.burrowed = false;
    this.passedEnemies = 0;
    this.ambush = false;
    this._swinging = false;
    this.foreswing = 0;
    this.backswing = 0;
    this.foreswingTimer = 0;
    this.backswingTimer = 0;
    this.poiseAccum = 0;
    this.healTimer = 0;
    this.components = new Set();
    this.baseResistance = {};
    this.resistance = {};

    // Phase 5 primitives — empty on first construction. init() resets
    // battle-scope (activeEffects, modifiers, resources); persistent
    // is initialized ONCE here and never cleared by init().
    this.activeEffects = [];
    this.modifiers = [];
    this.resources = {};
    this.persistent = {};

    // Graphics children — created once, reused across pool cycles
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    this.hpBar = scene.add.graphics();
    this.add(this.hpBar);

    scene.add.existing(this);

    if (def && side !== undefined && x !== undefined) {
      this.init(def, side, x);
    }
  }

  /** (Re)initialize this unit with new stats. Used by pool to recycle units. */
  init(def: UnitDef, side: Side, x: number): void {
    const isPlayer = side === 'player';
    this.id = uid();
    this.key = def._key!;
    this.side = side;

    this.hp = def.hp;
    this.maxHp = def.hp;
    this.atk = def.atk;
    this.spd = def.spd * SPD_MULT;
    this.range = def.range;
    this.atkRate = def.atkRate;
    this.atkCd = 0;
    this.unitW = def.w;
    this.unitH = def.h;
    const colors = resolveColors(def);
    this.primary = colors.primary;
    this.secondary = colors.secondary;
    this.palette = def.palette;
    this.unitName = def.name;
    this.ico = def.ico;
    this.reward = def.reward;
    this.trait = def.trait;
    this.cost = def.cost || 0;
    this.cap = def.cap ?? 0;
    this.route = def.route ?? 'land';
    this.currentRoute = this.route;
    this.attackRange = def.attackRange ?? 'melee';
    this.defaultAbility = def.defaultAbility;
    this.deathAbility = def.deathAbility;
    this.selfModifier = def.selfModifier;
    this.auraModifier = def.auraModifier;
    this.passiveHeal = def.passiveHeal;

    this.state = 'march';
    this.facing = isPlayer ? 1 : -1;
    this.bob = Math.random() * Math.PI * 2;
    this.knockback = 0;
    this.dmgFlash = 0;
    this.dead = false;

    this.burrowed = false;
    this.passedEnemies = 0;
    this.ambush = false;
    this._swinging = false;

    const interval = 1 / def.atkRate;
    this.foreswing = def.foreswing ?? interval * 0.3;
    this.backswing = def.backswing ?? 0.15;
    this.foreswingTimer = 0;
    this.backswingTimer = 0;

    this.poiseAccum = 0;
    this.healTimer = 0;

    // Battle-scope reset. `persistent` is NOT cleared.
    this.activeEffects.length = 0;
    this.modifiers.length = 0;
    for (const k in this.resources) delete this.resources[k];

    this.components.clear();
    for (const c of UNIT_COMPONENTS) this.components.add(c);

    // Resistance: refill from def; omitted damage types stay absent
    // (default 'normal' at lookup). Both copies start identical.
    for (const k in this.baseResistance) delete (this.baseResistance as Record<string, unknown>)[k];
    for (const k in this.resistance) delete (this.resistance as Record<string, unknown>)[k];
    if (def.resistance) {
      for (const k of Object.keys(def.resistance) as DamageType[]) {
        const tier = def.resistance[k];
        if (tier !== undefined) {
          this.baseResistance[k] = tier;
          this.resistance[k] = tier;
        }
      }
    }

    // Reset scratch latches so pool-recycled units don't inherit
    // previous-life state.
    this._spawned = undefined;
    this._deathTriggerFired = false;
    this._auraCleanedUp = false;

    this.setPosition(Math.round(x), Math.round(getGroundY(this.currentRoute) - def.h));
    this.setActive(true);
    this.setVisible(true);
    this.gfx.clear();
    this.hpBar.clear();
    this.redraw();
  }

  /** Deactivate and hide — returns to pool, does NOT destroy. */
  deactivate(): void {
    this.dead = true;
    this.setActive(false);
    this.setVisible(false);
    this.gfx.clear();
    this.hpBar.clear();
  }

  // --- Collision bounds ---

  get worldLeft(): number { return this.x; }
  get worldRight(): number { return this.x + this.unitW; }

  // --- Core methods ---

  update(dt: number): void {
    if (this.dead) return;

    // Tick all effect timers
    if (this.dmgFlash > 0) this.dmgFlash = Math.max(0, this.dmgFlash - dt * 4);
    if (this.atkCd > 0) this.atkCd = Math.max(0, this.atkCd - dt);
    if (this.foreswingTimer > 0) this.foreswingTimer = Math.max(0, this.foreswingTimer - dt);
    if (this.backswingTimer > 0) this.backswingTimer = Math.max(0, this.backswingTimer - dt);
    if (this.poiseAccum > 0) this.poiseAccum = Math.max(0, this.poiseAccum - 10 * dt); // recover 10/s out of 100

    // ActiveEffect durations tick via CombatSystem.resolve's
    // updateEffects call (once per combat frame, not per Unit).

    // Bob animation
    this.bob += dt * (this.state === 'march' ? 10 : 3);

    // Redraw each frame (procedural art)
    this.redraw();
  }

  getSpeed(): number {
    return hasActiveEffect(this, 'slow') ? this.spd * 0.45 : this.spd;
  }

  march(dt: number): void {
    this.state = 'march';
    const spd = this.getSpeed();
    this.x += this.facing * spd * 60 * dt;
  }

  startAttack(): void {
    this.state = 'attack';
  }

  canAttack(): boolean {
    return this.atkCd <= 0;
  }

  takeDamage(dmg: number): void {
    if (this.dead) return;
    this.hp -= dmg;
    this.dmgFlash = 0.6;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }

  heal(amount: number): number {
    const actual = Math.min(this.maxHp - this.hp, amount);
    this.hp += actual;
    return actual;
  }

  getEffectiveAtk(): number {
    return this.atk;
  }

  redraw(): void {
    const g = this.gfx;
    g.clear();

    const bob = this.state === 'march' ? Math.sin(this.bob) * 1.8 : Math.sin(this.bob * 0.5) * 0.5;
    const uy = bob;

    // Slow tint
    const slowed = hasActiveEffect(this, 'slow');
    let primary = this.primary;
    if (slowed) {
      const a = primary;
      const b = 0x80c8ff;
      const t = 0.4;
      const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab2 = a & 0xff;
      const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
      primary = (((ar + t * (br - ar)) | 0) << 16) | (((ag + t * (bg - ag)) | 0) << 8) | ((ab2 + t * (bb - ab2)) | 0);
    }

    // Shadow (skip for tunnel units — they're underground)
    if (this.currentRoute !== 'tunnel') {
      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(this.unitW / 2, getGroundY('land') - this.y + 1, this.unitW / 2 + 2, 3);
    }

    if (slowed) g.setAlpha(0.85);

    // Draw the ant body using the renderer
    const renderUnit: RenderUnit = {
      w: this.unitW, h: this.unitH,
      primary: primary, secondary: this.secondary, palette: this.palette,
      facing: this.facing, bob: this.bob,
      state: this.state, atkCd: this.atkCd, atkRate: this.atkRate,
      trait: this.trait, hp: this.hp, maxHp: this.maxHp,
      burrowed: this.burrowed,
      foreswingTimer: this.foreswingTimer,
      backswingTimer: this.backswingTimer,
    };
    drawUnit(g, renderUnit, this.unitW / 2, uy);

    // Damage flash overlay
    if (this.dmgFlash > 0) {
      g.fillStyle(0xffffff, this.dmgFlash * 0.5);
      g.fillEllipse(this.unitW / 2, uy + this.unitH * 0.5, this.unitW * 0.5, this.unitH * 0.5);
    }

    // Slow indicator
    if (slowed) {
      g.fillStyle(0x80c8ff, 0.3);
      g.fillCircle(this.unitW / 2, uy + this.unitH / 2, this.unitW * 0.55);
    }

    g.setAlpha(1);

    // HP bar
    this.hpBar.clear();
    const bw = this.unitW + 8;
    const hpFrac = this.hp / this.maxHp;
    this.hpBar.fillStyle(0x111111);
    this.hpBar.fillRect(-4, uy - 10, bw, 4);
    const hpColor = hpFrac > 0.5 ? 0x40cc40 : hpFrac > 0.25 ? 0xcccc30 : 0xcc3030;
    this.hpBar.fillStyle(hpColor);
    this.hpBar.fillRect(-4, uy - 10, bw * Math.max(0, hpFrac), 4);
  }

  kill(): void {
    this.deactivate();
  }
}
