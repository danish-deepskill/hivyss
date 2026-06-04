// Migrated-path damage parity tests.
//
// Scope: verify that every unit's basic attack routes through the new
// pipeline and produces the expected deterministic damage against
// resistance-neutral and resistance-tier targets. Also pins the
// architectural capability of the opt-in variance/crit path so future
// cleanup passes can't delete it as "dead code."
//
// Strategy: do NOT instantiate CombatSystem (it pulls in Phaser).
// Instead, build a fresh CombatPipeline, register the modify-phase
// subscribers, queue events the same way the migrated routing fork
// does. Compare `finalDamage` to the deterministic expectation
// `max(1, round(atk × tierMult))`.
//
// Per-unit defs are validated against the actual UNIT_DEFS registry
// to catch any drift between the unit file and the test expectations.

import { describe, it, expect } from 'vitest';
import { CombatPipeline } from '../../src/systems/CombatPipeline';
import { applyVarianceAndCritModify } from '../../src/systems/CombatPhases';
import { UNIT_DEFS } from '../../src/units/registry';
import type {
  AbilityDef,
  DamageEvent,
  WorldEntity,
  ComponentTag,
} from '../../src/types';
import type { DamageType } from '../../src/config/combat/damageTypes';
import type { ResistanceTier } from '../../src/config/combat/resistances';

// ------------------------------------------------------------------
// Fixture builders
// ------------------------------------------------------------------

let _id = 0;
function makeEntity(opts: {
  atk?: number;
  hp?: number;
  resistance?: Partial<Record<DamageType, ResistanceTier>>;
  components?: ComponentTag[];
} = {}): WorldEntity & {
  atk: number;
  hp: number;
  resistance?: Partial<Record<DamageType, ResistanceTier>>;
} {
  return {
    id: ++_id,
    x: 0,
    y: 0,
    dead: false,
    components: new Set(opts.components ?? ['HasHP', 'HasAI', 'IsTargetable']),
    atk: opts.atk ?? 20,
    hp: opts.hp ?? 100,
    resistance: opts.resistance,
  };
}

/** Deterministic baseline — `max(1, round(atk × tierMult))`. */
function deterministicDmg(atk: number, tierMult: number = 1): number {
  return Math.max(1, Math.round(atk * tierMult));
}

/**
 * Migrated path simulator: build a fresh pipeline with the variance/
 * crit modify subscriber, queue the real ability, drain, return the
 * finalDamage that landed.
 */
function simulateMigratedHit(
  abilityName: string,
  atk: number,
  targetResistance?: Partial<Record<DamageType, ResistanceTier>>,
): number {
  const pipeline = new CombatPipeline();
  pipeline.on('modify', applyVarianceAndCritModify);

  let captured = 0;
  pipeline.on('apply', (e: DamageEvent) => {
    captured = e.finalDamage;
    e.cancelled = true; // skip post_apply death bookkeeping
  });

  const attacker = makeEntity({ atk });
  const target = makeEntity({ resistance: targetResistance });

  pipeline.queueAbility(attacker, target, abilityName);
  pipeline.resolveFrame();

  return captured;
}

// ------------------------------------------------------------------
// applyVarianceAndCritModify — pure helper (default / no-opt-in cases)
// ------------------------------------------------------------------

describe('applyVarianceAndCritModify (pure helper, default path)', () => {
  // Minimal synthetic ability with normal tier, no variance/crit fields.
  const plainAbility: Partial<AbilityDef> = {
    name: 'plain',
    category: 'damage',
    tiers: {
      weakest:   { dmgMult: 1.5 },
      weaker:    { dmgMult: 1.3 },
      weak:      { dmgMult: 1.15 },
      normal:    { dmgMult: 1.0 },
      strong:    { dmgMult: 0.85 },
      stronger:  { dmgMult: 0.7 },
      strongest: { dmgMult: 0.5 },
    },
  };

  function makeEvent(finalDamage: number, ability: Partial<AbilityDef> = plainAbility): DamageEvent {
    return {
      finalDamage,
      ability: ability as AbilityDef,
      effectiveTier: 'normal',
      cancelled: false,
    } as DamageEvent;
  }

  it('bails early when event.cancelled is true', () => {
    const e = makeEvent(20);
    e.cancelled = true;
    applyVarianceAndCritModify(e);
    // Pass-through on cancelled events — no rounding, no rewrite.
    expect(e.finalDamage).toBe(20);
  });

  it('no-ops when ability has no tiers (wrapper / utility abilities)', () => {
    const e = makeEvent(17, { name: 'no-tier', category: 'damage' });
    applyVarianceAndCritModify(e);
    // Wrapper events with baseDamageOverride and utility abilities
    // without tier tables should pass through untouched.
    expect(e.finalDamage).toBe(17);
  });

  it('rounds + floors when tier stats exist but no variance/crit fields set', () => {
    // Most migrated units have plain tier tables. A fractional
    // finalDamage (from non-normal tier calculation) rounds to integer.
    const e = makeEvent(15.3);
    applyVarianceAndCritModify(e);
    expect(e.finalDamage).toBe(15);
  });

  it('integer finalDamage passes through unchanged at default', () => {
    const e = makeEvent(42);
    applyVarianceAndCritModify(e);
    expect(e.finalDamage).toBe(42);
  });

  it('floors at 1 when finalDamage is 0', () => {
    const e = makeEvent(0);
    applyVarianceAndCritModify(e);
    expect(e.finalDamage).toBe(1);
  });

  it('floors at 1 when finalDamage is negative', () => {
    const e = makeEvent(-5);
    applyVarianceAndCritModify(e);
    expect(e.finalDamage).toBe(1);
  });
});

// ------------------------------------------------------------------
// Capability pin — variancePct
// ------------------------------------------------------------------

describe('applyVarianceAndCritModify — variancePct opt-in (capability pin)', () => {
  // Test-only ability with 10% variance. Pins that a non-zero
  // variancePct on a tier actually rolls RNG at the modify phase.
  // Phase 10+ cleanup passes CANNOT delete the variance code path
  // as dead code — the field has zero production consumers in
  // Phase 10 Batch 1 but this pin holds the capability.
  const testVarianceAbility: Partial<AbilityDef> = {
    name: 'testVariance',
    category: 'damage',
    tiers: {
      weakest:   { dmgMult: 1.0, variancePct: 0.1 },
      weaker:    { dmgMult: 1.0, variancePct: 0.1 },
      weak:      { dmgMult: 1.0, variancePct: 0.1 },
      normal:    { dmgMult: 1.0, variancePct: 0.1 },
      strong:    { dmgMult: 1.0, variancePct: 0.1 },
      stronger:  { dmgMult: 1.0, variancePct: 0.1 },
      strongest: { dmgMult: 1.0, variancePct: 0.1 },
    },
  };

  it('produces damage within [0.9×, 1.1×] bounds over 1000 rolls (variancePct=0.1)', () => {
    const base = 100;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    const n = 1000;

    for (let i = 0; i < n; i++) {
      const e: DamageEvent = {
        finalDamage: base,
        ability: testVarianceAbility as AbilityDef,
        effectiveTier: 'normal',
        cancelled: false,
      } as DamageEvent;
      applyVarianceAndCritModify(e);
      min = Math.min(min, e.finalDamage);
      max = Math.max(max, e.finalDamage);
      sum += e.finalDamage;
    }

    // Bounds: finalDamage = round(base × (1 + roll)) where
    // roll ∈ [-0.1, +0.1]. base=100 → finalDamage ∈ [90, 110].
    expect(min).toBeGreaterThanOrEqual(90);
    expect(max).toBeLessThanOrEqual(110);

    // Uniform distribution has mean 0, so expected finalDamage ≈ base.
    // 1000 rolls of ±10 with uniform distribution: stddev of mean is
    // ~(10/sqrt(3))/sqrt(1000) ≈ 0.18. A ±2 tolerance is ~11σ wide,
    // effectively impossible to fail by RNG.
    const mean = sum / n;
    expect(mean).toBeGreaterThanOrEqual(base - 2);
    expect(mean).toBeLessThanOrEqual(base + 2);
  });

  it('absent variancePct is a no-op (other tier fields carry variance-free stats)', () => {
    // Pin the contract that plain tier tables don't trigger variance.
    // If this breaks, every deterministic unit starts rolling RNG.
    const plainAbility: Partial<AbilityDef> = {
      name: 'plain',
      category: 'damage',
      tiers: {
        weakest:   { dmgMult: 1.0 },
        weaker:    { dmgMult: 1.0 },
        weak:      { dmgMult: 1.0 },
        normal:    { dmgMult: 1.0 },
        strong:    { dmgMult: 1.0 },
        stronger:  { dmgMult: 1.0 },
        strongest: { dmgMult: 1.0 },
      },
    };

    for (let i = 0; i < 100; i++) {
      const e: DamageEvent = {
        finalDamage: 50,
        ability: plainAbility as AbilityDef,
        effectiveTier: 'normal',
        cancelled: false,
      } as DamageEvent;
      applyVarianceAndCritModify(e);
      expect(e.finalDamage).toBe(50);
    }
  });
});

// ------------------------------------------------------------------
// Capability pin — critChance / critMult
// ------------------------------------------------------------------

describe('applyVarianceAndCritModify — critChance opt-in (capability pin)', () => {
  // Test-only ability that ALWAYS crits for 2×. Pins the crit code
  // path — zero production consumers in Phase 10 Batch 1.
  const testCritAbility: Partial<AbilityDef> = {
    name: 'testCrit',
    category: 'damage',
    tiers: {
      weakest:   { dmgMult: 1.0, critChance: 1.0, critMult: 2.0 },
      weaker:    { dmgMult: 1.0, critChance: 1.0, critMult: 2.0 },
      weak:      { dmgMult: 1.0, critChance: 1.0, critMult: 2.0 },
      normal:    { dmgMult: 1.0, critChance: 1.0, critMult: 2.0 },
      strong:    { dmgMult: 1.0, critChance: 1.0, critMult: 2.0 },
      stronger:  { dmgMult: 1.0, critChance: 1.0, critMult: 2.0 },
      strongest: { dmgMult: 1.0, critChance: 1.0, critMult: 2.0 },
    },
  };

  it('critChance=1.0, critMult=2.0: every hit doubles damage', () => {
    const base = 50;
    for (let i = 0; i < 100; i++) {
      const e: DamageEvent = {
        finalDamage: base,
        ability: testCritAbility as AbilityDef,
        effectiveTier: 'normal',
        cancelled: false,
      } as DamageEvent;
      applyVarianceAndCritModify(e);
      expect(e.finalDamage).toBe(base * 2);
      // _crit flag set on every hit (future visual hook consumer).
      expect((e as unknown as { _crit?: boolean })._crit).toBe(true);
    }
  });

  it('critChance present, critMult absent: defaults to 2.0×', () => {
    const implicitMultAbility: Partial<AbilityDef> = {
      name: 'implicitMult',
      category: 'damage',
      tiers: {
        weakest:   { dmgMult: 1.0, critChance: 1.0 },
        weaker:    { dmgMult: 1.0, critChance: 1.0 },
        weak:      { dmgMult: 1.0, critChance: 1.0 },
        normal:    { dmgMult: 1.0, critChance: 1.0 },
        strong:    { dmgMult: 1.0, critChance: 1.0 },
        stronger:  { dmgMult: 1.0, critChance: 1.0 },
        strongest: { dmgMult: 1.0, critChance: 1.0 },
      },
    };

    const e: DamageEvent = {
      finalDamage: 50,
      ability: implicitMultAbility as AbilityDef,
      effectiveTier: 'normal',
      cancelled: false,
    } as DamageEvent;
    applyVarianceAndCritModify(e);
    expect(e.finalDamage).toBe(100); // 50 × 2.0 default
  });

  it('critChance=0 (explicit): never crits (100 rolls all deterministic)', () => {
    const zeroCritAbility: Partial<AbilityDef> = {
      name: 'zeroCrit',
      category: 'damage',
      tiers: {
        weakest:   { dmgMult: 1.0, critChance: 0, critMult: 2.0 },
        weaker:    { dmgMult: 1.0, critChance: 0, critMult: 2.0 },
        weak:      { dmgMult: 1.0, critChance: 0, critMult: 2.0 },
        normal:    { dmgMult: 1.0, critChance: 0, critMult: 2.0 },
        strong:    { dmgMult: 1.0, critChance: 0, critMult: 2.0 },
        stronger:  { dmgMult: 1.0, critChance: 0, critMult: 2.0 },
        strongest: { dmgMult: 1.0, critChance: 0, critMult: 2.0 },
      },
    };

    for (let i = 0; i < 100; i++) {
      const e: DamageEvent = {
        finalDamage: 50,
        ability: zeroCritAbility as AbilityDef,
        effectiveTier: 'normal',
        cancelled: false,
      } as DamageEvent;
      applyVarianceAndCritModify(e);
      expect(e.finalDamage).toBe(50);
      expect((e as unknown as { _crit?: boolean })._crit).toBeUndefined();
    }
  });
});

// ------------------------------------------------------------------
// Migrated path damage parity (per-unit deterministic)
// ------------------------------------------------------------------

describe('Migrated path — deterministic damage parity vs legacy baseline', () => {
  // Deterministic baseline: migrated path must produce
  // `max(1, round(atk × tierMult))` at the normal tier against a
  // resistance-neutral target. No variance, no crit.
  const UNITS = [
    { key: 'grunt', ability: 'jaw_strike' },
    { key: 'mandible', ability: 'jaw_strike' },
    { key: 'needler', ability: 'needle_shot' },
    { key: 'pricker', ability: 'pricker_jab' },
    { key: 'hardshell', ability: 'jaw_strike' },
    { key: 'domeback', ability: 'jaw_strike' },
  ];

  for (const unit of UNITS) {
    describe(unit.key, () => {
      it(`def declares defaultAbility = '${unit.ability}'`, () => {
        const def = UNIT_DEFS[unit.key];
        expect(def).toBeDefined();
        expect(def.defaultAbility).toBe(unit.ability);
      });

      it('migrated finalDamage = max(1, round(atk × 1.0)) at normal tier', () => {
        const def = UNIT_DEFS[unit.key];
        const atk = def.atk;
        const actual = simulateMigratedHit(unit.ability, atk);
        expect(actual).toBe(deterministicDmg(atk));
      });
    });
  }
});

// ------------------------------------------------------------------
// Floor-at-1 corner cases
// ------------------------------------------------------------------

describe('Migrated path — floor-at-1 edge cases', () => {
  it('atk=1 → finalDamage=1 (floor trivially satisfied)', () => {
    expect(simulateMigratedHit('jaw_strike', 1)).toBe(1);
  });

  it('atk=0 → finalDamage=1 (floor engages at 0)', () => {
    // Not a production scenario but defensible: the calculate phase
    // produces 0 when attacker.atk = 0, and the variance/crit + floor
    // subscribers clamp to 1.
    expect(simulateMigratedHit('jaw_strike', 0)).toBe(1);
  });
});

// ------------------------------------------------------------------
// Cross-resistance behavior
// ------------------------------------------------------------------

describe('Migrated path — resistance interaction', () => {
  it('target with no resistance entry resolves at normal tier (1.0× mult)', () => {
    const result = simulateMigratedHit('jaw_strike', 20, {});
    expect(result).toBe(20);
  });

  it('target with mismatched resistance (blunt vs sharp ability) stays normal tier', () => {
    // jaw_strike is sharp; target has blunt resistance. Sharp falls
    // back to normal tier → 1.0× multiplier.
    const result = simulateMigratedHit('jaw_strike', 20, { blunt: 'strong' });
    expect(result).toBe(20);
  });

  it('target with matching resistance shifts the tier (sharp:strong → 0.85×)', () => {
    // 20 × 0.85 = 17.0 → round → 17.
    const result = simulateMigratedHit('jaw_strike', 20, { sharp: 'strong' });
    expect(result).toBe(17);
  });

  it('rounds half away from zero (JS Math.round semantics)', () => {
    // 50 × 0.85 = 42.5 → Math.round(42.5) = 43 (half toward +∞).
    const result = simulateMigratedHit('jaw_strike', 50, { sharp: 'strong' });
    expect(result).toBe(43);
  });
});

// ------------------------------------------------------------------
// Wrapper coexistence — baseDamageOverride events bypass tier table
// ------------------------------------------------------------------

describe('Wrapper coexistence — baseDamageOverride path', () => {
  it('override_damage_event with baseDamageOverride passes through unchanged', () => {
    const pipeline = new CombatPipeline();
    pipeline.on('modify', applyVarianceAndCritModify);

    let captured = 0;
    pipeline.on('apply', (e: DamageEvent) => {
      captured = e.finalDamage;
      e.cancelled = true;
    });

    const attacker = makeEntity({ atk: 999 });
    const target = makeEntity();
    pipeline.queueAbility(attacker, target, 'override_damage_event', {
      baseDamageOverride: 17,
    });
    pipeline.resolveFrame();
    expect(captured).toBe(17);
  });

  it('baseDamageOverride with tier-carrying ability: subscriber still rounds (benign)', () => {
    // The DOT dispatcher queues override_damage_event with an integer
    // override; Bombardier death_bomb queues with override 65. Both
    // go through this path: calculate fast path sets finalDamage to
    // the override; variance/crit subscriber reads tier stats (if
    // any) and rounds. For integer overrides this is a no-op.
    // chain_lightning exercises the tier-carrying-but-overridden case.
    const pipeline = new CombatPipeline();
    pipeline.on('modify', applyVarianceAndCritModify);

    let captured = 0;
    pipeline.on('apply', (e: DamageEvent) => {
      captured = e.finalDamage;
      e.cancelled = true;
    });

    const attacker = makeEntity({ atk: 0 });
    const target = makeEntity();
    pipeline.queueAbility(attacker, target, 'chain_lightning', {
      baseDamageOverride: 50,
    });
    pipeline.resolveFrame();
    expect(captured).toBe(50);
  });
});

// ------------------------------------------------------------------
// Routing decision — defaultAbility presence is the gate
// ------------------------------------------------------------------

describe('defaultAbility routing key', () => {
  it('every unit carries defaultAbility (post-Phase-9)', () => {
    // All 18 units are fully migrated — no legacy-only attackers.
    const allUnitKeys = Object.keys(UNIT_DEFS);
    for (const key of allUnitKeys) {
      const def = UNIT_DEFS[key];
      expect(def.defaultAbility, `${key} should have defaultAbility`).toBeDefined();
    }
  });
});
