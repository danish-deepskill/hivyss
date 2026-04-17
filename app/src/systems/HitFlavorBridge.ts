// Combat Rewrite Phase 4 — HitFlavor ↔ DamageType bridge.
//
// Legacy `hitUnit` calls carry a HitFlavor (melee / ranged / aoe / burn
// / poison / heal / nectar / blocked / base) for particle & sound routing.
// The new DamageEvent needs a canonical Layer-1 `DamageType` (blunt /
// sharp / heat / cold / toxic / electric / psychic / void / holy).
//
// This mapping is TRANSITIONAL. Phase 6+ unit migrations replace each
// `ctx.hitUnit(..., 'flavor')` call with a real ability reference that
// already carries its correct `dmgType` — the bridge becomes dead code.
// Until then, the wrapper uses this function to pick the most
// representative canonical type for each legacy flavor.
//
// Ambiguous cases locked in Phase 4 (documented here; Phase 6 will
// override per-unit as each caller migrates):
//   - 'melee'  → 'blunt'  — impact-style hits default to crushing.
//                           Sharp biters (Grunt/Mandible) will set
//                           dmgType on their own ability in Phase 6.
//   - 'ranged' → 'sharp'  — pointed projectiles dominate the legacy
//                           roster (Needler, Longeye, Pricker).
//   - 'aoe'    → 'blunt'  — explosion default. Cinderfly burn-spread
//                           and Bombardier death_bomb will override.
//
// Safe cases (no ambiguity):
//   - 'burn'   → 'heat'
//   - 'poison' → 'toxic'
//
// Edge cases (should never appear in DamageEvent but defensive fallback):
//   - 'heal'    — healing is routed outside the damage pipeline; fallback 'holy'.
//   - 'nectar'  — floating reward text, not damage; fallback 'blunt'.
//   - 'blocked' — wall-ability block state, not damage; fallback 'blunt'.
//   - 'base'    — base structure hit indicator, not unit damage; fallback 'blunt'.

import type { HitFlavor } from '../types';
import type { DamageType } from '../config/combat/damageTypes';

/**
 * Pure mapping. No attacker context needed in Phase 4 — Phase 6+
 * migrations drop the bridge entirely as each unit sets its own
 * dmgType via its ability reference.
 */
export function hitFlavorToDamageType(flavor: HitFlavor): DamageType {
  switch (flavor) {
    case 'melee':   return 'blunt';
    case 'ranged':  return 'sharp';
    case 'aoe':     return 'blunt';
    case 'burn':    return 'heat';
    case 'poison':  return 'toxic';
    case 'heal':    return 'holy';
    case 'nectar':  return 'blunt';
    case 'blocked': return 'blunt';
    case 'base':    return 'blunt';
  }
}
