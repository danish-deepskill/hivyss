// Phase 8 F5 IP-3 + IP-5 — passive-tick predicate table.
//
// Named predicates that gate `SelfModifierConfig.condition` lookups
// in the `updatePassives` tick loop. Predicates are pure functions
// over a single IUnit argument, returning `true` when the unit's
// self-modifier should be active and `false` when it should be
// removed.
//
// WHY STRING KEYS, NOT CLOSURES:
//   `SelfModifierConfig.condition` is a string, not a function
//   reference. This keeps UnitDef pure data (serializable,
//   testable, grep-friendly) and lets future tuning swap predicates
//   via a data-only edit. The table below is the one code site that
//   binds string keys to runtime behavior.
//
// ADDING A NEW PREDICATE:
//   1. Add a new entry to `PREDICATE_TABLE` below keyed on a new
//      `snake_case` string that describes the predicate.
//   2. Add a test in `PassivePredicates.test.ts` covering the
//      predicate's truth table (positive case, negative case,
//      boundary case).
//   3. Reference the new key from a `self_modifier` passive's
//      `condition` (an entry in `UnitDef.passives`) on the consuming
//      unit.
//
// NO STATE:
//   Predicates are STATELESS. They read `u.hp / u.maxHp` or
//   equivalent derived values each frame and return a fresh
//   boolean. State-gated behavior (e.g. "cooldown remaining") does
//   NOT belong here — it belongs in ResourceSystem or a dedicated
//   tick-accumulator field.
//
// STEP FUNCTIONS, NOT CONTINUOUS FORMULAS:
//   Predicates return boolean, not a continuous multiplier. The
//   self-modifier's `value` is fixed; the predicate just gates
//   whether the modifier is applied or removed. This pattern
//   preserves Phase 5 ModifierSystem stacking semantics cleanly —
//   no fractional modifier values, no sliding scales. Sliding
//   scales are Phase 10 balance territory and require a different
//   mechanism (probably `getAtk`-style ability hooks or dedicated
//   non-modifier passive subscribers).

import type { IUnit } from '../types';

/**
 * Predicate registry. Keyed on `SelfModifierConfig.condition`
 * strings. Each entry is a pure `(u: IUnit) => boolean`.
 *
 * STAGE 4 INVENTORY:
 *   - `hp_below_half` — Ravager rage (item 11). True when the unit's
 *     HP is at or below 50% of maxHp. Boundary case (hp === maxHp/2)
 *     evaluates TRUE to match the legacy step-function contract
 *     (legacy `hpFrac <= 0.5` at [alpha.ts:278](units/alpha.ts#L278)
 *     pre-migration).
 *
 * Future Phase 8/9/10 additions should append here without
 * reordering the existing entries.
 */
export const PREDICATE_TABLE: Record<string, (u: IUnit) => boolean> = {
  /**
   * Ravager rage — true when HP is at or below 50% of maxHp.
   * Matches the legacy `ravagerCombat.onUpdate` step function byte-
   * for-byte (legacy used `hpFrac <= 0.5` with the same boundary
   * inclusivity). Dead units (hp ≤ 0) trivially satisfy this — the
   * passive tick loop should skip dead units at a higher level
   * (`alive.filter(u => !u.dead)` upstream of `updatePassives`),
   * so the boundary doesn't cause a spurious post-death modifier
   * application.
   */
  hp_below_half: (u: IUnit): boolean => u.hp / u.maxHp <= 0.5,
};

/**
 * Predicate lookup helper. Returns `undefined` if the key is not
 * registered — the caller is responsible for handling the
 * "unknown predicate" case. Does NOT throw on unknown keys because
 * pool-recycled Units can transiently carry stale predicate names
 * during hot-reload; throwing would crash combat on reload.
 *
 * Callers should log a warning when a lookup fails so stale
 * predicate names don't silently no-op forever.
 */
export function lookupPredicate(
  condition: string,
): ((u: IUnit) => boolean) | undefined {
  return PREDICATE_TABLE[condition];
}
