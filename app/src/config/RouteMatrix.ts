import type { Route, AttackRange } from '../types';
import { LANE, LANE_BAND_SPAN, BAND_FAR_SCALE, BAND_FAR_ALPHA } from './Layout';

export const ROUTE_MATRIX: Record<Route, Record<Route, 'always' | 'ranged' | 'never'>> = {
  air:    { air: 'always', land: 'always', tunnel: 'never' },
  land:   { air: 'ranged', land: 'always', tunnel: 'never' },
  tunnel: { air: 'never',  land: 'never',  tunnel: 'always' },
};

export function canAttack(attackerRoute: Route, attackRange: AttackRange, targetRoute: Route): boolean {
  const rule = ROUTE_MATRIX[attackerRoute][targetRoute];
  if (rule === 'always') return true;
  if (rule === 'ranged') return attackRange === 'ranged';
  return false;
}

/** Ground Y for a unit on `route` — the single ground line for that stratum
 *  (air canopy / land surface / tunnel gallery). */
export function getGroundY(route: Route): number {
  return LANE[route].groundY;
}

/**
 * Continuous depth-band placement for a unit at band position `t` (0 = back,
 * 1 = front). The "done-right" continuous replacement for the old discrete
 * lane-depth: the spread is DOWNWARD-ONLY into the grass band — back rows sit ON
 * the ground line (smaller + dimmer), front rows DOWN into the grass (full size)
 * — so the herd reads as a soft band with depth and nobody floats above the
 * surface. PRESENTATION ONLY — combat never reads it (it's pure 1-D x). `t` is clamped.
 */
export function bandDepth(t: number): { dy: number; scale: number; alpha: number } {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    dy: LANE_BAND_SPAN * c, // back (c=0) = on the line; front (c=1) = +SPAN, down into the grass
    scale: BAND_FAR_SCALE + (1 - BAND_FAR_SCALE) * c,
    alpha: BAND_FAR_ALPHA + (1 - BAND_FAR_ALPHA) * c,
  };
}
