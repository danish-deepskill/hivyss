import { describe, it, expect } from 'vitest';
import {
  RESISTANCE_TIERS,
  DEFAULT_RESISTANCE,
  shiftTier,
  type ResistanceTier,
} from '../../../src/config/combat/resistances';

// Pure-function tests. shiftTier is stateless, takes plain inputs,
// returns a plain value — testable with literals, no Phaser, no Unit.

describe('RESISTANCE_TIERS table', () => {
  it('has exactly 7 tiers in ascending order', () => {
    expect(RESISTANCE_TIERS.length).toBe(7);
    expect(RESISTANCE_TIERS).toEqual([
      'weakest', 'weaker', 'weak',
      'normal',
      'strong', 'stronger', 'strongest',
    ]);
  });

  it('normal is the default and sits exactly in the middle', () => {
    expect(DEFAULT_RESISTANCE).toBe('normal');
    const midIdx = (RESISTANCE_TIERS.length - 1) / 2;
    expect(RESISTANCE_TIERS[midIdx]).toBe('normal');
  });
});

describe('shiftTier — positive delta (shift up / more resistant)', () => {
  it('shift +1 from normal → strong', () => {
    expect(shiftTier('normal', 1)).toBe('strong');
  });

  it('shift +2 from normal → stronger', () => {
    expect(shiftTier('normal', 2)).toBe('stronger');
  });

  it('shift +1 from weak → normal', () => {
    expect(shiftTier('weak', 1)).toBe('normal');
  });

  it('shift +3 from weak → stronger', () => {
    expect(shiftTier('weak', 3)).toBe('stronger');
  });
});

describe('shiftTier — negative delta (shift down / less resistant)', () => {
  it('shift -1 from normal → weak', () => {
    expect(shiftTier('normal', -1)).toBe('weak');
  });

  it('shift -2 from normal → weaker', () => {
    expect(shiftTier('normal', -2)).toBe('weaker');
  });

  it('shift -1 from strong → normal', () => {
    expect(shiftTier('strong', -1)).toBe('normal');
  });
});

describe('shiftTier — zero delta', () => {
  it('is a no-op for every tier', () => {
    for (const t of RESISTANCE_TIERS) {
      expect(shiftTier(t, 0)).toBe(t);
    }
  });
});

describe('shiftTier — clamping at the weakest end', () => {
  it('cannot go below weakest', () => {
    expect(shiftTier('weakest', -1)).toBe('weakest');
    expect(shiftTier('weakest', -5)).toBe('weakest');
    expect(shiftTier('weakest', -100)).toBe('weakest');
  });

  it('large negative delta from mid-ladder clamps to weakest', () => {
    expect(shiftTier('normal', -10)).toBe('weakest');
    expect(shiftTier('weak', -10)).toBe('weakest');
  });
});

describe('shiftTier — clamping at the strongest end', () => {
  it('cannot go above strongest', () => {
    expect(shiftTier('strongest', 1)).toBe('strongest');
    expect(shiftTier('strongest', 5)).toBe('strongest');
    expect(shiftTier('strongest', 100)).toBe('strongest');
  });

  it('large positive delta from mid-ladder clamps to strongest', () => {
    expect(shiftTier('normal', 10)).toBe('strongest');
    expect(shiftTier('strong', 10)).toBe('strongest');
  });
});

describe('shiftTier — composition (useful for Phase 4 penetration math)', () => {
  it('applying +3 then -3 returns to the start', () => {
    for (const t of RESISTANCE_TIERS) {
      // Only check tiers far enough from edges that neither step clamps.
      const idx = RESISTANCE_TIERS.indexOf(t);
      if (idx >= 3 && idx <= 3) {
        expect(shiftTier(shiftTier(t, 3), -3)).toBe(t);
      }
    }
    // Explicit mid-ladder case.
    expect(shiftTier(shiftTier('normal', 3), -3)).toBe('normal');
  });

  it('penetration math: attacker with +2 penetration against a stronger target', () => {
    // Target has 'stronger' resistance. Attacker penetration = 2 →
    // effective tier used by the ability lookup is 'normal'.
    const effective = shiftTier('stronger', -2);
    expect(effective).toBe('normal');
  });

  it('penetration math: cannot clamp past the weakest end', () => {
    const effective = shiftTier('weak', -10);
    expect(effective).toBe('weakest');
  });
});

describe('shiftTier — defensive fallback', () => {
  it('an unknown tier value returns the default (normal)', () => {
    // Forced cast simulates bad runtime data bypassing the type.
    const bogus = 'unbreakable' as ResistanceTier;
    expect(shiftTier(bogus, 0)).toBe('normal');
    expect(shiftTier(bogus, 3)).toBe('normal');
  });
});
