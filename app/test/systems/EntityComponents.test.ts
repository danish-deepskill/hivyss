import { describe, it, expect } from 'vitest';
import {
  entitiesWithComponent,
  entitiesWithAllComponents,
  hasAllComponents,
  UNIT_COMPONENTS,
} from '../../src/systems/EntityComponents';
import type { ComponentTag } from '../../src/types';

// Pure helpers take anything shaped like { components: Set<ComponentTag> }.
// We use plain object literals — no Phaser, no Unit mocks, no Pool.
type TestEntity = { id: number; components: Set<ComponentTag> };

const ent = (id: number, ...tags: ComponentTag[]): TestEntity => ({
  id,
  components: new Set(tags),
});

describe('entitiesWithComponent', () => {
  it('returns [] for an empty list', () => {
    expect(entitiesWithComponent([], 'HasHP')).toEqual([]);
  });

  it('returns only entities carrying the tag', () => {
    const a = ent(1, 'HasHP', 'HasAI');
    const b = ent(2, 'HasHP');
    const c = ent(3, 'HasTrajectory');
    const got = entitiesWithComponent([a, b, c], 'HasHP');
    expect(got.map(e => e.id)).toEqual([1, 2]);
  });

  it('returns [] when nothing carries the tag', () => {
    const a = ent(1, 'HasHP');
    const b = ent(2, 'HasAI');
    expect(entitiesWithComponent([a, b], 'HasZoneShape')).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const entities = [ent(1, 'HasHP'), ent(2, 'HasAI')];
    const before = entities.slice();
    entitiesWithComponent(entities, 'HasHP');
    expect(entities).toEqual(before);
  });
});

describe('entitiesWithAllComponents', () => {
  it('returns entities carrying every tag in the set', () => {
    const a = ent(1, 'HasHP', 'HasAI', 'HasAllegiance');
    const b = ent(2, 'HasHP', 'HasAllegiance'); // no HasAI
    const c = ent(3, 'HasHP', 'HasAI', 'HasAllegiance');
    const got = entitiesWithAllComponents([a, b, c], ['HasHP', 'HasAI']);
    expect(got.map(e => e.id)).toEqual([1, 3]);
  });

  it('empty tag list matches everyone (vacuously true)', () => {
    const a = ent(1, 'HasHP');
    const b = ent(2);
    expect(entitiesWithAllComponents([a, b], []).map(e => e.id)).toEqual([1, 2]);
  });

  it('returns [] when no entity carries the full tag set', () => {
    const a = ent(1, 'HasHP');
    const b = ent(2, 'HasAI');
    expect(entitiesWithAllComponents([a, b], ['HasHP', 'HasAI'])).toEqual([]);
  });
});

describe('hasAllComponents', () => {
  it('returns true when entity carries every tag', () => {
    const a = ent(1, 'HasHP', 'HasAI', 'HasModifiers');
    expect(hasAllComponents(a, ['HasHP', 'HasModifiers'])).toBe(true);
  });

  it('returns false when any tag is missing', () => {
    const a = ent(1, 'HasHP', 'HasModifiers');
    expect(hasAllComponents(a, ['HasHP', 'HasAI'])).toBe(false);
  });

  it('returns true for an empty tag list', () => {
    const a = ent(1);
    expect(hasAllComponents(a, [])).toBe(true);
  });
});

describe('UNIT_COMPONENTS default set', () => {
  it('includes the core unit tags the plan specifies', () => {
    const set = new Set(UNIT_COMPONENTS);
    expect(set.has('HasHP')).toBe(true);
    expect(set.has('HasResistance')).toBe(true);
    expect(set.has('IsTargetable')).toBe(true);
    expect(set.has('HasOnDeath')).toBe(true);
    expect(set.has('HasAI')).toBe(true);
    expect(set.has('HasAllegiance')).toBe(true);
    expect(set.has('HasSourceAttribution')).toBe(true);
    expect(set.has('HasCapacityCost')).toBe(true);
    expect(set.has('HasModifiers')).toBe(true);
  });

  it('does NOT include entity-type-specific tags Units should not carry', () => {
    const set = new Set(UNIT_COMPONENTS);
    // Units don't have trajectories (projectiles do) or zone shapes
    // (aoe effects do). Keeping them out here prevents a Unit from
    // being accidentally matched by projectile/zone selectors.
    expect(set.has('HasTrajectory')).toBe(false);
    expect(set.has('HasZoneShape')).toBe(false);
  });
});

// Validation of Decision 1: the component API must NOT be implicitly
// Unit-shaped. A plain object with only HasHP + IsTargetable — no AI,
// no allegiance, no capacity cost — must still be addressable by the
// query helpers. This is the pure-function equivalent of the Phase 1
// TargetDummy validation.
describe('non-Unit entity participation (TargetDummy shape)', () => {
  it('an HP-only target object is found by HasHP / IsTargetable queries', () => {
    const dummy = ent(999, 'HasHP', 'IsTargetable');
    const unit  = ent(1,   ...UNIT_COMPONENTS);
    const list  = [unit, dummy];

    expect(entitiesWithComponent(list, 'HasHP').map(e => e.id)).toEqual([1, 999]);
    expect(entitiesWithComponent(list, 'IsTargetable').map(e => e.id)).toEqual([1, 999]);
  });

  it('an HP-only target is NOT matched by AI-requiring selectors', () => {
    const dummy = ent(999, 'HasHP', 'IsTargetable');
    const unit  = ent(1,   ...UNIT_COMPONENTS);
    const list  = [unit, dummy];

    // A selector like 'nearest_enemy_in_range' would gate on HasAI.
    const got = entitiesWithAllComponents(list, ['IsTargetable', 'HasAI']);
    expect(got.map(e => e.id)).toEqual([1]);
    expect(hasAllComponents(dummy, ['HasAI'])).toBe(false);
  });

  it('an HP-only target does NOT carry HasCapacityCost (cap system ignores it)', () => {
    const dummy = ent(999, 'HasHP', 'IsTargetable');
    expect(hasAllComponents(dummy, ['HasCapacityCost'])).toBe(false);
  });
});
