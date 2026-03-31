import type { Route, AttackRange } from '../types';
import { LANE } from './Layout';

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

export function getGroundY(route: Route): number {
  return LANE[route].groundY;
}
