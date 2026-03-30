import Phaser from 'phaser';
import type { UnitDef, Side, UnitState, StatusEffect, RenderUnit } from '../types';
import { GND, S, SPD_MULT } from '../config/Constants';
import { drawUnit } from '../units/registry';

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
  col: number;
  dk: number;
  unitName: string;
  ico: string;
  reward: number;
  trait: string;
  cost: number;

  // State
  state: UnitState;
  facing: number;
  bob: number;
  knockback: number;
  dmgFlash: number;
  dead: boolean;

  // Direct properties (hot-path / rendering)
  burrowed: boolean;
  hitCount: number;
  passedEnemies: number;
  ambush: boolean;
  _swinging: boolean;
  foreswing: number;
  backswing: number;
  foreswingTimer: number;
  backswingTimer: number;
  poiseAccum: number;
  knockForce: number;
  knockResist: number;

  // Effect system
  effects: Map<string, StatusEffect>;

  // Dynamic properties set by combat system
  _spawned?: boolean;

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
    this.col = 0;
    this.dk = 0;
    this.unitName = '';
    this.ico = '';
    this.reward = 0;
    this.trait = '';
    this.cost = 0;
    this.state = 'march';
    this.facing = 1;
    this.bob = 0;
    this.knockback = 0;
    this.dmgFlash = 0;
    this.dead = false;
    this.burrowed = false;
    this.hitCount = 0;
    this.passedEnemies = 0;
    this.ambush = false;
    this._swinging = false;
    this.foreswing = 0;
    this.backswing = 0;
    this.foreswingTimer = 0;
    this.backswingTimer = 0;
    this.poiseAccum = 0;
    this.knockForce = 0;
    this.knockResist = 0;
    this.effects = new Map();

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
    const scaledW = Math.round(def.w * S);
    const scaledH = Math.round(def.h * S);

    this.id = uid();
    this.key = def._key!;
    this.side = side;

    this.hp = def.hp;
    this.maxHp = def.hp;
    this.atk = def.atk;
    this.spd = def.spd * S * SPD_MULT;
    this.range = def.range * S;
    this.atkRate = def.atkRate;
    this.atkCd = 0;
    this.unitW = scaledW;
    this.unitH = scaledH;
    this.col = def.col;
    this.dk = def.dk;
    this.unitName = def.name;
    this.ico = def.ico;
    this.reward = def.reward;
    this.trait = def.trait;
    this.cost = def.cost || 0;

    this.state = 'march';
    this.facing = isPlayer ? 1 : -1;
    this.bob = Math.random() * Math.PI * 2;
    this.knockback = 0;
    this.dmgFlash = 0;
    this.dead = false;

    this.burrowed = false;
    this.hitCount = 0;
    this.passedEnemies = 0;
    this.ambush = false;
    this._swinging = false;

    const interval = 1 / def.atkRate;
    this.foreswing = def.foreswing ?? interval * 0.3;
    this.backswing = def.backswing ?? 0.15;
    this.foreswingTimer = 0;
    this.backswingTimer = 0;

    this.poiseAccum = 0;
    this.knockForce = def.knockForce ?? 0;
    this.knockResist = def.knockResist ?? 0;

    this.effects.clear();
    this._spawned = undefined;

    this.setPosition(Math.round(x), Math.round(GND - scaledH));
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

  // --- Effect system helpers ---

  setEffect(type: string, duration: number, accumulator?: number): void {
    const existing = this.effects.get(type);
    if (existing) {
      existing.duration = duration;
      if (accumulator !== undefined) existing.accumulator = accumulator;
    } else {
      this.effects.set(type, { duration, accumulator: accumulator ?? 0 });
    }
  }

  getEffect(type: string): StatusEffect | undefined {
    return this.effects.get(type);
  }

  hasEffect(type: string): boolean {
    const e = this.effects.get(type);
    return e !== undefined && e.duration > 0;
  }

  // --- Backward-compat accessors (used by combat hooks and CombatSystem) ---
  // These will be removed in Step 13 cleanup

  get slowTimer(): number { return this.effects.get('slow')?.duration ?? 0; }
  set slowTimer(v: number) { this.setEffect('slow', v); }

  get poisonTimer(): number { return this.effects.get('poison')?.duration ?? 0; }
  set poisonTimer(v: number) { this.setEffect('poison', v); }

  get poisonDmgAcc(): number { return this.effects.get('poison')?.accumulator ?? 0; }
  set poisonDmgAcc(v: number) {
    const e = this.effects.get('poison');
    if (e) e.accumulator = v;
    else this.effects.set('poison', { duration: 0, accumulator: v });
  }

  get burnTimer(): number { return this.effects.get('burn')?.duration ?? 0; }
  set burnTimer(v: number) { this.setEffect('burn', v); }

  get burnDmgAcc(): number { return this.effects.get('burn')?.accumulator ?? 0; }
  set burnDmgAcc(v: number) {
    const e = this.effects.get('burn');
    if (e) e.accumulator = v;
    else this.effects.set('burn', { duration: 0, accumulator: v });
  }

  get stunTimer(): number { return this.effects.get('stun')?.duration ?? 0; }
  set stunTimer(v: number) { this.setEffect('stun', v); }

  get shieldAbsorbTimer(): number { return this.effects.get('shieldAbsorb')?.duration ?? 0; }
  set shieldAbsorbTimer(v: number) { this.setEffect('shieldAbsorb', v); }

  get burrowTimer(): number { return this.effects.get('burrow')?.duration ?? 0; }
  set burrowTimer(v: number) { this.setEffect('burrow', v); }

  get summonTimer(): number { return this.effects.get('summon')?.duration ?? 0; }
  set summonTimer(v: number) { this.setEffect('summon', v); }

  get regenTimer(): number { return this.effects.get('regen')?.duration ?? 0; }
  set regenTimer(v: number) { this.setEffect('regen', v); }

  get healTimer(): number { return this.effects.get('heal')?.duration ?? 0; }
  set healTimer(v: number) { this.setEffect('heal', v); }

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

    // Tick effects map (decrement durations)
    for (const [_key, effect] of this.effects) {
      if (effect.duration > 0) {
        effect.duration = Math.max(0, effect.duration - dt);
      }
    }

    // Bob animation
    this.bob += dt * (this.state === 'march' ? 10 : 3);

    // Redraw each frame (procedural art)
    this.redraw();
  }

  getSpeed(): number {
    return this.slowTimer > 0 ? this.spd * 0.45 : this.spd;
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

  doAttack(): number {
    this.atkCd = 1 / this.atkRate;
    return Math.max(1, this.atk + ((Math.random() * 6) | 0) - 3);
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
    let col = this.col;
    if (this.slowTimer > 0) {
      const a = col;
      const b = 0x80c8ff;
      const t = 0.4;
      const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab2 = a & 0xff;
      const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
      col = (((ar + t * (br - ar)) | 0) << 16) | (((ag + t * (bg - ag)) | 0) << 8) | ((ab2 + t * (bb - ab2)) | 0);
    }

    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(this.unitW / 2, GND - this.y + 1, this.unitW / 2 + 2, 3);

    if (this.slowTimer > 0) g.setAlpha(0.85);

    // Draw the ant body using the renderer
    const renderUnit: RenderUnit = {
      w: this.unitW, h: this.unitH,
      col: col, dk: this.dk,
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
    if (this.slowTimer > 0) {
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
