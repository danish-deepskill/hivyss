// Shared tier-table builders. Tiers encode a multiplier scheme:
// caster supplies base damage via `atk`, the tier table scales by
// target resistance. `normal` is always 1.0× so resistance-neutral
// targets see unscaled damage.

import type { AbilityTierStats } from '../../../types';
import type { ResistanceTier } from '../resistances';

/** Standard linear distribution across the 7 resistance tiers. */
export function linearDamageTiers(scale: number = 1): Record<ResistanceTier, AbilityTierStats> {
  return {
    weakest:   { dmgMult: 1.50 * scale },
    weaker:    { dmgMult: 1.30 * scale },
    weak:      { dmgMult: 1.15 * scale },
    normal:    { dmgMult: 1.00 * scale },
    strong:    { dmgMult: 0.85 * scale },
    stronger:  { dmgMult: 0.70 * scale },
    strongest: { dmgMult: 0.50 * scale },
  };
}

/** Linear tiers with a uniform effectChance across all tiers. */
export function linearDamageTiersWithEffect(
  effectChance: number,
  scale: number = 1,
): Record<ResistanceTier, AbilityTierStats> {
  const base = linearDamageTiers(scale);
  for (const k of Object.keys(base) as ResistanceTier[]) {
    base[k].effectChance = effectChance;
  }
  return base;
}
