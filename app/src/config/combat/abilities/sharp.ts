// Sharp damage abilities — default physical attack flavor.

import type { AbilityDef } from '../../../types';
import { linearDamageTiers } from './_tierTables';

export const sharpAbilities: Record<string, AbilityDef> = {
  jaw_strike: {
    name: 'Jaw Strike',
    category: 'damage',
    dmgType: 'sharp',
    targeting: 'nearest_enemy_in_range',
    range: 30,
    targetCount: 1,
    trigger: 'onAttack',
    tiers: linearDamageTiers(),
    sfx: 'jaw',
  },

  pricker_jab: {
    name: 'Pricker Jab',
    category: 'damage',
    dmgType: 'sharp',
    targeting: 'nearest_enemy_in_range',
    range: 95,
    targetCount: 1,
    trigger: 'onAttack',
    tiers: linearDamageTiers(),
  },

  needle_shot: {
    name: 'Needle Shot',
    category: 'damage',
    dmgType: 'sharp',
    targeting: 'nearest_enemy_in_range',
    range: 90,
    targetCount: 1,
    trigger: 'onAttack',
    tiers: linearDamageTiers(),
    sfx: 'needle',
  },

  piercing_shot: {
    name: 'Piercing Shot',
    category: 'damage',
    dmgType: 'sharp',
    targeting: 'nearest_enemies_in_range',
    range: 240,
    targetCount: 2,
    trigger: 'onAttack',
    tiers: linearDamageTiers(),
    targetFalloff: [1.0, 0.5],
  },
};
