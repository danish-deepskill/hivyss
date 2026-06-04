// CombatSystem behavior tests.
//
// Coverage:
//   - F5 IP-4 `applyDeathTriggerPhase` latch semantics (pure function)
//   - F5 IP-4 / Finding 12 asymmetric ownership (check-only legacy +
//     check-and-set death-trigger), simulated with mock legacy + real
//     applyDeathTriggerPhase on a fresh CombatPipeline
//   - post_apply registration-order pin — failing this test catches
//     any future refactor that moves the subscribers out of the
//     [_applyDeathEffectsPhase, applyEffectsPhase, applyDeathTriggerPhase]
//     order
//   - F11 placeholder `knockback` EffectDef: `lookupEffect` resolves
//     (no throw), `applyEffect` lands a clean no-op, `updateEffects`
//     sweeps the one-frame transient
//   - Per-unit migration primitives (Legionnaire/Bashguard/Ravager/
//     Wardling/Centurion/Mendwing/Bombardier/Stormfly/Longeye),
//     aura dispatch + cleanup, multi-source stacking, pipeline drain,
//     targetFalloff, effectChance, aoeRider.
//
// Strategy: mirrors phase6/phase7a/phase7b shape — do NOT instantiate
// CombatSystem (it pulls in Phaser). Build a fresh CombatPipeline,
// register subscribers via the real helper, drive synthetic events
// through, assert side effects.

import { describe, it, expect } from 'vitest';
import { CombatPipeline } from '../../src/systems/CombatPipeline';
import {
  applyEffectsPhase,
  applyDeathTriggerPhase,
  applyAoeRiderPhase,
  setAoeRiderAliveAccessor,
  applyAuraDamageModify,
  applyVarianceAndCritModify,
  applyFinalDamageFloor,
  applyHealPhase,
  registerPhase8PostApplyHandlers,
  registerPhase8ModifyHandlers,
} from '../../src/systems/CombatPhases';
import { setHealFxDispatcher, setDeathTriggerDispatcher } from '../../src/systems/CombatDispatch';
import { applyEffect, updateEffects, hasActiveEffect } from '../../src/systems/EffectSystem';
import { lookupEffect, hasEffect } from '../../src/config/combat/effects';
import { setStaggerFxDispatcher } from '../../src/config/combat/effects/cc';
import { DEFAULT_EFFECTS } from '../../src/config/combat/defaultEffects';
import { lookupAbility } from '../../src/config/combat/abilities';
import { UNIT_DEFS } from '../../src/units/registry';
import { applyModifiers, addModifier, removeModifiersBySource } from '../../src/systems/ModifierSystem';
import { lookupPredicate } from '../../src/systems/PassivePredicates';
import { runSelectorInRange, resolveImpactTarget, signatureWouldWhiff } from '../../src/systems/Targeting';
import { getResource, addResource } from '../../src/systems/ResourceSystem';
import type { DamageEvent, IUnit, WorldEntity, ComponentTag, PassiveDef, AbilityDef } from '../../src/types';
import type { Modifier } from '../../src/systems/ModifierSystem';
import type { DamageType } from '../../src/config/combat/damageTypes';
import type { ResistanceTier } from '../../src/config/combat/resistances';

// Post-Batch-0 passives shape: behaviors live in a discriminated
// `passives[]` union instead of the old flat selfModifier/auraModifier/
// passiveHeal fields. This typed accessor finds the single entry of a
// given kind (all current units are single-passive) with proper
// narrowing, replacing the former direct field reads.
function findPassive<K extends PassiveDef['kind']>(
  src: { passives?: PassiveDef[] } | undefined,
  kind: K,
): Extract<PassiveDef, { kind: K }> | undefined {
  return src?.passives?.find(
    (p): p is Extract<PassiveDef, { kind: K }> => p.kind === kind,
  );
}

// ------------------------------------------------------------------
// Fixture builders
// ------------------------------------------------------------------

/**
 * Minimal IUnit-shaped mock for death-trigger testing. We cast to
 * IUnit at the event boundary because `applyDeathTriggerPhase` only
 * reads `dead`, `_deathTriggerFired`, and `deathAbility`.
 */
interface MockDyingUnit {
  id: number;
  dead: boolean;
  _deathTriggerFired?: boolean;
  deathAbility?: string;
  activeEffects: ReturnType<typeof Array>;
}

let _id = 0;
function makeMockDying(opts: {
  deathAbility?: string;
  alreadyFired?: boolean;
  dead?: boolean;
} = {}): MockDyingUnit {
  return {
    id: ++_id,
    dead: opts.dead ?? true,
    _deathTriggerFired: opts.alreadyFired,
    deathAbility: opts.deathAbility,
    activeEffects: [],
  };
}

/**
 * Minimal DamageEvent builder — just enough for the latch subscribers
 * to walk it. Real queueAbility events carry many more fields; we
 * only populate the ones the phase 8 post_apply subscribers read.
 */
function makeDeathEvent(target: MockDyingUnit): DamageEvent {
  return {
    target: target as unknown as IUnit,
    attacker: null,
    baseDamage: 0,
    finalDamage: 0,
    cancelled: false,
    effects: [],
  } as unknown as DamageEvent;
}

// ------------------------------------------------------------------
// F5 IP-4 — applyDeathTriggerPhase latch semantics (pure function)
// ------------------------------------------------------------------

describe('phase8 F5 IP-4 — applyDeathTriggerPhase latch', () => {
  it('no-ops when event.cancelled is true', () => {
    const target = makeMockDying({ dead: true });
    const event = makeDeathEvent(target);
    event.cancelled = true;
    applyDeathTriggerPhase(event);
    expect(target._deathTriggerFired).toBeUndefined();
  });

  it('no-ops when target is not dead', () => {
    const target = makeMockDying({ dead: false });
    const event = makeDeathEvent(target);
    applyDeathTriggerPhase(event);
    expect(target._deathTriggerFired).toBeUndefined();
  });

  it('arms the latch on first call against a dead target (even with no deathAbility)', () => {
    // THIS IS THE FINDING-12-LOAD-BEARING CASE. Every dying unit,
    // regardless of whether it has a deathAbility, must arm the latch
    // so _applyDeathEffectsPhase's check-only guard catches event 2+.
    const target = makeMockDying({ dead: true, deathAbility: undefined });
    applyDeathTriggerPhase(makeDeathEvent(target));
    expect(target._deathTriggerFired).toBe(true);
  });

  it('arms the latch on first call against a dead target with deathAbility set', () => {
    const target = makeMockDying({ dead: true, deathAbility: 'death_bomb' });
    applyDeathTriggerPhase(makeDeathEvent(target));
    expect(target._deathTriggerFired).toBe(true);
  });

  it('is idempotent on second call (re-entry latch)', () => {
    const target = makeMockDying({ dead: true });
    applyDeathTriggerPhase(makeDeathEvent(target));
    expect(target._deathTriggerFired).toBe(true);

    // Second call — latch is already true, subscriber should bail
    // without any observable state change.
    const before = target._deathTriggerFired;
    applyDeathTriggerPhase(makeDeathEvent(target));
    expect(target._deathTriggerFired).toBe(before);
  });

  it('does NOT touch the latch on a pre-fired target (defensive — latch already set externally)', () => {
    const target = makeMockDying({ dead: true, alreadyFired: true });
    applyDeathTriggerPhase(makeDeathEvent(target));
    // Stays true, subscriber bails at the CHECK line without
    // entering the SET line.
    expect(target._deathTriggerFired).toBe(true);
  });

  it('SET happens BEFORE the !deathAbility early-return — non-Bombardier units still arm the latch', () => {
    // Load-bearing: if the SET line were moved below the
    // `if (!deathAbilityName) return;` check, non-deathAbility units
    // would fall through without arming the latch, leaving
    // _applyDeathEffectsPhase unprotected against Finding 12 re-entry
    // for every unit except Bombardier. This test catches that
    // reordering regression.
    const noAbility = makeMockDying({ dead: true, deathAbility: undefined });
    applyDeathTriggerPhase(makeDeathEvent(noAbility));
    expect(noAbility._deathTriggerFired).toBe(true);

    const withAbility = makeMockDying({ dead: true, deathAbility: 'death_bomb' });
    applyDeathTriggerPhase(makeDeathEvent(withAbility));
    expect(withAbility._deathTriggerFired).toBe(true);
  });
});

// ------------------------------------------------------------------
// F5 IP-4 / Finding 12 — asymmetric ownership under real pipeline drain
// ------------------------------------------------------------------

describe('phase8 F5 IP-4 — asymmetric ownership under pipeline drain', () => {
  /**
   * Mock _applyDeathEffectsPhase — check-only Finding 12 guard mirroring
   * the real method's relevant lines. Counts how many times the body
   * runs so tests can distinguish event-1 (should run once) from
   * event-2-against-dead (should NOT run again).
   */
  function makeMockLegacy(counter: { runs: number }) {
    return (event: DamageEvent) => {
      const u = event.target as unknown as MockDyingUnit;
      // Finding 12 CHECK-ONLY guard. Never sets the latch.
      if (!u.dead || u._deathTriggerFired) return;
      counter.runs++;
      // DO NOT set the latch here. The latch is owned by
      // applyDeathTriggerPhase which runs later in the same drain.
    };
  }

  it('event 1 fires legacy exactly once AND arms the death-trigger latch', () => {
    const counter = { runs: 0 };
    const target = makeMockDying({ dead: true });

    // Drive the two subscribers in the locked registration order,
    // directly as function calls (synthetic DamageEvent — no pipeline
    // needed for this case).
    const event = makeDeathEvent(target);
    makeMockLegacy(counter)(event);
    applyEffectsPhase(event);
    applyDeathTriggerPhase(event);

    expect(counter.runs).toBe(1);
    expect(target._deathTriggerFired).toBe(true);
  });

  it('event 2 (re-drain on already-dead target) fires legacy ZERO times and leaves latch set', () => {
    const counter = { runs: 0 };
    const target = makeMockDying({ dead: true });

    // Event 1 — both legacy and death-trigger run.
    const legacy = makeMockLegacy(counter);
    const event1 = makeDeathEvent(target);
    legacy(event1);
    applyEffectsPhase(event1);
    applyDeathTriggerPhase(event1);

    expect(counter.runs).toBe(1);
    expect(target._deathTriggerFired).toBe(true);

    // Event 2 — same drain cycle, same dying target hit again. Both
    // subscribers must bail. counter.runs stays at 1 (legacy does
    // not double-fire — the Finding 12 fix).
    const event2 = makeDeathEvent(target);
    legacy(event2);
    applyEffectsPhase(event2);
    applyDeathTriggerPhase(event2);

    expect(counter.runs).toBe(1); // unchanged
    expect(target._deathTriggerFired).toBe(true); // still set
  });

  it('reversed registration order would break event 1 — ordering pin', () => {
    // This test documents WHY the order is load-bearing. If the
    // subscribers were registered in the wrong order (death-trigger
    // first, legacy second), the latch would be set before legacy's
    // check-only guard runs, and legacy would bail on event 1 —
    // losing death particles/audio/onDeath/reward for migrated units.
    //
    // We simulate the bad order here and assert it produces the
    // broken behavior. The real protection against this bad order
    // is the `registerPhase8PostApplyHandlers` helper + the test
    // below that pins the helper's order.
    const counter = { runs: 0 };
    const target = makeMockDying({ dead: true });

    const legacy = makeMockLegacy(counter);
    const event = makeDeathEvent(target);

    // WRONG ORDER — death-trigger first, legacy second.
    applyDeathTriggerPhase(event);
    legacy(event);

    // Legacy bailed on event 1 because the latch was set before it
    // ran. counter.runs is 0, which is the bug. (If this test ever
    // starts failing — counter.runs === 1 — something has changed
    // about the latch semantics and the asymmetric-ownership model
    // needs re-review.)
    expect(counter.runs).toBe(0);
  });
});

// ------------------------------------------------------------------
// Post_apply registration-order pin via the real helper
// ------------------------------------------------------------------

describe('phase8 — post_apply registration-order pin', () => {
  it('registerPhase8PostApplyHandlers registers exactly 4 handlers in the locked order', () => {
    const pipeline = new CombatPipeline();
    const legacyStub: (e: DamageEvent) => void = () => {};
    registerPhase8PostApplyHandlers(pipeline, legacyStub);

    // Introspect the pipeline's internal handlers map. This is a
    // deliberate escape hatch for the pin — phase subscribers are
    // registered via `pipeline.on()` and the pipeline does not
    // expose a public list. The test file owns this cast.
    const handlers = (pipeline as unknown as {
      handlers: Record<string, Array<(e: DamageEvent) => void>>;
    }).handlers;

    const post = handlers.post_apply;
    expect(post.length).toBe(4);

    // Position 0: the legacy stub we passed in.
    expect(post[0]).toBe(legacyStub);
    // Position 1: applyEffectsPhase (Phase 7a).
    expect(post[1]).toBe(applyEffectsPhase);
    // Position 2: applyAoeRiderPhase (Phase 9 Batch 1).
    expect(post[2]).toBe(applyAoeRiderPhase);
    // Position 3: applyDeathTriggerPhase (Phase 8 F5 IP-4).
    expect(post[3]).toBe(applyDeathTriggerPhase);
  });

  it('registerPhase8PostApplyHandlers adds exactly 4 handlers to post_apply and zero to every other phase', () => {
    // CombatPipeline's constructor seeds default handlers on the
    // `calculate` / `resist` / `modify` phases (the built-in pipeline
    // machinery). The helper should NOT disturb those — it should
    // only append to `post_apply`. Test via before/after delta so
    // this pin is robust to any future pipeline seed changes.
    const pipeline = new CombatPipeline();
    const handlers = (pipeline as unknown as {
      handlers: Record<string, Array<(e: DamageEvent) => void>>;
    }).handlers;

    const before = {
      pre_damage: handlers.pre_damage.length,
      calculate: handlers.calculate.length,
      resist: handlers.resist.length,
      modify: handlers.modify.length,
      pre_apply: handlers.pre_apply.length,
      apply: handlers.apply.length,
      post_apply: handlers.post_apply.length,
    };

    const legacyStub: (e: DamageEvent) => void = () => {};
    registerPhase8PostApplyHandlers(pipeline, legacyStub);

    // post_apply gained exactly 4.
    expect(handlers.post_apply.length - before.post_apply).toBe(4);
    // Every other phase is unchanged.
    expect(handlers.pre_damage.length).toBe(before.pre_damage);
    expect(handlers.calculate.length).toBe(before.calculate);
    expect(handlers.resist.length).toBe(before.resist);
    expect(handlers.modify.length).toBe(before.modify);
    expect(handlers.pre_apply.length).toBe(before.pre_apply);
    expect(handlers.apply.length).toBe(before.apply);
  });
});

// ------------------------------------------------------------------
// F11 placeholder knockback EffectDef
// ------------------------------------------------------------------

describe('knockback EffectDef (Phase 10 Batch 3 — live onApply)', () => {
  it('is registered in the EFFECTS lookup', () => {
    expect(hasEffect('knockback')).toBe(true);
  });

  it('lookupEffect("knockback") resolves without throwing', () => {
    expect(() => lookupEffect('knockback')).not.toThrow();
  });

  it('carries a live onApply hook (not a Phase 8 placeholder anymore)', () => {
    const def = lookupEffect('knockback');
    expect(def.onApply).toBeDefined();
    // No tick/expire/stack — poise state mutation is all in onApply.
    expect(def.onTick).toBeUndefined();
    expect(def.onExpire).toBeUndefined();
    expect(def.onStack).toBeUndefined();
  });

  it('has duration 0 and is stackable (one-frame transient, per-hit accumulator)', () => {
    const def = lookupEffect('knockback');
    expect(def.duration).toBe(0);
    // stackable=true so per-hit onApply fires even when two attackers
    // land on the same target in one frame (before updateEffects
    // sweeps the duration-0 entries).
    expect(def.stackable).toBe(true);
  });

  it('stackable path — two applies in the same frame both fire onApply (per-hit poise)', () => {
    const target = {
      dead: false,
      activeEffects: [] as Array<{ def: { name: string }; remaining: number }>,
      poiseAccum: 0, knockback: 0, facing: 1,
    } as unknown as IUnit;
    const attacker = {} as unknown as IUnit;

    applyEffect(target as unknown as Parameters<typeof applyEffect>[0], 'knockback', { source: attacker, knockForce: 30 });
    applyEffect(target as unknown as Parameters<typeof applyEffect>[0], 'knockback', { source: attacker, knockForce: 30 });

    // Both onApply calls fired → poise = 30 + 30 = 60. Post-refactor,
    // knockForce flows via applyEffect opts (from ability tier data),
    // not via attacker.knockForce.
    expect(target.poiseAccum).toBe(60);
    // Two ActiveEffect entries before sweep.
    expect(target.activeEffects!.length).toBe(2);
  });

  it('updateEffects sweeps the zero-duration knockback entry on the next frame', () => {
    // The ActiveEffect entry is debug-observable for one frame; all
    // state mutation happens in onApply. A subsequent tick splices it.
    const attacker = {} as unknown as IUnit;
    const target = {
      dead: false,
      activeEffects: [] as Array<{ def: { name: string }; remaining: number }>,
      poiseAccum: 0, knockback: 0, facing: 1,
    } as unknown as IUnit;

    applyEffect(
      target as unknown as Parameters<typeof applyEffect>[0],
      'knockback',
      { source: attacker, knockForce: 50 },
    );
    expect(target.activeEffects!.length).toBe(1);

    updateEffects(
      [target as unknown as Parameters<typeof updateEffects>[0][number]],
      0.016,
    );
    expect(target.activeEffects!.length).toBe(0);
  });
});

describe('knockback.onApply — poise accumulation + stagger', () => {
  // Post-refactor (knockback UnitDef → AbilityDef): knockForce flows
  // via applyEffect opts from the ability's tier table. knockResist
  // on the target is gone — target resistance to knockback lives in
  // the ability.tiers[effectiveTier] lookup upstream. These tests
  // exercise knockback.onApply directly; the ability-tier plumbing
  // is covered by the end-to-end bash_strike tests further down.
  function makeKnockTarget(opts: {
    poiseAccum?: number;
    facing?: 1 | -1;
    knockback?: number;
  } = {}): IUnit {
    return {
      dead: false,
      activeEffects: [],
      poiseAccum: opts.poiseAccum ?? 0,
      knockback: opts.knockback ?? 0,
      facing: opts.facing ?? 1,
    } as unknown as IUnit;
  }

  const attacker = {} as unknown as IUnit;

  it('accumulates poise by knockForce per apply', () => {
    const target = makeKnockTarget();
    applyEffect(
      target as unknown as Parameters<typeof applyEffect>[0],
      'knockback',
      { source: attacker, knockForce: 50 },
    );
    expect(target.poiseAccum).toBe(50);
  });

  it('zero knockForce is a no-op (ability tier declared no knockback)', () => {
    const target = makeKnockTarget();
    applyEffect(
      target as unknown as Parameters<typeof applyEffect>[0],
      'knockback',
      { source: attacker, knockForce: 0 },
    );
    expect(target.poiseAccum).toBe(0);
    expect(target.knockback).toBe(0);
  });

  it('missing knockForce opt is a no-op (defensive — upstream should always pass)', () => {
    const target = makeKnockTarget();
    applyEffect(
      target as unknown as Parameters<typeof applyEffect>[0],
      'knockback',
      { source: attacker },
    );
    expect(target.poiseAccum).toBe(0);
  });

  it('triggers stagger when poiseAccum crosses 100', () => {
    // 60 + 60 = 120 → threshold crossed. Overflow = 20 → knockDist =
    // 142 + 20 × 0.71 = 156.2 px.
    const target = makeKnockTarget({ poiseAccum: 60, facing: 1 });
    applyEffect(
      target as unknown as Parameters<typeof applyEffect>[0],
      'knockback',
      { source: attacker, knockForce: 60 },
    );
    expect(target.poiseAccum).toBe(0); // reset on stagger
    // facing = 1 → knockback direction = -1.
    expect(target.knockback).toBeCloseTo(-156.2, 5);
  });

  it('respects facing direction (enemy faces -1 → knocks in +x)', () => {
    const target = makeKnockTarget({ poiseAccum: 50, facing: -1 });
    applyEffect(
      target as unknown as Parameters<typeof applyEffect>[0],
      'knockback',
      { source: attacker, knockForce: 60 },
    );
    // Overflow = 10 → knockDist = 142 + 10 × 0.71 = 149.1. facing=-1
    // → knockback = +149.1.
    expect(target.knockback).toBeCloseTo(149.1, 5);
  });

  it('does NOT re-apply knockback while |existing knockback| >= 10 (in-motion guard)', () => {
    // Legacy invariant — don't restart knockback mid-slide.
    const target = makeKnockTarget({ poiseAccum: 90, knockback: -50 });
    applyEffect(
      target as unknown as Parameters<typeof applyEffect>[0],
      'knockback',
      { source: attacker, knockForce: 50 },
    );
    // Poise resets (threshold crossed: 90 + 50 = 140) but knockback
    // stays at its prior in-motion value.
    expect(target.poiseAccum).toBe(0);
    expect(target.knockback).toBe(-50);
  });

  it('below threshold: no stagger, knockback unchanged', () => {
    const target = makeKnockTarget({ poiseAccum: 30 });
    applyEffect(
      target as unknown as Parameters<typeof applyEffect>[0],
      'knockback',
      { source: attacker, knockForce: 50 },
    );
    expect(target.poiseAccum).toBe(80); // 30 + 50
    expect(target.knockback).toBe(0);
  });

  it('fires stagger FX dispatcher on threshold cross', () => {
    const fired: IUnit[] = [];
    setStaggerFxDispatcher((t) => fired.push(t));

    const target = makeKnockTarget({ poiseAccum: 60 });
    applyEffect(
      target as unknown as Parameters<typeof applyEffect>[0],
      'knockback',
      { source: attacker, knockForce: 60 },
    );
    expect(fired).toHaveLength(1);
    expect(fired[0]).toBe(target);

    setStaggerFxDispatcher(() => {}); // reset for other tests
  });

  it('does NOT fire stagger FX below threshold', () => {
    const fired: IUnit[] = [];
    setStaggerFxDispatcher((t) => fired.push(t));

    const target = makeKnockTarget({ poiseAccum: 10 });
    applyEffect(
      target as unknown as Parameters<typeof applyEffect>[0],
      'knockback',
      { source: attacker, knockForce: 30 },
    );
    expect(fired).toHaveLength(0);

    setStaggerFxDispatcher(() => {});
  });
});

// ------------------------------------------------------------------
// F5 IP-1 — applyAuraDamageModify + modify-phase ordering pin
// ------------------------------------------------------------------

/**
 * Build a WorldEntity-shaped target for applyAuraDamageModify tests.
 * Satisfies `ModifierBearer` structurally: carries `components` (used
 * for the HasModifiers gate) and `modifiers` (the list the subscriber
 * reads through applyModifiers).
 */
let _targetId = 0;
function makeModifierTarget(opts: {
  components?: ComponentTag[];
  modifiers?: Modifier[];
} = {}): WorldEntity & { modifiers?: Modifier[] } {
  return {
    id: ++_targetId,
    x: 0,
    y: 0,
    dead: false,
    components: new Set(opts.components ?? ['HasHP', 'IsTargetable', 'HasModifiers']),
    modifiers: opts.modifiers,
  };
}

/**
 * Minimal DamageEvent builder for modify-phase tests. Only the fields
 * `applyAuraDamageModify` reads (`cancelled`, `target`, `finalDamage`)
 * need to be populated.
 */
function makeModifyEvent(
  target: WorldEntity,
  finalDamage: number,
  opts: { cancelled?: boolean } = {},
): DamageEvent {
  return {
    target,
    attacker: null,
    baseDamage: finalDamage,
    finalDamage,
    cancelled: opts.cancelled ?? false,
    effects: [],
  } as unknown as DamageEvent;
}

describe('phase8 F5 IP-1 — applyAuraDamageModify', () => {
  it('is a pass-through on a target with no dmg_taken modifiers (empty-mods-list short-circuit)', () => {
    const target = makeModifierTarget();
    const event = makeModifyEvent(target, 20);
    applyAuraDamageModify(event);
    expect(event.finalDamage).toBe(20);
  });

  it('is a pass-through on a target without HasModifiers component (component-gate short-circuit)', () => {
    const target = makeModifierTarget({ components: ['HasHP', 'IsTargetable'] });
    const event = makeModifyEvent(target, 25);
    applyAuraDamageModify(event);
    expect(event.finalDamage).toBe(25);
  });

  it('bails early when event.cancelled is true', () => {
    const target = makeModifierTarget({
      modifiers: [{ stat: 'dmg_taken', type: 'percent', value: -50, source: 'test' }],
    });
    const event = makeModifyEvent(target, 30, { cancelled: true });
    applyAuraDamageModify(event);
    // Cancelled event — subscriber does not touch finalDamage even
    // though a big dmg_taken modifier is present.
    expect(event.finalDamage).toBe(30);
  });

  it('applies Wardling-shape -20% dmg_taken and rounds to integer', () => {
    // Forward pin for Stage 4 Wardling migration. The aura's passive
    // tick will add `{ stat: 'dmg_taken', type: 'percent', value: -20,
    // source: 'aura:${w.id}:dmg_taken' }` to each in-range ally.
    const target = makeModifierTarget({
      modifiers: [
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'aura:1:dmg_taken' },
      ],
    });
    const event = makeModifyEvent(target, 20);
    applyAuraDamageModify(event);
    // 20 × 0.8 = 16 — integer, rounds to itself.
    expect(event.finalDamage).toBe(16);
  });

  it('stacks two -20% sources additively for -40% (multi-Wardling shape)', () => {
    // Forward pin for Stage 4 multi-Wardling cleanup. Two Wardlings
    // covering the same ally produce additive percent stacking per
    // ModifierSystem semantics; one dies, the surviving aura stays.
    const target = makeModifierTarget({
      modifiers: [
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'aura:1:dmg_taken' },
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'aura:2:dmg_taken' },
      ],
    });
    const event = makeModifyEvent(target, 20);
    applyAuraDamageModify(event);
    // 20 × (1 + (-40)/100) = 20 × 0.6 = 12.
    expect(event.finalDamage).toBe(12);
  });

  it('rounds post-variance form (preserves byte-for-byte legacy parity)', () => {
    // The legacy Wardling math is `round((base + variance) × 0.8)`, NOT
    // `round(base × 0.8 + variance × 0.8)`. These are not integer-equal
    // in all cases. This test pins the post-variance form by feeding a
    // finalDamage that has already been through applyVarianceModify.
    //
    // Concrete: base 10 + variance +1 = finalDamage 11. -20% aura:
    //   post-variance form: round(11 × 0.8) = round(8.8) = 9
    //   pre-variance form:  round(10 × 0.8 + 1 × 0.8) = round(8 + 0.8) = 9
    // Both happen to be 9 here, but the test pins that applyAuraDamageModify
    // reads finalDamage (post-variance), which is what produces the legacy
    // shape regardless of rounding edge cases.
    const target = makeModifierTarget({
      modifiers: [
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'aura:1:dmg_taken' },
      ],
    });
    const event = makeModifyEvent(target, 11);
    applyAuraDamageModify(event);
    // 11 × 0.8 = 8.8 → round → 9.
    expect(event.finalDamage).toBe(9);
  });

  it('Math.round uses half-away-from-zero / banker semantics matching legacy', () => {
    // 15 × 0.8 = 12 exact. No rounding ambiguity.
    // 17 × 0.8 = 13.6 → round → 14.
    // 13 × 0.8 = 10.4 → round → 10.
    const cases: Array<[number, number]> = [
      [15, 12],
      [17, 14],
      [13, 10],
      [1, 1],   // 1 × 0.8 = 0.8 → round → 1 (NOT a floor — aura can't reduce below rounding)
      [100, 80],
    ];
    for (const [input, expected] of cases) {
      const target = makeModifierTarget({
        modifiers: [
          { stat: 'dmg_taken', type: 'percent', value: -20, source: 'aura:1:dmg_taken' },
        ],
      });
      const event = makeModifyEvent(target, input);
      applyAuraDamageModify(event);
      expect(event.finalDamage, `input=${input}`).toBe(expected);
    }
  });
});

describe('phase8 Stage 3 Item 9.5 — applyFinalDamageFloor', () => {
  it('bails early when event.cancelled is true (does NOT clamp a cancelled event)', () => {
    // Mirrors `applyAuraDamageModify`'s bail-on-cancelled contract.
    // A cancelled event has already been short-circuited by an
    // earlier phase subscriber (e.g., applyHealPhase cancels heal
    // events before they reach modify), so the floor has no business
    // rewriting `finalDamage` on a value nobody is going to read.
    // Even if that value is 0 or negative, the cancel takes
    // precedence.
    const target = makeModifierTarget();
    const event = makeModifyEvent(target, 0, { cancelled: true });
    applyFinalDamageFloor(event);
    expect(event.finalDamage).toBe(0);
  });

  it('passes positive integers through unchanged (no spurious rewrite)', () => {
    // Every non-edge-case damage value already satisfies the floor.
    // This test pins that the subscriber doesn't accidentally
    // round, truncate, or re-assign a positive integer that's
    // already ≥ 1. Phase 6/7 byte-for-byte parity relies on this
    // transparency.
    const target = makeModifierTarget();
    const cases = [1, 2, 5, 10, 18, 50, 100, 1000];
    for (const input of cases) {
      const event = makeModifyEvent(target, input);
      applyFinalDamageFloor(event);
      expect(event.finalDamage, `input=${input}`).toBe(input);
    }
  });

  it('clamps 0 and negative finalDamage to 1', () => {
    // The load-bearing edge cases. finalDamage=0 is the
    // 5-Wardling/-100% aura output. finalDamage=-3 is the
    // hypothetical low-atk + extreme variance path (atk=0,
    // variance=-3 — doesn't occur in current production data but
    // is defensible to clamp as a safety net). Both cases must
    // produce finalDamage=1 post-floor.
    const target = makeModifierTarget();

    const zeroEvent = makeModifyEvent(target, 0);
    applyFinalDamageFloor(zeroEvent);
    expect(zeroEvent.finalDamage).toBe(1);

    const negEvent = makeModifyEvent(target, -3);
    applyFinalDamageFloor(negEvent);
    expect(negEvent.finalDamage).toBe(1);

    // A larger negative to confirm Math.max semantics, not some
    // accidental absolute-value or sign-flip.
    const bigNegEvent = makeModifyEvent(target, -100);
    applyFinalDamageFloor(bigNegEvent);
    expect(bigNegEvent.finalDamage).toBe(1);
  });

  it('clamps fractional values between 0 and 1 up to 1', () => {
    // Belt-and-suspenders: a modify-phase subscriber could in
    // principle leave a fractional finalDamage (e.g., a future
    // percent-based modifier that doesn't round, or a bug in
    // applyAuraDamageModify that skips Math.round). The floor's
    // Math.max(1, ...) produces 1 for any value in (-∞, 1], so
    // fractional values in [0, 1) get clamped to 1.
    const target = makeModifierTarget();
    const cases = [0.1, 0.5, 0.8, 0.99];
    for (const input of cases) {
      const event = makeModifyEvent(target, input);
      applyFinalDamageFloor(event);
      expect(event.finalDamage, `input=${input}`).toBe(1);
    }
  });

  it('leaves fractional values > 1 unchanged (not a rounding subscriber — rounding is aura`s job)', () => {
    // The floor is ONLY a clamp, not a rounder. If a value is
    // already > 1, the floor is a pass-through even if it's
    // fractional. This pins that floor doesn't encroach on the
    // rounding responsibility that aura already owns
    // (`applyAuraDamageModify` calls Math.round internally).
    const target = makeModifierTarget();
    const event = makeModifyEvent(target, 15.3);
    applyFinalDamageFloor(event);
    expect(event.finalDamage).toBe(15.3);
  });
});

describe('modify-phase registration-order pin', () => {
  it('registerPhase8ModifyHandlers adds exactly 3 handlers in locked order [variance/crit, aura, floor]', () => {
    // Locked order:
    //   0. applyVarianceAndCritModify — per-ability variance + crit
    //   1. applyAuraDamageModify      — defender dmg_taken gate
    //   2. applyFinalDamageFloor      — terminal clamp at 1
    //
    // Floor MUST be last. New subscribers must land BEFORE the floor.
    const pipeline = new CombatPipeline();
    const handlers = (pipeline as unknown as {
      handlers: Record<string, Array<(e: DamageEvent) => void>>;
    }).handlers;

    const before = handlers.modify.length;

    registerPhase8ModifyHandlers(pipeline);

    expect(handlers.modify.length - before).toBe(3);
    expect(handlers.modify[before]).toBe(applyVarianceAndCritModify);
    expect(handlers.modify[before + 1]).toBe(applyAuraDamageModify);
    expect(handlers.modify[before + 2]).toBe(applyFinalDamageFloor);
  });

  it('applyFinalDamageFloor is the LAST modify-phase handler (terminal invariant)', () => {
    // Explicit pin for the "floor is terminal" invariant. This test
    // isolates the "last position" assertion so a future change that
    // accidentally adds a subscriber after the floor trips this test
    // independently of the count/order pin above.
    const pipeline = new CombatPipeline();
    const handlers = (pipeline as unknown as {
      handlers: Record<string, Array<(e: DamageEvent) => void>>;
    }).handlers;

    registerPhase8ModifyHandlers(pipeline);

    const lastIdx = handlers.modify.length - 1;
    expect(handlers.modify[lastIdx]).toBe(applyFinalDamageFloor);
  });

  it('registerPhase8ModifyHandlers does NOT touch other phases', () => {
    const pipeline = new CombatPipeline();
    const handlers = (pipeline as unknown as {
      handlers: Record<string, Array<(e: DamageEvent) => void>>;
    }).handlers;

    const before = {
      pre_damage: handlers.pre_damage.length,
      calculate: handlers.calculate.length,
      resist: handlers.resist.length,
      pre_apply: handlers.pre_apply.length,
      apply: handlers.apply.length,
      post_apply: handlers.post_apply.length,
    };

    registerPhase8ModifyHandlers(pipeline);

    expect(handlers.pre_damage.length).toBe(before.pre_damage);
    expect(handlers.calculate.length).toBe(before.calculate);
    expect(handlers.resist.length).toBe(before.resist);
    expect(handlers.pre_apply.length).toBe(before.pre_apply);
    expect(handlers.apply.length).toBe(before.apply);
    expect(handlers.post_apply.length).toBe(before.post_apply);
  });

  it('damage floors at 1 via applyFinalDamageFloor — legacy invariant preserved, kill-proof prevented', () => {
    // HISTORY: this test started as a pre-Item-9.5 canary that
    // asserted `finalDamage === 0` for the -95% aura case. The
    // orchestrator flagged at Stage 3 item 9 close that the
    // 5-Wardling additive percent stacking edge case (-100%
    // dmg_taken) could produce a kill-proof target via
    // Math.round(0.05) = 0. Stage 3 Item 9.5 added
    // `applyFinalDamageFloor` as the terminal modify-phase
    // subscriber — `Math.max(1, finalDamage)` — and this test was
    // flipped from asserting 0 to asserting 1 to pin the new
    // invariant.
    //
    // The test now runs the FULL modify chain in registered order
    // (aura → floor), mirroring what production does. The aura step
    // produces 0; the floor step clamps to 1. If a future refactor
    // moves aura to run after floor, OR drops the floor subscriber
    // entirely, OR registers a new subscriber after the floor that
    // produces sub-1 values, this test fails.
    const target = makeModifierTarget({
      modifiers: [
        { stat: 'dmg_taken', type: 'percent', value: -95, source: 'test:hypothetical' },
      ],
    });
    const event = makeModifyEvent(target, 1);
    // Run the modify chain in registered order.
    applyAuraDamageModify(event);
    // 1 × 0.05 = 0.05 → Math.round(0.05) = 0. Pre-floor state.
    expect(event.finalDamage).toBe(0);
    applyFinalDamageFloor(event);
    // Floor clamps to 1 — every successful hit deals ≥ 1 damage.
    expect(event.finalDamage).toBe(1);
  });

  it('variance/crit-then-aura ordering: aura scales post-variance finalDamage', () => {
    // Integration test: variance/crit runs FIRST, then aura scales the
    // result. With a plain ability (no variancePct/critChance fields)
    // the variance subscriber only rounds; the aura subscriber then
    // reduces. Pins that variance/crit lands BEFORE aura — swapping
    // the order would change the arithmetic for any crit-carrying
    // ability under a Wardling aura.
    const target = makeModifierTarget({
      modifiers: [
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'aura:1:dmg_taken' },
      ],
    });

    // Simulate a calculate-phase output: base 11 (plain, no RNG).
    const event = makeModifyEvent(target, 11);
    event.ability = { name: 'plain', category: 'damage', tiers: { normal: { dmgMult: 1.0 } } } as import('../../src/types').AbilityDef;
    event.effectiveTier = 'normal';

    applyVarianceAndCritModify(event);
    expect(event.finalDamage).toBe(11); // pass-through (no opt-in) + round + floor
    applyAuraDamageModify(event);
    expect(event.finalDamage).toBe(9);  // round(11 × 0.8)
    applyFinalDamageFloor(event);
    expect(event.finalDamage).toBe(9);  // 9 ≥ 1, floor is a no-op here
  });

  it('full modify chain clamps to 1 when the aura reduction crosses the floor', () => {
    // Chain: base 2 → variance/crit pass-through → aura -100% → 0 →
    // floor → 1. Documents the 3-subscriber flow for the kill-proof
    // edge case that motivated the floor subscriber.
    const target = makeModifierTarget({
      modifiers: [
        { stat: 'dmg_taken', type: 'percent', value: -50, source: 'test:aura1' },
        { stat: 'dmg_taken', type: 'percent', value: -50, source: 'test:aura2' },
      ],
    });

    const event = makeModifyEvent(target, 2);
    event.ability = { name: 'plain', category: 'damage', tiers: { normal: { dmgMult: 1.0 } } } as import('../../src/types').AbilityDef;
    event.effectiveTier = 'normal';

    applyVarianceAndCritModify(event);
    expect(event.finalDamage).toBe(2);
    applyAuraDamageModify(event);
    expect(event.finalDamage).toBe(0);  // round(2 × 0) = 0
    applyFinalDamageFloor(event);
    expect(event.finalDamage).toBe(1);  // floor restores the damage ≥ 1 invariant
  });
});

// ------------------------------------------------------------------
// Stage 3 item 9 — Legionnaire migration parity
// ------------------------------------------------------------------

/** Deterministic baseline — `max(1, round(atk × tierMult))`. */
function deterministicDmg(atk: number, tierMult: number = 1): number {
  return Math.max(1, Math.round(atk * tierMult));
}

let _migratedHitId = 0;

/**
 * Minimal migrated-path simulator for migration parity tests. Fresh
 * pipeline with real modify-phase subscribers (variance/crit + aura
 * + floor), queues the ability, drains, captures finalDamage at the
 * apply phase before it hits the (absent) legacy apply body.
 *
 * Takes a fully-formed attacker fixture so the test can verify the
 * IP-2 calculate-phase gate passes through (attacker has
 * `HasModifiers` component with empty modifiers list, just like a
 * production Unit).
 */
function simulateMigratedHit(
  abilityName: string,
  atk: number,
  targetResistance?: Partial<Record<DamageType, ResistanceTier>>,
): number {
  const pipeline = new CombatPipeline();
  registerPhase8ModifyHandlers(pipeline);

  let captured = 0;
  pipeline.on('apply', (e: DamageEvent) => {
    captured = e.finalDamage;
    e.cancelled = true; // skip post_apply
  });

  const attacker: WorldEntity & {
    atk: number;
    modifiers?: Modifier[];
  } = {
    id: ++_migratedHitId,
    x: 0,
    y: 0,
    dead: false,
    components: new Set(['HasHP', 'HasAI', 'IsTargetable', 'HasModifiers']),
    atk,
  };

  const target: WorldEntity & {
    resistance?: Partial<Record<DamageType, ResistanceTier>>;
    modifiers?: Modifier[];
  } = {
    id: ++_migratedHitId,
    x: 0,
    y: 0,
    dead: false,
    components: new Set(['HasHP', 'IsTargetable', 'HasModifiers']),
    resistance: targetResistance,
  };

  pipeline.queueAbility(attacker, target, abilityName);
  pipeline.resolveFrame();

  return captured;
}

describe('phase8 Stage 3 item 9 — Legionnaire migration', () => {
  it('legionnaireDef declares defaultAbility = "bash_strike" (F11 Option 1 half-migration class)', () => {
    const def = UNIT_DEFS.legionnaire;
    expect(def).toBeDefined();
    expect(def.defaultAbility).toBe('bash_strike');
  });

  it('legionnaire.defaultAbility carries knockForce > 0 on its tier table (post-knockback-refactor decision-tree signal)', () => {
    // Pins the decision-tree predicate. Pre-refactor the signal lived
    // on def.knockForce; the knockback refactor relocated it to
    // AbilityDef.tiers.*.knockForce. If a future change removes
    // knockForce from bash_strike's tier data, the F11 half-migration
    // rationale dissolves and the choice should be re-litigated.
    const def = UNIT_DEFS.legionnaire;
    const ability = lookupAbility(def.defaultAbility!);
    expect(ability.tiers?.normal?.knockForce).toBeDefined();
    expect(ability.tiers?.normal?.knockForce ?? 0).toBeGreaterThan(0);
  });

  it('migrated bash_strike finalDamage = max(1, round(legionnaire.atk × 1.0)) against resistance-neutral target', () => {
    // Parity target selection is load-bearing: grub has no resistance
    // entry, so bash_strike (blunt) resolves at normal tier (1.0×).
    const def = UNIT_DEFS.legionnaire;
    const atk = def.atk;
    const actual = simulateMigratedHit('bash_strike', atk);
    expect(actual).toBe(deterministicDmg(atk));
  });

  it('resistance-neutral target (no blunt entry) resolves at normal tier × 1.0', () => {
    // Pins that bash_strike's tier table produces dmgMult=1.0 at the
    // normal tier. If `linearDamageTiers()` drifts, this fails loudly.
    const result = simulateMigratedHit('bash_strike', 18, {});
    expect(result).toBe(18);
  });

  it('blunt-strong target shifts the tier (Phase 2 resistance milestone)', () => {
    // blunt:strong tier multiplier = 0.85. 18 × 0.85 = 15.3 →
    // variance/crit subscriber rounds → 15.
    const result = simulateMigratedHit('bash_strike', 18, { blunt: 'strong' });
    expect(result).toBe(15);
  });

  it('sharp-strong target does NOT shift bash_strike tier (wrong resistance axis)', () => {
    // bash_strike is blunt; sharp resistance on the target doesn't
    // apply to blunt damage → normal tier × 1.0 → 18.
    const result = simulateMigratedHit('bash_strike', 18, { sharp: 'strong' });
    expect(result).toBe(18);
  });
});

// ------------------------------------------------------------------
// Stage 3 item 10 — Bashguard migration parity + F11 bookend
// ------------------------------------------------------------------

describe('phase8 Stage 3 item 10 — Bashguard migration', () => {
  it('bashguardDef declares defaultAbility = "bash_strike" (F11 Option 1 half-migration class)', () => {
    const def = UNIT_DEFS.bashguard;
    expect(def).toBeDefined();
    expect(def.defaultAbility).toBe('bash_strike');
  });

  it('bashguard.defaultAbility carries knockForce = 100 on its tier table (post-knockback-refactor)', () => {
    // Pins the decision-tree predicate. The knockback refactor
    // homogenized bash_strike's knockForce to 100 (Bashguard's
    // canonical high-knockForce value, with Legionnaire's 20
    // dissolved into the homogenized value). If a future balance pass
    // zeros this out, the F11 rationale dissolves and the whole
    // decisions-doc F11 section needs a re-read.
    const def = UNIT_DEFS.bashguard;
    const ability = lookupAbility(def.defaultAbility!);
    expect(ability.tiers?.normal?.knockForce).toBeDefined();
    expect(ability.tiers?.normal?.knockForce ?? 0).toBeGreaterThan(0);
    // Homogenized flat 100 across all 7 tiers (preserves pre-refactor
    // flat-attacker-stat parity; per-tier scaling is a future pass).
    expect(ability.tiers?.normal?.knockForce).toBe(100);
  });

  it('migrated bash_strike finalDamage = max(1, round(bashguard.atk × 1.0)) against resistance-neutral target', () => {
    // bashguard.atk=50 → 50 against a resistance-neutral target.
    const def = UNIT_DEFS.bashguard;
    const atk = def.atk;
    const actual = simulateMigratedHit('bash_strike', atk);
    expect(actual).toBe(deterministicDmg(atk));
  });

  it('resistance-neutral target (no blunt entry) resolves at normal tier × 1.0 → 50', () => {
    // Anchors the normal-tier multiplier. If linearDamageTiers() drifts,
    // this test fails loudly with the concrete expected value.
    const result = simulateMigratedHit('bash_strike', 50, {});
    expect(result).toBe(50);
  });

  it('blunt-strong target — bash_strike × blunt-strong produces round(50 × 0.85) = 43', () => {
    // blunt:strong tier multiplier = 0.85. 50 × 0.85 = 42.5 →
    // JS Math.round rounds half toward +∞ → 43.
    const result = simulateMigratedHit('bash_strike', 50, { blunt: 'strong' });
    expect(result).toBe(43);
  });

  it('sharp-strong target does NOT shift bash_strike tier (wrong resistance axis)', () => {
    const result = simulateMigratedHit('bash_strike', 50, { sharp: 'strong' });
    expect(result).toBe(50);
  });

  it('bash_strike shares linearDamageTiers with jaw_strike — normal tier parity is invariant across ability choice', () => {
    // Cross-ability parity pin. jaw_strike and bash_strike are both
    // built on `linearDamageTiers()`, so at the normal tier (any
    // resistance-neutral target) they MUST produce identical damage
    // for identical atk + variance. This test locks that invariant
    // — if a future change gives bash_strike its own tier table or
    // splits linearDamageTiers, the divergence shows up here first.
    const jawResult = simulateMigratedHit('jaw_strike', 50);
    const bashResult = simulateMigratedHit('bash_strike', 50);
    expect(jawResult).toBe(bashResult);
    expect(jawResult).toBe(50);
  });
});

// ------------------------------------------------------------------
// Stage 4 item 11 — Ravager migration (IP-3 + IP-5 selfModifier)
// ------------------------------------------------------------------

describe('phase8 Stage 4 item 11 — Ravager migration', () => {
  it('ravagerDef declares defaultAbility = "jaw_strike" (sharp melee offensive)', () => {
    const def = UNIT_DEFS.ravager;
    expect(def).toBeDefined();
    expect(def.defaultAbility).toBe('jaw_strike');
  });

  it('ravagerDef declares the F5 IP-3 + IP-5 selfModifier config shape', () => {
    // Pins the exact shape of the selfModifier config so a future
    // change that renames `stat`, flips `type`, tweaks `value`, or
    // changes the `condition` key trips this test first. All four
    // fields are load-bearing for the Ravager rage behavior.
    const def = UNIT_DEFS.ravager;
    expect(findPassive(def, 'self_modifier')).toBeDefined();
    expect(findPassive(def, 'self_modifier')).toEqual({
      kind: 'self_modifier',
      stat: 'atkRate',
      type: 'percent',
      value: 50,
      condition: 'hp_below_half',
    });
  });

  it('offensive parity: migrated jaw_strike finalDamage = max(1, round(ravager.atk × 1.0))', () => {
    // ravager.atk = 60, deterministic at normal tier.
    const def = UNIT_DEFS.ravager;
    const atk = def.atk;
    const actual = simulateMigratedHit('jaw_strike', atk);
    expect(actual).toBe(deterministicDmg(atk));
  });

  it('passive tick loop adds the rage modifier when HP drops below 50%', () => {
    // Integration test — exercises the IP-5 self-modifier dispatch
    // branch via a minimal CombatSystem.updatePassives call. We can't
    // instantiate a full CombatSystem without Phaser, so we import
    // the helpers directly and replicate the dispatch body here for
    // the test. This mirrors the Phase 4/6/7/8 convention of
    // testing pipeline logic via pure helpers.
    //
    // The body below is a copy of the real updatePassives
    // self-modifier dispatch branch — if the production code and
    // this test drift, orchestrator re-spec. Until then, the pin
    // is "the real code produces the same effect as this simulation
    // on the same fixture" and we assert the fixture's modifier
    // list transitions.
    const u: IUnit = {
      id: 99,
      hp: 100,
      maxHp: 160,
      atkRate: 1.25,
      passives: UNIT_DEFS.ravager.passives,
      modifiers: [],
      components: new Set(['HasHP', 'HasAI', 'IsTargetable', 'HasModifiers']),
    } as unknown as IUnit;

    // State 1: healthy (hp 100/160 = 62.5%, above threshold).
    runSelfModifierDispatch([u]);
    expect(u.modifiers).toHaveLength(0);
    expect(applyModifiers(u, u.atkRate, 'atkRate')).toBeCloseTo(1.25, 5);

    // State 2: wounded below threshold (hp 80/160 = 50%, inclusive).
    u.hp = 80;
    runSelfModifierDispatch([u]);
    expect(u.modifiers).toHaveLength(1);
    expect(u.modifiers![0].source).toBe('self:99:atkRate');
    expect(applyModifiers(u, u.atkRate, 'atkRate')).toBeCloseTo(1.25 * 1.5, 5);

    // State 3: second dispatch with same state (idempotent — must not
    // add a duplicate modifier).
    runSelfModifierDispatch([u]);
    expect(u.modifiers).toHaveLength(1);

    // State 4: healed above threshold (hp 100/160 = 62.5%).
    u.hp = 100;
    runSelfModifierDispatch([u]);
    expect(u.modifiers).toHaveLength(0);
    expect(applyModifiers(u, u.atkRate, 'atkRate')).toBeCloseTo(1.25, 5);
  });

  it('passive tick loop no-ops on units without selfModifier config (regression guard)', () => {
    // A non-Ravager unit (e.g., a plain grub) with no selfModifier
    // must not have any modifier added/removed by the dispatch.
    const u: IUnit = {
      id: 100,
      hp: 50,
      maxHp: 100,
      atkRate: 1.1,
      passives: undefined,
      modifiers: [],
      components: new Set(['HasHP', 'HasAI', 'IsTargetable', 'HasModifiers']),
    } as unknown as IUnit;

    runSelfModifierDispatch([u]);
    expect(u.modifiers).toHaveLength(0);
  });

  it('boundary case — hp exactly 50% of maxHp applies the modifier (inclusive)', () => {
    // The legacy `hpFrac <= 0.5` contract was inclusive. Pins that
    // the migrated `hp_below_half` predicate preserves the boundary.
    const u: IUnit = {
      id: 101,
      hp: 80, // exactly half of 160 (Ravager's real maxHp)
      maxHp: 160,
      atkRate: 1.25,
      passives: UNIT_DEFS.ravager.passives,
      modifiers: [],
      components: new Set(['HasHP', 'HasAI', 'IsTargetable', 'HasModifiers']),
    } as unknown as IUnit;

    runSelfModifierDispatch([u]);
    expect(u.modifiers).toHaveLength(1);
  });
});

// Local copy of the updatePassives self-modifier dispatch body for
// pure-function testing. Mirrors the real CombatSystem.updatePassives
// loop at the self-modifier branch exactly. If the real dispatch
// drifts from this simulation, the "passive tick loop adds the rage
// modifier" test's fixture-level assertions will still pass but
// production behavior may diverge — that's a stop-and-report
// signal, not a test failure.
function runSelfModifierDispatch(alive: IUnit[]): void {
  for (const u of alive) {
    const selfMod = findPassive(u, 'self_modifier');
    if (!selfMod) continue;
    const predicate = lookupPredicate(selfMod.condition);
    if (!predicate) continue;
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
}

// ------------------------------------------------------------------
// Stage 4 item 12 — Wardling migration (IP-1 + IP-5 walked-list aura)
// ------------------------------------------------------------------

/**
 * Local copy of the `updatePassives` aura dispatch branch body for
 * pure-function testing. Same duplication caveat as
 * `runSelfModifierDispatch` — if the real dispatch drifts, the
 * integration tests still pass but production behavior may
 * diverge. Flagged for Phase 9 backlog item #9 (extract
 * updatePassives branches into testable helpers).
 *
 * Takes BOTH `units` (full list including dead owners) and `alive`
 * (pre-filtered subset) matching the production signature.
 */
function runAuraDispatch(units: IUnit[], alive: IUnit[]): void {
  for (const u of units) {
    const aura = findPassive(u, 'aura_modifier');
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
}

/**
 * Build a Wardling-or-ally-shaped fixture for aura dispatch tests.
 * Carries the minimum fields the aura loop reads: id, x, y, unitW,
 * side, dead, modifiers, components, and optionally auraModifier
 * for aura-owner fixtures.
 */
let _auraFixId = 0;
function makeAuraFixture(opts: {
  x: number;
  side: 'player' | 'enemy';
  dead?: boolean;
  auraModifier?: Extract<PassiveDef, { kind: 'aura_modifier' }>;
  modifiers?: Modifier[];
}): IUnit {
  return {
    id: ++_auraFixId,
    x: opts.x,
    y: 0,
    unitW: 20, // canonical fixture width for center-math
    unitH: 20,
    side: opts.side,
    dead: opts.dead ?? false,
    passives: opts.auraModifier ? [opts.auraModifier] : undefined,
    modifiers: opts.modifiers ?? [],
    components: new Set(['HasHP', 'HasAI', 'IsTargetable', 'HasModifiers']),
    _auraCleanedUp: false,
  } as unknown as IUnit;
}

describe('phase8 Stage 4 item 12 — Wardling migration', () => {
  it('wardlingDef declares defaultAbility = "jaw_strike" (offensive)', () => {
    const def = UNIT_DEFS.wardling;
    expect(def).toBeDefined();
    expect(def.defaultAbility).toBe('jaw_strike');
  });

  it('wardlingDef declares the F5 IP-1 + IP-5 auraModifier config shape', () => {
    const def = UNIT_DEFS.wardling;
    expect(findPassive(def, 'aura_modifier')).toBeDefined();
    expect(findPassive(def, 'aura_modifier')).toEqual({
      kind: 'aura_modifier',
      stat: 'dmg_taken',
      type: 'percent',
      value: -20,
      range: 114,
    });
  });

  it('wardlingDef does NOT carry selfModifier (aura units use auraModifier)', () => {
    const def = UNIT_DEFS.wardling;
    expect(findPassive(def, 'self_modifier')).toBeUndefined();
  });

  it('offensive parity: migrated jaw_strike finalDamage = max(1, round(wardling.atk × 1.0))', () => {
    // Wardling's offensive is weak melee (atk=14), deterministic.
    const def = UNIT_DEFS.wardling;
    const atk = def.atk;
    const actual = simulateMigratedHit('jaw_strike', atk);
    expect(actual).toBe(deterministicDmg(atk));
  });
});

describe('phase8 Stage 4 item 12 — aura dispatch integration', () => {
  it('in-range same-side ally gets the aura modifier (Walk 1 enter)', () => {
    const wardling = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 150, side: 'player' });
    // Center-to-center distance: (150+10) - (100+10) = 50 < 114 → in range.

    runAuraDispatch([wardling, ally], [wardling, ally]);

    expect(ally.modifiers).toHaveLength(1);
    expect(ally.modifiers![0].source).toBe(`aura:${wardling.id}:dmg_taken`);
    expect(ally.modifiers![0].stat).toBe('dmg_taken');
    expect(ally.modifiers![0].value).toBe(-20);
  });

  it('out-of-range same-side ally does NOT get the modifier', () => {
    const wardling = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 300, side: 'player' });
    // Center-to-center: (300+10) - (100+10) = 200 >= 114 → out of range.

    runAuraDispatch([wardling, ally], [wardling, ally]);

    expect(ally.modifiers).toHaveLength(0);
  });

  it('enemy-side ally at in-range distance does NOT get the modifier', () => {
    const wardling = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const enemy = makeAuraFixture({ x: 150, side: 'enemy' });

    runAuraDispatch([wardling, enemy], [wardling, enemy]);

    expect(enemy.modifiers).toHaveLength(0);
  });

  it('Wardling does NOT self-buff its own dmg_taken (owner === ally guard)', () => {
    const wardling = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });

    runAuraDispatch([wardling], [wardling]);

    expect(wardling.modifiers).toHaveLength(0);
  });

  it('ally leaving range gets the modifier removed (Walk 2 exit)', () => {
    const wardling = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 150, side: 'player' });

    // Frame 1: ally in range → modifier added
    runAuraDispatch([wardling, ally], [wardling, ally]);
    expect(ally.modifiers).toHaveLength(1);

    // Frame 2: ally moves out of range
    ally.x = 300;
    runAuraDispatch([wardling, ally], [wardling, ally]);
    expect(ally.modifiers).toHaveLength(0);
  });

  it('steady-state stable ally produces NO modifier churn over 60 frames', () => {
    // The walked-list no-churn pin from the IP-5 re-lock. A
    // stationary ally in range should carry exactly 1 modifier
    // after 60 frames, not 60. If `hasModifier` check fails to
    // short-circuit Walk 1, this test catches the bug.
    const wardling = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 150, side: 'player' });

    for (let frame = 0; frame < 60; frame++) {
      runAuraDispatch([wardling, ally], [wardling, ally]);
    }

    expect(ally.modifiers).toHaveLength(1);
    expect(ally.modifiers![0].source).toBe(`aura:${wardling.id}:dmg_taken`);
  });

  it('boundary: ally at exactly 114px is OUT of range (legacy `<` semantics preserved)', () => {
    // Pins the distance inclusivity fix. Legacy `Math.abs(...) < 114`
    // excluded exactly-114-distance allies. The migrated dispatch
    // uses `distance >= aura.range` which produces the same
    // exclusion behavior. If a future refactor flips to `>`, this
    // test catches the 1-point drift on the boundary.
    const wardling = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    // Center-to-center distance exactly 114: (214+10) - (100+10) = 114
    const ally = makeAuraFixture({ x: 214, side: 'player' });

    runAuraDispatch([wardling, ally], [wardling, ally]);

    expect(ally.modifiers).toHaveLength(0);
  });

  it('boundary: ally at 113px is IN range (just inside the legacy boundary)', () => {
    const wardling = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 213, side: 'player' });

    runAuraDispatch([wardling, ally], [wardling, ally]);

    expect(ally.modifiers).toHaveLength(1);
  });
});

describe('phase8 Stage 4 item 12 — aura death cleanup', () => {
  it('Wardling death triggers final cleanup pass and sets _auraCleanedUp latch', () => {
    const wardling = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 150, side: 'player' });

    // Frame 1: modifier applied to ally
    runAuraDispatch([wardling, ally], [wardling, ally]);
    expect(ally.modifiers).toHaveLength(1);
    expect(wardling._auraCleanedUp).toBe(false);

    // Frame 2: wardling dies. The `alive` list no longer contains
    // wardling, but `units` still does — the aura branch iterates
    // `units` to catch dead owners for cleanup.
    wardling.dead = true;
    runAuraDispatch([wardling, ally], [ally]);

    expect(ally.modifiers).toHaveLength(0);
    expect(wardling._auraCleanedUp).toBe(true);
  });

  it('second updatePassives call on dead Wardling is idempotent (latch prevents re-entry)', () => {
    const wardling = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 150, side: 'player' });

    runAuraDispatch([wardling, ally], [wardling, ally]);
    wardling.dead = true;
    runAuraDispatch([wardling, ally], [ally]);
    expect(ally.modifiers).toHaveLength(0);
    expect(wardling._auraCleanedUp).toBe(true);

    // Mutate the ally to add a fake modifier with a different
    // source tag. If the dead Wardling's cleanup runs again, it
    // would walk the ally and try to remove a non-matching tag
    // (no-op by source mismatch). We verify the latch short-circuit
    // by checking that the cleanup loop does NOT re-enter the
    // allies scan — the latch check is at the TOP of the aura
    // branch's dead-owner path.
    addModifier(ally, {
      stat: 'dmg_taken',
      type: 'percent',
      value: -10,
      source: 'test:other:dmg_taken',
    });
    expect(ally.modifiers).toHaveLength(1);

    runAuraDispatch([wardling, ally], [ally]);

    // Ally's unrelated modifier should be untouched.
    expect(ally.modifiers).toHaveLength(1);
    expect(ally.modifiers![0].source).toBe('test:other:dmg_taken');
  });
});

describe('phase8 Stage 4 item 12 — multi-Wardling additive stacking', () => {
  it('two Wardlings covering the same ally produce two distinct source-tagged modifiers', () => {
    const wardling1 = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const wardling2 = makeAuraFixture({
      x: 200,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    // Ally at x=150 — within 114 of both wardlings (dist ~50 and ~50).
    const ally = makeAuraFixture({ x: 150, side: 'player' });
    const units = [wardling1, wardling2, ally];

    runAuraDispatch(units, units);

    // Ally should carry TWO distinct modifiers, one from each Wardling.
    expect(ally.modifiers).toHaveLength(2);
    const sources = ally.modifiers!.map((m) => m.source).sort();
    expect(sources).toEqual([
      `aura:${wardling1.id}:dmg_taken`,
      `aura:${wardling2.id}:dmg_taken`,
    ]);
  });

  it('applyModifiers folds two stacked -20% modifiers into an additive -40%', () => {
    // Integration with the IP-1 gate: `applyModifiers(target, 20, 'dmg_taken')`
    // should return `20 × (1 + (-40)/100) = 20 × 0.6 = 12`.
    // This is the load-bearing test for the multiplicative →
    // additive stacking divergence from legacy Wardling behavior.
    const wardling1 = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const wardling2 = makeAuraFixture({
      x: 200,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 150, side: 'player' });
    const units = [wardling1, wardling2, ally];

    runAuraDispatch(units, units);

    const effective = applyModifiers(ally, 20, 'dmg_taken');
    expect(effective).toBeCloseTo(12, 5);
    // Legacy would have been 20 × 0.8 × 0.8 = 12.8 → ceil → 13.
    // Migrated is 20 × 0.6 = 12 → round → 12. 1-point drift is
    // intentional per the Phase 8 IP-1 + Phase 5 ModifierSystem
    // design locks.
  });

  it('one Wardling of a pair dying removes only its own source tag (multi-source cleanup)', () => {
    const wardling1 = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const wardling2 = makeAuraFixture({
      x: 200,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.wardling, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 150, side: 'player' });
    const units = [wardling1, wardling2, ally];

    runAuraDispatch(units, units);
    expect(ally.modifiers).toHaveLength(2);

    // Wardling 1 dies — its cleanup should remove ONLY its own tag.
    wardling1.dead = true;
    runAuraDispatch(units, [wardling2, ally]);

    expect(ally.modifiers).toHaveLength(1);
    expect(ally.modifiers![0].source).toBe(`aura:${wardling2.id}:dmg_taken`);
    // Wardling 2's rally persists — effective stacking drops from
    // -40% to -20%, NOT to baseline 0%. Load-bearing for Stage 4
    // item 13 Centurion multi-source cleanup scenario.
  });
});

// ------------------------------------------------------------------
// Item 11 follow-up — selfModifier.condition validation across UNIT_DEFS
// ------------------------------------------------------------------

describe('phase8 Stage 4 item 11 follow-up — selfModifier.condition registration', () => {
  it('every selfModifier.condition in UNIT_DEFS references a registered predicate', () => {
    // Per the orchestrator's Stage 4 item 11 follow-up: since
    // `lookupPredicate` returns undefined (not throws) on unknown
    // keys, a typo in a unit's `selfModifier.condition` would
    // silently no-op in production. This test walks every UNIT_DEFS
    // entry with a selfModifier and asserts the condition resolves
    // to a function, catching typos at test time.
    for (const [name, def] of Object.entries(UNIT_DEFS)) {
      const selfMod = findPassive(def, 'self_modifier');
      if (!selfMod) continue;
      const predicate = lookupPredicate(selfMod.condition);
      expect(
        predicate,
        `${name} references unknown predicate: ${selfMod.condition}`,
      ).toBeDefined();
    }
  });
});

// ------------------------------------------------------------------
// Stage 4 item 13 — Centurion migration (second aura dispatch consumer)
// ------------------------------------------------------------------

describe('phase8 Stage 4 item 13 — Centurion migration', () => {
  it('centurionDef declares defaultAbility = "jaw_strike" (offensive)', () => {
    const def = UNIT_DEFS.centurion;
    expect(def).toBeDefined();
    expect(def.defaultAbility).toBe('jaw_strike');
  });

  it('centurionDef declares the F5 IP-2 + IP-5 auraModifier config shape', () => {
    // Shape pin — load-bearing for the IP-2 non-short-circuit path
    // in production. Matches the decisions doc `rally_aura` stats
    // (stat: 'atk', type: 'percent', value: 20, range: 100). NOTE:
    // range tracks the uncommitted centurion balance scratch (80 → 100).
    // If that balance change is reverted, set this back to 80.
    const def = UNIT_DEFS.centurion;
    expect(findPassive(def, 'aura_modifier')).toBeDefined();
    expect(findPassive(def, 'aura_modifier')).toEqual({
      kind: 'aura_modifier',
      stat: 'atk',
      type: 'percent',
      value: 20,
      range: 100,
    });
  });

  it('centurionDef does NOT carry selfModifier (aura units use auraModifier)', () => {
    const def = UNIT_DEFS.centurion;
    expect(findPassive(def, 'self_modifier')).toBeUndefined();
  });

  it('offensive parity: migrated jaw_strike finalDamage = max(1, round(centurion.atk × 1.0))', () => {
    // Centurion's offensive is plain melee (atk=26), deterministic.
    const def = UNIT_DEFS.centurion;
    const atk = def.atk;
    const actual = simulateMigratedHit('jaw_strike', atk);
    expect(actual).toBe(deterministicDmg(atk));
  });
});

describe('phase8 Stage 4 item 13 — Centurion aura dispatch integration', () => {
  it('in-range same-side ally gets the atk aura modifier via runAuraDispatch', () => {
    const centurion = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 140, side: 'player' });
    // Center-to-center distance: (140+10) - (100+10) = 40 < 80 → in range.

    runAuraDispatch([centurion, ally], [centurion, ally]);

    expect(ally.modifiers).toHaveLength(1);
    expect(ally.modifiers![0].source).toBe(`aura:${centurion.id}:atk`);
    expect(ally.modifiers![0].stat).toBe('atk');
    expect(ally.modifiers![0].value).toBe(20);
  });

  it('out-of-range ally does NOT get the atk aura (80px boundary)', () => {
    const centurion = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    // Distance: (240+10) - (100+10) = 140 >= 80 → out of range.
    const ally = makeAuraFixture({ x: 240, side: 'player' });

    runAuraDispatch([centurion, ally], [centurion, ally]);

    expect(ally.modifiers).toHaveLength(0);
  });

  it('boundary: ally at exactly the aura range is OUT (strict `distance >= range`)', () => {
    // `distance >= aura.range` is OUT (strict-less-than inclusivity).
    // Centurion aura range = 100 (tracks the uncommitted balance
    // scratch 80 → 100); ally placed at exactly 100px center-to-center.
    const centurion = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    // Center-to-center = 100: (200+10) - (100+10) = 100 → OUT.
    const ally = makeAuraFixture({ x: 200, side: 'player' });

    runAuraDispatch([centurion, ally], [centurion, ally]);

    expect(ally.modifiers).toHaveLength(0);
  });

  it('boundary: ally at 79px is IN range (just inside legacy boundary)', () => {
    const centurion = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 179, side: 'player' });

    runAuraDispatch([centurion, ally], [centurion, ally]);

    expect(ally.modifiers).toHaveLength(1);
  });

  it('applyModifiers folds the centurion rally into an attacker`s atk read', () => {
    // IP-2 non-short-circuit pin — a Centurion-buffed ally reads
    // its own atk through `applyModifiers` at `calculatePhase`,
    // and the gate returns the +20% effective value.
    const centurion = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 140, side: 'player' });

    runAuraDispatch([centurion, ally], [centurion, ally]);

    // Ally's base atk is irrelevant here — we test the stacking math.
    const effective = applyModifiers(ally, 20, 'atk');
    // 20 × (1 + 20/100) = 24.
    expect(effective).toBeCloseTo(24, 5);
  });
});

describe('phase8 Stage 4 item 13 — multi-Centurion stacking and cleanup', () => {
  it('two Centurions produce two distinct source-tagged modifiers on a shared ally', () => {
    const centurion1 = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    const centurion2 = makeAuraFixture({
      x: 160,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    // Ally at x=130 — distance from c1 is ~30, from c2 is ~30,
    // both < 80 → in both ranges.
    const ally = makeAuraFixture({ x: 130, side: 'player' });
    const units = [centurion1, centurion2, ally];

    runAuraDispatch(units, units);

    expect(ally.modifiers).toHaveLength(2);
    const sources = ally.modifiers!.map((m) => m.source).sort();
    expect(sources).toEqual([
      `aura:${centurion1.id}:atk`,
      `aura:${centurion2.id}:atk`,
    ]);
  });

  it('two stacked rally auras produce additive +40% via applyModifiers', () => {
    // Multi-source stacking — the central observation for the
    // stage4AllPassives scenario's Grunt/Mandible damage output.
    const centurion1 = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    const centurion2 = makeAuraFixture({
      x: 160,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 130, side: 'player' });
    const units = [centurion1, centurion2, ally];

    runAuraDispatch(units, units);

    const effective = applyModifiers(ally, 20, 'atk');
    // 20 × (1 + 40/100) = 20 × 1.4 = 28.
    expect(effective).toBeCloseTo(28, 5);
  });

  it('one Centurion of a pair dying removes only its own source tag (multi-source cleanup)', () => {
    // The load-bearing stage4AllPassives observation — kill one
    // Centurion mid-battle, ally's atk drops to +20% (not baseline
    // 0%) because the survivor's aura persists. Direct parallel to
    // Item 12's multi-Wardling single-death cleanup test.
    const centurion1 = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    const centurion2 = makeAuraFixture({
      x: 160,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 130, side: 'player' });
    const units = [centurion1, centurion2, ally];

    runAuraDispatch(units, units);
    expect(ally.modifiers).toHaveLength(2);

    // Centurion 1 dies — cleanup pass removes ONLY its own tag.
    centurion1.dead = true;
    runAuraDispatch(units, [centurion2, ally]);

    expect(ally.modifiers).toHaveLength(1);
    expect(ally.modifiers![0].source).toBe(`aura:${centurion2.id}:atk`);

    // Effective stacking drops from +40% to +20%, NOT to 0%.
    const effective = applyModifiers(ally, 20, 'atk');
    expect(effective).toBeCloseTo(24, 5); // 20 × 1.2
  });

  it('both Centurions dying removes both tags — ally returns to baseline', () => {
    const centurion1 = makeAuraFixture({
      x: 100,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    const centurion2 = makeAuraFixture({
      x: 160,
      side: 'player',
      auraModifier: findPassive(UNIT_DEFS.centurion, 'aura_modifier'),
    });
    const ally = makeAuraFixture({ x: 130, side: 'player' });
    const units = [centurion1, centurion2, ally];

    runAuraDispatch(units, units);
    centurion1.dead = true;
    runAuraDispatch(units, [centurion2, ally]);
    centurion2.dead = true;
    runAuraDispatch(units, [ally]);

    expect(ally.modifiers).toHaveLength(0);

    const effective = applyModifiers(ally, 20, 'atk');
    expect(effective).toBe(20); // unchanged baseline
  });
});

describe('phase8 Stage 4 item 13 — full pipeline integration (IP-2 non-short-circuit end-to-end)', () => {
  /**
   * First test where the IP-2 non-short-circuit path activates via
   * a real production dispatch + real `pipeline.queueAbility` →
   * `resolveFrame` drain. Task 1 tested the same path with a
   * synthetic attacker carrying a hand-crafted modifier; Item 13
   * tests the production-assembly end-to-end:
   *   1. Run the aura dispatch to add the Centurion's atk modifier
   *      to a Centurion-buffed ally.
   *   2. Queue the ally's attack via `pipeline.queueAbility`.
   *   3. Drive the drain; `calculatePhase` reads
   *      `applyModifiers(attacker, attacker.atk, 'atk')` which now
   *      returns the +20% buffed value.
   *   4. Assert `event.baseDamage === attacker.atk × 1.2 × 1.0`
   *      (normal tier) and `event.finalDamage` ===
   *      `Math.round(baseDamage)` through the modify chain.
   */
  function simulateBuffedAttack(
    attackerAtk: number,
    attackerMods: Modifier[],
  ): { baseDamage: number; finalDamage: number } {
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    let captured = { baseDamage: 0, finalDamage: 0 };
    pipeline.on('apply', (e: DamageEvent) => {
      captured = { baseDamage: e.baseDamage, finalDamage: e.finalDamage };
      e.cancelled = true;
    });

    const attacker: WorldEntity & { atk: number; modifiers?: Modifier[] } = {
      id: 1000,
      x: 0,
      y: 0,
      dead: false,
      components: new Set(['HasHP', 'HasAI', 'IsTargetable', 'HasModifiers']),
      atk: attackerAtk,
      modifiers: attackerMods,
    };
    const target: WorldEntity & { modifiers?: Modifier[] } = {
      id: 1001,
      x: 0,
      y: 0,
      dead: false,
      components: new Set(['HasHP', 'IsTargetable', 'HasModifiers']),
      modifiers: [],
    };

    pipeline.queueAbility(attacker, target, 'jaw_strike');
    pipeline.resolveFrame();

    return captured;
  }

  it('single-Centurion-buffed attacker deals round(atk × 1.2) via IP-2 calculate gate', () => {
    // attacker.atk = 20, +20% rally → calculatePhase produces 24.
    // Variance no-op → aura no-op → floor no-op. finalDamage = 24.
    const result = simulateBuffedAttack(20, [
      { stat: 'atk', type: 'percent', value: 20, source: 'aura:1:atk' },
    ]);
    expect(result.baseDamage).toBeCloseTo(24, 5);
    expect(result.finalDamage).toBe(24);
  });

  it('multi-Centurion-buffed attacker deals round(atk × 1.4) via additive stacking', () => {
    const result = simulateBuffedAttack(20, [
      { stat: 'atk', type: 'percent', value: 20, source: 'aura:1:atk' },
      { stat: 'atk', type: 'percent', value: 20, source: 'aura:2:atk' },
    ]);
    expect(result.baseDamage).toBeCloseTo(28, 5);
    expect(result.finalDamage).toBe(28);
  });

  it('composed IP-1 + IP-2: Centurion-buffed attacker × Wardling-protected target → round(atk × 0.96)', () => {
    // First production integration test where BOTH IP-1 and IP-2
    // non-short-circuit paths fire in the same event drain. Task 1
    // tested the same composition with direct modifier injection;
    // Item 13 is the first time it happens end-to-end through
    // `queueAbility` → `resolveFrame` with real dispatch output.
    //
    //   calculate:
    //     casterBase = 20 × 1.2 = 24 (IP-2 +20% atk)
    //     base       = 24 × 1.0 = 24 (normal tier)
    //     baseDamage = 24
    //     finalDamage = 24
    //   variance → no override → 24
    //   aura: applyModifiers(target, 24, 'dmg_taken') = 24 × 0.8 = 19.2
    //         Math.round(19.2) = 19
    //   floor: max(1, 19) = 19
    //
    // 20 × 1.2 × 0.8 = 19.2 → round → 19. "atk × 0.96" is the
    // cumulative composition arithmetic; round(0.96 × 20) = round(19.2) = 19.
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    let captured = { baseDamage: 0, finalDamage: 0 };
    pipeline.on('apply', (e: DamageEvent) => {
      captured = { baseDamage: e.baseDamage, finalDamage: e.finalDamage };
      e.cancelled = true;
    });

    const attacker: WorldEntity & { atk: number; modifiers?: Modifier[] } = {
      id: 2000,
      x: 0,
      y: 0,
      dead: false,
      components: new Set(['HasHP', 'HasAI', 'IsTargetable', 'HasModifiers']),
      atk: 20,
      modifiers: [
        { stat: 'atk', type: 'percent', value: 20, source: 'aura:centurion:atk' },
      ],
    };
    const target: WorldEntity & { modifiers?: Modifier[] } = {
      id: 2001,
      x: 0,
      y: 0,
      dead: false,
      components: new Set(['HasHP', 'IsTargetable', 'HasModifiers']),
      modifiers: [
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'aura:wardling:dmg_taken' },
      ],
    };

    pipeline.queueAbility(attacker, target, 'jaw_strike');
    pipeline.resolveFrame();

    expect(captured.baseDamage).toBeCloseTo(24, 5);
    expect(captured.finalDamage).toBe(19);
  });
});

// ------------------------------------------------------------------
// Stage 4 item 14 — Mendwing migration (heal dispatch branch, F13=B)
// ------------------------------------------------------------------

/**
 * Local copy of the `updatePassives` heal dispatch branch for
 * pure-function testing. Mirrors the production body exactly.
 * Same duplication caveat as `runSelfModifierDispatch` and
 * `runAuraDispatch` — flagged for Phase 9 backlog item #9 (extract
 * updatePassives branches into testable helpers).
 *
 * Takes a `pipeline` parameter so the test can drive a real
 * `queueAbility` into a fresh pipeline instead of `this.pipeline`
 * (which doesn't exist outside of CombatSystem).
 */
function runHealDispatch(
  alive: IUnit[],
  dt: number,
  pipeline: CombatPipeline,
): void {
  for (const u of alive) {
    const healCfg = findPassive(u, 'heal_cast');
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
    pipeline.queueAbility(u, targets[0] as IUnit, healCfg.abilityName, {});
  }
}

/**
 * Build a Mendwing-or-ally-shaped fixture for heal dispatch tests.
 * Carries the minimum fields the heal loop reads: id, x, unitW,
 * side, hp, maxHp, dead, components, healTimer, passiveHeal, plus
 * a stub `heal` method the Phase 7a `applyHealPhase` subscriber
 * invokes to mutate HP on drain.
 */
let _healFixId = 0;
function makeHealFixture(opts: {
  x: number;
  side: 'player' | 'enemy';
  hp: number;
  maxHp?: number;
  passiveHeal?: Extract<PassiveDef, { kind: 'heal_cast' }>;
  healTimer?: number;
}): IUnit {
  const maxHp = opts.maxHp ?? 100;
  return {
    id: ++_healFixId,
    x: opts.x,
    y: 0,
    unitW: 20,
    unitH: 20,
    side: opts.side,
    hp: opts.hp,
    maxHp,
    dead: false,
    passives: opts.passiveHeal ? [opts.passiveHeal] : undefined,
    healTimer: opts.healTimer ?? 0,
    modifiers: [],
    activeEffects: [],
    components: new Set(['HasHP', 'HasAI', 'IsTargetable', 'HasModifiers']),
    heal(this: { hp: number; maxHp: number }, amount: number): number {
      const actual = Math.min(this.maxHp - this.hp, amount);
      this.hp += actual;
      return actual;
    },
  } as unknown as IUnit;
}

describe('phase8 Stage 4 item 14 — Mendwing migration', () => {
  it('mendwingDef declares defaultAbility = "needle_shot" (offensive reuse of Needler ability)', () => {
    const def = UNIT_DEFS.mendwing;
    expect(def).toBeDefined();
    expect(def.defaultAbility).toBe('needle_shot');
  });

  it('mendwingDef declares the F5 IP-5 passiveHeal config shape', () => {
    const def = UNIT_DEFS.mendwing;
    expect(findPassive(def, 'heal_cast')).toBeDefined();
    expect(findPassive(def, 'heal_cast')).toEqual({
      kind: 'heal_cast',
      abilityName: 'heal_pulse',
      cooldown: 2,
    });
  });

  it('mendwingDef does NOT carry selfModifier or auraModifier', () => {
    const def = UNIT_DEFS.mendwing;
    expect(findPassive(def, 'self_modifier')).toBeUndefined();
    expect(findPassive(def, 'aura_modifier')).toBeUndefined();
  });

  it('offensive parity: migrated needle_shot finalDamage = max(1, round(mendwing.atk × 1.0))', () => {
    // Mendwing's offensive is atk=6, deterministic.
    const def = UNIT_DEFS.mendwing;
    const atk = def.atk;
    const actual = simulateMigratedHit('needle_shot', atk);
    expect(actual).toBe(deterministicDmg(atk));
  });
});

describe('phase8 Stage 4 item 14 — heal dispatch cooldown accumulation', () => {
  it('healTimer accumulates across ticks and does NOT fire before cooldown', () => {
    // dt=0.1 × 10 ticks = 1.0s cumulative (below 2.0 cooldown).
    // No heal should queue.
    const mendwing = makeHealFixture({
      x: 170,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const wounded = makeHealFixture({ x: 100, side: 'player', hp: 50 });
    const pipeline = new CombatPipeline();

    for (let i = 0; i < 10; i++) {
      runHealDispatch([mendwing, wounded], 0.1, pipeline);
    }

    // Check pipeline queue state via introspection.
    const queue = (pipeline as unknown as { queue: unknown[] }).queue;
    expect(queue.length).toBe(0);
    expect(mendwing.healTimer).toBeCloseTo(1.0, 5);
  });

  it('heal fires on the tick where healTimer crosses cooldown with a valid target', () => {
    // dt=0.1 × 20 ticks = 2.0s exactly (reaches cooldown).
    // The first tick where healTimer >= 2 fires the heal.
    const mendwing = makeHealFixture({
      x: 170,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const wounded = makeHealFixture({ x: 100, side: 'player', hp: 50 });
    const pipeline = new CombatPipeline();

    for (let i = 0; i < 20; i++) {
      runHealDispatch([mendwing, wounded], 0.1, pipeline);
    }

    // On tick 20, healTimer >= 2, target found, heal queued.
    const queue = (pipeline as unknown as { queue: unknown[] }).queue;
    expect(queue.length).toBe(1);
    expect(mendwing.healTimer).toBe(0); // reset after fire
  });
});

describe('phase8 Stage 4 item 14 — Divergence E (no cooldown reset on empty target)', () => {
  it('healTimer STAYS at or above cooldown across multiple dispatches when no target is available', () => {
    // Divergence E pin #1 — the central behavioral assertion.
    // Mendwing with NO wounded allies in range should see its
    // healTimer accumulate past 2.0 and STAY there, not reset.
    const mendwing = makeHealFixture({
      x: 170,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const fullHpAlly = makeHealFixture({ x: 100, side: 'player', hp: 100 });
    const pipeline = new CombatPipeline();

    // Advance through 3 successive dispatches, each dt=1 second,
    // cumulative 3 seconds. Without a reset, healTimer = 3.0 after
    // 3 ticks (>= cooldown 2.0).
    runHealDispatch([mendwing, fullHpAlly], 1.0, pipeline);
    expect(mendwing.healTimer).toBeCloseTo(1.0, 5); // < cooldown
    runHealDispatch([mendwing, fullHpAlly], 1.0, pipeline);
    // After tick 2: healTimer = 2.0, selector runs, returns empty,
    // healTimer STAYS at 2.0 per Divergence E.
    expect(mendwing.healTimer).toBeCloseTo(2.0, 5);
    runHealDispatch([mendwing, fullHpAlly], 1.0, pipeline);
    // After tick 3: healTimer = 3.0, selector still returns empty,
    // still no reset. Divergence E holds.
    expect(mendwing.healTimer).toBeCloseTo(3.0, 5);

    const queue = (pipeline as unknown as { queue: unknown[] }).queue;
    expect(queue.length).toBe(0); // no heal ever fired
  });

  it('wounded ally appearing after idle cooldown triggers IMMEDIATE heal on next tick', () => {
    // Divergence E pin #2 — first-target availability is NOT
    // artificially delayed. Mendwing idled with no targets for
    // 5 seconds; a wounded ally appears; next tick should fire
    // the heal immediately, NOT wait another 2 seconds.
    const mendwing = makeHealFixture({
      x: 170,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const fullHpAlly = makeHealFixture({ x: 100, side: 'player', hp: 100 });
    const pipeline = new CombatPipeline();

    // 5 seconds of idle (50 ticks at dt=0.1).
    for (let i = 0; i < 50; i++) {
      runHealDispatch([mendwing, fullHpAlly], 0.1, pipeline);
    }
    // healTimer accumulated to 5.0, no heal fired.
    expect(mendwing.healTimer).toBeCloseTo(5.0, 5);
    const queueBefore = (pipeline as unknown as { queue: unknown[] }).queue.length;
    expect(queueBefore).toBe(0);

    // Wound the ally. Next tick should fire the heal.
    fullHpAlly.hp = 50;
    runHealDispatch([mendwing, fullHpAlly], 0.016, pipeline);

    const queueAfter = (pipeline as unknown as { queue: unknown[] }).queue.length;
    expect(queueAfter).toBe(1); // heal queued immediately
    expect(mendwing.healTimer).toBe(0); // reset after fire
  });
});

describe('phase8 Stage 4 item 14 — F13=B range enforcement in heal dispatch', () => {
  it('wounded ally OUTSIDE 90px range does NOT receive heal', () => {
    // F13=B lock: Mendwing at x=300, wounded ally at x=200
    // (distance 100, OUT of 90px range). Selector returns empty,
    // no heal queued.
    const mendwing = makeHealFixture({
      x: 300,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const farWounded = makeHealFixture({ x: 200, side: 'player', hp: 20 });
    const pipeline = new CombatPipeline();

    // Tick cooldown to ready (2s).
    runHealDispatch([mendwing, farWounded], 2.0, pipeline);

    // No heal queued; per Divergence E, healTimer stays at 2.0.
    const queue = (pipeline as unknown as { queue: unknown[] }).queue;
    expect(queue.length).toBe(0);
    expect(mendwing.healTimer).toBeCloseTo(2.0, 5);
    expect(farWounded.hp).toBe(20); // unchanged
  });

  it('wounded ally INSIDE 90px range receives heal queue', () => {
    // Mendwing at x=170, wounded ally at x=100 (distance 70 < 90).
    // Matches stage4AllPassives scenario layout.
    const mendwing = makeHealFixture({
      x: 170,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const closeWounded = makeHealFixture({ x: 100, side: 'player', hp: 30 });
    const pipeline = new CombatPipeline();

    runHealDispatch([mendwing, closeWounded], 2.0, pipeline);

    const queue = (pipeline as unknown as { queue: unknown[] }).queue;
    expect(queue.length).toBe(1);
    expect(mendwing.healTimer).toBe(0);
  });

  it('boundary: ally at exactly 90px is OUT of range (matches runSelectorInRange `<` semantics)', () => {
    // Legacy had no range check; migrated uses F13=B 90px via
    // runSelectorInRange's strict `<` check. Ally at exactly 90
    // distance is OUT (same semantic as Wardling/Centurion aura
    // boundary pins).
    const mendwing = makeHealFixture({
      x: 100,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    // Distance x=100 to x=190 is exactly 90.
    const at90 = makeHealFixture({ x: 190, side: 'player', hp: 30 });
    const pipeline = new CombatPipeline();

    runHealDispatch([mendwing, at90], 2.0, pipeline);

    const queue = (pipeline as unknown as { queue: unknown[] }).queue;
    expect(queue.length).toBe(0);
  });

  it('boundary: ally at 89px is IN range (just inside F13=B)', () => {
    const mendwing = makeHealFixture({
      x: 100,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const at89 = makeHealFixture({ x: 189, side: 'player', hp: 30 });
    const pipeline = new CombatPipeline();

    runHealDispatch([mendwing, at89], 2.0, pipeline);

    const queue = (pipeline as unknown as { queue: unknown[] }).queue;
    expect(queue.length).toBe(1);
  });
});

describe('phase8 Stage 4 item 14 — heal dispatch target selection', () => {
  it('heal targets the LOWEST-HP wounded ally in range (not nearest)', () => {
    // Two wounded allies both in range: one nearly full (hp 90),
    // one critically low (hp 10). The lowest_hp_ally_in_range
    // selector picks the critical one, NOT the nearest. Divergence
    // from legacy's "nearest wounded" behavior at normal.ts:494.
    const mendwing = makeHealFixture({
      x: 170,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const nearNearlyFull = makeHealFixture({ x: 150, side: 'player', hp: 90 });
    const farCritical = makeHealFixture({ x: 110, side: 'player', hp: 10 });
    const pipeline = new CombatPipeline();

    runHealDispatch([mendwing, nearNearlyFull, farCritical], 2.0, pipeline);

    const queue = (pipeline as unknown as { queue: unknown[] }).queue;
    expect(queue.length).toBe(1);
    // Introspect the queued event's target — should be farCritical.
    const event = queue[0] as { target: IUnit };
    expect(event.target).toBe(farCritical);
  });

  it('ignores same-side FULL-HP allies (filters by wounded in selector)', () => {
    const mendwing = makeHealFixture({
      x: 170,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const fullHp = makeHealFixture({ x: 100, side: 'player', hp: 100 });
    const pipeline = new CombatPipeline();

    runHealDispatch([mendwing, fullHp], 2.0, pipeline);

    const queue = (pipeline as unknown as { queue: unknown[] }).queue;
    expect(queue.length).toBe(0); // no wounded target
  });

  it('ignores enemy-side wounded units (allegiance filter)', () => {
    const mendwing = makeHealFixture({
      x: 170,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const enemyWounded = makeHealFixture({ x: 100, side: 'enemy', hp: 30 });
    const pipeline = new CombatPipeline();

    runHealDispatch([mendwing, enemyWounded], 2.0, pipeline);

    const queue = (pipeline as unknown as { queue: unknown[] }).queue;
    expect(queue.length).toBe(0);
  });

  it('does NOT heal itself (self === caster filter in selector)', () => {
    // A wounded Mendwing with no other allies should NOT self-heal.
    // The selector's filterCombatants excludes `caster` from the
    // candidate list, so Mendwing can never be its own heal target.
    const mendwing = makeHealFixture({
      x: 170,
      side: 'player',
      hp: 30, // self is wounded
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const pipeline = new CombatPipeline();

    runHealDispatch([mendwing], 2.0, pipeline);

    const queue = (pipeline as unknown as { queue: unknown[] }).queue;
    expect(queue.length).toBe(0);
    expect(mendwing.hp).toBe(30); // unchanged
    // Per Divergence E, healTimer stays full since no target.
    expect(mendwing.healTimer).toBeCloseTo(2.0, 5);
  });
});

describe('phase8 Stage 4 item 14 — pipeline drain end-to-end', () => {
  it('queued heal resolves via Phase 7a applyHealPhase subscriber on drain', () => {
    // Full flow: heal dispatch queues event → pipeline.drain()
    // → applyHealPhase pre_apply subscriber handles the heal +
    // cancels the event. Mirrors Task 1's IP-1 end-to-end test
    // pattern for the heal path.
    const mendwing = makeHealFixture({
      x: 170,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const wounded = makeHealFixture({ x: 100, side: 'player', hp: 50 });
    const pipeline = new CombatPipeline();

    // Register the Phase 7a heal subscriber on pre_apply (matches
    // the real CombatSystem constructor registration).
    pipeline.on('pre_apply', applyHealPhase);

    // Dispatch queues the heal.
    runHealDispatch([mendwing, wounded], 2.0, pipeline);
    expect(wounded.hp).toBe(50); // still wounded pre-drain

    // Drive the drain. applyHealPhase reads ability.healAmount=20,
    // calls wounded.heal(20), cancels the event.
    pipeline.resolveFrame();

    // Wounded ally healed by 20.
    expect(wounded.hp).toBe(70);
  });

  it('heal cannot push HP above maxHp (Unit.heal clamping)', () => {
    // Regression guard — the fixture's heal() method clamps at
    // maxHp. A near-full wounded ally receiving a 20-heal should
    // cap at maxHp, not overflow.
    const mendwing = makeHealFixture({
      x: 170,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const slightlyWounded = makeHealFixture({ x: 100, side: 'player', hp: 95 });
    const pipeline = new CombatPipeline();
    pipeline.on('pre_apply', applyHealPhase);

    runHealDispatch([mendwing, slightlyWounded], 2.0, pipeline);
    pipeline.resolveFrame();

    // heal(20) on hp=95/maxHp=100 should cap at 100 (actualHeal = 5).
    expect(slightlyWounded.hp).toBe(100);
  });
});

describe('phase8 Stage 4 item 14 — IP-1 + IP-5 coexistence regression guard', () => {
  it('a Mendwing-healed ally does not accidentally carry dmg_taken modifiers', () => {
    // Regression guard for a hypothetical cross-dispatch-branch bug
    // where the heal branch accidentally mutates the ally's
    // modifiers list. The healed ally's modifiers should remain
    // empty (heal dispatch only affects hp + healTimer + pipeline
    // queue, NOT modifiers).
    const mendwing = makeHealFixture({
      x: 170,
      side: 'player',
      hp: 100,
      passiveHeal: findPassive(UNIT_DEFS.mendwing, 'heal_cast'),
      healTimer: 0,
    });
    const wounded = makeHealFixture({ x: 100, side: 'player', hp: 50 });
    const pipeline = new CombatPipeline();
    pipeline.on('pre_apply', applyHealPhase);

    runHealDispatch([mendwing, wounded], 2.0, pipeline);
    pipeline.resolveFrame();

    expect(wounded.modifiers).toHaveLength(0);
    expect(mendwing.modifiers).toHaveLength(0);
  });
});

// ------------------------------------------------------------------
// Stage 4 item 14 FOLLOW-UP — heal FX dispatcher (side-effect audit)
// ------------------------------------------------------------------

describe('phase8 Stage 4 item 14 follow-up — heal FX dispatcher', () => {
  // HISTORY: the Stage 4 close smoke run surfaced that legacy
  // `mendwingCombat.onUpdate` spawned a green `+20` particle float
  // + heal sound inline whenever Mendwing healed; the migrated
  // `applyHealPhase` subscriber dropped both side effects because
  // it was a pure function with no access to `ctx.particles` or
  // `_playHitSound`. HP recovery worked but the player saw
  // nothing. Item 14 follow-up ships a heal FX dispatcher mirroring
  // the Phase 7a DOT dispatcher pattern: a module-level singleton
  // closure that CombatSystem.constructor sets to spawn the
  // particle + play the sound, defaulting to a no-op for test
  // environments.
  //
  // These tests pin the dispatcher contract so a future regression
  // (accidentally reverting the dispatch call, or inlining FX into
  // applyHealPhase directly without the indirection) fails here.

  function makeHealEvent(
    target: IUnit,
    healAmount = 20,
  ): DamageEvent {
    return {
      target: target as unknown as DamageEvent['target'],
      attacker: null,
      ability: {
        name: 'Heal Pulse',
        category: 'heal',
        healAmount,
      } as unknown as DamageEvent['ability'],
      baseDamage: 0,
      finalDamage: 0,
      cancelled: false,
      effects: [],
    } as unknown as DamageEvent;
  }

  // Reset the dispatcher to a no-op after each test so state from
  // one test's spy doesn't leak into the next. Vitest doesn't
  // auto-reset module-level state across tests in the same file.
  function resetDispatcher(): void {
    setHealFxDispatcher(() => {});
  }

  it('applyHealPhase works with the default no-op dispatcher — HP increases, no crash', () => {
    // Confirms the default dispatcher is actually a no-op and
    // doesn't crash when applyHealPhase fires in a test env where
    // CombatSystem hasn't been instantiated to install a real
    // closure. This is the regression guard for any future change
    // that makes the default dispatcher throw or log.
    resetDispatcher();

    const target = makeHealFixture({ x: 100, side: 'player', hp: 50 });
    const event = makeHealEvent(target, 20);

    expect(() => applyHealPhase(event)).not.toThrow();
    expect(target.hp).toBe(70);
    expect(event.cancelled).toBe(true);
  });

  it('dispatcher is invoked with (target, healedAmount) after a successful heal', () => {
    // The load-bearing test for the fix. Install a spy dispatcher,
    // run applyHealPhase with a wounded target, assert the spy was
    // called once with the correct arguments. `healedAmount` equals
    // the requested amount when the target can absorb the full
    // heal without clamping.
    let capturedTarget: IUnit | null = null;
    let capturedAmount: number | null = null;
    let callCount = 0;

    setHealFxDispatcher((t, amt) => {
      capturedTarget = t;
      capturedAmount = amt;
      callCount++;
    });

    const target = makeHealFixture({ x: 100, side: 'player', hp: 50 });
    const event = makeHealEvent(target, 20);

    applyHealPhase(event);

    expect(callCount).toBe(1);
    expect(capturedTarget).toBe(target);
    expect(capturedAmount).toBe(20);

    resetDispatcher();
  });

  it('dispatcher receives CLAMPED amount when target is near full HP', () => {
    // `target.heal(amount)` returns the actual amount healed,
    // clamped at `maxHp - hp`. The dispatcher should receive the
    // clamped value so the visible `+N` float matches reality.
    // Target at 95/100 HP + heal 20 → actual heal = 5 → dispatcher
    // sees `+5`, NOT `+20`.
    let capturedAmount: number | null = null;
    setHealFxDispatcher((_t, amt) => { capturedAmount = amt; });

    const target = makeHealFixture({ x: 100, side: 'player', hp: 95 });
    const event = makeHealEvent(target, 20);

    applyHealPhase(event);

    expect(target.hp).toBe(100); // clamped at maxHp
    expect(capturedAmount).toBe(5); // clamped dispatch amount

    resetDispatcher();
  });

  it('dispatcher is NOT invoked when the target is at full HP (heal amount = 0)', () => {
    // Full-HP target → `target.heal(20)` returns 0 → no FX spawns.
    // Prevents spurious `+0` float text when Mendwing's selector
    // picks a full-HP ally (which normally won't happen due to the
    // `lowest_hp_ally_in_range` selector's `hp < maxHp` filter,
    // but defensive against edge cases and future selector swaps).
    let callCount = 0;
    setHealFxDispatcher(() => { callCount++; });

    const target = makeHealFixture({ x: 100, side: 'player', hp: 100 });
    const event = makeHealEvent(target, 20);

    applyHealPhase(event);

    expect(callCount).toBe(0);
    expect(target.hp).toBe(100); // unchanged
    expect(event.cancelled).toBe(true); // still cancelled

    resetDispatcher();
  });

  it('dispatcher is NOT invoked on a cancelled event (pre-apply bail)', () => {
    // An event cancelled by a prior subscriber (e.g., a future
    // pre_damage hook that nulls out a heal) should bypass
    // applyHealPhase entirely, including the dispatcher call.
    let callCount = 0;
    setHealFxDispatcher(() => { callCount++; });

    const target = makeHealFixture({ x: 100, side: 'player', hp: 50 });
    const event = makeHealEvent(target, 20);
    event.cancelled = true;

    applyHealPhase(event);

    expect(callCount).toBe(0);
    expect(target.hp).toBe(50); // unchanged — heal never ran

    resetDispatcher();
  });

  it('dispatcher is NOT invoked when the target is dead', () => {
    // Defensive case — if applyHealPhase receives a heal event on
    // an already-dead target, the existing dead-target guard short-
    // circuits the heal. The dispatcher should stay no-op'd because
    // no HP mutation happened.
    let callCount = 0;
    setHealFxDispatcher(() => { callCount++; });

    const target = makeHealFixture({ x: 100, side: 'player', hp: 50 });
    target.dead = true;
    const event = makeHealEvent(target, 20);

    applyHealPhase(event);

    expect(callCount).toBe(0);
    expect(target.hp).toBe(50); // unchanged
    expect(event.cancelled).toBe(true); // still cancelled per applyHealPhase contract

    resetDispatcher();
  });
});

// ------------------------------------------------------------------
// Phase 8 Stage 5 item 15 — Bombardier migration
// ------------------------------------------------------------------

describe('phase8 Stage 5 item 15 — Bombardier migration', () => {
  it('bombardierDef declares deathAbility = "death_bomb"', () => {
    const def = UNIT_DEFS.bombardier;
    expect(def).toBeDefined();
    expect(def.deathAbility).toBe('death_bomb');
  });

  it('bombardierDef carries defaultAbility = "jaw_strike" (Phase 9 Batch 1 item 16)', () => {
    // Phase 9 Batch 1 migrated the basic attack to the pipeline.
    // deathAbility: 'death_bomb' was already set in Phase 8 Stage 5.
    const def = UNIT_DEFS.bombardier;
    expect(def.defaultAbility).toBe('jaw_strike');
  });

  it('death_bomb ability data matches legacy targeting semantics', () => {
    const ability = lookupAbility('death_bomb');
    expect(ability.targeting).toBe('all_enemies_in_range');
    expect(ability.range).toBe(50);
    expect(ability.targetCount).toBe(5);
    expect(ability.trigger).toBe('onDeath');
    expect(ability.category).toBe('damage');
    expect(ability.dmgType).toBe('heat');
  });

  // --- Dispatcher invocation tests ---

  it('applyDeathTriggerPhase calls the dispatcher when deathAbility is set', () => {
    const calls: Array<{ unit: MockDyingUnit; abilityName: string }> = [];
    setDeathTriggerDispatcher((u, name) => {
      calls.push({ unit: u as unknown as MockDyingUnit, abilityName: name });
    });

    const target = makeMockDying({ dead: true, deathAbility: 'death_bomb' });
    applyDeathTriggerPhase(makeDeathEvent(target));

    expect(calls.length).toBe(1);
    expect(calls[0].abilityName).toBe('death_bomb');
    expect(calls[0].unit).toBe(target);

    // Reset
    setDeathTriggerDispatcher(() => {});
  });

  it('dispatcher is NOT called when deathAbility is absent', () => {
    let called = false;
    setDeathTriggerDispatcher(() => { called = true; });

    const target = makeMockDying({ dead: true, deathAbility: undefined });
    applyDeathTriggerPhase(makeDeathEvent(target));

    expect(called).toBe(false);

    setDeathTriggerDispatcher(() => {});
  });

  it('dispatcher fires exactly once even when two events hit the same dying Bombardier (Finding 12)', () => {
    let dispatchCount = 0;
    setDeathTriggerDispatcher(() => { dispatchCount++; });

    const target = makeMockDying({ dead: true, deathAbility: 'death_bomb' });

    // Event 1 — should dispatch
    applyDeathTriggerPhase(makeDeathEvent(target));
    expect(dispatchCount).toBe(1);
    expect(target._deathTriggerFired).toBe(true);

    // Event 2 — same target, latch already set → no dispatch
    applyDeathTriggerPhase(makeDeathEvent(target));
    expect(dispatchCount).toBe(1); // unchanged

    setDeathTriggerDispatcher(() => {});
  });

  it('5 independent Bombardier deaths each dispatch exactly once', () => {
    const dispatched: number[] = [];
    setDeathTriggerDispatcher((u) => { dispatched.push((u as any).id); });

    const bombers = Array.from({ length: 5 }, () =>
      makeMockDying({ dead: true, deathAbility: 'death_bomb' }),
    );

    for (const b of bombers) {
      applyDeathTriggerPhase(makeDeathEvent(b));
    }

    expect(dispatched.length).toBe(5);
    // Each bomber dispatched once, unique IDs
    expect(new Set(dispatched).size).toBe(5);

    setDeathTriggerDispatcher(() => {});
  });

  // --- Flat-65 damage parity test ---

  it('death_bomb via baseDamageOverride produces exactly 65 finalDamage (no variance)', () => {
    // Simulates the pipeline path that the death trigger dispatcher
    // uses: queueAbility with baseDamageOverride: 65. The calculate
    // phase fast path sets finalDamage=65 directly, bypassing tier
    // tables and variance.
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    let captured = 0;
    pipeline.on('apply', (e: DamageEvent) => {
      captured = e.finalDamage;
      e.cancelled = true;
    });

    const attacker = {
      id: ++_id,
      x: 0, y: 0,
      dead: true, // dying Bombardier
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
      atk: 28, // Bombardier atk — should NOT affect the result
    };
    const target = {
      id: ++_id,
      x: 10, y: 0,
      dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    };

    pipeline.queueAbility(attacker, target, 'death_bomb', {
      baseDamageOverride: 65,
    });
    pipeline.resolveFrame();

    // Flat 65 — not 28 (Bombardier atk), not tier-scaled, no variance
    expect(captured).toBe(65);
  });

  // --- Death-bomb events drain in the same resolveFrame (queue-drainage audit) ---

  it('death_bomb events queued from post_apply are drained by the same resolveFrame', () => {
    // The death trigger dispatcher calls pipeline.queueAbility from
    // inside a post_apply subscriber (during an active drain). Per
    // CombatPipeline's while-loop, these new events are picked up in
    // the SAME resolveFrame call.
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    const applyCaptures: number[] = [];
    // Mock apply that tracks finalDamage and kills the target.
    // Does NOT cancel — post_apply must fire for the death trigger.
    pipeline.on('apply', (e: DamageEvent) => {
      const t = e.target as any;
      if (t.dead) { e.cancelled = true; return; }
      t.hp = Math.max(0, (t.hp ?? 100) - e.finalDamage);
      if (t.hp <= 0) t.dead = true;
      applyCaptures.push(e.finalDamage);
    });

    // Wire death trigger to queue 2 death_bomb events on death
    const enemy1 = {
      id: ++_id, x: 5, y: 0, dead: false, hp: 100,
      side: 'enemy' as const,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAI']),
    };
    const enemy2 = {
      id: ++_id, x: 8, y: 0, dead: false, hp: 100,
      side: 'enemy' as const,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAI']),
    };

    setDeathTriggerDispatcher((_dyingUnit, _name) => {
      // Simulate what the production dispatcher does: queue events
      pipeline.queueAbility(_dyingUnit as any, enemy1, 'death_bomb', {
        baseDamageOverride: 65,
      });
      pipeline.queueAbility(_dyingUnit as any, enemy2, 'death_bomb', {
        baseDamageOverride: 65,
      });
    });

    const bomber = {
      id: ++_id, x: 0, y: 0, dead: false, hp: 100,
      side: 'player' as const,
      _deathTriggerFired: false,
      deathAbility: 'death_bomb',
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
      activeEffects: [] as any[],
    };

    // Register post_apply handlers including the death trigger
    const mockLegacy = (event: DamageEvent) => {
      const u = event.target as any;
      if (!u.dead || u._deathTriggerFired) return;
      // Simulate lethal apply: the apply handler above set u.dead=true
    };
    pipeline.on('post_apply', mockLegacy);
    pipeline.on('post_apply', applyEffectsPhase);
    pipeline.on('post_apply', applyDeathTriggerPhase);

    // Queue a lethal hit on the Bombardier
    pipeline.queueAbility(enemy1, bomber as any, 'death_bomb', {
      baseDamageOverride: 200, // overkill to ensure death
    });
    pipeline.resolveFrame();

    // The initial hit (200) + the two death_bomb events (65 each)
    // should ALL resolve in the same resolveFrame call.
    expect(applyCaptures.length).toBe(3);
    expect(applyCaptures[0]).toBe(200); // lethal hit
    expect(applyCaptures[1]).toBe(65);  // death_bomb target 1
    expect(applyCaptures[2]).toBe(65);  // death_bomb target 2

    setDeathTriggerDispatcher(() => {});
  });

  // --- Cross-side cascade SAFETY_CAP test ---

  it('SAFETY_CAP engages on deep cross-side Bombardier cascade', () => {
    // Synthetic scenario: alternating player/enemy Bombardiers within
    // mutual death_bomb range. Kill one → cascade bounces back and
    // forth. Verify SAFETY_CAP (200) drops events with a console.warn.
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    const allUnits: any[] = [];
    const applyCount = { value: 0 };

    // Apply handler that actually kills targets.
    // Does NOT cancel — post_apply must fire for the death trigger.
    pipeline.on('apply', (e: DamageEvent) => {
      const t = e.target as any;
      if (t.dead) { e.cancelled = true; return; }
      t.hp = Math.max(0, (t.hp ?? 100) - e.finalDamage);
      if (t.hp <= 0) t.dead = true;
      applyCount.value++;
    });

    // Death trigger dispatcher that queues death_bomb at all enemies
    // in range — mirrors production behavior
    setDeathTriggerDispatcher((dyingUnit, _name) => {
      const u = dyingUnit as any;
      const ability = lookupAbility('death_bomb');
      const enemies = allUnits.filter(
        e => e.side !== u.side && !e.dead &&
             Math.abs(e.x - u.x) < (ability.range ?? 50),
      ).slice(0, ability.targetCount ?? 5);
      for (const t of enemies) {
        pipeline.queueAbility(dyingUnit as any, t, 'death_bomb', {
          baseDamageOverride: 65,
        });
      }
    });

    // Register post_apply with death trigger
    const mockLegacy = (event: DamageEvent) => {
      const u = event.target as any;
      if (!u.dead || u._deathTriggerFired) return;
      // Legacy check-only — doesn't set latch
    };
    pipeline.on('post_apply', mockLegacy);
    pipeline.on('post_apply', applyEffectsPhase);
    pipeline.on('post_apply', applyDeathTriggerPhase);

    // Create 50 alternating Bombardiers (25 player, 25 enemy) at x=0
    // with 30 HP each so a single 65-damage death_bomb kills them.
    // Max cascade events: 1 (initial) + 50 × 5 (each death queues 5)
    // = 251, which exceeds SAFETY_CAP (200).
    for (let i = 0; i < 50; i++) {
      allUnits.push({
        id: ++_id,
        x: 0, y: 0,
        dead: false,
        hp: 30, // dies to one death_bomb (65 > 30)
        side: i % 2 === 0 ? 'player' : 'enemy',
        _deathTriggerFired: false,
        deathAbility: 'death_bomb',
        components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAI']),
        activeEffects: [] as any[],
        unitW: 20,
        unitH: 20,
      });
    }

    // Kill the first player Bombardier with a 100-damage hit
    const triggerAttacker = {
      id: ++_id, x: 0, y: 0, dead: false,
      side: 'enemy' as const,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    };
    pipeline.queueAbility(triggerAttacker, allUnits[0], 'death_bomb', {
      baseDamageOverride: 100,
    });

    // Suppress console.warn from SAFETY_CAP
    const origWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: any[]) => { warnings.push(args.join(' ')); };

    pipeline.resolveFrame();

    console.warn = origWarn;

    // The cascade should have hit SAFETY_CAP (200 events).
    // Verify that:
    // (a) the cap engaged (console.warn fired)
    // (b) total apply calls are bounded, not infinite
    expect(warnings.some(w => w.includes('safety cap'))).toBe(true);
    expect(applyCount.value).toBeLessThanOrEqual(200);
    expect(applyCount.value).toBeGreaterThan(10); // cascade did happen

    setDeathTriggerDispatcher(() => {});
  });
});

// ------------------------------------------------------------------
// Phase 8 Stage 5 — Primitives (Item 16 infrastructure)
// ------------------------------------------------------------------

describe('phase8 Stage 5 Primitive A — F4 targetFalloff (dead-code infra pin)', () => {
  it('calculate phase applies falloff when targetFalloff + _targetIndex are set', () => {
    // Dead-code pin test: Phase 8 Stormfly/Longeye use
    // baseDamageOverride for parity, but the calculate phase's
    // falloff integration must still work for Phase 10.
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    const captures: number[] = [];
    pipeline.on('apply', (e: DamageEvent) => {
      captures.push(e.finalDamage);
      e.cancelled = true;
    });

    const attacker = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      atk: 100,
    };
    const target = {
      id: ++_id, x: 10, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    };

    // Manually queue 3 events with different _targetIndex values
    // simulating a chain_lightning WITH targetFalloff in the ability.
    // We add targetFalloff to chain_lightning's data in Step 2.
    // For this pin test, use a test-only ability via baseDamageOverride
    // bypass — wait, we need to exercise the REAL calculate path.
    // Use a test helper that queues through the real path.
    const e0 = pipeline.queueAbility(attacker, target, 'jaw_strike');
    e0._targetIndex = 0;
    const e1 = pipeline.queueAbility(attacker, target, 'jaw_strike');
    e1._targetIndex = 1;
    const e2 = pipeline.queueAbility(attacker, target, 'jaw_strike');
    e2._targetIndex = 2;

    // jaw_strike has no targetFalloff → falloff defaults to 1.0
    // for all indices. All three should produce the same finalDamage.
    pipeline.resolveFrame();
    expect(captures[0]).toBe(captures[1]);
    expect(captures[1]).toBe(captures[2]);
    expect(captures[0]).toBe(100); // atk 100 × dmgMult 1.0 × falloff 1.0
  });

  it('targetFalloff absent defaults to 1.0 — no regression on single-target abilities', () => {
    // Regression guard: Phase 6/7/8 single-target abilities have no
    // targetFalloff field. Calculate phase must produce unchanged
    // damage (base × 1.0 × 1 = base).
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    let captured = 0;
    pipeline.on('apply', (e: DamageEvent) => {
      captured = e.finalDamage;
      e.cancelled = true;
    });

    const attacker = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      atk: 50,
    };
    const target = {
      id: ++_id, x: 10, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    };

    pipeline.queueAbility(attacker, target, 'jaw_strike');
    pipeline.resolveFrame();
    expect(captured).toBe(50); // unchanged from pre-Primitive-A
  });
});

describe('phase8 Stage 5 Primitive B — effectChance gating', () => {
  it('effectChance < 1 gates effect inclusion at queue time (statistical)', () => {
    // chain_lightning has effectChance: 0.25 on its normal tier.
    // Queue 200 events and verify effects are included ~25% of the
    // time (statistical bounds: 30-70 out of 200 at p=0.25).
    const pipeline = new CombatPipeline();
    const attacker = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
      atk: 50,
    };
    const target = {
      id: ++_id, x: 10, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    };

    let stunCount = 0;
    for (let i = 0; i < 200; i++) {
      const event = pipeline.queueAbility(attacker, target, 'chain_lightning');
      if (event.effects.includes('stun')) stunCount++;
    }

    // p=0.25, n=200 → expected ~50. Bounds [30, 70] are ~4σ wide.
    expect(stunCount).toBeGreaterThanOrEqual(20);
    expect(stunCount).toBeLessThanOrEqual(80);
  });

  it('effectChance absent (or >= 1) always includes effects', () => {
    // fire_bite has effectChance: 1.0 via linearDamageTiersWithEffect(1.0).
    const pipeline = new CombatPipeline();
    const attacker = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
      atk: 30,
    };
    const target = {
      id: ++_id, x: 10, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    };

    for (let i = 0; i < 50; i++) {
      const event = pipeline.queueAbility(attacker, target, 'fire_bite');
      expect(event.effects).toContain('burn');
    }
  });

  it('ability with no appliesEffects and unmapped dmgType produces empty effects array', () => {
    // jaw_strike is sharp; DEFAULT_EFFECTS omits sharp (bleed is
    // declared but has no onTick body). Expect event.effects = [].
    const pipeline = new CombatPipeline();
    const attacker = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
      atk: 14,
    };
    const target = {
      id: ++_id, x: 10, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    };

    const event = pipeline.queueAbility(attacker, target, 'jaw_strike');
    expect(event.effects).toEqual([]);
  });
});

// ------------------------------------------------------------------
// Phase 10 Batch 3 — DEFAULT_EFFECTS three-state model
// ------------------------------------------------------------------

describe('Phase 10 Batch 3 — DEFAULT_EFFECTS table shape', () => {
  it('maps shipping damage types to wired effects', () => {
    // Pin the exact contents. Absent entries (sharp, psychic, void,
    // holy) are intentional — their target effects are declared but
    // not fully wired. If a future batch wires one, add the mapping
    // here AND this test updates.
    expect(DEFAULT_EFFECTS).toEqual({
      blunt: 'knockback',
      heat: 'burn',
      electric: 'stun',
      cold: 'slow',
      toxic: 'poison',
    });
  });

  it('every mapped effect name resolves via lookupEffect (no typos)', () => {
    for (const [dmgType, effectName] of Object.entries(DEFAULT_EFFECTS)) {
      expect(() => lookupEffect(effectName as string), dmgType).not.toThrow();
    }
  });
});

describe('Phase 10 Batch 3 — queueAbility three-state effect resolution', () => {
  function makeFixture(): {
    pipeline: CombatPipeline;
    attacker: WorldEntity & { atk: number };
    target: WorldEntity;
  } {
    const pipeline = new CombatPipeline();
    const attacker = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
      atk: 50,
    };
    const target = {
      id: ++_id, x: 10, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    };
    return { pipeline, attacker, target };
  }

  it('appliesEffects undefined + mapped dmgType → default effect', () => {
    // bash_strike has appliesEffects undefined post-Batch-3;
    // DEFAULT_EFFECTS['blunt'] = 'knockback' provides the default.
    const { pipeline, attacker, target } = makeFixture();
    const event = pipeline.queueAbility(attacker, target, 'bash_strike');
    expect(event.effects).toEqual(['knockback']);
  });

  it('appliesEffects [] → empty (explicit opt-out overrides default)', () => {
    // death_bomb is heat (would default to burn) but declares [] to
    // opt out of the default. No ignition on explosion.
    const { pipeline, attacker, target } = makeFixture();
    const event = pipeline.queueAbility(attacker, target, 'death_bomb', {
      baseDamageOverride: 65,
    });
    expect(event.effects).toEqual([]);
  });

  it('appliesEffects undefined + unmapped dmgType → empty', () => {
    // jaw_strike is sharp; DEFAULT_EFFECTS has no sharp entry.
    const { pipeline, attacker, target } = makeFixture();
    const event = pipeline.queueAbility(attacker, target, 'jaw_strike');
    expect(event.effects).toEqual([]);
  });

  it('override_damage_event (no ability.dmgType) → empty regardless of DEFAULT_EFFECTS', () => {
    // Wrapper abilities carry no ability.dmgType even when the event
    // gets a dmgType from legacyHitFlavor. DEFAULT_EFFECTS lookup
    // uses ability.dmgType, not event.dmgType, so DOT ticks and
    // other wrapper events never pick up a default effect.
    const { pipeline, attacker, target } = makeFixture();
    const event = pipeline.queueAbility(attacker, target, 'override_damage_event', {
      baseDamageOverride: 5,
      legacyHitFlavor: 'burn',
    });
    expect(event.effects).toEqual([]);
  });

  it('effectChance gate applies to default-path effects (chain_lightning stun)', () => {
    // chain_lightning has appliesEffects undefined; DEFAULT_EFFECTS
    // ['electric'] = 'stun'. tiers.normal.effectChance = 0.25, so
    // ~25% of queues include stun in event.effects. Matches the
    // pre-Batch-3 behavior where stun came from explicit
    // appliesEffects: ['stun'] but the chance gate was the same.
    const { pipeline, attacker, target } = makeFixture();
    let stunCount = 0;
    for (let i = 0; i < 200; i++) {
      const event = pipeline.queueAbility(attacker, target, 'chain_lightning');
      if (event.effects.includes('stun')) stunCount++;
    }
    // p=0.25, n=200 → expected ~50. Bounds [20, 80] match the
    // existing Primitive B test's tolerance.
    expect(stunCount).toBeGreaterThanOrEqual(20);
    expect(stunCount).toBeLessThanOrEqual(80);
  });

  it('fire_bite default burn applies at chance=1.0 (always)', () => {
    // fire_bite uses linearDamageTiersWithEffect(1.0) → effectChance
    // 1.0 → burn always lands via DEFAULT_EFFECTS['heat'].
    const { pipeline, attacker, target } = makeFixture();
    for (let i = 0; i < 50; i++) {
      const event = pipeline.queueAbility(attacker, target, 'fire_bite');
      expect(event.effects).toContain('burn');
    }
  });
});

describe('Phase 10 Batch 3 — applyEffectsPhase plumbs knockForce from ability tier data', () => {
  it('knockback.onApply reads knockForce from ctx.instance (populated via ability.tiers[effectiveTier].knockForce)', () => {
    // End-to-end: queue bash_strike, drain the pipeline, verify the
    // target's poiseAccum reflects bash_strike.tiers[normal].knockForce.
    // Post-refactor knockForce lives on ability tier data, not on the
    // attacker unit. Resistance-neutral target → effectiveTier=normal
    // → knockForce=100 (bash_strike's homogenized value).
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);
    pipeline.on('post_apply', applyEffectsPhase);

    const attacker = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      atk: 18,
    } as unknown as IUnit;
    const target = {
      id: ++_id, x: 30, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
      poiseAccum: 0,
      knockback: 0,
      facing: -1,
      activeEffects: [],
    } as unknown as IUnit;

    pipeline.queueAbility(attacker, target, 'bash_strike');
    pipeline.resolveFrame();

    // knockForce=100, poise at threshold on first hit → staggers. Overflow
    // 0 → knockDist = 142. facing=-1 → knockback = +142.
    expect(target.poiseAccum).toBe(0);
    expect(target.knockback).toBeCloseTo(142, 5);
  });

  it('single bash_strike hit already crosses the poise threshold under flat-100 tier data', () => {
    // Post-refactor (Option A flat 100 across all 7 tiers): a single
    // bash_strike hit delivers full 100 poise → instant stagger on
    // the first hit against any resistance-neutral target. knockResist
    // is gone; target blunt resistance affects effectiveTier but all
    // tiers carry knockForce=100, so poise accumulation is unchanged.
    //
    // Second hit no-ops on knockback due to the in-motion guard
    // (|knockback| >= 10 after the first-hit stagger) while still
    // accumulating poise via the post-threshold reset.
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);
    pipeline.on('post_apply', applyEffectsPhase);

    const attacker = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      atk: 50,
    } as unknown as IUnit;
    const target = {
      id: ++_id, x: 30, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
      poiseAccum: 0,
      knockback: 0,
      facing: -1,
      activeEffects: [],
    } as unknown as IUnit;

    pipeline.queueAbility(attacker, target, 'bash_strike');
    pipeline.resolveFrame();
    expect(target.poiseAccum).toBe(0);
    expect(target.knockback).toBeCloseTo(142, 5);

    // End-of-frame sweep clears the duration-0 knockback entry.
    updateEffects(
      [target as unknown as Parameters<typeof updateEffects>[0][number]],
      0.016,
    );

    pipeline.queueAbility(attacker, target, 'bash_strike');
    pipeline.resolveFrame();
    // Second hit: threshold crossed again (100 poise >= 100), but
    // in-motion guard holds knockback at its prior value.
    expect(target.poiseAccum).toBe(0);
    expect(target.knockback).toBeCloseTo(142, 5);
  });

  it('non-blunt melee (Grunt jaw_strike) does NOT accumulate poise (gameplay change)', () => {
    // Documented gameplay shift: sharp/heat/electric/etc. no longer
    // contribute to poise. Only blunt (via DEFAULT_EFFECTS) or
    // abilities with explicit appliesEffects: ['knockback']. Grunt's
    // jaw_strike is sharp → no knockback default → no poise.
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);
    pipeline.on('post_apply', applyEffectsPhase);

    const attacker = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      atk: 5,
      knockForce: 0,
    } as unknown as IUnit;
    const target = {
      id: ++_id, x: 30, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
      knockResist: 0,
      poiseAccum: 0,
      knockback: 0,
      facing: -1,
      activeEffects: [],
    } as unknown as IUnit;

    pipeline.queueAbility(attacker, target, 'jaw_strike');
    pipeline.resolveFrame();
    expect(target.poiseAccum).toBe(0);
    expect(target.knockback).toBe(0);
  });
});

describe('stun effect — Phase 10 Batch 4 (ActiveEffect-only, no legacy shim)', () => {
  it('stun EffectDef duration is 0.6 (legacy parity)', () => {
    const stunDef = lookupEffect('stun');
    expect(stunDef.duration).toBe(0.6);
  });

  it('applyEffect("stun") lands an ActiveEffect with remaining = def.duration', () => {
    const target = {
      dead: false,
      activeEffects: [] as any[],
      x: 0, y: 0,
      unitW: 20, unitH: 20,
    } as unknown as IUnit;

    applyEffect(target, 'stun');

    expect(target.activeEffects!.length).toBe(1);
    expect(target.activeEffects![0].def.name).toBe('stun');
    expect(target.activeEffects![0].remaining).toBe(0.6);
  });

  it('hasActiveEffect(target, "stun") returns true while the entry persists', () => {
    const target = {
      dead: false,
      activeEffects: [] as any[],
      x: 0, y: 0,
      unitW: 20, unitH: 20,
    } as unknown as IUnit;

    applyEffect(target, 'stun');
    expect(hasActiveEffect(target, 'stun')).toBe(true);

    updateEffects(
      [target as unknown as Parameters<typeof updateEffects>[0][number]],
      0.7, // > 0.6 duration → sweeps
    );
    expect(hasActiveEffect(target, 'stun')).toBe(false);
  });

  it('non-stackable re-application refreshes remaining via MAX, does NOT re-fire onApply', () => {
    const target = {
      dead: false,
      activeEffects: [] as any[],
      x: 0, y: 0,
      unitW: 20, unitH: 20,
    } as unknown as IUnit;

    applyEffect(target, 'stun');
    expect(target.activeEffects![0].remaining).toBe(0.6);

    // Simulate partial expiry — decrement remaining directly.
    target.activeEffects![0].remaining = 0.2;

    // Re-apply: remaining refreshed to MAX(0.2, 0.6) = 0.6, but no
    // second ActiveEffect instance appended.
    applyEffect(target, 'stun');
    expect(target.activeEffects![0].remaining).toBe(0.6);
    expect(target.activeEffects!.length).toBe(1);
  });
});

// ------------------------------------------------------------------
// Phase 8 Stage 5 item 16 — Stormfly migration
// ------------------------------------------------------------------

describe('phase8 Stage 5 item 16 — Stormfly migration', () => {
  it('stormflyDef declares defaultAbility = "chain_lightning"', () => {
    const def = UNIT_DEFS.stormfly;
    expect(def).toBeDefined();
    expect(def.defaultAbility).toBe('chain_lightning');
  });

  it('chain_lightning ability data carries targetFalloff + overchargeEvery', () => {
    const ability = lookupAbility('chain_lightning');
    expect(ability.targetFalloff).toEqual([1.0, 0.7, 0.4]);
    expect(ability.overchargeEvery).toBe(4);
    expect(ability.targetCount).toBe(3);
    expect(ability.targeting).toBe('nearest_enemies_in_range');
    expect(ability.range).toBe(130);
    // appliesEffects undefined post Phase 10 Batch 3 — stun applies
    // via DEFAULT_EFFECTS['electric'] (gated by effectChance: 0.25).
    expect(ability.appliesEffects).toBeUndefined();
  });

  // --- Deterministic per-target damage via real calculate phase ---
  // Calculate phase formula (post Phase 10 Batch 2):
  //   finalDamage = applyModifiers(u, u.atk, 'atk')
  //               × tiers[effectiveTier].dmgMult
  //               × targetFalloff[_targetIndex]
  //               × damageMultiplier  (overcharge)
  // Attack cycle sets _targetIndex per target and damageMultiplier
  // = overcharge (1 or 2). No baseDamageOverride — the ability data
  // (targetFalloff) drives per-target damage.

  const STORMFLY_ATK = 50;

  /**
   * Simulate the multi-target attack cycle's queue loop for chain_lightning.
   * Mirrors CombatSystem.ts multi-target branch exactly — no override,
   * just _targetIndex + damageMultiplier mutations on queued events.
   */
  function queueChainLightning(
    pipeline: CombatPipeline,
    attacker: WorldEntity,
    targets: WorldEntity[],
    overcharge: number,
  ): void {
    for (let i = 0; i < targets.length; i++) {
      const event = pipeline.queueAbility(attacker, targets[i], 'chain_lightning');
      event._targetIndex = i;
      event.damageMultiplier = overcharge;
    }
  }

  it('normal cast: calculate phase produces deterministic finalDamage for all 3 targets', () => {
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    const captures: number[] = [];
    pipeline.on('apply', (e: DamageEvent) => {
      captures.push(e.finalDamage);
      e.cancelled = true;
    });

    const attacker: WorldEntity & { atk: number } = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      atk: STORMFLY_ATK,
    };
    const targets: WorldEntity[] = [];
    for (let i = 0; i < 3; i++) {
      targets.push({
        id: ++_id, x: 10 + i * 30, y: 0, dead: false,
        components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
      });
    }

    queueChainLightning(pipeline, attacker, targets, 1);
    pipeline.resolveFrame();

    expect(captures.length).toBe(3);
    // 50 × 1.0 × 1.0 = 50, 50 × 1.0 × 0.7 = 35, 50 × 1.0 × 0.4 = 20.
    expect(captures[0]).toBe(50);
    expect(captures[1]).toBe(35);
    expect(captures[2]).toBe(20);
  });

  it('overcharge cast (every 4th): calculate phase doubles damage via event.damageMultiplier', () => {
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    const captures: number[] = [];
    pipeline.on('apply', (e: DamageEvent) => {
      captures.push(e.finalDamage);
      e.cancelled = true;
    });

    const attacker: WorldEntity & { atk: number } = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      atk: STORMFLY_ATK,
    };
    const targets: WorldEntity[] = [];
    for (let i = 0; i < 3; i++) {
      targets.push({
        id: ++_id, x: 10 + i * 30, y: 0, dead: false,
        components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
      });
    }

    queueChainLightning(pipeline, attacker, targets, 2);
    pipeline.resolveFrame();

    expect(captures.length).toBe(3);
    // 50 × 1.0 × 2 × falloff: 100, 70, 40.
    expect(captures[0]).toBe(100);
    expect(captures[1]).toBe(70);
    expect(captures[2]).toBe(40);
  });

  it('Centurion rally (+20% atk aura) folds into Stormfly chain via applyModifiers gate', () => {
    // Gameplay change introduced by Batch 2 — pre-Batch-2 the override
    // path bypassed applyModifiers; post-Batch-2 chain damage routes
    // through the real calculate phase and the rally modifier lands.
    // Stormfly under Centurion rally: casterBase = 50 × 1.2 = 60 →
    // per-target 60, 42, 24.
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    const captures: number[] = [];
    pipeline.on('apply', (e: DamageEvent) => {
      captures.push(e.finalDamage);
      e.cancelled = true;
    });

    const attacker: WorldEntity & { atk: number; modifiers: Modifier[] } = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      atk: STORMFLY_ATK,
      modifiers: [
        { stat: 'atk', type: 'percent', value: 20, source: 'aura:centurion:atk' },
      ],
    };
    const targets: WorldEntity[] = [];
    for (let i = 0; i < 3; i++) {
      targets.push({
        id: ++_id, x: 10 + i * 30, y: 0, dead: false,
        components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
      });
    }

    queueChainLightning(pipeline, attacker, targets, 1);
    pipeline.resolveFrame();

    expect(captures.length).toBe(3);
    // casterBase = 50 × 1.2 = 60. 60 × 1.0 = 60, 60 × 0.7 = 42, 60 × 0.4 = 24.
    expect(captures[0]).toBe(60);
    expect(captures[1]).toBe(42);
    expect(captures[2]).toBe(24);
  });

  it('Wardling dmg_taken aura (-20%) reduces chain damage on protected targets', () => {
    // Regression guard: modify phase must still run on multi-target
    // events post Batch 2. If the override path's removal accidentally
    // skipped the modify chain, Wardling's aura would stop protecting
    // allies from chain damage.
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    const captures: number[] = [];
    pipeline.on('apply', (e: DamageEvent) => {
      captures.push(e.finalDamage);
      e.cancelled = true;
    });

    const attacker: WorldEntity & { atk: number } = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      atk: STORMFLY_ATK,
    };
    // Target 0 (primary) is protected; targets 1-2 are not.
    const protectedTarget: WorldEntity & { modifiers: Modifier[] } = {
      id: ++_id, x: 10, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      modifiers: [
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'aura:wardling:dmg_taken' },
      ],
    };
    const targets: WorldEntity[] = [
      protectedTarget,
      { id: ++_id, x: 40, y: 0, dead: false, components: new Set<ComponentTag>(['HasHP', 'IsTargetable']) },
      { id: ++_id, x: 70, y: 0, dead: false, components: new Set<ComponentTag>(['HasHP', 'IsTargetable']) },
    ];

    queueChainLightning(pipeline, attacker, targets, 1);
    pipeline.resolveFrame();

    expect(captures.length).toBe(3);
    // T1 protected: 50 × 1.0 = 50 → aura × 0.8 = 40.
    expect(captures[0]).toBe(40);
    // T2/T3 unprotected: standard falloff.
    expect(captures[1]).toBe(35);
    expect(captures[2]).toBe(20);
  });

  it('overchargeEvery: 4 fires on ResourceSystem castCount cycle', () => {
    // Verify the formula the attack cycle uses: castCount incremented
    // per attack, overcharge when (castCount) % 4 === 0.
    // Cast 1: count becomes 1, 1%4≠0 → normal
    // Cast 4: count becomes 4, 4%4=0 → overcharge
    // Cast 8: count becomes 8, 8%4=0 → overcharge
    const entity = { resources: {} as Record<string, number> };
    const results: boolean[] = [];
    for (let cast = 1; cast <= 10; cast++) {
      const count = getResource(entity, 'castCount');
      addResource(entity, 'castCount', 1);
      results.push((count + 1) % 4 === 0);
    }
    // Overcharge at casts 4 and 8
    expect(results).toEqual([
      false, false, false, true,  // 1-4
      false, false, false, true,  // 5-8
      false, false,               // 9-10
    ]);
  });

  it('single-target abilities are NOT affected by multi-target branch', () => {
    // jaw_strike has targetCount=1, no targetFalloff, no overchargeEvery.
    // The canMigrate path takes the single-target branch (tc <= 1).
    const ability = lookupAbility('jaw_strike');
    expect(ability.targetCount).toBe(1);
    expect(ability.targetFalloff).toBeUndefined();
    expect(ability.overchargeEvery).toBeUndefined();
  });

  it('single-target parity unaffected by multi-target machinery', () => {
    // Grunt jaw_strike should produce exactly atk.
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    let captured = 0;
    pipeline.on('apply', (e: DamageEvent) => {
      captured = e.finalDamage;
      e.cancelled = true;
    });

    const attacker = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      atk: 5, // gruntDef.atk
    };
    const target = {
      id: ++_id, x: 10, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    };

    pipeline.queueAbility(attacker, target, 'jaw_strike');
    pipeline.resolveFrame();
    expect(captured).toBe(5);
  });
});

// ------------------------------------------------------------------
// Phase 8 Stage 5 item 17 — Longeye migration
// ------------------------------------------------------------------

describe('phase8 Stage 5 item 17 — Longeye migration', () => {
  it('longeyeDef declares defaultAbility = "piercing_shot"', () => {
    const def = UNIT_DEFS.longeye;
    expect(def).toBeDefined();
    expect(def.defaultAbility).toBe('piercing_shot');
  });

  it('piercing_shot ability data carries targetFalloff, no overchargeEvery', () => {
    const ability = lookupAbility('piercing_shot');
    expect(ability.targetFalloff).toEqual([1.0, 0.5]);
    expect(ability.overchargeEvery).toBeUndefined();
    expect(ability.targetCount).toBe(2);
    expect(ability.targeting).toBe('nearest_enemies_in_range');
    expect(ability.range).toBe(240);
    expect(ability.appliesEffects).toBeUndefined();
  });

  // --- Deterministic per-target damage via real calculate phase ---
  const LONGEYE_ATK = 60;

  function queuePiercingShot(
    pipeline: CombatPipeline,
    attacker: WorldEntity,
    targets: WorldEntity[],
  ): void {
    for (let i = 0; i < targets.length; i++) {
      const event = pipeline.queueAbility(attacker, targets[i], 'piercing_shot');
      event._targetIndex = i;
      // No overcharge — piercing_shot has no overchargeEvery.
      event.damageMultiplier = 1;
    }
  }

  it('calculate phase produces deterministic finalDamage for both targets', () => {
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    const captures: number[] = [];
    pipeline.on('apply', (e: DamageEvent) => {
      captures.push(e.finalDamage);
      e.cancelled = true;
    });

    const attacker: WorldEntity & { atk: number } = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      atk: LONGEYE_ATK,
    };
    const targets: WorldEntity[] = [
      { id: ++_id, x: 100, y: 0, dead: false, components: new Set<ComponentTag>(['HasHP', 'IsTargetable']) },
      { id: ++_id, x: 140, y: 0, dead: false, components: new Set<ComponentTag>(['HasHP', 'IsTargetable']) },
    ];

    queuePiercingShot(pipeline, attacker, targets);
    pipeline.resolveFrame();

    expect(captures.length).toBe(2);
    // 60 × 1.0 × 1.0 = 60, 60 × 1.0 × 0.5 = 30.
    expect(captures[0]).toBe(60);
    expect(captures[1]).toBe(30);
  });

  it('Centurion rally (+20% atk aura) folds into Longeye pierce via applyModifiers gate', () => {
    // Same gameplay change as Stormfly — rally now buffs pierce damage.
    // casterBase = 60 × 1.2 = 72 → T1 72, T2 36.
    const pipeline = new CombatPipeline();
    registerPhase8ModifyHandlers(pipeline);

    const captures: number[] = [];
    pipeline.on('apply', (e: DamageEvent) => {
      captures.push(e.finalDamage);
      e.cancelled = true;
    });

    const attacker: WorldEntity & { atk: number; modifiers: Modifier[] } = {
      id: ++_id, x: 0, y: 0, dead: false,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasModifiers']),
      atk: LONGEYE_ATK,
      modifiers: [
        { stat: 'atk', type: 'percent', value: 20, source: 'aura:centurion:atk' },
      ],
    };
    const targets: WorldEntity[] = [
      { id: ++_id, x: 100, y: 0, dead: false, components: new Set<ComponentTag>(['HasHP', 'IsTargetable']) },
      { id: ++_id, x: 140, y: 0, dead: false, components: new Set<ComponentTag>(['HasHP', 'IsTargetable']) },
    ];

    queuePiercingShot(pipeline, attacker, targets);
    pipeline.resolveFrame();

    expect(captures.length).toBe(2);
    expect(captures[0]).toBe(72);
    expect(captures[1]).toBe(36);
  });

  it('no overcharge: piercing_shot has no overchargeEvery field', () => {
    const ability = lookupAbility('piercing_shot');
    expect(ability.overchargeEvery).toBeUndefined();
  });

  it('deterministic baseline spot-check: T1=60, T2=30', () => {
    // Ability data pin — if targetFalloff drifts from [1.0, 0.5],
    // the deterministic calculate-phase output fails.
    const ability = lookupAbility('piercing_shot');
    expect(ability.targetFalloff).toEqual([1.0, 0.5]);
    expect(Math.round(LONGEYE_ATK * ability.targetFalloff![0])).toBe(60);
    expect(Math.round(LONGEYE_ATK * ability.targetFalloff![1])).toBe(30);
  });
});

// ------------------------------------------------------------------
// Phase 8 Stage 5 — Range-boundary primary target fix
// ------------------------------------------------------------------

describe('phase8 Stage 5 — primary target metric mismatch guard', () => {
  it('runSelectorInRange misses targets within _findTarget edge-to-edge range but outside left-edge range', () => {
    // Demonstrates the metric mismatch that causes the smoke bug.
    // _findTarget: edge-to-edge distance = e.x - (u.x + u.unitW)
    //   Stormfly at x=0 unitW=24 → leading edge at x=24
    //   Target at x=150 → edge-to-edge dist = 150 - 24 = 126 ≤ 130 (in range)
    // runSelectorInRange: left-edge distance = |e.x - u.x|
    //   Stormfly at x=0, target at x=150 → dist = 150 ≥ 130 (OUT of range)
    //
    // The multi-target attack cycle uses _findTarget's result as the
    // guaranteed primary (post-fix), so this mismatch only affects
    // whether the target ALSO appears in the selector results (it
    // doesn't, which is fine — the primary is already guaranteed).

    const stormfly = {
      id: ++_id, x: 0, y: 0, dead: false,
      side: 'player' as const,
      unitW: 24,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAI']),
    };
    const targetAtBoundary = {
      id: ++_id, x: 150, y: 0, dead: false,
      side: 'enemy' as const,
      unitW: 20,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAI']),
    };

    const ability = lookupAbility('chain_lightning');
    const results = runSelectorInRange(
      ability.targeting!,
      stormfly,
      ability,
      [stormfly, targetAtBoundary],
    );

    // Selector MISSES the target (150 >= 130 range threshold)
    expect(results.length).toBe(0);

    // But _findTarget would find it: edge-to-edge = 150 - 24 = 126 < 130
    // That's why the fix uses _findTarget's primary as guaranteed.
  });

  it('selector finds secondaries closer to attacker than the boundary primary', () => {
    // Secondaries at x=100 (well within 130 range) are found by the
    // selector even though the primary at x=150 was missed.
    const stormfly = {
      id: ++_id, x: 0, y: 0, dead: false,
      side: 'player' as const,
      unitW: 24,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAI']),
    };
    const secondary1 = {
      id: ++_id, x: 100, y: 0, dead: false,
      side: 'enemy' as const,
      unitW: 20,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAI']),
    };
    const secondary2 = {
      id: ++_id, x: 110, y: 0, dead: false,
      side: 'enemy' as const,
      unitW: 20,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAI']),
    };

    const ability = lookupAbility('chain_lightning');
    const results = runSelectorInRange(
      ability.targeting!,
      stormfly,
      ability,
      [stormfly, secondary1, secondary2],
    );

    // Both secondaries found (100 < 130, 110 < 130)
    expect(results.length).toBe(2);
  });
});

// ------------------------------------------------------------------
// Phase 8 Stage 5 — chainRange secondary selection
// ------------------------------------------------------------------

describe('phase8 Stage 5 — chainRange secondary selection', () => {
  it('chain_lightning declares chainRange: 114', () => {
    const ability = lookupAbility('chain_lightning');
    expect(ability.chainRange).toBe(114);
  });

  it('piercing_shot does NOT declare chainRange (attacker-centric)', () => {
    const ability = lookupAbility('piercing_shot');
    expect(ability.chainRange).toBeUndefined();
  });

  it('chainRange selects secondaries from primary, not attacker — far secondary within 114px of primary is hit', () => {
    // Stormfly at x=0, primary grub at x=130, secondary grub at x=200.
    // Distance from attacker to secondary: 200px > 130 range → selector MISSES.
    // Distance from primary to secondary: |200-130| = 70 ≤ 114 → chainRange HITS.
    // This is the exact scenario the smoke bug surfaced: legacy chained
    // from the primary, not the attacker.

    // We can't run the full attack cycle without CombatSystem, but we
    // can verify the inline chainRange filter logic directly.
    const primary = {
      id: ++_id, x: 130, y: 0, dead: false,
      side: 'enemy' as const, burrowed: false,
      unitW: 20, unitH: 20,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAI']),
    } as unknown as IUnit;

    const secondaryInChainRange = {
      id: ++_id, x: 200, y: 0, dead: false,
      side: 'enemy' as const, burrowed: false,
      unitW: 20, unitH: 20,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAI']),
    } as unknown as IUnit;

    const secondaryOutOfChainRange = {
      id: ++_id, x: 300, y: 0, dead: false,
      side: 'enemy' as const, burrowed: false,
      unitW: 20, unitH: 20,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAI']),
    } as unknown as IUnit;

    const attacker = {
      id: ++_id, x: 0, y: 0, dead: false,
      side: 'player' as const, burrowed: false,
      unitW: 24, unitH: 20,
    } as unknown as IUnit;

    // Reproduce the inline chainRange filter from the attack cycle
    const cr = 114;
    const allAlive = [attacker, primary, secondaryInChainRange, secondaryOutOfChainRange];
    const secondaries = (allAlive as IUnit[])
      .filter(e =>
        e !== primary &&
        e.side !== attacker.side &&
        !e.dead &&
        !(e as any).burrowed &&
        Math.abs(e.x - primary.x) <= cr,
      )
      .sort((a, b) =>
        Math.abs(a.x - primary.x) - Math.abs(b.x - primary.x),
      )
      .slice(0, 2); // tc - 1 = 3 - 1 = 2

    // secondaryInChainRange: |200-130| = 70 ≤ 114 → included
    // secondaryOutOfChainRange: |300-130| = 170 > 114 → excluded
    expect(secondaries.length).toBe(1);
    expect(secondaries[0]).toBe(secondaryInChainRange);
  });
});

// ------------------------------------------------------------------
// Phase 9 Batch 1 item 3 — Cinderfly aoeRider + afterHit deletion
// ------------------------------------------------------------------

describe('phase9 Batch 1 item 3 — aoeRider', () => {
  it('fire_bite declares aoeRider with burn, radius 85, targetCount 3, excludePrimary true', () => {
    const ability = lookupAbility('fire_bite');
    expect(ability.aoeRider).toEqual({
      effect: 'burn',
      radius: 85,
      targetCount: 3,
      excludePrimary: true,
    });
  });

  // Phase 9 Batch 3 Item 20 retired COMBAT_MAP + CombatHooks entirely.
  // The previous "no combat hooks in COMBAT_MAP" assertion is now
  // trivially true — the map no longer exists.

  it('applyAoeRiderPhase applies burn to secondaries within 85px of primary (center-to-center)', () => {
    // Set up the alive-list accessor with our test fixtures
    const primary = {
      id: ++_id, x: 100, y: 0, dead: false,
      side: 'enemy' as const, burrowed: false,
      unitW: 20, unitH: 14,
      activeEffects: [] as any[],
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    } as unknown as IUnit;

    const secondary1 = {
      id: ++_id, x: 150, y: 0, dead: false,
      side: 'enemy' as const, burrowed: false,
      unitW: 20, unitH: 14,
      activeEffects: [] as any[],
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    } as unknown as IUnit;

    const secondary2 = {
      id: ++_id, x: 170, y: 0, dead: false,
      side: 'enemy' as const, burrowed: false,
      unitW: 20, unitH: 14,
      activeEffects: [] as any[],
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    } as unknown as IUnit;

    const outOfRange = {
      id: ++_id, x: 300, y: 0, dead: false,
      side: 'enemy' as const, burrowed: false,
      unitW: 20, unitH: 14,
      activeEffects: [] as any[],
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    } as unknown as IUnit;

    const attacker = {
      id: ++_id, x: 50, y: 0, dead: false,
      side: 'player' as const,
      unitW: 20, unitH: 14,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    } as unknown as IUnit;

    // Wire the alive-list accessor for this test
    setAoeRiderAliveAccessor(() => [attacker, primary, secondary1, secondary2, outOfRange]);

    const ability = lookupAbility('fire_bite');
    const event = {
      cancelled: false,
      ability,
      target: primary,
      attacker,
      effects: ['burn'],
    } as unknown as DamageEvent;

    applyAoeRiderPhase(event);

    // secondary1: center 160, primary center 110 → dist 50 < 85 → burn applied
    expect((secondary1 as any).activeEffects.length).toBe(1);
    expect((secondary1 as any).activeEffects[0].def.name).toBe('burn');

    // secondary2: center 180, primary center 110 → dist 70 < 85 → burn applied
    expect((secondary2 as any).activeEffects.length).toBe(1);
    expect((secondary2 as any).activeEffects[0].def.name).toBe('burn');

    // outOfRange: center 310, primary center 110 → dist 200 > 85 → no burn
    expect((outOfRange as any).activeEffects.length).toBe(0);

    // primary: excludePrimary=true → no rider burn (already gets burn from appliesEffects)
    expect((primary as any).activeEffects.length).toBe(0);

    // Reset
    setAoeRiderAliveAccessor(() => []);
  });

  it('applyAoeRiderPhase caps at targetCount (3 secondaries max)', () => {
    const primary = {
      id: ++_id, x: 100, y: 0, dead: false,
      side: 'enemy' as const, burrowed: false,
      unitW: 20, unitH: 14,
      activeEffects: [] as any[],
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    } as unknown as IUnit;

    const attacker = {
      id: ++_id, x: 50, y: 0, dead: false,
      side: 'player' as const,
      unitW: 20, unitH: 14,
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    } as unknown as IUnit;

    // 5 secondaries all within range — only 3 should get burn
    const secs = Array.from({ length: 5 }, (_, i) => ({
      id: ++_id, x: 110 + i * 10, y: 0, dead: false,
      side: 'enemy' as const, burrowed: false,
      unitW: 20, unitH: 14,
      activeEffects: [] as any[],
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    } as unknown as IUnit));

    setAoeRiderAliveAccessor(() => [attacker, primary, ...secs]);

    const ability = lookupAbility('fire_bite');
    const event = {
      cancelled: false,
      ability,
      target: primary,
      attacker,
      effects: ['burn'],
    } as unknown as DamageEvent;

    applyAoeRiderPhase(event);

    const burned = secs.filter(s => (s as any).activeEffects.length > 0);
    expect(burned.length).toBe(3);

    setAoeRiderAliveAccessor(() => []);
  });

  it('applyAoeRiderPhase no-ops when ability has no aoeRider', () => {
    const target = {
      id: ++_id, x: 0, y: 0, dead: false,
      side: 'enemy' as const,
      unitW: 20, unitH: 14,
      activeEffects: [] as any[],
      components: new Set<ComponentTag>(['HasHP', 'IsTargetable']),
    } as unknown as IUnit;

    const ability = lookupAbility('jaw_strike');
    expect(ability.aoeRider).toBeUndefined();

    const event = {
      cancelled: false,
      ability,
      target,
      attacker: target,
      effects: [],
    } as unknown as DamageEvent;

    applyAoeRiderPhase(event);
    expect((target as any).activeEffects.length).toBe(0);
  });

  it('all units carry defaultAbility — zero legacy-only attackers', () => {
    const allUnitKeys = Object.keys(UNIT_DEFS);
    for (const key of allUnitKeys) {
      const def = UNIT_DEFS[key];
      expect(def.defaultAbility, `${key} should have defaultAbility`).toBeDefined();
    }
  });
});

// ------------------------------------------------------------------
// Windup-drift target-lock: a swing commits to the foe locked at its
// start, instead of snapping damage to whoever's nearest at impact.
// ------------------------------------------------------------------
describe('resolveImpactTarget — windup-drift target-lock', () => {
  const foe = (over: Partial<IUnit> = {}): IUnit =>
    ({ dead: false, burrowed: false, side: 'enemy', lane: 0, ...over } as IUnit);
  const attacker = foe({ side: 'player' });

  it('commits to the locked foe when it is still valid (a closer foe drifted in)', () => {
    const locked = foe();
    const nearest = foe();
    expect(resolveImpactTarget(locked, nearest, attacker)).toBe(locked);
  });

  it('falls back to nearest when the locked foe died or burrowed', () => {
    const nearest = foe();
    expect(resolveImpactTarget(foe({ dead: true }), nearest, attacker)).toBe(nearest);
    expect(resolveImpactTarget(foe({ burrowed: true }), nearest, attacker)).toBe(nearest);
  });

  it('falls back when the locked unit left the lane or is friendly', () => {
    const nearest = foe();
    expect(resolveImpactTarget(foe({ lane: 1 }), nearest, attacker)).toBe(nearest);
    expect(resolveImpactTarget(foe({ side: 'player' }), nearest, attacker)).toBe(nearest);
  });

  it('falls back to nearest when there is no lock', () => {
    const nearest = foe();
    expect(resolveImpactTarget(null, nearest, attacker)).toBe(nearest);
    expect(resolveImpactTarget(undefined, nearest, attacker)).toBe(nearest);
  });
});

// ------------------------------------------------------------------
// Signature whiff guard: a DAMAGE signature with no foe in range must
// not consume its cooldown (it stays ready instead of misfiring).
// ------------------------------------------------------------------
describe('signatureWouldWhiff — no-target cooldown guard', () => {
  const caster = ({
    side: 'player', lane: 0, x: 100, unitW: 20, range: 70, dead: false, burrowed: false,
  } as unknown as IUnit);

  it('a DAMAGE signature with no foes in range whiffs (cooldown must be spared)', () => {
    expect(signatureWouldWhiff(lookupAbility('stampede'), caster, [])).toBe(true);
  });

  it('a non-damage (utility/buff) signature is never whiff-blocked', () => {
    const utility = { ...lookupAbility('stampede'), category: 'utility' } as AbilityDef;
    expect(signatureWouldWhiff(utility, caster, [])).toBe(false);
  });
});
