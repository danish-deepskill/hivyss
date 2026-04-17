// Phase 5 — ResourceSystem unit tests.
//
// Pure-function-first. Every helper takes a plain entity-shaped object
// and mutates only its `resources` record. No Unit construction, no
// Phaser dependency.

import { describe, it, expect } from 'vitest';
import {
  getResource,
  addResource,
  spendResource,
  setResource,
  clearResources,
} from '../../src/systems/ResourceSystem';

type TestEntity = { resources?: Record<string, number> };

const empty = (): TestEntity => ({});
const with_ = (r: Record<string, number>): TestEntity => ({ resources: { ...r } });

// --- getResource ---

describe('getResource', () => {
  it('returns 0 when resources record is absent', () => {
    expect(getResource(empty(), 'charges')).toBe(0);
  });

  it('returns 0 when key is absent', () => {
    expect(getResource(with_({ ammo: 5 }), 'charges')).toBe(0);
  });

  it('returns the stored value', () => {
    expect(getResource(with_({ charges: 3 }), 'charges')).toBe(3);
  });

  it('does not mutate the entity', () => {
    const e = empty();
    getResource(e, 'charges');
    expect(e.resources).toBeUndefined();
  });
});

// --- addResource ---

describe('addResource', () => {
  it('creates the resources record lazily', () => {
    const e = empty();
    addResource(e, 'charges', 1);
    expect(e.resources).toEqual({ charges: 1 });
  });

  it('adds positive delta to an existing key', () => {
    const e = with_({ charges: 2 });
    expect(addResource(e, 'charges', 3)).toBe(5);
    expect(e.resources!.charges).toBe(5);
  });

  it('subtracts negative delta', () => {
    const e = with_({ charges: 5 });
    expect(addResource(e, 'charges', -2)).toBe(3);
  });

  it('floors at 0 on negative delta', () => {
    const e = with_({ charges: 2 });
    expect(addResource(e, 'charges', -10)).toBe(0);
    expect(e.resources!.charges).toBe(0);
  });

  it('clamps at max when provided', () => {
    const e = with_({ charges: 2 });
    expect(addResource(e, 'charges', 100, 5)).toBe(5);
  });

  it('no-op when already at max', () => {
    const e = with_({ charges: 5 });
    expect(addResource(e, 'charges', 10, 5)).toBe(5);
  });

  it('independent keys do not interact', () => {
    const e = empty();
    addResource(e, 'a', 3);
    addResource(e, 'b', 7);
    expect(getResource(e, 'a')).toBe(3);
    expect(getResource(e, 'b')).toBe(7);
  });
});

// --- spendResource ---

describe('spendResource', () => {
  it('returns false when not enough', () => {
    const e = with_({ charges: 2 });
    expect(spendResource(e, 'charges', 3)).toBe(false);
    expect(e.resources!.charges).toBe(2); // unmutated
  });

  it('returns false on missing key', () => {
    const e = empty();
    expect(spendResource(e, 'charges', 1)).toBe(false);
  });

  it('returns true and deducts when sufficient', () => {
    const e = with_({ charges: 5 });
    expect(spendResource(e, 'charges', 2)).toBe(true);
    expect(e.resources!.charges).toBe(3);
  });

  it('returns true with exactly enough', () => {
    const e = with_({ charges: 3 });
    expect(spendResource(e, 'charges', 3)).toBe(true);
    expect(e.resources!.charges).toBe(0);
  });

  it('spend 0 always succeeds as a no-op', () => {
    const e = with_({ charges: 1 });
    expect(spendResource(e, 'charges', 0)).toBe(true);
    expect(e.resources!.charges).toBe(1);
  });

  it('rejects negative spend without mutation', () => {
    const e = with_({ charges: 5 });
    expect(spendResource(e, 'charges', -3)).toBe(false);
    expect(e.resources!.charges).toBe(5);
  });
});

// --- setResource ---

describe('setResource', () => {
  it('forces a key to an exact value, creating the record if absent', () => {
    const e = empty();
    setResource(e, 'mana', 7);
    expect(getResource(e, 'mana')).toBe(7);
  });

  it('clamps to [0, max]', () => {
    const e = empty();
    setResource(e, 'mana', 999, 10);
    expect(getResource(e, 'mana')).toBe(10);
    setResource(e, 'mana', -5);
    expect(getResource(e, 'mana')).toBe(0);
  });
});

// --- clearResources ---

describe('clearResources', () => {
  it('empties every key but leaves the record', () => {
    const e = with_({ a: 1, b: 2, c: 3 });
    clearResources(e);
    expect(Object.keys(e.resources!)).toHaveLength(0);
  });

  it('no-ops when record is absent', () => {
    const e = empty();
    clearResources(e);
    expect(e.resources).toBeUndefined();
  });
});
