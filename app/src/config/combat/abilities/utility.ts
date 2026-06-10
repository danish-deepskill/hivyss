// Utility abilities — heals, passive auras, non-damage support.
// No dmgType and no tier table; damage resolution skips them.

import type { AbilityDef } from '../../../types';

export const utilityAbilities: Record<string, AbilityDef> = {
  // Matriarch's Royal ULTIMATE — Primal Roar. A utility/buff signature (not
  // damage): applies `herd_roar` to same-lane allies within `range`, so the
  // herd surges to peak cohesion + charges forward for the effect's duration.
  // The signature path applies it directly (no damage pipeline) and lane-scopes
  // it; `targetCount` is high so a full gathered herd all catches the roar.
  primal_roar: {
    name: 'Primal Roar',
    category: 'utility',
    targeting: 'all_allies_in_range',
    range: 140,
    targetCount: 24,
    appliesEffects: ['herd_roar'],
    fx: { kind: 'shockwave' },
    sfx: 'stampede',
  },


  // Mendwing's passive heal cast. Dispatched by the heal_cast passive
  // handler (PassiveHandlers.ts) every `cooldown` seconds against the
  // lowest-HP in-range ally.
  heal_pulse: {
    name: 'Heal Pulse',
    category: 'heal',
    targeting: 'lowest_hp_ally_in_range',
    range: 90,
    targetCount: 1,
    trigger: 'passive',
    healAmount: 20,
  },

  // Centurion rally aura. Runs via the aura_modifier passive handler
  // reading the unit's `aura_modifier` passive, NOT via this ability —
  // declaration is retained for registry coverage parity.
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
  // reads the unit's `aura_modifier` passive.
  guardian_ward: {
    name: 'Guardian Ward',
    category: 'passive',
    targeting: 'all_allies_in_range',
    range: 114,
    trigger: 'passive',
    auraMods: { dmgTakenMult: 0.8 },
  },
};
