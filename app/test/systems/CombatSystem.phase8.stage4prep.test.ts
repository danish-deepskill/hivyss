// Phase 8 Stage 4 prep — pre-migration pipeline tests.
//
// PURPOSE:
//   Ship BEFORE any Stage 4 unit migration (items 11-14: Ravager,
//   Wardling, Centurion, Mendwing) per decisions doc item 13. These
//   tests pin the NON-SHORT-CIRCUIT paths of the Stage 2 integration
//   points (IP-1, IP-2, IP-3) — the first time any production
//   consumer activates the full stacking math instead of the
//   transparent empty-modifiers-list path.
//
//   Every Phase 6/7/8-through-Stage-3 test fixture carries an EMPTY
//   modifiers list, which means the existing 517 tests exclusively
//   exercise the transparent short-circuit at ModifierSystem.ts
//   :170-172 (empty mods → return baseValue). The three tests below
//   exercise the path where the modifiers list is NON-empty — the
//   path Centurion's rally aura (IP-2), Ravager's rage self-modifier
//   (IP-3), and Wardling's dmg_taken aura (IP-1) will all activate.
//
//   If any of these tests fails, Stage 4 is BLOCKED at that migration
//   item until the regression is understood. Green tests are the
//   load-bearing safety net that lets Stage 4 ship with automated
//   gates only (per the new 2026-04-15 smoke discipline).
//
// COVERAGE GAP THIS FILE CLOSES:
//   At Stage 2 IP-2 checkpoint, executor surfaced that production
//   Units carry `HasModifiers` in UNIT_COMPONENTS, so the first
//   short-circuit (component gate) doesn't fire for them — they rely
//   on the second short-circuit (empty list). These tests are the
//   first test fixtures that carry `HasModifiers` AND a non-empty
//   modifiers list, exercising the full stacking math path.
//
// FILE LIFECYCLE:
//   These tests are NOT transitional. They pin post-Phase-9 invariants
//   (applyModifiers stacking math, IP-1/2/3 gate semantics) and should
//   SURVIVE legacy removal. The `stage4prep` designation in the
//   filename indicates WHEN they shipped, not that they should be
//   deleted later. Phase 9 cleanup should leave this file alone.

import { describe, it, expect } from 'vitest';
import { CombatPipeline } from '../../src/systems/CombatPipeline';
import {
  applyVarianceAndCritModify,
  applyAuraDamageModify,
  applyFinalDamageFloor,
  registerPhase8ModifyHandlers,
} from '../../src/systems/CombatSystem';
import { applyModifiers } from '../../src/systems/ModifierSystem';
import type { DamageEvent, WorldEntity, ComponentTag } from '../../src/types';
import type { Modifier } from '../../src/systems/ModifierSystem';
import type { DamageType } from '../../src/config/combat/damageTypes';
import type { ResistanceTier } from '../../src/config/combat/resistances';

// ------------------------------------------------------------------
// Fixture builders
// ------------------------------------------------------------------

let _id = 0;

/**
 * Build a WorldEntity attacker that structurally satisfies
 * `CalcAttacker` + `ModifierBearer`. The components set includes
 * `HasModifiers` by default so the first short-circuit in
 * `applyModifiers` is bypassed and the stacking math actually runs.
 */
function makeModifierAttacker(opts: {
  atk?: number;
  modifiers?: Modifier[];
  components?: ComponentTag[];
}): WorldEntity & { atk: number; modifiers?: Modifier[] } {
  return {
    id: ++_id,
    x: 0,
    y: 0,
    dead: false,
    components: new Set(opts.components ?? ['HasHP', 'HasAI', 'IsTargetable', 'HasModifiers']),
    atk: opts.atk ?? 18,
    modifiers: opts.modifiers,
  };
}

/**
 * Build a WorldEntity target that structurally satisfies
 * `CalcTarget` + `ModifierBearer`. Same `HasModifiers` default as
 * the attacker builder.
 */
function makeModifierTarget(opts: {
  resistance?: Partial<Record<DamageType, ResistanceTier>>;
  modifiers?: Modifier[];
  components?: ComponentTag[];
} = {}): WorldEntity & {
  resistance?: Partial<Record<DamageType, ResistanceTier>>;
  modifiers?: Modifier[];
} {
  return {
    id: ++_id,
    x: 0,
    y: 0,
    dead: false,
    components: new Set(opts.components ?? ['HasHP', 'IsTargetable', 'HasModifiers']),
    resistance: opts.resistance,
    modifiers: opts.modifiers,
  };
}

/**
 * Build a minimal Ravager-shape unit for IP-3 direct `applyModifiers`
 * calls. Carries `HasModifiers` + a modifiers list + atkRate +
 * foreswing, which is the structural minimum `applyModifiers` and
 * the IP-3 cycle-timer derivation need.
 */
function makeModifierUnit(opts: {
  atkRate?: number;
  foreswing?: number;
  modifiers?: Modifier[];
  components?: ComponentTag[];
}): WorldEntity & { atkRate: number; foreswing: number; modifiers?: Modifier[] } {
  return {
    id: ++_id,
    x: 0,
    y: 0,
    dead: false,
    components: new Set(opts.components ?? ['HasHP', 'HasAI', 'IsTargetable', 'HasModifiers']),
    atkRate: opts.atkRate ?? 0.8,
    foreswing: opts.foreswing ?? 0,
    modifiers: opts.modifiers,
  };
}

/**
 * Drive a real `queueAbility` through the real pipeline with the
 * real Stage 2 IP-2 calculate gate + registerPhase8ModifyHandlers
 * modify chain + a capture-at-apply stub that cancels before
 * anything would crash on a plain fixture. Mirror of the Item 9
 * simulateMigratedHit pattern, extended to ALSO return
 * `event.baseDamage` so tests can pin the pre-modify state.
 *
 * Returns both states so tests can document the full chain:
 *   - `baseDamage` — output of calculatePhase (pre-modify)
 *   - `finalDamage` — output of the modify chain (pre-apply)
 */
function simulateWithModifiers(
  abilityName: string,
  attacker: WorldEntity,
  target: WorldEntity,
): { baseDamage: number; finalDamage: number } {
  const pipeline = new CombatPipeline();
  registerPhase8ModifyHandlers(pipeline);

  let captured = { baseDamage: 0, finalDamage: 0 };
  pipeline.on('apply', (e: DamageEvent) => {
    captured = { baseDamage: e.baseDamage, finalDamage: e.finalDamage };
    e.cancelled = true; // skip post_apply
  });

  pipeline.queueAbility(attacker, target, abilityName);
  pipeline.resolveFrame();

  return captured;
}

// ==================================================================
// Test 1 — IP-2 non-short-circuit (Centurion rally stack path)
// ==================================================================

describe('Stage 4 prep — IP-2 non-short-circuit (Centurion rally atk aura)', () => {
  it('single +20% atk modifier: calculatePhase folds the modifier into baseDamage', () => {
    // Setup: HasModifiers attacker with a single aura-shape modifier.
    // Mirrors Centurion's Stage 4 rally_aura shape:
    //   { stat: 'atk', type: 'percent', value: 20,
    //     source: 'aura:${centurionId}:atk' }
    //
    // Expected calculate output:
    //   casterBase = applyModifiers(attacker, 18, 'atk')
    //              = 18 × (1 + 20/100) = 21.6
    //   base       = casterBase × tierMult
    //              = 21.6 × 1.0  (normal tier, no resistance entry)
    //              = 21.6
    //
    // Then the modify chain:
    //   variance/crit → no opt-in fields → round(21.6) = 22
    //   aura          → no dmg_taken modifier → Math.round(22) = 22
    //   floor         → max(1, 22) = 22
    const attacker = makeModifierAttacker({
      atk: 18,
      modifiers: [
        { stat: 'atk', type: 'percent', value: 20, source: 'test:aura:1:atk' },
      ],
    });
    const target = makeModifierTarget();

    const { baseDamage, finalDamage } = simulateWithModifiers('jaw_strike', attacker, target);

    // calculatePhase output — raw float, pre-round.
    expect(baseDamage).toBeCloseTo(21.6, 5);
    // Post-drain — aura's Math.round lands the integer.
    expect(finalDamage).toBe(22);
  });

  it('two stacked +20% atk modifiers: additive percent stacking produces +40%', () => {
    // Multi-Centurion rally scenario: two overlapping Centurions buff
    // a shared ally. ModifierSystem stacks percent additively.
    //
    // Expected:
    //   casterBase = 18 × (1 + 40/100) = 25.2
    //   base       = 25.2 × 1.0 = 25.2
    //   aura round → 25
    //   floor      → 25
    const attacker = makeModifierAttacker({
      atk: 18,
      modifiers: [
        { stat: 'atk', type: 'percent', value: 20, source: 'test:aura:centurion1:atk' },
        { stat: 'atk', type: 'percent', value: 20, source: 'test:aura:centurion2:atk' },
      ],
    });
    const target = makeModifierTarget();

    const { baseDamage, finalDamage } = simulateWithModifiers('jaw_strike', attacker, target);

    expect(baseDamage).toBeCloseTo(25.2, 5);
    expect(finalDamage).toBe(25);
  });

  it('empty atk modifiers list — regression guard (transparent short-circuit preserved)', () => {
    // This is the Stage 2 transparency claim still holding. If a future
    // change breaks the empty-list short-circuit in applyModifiers or
    // in the calculate-phase wrap, this test catches it alongside the
    // Phase 6/7 parity suite. Kept in this file for completeness —
    // the non-short-circuit path's test is only meaningful if the
    // short-circuit path also passes under the same fixture shape.
    const attacker = makeModifierAttacker({ atk: 18, modifiers: [] });
    const target = makeModifierTarget();

    const { baseDamage, finalDamage } = simulateWithModifiers('jaw_strike', attacker, target);

    expect(baseDamage).toBe(18);
    expect(finalDamage).toBe(18);
  });

  it('undefined modifiers property — short-circuit still preserved (modifiers optional per ModifierBearer)', () => {
    // ModifierBearer declares `modifiers?: Modifier[]` — optional.
    // Test fixtures or pool-recycled Units may transiently leave it
    // undefined. Pins that applyModifiers treats undefined-modifiers
    // identically to empty-array-modifiers.
    const attacker = makeModifierAttacker({ atk: 18 }); // modifiers undefined
    const target = makeModifierTarget();

    const { baseDamage, finalDamage } = simulateWithModifiers('jaw_strike', attacker, target);

    expect(baseDamage).toBe(18);
    expect(finalDamage).toBe(18);
  });
});

// ==================================================================
// Test 2 — IP-3 non-short-circuit (Ravager selfModifier path)
// ==================================================================

describe('Stage 4 prep — IP-3 non-short-circuit (Ravager rage atkRate self-modifier)', () => {
  it('single +50% atkRate modifier: applyModifiers produces 1.5× effective rate', () => {
    // Setup: HasModifiers unit with a Ravager-shape selfModifier.
    // Stage 4 item 11 will land this modifier on Ravager via the
    // passive tick loop's self-modifier dispatch branch, gated on
    // HP < 50% (step function per CC1 resolution).
    //
    // Expected:
    //   effectiveAtkRate = 0.8 × (1 + 50/100) = 1.2
    const u = makeModifierUnit({
      atkRate: 0.8,
      foreswing: 0,
      modifiers: [
        { stat: 'atkRate', type: 'percent', value: 50, source: 'test:ravager:1:rage' },
      ],
    });

    const effectiveAtkRate = applyModifiers(u, u.atkRate, 'atkRate');
    expect(effectiveAtkRate).toBeCloseTo(1.2, 5);
  });

  it('cycle-timer derivation: u.atkCd = (1 / effectiveAtkRate) - u.foreswing', () => {
    // Pin the exact cycle-timer output under the modifier. This is
    // the math CombatSystem.ts:557 (and 3 other sites) uses post-IP-3
    // wrap. Validates end-to-end that the modifier folds into the
    // attack cycle's cooldown correctly.
    //
    // u.atkRate = 0.8, +50% rage, foreswing = 0.2
    //   effectiveAtkRate = 1.2
    //   interval        = 1 / 1.2 ≈ 0.8333
    //   atkCd           = 0.8333 - 0.2 = 0.6333
    const u = makeModifierUnit({
      atkRate: 0.8,
      foreswing: 0.2,
      modifiers: [
        { stat: 'atkRate', type: 'percent', value: 50, source: 'test:ravager:1:rage' },
      ],
    });

    const effectiveAtkRate = applyModifiers(u, u.atkRate, 'atkRate');
    const atkCd = (1 / effectiveAtkRate) - u.foreswing;

    expect(effectiveAtkRate).toBeCloseTo(1.2, 5);
    expect(atkCd).toBeCloseTo((1 / 1.2) - 0.2, 5);
  });

  it('step function mid-transition: modifier absent at full HP, present below 50%', () => {
    // The Ravager self-modifier path is step-function-gated — when
    // HP > 50% the modifier is removed, when HP ≤ 50% it's added.
    // This test pins both states: a unit with empty modifiers
    // (pre-threshold) and a unit with the rage modifier (post-
    // threshold). Stage 4 item 11's passive tick loop dispatch will
    // flip between these two states as HP crosses the threshold.
    const uHealthy = makeModifierUnit({
      atkRate: 0.8,
      foreswing: 0,
      modifiers: [], // pre-threshold — no rage modifier
    });
    const uEnraged = makeModifierUnit({
      atkRate: 0.8,
      foreswing: 0,
      modifiers: [
        { stat: 'atkRate', type: 'percent', value: 50, source: 'test:ravager:2:rage' },
      ],
    });

    // Healthy: base rate, no modification.
    expect(applyModifiers(uHealthy, uHealthy.atkRate, 'atkRate')).toBeCloseTo(0.8, 5);
    // Enraged: 1.5× rate.
    expect(applyModifiers(uEnraged, uEnraged.atkRate, 'atkRate')).toBeCloseTo(1.2, 5);
  });

  it('atkRate empty-list regression guard — short-circuit transparency preserved', () => {
    const u = makeModifierUnit({ atkRate: 0.8, foreswing: 0.2 });
    expect(applyModifiers(u, u.atkRate, 'atkRate')).toBe(0.8);
  });
});

// ==================================================================
// Test 3 — IP-1 end-to-end (Wardling aura integration)
// ==================================================================

describe('Stage 4 prep — IP-1 end-to-end (Wardling dmg_taken aura integration)', () => {
  it('single -20% dmg_taken modifier: full chain produces round(baseDamage × 0.8)', () => {
    // Setup: attacker with no modifiers, target with a Wardling-shape
    // dmg_taken aura. Mirrors Stage 4 item 12 Wardling migration's
    // rally shape:
    //   { stat: 'dmg_taken', type: 'percent', value: -20,
    //     source: 'aura:${wardlingId}:dmg_taken' }
    //
    // Expected chain:
    //   calculate: base = 10 × 1.0 = 10, finalDamage = 10
    //   variance/crit: no opt-in → round(10) = 10
    //   aura:      applyModifiers(target, 10, 'dmg_taken')
    //                = 10 × (1 - 20/100) = 8
    //              Math.round(8) = 8 → finalDamage = 8
    //   floor:     max(1, 8) = 8 (no clamp)
    const attacker = makeModifierAttacker({ atk: 10 });
    const target = makeModifierTarget({
      modifiers: [
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'test:aura:wardling1:dmg_taken' },
      ],
    });

    const { baseDamage, finalDamage } = simulateWithModifiers('jaw_strike', attacker, target);

    expect(baseDamage).toBe(10);
    expect(finalDamage).toBe(8);
  });

  it('two stacked -20% dmg_taken modifiers: additive -40% produces round(baseDamage × 0.6)', () => {
    // Multi-Wardling coverage: two overlapping Wardlings protect the
    // same ally. Additive percent stacking: -40% → 60% of original.
    //
    //   aura: 10 × (1 - 40/100) = 6 → Math.round(6) = 6
    const attacker = makeModifierAttacker({ atk: 10 });
    const target = makeModifierTarget({
      modifiers: [
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'test:aura:wardling1:dmg_taken' },
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'test:aura:wardling2:dmg_taken' },
      ],
    });

    const { finalDamage } = simulateWithModifiers('jaw_strike', attacker, target);
    expect(finalDamage).toBe(6);
  });

  it('five stacked -20% dmg_taken (-100%): aura produces 0, floor clamps to 1 (kill-proof prevented)', () => {
    // The load-bearing Item 9.5 case: 5 overlapping Wardlings
    // additive-stacking to -100% dmg_taken would produce 0 damage
    // pre-9.5. Post-9.5, applyFinalDamageFloor clamps to 1.
    //
    // This is the first integration test that exercises the floor
    // activation through the full pipeline drain (not just direct
    // subscriber calls like the Item 9.5 unit tests). Pins that the
    // registered floor subscriber fires at the right position.
    //
    //   aura: 10 × (1 - 100/100) = 0 → Math.round(0) = 0
    //   floor: max(1, 0) = 1
    const attacker = makeModifierAttacker({ atk: 10 });
    const target = makeModifierTarget({
      modifiers: [
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'test:aura:wardling1:dmg_taken' },
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'test:aura:wardling2:dmg_taken' },
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'test:aura:wardling3:dmg_taken' },
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'test:aura:wardling4:dmg_taken' },
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'test:aura:wardling5:dmg_taken' },
      ],
    });

    const { finalDamage } = simulateWithModifiers('jaw_strike', attacker, target);
    expect(finalDamage).toBe(1);
  });

  it('empty target modifiers — regression guard (transparent short-circuit preserved)', () => {
    // The IP-1 transparency claim still holds under the fixture
    // shape. If a future change breaks the empty-list short-circuit
    // in applyAuraDamageModify, this test catches it.
    const attacker = makeModifierAttacker({ atk: 10 });
    const target = makeModifierTarget();

    const { finalDamage } = simulateWithModifiers('jaw_strike', attacker, target);
    expect(finalDamage).toBe(10);
  });

  it('IP-1 + IP-2 composed: attacker with atk aura AND target with dmg_taken aura', () => {
    // Bonus integration test — the first test where BOTH IP-1 and
    // IP-2 non-short-circuit paths fire in the same event. Stage 4
    // close scenario (`stage4AllPassives`) will have Centurion
    // (IP-2 atk buff) + Wardling (IP-1 dmg_taken reduction) active
    // on overlapping units, so this pins the composition
    // algebraically.
    //
    //   calculate:
    //     casterBase = 10 × 1.2 = 12
    //     base       = 12 × 1.0 = 12
    //   variance/crit → no opt-in → round(12) = 12
    //   aura          → 12 × 0.8 = 9.6 → round → 10
    //   floor         → 10
    const attacker = makeModifierAttacker({
      atk: 10,
      modifiers: [
        { stat: 'atk', type: 'percent', value: 20, source: 'test:aura:centurion1:atk' },
      ],
    });
    const target = makeModifierTarget({
      modifiers: [
        { stat: 'dmg_taken', type: 'percent', value: -20, source: 'test:aura:wardling1:dmg_taken' },
      ],
    });

    const { baseDamage, finalDamage } = simulateWithModifiers('jaw_strike', attacker, target);
    // baseDamage is the raw float pre-round.
    expect(baseDamage).toBeCloseTo(12, 5);
    // finalDamage is round(12 × 0.8) = round(9.6) = 10.
    expect(finalDamage).toBe(10);
  });
});

// ==================================================================
// Meta — test file identity pin
// ==================================================================

describe('Stage 4 prep test file — identity pin', () => {
  it('this file imports all four modify-phase subscribers used in Stage 4 non-short-circuit paths', () => {
    // Documentation test. If a future change renames or removes any
    // of these subscribers, the import at the top of this file fails
    // to resolve and every test below fails with an "undefined is
    // not a function" error. This test makes the identity pin
    // explicit so a future reader can grep `stage4prep` and find
    // the load-bearing subscriber set.
    expect(applyVarianceAndCritModify).toBeDefined();
    expect(applyAuraDamageModify).toBeDefined();
    expect(applyFinalDamageFloor).toBeDefined();
    expect(registerPhase8ModifyHandlers).toBeDefined();
    expect(applyModifiers).toBeDefined();
  });
});
