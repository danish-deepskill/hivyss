// Armour degrade — γ's "armour as a degrading resource" hook. PURE.
//
// A γ unit's PHYSICAL resistance (sharp/blunt) starts high and WEARS DOWN as it
// soaks physical damage: every `per` points of physical damage taken drops both
// physical tiers one step toward `normal` — the FLOOR (armour strips to normal,
// never below, so γ never becomes *weak*, just un-armoured). Repair (Aegis/Regina,
// later) shifts the tiers back up. CombatSystem's post_apply hook accumulates the
// wear and calls this; the resistance mutation is applied on the unit.

import type { ResistanceTier } from './resistances';
import { shiftTier, resistanceDamageMult } from './resistances';

/** A tier is "stripped" (at/under the floor) when it no longer reduces damage. */
function atFloor(t: ResistanceTier | undefined): boolean {
  return t === undefined || resistanceDamageMult(t) >= 1.0;
}

/** Weaken one tier toward `normal`, clamped AT normal (never below). */
function stepDown(t: ResistanceTier | undefined): ResistanceTier | undefined {
  if (t === undefined || resistanceDamageMult(t) >= 1.0) return t; // already stripped
  const next = shiftTier(t, -1);
  return resistanceDamageMult(next) > 1.0 ? 'normal' : next; // clamp at normal
}

export interface DegradeResult {
  sharp: ResistanceTier | undefined;
  blunt: ResistanceTier | undefined;
  /** Leftover wear below the next `per` threshold. */
  wear: number;
}

/**
 * Apply accumulated physical-damage `wear` to the sharp/blunt tiers. Each `per`
 * threshold drops BOTH one step toward normal. Stops once both are stripped
 * (leftover wear is retained but won't degrade further). Pure — no mutation.
 */
export function degradeArmor(
  sharp: ResistanceTier | undefined,
  blunt: ResistanceTier | undefined,
  wear: number,
  per: number,
): DegradeResult {
  if (per <= 0) return { sharp, blunt, wear };
  while (wear >= per && !(atFloor(sharp) && atFloor(blunt))) {
    wear -= per;
    sharp = stepDown(sharp);
    blunt = stepDown(blunt);
  }
  return { sharp, blunt, wear };
}
