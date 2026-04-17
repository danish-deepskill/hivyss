// Special effect definitions — effects that need cross-entity refs
// or DamageEvent flag interactions. Declarative; hook bodies wire as
// consumers arrive.

import type { EffectDef } from './types';

export const specialEffects: Record<string, EffectDef> = {
  lifesteal: {
    name: 'lifesteal',
    duration: 5,
    stackable: false,
    onHostDeath: 'cancel',
    tiers: {
      normal: { percent: 25 },
      strong: { percent: 15 },
    },
  },

  reflect: {
    name: 'reflect',
    duration: 3,
    stackable: false,
    onHostDeath: 'cancel',
    // Consumer must set DamageEvent.isReflected = true to break
    // infinite bounce.
    tiers: {
      normal: { percent: 50 },
      strong: { percent: 30 },
    },
  },

  soul_linked: {
    name: 'soul_linked',
    duration: 8,
    stackable: false,
    onHostDeath: 'trigger',
    tiers: {
      normal: { percent: 30 },
    },
  },

  rally_target: {
    name: 'rally_target',
    duration: 4,
    stackable: false,
    onHostDeath: 'cancel',
    tiers: {
      normal: { severity: 1 },
    },
  },
};
