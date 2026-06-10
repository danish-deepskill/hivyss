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
 * Inverse of getGroundY for the land route — which battle lane a world-Y
 * falls in (0 = upper, 1 = lower). Used to map a click to a lane (Royal
 * control, sandbox placement). Picks the nearer lane ground line.
 */
export function laneFromY(y: number): number {
  return Math.abs(y - getGroundY('land', 1)) < Math.abs(y - getGroundY('land', 0)) ? 1 : 0;
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

/**
 * Depth cue for a FRACTIONAL lane (0..1) — interpolates scale + alpha between the
 * two rows. Drives a unit mid lane-switch as it slides across the depth stack
 * (grows/brightens toward the near row, shrinks/dims toward the far one). At an
 * integer lane it returns that row's exact values, so settled units are unchanged.
 */
export function laneDepthLerp(lane: number): { scale: number; alpha: number } {
  const t = lane < 0 ? 0 : lane > 1 ? 1 : lane;
  const a = LANE_DEPTH[0], b = LANE_DEPTH[1];
  return { scale: a.scale + (b.scale - a.scale) * t, alpha: a.alpha + (b.alpha - a.alpha) * t };
}
