// Buff effect definitions. Declarative; hook bodies wire as consumers arrive.

import type { EffectDef } from './types';

export const buffEffects: Record<string, EffectDef> = {
  atk_buff: {
    name: 'atk_buff',
    duration: 5,
    stackable: false,
    onHostDeath: 'cancel',
    tiers: {
      normal: { percent: 20 },
      strong: { percent: 15 },
      weak: { percent: 30 },
    },
  },

  speed_buff: {
    name: 'speed_buff',
    duration: 4,
    stackable: false,
    onHostDeath: 'cancel',
    tiers: {
      normal: { percent: 25 },
    },
  },

  shield: {
    name: 'shield',
    duration: 6,
    stackable: false,
    onHostDeath: 'cancel',
    // `amount` will feed a `resources.shield` pool on apply, drained
    // by a pre_apply subscriber before HP. Declarative only for now.
    tiers: {
      normal: { amount: 30 },
      strong: { amount: 20 },
      weak: { amount: 50 },
    },
  },

  bloodlust: {
    name: 'bloodlust',
    duration: 4,
    stackable: false,
    onHostDeath: 'cancel',
    tiers: {
      normal: { atkPercent: 25, lifestealPercent: 25 },
    },
  },
};
