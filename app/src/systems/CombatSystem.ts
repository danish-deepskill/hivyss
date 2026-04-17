import Phaser from 'phaser';
import type { HitFlavor, DamageColorMap, CombatContext, IUnit, IParticleManager, DamageEvent, HitSoundType } from '../types';
import { DEFAULT_WORLD_W, SBW } from '../config/Constants';
import { LANE } from '../config/Layout';
import { canAttack } from '../config/RouteMatrix';
const GND = LANE.land.groundY;
import { BaseStructure } from '../entities/BaseStructure';
import { BaseEntity } from '../entities/BaseEntity';
import { AudioManager } from './AudioManager';
import { EventBus } from './EventBus';
import { CombatPipeline } from './CombatPipeline';
import { updateEffects, applyEffect, hasActiveEffect } from './EffectSystem';
import { setDotDispatcher } from '../config/combat/effects/dispatch';
import { setStunFxDispatcher, setStaggerFxDispatcher } from '../config/combat/effects/cc';
import { applyModifiers, addModifier, removeModifiersBySource } from './ModifierSystem';
import { getResource, addResource } from './ResourceSystem';
import { lookupPredicate } from './PassivePredicates';
import { runSelectorInRange } from './Targeting';
import { lookupAbility } from '../config/combat/abilities';

/**
 * Variance + crit modify-phase subscriber. Deterministic by default;
 * opt-in per ability via `AbilityTierStats.variancePct` /
 * `.critChance` / `.critMult`. Read order: variance first, then crit;
 * both compound multiplicatively. Rounds + floors at 1 so downstream
 * subscribers see an integer.
 *
 * The `!stats` guard turns override events (DOT dispatcher, death_bomb)
 * into pass-throughs — they have no tier table to read.
 */
export function applyVarianceAndCritModify(event: DamageEvent): void {
  if (event.cancelled) return;
  const stats = event.ability.tiers?.[event.effectiveTier] ?? event.ability.tiers?.normal;
  if (!stats) return;

  if (stats.variancePct) {
    const roll = (Math.random() * 2 - 1) * stats.variancePct;
    event.finalDamage *= (1 + roll);
  }

  if (stats.critChance && Math.random() < stats.critChance) {
    event.finalDamage *= (stats.critMult ?? 2.0);
    (event as unknown as { _crit?: boolean })._crit = true;
  }

  event.finalDamage = Math.max(1, Math.round(event.finalDamage));
}

/**
 * Aura damage modify-phase subscriber. Reads the target's `dmg_taken`
 * modifier stack and folds the result into `event.finalDamage`.
 * Registered AFTER variance/crit — defender-side reduction scales
 * whatever damage the caster-side RNG rolled, crit included.
 */
export function applyAuraDamageModify(event: DamageEvent): void {
  if (event.cancelled) return;
  const modified = applyModifiers(event.target, event.finalDamage, 'dmg_taken');
  event.finalDamage = Math.round(modified);
}

/**
 * Terminal modify-phase clamp — every successful hit deals ≥ 1.
 * SINGLE clamping site; do NOT distribute Math.max(1, ...) across
 * subscribers. Registered LAST: no subscriber may come after it, or
 * the invariant unravels. Pinned by phase8.test.ts modify-order pin.
 */
export function applyFinalDamageFloor(event: DamageEvent): void {
  if (event.cancelled) return;
  event.finalDamage = Math.max(1, event.finalDamage);
}

/**
 * Heal-category pre_apply subscriber. Heals the target by
 * `ability.healAmount`, dispatches heal FX, cancels the event so
 * damage-path subscribers are skipped. Dead targets no-op on the heal
 * but still cancel.
 */
export function applyHealPhase(event: DamageEvent): void {
  if (event.cancelled) return;
  if (event.ability.category !== 'heal') return;

  const amount = event.ability.healAmount ?? 0;
  const target = event.target as IUnit;
  if (amount > 0 && !target.dead && typeof target.heal === 'function') {
    const healed = target.heal(amount);
    if (healed > 0) {
      dispatchHealFx(target, healed);
    }
  }
  event.cancelled = true;
}

// Heal FX dispatcher — module-level singleton set by CombatSystem
// constructor so applyHealPhase stays pure (Phaser-free testability).
// Pass the ACTUAL `healed` amount capped by maxHp, not the requested
// amount — a target at 95/100 healing for 20 shows "+5".
export type HealFxDispatcher = (target: IUnit, amount: number) => void;
let _healFxDispatcher: HealFxDispatcher = () => {};

export function setHealFxDispatcher(fn: HealFxDispatcher): void {
  _healFxDispatcher = fn;
}

export function dispatchHealFx(target: IUnit, amount: number): void {
  _healFxDispatcher(target, amount);
}

/**
 * DOT dispatcher factory. Builds the closure CombatSystem registers
 * with `setDotDispatcher` — reads _currentCtx, save-restores
 * `_lastAttacker` around queueAbility + resolveFrame. Save-restore (not
 * set-clear) is mandatory: if a future refactor nests updateEffects
 * inside a resolve frame, set-clear would clobber the outer attacker.
 * Factored so tests can exercise the shape without CombatSystem.
 */
export interface DotDispatcherHooks {
  getCurrentCtx(): CombatContext | null;
  getLastAttacker(): IUnit | null;
  setLastAttacker(u: IUnit | null): void;
  queueAbility(
    attacker: IUnit,
    target: IUnit,
    abilityName: string,
    opts: { baseDamageOverride: number; legacyHitFlavor: HitFlavor },
  ): void;
  resolveFrame(): void;
}

export function makeDotDispatcher(
  hooks: DotDispatcherHooks,
): (attacker: unknown, target: unknown, dmg: number, flavor: HitFlavor) => void {
  return (attacker, target, dmg, flavor) => {
    const ctx = hooks.getCurrentCtx();
    if (!ctx) return; // defensive: DOT tick outside a resolve window
    const prev = hooks.getLastAttacker();
    const src = (attacker as IUnit | null) ?? (target as IUnit);
    hooks.setLastAttacker(src);
    try {
      hooks.queueAbility(src, target as IUnit, 'override_damage_event', {
        baseDamageOverride: dmg,
        legacyHitFlavor: flavor,
      });
      hooks.resolveFrame();
    } finally {
      hooks.setLastAttacker(prev);
    }
  };
}

/**
 * Apply-effects post_apply subscriber. Reads `event.effects` and calls
 * `applyEffect` for each; forwards `event.attacker` as the ActiveEffect
 * `source` so hooks like knockback.onApply can reach attacker fields.
 *
 * REGISTRATION ORDER: must run AFTER _applyDeathEffectsPhase. Death
 * handler runs first, sets `dead = true` on lethal hits; this
 * subscriber then no-ops on corpses via applyEffect's dead-target guard.
 */
export function applyEffectsPhase(event: DamageEvent): void {
  if (event.cancelled) return;
  const effects = event.effects;
  if (!effects || effects.length === 0) return;
  const target = event.target as unknown as Parameters<typeof applyEffect>[0];
  const source = event.attacker;
  for (const name of effects) {
    applyEffect(target, name, { source });
  }
}

// Death-trigger downstream dispatcher. Closure captures pipeline +
// alive-roster access; CombatSystem constructor installs it. The
// closure does NOT call resolveFrame — the outer drain loop handles
// it (selector-in-subscriber safety rule).
export type DeathTriggerDispatcher = (dyingUnit: IUnit, deathAbilityName: string) => void;
let _deathTriggerDispatcher: DeathTriggerDispatcher = () => {};

export function setDeathTriggerDispatcher(fn: DeathTriggerDispatcher): void {
  _deathTriggerDispatcher = fn;
}

/**
 * AOE rider post_apply subscriber. Applies `aoeRider.effect` to up to
 * `targetCount` enemies within `radius` of the PRIMARY target (center-
 * to-center). Registered AFTER applyEffectsPhase (primary goes first)
 * and BEFORE applyDeathTriggerPhase (deaths could remove ride targets).
 */
type AliveListAccessor = () => readonly IUnit[];
let _getAliveList: AliveListAccessor = () => [];

export function setAoeRiderAliveAccessor(fn: AliveListAccessor): void {
  _getAliveList = fn;
}

export function applyAoeRiderPhase(event: DamageEvent): void {
  if (event.cancelled) return;
  const rider = event.ability.aoeRider;
  if (!rider) return;
  const primary = event.target as IUnit;
  const allAlive = _getAliveList();

  const secondaries = (allAlive as readonly IUnit[])
    .filter(e => {
      if (rider.excludePrimary && e === primary) return false;
      if (e.side === (event.attacker as IUnit).side) return false;
      if (e.dead || e.burrowed) return false;
      // Center-to-center distance.
      const dist = Math.abs(
        (e.x + e.unitW / 2) - (primary.x + primary.unitW / 2),
      );
      return dist < rider.radius;
    })
    .sort((a, b) =>
      Math.abs(a.x - primary.x) - Math.abs(b.x - primary.x),
    )
    .slice(0, rider.targetCount);

  for (const t of secondaries) {
    applyEffect(t as Parameters<typeof applyEffect>[0], rider.effect);
  }
}

/**
 * Death-trigger post_apply subscriber — fires at most once per unit
 * death. Asymmetric latch ownership with _applyDeathEffectsPhase:
 * the death-effects subscriber CHECKS `_deathTriggerFired`; this
 * subscriber SETS it. DO NOT move the set below the `!deathAbility`
 * check — every dying unit (not just those with death abilities)
 * must arm the latch so _applyDeathEffectsPhase can bail on event 2+.
 */
export function applyDeathTriggerPhase(event: DamageEvent): void {
  if (event.cancelled) return;
  const target = event.target as IUnit;
  if (!target.dead) return;
  if (target._deathTriggerFired) return;
  target._deathTriggerFired = true;
  const deathAbilityName = target.deathAbility;
  if (!deathAbilityName) return;
  _deathTriggerDispatcher(target, deathAbilityName);
}

/**
 * post_apply registration order:
 *   1. deathEffects      — death FX + Finding 12 check-only guard
 *   2. applyEffectsPhase — apply queued effects to the target
 *   3. applyAoeRiderPhase — AOE spread for abilities with aoeRider
 *   4. applyDeathTriggerPhase — check-and-set _deathTriggerFired
 * Order is load-bearing; pinned by phase8.test.ts.
 */
export function registerPhase8PostApplyHandlers(
  pipeline: CombatPipeline,
  legacyPostApply: (event: DamageEvent) => void,
): void {
  pipeline.on('post_apply', legacyPostApply);
  pipeline.on('post_apply', applyEffectsPhase);
  pipeline.on('post_apply', applyAoeRiderPhase);
  pipeline.on('post_apply', applyDeathTriggerPhase);
}

/**
 * modify phase order — variance/crit first (attacker-side RNG), aura
 * next (defender scales post-RNG value), floor LAST (terminal clamp).
 * DO NOT register after applyFinalDamageFloor — pinned by phase8.test.ts.
 */
export function registerPhase8ModifyHandlers(pipeline: CombatPipeline): void {
  pipeline.on('modify', applyVarianceAndCritModify);
  pipeline.on('modify', applyAuraDamageModify);
  pipeline.on('modify', applyFinalDamageFloor); // terminal — DO NOT register after
}

// Consistent damage indicator colors by type
const DMG_COLORS: DamageColorMap = {
  melee:  0xf04040,  // red — physical melee
  ranged: 0xf0a030,  // orange — ranged shots
  aoe:    0xffcc20,  // yellow — area/explosion
  poison: 0x60e030,  // green — poison DOT
  burn:   0xff6010,  // fire orange — burn DOT
  heal:   0x60f880,  // green — healing
  nectar: 0xf0c040,  // nectar — reward
  blocked:0x5ac8f8,  // blue — blocked/shielded
  base:   0xf05050,  // red — base damage
};

export class CombatSystem {
  scene: Phaser.Scene;
  events: EventBus;
  audio: AudioManager | null;
  worldW: number;
  _lastHitSound: number;
  _lastHealSound: number;
  _lastAttacker: IUnit | null;

  pipeline: CombatPipeline;

  /**
   * Live CombatContext captured at the top of resolve(); cleared at
   * the bottom so stale references can't leak across frames.
   * Subscribers registered at construction read this via closure.
   */
  private _currentCtx: CombatContext | null = null;

  /**
   * Base entity wrappers, set once by GameManager. Optional so the
   * sandbox (dummy bases without wrappers) keeps working; _findTarget
   * skips base targeting when unset.
   */
  playerBaseEntity: BaseEntity | null = null;
  enemyBaseEntity: BaseEntity | null = null;

  constructor(scene: Phaser.Scene, events: EventBus, worldW: number = DEFAULT_WORLD_W) {
    this.scene = scene;
    this.events = events;
    this.audio = null;
    this.worldW = worldW;
    this._lastHitSound = 0;
    this._lastHealSound = 0;
    this._lastAttacker = null;

    this.pipeline = new CombatPipeline();
    // Modify + post_apply registration routes through the helpers so
    // the phase8.test.ts order pins stay meaningful without Phaser.
    // Do not inline.
    registerPhase8ModifyHandlers(this.pipeline);
    this.pipeline.on('pre_apply',  applyHealPhase);
    this.pipeline.on('apply',      (e) => this._applyDamagePhase(e));
    registerPhase8PostApplyHandlers(
      this.pipeline,
      (e) => this._applyDeathEffectsPhase(e),
    );

    // DOT dispatcher — burn.onTick and future DOT hooks call
    // dispatchDotDamage, which forwards to this closure.
    setDotDispatcher(makeDotDispatcher({
      getCurrentCtx: () => this._currentCtx,
      getLastAttacker: () => this._lastAttacker,
      setLastAttacker: (u) => { this._lastAttacker = u; },
      queueAbility: (attacker, target, abilityName, opts) => {
        this.pipeline.queueAbility(attacker, target, abilityName, opts);
      },
      resolveFrame: () => { this.pipeline.resolveFrame(); },
    }));

    // Heal FX dispatcher — spawns green "+N" float + heal sound.
    setHealFxDispatcher((target, amount) => {
      const ctx = this._currentCtx;
      if (!ctx) return;
      if (ctx.particles) {
        ctx.particles.float(
          target.x + target.unitW / 2,
          target.y - 8,
          `+${amount}`,
          0x60f880,
        );
      }
      this._playHitSound(this.audio, 'heal');
    });

    // Death-trigger dispatcher — explosion FX + selector + queueAbility
    // per target. Fires once per death from applyDeathTriggerPhase.
    setDeathTriggerDispatcher((dyingUnit, deathAbilityName) => {
      const ctx = this._currentCtx;
      if (!ctx) return;

      const bx = dyingUnit.x + dyingUnit.unitW / 2;
      const by = dyingUnit.y + dyingUnit.unitH / 2;
      if (ctx.particles) {
        // Direct particle push via `as any` — IParticleManager doesn't
        // expose the internal array.
        const pm = ctx.particles as any;
        // 30 fast wide particles
        for (let i = 0; i < 30; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 3 + Math.random() * 5;
          pm.particles.push({
            x: bx, y: by,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s - 2,
            life: 0.8 + Math.random() * 0.5,
            col: [0xffcc20, 0xff8020, 0xff4010][Math.floor(Math.random() * 3)],
            r: 2.5 + Math.random() * 3,
          });
        }
        // 12 slow rising embers
        for (let i = 0; i < 12; i++) {
          pm.particles.push({
            x: bx + (Math.random() - 0.5) * 20,
            y: by,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1 - Math.random() * 2,
            life: 1.0 + Math.random() * 0.6,
            col: 0xffaa30,
            r: 1 + Math.random() * 1.5,
          });
        }
      }
      if (ctx.particles) {
        ctx.particles.float(bx, dyingUnit.y - 14, 'BOOM!', 0xffcc20, true);
      }
      this._playHitSound(this.audio, 'aoe');

      const ability = lookupAbility(deathAbilityName);
      const allAlive = ctx.allAlive ?? [];
      const targets = runSelectorInRange(
        ability.targeting!,
        dyingUnit,
        ability,
        allAlive,
      );
      for (const t of targets) {
        this.pipeline.queueAbility(dyingUnit, t as IUnit, deathAbilityName, {
          baseDamageOverride: 65,
        });
      }
    });

    // AOE rider alive-list accessor — live _currentCtx each call.
    setAoeRiderAliveAccessor(() =>
      (this._currentCtx?.allAlive ?? []) as IUnit[],
    );

    setStunFxDispatcher((target) => {
      const ctx = this._currentCtx;
      if (!ctx || !ctx.particles) return;
      ctx.particles.float(
        target.x + target.unitW / 2,
        target.y - 18,
        'STUNNED!',
        0x80ffff,
      );
    });

    setStaggerFxDispatcher((target) => {
      const ctx = this._currentCtx;
      if (!ctx || !ctx.particles) return;
      ctx.particles.float(
        target.x + target.unitW / 2,
        target.y - 14,
        'STAGGER!',
        0xffaa30,
      );
    });
  }

  /** GameManager calls once at battle setup; sandbox skips. */
  setBaseEntities(player: BaseEntity, enemy: BaseEntity): void {
    this.playerBaseEntity = player;
    this.enemyBaseEntity = enemy;
  }

  resolve(units: IUnit[], dt: number, playerBase: BaseStructure, enemyBase: BaseStructure, particles: IParticleManager | null, wallActive: number, audio: AudioManager | null): void {
    const alive = units.filter(u => !u.dead);
    this.audio = audio;

    // Shared context passed to all combat hooks
    const ctx: CombatContext = {
      particles,
      audio,
      scene: this.scene,
      events: this.events,
      allAlive: alive,
      S: 1,
      sourceUnit: null,
      playHitSound: (type: HitSoundType) => this._playHitSound(audio, type),
    };

    // Expose ctx to pipeline subscribers for the duration of resolve().
    this._currentCtx = ctx;

    // Passive tick runs BEFORE attacks so aura-applied modifiers
    // (Centurion rally, Wardling ward) are visible in the same frame.
    // Passes both `units` (includes dead — aura death-cleanup walks
    // them) and `alive` (self-modifier branch reads only alive).
    this.updatePassives(units, alive, dt);

    alive.forEach(u => {
      ctx.sourceUnit = u;
      u.update(dt);

      // One-time spawn latch. Behavior that used to attach here
      // (legacy onSpawn hooks) now composes from ability data; see
      // DESIGN_PATTERNS.md §3.
      u._spawned = true;

      // Apply knockback velocity (smooth push) — skip normal AI while sliding
      if (u.knockback !== 0) {
        u.x += u.knockback * dt;
        u.knockback *= Math.pow(0.04, dt);
        if (Math.abs(u.knockback) < 5) u.knockback = 0;
        // Knockback interrupts foreswing — attack resets, no damage
        if (u._swinging) { u._swinging = false; u.foreswingTimer = 0; }
        u.backswingTimer = 0;
        return; // staggered — no movement or attacks while knocked back
      }

      // Stunned — skip all AI
      if (hasActiveEffect(u, 'stun')) {
        u.state = 'march'; // idle visually
        if (u._swinging) { u._swinging = false; u.foreswingTimer = 0; }
        return;
      }

      // Find foe in attack range
      const foes = alive.filter(e => e.side !== u.side && !e.dead);
      const { target, dist } = this._findTarget(u, foes);

      if (target) {
        u.startAttack();

        if (u.foreswingTimer > 0) {
          // Still winding up — wait
        } else if (u._swinging) {
          // Foreswing just completed — DEAL DAMAGE
          u._swinging = false;

          if (target instanceof BaseEntity) {
            // In-range base attack — ranged units only (melee units
            // can't enter this branch via _findTarget). Fires from
            // the unit's current position; wallActive blocks only
            // player-base damage.
            const dmg = Math.max(1, u.atk);

            if (target.side === 'player') {
              const actualDmg = wallActive > 0 ? 0 : dmg;
              target.takeDamage(actualDmg);
              if (wallActive > 0) {
                if (particles) particles.float(SBW / 2, GND - 40, 'BLOCKED!', DMG_COLORS.blocked);
              } else {
                target.structure.flash(0.2);
                if (particles) particles.float(SBW / 2, GND - 40, `-${dmg}`, DMG_COLORS.base);
              }
              if (particles) particles.burst(SBW - 2, GND - 20, u.primary, 4);
            } else {
              target.takeDamage(dmg);
              target.structure.flash(0.2);
              if (particles) particles.float(this.worldW - SBW / 2, GND - 40, `-${dmg}`, DMG_COLORS.base);
              if (particles) particles.burst(this.worldW - SBW + 2, GND - 20, u.primary, 4);
            }

            const effectiveAtkRate = applyModifiers(u, u.atkRate, 'atkRate');
            u.atkCd = (1 / effectiveAtkRate) - u.foreswing;
            u.backswingTimer = u.backswing;
          } else {
            this._lastAttacker = u;
            const hitType: HitFlavor = u.range >= 50 ? 'ranged' : 'melee';

            {
              const abilityName = u.defaultAbility!;
              const ability = lookupAbility(abilityName);
              const tc = ability.targetCount ?? 1;

              if (tc > 1) {
                // Multi-target (Stormfly chain, Longeye pierce). Primary
                // comes from _findTarget (edge-to-edge); the selector
                // would miss it at the range boundary by unitW pixels.
                // Calculate phase computes per-target finalDamage =
                // applyModifiers(atk) × dmgMult × targetFalloff[i] ×
                // damageMultiplier; we set _targetIndex + damageMultiplier
                // (overcharge) on each queued event below.
                //
                // Secondary selection: chainRange → within range of
                // primary (Stormfly); absent → attacker-centric selector
                // minus primary (Longeye).
                let secondaries: IUnit[];
                if (ability.chainRange != null) {
                  const cr = ability.chainRange;
                  const primary = target as IUnit;
                  secondaries = (ctx.allAlive as IUnit[])
                    .filter(e =>
                      e !== primary &&
                      e.side !== u.side &&
                      !e.dead &&
                      !e.burrowed &&
                      Math.abs(e.x - primary.x) <= cr,
                    )
                    .sort((a, b) =>
                      Math.abs(a.x - primary.x) - Math.abs(b.x - primary.x),
                    )
                    .slice(0, tc - 1);
                } else {
                  const selectorResults = runSelectorInRange(
                    ability.targeting!,
                    u,
                    ability,
                    ctx.allAlive,
                  );
                  secondaries = selectorResults
                    .filter(e => e !== target)
                    .slice(0, tc - 1) as IUnit[];
                }
                const targets = [target as IUnit, ...secondaries];

                // Every-Nth-cast damage doubling via ResourceSystem
                // castCount. Gated on ability.overchargeEvery.
                let overcharge = 1;
                if (ability.overchargeEvery) {
                  const castCount = getResource(u as any, 'castCount');
                  addResource(u as any, 'castCount', 1);
                  if ((castCount + 1) % ability.overchargeEvery === 0) {
                    overcharge = 2;
                    if (ctx.particles) {
                      ctx.particles.float(
                        u.x + u.unitW / 2, u.y - 18,
                        'OVERCHARGE!', 0xffff40,
                      );
                    }
                  }
                }

                for (let i = 0; i < targets.length; i++) {
                  const t = targets[i] as IUnit;
                  const event = this.pipeline.queueAbility(u, t, abilityName, {
                    legacyHitFlavor: hitType,
                  });
                  event._targetIndex = i;
                  event.damageMultiplier = overcharge;
                }

                // Chain arc FX between consecutive targets
                if (ctx.particles && targets.length > 1) {
                  for (let i = 1; i < targets.length; i++) {
                    const prev = targets[i - 1] as IUnit;
                    const curr = targets[i] as IUnit;
                    ctx.particles.burst(
                      (prev.x + curr.x) / 2 + (prev.unitW + curr.unitW) / 4,
                      (prev.y + curr.y) / 2,
                      0x80ffff,
                      3,
                    );
                  }
                }

                // Single resolveFrame drains ALL queued events.
                this.pipeline.resolveFrame();
                this._playHitSound(audio, hitType);
              } else {
                this.pipeline.queueAbility(
                  u,
                  target,
                  abilityName,
                  { legacyHitFlavor: hitType },
                );
                this.pipeline.resolveFrame();
                this._playHitSound(audio, hitType);
              }
            }
            this._lastAttacker = null;

            // Cooldown = total interval minus foreswing (already elapsed)
            const effectiveAtkRate = applyModifiers(u, u.atkRate, 'atkRate');
            u.atkCd = (1 / effectiveAtkRate) - u.foreswing;
            u.backswingTimer = u.backswing;

          }
        } else if (u.canAttack() && u.backswingTimer <= 0) {
          // Start new attack cycle — begin foreswing
          u.foreswingTimer = u.foreswing;
          u._swinging = true;
        }
      } else {
        // March
        u.state = 'march';
        const spd = u.getSpeed();
        u.x += u.facing * spd * 60 * dt;

        // Player unit reaches enemy base — attack it
        if (u.side === 'player' && u.x + u.unitW >= this.worldW - SBW) {
          u.x = this.worldW - SBW - u.unitW;
          u.startAttack();

          if (u.foreswingTimer > 0) {
            // Winding up
          } else if (u._swinging) {
            u._swinging = false;
            const dmg = Math.max(1, u.atk);
            enemyBase.setHp(enemyBase.hp - dmg);
            enemyBase.flash(0.2);
            if (particles) particles.float(this.worldW - SBW / 2, GND - 40, `-${dmg}`, DMG_COLORS.base);
            if (particles) particles.burst(this.worldW - SBW + 2, GND - 20, u.primary, 4);
            const effectiveAtkRate = applyModifiers(u, u.atkRate, 'atkRate');
            u.atkCd = (1 / effectiveAtkRate) - u.foreswing;
            u.backswingTimer = u.backswing;
          } else if (u.canAttack() && u.backswingTimer <= 0) {
            u.foreswingTimer = u.foreswing;
            u._swinging = true;
          }
        }

        // Enemy unit reaches player base — attack it
        if (u.side === 'enemy' && u.x <= SBW) {
          u.x = SBW;
          u.startAttack();

          if (u.foreswingTimer > 0) {
            // Winding up
          } else if (u._swinging) {
            // Foreswing done — hit base
            u._swinging = false;
            const dmg = Math.max(1, u.atk);
            const actualDmg = wallActive > 0 ? 0 : dmg;
            playerBase.setHp(playerBase.hp - actualDmg);
            if (wallActive > 0) {
              if (particles) particles.float(SBW / 2, GND - 40, 'BLOCKED!', DMG_COLORS.blocked);
            } else {
              playerBase.flash(0.2);
              if (particles) particles.float(SBW / 2, GND - 40, `-${dmg}`, DMG_COLORS.base);
            }
            if (particles) particles.burst(SBW - 2, GND - 20, u.primary, 4);
            const effectiveAtkRate = applyModifiers(u, u.atkRate, 'atkRate');
            u.atkCd = (1 / effectiveAtkRate) - u.foreswing;
            u.backswingTimer = u.backswing;
          } else if (u.canAttack() && u.backswingTimer <= 0) {
            u.foreswingTimer = u.foreswing;
            u._swinging = true;
          }
        }

        // Not attacking any base — cancel foreswing
        const atPlayerBase = u.side === 'enemy' && u.x <= SBW;
        const atEnemyBase = u.side === 'player' && u.x + u.unitW >= this.worldW - SBW;
        if (!atPlayerBase && !atEnemyBase) {
          if (u._swinging) { u._swinging = false; u.foreswingTimer = 0; }
        }
      }
    });

    // Tick active effects AFTER the per-unit combat loop but BEFORE
    // clearing _currentCtx — DOT hooks route damage through the
    // pipeline and need the live ctx for FX.
    updateEffects(alive, dt);

    // End of frame — release the ctx reference so stale state can't
    // leak into the next frame via phase subscribers.
    this._currentCtx = null;
  }

  // --- Target finding ---
  //
  // Returns the closest valid target for `u`. Phase 6 follow-up #2
  // Returns the closest valid target for `u`. Ranged units can target
  // opposing bases; melee units can't (they fall through to the
  // at-wall attack path so their wall-touching animation is preserved).
  _findTarget(u: IUnit, foes: IUnit[]): { target: IUnit | BaseEntity | null; dist: number } {
    let target: IUnit | BaseEntity | null = null;
    let bestDist = Infinity;
    foes.forEach(e => {
      if (e.burrowed) return;
      if (!canAttack(u.currentRoute, u.attackRange, e.currentRoute)) return;
      const dist = u.facing > 0
        ? (e.x - (u.x + u.unitW))
        : (u.x - (e.x + e.unitW));
      const absDist = Math.max(0, dist);
      if (absDist <= u.range && dist > -(e.unitW + u.unitW) && absDist < bestDist) {
        bestDist = absDist;
        target = e;
      }
    });

    // Ranged units can acquire the opposing base as a target.
    if (u.attackRange === 'ranged') {
      const enemyBase = u.side === 'player' ? this.enemyBaseEntity : this.playerBaseEntity;
      if (enemyBase && !enemyBase.dead) {
        const dist = u.facing > 0
          ? (enemyBase.x - (u.x + u.unitW))
          : (u.x - (enemyBase.x + enemyBase.unitW));
        const absDist = Math.max(0, dist);
        if (absDist <= u.range && absDist < bestDist) {
          bestDist = absDist;
          target = enemyBase;
        }
      }
    }

    return { target, dist: bestDist };
  }

  /**
   * `apply` subscriber: route check, takeDamage, damage particles.
   * Poise/stagger live on knockback.onApply via the blunt default
   * effect.
   */
  private _applyDamagePhase(event: DamageEvent): void {
    const ctx = this._currentCtx;
    if (!ctx) return;

    const u = event.target as IUnit;
    if (u.dead || u.burrowed) { event.cancelled = true; return; }

    const attacker = event.attacker as IUnit;
    if (attacker && attacker !== u && !canAttack(attacker.currentRoute, attacker.attackRange, u.currentRoute)) {
      event.cancelled = true;
      return;
    }

    const dmgType: HitFlavor = event._legacyHitFlavor ?? 'melee';
    const col = DMG_COLORS[dmgType] || DMG_COLORS.melee;

    // Integer-floor safety net against any subscriber leaving a
    // fractional finalDamage. The modify chain already rounds.
    let dmg = Math.round(event.finalDamage);
    event.finalDamage = dmg;
    u.takeDamage(dmg);

    if (ctx.particles) {
      ctx.particles.float(u.x + u.unitW / 2, u.y - 6, `-${dmg}`, col);
      ctx.particles.burst(u.x + u.unitW / 2, u.y + u.unitH / 2, col, 4);
    }
  }

  /**
   * Passive tick loop. Three dispatch branches run once per resolve(),
   * BEFORE the per-unit attack forEach so modifier writes are visible
   * to the attack cycle in the same frame:
   *
   *   - Self-modifier (Ravager): predicate-gated modifier on self.
   *     Source-tagged `self:${id}:${stat}`; addModifier/remove flips
   *     on/off as condition crosses threshold.
   *   - Aura (Centurion, Wardling): walked-list pattern. Walk 1
   *     adds source-tagged `aura:${ownerId}:${stat}` modifiers to
   *     in-range same-side allies that don't already carry it. Walk 2
   *     removes source-tagged modifiers from allies no longer in range.
   *     Death cleanup: if owner is dead and `_auraCleanedUp` is false,
   *     run Walk 2 with `inRange = ∅`.
   *   - Passive heal (Mendwing): ticks per-unit cooldown; when ready
   *     AND a valid target exists, queues heal via queueAbility.
   *
   * `units` includes dead (aura death-cleanup needs it); `alive` is
   * the pre-filtered live roster.
   */
  private updatePassives(units: IUnit[], alive: IUnit[], dt: number): void {
    // Self-modifier branch.
    for (const u of alive) {
      const selfMod = u.selfModifier;
      if (!selfMod) continue;

      const predicate = lookupPredicate(selfMod.condition);
      if (!predicate) continue; // unknown predicate — silent skip

      const sourceTag = `self:${u.id}:${selfMod.stat}`;
      const shouldBeActive = predicate(u);
      const hasModifier = u.modifiers?.some((m) => m.source === sourceTag) ?? false;

      if (shouldBeActive && !hasModifier) {
        addModifier(u, {
          stat: selfMod.stat,
          type: selfMod.type,
          value: selfMod.value,
          source: sourceTag,
        });
      } else if (!shouldBeActive && hasModifier) {
        removeModifiersBySource(u, sourceTag);
      }
    }

    // Aura branch. Walks ALL units (dead included) with an
    // `auraModifier` config; maintains a source-tagged modifier on
    // every in-range same-side ally.
    //
    // Three states:
    //   - Dead owner + `_auraCleanedUp: false` → ONE-TIME cleanup
    //     pass removes the owner's source tag from every same-side
    //     unit carrying it; latch flips to true.
    //   - Dead owner + `_auraCleanedUp: true` → skip.
    //   - Alive owner → walked-list: Walk 1 (enter) adds the tag to
    //     in-range allies missing it; Walk 2 (exit) removes the tag
    //     from allies already carrying it that are now out of range.
    //
    // Source tag `aura:${ownerId}:${stat}` keeps multi-owner overlap
    // clean: two Wardlings produce two distinct tags on a shared ally,
    // stacking additively; one owner dying removes ONLY its own tag.
    //
    // Distance uses strict-less-than (`>= aura.range` is OUT) for
    // legacy byte-parity on the boundary.
    for (const u of units) {
      const aura = u.auraModifier;
      if (!aura) continue;

      const sourceTag = `aura:${u.id}:${aura.stat}`;

      if (u.dead) {
        if (u._auraCleanedUp) continue;
        for (const ally of units) {
          if (ally === u) continue;
          if (ally.side !== u.side) continue;
          if (!ally.modifiers?.some((m) => m.source === sourceTag)) continue;
          removeModifiersBySource(ally, sourceTag);
        }
        u._auraCleanedUp = true;
        continue;
      }

      const ux = u.x + u.unitW / 2;

      // Walk 1 — enter.
      for (const ally of alive) {
        if (ally === u) continue;
        if (ally.side !== u.side) continue;
        const ax = ally.x + ally.unitW / 2;
        const distance = Math.abs(ax - ux);
        if (distance >= aura.range) continue;
        const hasModifier = ally.modifiers?.some((m) => m.source === sourceTag) ?? false;
        if (!hasModifier) {
          addModifier(ally, {
            stat: aura.stat,
            type: aura.type,
            value: aura.value,
            source: sourceTag,
          });
        }
      }

      // Walk 2 — exit.
      for (const ally of alive) {
        if (ally === u) continue;
        if (ally.side !== u.side) continue;
        const hasModifier = ally.modifiers?.some((m) => m.source === sourceTag) ?? false;
        if (!hasModifier) continue;
        const ax = ally.x + ally.unitW / 2;
        const distance = Math.abs(ax - ux);
        if (distance >= aura.range) {
          removeModifiersBySource(ally, sourceTag);
        }
      }
    }

    // Passive-heal branch. Each `passiveHeal`-carrying unit's
    // `healTimer` accumulates dt; when >= cooldown AND a valid target
    // exists, queues a heal event and resets the timer. When no
    // target exists, the timer STAYS at/above cooldown — next-frame
    // target acquisition fires immediately, no artificial delay.
    for (const u of alive) {
      const healCfg = u.passiveHeal;
      if (!healCfg) continue;

      u.healTimer = (u.healTimer ?? 0) + dt;
      if (u.healTimer < healCfg.cooldown) continue;

      const ability = lookupAbility(healCfg.abilityName);
      const targets = runSelectorInRange(
        ability.targeting,
        u,
        ability,
        alive,
      );
      if (targets.length === 0) continue;

      u.healTimer = 0;
      this.pipeline.queueAbility(u, targets[0] as IUnit, healCfg.abilityName, {});
    }

    // Drain heal events queued above. Runs BEFORE the attack forEach
    // so heals land before same-frame damage (Mendwing saves the ally
    // from the incoming attack). Safe: updatePassives is called from
    // resolve() before any phase subscriber runs, so this is not
    // reentrant.
    this.pipeline.resolveFrame();
  }

  /**
   * Death FX + nectar reward subscriber. CHECK-ONLY on the
   * `_deathTriggerFired` latch — does NOT set it. The latch is set
   * later in the same drain by applyDeathTriggerPhase, arming this
   * subscriber against double-fire on event 2+ against an already-
   * dead target. Do NOT add `_deathTriggerFired = true` here.
   */
  private _applyDeathEffectsPhase(event: DamageEvent): void {
    const ctx = this._currentCtx;
    if (!ctx) return;

    const u = event.target as IUnit;
    if (!u.dead || u._deathTriggerFired) return;

    if (ctx.particles) {
      ctx.particles.burst(u.x + u.unitW / 2, u.y + u.unitH / 2, u.primary, 14);
    }
    if (this.audio) this.audio.unitDeath();

    if (u.side === 'enemy') {
      this.events.emit('enemyKilled', { unit: { key: u.key, reward: u.reward, x: u.x, y: u.y } });
      if (ctx.particles) {
        ctx.particles.float(u.x + u.unitW / 2, u.y - 18, `+${u.reward}\u2B21`, DMG_COLORS.nectar);
      }
    }
  }

  _playHitSound(audio: AudioManager | null, type: HitFlavor | HitSoundType): void {
    if (!audio) return;
    const now = performance.now();
    if (now - this._lastHitSound < 80) return;
    this._lastHitSound = now;
    if (type === 'heal') {
      if (now - this._lastHealSound > 500) {
        this._lastHealSound = now;
        audio.heal();
      }
      return;
    }
    if (type === 'aoe') audio.aoeHit();
    else if (type === 'ranged') audio.rangedShot();
    else audio.meleeHit();
  }
}
