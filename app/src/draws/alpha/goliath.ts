import type { DrawFunction } from '../../types';
import { drawHerd } from './_herd';

// T4 Elite — the apex herd-anchor: large, 4 segments, a crown of horns,
// glowing joints, commanding upright stance.
const draw: DrawFunction = (g, u, cx, uy) => drawHerd(g, u, cx, uy, {
  segments: [
    [-0.06, 0.66, 0.52, 0.46], // massive abdomen
    [0.12, 0.54, 0.38, 0.34],  // thorax
    [0.28, 0.44, 0.30, 0.28],  // upper thorax
    [0.44, 0.40, 0.24, 0.24],  // head
  ],
  legPairs: 4,
  legY: 0.64,
  glow: 0xffc040, // dominant bioluminescent joints
  signature: (g, u, hx, hy, f, bone) => {
    // central great horn
    g.lineStyle(u.w * 0.06, bone);
    g.lineBetween(hx + f * u.w * 0.08, hy, hx + f * u.w * 0.3, hy - u.h * 0.16);
    // two flanking horns
    g.lineStyle(u.w * 0.045, bone);
    g.lineBetween(hx + f * u.w * 0.02, hy - u.h * 0.06, hx + f * u.w * 0.16, hy - u.h * 0.26);
    g.lineBetween(hx + f * u.w * 0.06, hy + u.h * 0.06, hx + f * u.w * 0.22, hy + u.h * 0.0);
    // crown ridge behind the head
    g.lineStyle(u.w * 0.035, bone);
    for (let i = 0; i < 3; i++) {
      const ox = hx - f * u.w * (i * 0.12);
      g.lineBetween(ox, hy - u.h * 0.14, ox - f * u.w * 0.03, hy - u.h * (0.30 + i * 0.03));
    }
  },
});

export default draw;
