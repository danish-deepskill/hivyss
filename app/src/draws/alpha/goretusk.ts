import type { DrawFunction } from '../../types';
import { drawHerd } from './_herd';

// T3 momentum — sleek, two long curved tusks sweeping forward.
const draw: DrawFunction = (g, u, cx, uy) => drawHerd(g, u, cx, uy, {
  segments: [
    [-0.10, 0.62, 0.40, 0.30], // sleek abdomen
    [0.12, 0.56, 0.26, 0.22],  // thorax
    [0.32, 0.52, 0.24, 0.20],  // head
  ],
  legPairs: 3,
  legY: 0.62,
  glow: 0xff7028, // subtle ember
  signature: (g, u, hx, hy, f, bone) => {
    g.lineStyle(u.w * 0.05, bone);
    const bx = hx + f * u.w * 0.08;
    // lower tusk (long curve, 2 segments)
    g.lineBetween(bx, hy + u.h * 0.06, bx + f * u.w * 0.22, hy + u.h * 0.02);
    g.lineBetween(bx + f * u.w * 0.22, hy + u.h * 0.02, bx + f * u.w * 0.34, hy - u.h * 0.08);
    // upper tusk
    g.lineBetween(bx, hy - u.h * 0.02, bx + f * u.w * 0.2, hy - u.h * 0.06);
    g.lineBetween(bx + f * u.w * 0.2, hy - u.h * 0.06, bx + f * u.w * 0.3, hy - u.h * 0.16);
  },
});

export default draw;
