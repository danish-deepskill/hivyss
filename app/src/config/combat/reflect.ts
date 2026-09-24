// Reflect (thorns) — PURE decision. Given a resolved damage event, returns the
// return-hit to queue (reflector → original attacker), or null. CombatSystem's
// post_apply handler calls this and queues the result with isReflected = true.
//
// Guards (why each):
//   - event.isReflected        → never reflect a reflect (THE loop break)
//   - event._baseDamageOverride → DoT / terrain / death / reflect all set this;
//                                 only REAL direct hits reflect
//   - finalDamage > 0           → no free hits off whiffs
//   - target carries reflect + both parties alive

import type { DamageEvent, WorldEntity } from '../../types';

interface Reflector extends WorldEntity {
  reflect?: { pct: number };
}

export interface ReflectResult {
  /** The reflector — source of the return hit. */
  source: WorldEntity;
  /** The original attacker — takes the return hit. */
  victim: WorldEntity;
  /** Flat return damage (already floored, ≥1). */
  amount: number;
}

export function computeReflect(event: DamageEvent): ReflectResult | null {
  if (event.isReflected) return null;
  if (event._baseDamageOverride !== undefined) return null;
  if (event.finalDamage <= 0) return null;

  const target = event.target as Reflector;
  const pct = target.reflect?.pct;
  if (!pct || target.dead) return null;

  const attacker = event.attacker;
  if (!attacker || attacker.dead) return null;

  const amount = Math.floor(event.finalDamage * pct);
  if (amount < 1) return null;

  return { source: target, victim: attacker, amount };
}
