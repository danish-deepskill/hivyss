// Toxic damage abilities — β Swarm's death-effect arsenal: biological ROT
// (spore / bile), NOT chemical acid. Corrosion / armor-melt is reserved for
// the future acid geneline (GENELINES §1.0) — β's toxic is pure DOT + AOE,
// never armor destruction. The death triggers (deathAbility casts) fire
// lane-scoped around the dying unit with `deathDamage` as the override, and
// toxic's default effect (poison = the rot spreading) rides along.

import type { AbilityDef } from '../../../types';
import { linearDamageTiersWithEffect } from './_tierTables';

export const toxicAbilities: Record<string, AbilityDef> = {
  // Hivespitter's basic attack — a lobbed glob of BILE (digestive swarm-fluid,
  // not chemical acid). Toxic's default effect (poison) rides along at 35% per
  // hit, so sustained spitting stacks the rot DOT.
  bile_spit: {
    name: 'Bile Spit',
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

  // Hivespitter — death → its bile gland ruptures: harder burst, wider splash,
  // the same poison ride-along (the "lingering pool" is the rot DOT it leaves
  // in everyone caught).
  bile_rupture: {
    name: 'Bile Rupture',
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
