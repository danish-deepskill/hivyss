// Terrain integration seam — decouples CombatSystem from TerrainSystem, the same
// module-singleton pattern as effects/dispatch.ts and CombatDispatch.ts.
//
// Two hooks, both no-op until a TerrainSystem registers (so tests and the
// no-terrain path are unaffected):
//   - terrainEffectAt(route, x): the NARROW query (delta #7 / ISP) movement
//     reads in `march` for block / slow / root. A pure positional lookup.
//   - dispatchTerrainTick(units, dt): CombatSystem calls this AT its effect-tick
//     point, INSIDE resolve() — where the combat ctx is live — so terrain DoT /
//     pulses route through the existing DoT seam and feed the death economy.

import type { Route, IUnit } from '../types';
import type { TerrainEffect } from '../config/TerrainDefs';

type GetEffectFn = (route: Route, x: number) => TerrainEffect | null;
type TickFn = (units: IUnit[], dt: number) => void;

let _getEffect: GetEffectFn | null = null;
let _tick: TickFn | null = null;

/** Register the positional effect query. Pass null to clear (test/battle teardown). */
export function setTerrainQuery(fn: GetEffectFn | null): void {
  _getEffect = fn;
}

/** The terrain effect at a world position on a route, or null (no terrain registered / empty cell). */
export function terrainEffectAt(route: Route, x: number): TerrainEffect | null {
  return _getEffect ? _getEffect(route, x) : null;
}

/** Register the per-frame unit-interaction tick. Pass null to clear. */
export function setTerrainTick(fn: TickFn | null): void {
  _tick = fn;
}

/** Run the terrain unit-interaction tick (DoT, catalyst cell-entry). No-op when unregistered. */
export function dispatchTerrainTick(units: IUnit[], dt: number): void {
  if (_tick) _tick(units, dt);
}
