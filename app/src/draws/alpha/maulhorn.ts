import type { DrawFunction } from '../../types';
import { drawHerd } from './_herd';

// T2 heavy — bulky body, one massive forward ram-horn.
const draw: DrawFunction = (g, u, cx, uy) => drawHerd(g, u, cx, uy, {
  segments: [
    [-0.06, 0.64, 0.48, 0.44], // bulky abdomen
    [0.16, 0.56, 0.32, 0.28],  // thorax
    [0.34, 0.52, 0.24, 0.22],  // head
  ],
  legPairs: 3,
  legY: 0.62,
  signature: (g, u, hx, hy, f, bone) => {
    // massive ram horn — thick base tapering forward
    g.lineStyle(u.w * 0.1, bone);
    g.lineBetween(hx + f * u.w * 0.06, hy + u.h * 0.02, hx + f * u.w * 0.28, hy - u.h * 0.06);
    g.lineStyle(u.w * 0.05, bone);
    g.lineBetween(hx + f * u.w * 0.28, hy - u.h * 0.06, hx + f * u.w * 0.42, hy - u.h * 0.12);
  },
});

export default draw;
