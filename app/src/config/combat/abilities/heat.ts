// Heat damage abilities. Heat carries burn by default via
// DEFAULT_EFFECTS['heat'].

import type { AbilityDef } from '../../../types';
import { linearDamageTiers, linearDamageTiersWithEffect } from './_tierTables';

export const heatAbilities: Record<string, AbilityDef> = {
  // Cinderfly basic. Burn lands via the heat default; aoeRider
  // spreads it to up to 3 neighbors within 85px (primary excluded —
  // the default already covers it).
  fire_bite: {
    name: 'Fire Bite',
    category: 'damage',
    dmgType: 'heat',
    targeting: 'nearest_enemy_in_range',
    range: 30,
    targetCount: 1,
    trigger: 'onAttack',
    tiers: linearDamageTiersWithEffect(1.0),
    aoeRider: {
      effect: 'burn',
      radius: 85,
      targetCount: 3,
      excludePrimary: true,
    },
    // The bite IGNITES — a flame bloom at the hit (impact seam, not cast),
    // sized to read as the burn-splash radius.
    impactFx: { kind: 'fireburst' },
  },

  // Bombardier's death explosion. Opts out of the heat → burn default
  // — one-shot blast, not an ignition.
  death_bomb: {
    name: 'Death Bomb',
    category: 'damage',
    dmgType: 'heat',
    targeting: 'all_enemies_in_range',
    range: 50,
    targetCount: 5,
    trigger: 'onDeath',
    appliesEffects: [],
    tiers: linearDamageTiers(),
  },
};
