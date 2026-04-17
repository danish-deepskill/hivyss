// Debuff effect definitions. Declarative; hook bodies wire as consumers arrive.

import type { EffectDef } from './types';

export const debuffEffects: Record<string, EffectDef> = {
  atk_debuff: {
    name: 'atk_debuff',
    duration: 4,
    stackable: false,
    onHostDeath: 'cancel',
    tiers: {
      normal: { percent: -20 },
      weak: { percent: -30 },
    },
  },

  armor_crack: {
    name: 'armor_crack',
    duration: 5,
    stackable: false,
    onHostDeath: 'cancel',
    // `shift` intends to shift the target's resistance DOWN by N
    // tiers via a resistance_shift modifier (clamped by STAT_CAPS).
    tiers: {
      normal: { shift: -1 },
      strong: { shift: -2 },
    },
  },

  marked: {
    name: 'marked',
    duration: 6,
    stackable: false,
    onHostDeath: 'cancel',
    tiers: {
      normal: { percent: 15 },
      strong: { percent: 10 },
    },
  },
};
