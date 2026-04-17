// Electric damage abilities. Electric carries stun by default via
// DEFAULT_EFFECTS['electric'].

import type { AbilityDef } from '../../../types';
import { linearDamageTiersWithEffect } from './_tierTables';

export const electricAbilities: Record<string, AbilityDef> = {
  // Stormfly chain lightning. Stun lands via the electric default,
  // gated by effectChance: 0.25. targetFalloff drives per-target
  // damage via event._targetIndex; overchargeEvery: 4 doubles damage
  // every fourth cast via ResourceSystem castCount + event.damageMultiplier.
  chain_lightning: {
    name: 'Chain Lightning',
    category: 'damage',
    dmgType: 'electric',
    targeting: 'nearest_enemies_in_range',
    range: 130,
    targetCount: 3,
    trigger: 'onAttack',
    tiers: linearDamageTiersWithEffect(0.25),
    targetFalloff: [1.0, 0.7, 0.4],
    overchargeEvery: 4,
    // Secondary targets selected within 114px of the PRIMARY target,
    // not the attacker — chain arc metric.
    chainRange: 114,
  },
};
