// Core FX renderers — the procedural draw-from-t functions registered on the
// FxDirector. Each is presentation-only; tune the constants by eye.
// See app/docs/active/FX_SYSTEM.md.

import type { FxDirector } from './FxDirector';

// --- Shockwave (Goliath's Stampede; any AOE charge) ---------------------
// A ground ring that bursts outward and fades. Radius scales with the FX
// `magnitude` (0..1) — for Stampede that's the herd's cohesion, so a tightly
// massed pack throws a far bigger wave than a lone Goliath. Flattened
// vertically for ground perspective; an outer dust ring + a bright inner edge.
const SHOCKWAVE_DURATION = 0.5;  // snappy expand+fade — punchy for a charge impact
const SHOCKWAVE_BASE_R = 48;      // radius at magnitude 0 (lone caster)
const SHOCKWAVE_GROW_R = 110;     // extra radius at magnitude 1 (full cohesion)

export function registerCoreFx(director: FxDirector): void {
  director.register('shockwave', SHOCKWAVE_DURATION, (fx, t, g) => {
    const ease = 1 - (1 - t) * (1 - t);                 // ease-out expand
    const maxR = SHOCKWAVE_BASE_R + SHOCKWAVE_GROW_R * fx.magnitude;
    const r = maxR * ease;
    const fade = 1 - t;                                  // fade as it grows
    const ry = r * 0.5;                                  // flatten = ground plane

    // Soft dust fill — a translucent blast disc, thins as it expands.
    g.fillStyle(fx.color, fade * 0.16);
    g.fillEllipse(fx.x, fx.y, r * 2, ry * 2);
    // Outer dust ring (the unit's tint, e.g. blunt = tan).
    g.lineStyle(6, fx.color, fade * 0.6);
    g.strokeEllipse(fx.x, fx.y, r * 2, ry * 2);
    // Bright leading edge, a hair inside.
    g.lineStyle(3, 0xffe6b0, fade * 0.95);
    g.strokeEllipse(fx.x, fx.y, r * 1.78, ry * 1.78);
  });
}
