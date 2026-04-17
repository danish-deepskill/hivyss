// Pre-computed-damage ability — used by the DOT dispatcher and
// Bombardier's death_bomb to queue events whose damage comes from
// `opts.baseDamageOverride` rather than the tier table. `skipsResistance`
// routes the calculate-phase fast path; the event picks up its dmgType
// per-call via the HitFlavor bridge at queue time.

import type { AbilityDef } from '../../../types';

export const overrideAbilities: Record<string, AbilityDef> = {
  override_damage_event: {
    name: 'Override Damage Event',
    category: 'damage',
    targeting: 'no_targeting',
    trigger: 'onAttack',
    skipsResistance: true,
  },
};
