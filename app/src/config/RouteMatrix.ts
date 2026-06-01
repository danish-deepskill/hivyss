import type { Route, AttackRange } from '../types';
import { LANE, LANE_VERTICAL_SPAN, LANE_DEPTH } from './Layout';

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

/**
 * Ground Y for a unit on `route` in battle `lane` (0 = upper, 1 = lower).
 * Lane 0 sits half a span above the route's base ground, lane 1 the same
 * below, so the two bilateral lanes straddle the single-lane center.
 * `lane = 0` is the default and reproduces the upper-lane position;
 * callers that don't track a lane (background art, debug) pass 0.
 */
export function getGroundY(route: Route, lane = 0): number {
  return LANE[route].groundY + (lane - 0.5) * LANE_VERTICAL_SPAN;
}

/**
 * Presentational depth cue for a battle `lane` — `{ scale, alpha }` to
 * draw the far (North/lane 0) row smaller + dimmer than the near
 * (South/lane 1) row, selling the stacking as depth rather than height.
 * Combat never reads this. Unknown lanes fall back to the far row.
 */
export function laneDepth(lane = 0): { scale: number; alpha: number } {
  return LANE_DEPTH[lane] ?? LANE_DEPTH[0];
}
