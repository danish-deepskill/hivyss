import type { DrawFunction } from '../../types';
import { drawHerd } from './_herd';

// T0 fodder — tiny round grub-beetle, a single nub horn.
const draw: DrawFunction = (g, u, cx, uy) => drawHerd(g, u, cx, uy, {
  segments: [
    [-0.04, 0.66, 0.46, 0.50], // round abdomen
    [0.26, 0.55, 0.26, 0.26],  // small head
  ],
  legPairs: 2,
  legY: 0.66,
  signature: (g, u, hx, hy, f, bone) => {
    g.lineStyle(u.w * 0.05, bone);
    g.lineBetween(hx + f * u.w * 0.08, hy - u.h * 0.02, hx + f * u.w * 0.2, hy - u.h * 0.1);
  },
});

export default draw;
