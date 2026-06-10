// Buff effect definitions. Declarative; hook bodies wire as consumers arrive.

import type { EffectDef } from './types';

export const buffEffects: Record<string, EffectDef> = {
  // Primal Roar (Matriarch's ultimate) — a PRESENCE-FLAG buff with no logic of
  // its own (the same shape as `slow`). Consumers react to its presence: the
  // cohesion handler treats a roaring α unit as fully massed (peak atk surge),
  // and getSpeed grants the forward charge. The duration is the roar window;
  // re-cast refreshes it (non-stackable). See CombatSystem.fireSignatureImpact.
  herd_roar: {
    name: 'herd_roar',
    duration: 4,
    stackable: false,
    onHostDeath: 'cancel',
  },

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
