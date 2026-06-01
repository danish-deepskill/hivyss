import type { DrawFunction } from '../../types';
import { drawHerd } from './_herd';

// α ROYAL — the herd Matriarch: a vast 5-segment body with a heavy egg-laden
// abdomen, five leg-pairs, and a towering regal horn-crown with a back-crest.
// Grander than the Goliath Elite in every dimension — the queen the herd forms
// up around.
const draw: DrawFunction = (g, u, cx, uy) => drawHerd(g, u, cx, uy, {
  segments: [
    [-0.14, 0.80, 0.64, 0.58], // vast egg-laden abdomen
    [0.04, 0.62, 0.46, 0.42],  // lower thorax
    [0.20, 0.52, 0.36, 0.34],  // thorax
    [0.34, 0.46, 0.30, 0.28],  // upper thorax
    [0.48, 0.42, 0.26, 0.26],  // head
  ],
  legPairs: 5,
  legY: 0.70,
  glow: 0xffd860, // brighter, regal bioluminescence
  signature: (g, u, hx, hy, f, bone) => {
    // towering central crown-horn
    g.lineStyle(u.w * 0.07, bone);
    g.lineBetween(hx + f * u.w * 0.06, hy, hx + f * u.w * 0.30, hy - u.h * 0.30);
    // flanking crown horns (a regal fan)
    g.lineStyle(u.w * 0.045, bone);
    g.lineBetween(hx - f * u.w * 0.02, hy - u.h * 0.10, hx + f * u.w * 0.12, hy - u.h * 0.40);
    g.lineBetween(hx + f * u.w * 0.02, hy - u.h * 0.06, hx + f * u.w * 0.20, hy - u.h * 0.34);
    g.lineBetween(hx + f * u.w * 0.04, hy + u.h * 0.04, hx + f * u.w * 0.24, hy - u.h * 0.08);
    // regal crest ridge down the back
    g.lineStyle(u.w * 0.03, bone);
    for (let i = 0; i < 4; i++) {
      const ox = hx - f * u.w * (0.10 + i * 0.13);
      g.lineBetween(ox, hy - u.h * 0.12, ox - f * u.w * 0.03, hy - u.h * (0.30 + i * 0.025));
    }
  },
});

export default draw;
