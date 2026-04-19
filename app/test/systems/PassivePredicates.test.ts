// Phase 8 Stage 4 item 11 — predicate table truth tests.
//
// Each predicate in PREDICATE_TABLE gets its own describe block with:
//   - positive case (predicate true)
//   - negative case (predicate false)
//   - boundary case (the edge where the predicate flips)
//
// Adding a new predicate to PREDICATE_TABLE requires adding a new
// describe block here per the PassivePredicates.ts convention.

import { describe, it, expect } from 'vitest';
import { PREDICATE_TABLE, lookupPredicate } from '../../src/systems/PassivePredicates';
import type { IUnit } from '../../src/types';

/**
 * Minimal IUnit-shaped mock. Predicates only read `hp` and `maxHp`
 * (and may read other fields in the future), so the mock is
 * correspondingly small. Cast to IUnit at the predicate call site.
 */
function mockUnit(opts: { hp: number; maxHp: number }): IUnit {
  return {
    hp: opts.hp,
    maxHp: opts.maxHp,
  } as unknown as IUnit;
}

describe('PassivePredicates — hp_below_half (Ravager rage)', () => {
  const predicate = PREDICATE_TABLE.hp_below_half;

  it('is registered in PREDICATE_TABLE', () => {
    expect(predicate).toBeDefined();
    expect(typeof predicate).toBe('function');
  });

  it('returns TRUE when hp is exactly half of maxHp (inclusive boundary, matches legacy hpFrac <= 0.5)', () => {
    // Legacy `alpha.ts:278` used `hpFrac <= 0.5` — inclusive. The
    // post-migration predicate must match byte-for-byte.
    const u = mockUnit({ hp: 50, maxHp: 100 });
    expect(predicate(u)).toBe(true);
  });

  it('returns TRUE when hp is well below half', () => {
    const u = mockUnit({ hp: 20, maxHp: 100 });
    expect(predicate(u)).toBe(true);
  });

  it('returns TRUE when hp is 1 (near-death)', () => {
    const u = mockUnit({ hp: 1, maxHp: 100 });
    expect(predicate(u)).toBe(true);
  });

  it('returns FALSE when hp is above half', () => {
    const u = mockUnit({ hp: 60, maxHp: 100 });
    expect(predicate(u)).toBe(false);
  });

  it('returns FALSE when hp is full (100%)', () => {
    const u = mockUnit({ hp: 100, maxHp: 100 });
    expect(predicate(u)).toBe(false);
  });

  it('returns FALSE when hp is just above half (50.1%)', () => {
    // Float precision edge — hp=51 on maxHp=100 → hpFrac=0.51 > 0.5.
    const u = mockUnit({ hp: 51, maxHp: 100 });
    expect(predicate(u)).toBe(false);
  });

  it('handles non-integer HP values (Mendwing heals can produce floats in legacy but integers post-defensive-round)', () => {
    // Defensive — even though production HP is integer post-round,
    // the predicate should work on fractional values without drift.
    const u = mockUnit({ hp: 49.9999, maxHp: 100 });
    expect(predicate(u)).toBe(true);
  });

  it('scales with maxHp correctly — Ravager at 160 maxHp crosses at 80', () => {
    // Ravager's real maxHp is 160 per ravagerDef.hp. At exactly 80 HP
    // the predicate should fire. This pins the real production ratio.
    const u = mockUnit({ hp: 80, maxHp: 160 });
    expect(predicate(u)).toBe(true);

    const u2 = mockUnit({ hp: 81, maxHp: 160 });
    expect(predicate(u2)).toBe(false);
  });
});

describe('PassivePredicates — lookupPredicate helper', () => {
  it('returns the registered predicate for a known key', () => {
    const found = lookupPredicate('hp_below_half');
    expect(found).toBeDefined();
    expect(found).toBe(PREDICATE_TABLE.hp_below_half);
  });

  it('returns undefined for an unknown key (silent skip, NOT throw)', () => {
    // Unknown keys must NOT throw — stale predicate names from
    // hot-reload or pool recycling should silently no-op. The
    // caller (updatePassives) handles the undefined case.
    expect(lookupPredicate('__nonexistent_predicate__')).toBeUndefined();
  });

  it('returns undefined for an empty string key', () => {
    expect(lookupPredicate('')).toBeUndefined();
  });
});

describe('PassivePredicates — table completeness pin', () => {
  it('PREDICATE_TABLE contains exactly the documented Stage 4 inventory', () => {
    // Inventory pin — adding a new predicate requires updating this
    // test. Stage 4 ships with one predicate: `hp_below_half`
    // (Ravager rage).
    const keys = Object.keys(PREDICATE_TABLE).sort();
    expect(keys).toEqual(['hp_below_half']);
  });
});
