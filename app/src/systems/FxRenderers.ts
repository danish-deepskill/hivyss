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

  registerFireburst(director);
}

// --- Fireburst (Cinderfly's Fire Bite) ----------------------------------
// A BITE, not an explosion: two curved flame fang-arcs (upper + lower) that
// SNAP shut at the hit, then a small hot flash + a few sparks. Small and
// quick — it's a basic melee chomp, not a blast. The burn SPLASH is carried
// by the victims' own burn DOT, not by this FX.
const FIREBURST_DURATION = 0.3;   // snappy chomp
const JAW_R = 11;                  // fang-arc radius (small — a bite)

function registerFireburst(director: FxDirector): void {
  director.register('fireburst', FIREBURST_DURATION, (fx, t, g) => {
    const snap = Math.min(1, t / 0.35);            // 0→1 jaws closing
    const gape = (1 - snap) * (1 - snap) * 9;       // px apart → 0 (eased)
    const flare = Math.max(0, (t - 0.28) / 0.72);  // 0 until closed, then 0→1
    const fade = 1 - t * t;
    const hot = 0xffd848, mid = 0xff7a18, deep = 0xd83008;

    // Upper fang — concave-down crescent above the hit, descending as it shuts.
    const uy = fx.y - JAW_R - gape;
    g.lineStyle(3.2, mid, fade * 0.85);
    g.beginPath(); g.arc(fx.x, uy, JAW_R, 0.22 * Math.PI, 0.78 * Math.PI, false); g.strokePath();
    g.lineStyle(1.4, hot, fade);
    g.beginPath(); g.arc(fx.x, uy, JAW_R, 0.3 * Math.PI, 0.7 * Math.PI, false); g.strokePath();

    // Lower fang — concave-up crescent below, rising as it shuts.
    const ly = fx.y + JAW_R + gape;
    g.lineStyle(3.2, mid, fade * 0.85);
    g.beginPath(); g.arc(fx.x, ly, JAW_R, 1.22 * Math.PI, 1.78 * Math.PI, false); g.strokePath();
    g.lineStyle(1.4, hot, fade);
    g.beginPath(); g.arc(fx.x, ly, JAW_R, 1.3 * Math.PI, 1.7 * Math.PI, false); g.strokePath();

    // The chomp flash + a few sparks spitting out (only once the jaws meet).
    if (flare > 0) {
      g.fillStyle(deep, fade * (1 - flare) * 0.45); g.fillCircle(fx.x, fx.y, 5 + flare * 4);
      g.fillStyle(hot, fade * (1 - flare) * 0.9);   g.fillCircle(fx.x, fx.y, 2.5 + flare * 2);
      g.fillStyle(hot, fade * (1 - flare));
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + fx.x;
        const d = flare * 11;
        g.fillCircle(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d * 0.7, 1.2);
      }
    }
  });
}
