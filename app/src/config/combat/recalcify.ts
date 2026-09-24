// γ Calcifier re-hardening — the inverse of armorDegrade. Where degrade
// STRIPS physical tiers as the wall soaks blows, recalcify GROWS them back,
// one rung per pulse, toward the unit's immutable spawn-time base. This is
// the fortress capstone's signature: the only γ body that heals the armour
// its own geneline mechanic consumes. PHYSICAL ONLY by design — it touches
// sharp/blunt, never elemental, so fire/acid/lightning stay the γ-invariant
// way to bring a wall down (see units/gamma.ts header).
//
// Pure: plain values in, plain values out — testable without Phaser. The
// caller (the recalcify passive handler) writes the returned tiers onto the
// live `resistance` map and zeroes the wear meter.

import { shiftTier, RESISTANCE_TIERS } from './resistances';
import type { ResistanceTier } from './resistances';

/** The sharp/blunt subset recalcify reads + returns. The live `resistance`
 *  map (Partial<Record<DamageType, ...>>) is structurally assignable to this. */
export interface ArmorTiers {
  sharp?: ResistanceTier;
  blunt?: ResistanceTier;
}

/**
 * Step one degraded tier a single rung back UP toward its base, never past
 * it. Undefined-in (no resistance to that type) stays undefined-out. Already
 * at/above base → unchanged (a re-harden never over-shoots the spawn armour).
 */
function stepUp(
  current: ResistanceTier | undefined,
  base: ResistanceTier | undefined,
): ResistanceTier | undefined {
  if (current === undefined || base === undefined) return current;
  if (RESISTANCE_TIERS.indexOf(current) >= RESISTANCE_TIERS.indexOf(base)) return current;
  return shiftTier(current, 1);
}

export interface RecalcifyResult {
  sharp?: ResistanceTier;
  blunt?: ResistanceTier;
}

/**
 * One re-hardening pulse: step each physical tier one rung toward base.
 * Returns the tiers to write back; the caller also resets `_armorWear` to 0
 * (a re-harden re-sets the soak meter — the wall is fresh again).
 */
export function recalcify(current: ArmorTiers, base: ArmorTiers): RecalcifyResult {
  return {
    sharp: stepUp(current.sharp, base.sharp),
    blunt: stepUp(current.blunt, base.blunt),
  };
}
