// Blunt damage abilities. Blunt carries the knockback effect by
// default via DEFAULT_EFFECTS['blunt']; abilities opt out with
// `appliesEffects: []` or override with an explicit list.

import type { AbilityDef } from '../../../types';
import { linearDamageTiers } from './_tierTables';

export const bluntAbilities: Record<string, AbilityDef> = {
  bash_strike: {
    name: 'Bash Strike',
    category: 'damage',
    dmgType: 'blunt',
    targeting: 'nearest_enemy_in_range',
    range: 32,
    targetCount: 1,
    trigger: 'onAttack',
    tiers: linearDamageTiers(),
  },
};
