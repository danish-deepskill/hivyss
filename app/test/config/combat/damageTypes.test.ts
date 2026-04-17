import { describe, it, expect } from 'vitest';
import {
  DAMAGE_TYPES,
  damageTypesInCategory,
  getDamageTypeDef,
  type DamageType,
} from '../../../src/config/combat/damageTypes';

// Pure data tests — no Phaser, no Unit construction. The type table is
// static, so these assertions double as a regression guard against
// accidental drift (renaming a type, flipping a category, etc.).

describe('DAMAGE_TYPES — the 9 canonical types', () => {
  it('declares exactly nine damage types', () => {
    expect(Object.keys(DAMAGE_TYPES).length).toBe(9);
  });

  it('includes every type the Phase 2 spec names', () => {
    const expected: DamageType[] = [
      'blunt', 'sharp',                              // physical
      'heat', 'cold', 'toxic', 'electric',           // elemental
      'psychic', 'void', 'holy',                     // dark
    ];
    for (const t of expected) {
      expect(DAMAGE_TYPES[t]).toBeDefined();
    }
  });
});

describe('Category groupings', () => {
  it('blunt + sharp are physical', () => {
    expect(DAMAGE_TYPES.blunt.category).toBe('physical');
    expect(DAMAGE_TYPES.sharp.category).toBe('physical');
  });

  it('heat / cold / toxic / electric are elemental', () => {
    expect(DAMAGE_TYPES.heat.category).toBe('elemental');
    expect(DAMAGE_TYPES.cold.category).toBe('elemental');
    expect(DAMAGE_TYPES.toxic.category).toBe('elemental');
    expect(DAMAGE_TYPES.electric.category).toBe('elemental');
  });

  it('psychic / void / holy are dark', () => {
    expect(DAMAGE_TYPES.psychic.category).toBe('dark');
    expect(DAMAGE_TYPES.void.category).toBe('dark');
    expect(DAMAGE_TYPES.holy.category).toBe('dark');
  });

  it('damageTypesInCategory returns every member of a category', () => {
    const physical = damageTypesInCategory('physical').sort();
    expect(physical).toEqual(['blunt', 'sharp']);

    const elemental = damageTypesInCategory('elemental').sort();
    expect(elemental).toEqual(['cold', 'electric', 'heat', 'toxic']);

    const dark = damageTypesInCategory('dark').sort();
    expect(dark).toEqual(['holy', 'psychic', 'void']);
  });

  it('category totals sum to the full type count (partition invariant)', () => {
    const total =
      damageTypesInCategory('physical').length +
      damageTypesInCategory('elemental').length +
      damageTypesInCategory('dark').length;
    expect(total).toBe(Object.keys(DAMAGE_TYPES).length);
  });
});

describe('Default effects', () => {
  it('every damage type has a defaultEffect string', () => {
    for (const key of Object.keys(DAMAGE_TYPES) as DamageType[]) {
      const def = DAMAGE_TYPES[key];
      expect(typeof def.defaultEffect).toBe('string');
      expect(def.defaultEffect.length).toBeGreaterThan(0);
    }
  });

  it('matches the Phase 2 spec defaults for the obvious types', () => {
    expect(DAMAGE_TYPES.blunt.defaultEffect).toBe('knockback');
    expect(DAMAGE_TYPES.sharp.defaultEffect).toBe('pierce');
    expect(DAMAGE_TYPES.heat.defaultEffect).toBe('burn');
    expect(DAMAGE_TYPES.cold.defaultEffect).toBe('slow');
    expect(DAMAGE_TYPES.toxic.defaultEffect).toBe('poison');
    expect(DAMAGE_TYPES.electric.defaultEffect).toBe('stun');
    expect(DAMAGE_TYPES.psychic.defaultEffect).toBe('fear');
    expect(DAMAGE_TYPES.void.defaultEffect).toBe('armor_bypass');
    expect(DAMAGE_TYPES.holy.defaultEffect).toBe('cleanse');
  });
});

describe('getDamageTypeDef', () => {
  it('returns the def for a known type', () => {
    const def = getDamageTypeDef('heat');
    expect(def.category).toBe('elemental');
    expect(def.defaultEffect).toBe('burn');
  });

  it('throws for an unknown type (runtime safety against bad data)', () => {
    expect(() => getDamageTypeDef('fictional' as DamageType)).toThrow();
  });
});
