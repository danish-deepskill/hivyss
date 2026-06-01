import type { DrawFunction } from '../../types';
import { drawHerd } from './_herd';

// α RANGED — the Quillback: a hunched spitter-beetle. A low ridge of backward
// quills along its shell + a forward spine-snout (the "barrel" it spits from).
// α's only ranged unit → its anti-air picket (land route + ranged reach can
// hit the air lane). Smaller, fragile, no horns (unlike the melee bruisers).
const draw: DrawFunction = (g, u, cx, uy) => drawHerd(g, u, cx, uy, {
  segments: [
    [-0.04, 0.56, 0.46, 0.40], // abdomen (shell)
    [0.16, 0.46, 0.32, 0.30],  // thorax
    [0.36, 0.40, 0.26, 0.24],  // head
  ],
  legPairs: 3,
  legY: 0.60,
  glow: 0x86c85a, // greenish — venom/spit hue, distinct from the warm bruisers
  signature: (g, u, hx, hy, f, bone) => {
    // backward quill-ridge along the shell (the namesake)
    g.lineStyle(u.w * 0.028, bone);
    for (let i = 0; i < 6; i++) {
      const ox = hx - f * u.w * (0.10 + i * 0.1);
      g.lineBetween(ox, hy - u.h * 0.1, ox - f * u.w * 0.05, hy - u.h * (0.32 + (i % 2) * 0.05));
    }
    // forward spine-snout — the spitter barrel
    g.lineStyle(u.w * 0.05, bone);
    g.lineBetween(hx + f * u.w * 0.04, hy + u.h * 0.03, hx + f * u.w * 0.24, hy + u.h * 0.0);
  },
});

export default draw;
