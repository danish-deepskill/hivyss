// Combat damage-pipeline PHASE handlers — the subscribers CombatPipeline runs at
// each phase (modify, pre_apply, post_apply), plus the registration helpers that
// wire them in the load-bearing order pinned by phase8.test.ts. Pulled out of
// CombatSystem so the orchestrator only WIRES the pipeline; the phase logic lives
// here. Phases reach side effects through the CombatDispatch seam (heal FX, death
// triggers), never Phaser directly — that's what keeps them deterministically
// testable without a CombatSystem instance.

import type { DamageEvent, IUnit } from '../types';
import { applyModifiers } from './ModifierSystem';
import { applyEffect } from './EffectSystem';
import { shiftTier, type ResistanceTier } from '../config/combat/resistances';
import type { CombatPipeline, CalcAttacker, CalcTarget } from './CombatPipeline';
import { dispatchHealFx, dispatchDeathTrigger } from './CombatDispatch';

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
  const knockForce = event.ability.tiers?.[event.effectiveTier]?.knockForce;
  for (const name of effects) {
    applyEffect(target, name, { source, appliedTier: event.effectiveTier, knockForce });
  }
}

/**
 * AOE rider post_apply subscriber. Applies `aoeRider.effect` to up to
 * `targetCount` enemies within `radius` of the PRIMARY target (center-
 * to-center). Registered AFTER applyEffectsPhase (primary goes first)
 * and BEFORE applyDeathTriggerPhase (deaths could remove ride targets).
 *
 * The alive-roster is supplied by the orchestrator via the accessor below
 * (CombatSystem owns the live list; this phase only reads it).
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
      // Same-lane only — AOE spreads within the primary's lane.
      if (e.lane !== primary.lane) return false;
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

  const dmgType = event.ability.dmgType;
  const pen = dmgType ? (event.attacker as CalcAttacker).penetration?.[dmgType] ?? 0 : 0;
  for (const t of secondaries) {
    let appliedTier: ResistanceTier = 'normal';
    if (dmgType) {
      const secondaryRes = (t as CalcTarget).resistance?.[dmgType] ?? 'normal';
      appliedTier = shiftTier(secondaryRes, -pen);
    }
    applyEffect(t as Parameters<typeof applyEffect>[0], rider.effect, { appliedTier });
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
  dispatchDeathTrigger(target, deathAbilityName);
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
