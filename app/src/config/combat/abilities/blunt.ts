// Blunt damage abilities. Blunt carries the knockback effect by
// default via DEFAULT_EFFECTS['blunt']; abilities opt out with
// `appliesEffects: []` or override with an explicit list.

import type { AbilityDef } from '../../../types';
import { linearDamageTiersWithKnockForce } from './_tierTables';

export const bluntAbilities: Record<string, AbilityDef> = {
  // Homogenized knockForce = 100 — highest source-unit value from the
  // knockback-refactor audit (Bashguard 100, Legionnaire 20 dissolved
  // into the homogenized value). Flat across all 7 tiers preserves
  // pre-refactor knockback parity; per-tier scaling is a future
  // balance pass.
  bash_strike: {
    name: 'Bash Strike',
    category: 'damage',
    dmgType: 'blunt',
    targeting: 'nearest_enemy_in_range',
    range: 32,
    targetCount: 1,
    trigger: 'onAttack',
    tiers: linearDamageTiersWithKnockForce(100),
  },
};
