import type { Route } from '../types';

// Route ground levels as a NATURAL cross-section, tuned to ≈50:50 sky:ground.
// Air sits in the sky/forest; land on the green grass surface (~halfway down);
// tunnel just below in the dug nest galleries (close to land, NOT at the very
// bottom). Gaps stay above LANE_VERTICAL_SPAN (24) so a route's two lanes never
// interleave. Battlefield ≈ 0..480 visible above the HUD.
export const LANE: Record<Route, { groundY: number }> = {
  air:    { groundY: 240 },  // sky / forest canopy
  land:   { groundY: 300 },  // green grass surface (~50% down the visible field)
  tunnel: { groundY: 380 },  // dug nest galleries just under the surface
};

// Vertical distance between the two bilateral battle lanes (px). Lane 0
// sits LANE_VERTICAL_SPAN/2 above the route's base ground, lane 1 the
// same below it (see getGroundY in RouteMatrix.ts). Kept SMALLER than the
// inter-route spacing (100px, see LANE) so a route's two lanes never cross
// into the next route's band. The stacking reads as DEPTH, not distance —
// the far lane is also drawn smaller/dimmer (see LANE_DEPTH), so a small
// offset already separates the two fronts. The land midline is the lane
// divider rendered in SandboxScene.
export const LANE_VERTICAL_SPAN = 24;

// Per-lane depth cues. The two lanes share ONE flat ground plane; the
// vertical offset reads as depth — lane 0 = North = farther from camera
// (smaller + dimmer), lane 1 = South = nearer (full size). PURELY
// presentational: combat math uses logical x / unitW, never these. Index
// by lane; out-of-range lanes fall back to North (see laneDepth()).
export const LANE_DEPTH: { scale: number; alpha: number }[] = [
  { scale: 0.72, alpha: 0.7 },  // lane 0 — North (far): smaller + faded into distance
  { scale: 1.0,  alpha: 1.0 },  // lane 1 — South (near): full, foreground
];
