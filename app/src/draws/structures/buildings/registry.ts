// Building body registry — the per-variant draw seam, mirroring draws/towers. A
// Building's `variant` ('totem' today, more later) picks its body; unknown → the
// totem fallback. Adding a building type = one draw file + one map entry.
import type { BuildingDrawFunction, BuildingRenderState } from '../../../types';
import drawTotem from './totem';
import drawNectarFont from './nectarfont';
import { makeVariantRegistry } from '../../variantRegistry';

export const BUILDING_DRAW_MAP: Record<string, BuildingDrawFunction> = {
  totem: drawTotem,
  nectarfont: drawNectarFont,
};

/** Draw a building body of `variant`, falling back to the totem. */
export const drawBuilding = makeVariantRegistry<BuildingRenderState>(BUILDING_DRAW_MAP, drawTotem);
