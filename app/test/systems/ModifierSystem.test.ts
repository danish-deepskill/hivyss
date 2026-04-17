// Phase 5 — ModifierSystem unit tests.
//
// Pure-function-first per Decision 6. The core `stackModifiers` helper
// takes plain values and returns a plain value — no entity construction.
// `applyModifiers` layers a component gate on top and is tested with
// plain object literals that satisfy ModifierBearer structurally.

import { describe, it, expect } from 'vitest';
import type { Modifier } from '../../src/systems/ModifierSystem';
import {
  stackModifiers,
  applyModifiers,
  addModifier,
  removeModifiersBySource,
  tickModifiers,
  STAT_CAPS,
} from '../../src/systems/ModifierSystem';
import type { ComponentTag } from '../../src/types';

// --- Test helpers ---

const flat = (stat: string, value: number, source = 'test'): Modifier => ({
  stat,
  type: 'flat',
  value,
  source,
});
const pct = (stat: string, value: number, source = 'test'): Modifier => ({
  stat,
  type: 'percent',
  value,
  source,
});
const over = (stat: string, value: number, source = 'test'): Modifier => ({
  stat,
  type: 'override',
  value,
  source,
});

type TestEntity = {
  components: Set<ComponentTag>;
  modifiers?: Modifier[];
};

const withMods = (mods: Modifier[] = [], tags: ComponentTag[] = ['HasModifiers']): TestEntity => ({
  components: new Set(tags),
  modifiers: mods.slice(),
});

// --- stackModifiers (pure math) ---

describe('stackModifiers', () => {
  it('returns base when no mods', () => {
    expect(stackModifiers(10, [])).toBe(10);
  });

  it('applies a single flat mod', () => {
    expect(stackModifiers(10, [flat('atk', 5)])).toBe(15);
  });

  it('sums multiple flat mods additively', () => {
    expect(stackModifiers(10, [flat('atk', 5), flat('atk', 3), flat('atk', 2)])).toBe(20);
  });

  it('applies a single percent mod as +N%', () => {
    expect(stackModifiers(10, [pct('atk', 20)])).toBe(12);
  });

  it('stacks percent mods additively (not multiplicatively)', () => {
    // +20% + +30% = +50%, NOT 1.2 * 1.3
    expect(stackModifiers(10, [pct('atk', 20), pct('atk', 30)])).toBe(15);
  });

  it('applies flat before percent', () => {
    // (10 + 5) * 1.2 = 18
    expect(stackModifiers(10, [flat('atk', 5), pct('atk', 20)])).toBe(18);
  });

  it('handles negative flat mods', () => {
    expect(stackModifiers(10, [flat('atk', -3)])).toBe(7);
  });

  it('handles negative percent mods', () => {
    expect(stackModifiers(10, [pct('atk', -50)])).toBe(5);
  });

  it('override short-circuits flat + percent', () => {
    // override wins regardless of other mods
    expect(stackModifiers(10, [flat('atk', 5), pct('atk', 50), over('atk', 99)])).toBe(99);
  });

  it('override uses last-wins on multiple overrides', () => {
    expect(stackModifiers(10, [over('atk', 5), over('atk', 99)])).toBe(99);
  });

  it('clamps to cap.max after stacking', () => {
    expect(stackModifiers(10, [flat('atk', 1000)], { max: 50 })).toBe(50);
  });

  it('clamps to cap.min after stacking', () => {
    expect(stackModifiers(10, [flat('atk', -1000)], { min: -50 })).toBe(-50);
  });

  it('cap.min does not raise a value that already passes', () => {
    expect(stackModifiers(10, [], { min: -50 })).toBe(10);
  });

  it('cap.max does not lower a value that already passes', () => {
    expect(stackModifiers(10, [], { max: 100 })).toBe(10);
  });

  it('cap applies to override too', () => {
    expect(stackModifiers(10, [over('atk', 999)], { max: 50 })).toBe(50);
  });

  it('percent of zero base returns zero (no divide-by-zero quirks)', () => {
    expect(stackModifiers(0, [pct('atk', 50)])).toBe(0);
  });
});

// --- applyModifiers (entity-aware, component-gated) ---

describe('applyModifiers', () => {
  it('short-circuits to base when entity lacks HasModifiers', () => {
    const e: TestEntity = {
      components: new Set(['HasHP']),
      modifiers: [flat('atk', 100)],
    };
    expect(applyModifiers(e, 10, 'atk')).toBe(10);
  });

  it('returns base when entity has HasModifiers but no modifiers field', () => {
    const e: TestEntity = { components: new Set(['HasModifiers']) };
    expect(applyModifiers(e, 10, 'atk')).toBe(10);
  });

  it('returns base when entity has empty modifiers array', () => {
    const e = withMods([]);
    expect(applyModifiers(e, 10, 'atk')).toBe(10);
  });

  it('applies modifiers matching the requested stat', () => {
    const e = withMods([flat('atk', 5), pct('atk', 20)]);
    expect(applyModifiers(e, 10, 'atk')).toBe(18);
  });

  it('ignores modifiers targeting other stats', () => {
    const e = withMods([flat('atk', 5), flat('spd', 100)]);
    expect(applyModifiers(e, 10, 'atk')).toBe(15);
    expect(applyModifiers(e, 10, 'spd')).toBe(110);
  });

  it('applies STAT_CAPS.healing_received floor', () => {
    const e = withMods([flat('healing_received', -1000)]);
    expect(applyModifiers(e, 0, 'healing_received')).toBe(STAT_CAPS.healing_received.min);
  });

  it('applies STAT_CAPS.healing_received ceiling', () => {
    const e = withMods([flat('healing_received', 9999)]);
    expect(applyModifiers(e, 0, 'healing_received')).toBe(STAT_CAPS.healing_received.max);
  });

  it('applies STAT_CAPS.resistance_shift in both directions', () => {
    const down = withMods([flat('resistance_shift', -10)]);
    const up = withMods([flat('resistance_shift', 10)]);
    expect(applyModifiers(down, 0, 'resistance_shift')).toBe(-3);
    expect(applyModifiers(up, 0, 'resistance_shift')).toBe(3);
  });

  it('cap entry absence means no clamp', () => {
    const e = withMods([flat('atk', 1_000_000)]);
    expect(applyModifiers(e, 0, 'atk')).toBe(1_000_000);
  });

  it('even with empty mods, cap still clamps the base value', () => {
    const e = withMods([]);
    // base is already out of range, cap should still apply
    expect(applyModifiers(e, 9999, 'resistance_shift')).toBe(3);
  });
});

// --- Mutators: addModifier / removeModifiersBySource / tickModifiers ---

describe('addModifier', () => {
  it('creates the modifiers array if absent', () => {
    const e: TestEntity = { components: new Set(['HasModifiers']) };
    addModifier(e, flat('atk', 5));
    expect(e.modifiers).toHaveLength(1);
  });

  it('appends to an existing array in order', () => {
    const e = withMods([flat('atk', 1)]);
    addModifier(e, flat('atk', 2));
    addModifier(e, flat('atk', 3));
    expect(e.modifiers).toHaveLength(3);
    expect(e.modifiers!.map(m => m.value)).toEqual([1, 2, 3]);
  });
});

describe('removeModifiersBySource', () => {
  it('returns 0 when entity has no mods', () => {
    const e: TestEntity = { components: new Set(['HasModifiers']) };
    expect(removeModifiersBySource(e, 'burn')).toBe(0);
  });

  it('removes every modifier with matching source', () => {
    const e = withMods([
      flat('atk', 1, 'burn'),
      flat('spd', -10, 'burn'),
      flat('atk', 5, 'rally'),
    ]);
    expect(removeModifiersBySource(e, 'burn')).toBe(2);
    expect(e.modifiers).toHaveLength(1);
    expect(e.modifiers![0].source).toBe('rally');
  });

  it('leaves unrelated modifiers untouched', () => {
    const e = withMods([flat('atk', 1, 'rally'), flat('atk', 2, 'rally')]);
    expect(removeModifiersBySource(e, 'burn')).toBe(0);
    expect(e.modifiers).toHaveLength(2);
  });

  it('two sources on same stat remove independently', () => {
    const e = withMods([
      flat('atk', 3, 'buff_a'),
      flat('atk', 5, 'buff_b'),
    ]);
    expect(applyModifiers(e, 10, 'atk')).toBe(18);
    removeModifiersBySource(e, 'buff_a');
    expect(applyModifiers(e, 10, 'atk')).toBe(15);
    removeModifiersBySource(e, 'buff_b');
    expect(applyModifiers(e, 10, 'atk')).toBe(10);
  });
});

describe('tickModifiers', () => {
  it('skips modifiers without a duration (permanent)', () => {
    const e = withMods([flat('atk', 5)]);
    expect(tickModifiers(e, 10)).toBe(0);
    expect(e.modifiers).toHaveLength(1);
  });

  it('decrements duration and keeps non-expired mods', () => {
    const m = flat('atk', 5);
    m.duration = 3;
    const e = withMods([m]);
    tickModifiers(e, 1);
    expect(e.modifiers![0].duration).toBe(2);
  });

  it('removes expired modifiers', () => {
    const m = flat('atk', 5);
    m.duration = 1;
    const e = withMods([m]);
    expect(tickModifiers(e, 1)).toBe(1);
    expect(e.modifiers).toHaveLength(0);
  });

  it('removes mods whose duration goes negative from a large dt', () => {
    const m = flat('atk', 5);
    m.duration = 0.5;
    const e = withMods([m]);
    expect(tickModifiers(e, 10)).toBe(1);
    expect(e.modifiers).toHaveLength(0);
  });

  it('removes expired mods but keeps non-expired siblings', () => {
    const a = flat('atk', 1, 'a'); a.duration = 1;
    const b = flat('atk', 2, 'b'); b.duration = 5;
    const e = withMods([a, b]);
    expect(tickModifiers(e, 1)).toBe(1);
    expect(e.modifiers).toHaveLength(1);
    expect(e.modifiers![0].source).toBe('b');
  });
});

// --- Property-style test: random sequence of apply/remove ---

describe('modifier stacking (property-style)', () => {
  it('final value always matches the formula after random apply/remove', () => {
    const e = withMods();
    addModifier(e, flat('atk', 10, 'a'));
    addModifier(e, flat('atk', 5, 'b'));
    addModifier(e, pct('atk', 20, 'a'));
    addModifier(e, pct('atk', 10, 'c'));
    // base 10 + (10 + 5) flat * (1 + 0.30) = 25 * 1.3 = 32.5
    expect(applyModifiers(e, 10, 'atk')).toBeCloseTo(32.5);

    // Remove source 'a' → flat -10, percent -20. Leaves flat=5, percent=10.
    // (10 + 5) * 1.10 = 16.5
    removeModifiersBySource(e, 'a');
    expect(applyModifiers(e, 10, 'atk')).toBeCloseTo(16.5);

    // Remove source 'b' → flat -5. Leaves percent=10.
    // (10 + 0) * 1.10 = 11
    removeModifiersBySource(e, 'b');
    expect(applyModifiers(e, 10, 'atk')).toBeCloseTo(11);

    // Remove source 'c' → everything gone. Base only.
    removeModifiersBySource(e, 'c');
    expect(applyModifiers(e, 10, 'atk')).toBe(10);
  });
});
