// Buff effect definitions. Declarative; hook bodies wire as consumers arrive.

import type { EffectDef } from './types';
import type { IUnit } from '../../../types';
import { addModifier, removeModifiersBySource } from '../../../systems/ModifierSystem';

export const buffEffects: Record<string, EffectDef> = {
  // Frenzy Musk's cash-in (α's signature pheromone). On apply, SNAPSHOT the
  // unit's live cohesion bonus and add it AGAIN as a frozen surge modifier
  // (≈2× while it lasts); the cohesion handler suppresses live tracking for
  // the duration — the bank is SPENT, it doesn't follow the pack mid-surge.
  // On expire the surge lifts and cohesion resumes naturally next frame.
  frenzy_surge: {
    name: 'frenzy_surge',
    duration: 4,
    stackable: false,
    onHostDeath: 'cancel',
    onApply(target) {
      const u = target as IUnit;
      const banked = u.modifiers
        ?.filter(m => m.source.startsWith(`cohesion:${u.id}:`))
        .reduce((sum, m) => sum + m.value, 0) ?? 0;
      if (banked <= 0) return; // nothing massed = nothing to cash
      // ×2: the surge REPLACES the (suppressed) live bank, so the frozen
      // modifier carries the full cash-out premium itself.
      addModifier(u, { stat: 'atk', type: 'flat', value: banked * 2, source: `frenzy:${u.id}` });
    },
    onExpire(target) {
      const u = target as IUnit;
      removeModifiersBySource(u, `frenzy:${u.id}`);
    },
  },

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
