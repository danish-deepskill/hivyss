// Utility abilities — heals, passive auras, non-damage support.
// No dmgType and no tier table; damage resolution skips them.

import type { AbilityDef } from '../../../types';

export const utilityAbilities: Record<string, AbilityDef> = {
  // Mendwing's passive heal cast. Dispatched by updatePassives's heal
  // branch every `passiveHeal.cooldown` seconds against the lowest-HP
  // in-range ally.
  heal_pulse: {
    name: 'Heal Pulse',
    category: 'heal',
    targeting: 'lowest_hp_ally_in_range',
    range: 90,
    targetCount: 1,
    trigger: 'passive',
    healAmount: 20,
  },

  // Centurion rally aura. Runs via updatePassives's aura dispatch
  // branch reading `auraModifier` on the unit def, NOT via this
  // ability — declaration is retained for registry coverage parity.
  rally_aura: {
    name: 'Rally Aura',
    category: 'passive',
    targeting: 'all_allies_in_range',
    range: 80,
    targetCount: 5,
    trigger: 'passive',
    auraMods: { atkMult: 1.2 },
  },

  // Wardling guardian ward. Same story as rally_aura — real dispatch
  // reads `auraModifier` on the unit def.
  guardian_ward: {
    name: 'Guardian Ward',
    category: 'passive',
    targeting: 'all_allies_in_range',
    range: 114,
    trigger: 'passive',
    auraMods: { dmgTakenMult: 0.8 },
  },
};
