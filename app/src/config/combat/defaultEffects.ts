// Default effect applied by queueAbility when an ability's
// `appliesEffects` is undefined. Three-state semantic:
//
//   appliesEffects: undefined    → DEFAULT_EFFECTS lookup by dmgType
//   appliesEffects: []           → explicit opt-out (empty list)
//   appliesEffects: [...]        → explicit override (use list verbatim)
//
// Only listed here when the target effect has a real runtime body.
// Absent entries (sharp, psychic, void, holy) intentionally skip —
// their declarative defaults live on DAMAGE_TYPES metadata but the
// effects aren't wired yet. Ship an entry here only when its target
// effect's onApply/onTick produces observable behavior.
//
// Current wiring status:
//   blunt    → knockback   (onApply: poise accum + stagger FX — Phase 10 Batch 3)
//   heat     → burn        (onTick: chunked DOT — Phase 7a)
//   electric → stun        (onApply: stunTimer bridge + stun FX — Phase 8)
//   cold     → slow        (tiers declared but no onApply; inert until wired)
//   toxic    → poison      (tiers declared but no onTick; inert until wired)
//
// The cold/toxic entries are intentional: their target EffectDefs
// exist in the registry so lookupEffect won't throw, and listing them
// here pins the damage-type → default-effect mapping for future
// wiring work. Until slow/poison get real bodies, they apply a
// one-frame transient that sweeps silently on next updateEffects.

import type { DamageType } from './damageTypes';

export const DEFAULT_EFFECTS: Partial<Record<DamageType, string>> = {
  blunt: 'knockback',
  heat: 'burn',
  electric: 'stun',
  cold: 'slow',
  toxic: 'poison',
};
