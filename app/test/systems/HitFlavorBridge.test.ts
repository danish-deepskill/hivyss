import { describe, it, expect } from 'vitest';
import { hitFlavorToDamageType } from '../../src/systems/HitFlavorBridge';
import type { HitFlavor } from '../../src/types';
import type { DamageType } from '../../src/config/combat/damageTypes';

// Pure-function test. Locks in the exact mapping committed for Phase 4
// (ambiguous cases documented inside HitFlavorBridge.ts) so that any
// future edit either (a) matches the Phase 4 commitment, or (b) breaks
// this test loudly and triggers a review.

describe('hitFlavorToDamageType', () => {
  it('maps every HitFlavor to a valid canonical DamageType', () => {
    const flavors: HitFlavor[] = [
      'melee', 'ranged', 'aoe',
      'burn', 'poison',
      'heal', 'nectar', 'blocked', 'base',
    ];
    const validTypes: DamageType[] = [
      'blunt', 'sharp', 'heat', 'cold', 'toxic',
      'electric', 'psychic', 'void', 'holy',
    ];
    for (const f of flavors) {
      const dt = hitFlavorToDamageType(f);
      expect(validTypes, `flavor ${f}`).toContain(dt);
    }
  });

  // Committed mappings — Phase 4 locks these values. Changing them is
  // a deliberate decision, not a drive-by edit.
  describe('committed mappings', () => {
    it('melee → blunt (impact default; sharp biters override per-unit in Phase 6)', () => {
      expect(hitFlavorToDamageType('melee')).toBe('blunt');
    });

    it('ranged → sharp (pointed projectiles dominate the legacy roster)', () => {
      expect(hitFlavorToDamageType('ranged')).toBe('sharp');
    });

    it('aoe → blunt (explosion impact default; Cinderfly/Bombardier override in Phase 6)', () => {
      expect(hitFlavorToDamageType('aoe')).toBe('blunt');
    });

    it('burn → heat', () => {
      expect(hitFlavorToDamageType('burn')).toBe('heat');
    });

    it('poison → toxic', () => {
      expect(hitFlavorToDamageType('poison')).toBe('toxic');
    });
  });

  describe('edge-case fallbacks (never appear in production DamageEvents)', () => {
    it('heal falls back to holy', () => {
      expect(hitFlavorToDamageType('heal')).toBe('holy');
    });

    it('nectar falls back to blunt (reward float text, not damage)', () => {
      expect(hitFlavorToDamageType('nectar')).toBe('blunt');
    });

    it('blocked falls back to blunt (wall state indicator)', () => {
      expect(hitFlavorToDamageType('blocked')).toBe('blunt');
    });

    it('base falls back to blunt (base hit indicator)', () => {
      expect(hitFlavorToDamageType('base')).toBe('blunt');
    });
  });

  it('is a pure function — same input always returns same output', () => {
    for (let i = 0; i < 10; i++) {
      expect(hitFlavorToDamageType('melee')).toBe('blunt');
      expect(hitFlavorToDamageType('burn')).toBe('heat');
    }
  });
});
