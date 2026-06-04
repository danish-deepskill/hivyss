import Phaser from 'phaser';
import type { UnitDef, Side, UnitState, RenderUnit, Route, AttackRange, GenePalette, ComponentTag, UnitPersistent, PassiveDef, GeneLine, CasteKey, SfxKey, IUnit } from '../types';
import { hasActiveEffect } from '../systems/EffectSystem';
import type { DamageType } from '../config/combat/damageTypes';
import type { ResistanceTier } from '../config/combat/resistances';
import type { Modifier } from '../systems/ModifierSystem';
import type { ActiveEffect } from '../config/combat/effects/types';
import { resolveColors } from '../config/Palettes';
import { SPD_MULT } from '../config/Constants';
import { getGroundY, laneDepth } from '../config/RouteMatrix';
import { drawUnit } from '../units/registry';
import { NEUTRAL, type Motion, type MotionTransform, type AnimPhase } from '../units/motions';
import { UNIT_COMPONENTS } from '../systems/EntityComponents';

let _uid = 0;
function uid(): number { return ++_uid; }
export function resetUid(): void { _uid = 0; }

// --- Pack-cohesion aura (presentation knobs) ---
// A warm halo beneath a cohered unit that intensifies as its herd packs
// tight. Generic + data-driven: drawn for ANY unit carrying a `cohesion`
// passive, tinted by the unit's own primary colour (α Primal = red heat).
// When a pack masses, the overlapping halos read as one blazing cluster —
// the felt "the herd is powered up" signal. Tune freely; presentation-only,
// never read by the simulation.
const COHESION_GLOW_ALPHA = 0.42; // peak inner-glow opacity at frac = 1
const COHESION_GLOW_GROW = 0.7;   // halo radius growth across frac 0→1
const COHESION_GLOW_PULSE = 0.18; // ± breathing amplitude (keeps it alive)

export class Unit extends Phaser.GameObjects.Container {
  // Identity
  id: number;
  key: string;
  side: Side;
  /**
   * Battle lane (0 = upper, 1 = lower). Identity set by the spawner each
   * spawn via init(); units only fight same-lane enemies and render at a
   * lane-offset ground Y. NOT persistent — re-laned on pool recycle.
   */
  lane: number;
  geneline: GeneLine;

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
  passives?: PassiveDef[];

  // Player-triggered signature ability (Elite/Royal active) + its cooldown.
  signatureAbility?: string;
  caste?: CasteKey;
  phaseThreshold?: number;
  sfx?: SfxKey;
  signatureCooldown: number;
  sigCd: number;

  // Signature body animation (UNIT_ANIMATION_SYSTEM.md). sigAnimTimer counts
  // down across windup→active→recover; the impact (damage + FX) fires once at
  // the windup→active boundary via signatureImpactReady().
  signatureAnim?: Motion;
  sigAnimTimer: number;
  sigAnimWindup: number;
  sigAnimActive: number;
  sigAnimTotal: number;
  private _sigImpactFired: boolean;

  // Direct properties (hot-path / rendering)
  burrowed: boolean;
  passedEnemies: number;
  ambush: boolean;
  _swinging: boolean;
  /** Target captured when the foreswing STARTS, so the hit commits to it: the
   *  impact lands on this foe even if a closer one drifts in during windup (as
   *  long as it's still a valid foe). null = re-find nearest at impact (bases,
   *  or the locked foe died/left → graceful fallback). */
  lockedTarget: IUnit | null;
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
  constructor(scene: Phaser.Scene, def?: UnitDef, side?: Side, x?: number, lane = 0) {
    super(scene, 0, 0);

    // Defaults for all fields (satisfy TS — will be set properly in init())
    this.id = 0;
    this.key = '';
    this.side = 'player';
    this.lane = 0;
    this.geneline = 'normal';
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
    this.lockedTarget = null;
    this.foreswing = 0;
    this.backswing = 0;
    this.foreswingTimer = 0;
    this.backswingTimer = 0;
    this.poiseAccum = 0;
    this.healTimer = 0;
    this.caste = undefined;
    this.phaseThreshold = undefined;
    this.sfx = undefined;
    this.signatureAbility = undefined;
    this.signatureCooldown = 0;
    this.sigCd = 0;
    this.signatureAnim = undefined;
    this.sigAnimTimer = 0;
    this.sigAnimWindup = 0;
    this.sigAnimActive = 0;
    this.sigAnimTotal = 0;
    this._sigImpactFired = false;
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
      this.init(def, side, x, lane);
    }
  }

  /** (Re)initialize this unit with new stats. Used by pool to recycle units. */
  init(def: UnitDef, side: Side, x: number, lane = 0): void {
    const isPlayer = side === 'player';
    this.id = uid();
    this.key = def._key!;
    this.side = side;
    this.lane = lane;
    this.geneline = def.geneline;

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
    this.caste = def.caste;
    this.phaseThreshold = def.phaseThreshold;
    this.sfx = def.sfx;
    this.signatureAbility = def.signatureAbility;
    this.signatureCooldown = def.signatureCooldown ?? 8;
    this.sigCd = 0;
    this.signatureAnim = def.signatureAnim;
    const ph = def.signatureAnimPhases;
    this.sigAnimWindup = ph?.windup ?? 0;
    this.sigAnimActive = ph?.active ?? 0;
    this.sigAnimTotal = ph ? ph.windup + ph.active + ph.recover : 0;
    this.sigAnimTimer = 0;
    this._sigImpactFired = false;
    this.passives = def.passives;

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
    this.lockedTarget = null;

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

    // Lane depth — the far (North) lane draws smaller + dimmer. Scale is
    // presentation-only (combat reads logical x / unitW). Re-anchor Y by
    // the SCALED height so the scaled feet still rest on the ground line.
    const depth = laneDepth(this.lane);
    this.setScale(depth.scale);
    this.setAlpha(depth.alpha);
    this.setPosition(Math.round(x), Math.round(getGroundY(this.currentRoute, this.lane) - def.h * depth.scale));
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
    if (this.sigCd > 0) this.sigCd = Math.max(0, this.sigCd - dt);
    if (this.sigAnimTimer > 0) this.sigAnimTimer = Math.max(0, this.sigAnimTimer - dt);
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

  /**
   * Player-triggered signature gate (Elite/Royal active). True when the
   * unit carries a signatureAbility, its cooldown has elapsed, and it's
   * alive. The trigger system (CombatSystem.requestSignatures) checks this
   * before queueing the ability and resetting `sigCd`.
   */
  canSignature(): boolean {
    return !this.dead && !!this.signatureAbility && this.sigCd <= 0;
  }

  /** Begin the signature body animation (windup→active→recover). */
  startSignatureAnim(): void {
    if (this.sigAnimTotal <= 0) return;
    this.sigAnimTimer = this.sigAnimTotal;
    this._sigImpactFired = false;
  }

  /**
   * True exactly once — the first frame the signature animation reaches the
   * active phase (the lunge peak). The sim fires the signature's damage + FX
   * then, so the hit lands *with* the lunge, not at the trigger. Latched.
   */
  signatureImpactReady(): boolean {
    if (this._sigImpactFired || this.sigAnimTimer <= 0) return false;
    const elapsed = this.sigAnimTotal - this.sigAnimTimer;
    if (elapsed >= this.sigAnimWindup) {
      this._sigImpactFired = true;
      return true;
    }
    return false;
  }

  /**
   * The current signature-animation body transform (NEUTRAL when none is
   * playing) — evaluates the unit's composed motion at the live phase. The
   * presentation layer (redraw) applies it; the sim never reads it.
   */
  currentMotion(): MotionTransform {
    if (this.sigAnimTimer <= 0 || !this.signatureAnim) return NEUTRAL;
    const elapsed = this.sigAnimTotal - this.sigAnimTimer;
    let phase: AnimPhase;
    let phaseT: number;
    if (elapsed < this.sigAnimWindup) {
      phase = 'windup';
      phaseT = this.sigAnimWindup > 0 ? elapsed / this.sigAnimWindup : 1;
    } else if (elapsed < this.sigAnimWindup + this.sigAnimActive) {
      phase = 'active';
      phaseT = this.sigAnimActive > 0 ? (elapsed - this.sigAnimWindup) / this.sigAnimActive : 1;
    } else {
      const recDur = this.sigAnimTotal - this.sigAnimWindup - this.sigAnimActive;
      phase = 'recover';
      phaseT = recDur > 0 ? (elapsed - this.sigAnimWindup - this.sigAnimActive) / recDur : 1;
    }
    const t = this.sigAnimTotal > 0 ? elapsed / this.sigAnimTotal : 1;
    return this.signatureAnim({ t, phase, phaseT });
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

  /**
   * Normalized attack-swing progress for the presentation layer — a
   * semantic signal, NOT raw timers. `windup` ramps 0→1 across the
   * foreswing (1 = the impact frame); `recover` falls 1→0 across the
   * backswing; both 0 when idle. The simulation owns this normalization;
   * draws / FX / sound consume it (via `getStrike`) and never see the
   * raw timers or durations. Recovery wins if the two ever overlap.
   */
  swingProgress(): { windup: number; recover: number } {
    if (this.backswingTimer > 0) {
      const bs = this.backswing > 1e-4 ? this.backswing : 1e-4;
      const r = this.backswingTimer / bs;
      return { windup: 0, recover: r < 0 ? 0 : r > 1 ? 1 : r };
    }
    if (this.foreswingTimer > 0) {
      const fs = this.foreswing > 1e-4 ? this.foreswing : 1e-4;
      const w = 1 - this.foreswingTimer / fs;
      return { windup: w < 0 ? 0 : w > 1 ? 1 : w, recover: 0 };
    }
    return { windup: 0, recover: 0 };
  }

  /**
   * Pack-cohesion intensity for the presentation layer — a semantic signal,
   * NOT raw modifier internals (mirrors `swingProgress`). Reads the live
   * cohesion modifier the sim re-writes each frame (source
   * `cohesion:<id>:<stat>`) and normalizes it against this unit's own
   * cohesion `PassiveDef`. `stacks` = effective packed-ally count
   * (0..maxAllies); `frac` = stacks/maxAllies (0..1). Both 0 when the unit
   * carries no cohesion passive or stands alone. The sim owns the count;
   * draws/FX consume `frac` and never touch modifiers or radii.
   */
  cohesionLevel(): { stacks: number; frac: number } {
    const p = this.passives?.find((x) => x.kind === 'cohesion');
    if (!p || p.kind !== 'cohesion' || p.perAlly <= 0) return { stacks: 0, frac: 0 };
    const mod = this.modifiers.find((m) => m.source === `cohesion:${this.id}:${p.stat}`);
    if (!mod) return { stacks: 0, frac: 0 };
    const stacks = mod.value / p.perAlly;
    return { stacks, frac: p.maxAllies > 0 ? Math.min(1, stacks / p.maxAllies) : 0 };
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

    // Shadow (skip for tunnel units — they're underground). Divide the
    // ground distance by scaleY so the shadow lands ON the ground line
    // even when the container is depth-scaled (else it sits at scale²).
    if (this.currentRoute !== 'tunnel') {
      const groundLocalY = (getGroundY('land', this.lane) - this.y) / (this.scaleY || 1);
      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(this.unitW / 2, groundLocalY + 1, this.unitW / 2 + 2, 3);
    }

    // Pack-cohesion aura — the herd visibly "heats up" as it packs tight.
    // Two stacked ellipses (soft outer + brighter inner) tinted by the
    // unit's own colour; radius + opacity scale with cohesion frac plus a
    // gentle breathing pulse. Drawn behind the body so massed packs read as
    // one glowing cluster. Data-driven: any cohesion carrier lights up.
    const coh = this.cohesionLevel();
    if (coh.frac > 0) {
      const pulse = 1 + COHESION_GLOW_PULSE * Math.sin(this.bob * 1.5);
      const peak = COHESION_GLOW_ALPHA * coh.frac * pulse;
      const gx = this.unitW / 2;
      const gyA = uy + this.unitH * 0.5;
      const rw = this.unitW * (1.1 + COHESION_GLOW_GROW * coh.frac);
      const rh = rw * 0.55;
      g.fillStyle(this.primary, peak * 0.45);
      g.fillEllipse(gx, gyA, rw, rh);
      g.fillStyle(this.primary, peak);
      g.fillEllipse(gx, gyA, rw * 0.62, rh * 0.62);
    }

    // Phase-2 (Elite enrage) — once HP crosses the unit's phaseThreshold the
    // unit turns RED, so "it just got dangerous" reads instantly. Crucially this
    // is a BODY treatment, NOT a ground aura: an UPRIGHT halo enveloping the
    // silhouette (taller than wide), the opposite orientation of cohesion's wide,
    // flat ground pool — so the two never blur, even though α's own colour is red.
    // The body sheen below (drawn over the silhouette) and the fast throb finish
    // the read. Used again by the HP bar.
    const inPhase2 = this.phaseThreshold != null && this.hp / this.maxHp <= this.phaseThreshold;
    if (inPhase2) {
      const ep = 0.55 + 0.45 * Math.abs(Math.sin(this.bob * 3));
      const cx = this.unitW / 2;
      const cy = uy + this.unitH * 0.42;
      g.fillStyle(0xff2010, 0.22 * ep);
      g.fillEllipse(cx, cy, this.unitW * 0.95, this.unitH * 1.45);
      g.fillStyle(0xff5030, 0.3 * ep);
      g.fillEllipse(cx, cy, this.unitW * 0.55, this.unitH * 0.9);
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
      ...this.swingProgress(),
    };
    // Signature body motion (rear/lunge/squash/lean) — offsets + transforms the
    // BODY only (shadow + glow stay put on the ground). NEUTRAL when idle, so
    // this is a no-op for the 99% of frames with no signature playing.
    const m = this.currentMotion();
    const bodyCx = this.unitW / 2 + this.facing * m.dx * this.unitW;
    const bodyUy = uy + m.dy * this.unitH;
    const transformed = m.lean !== 0 || m.squash !== 1;
    if (transformed) {
      const pivotX = this.unitW / 2;
      const pivotY = uy + this.unitH; // pivot at the feet
      g.save();
      g.translateCanvas(pivotX, pivotY);
      g.rotateCanvas(this.facing * m.lean);
      g.scaleCanvas(1, m.squash);
      g.translateCanvas(-pivotX, -pivotY);
    }
    drawUnit(g, renderUnit, bodyCx, bodyUy);
    if (transformed) g.restore();

    // Damage flash overlay
    if (this.dmgFlash > 0) {
      g.fillStyle(0xffffff, this.dmgFlash * 0.5);
      g.fillEllipse(this.unitW / 2, uy + this.unitH * 0.5, this.unitW * 0.5, this.unitH * 0.5);
    }

    // Enrage body sheen — the silhouette itself runs red-hot (drawn OVER the body,
    // so the enraged elite glows from within, not from the floor). Same fast throb
    // as the halo behind it.
    if (inPhase2) {
      const ep = 0.5 + 0.5 * Math.abs(Math.sin(this.bob * 3));
      g.fillStyle(0xff3018, 0.3 * ep);
      g.fillEllipse(this.unitW / 2, uy + this.unitH * 0.5, this.unitW * 0.6, this.unitH * 0.62);
    }

    // Slow indicator
    if (slowed) {
      g.fillStyle(0x80c8ff, 0.3);
      g.fillCircle(this.unitW / 2, uy + this.unitH / 2, this.unitW * 0.55);
    }

    g.setAlpha(1);

    // HP bar — drawn on the dedicated top-layer graphics (added after gfx, so it
    // sits ABOVE the body + effects and stays legible). Elites/Royals get a
    // "premium" bar with a vertical divider at their phase-2 threshold (telegraphs
    // the enrage point + turns red once crossed); soldiers get a clean thin bar,
    // so a richer bar reads as "this one matters".
    this.hpBar.clear();
    const hpFrac = Math.max(0, Math.min(1, this.hp / this.maxHp));
    if (this.caste === 'elite' || this.caste === 'royal') {
      const bw = this.unitW * 1.1;
      const bh = 3;
      const bx = (this.unitW - bw) / 2;
      const by = uy - 9;
      this.hpBar.fillStyle(0x000000, 0.6);
      this.hpBar.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      this.hpBar.fillStyle(inPhase2 ? 0xff3020 : hpFrac > 0.5 ? 0x40d040 : 0xf0c040, 1);
      this.hpBar.fillRect(bx, by, bw * hpFrac, bh);
      if (this.phaseThreshold != null) {
        const dx = bx + bw * this.phaseThreshold;
        this.hpBar.fillStyle(0xffffff, 0.9);
        this.hpBar.fillRect(dx - 0.5, by - 1, 1, bh + 2);
      }
    } else {
      const bw = this.unitW + 8;
      this.hpBar.fillStyle(0x111111);
      this.hpBar.fillRect(-4, uy - 10, bw, 4);
      const hpColor = hpFrac > 0.5 ? 0x40cc40 : hpFrac > 0.25 ? 0xcccc30 : 0xcc3030;
      this.hpBar.fillStyle(hpColor);
      this.hpBar.fillRect(-4, uy - 10, bw * hpFrac, 4);
    }
  }

  kill(): void {
    this.deactivate();
  }
}
