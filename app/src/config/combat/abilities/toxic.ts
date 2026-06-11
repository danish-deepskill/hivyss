// Toxic damage abilities — β Swarm's death-effect arsenal. Both are DEATH
// triggers (deathAbility casts): the dispatcher fires them lane-scoped around
// the dying unit with `deathDamage` as the override damage, and toxic's
// default effect (poison, now wired) rides along per the 3-state convention.

import type { AbilityDef } from '../../../types';
import { linearDamageTiersWithEffect } from './_tierTables';

export const toxicAbilities: Record<string, AbilityDef> = {
  // Hivespitter's basic attack — a lobbed acid glob. Toxic's default effect
  // (poison) rides along at 35% per hit, so sustained spitting stacks the DOT.
  acid_spit: {
    name: 'Acid Spit',
    category: 'damage',
    dmgType: 'toxic',
    targeting: 'nearest_enemy_in_range',
    range: 85,
    targetCount: 1,
    trigger: 'onAttack',
    tiers: linearDamageTiersWithEffect(0.35),
  },

  // Maggotling — death → a soft spore puff: low burst, the POISON is the point.
  spore_burst: {
    name: 'Spore Burst',
    category: 'damage',
    dmgType: 'toxic',
    targeting: 'all_enemies_in_range',
    range: 42,
    targetCount: 4,
    trigger: 'onDeath',
    skipsResistance: true,
    deathDamage: 14,
  },

  // Hivespitter — death → its acid gland ruptures: harder burst, wider splash,
  // the same poison ride-along (the "lingering pool" is the DOT it leaves in
  // everyone caught).
  acid_pool: {
    name: 'Acid Rupture',
    category: 'damage',
    dmgType: 'toxic',
    targeting: 'all_enemies_in_range',
    range: 52,
    targetCount: 5,
    trigger: 'onDeath',
    skipsResistance: true,
    deathDamage: 22,
  },
};
