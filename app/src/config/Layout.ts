import type { Route } from '../types';

// Lane layout — ground levels for each route.
export const LANE: Record<Route, { groundY: number }> = {
  air:    { groundY: 300 },
  land:   { groundY: 380 },
  tunnel: { groundY: 410 },
};
