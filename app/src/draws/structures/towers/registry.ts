// Tower body registry — the per-variant draw seam, mirroring draws/hives. A
// Tower's `variant` ('spire', later 'bunker', …) picks its body; unknown →
// the spire fallback. Adding a tower type = one draw file + one map entry.
import type { TowerDrawFunction, TowerRenderState } from '../../../types';
import drawSpire from './spire';
import { makeVariantRegistry } from '../../variantRegistry';

export const TOWER_DRAW_MAP: Record<string, TowerDrawFunction> = {
  spire: drawSpire,
};

/** Draw a tower body of `variant`, falling back to the spire. */
export const drawTower = makeVariantRegistry<TowerRenderState>(TOWER_DRAW_MAP, drawSpire);
