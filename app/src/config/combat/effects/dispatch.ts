// DOT damage dispatch wiring.
//
// Exists to break a circular import: burn.onTick needs to route damage
// through CombatSystem so ticks inherit the apply-phase aura hooks,
// but dot.ts cannot import CombatSystem (EffectSystem → effects/index
// → dot → CombatSystem → EffectSystem). CombatSystem registers its
// callback here at construction time; burn.onTick calls dispatchDotDamage.
//
// The registered closure also handles save-restore of _lastAttacker
// so DOT ticks don't leak attacker state across frames. Keeping that
// discipline inside CombatSystem means future DOT hooks inherit it
// for free.

import type { HitFlavor } from '../../../types';
import type { EffectBearer } from './types';

export type DotDispatcher = (
  attacker: unknown,
  target: EffectBearer,
  dmg: number,
  flavor: HitFlavor,
) => void;

let _dispatcher: DotDispatcher | null = null;

/** Register the DOT damage dispatcher. Pass null to clear (test teardown). */
export function setDotDispatcher(fn: DotDispatcher | null): void {
  _dispatcher = fn;
}

/** Silently no-ops when no dispatcher is registered — hooks call unconditionally. */
export function dispatchDotDamage(
  attacker: unknown,
  target: EffectBearer,
  dmg: number,
  flavor: HitFlavor,
): void {
  if (_dispatcher === null) return;
  _dispatcher(attacker, target, dmg, flavor);
}

/** Test helper — read the currently-registered dispatcher. */
export function getDotDispatcher(): DotDispatcher | null {
  return _dispatcher;
}
