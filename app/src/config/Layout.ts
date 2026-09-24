import type { Route } from '../types';

// Route ground levels as a NATURAL cross-section, tuned to ≈50:50 sky:ground.
// Air sits in the sky/forest; land on the green grass surface (~halfway down);
// tunnel just below in the dug nest galleries (close to land, NOT at the very
// bottom). Battlefield ≈ 0..480 visible above the HUD. Keyed by ROUTE — the
// air/land/tunnel strata foundation (the future Shift=tunnel deploy builds on it).
export const LANE: Record<Route, { groundY: number }> = {
  air:    { groundY: 240 },  // sky / forest canopy
  land:   { groundY: 300 },  // green grass surface (~50% down the visible field)
  tunnel: { groundY: 380 },  // dug nest galleries just under the surface
};

// --- Unit depth band (presentation only) ---
// Units spread DOWNWARD from their route's ground line into the grass band so
// the single front reads as a road with depth/mass — this is NOT lanes (no lane
// field, no gating; combat stays purely 1-D x). Back of the band = ON the line +
// smaller + dimmer; front = lower in the grass + full size. The span is capped
// to the grass-band depth so front feet never reach the dirt. EYEBALL starters.
export const LANE_BAND_SPAN = 16;   // vertical px the band spans (grass band is ~20px; margin left)
export const BAND_FAR_SCALE = 0.88; // scale at the back of the band (1.0 at the front)
export const BAND_FAR_ALPHA = 0.9;  // alpha at the back of the band (1.0 at the front)

// Unit render-depth base — units sit ABOVE the pheromone scent layer (50) and
// the Royal control ring (51). Each unit adds `depth * 10` (its band position),
// so the 60..70 band renders near (front) units over far (back) ones. The
// tunnel veil + cast-FX layers sit ABOVE the whole band (BiomeBackground veil =
// 72, scene FX = 80) so tunnel units stay buried and FX stays over the herd.
export const UNIT_DEPTH_BASE = 60;
