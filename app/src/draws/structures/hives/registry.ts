// Hive draw registry — the per-geneline body seam, mirroring the unit
// trait→DrawFunction registry in units/registry.ts. A geneline's hive is its
// architecture: the body draw owns geneline IDENTITY, HiveStructure owns the
// shared state chrome (shadow / hit-flash / shield). Adding a geneline's hive
// is one import + one map entry here — nothing else changes (open/closed).
import type { GeneLine, HiveDrawFunction, HiveRenderState } from '../../../types';
import drawNormalHive from './normal';
import drawAlphaHive from './alpha';
import drawBetaHive from './beta';
import { makeVariantRegistry } from '../../variantRegistry';

// Partial: only authored genelines need an entry; everything else falls back
// to the wax dome (the untagged read) via drawHive below.
export const HIVE_DRAW_MAP: Partial<Record<GeneLine, HiveDrawFunction>> = {
  normal: drawNormalHive,
  alpha: drawAlphaHive,
  beta: drawBetaHive,
};

/** Draw a hive body for `geneline`, falling back to the wax dome. */
export const drawHive = makeVariantRegistry<HiveRenderState, GeneLine>(HIVE_DRAW_MAP, drawNormalHive);
