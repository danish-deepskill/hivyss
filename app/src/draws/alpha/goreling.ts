import type { DrawFunction } from '../../types';
import { drawHerd } from './_herd';

// T1 charger — lean, fast, two forward gore-horns in a V.
const draw: DrawFunction = (g, u, cx, uy) => drawHerd(g, u, cx, uy, {
  segments: [
    [-0.10, 0.66, 0.36, 0.34], // abdomen
    [0.10, 0.58, 0.26, 0.22],  // thorax
    [0.30, 0.52, 0.22, 0.20],  // head
  ],
  legPairs: 3,
  legY: 0.62,
  signature: (g, u, hx, hy, f, bone) => {
    g.lineStyle(u.w * 0.045, bone);
    const bx = hx + f * u.w * 0.1;
    g.lineBetween(bx, hy - u.h * 0.04, bx + f * u.w * 0.26, hy - u.h * 0.16); // upper gore
    g.lineBetween(bx, hy + u.h * 0.04, bx + f * u.w * 0.26, hy + u.h * 0.12); // lower gore
  },
});

export default draw;
