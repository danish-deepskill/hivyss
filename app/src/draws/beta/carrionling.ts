import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike, drawImpactSpark } from '../../units/renderUtils';

// Carrionling — the vulture-roach. Hunched high over its head like a carrion
// bird, a hooked BEAK-mandible pair, bone speckles stuck to its plates from
// old meals — and it visibly GORGES as it feeds: every death-feed stack
// (resources.feed) swells the belly and brightens the eye. The swarm dies;
// this thing thrives.
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const green = hexToInt(u.primary), bone = hexToInt(u.secondary);
  const darkGreen = lerpColor(green, 0x000000, 0.3); // a darker, meaner shade
  const s = getStrike(u);
  const reach = s.reach * w * 0.3;
  const feed = Math.min(10, u.resources?.feed ?? 0);
  const gorge = feed / 10; // 0..1 — how fat it's eaten itself
  const stalk = u.state === 'march' ? Math.sin(u.bob * 0.9) : 0;
  const cy = uy + h * 0.52;

  // Ground shadow.
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, uy + h * 1.02, w * (0.62 + gorge * 0.12), h * 0.13);

  // Long stalking legs — a slow, deliberate creep (knees above the back).
  g.lineStyle(1.4, darkGreen, 1);
  for (let i = 0; i < 3; i++) {
    const lx = cx + f * w * (0.14 - i * 0.16);
    const kneeY = cy - h * 0.06;
    const sw = Math.sin(stalk * 2 + i * 1.2) * w * 0.07;
    g.lineBetween(lx, cy + h * 0.14, lx + sw * 0.4, kneeY);          // femur up
    g.lineBetween(lx + sw * 0.4, kneeY, lx + sw - f * w * 0.04, uy + h); // shin down
  }

  // Gorged belly — swells with feed stacks (the visible reward).
  shadedBlob(
    g,
    cx - f * (w * 0.16 - reach * 0.2),
    cy + h * (0.16 - gorge * 0.05),
    w * (0.46 + gorge * 0.2),
    h * (0.42 + gorge * 0.18),
    darkGreen,
  );

  // The HUNCH — a high arched carapace over the lowered head.
  shadedBlob(g, cx + f * (w * 0.04 + reach * 0.5), cy - h * 0.18, w * 0.5, h * 0.42, darkGreen);
  // Bone speckles — old meals stuck to the plates.
  g.fillStyle(bone, 0.85);
  g.fillCircle(cx - f * w * 0.08, cy - h * 0.3, w * 0.03);
  g.fillCircle(cx + f * w * 0.1, cy - h * 0.24, w * 0.022);
  g.fillCircle(cx - f * w * 0.18, cy - h * 0.1, w * 0.026);

  // Lowered head — slung under the hunch, beak first.
  const hx = cx + f * (w * 0.3 + reach);
  const hy = cy + h * 0.06 + s.coil * h * 0.04;
  shadedBlob(g, hx, hy, w * 0.26, h * 0.26, darkGreen);

  // The carrion BEAK — a hooked bone pair that gapes on the windup and
  // tears down on the strike.
  const gape = 0.1 + s.coil * 0.22 - s.lunge * 0.12;
  g.lineStyle(w * 0.045, bone);
  g.lineBetween(hx + f * w * 0.08, hy - h * 0.02, hx + f * w * 0.26, hy + h * (0.06 - gape)); // upper hook
  g.lineBetween(hx + f * w * 0.24, hy + h * (0.06 - gape), hx + f * w * 0.2, hy + h * (0.12 - gape)); // the hook turn
  g.lineStyle(w * 0.035, bone);
  g.lineBetween(hx + f * w * 0.08, hy + h * 0.05, hx + f * w * 0.22, hy + h * (0.1 + gape)); // lower jaw

  // Eye — red-rimmed, brightening as it gorges.
  const ex = hx + f * w * 0.04, ey = hy - h * 0.06;
  g.fillStyle(lerpColor(darkGreen, 0x000000, 0.4)); g.fillCircle(ex, ey, w * 0.055);
  g.fillStyle(lerpColor(0xc04020, 0xff6030, gorge)); g.fillCircle(ex, ey, w * 0.032);
  g.fillStyle(0xffffff); g.fillCircle(ex - w * 0.012, ey - h * 0.012, w * 0.012);

  if (s.impact > 0.01) drawImpactSpark(g, hx + f * w * 0.28, hy + h * 0.04, w, s.impact);
};

export default draw;
