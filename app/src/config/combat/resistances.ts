// Combat Rewrite Layer 1 — resistance tiers (static data).
//
// Every unit has a resistance (default 'normal') to each damage type.
// Damage resolution in Phase 4 will:
//   1. Start at the target's resistance tier for the incoming type.
//   2. Shift DOWN by the attacker's penetration value for that type.
//   3. Look up the ability's tier table using the resulting tier.
//
// The tier table itself doesn't live here — abilities own that in
// Phase 3. This file only defines the tier ladder and the shiftTier
// primitive that Layer 2 damage math will use.
//
// Pure data + one pure function. Safe to import from tests without
// pulling Phaser or Unit construction.

export const RESISTANCE_TIERS = [
  'weakest',
  'weaker',
  'weak',
  'normal',
  'strong',
  'stronger',
  'strongest',
] as const;

export type ResistanceTier = (typeof RESISTANCE_TIERS)[number];

/** 'normal' is the implicit default for any (unit, damageType) pair with no explicit entry. */
export const DEFAULT_RESISTANCE: ResistanceTier = 'normal';

/**
 * Canonical resistance-tier → damage multiplier. The DEFAULT scaling for damage
 * sources that carry no per-ability tier table of their own — terrain pulses /
 * DoT use this so a unit's resistance to the damage type still matters (a
 * toxic-'strongest' unit shrugs off acid; a 'weak' one takes extra). One shared
 * ladder, NOT a per-source matrix. 'normal' = 1.0 (unchanged).
 */
export const RESISTANCE_DAMAGE_MULT: Record<ResistanceTier, number> = {
  weakest: 2.0,
  weaker: 1.5,
  weak: 1.25,
  normal: 1.0,
  strong: 0.6,
  stronger: 0.3,
  strongest: 0.1,
};

/** Damage multiplier for a resistance tier (see RESISTANCE_DAMAGE_MULT). */
export function resistanceDamageMult(tier: ResistanceTier): number {
  return RESISTANCE_DAMAGE_MULT[tier] ?? 1.0;
}

/**
 * Shift a resistance tier by `delta` steps along the ladder.
 * Positive delta moves toward 'strongest', negative toward 'weakest'.
 * Both ends are clamped: shifting past 'weakest' or 'strongest'
 * returns the end value, never wraps, never throws.
 *
 *   shiftTier('normal',    +1) -> 'strong'
 *   shiftTier('strong',    -1) -> 'normal'
 *   shiftTier('normal',     0) -> 'normal'
 *   shiftTier('weakest',   -5) -> 'weakest'   (clamped)
 *   shiftTier('strongest', +5) -> 'strongest' (clamped)
 *
 * Pure: takes plain values, returns a plain value, no I/O.
 */
export function shiftTier(tier: ResistanceTier, delta: number): ResistanceTier {
  const idx = RESISTANCE_TIERS.indexOf(tier);
  // Unknown input defensively clamps to 'normal' rather than returning
  // an invalid value — shouldn't happen under TS, but guards against
  // any runtime data (save files, debug commands) that bypass the type.
  if (idx < 0) return DEFAULT_RESISTANCE;
  const target = idx + delta;
  if (target < 0) return RESISTANCE_TIERS[0];
  if (target >= RESISTANCE_TIERS.length) return RESISTANCE_TIERS[RESISTANCE_TIERS.length - 1];
  return RESISTANCE_TIERS[target];
}
