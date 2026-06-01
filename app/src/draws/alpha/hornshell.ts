import type { DrawFunction } from '../../types';
import { drawHerd } from './_herd';

// T1 tank — wide domed carapace, short stout horn, low stance.
const draw: DrawFunction = (g, u, cx, uy) => drawHerd(g, u, cx, uy, {
  segments: [
    [-0.02, 0.62, 0.64, 0.52], // big domed carapace
    [0.32, 0.56, 0.26, 0.24],  // head
  ],
  legPairs: 3,
  legY: 0.64,
  signature: (g, u, hx, hy, f, bone) => {
    // short stout horn
    g.lineStyle(u.w * 0.07, bone);
    g.lineBetween(hx + f * u.w * 0.08, hy, hx + f * u.w * 0.18, hy - u.h * 0.08);
    // carapace seam on the dome
    g.lineStyle(u.w * 0.03, bone);
    g.strokeEllipse(hx - f * u.w * 0.46, hy + u.h * 0.04, u.w * 0.5, u.h * 0.36);
  },
});

export default draw;
