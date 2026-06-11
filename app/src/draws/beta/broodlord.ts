import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike } from '../../units/renderUtils';

// Broodlord — the walking NURSERY. A low, heavy hauler whose whole back is a
// rack of translucent EGG SACS — each with a curled embryo visibly inside,
// jiggling as it walks. Drooping antennae, a tired drag to its gait: it isn't
// a fighter, it's a payload. On Spawn-Wave the sacs flash and gape.
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const green = hexToInt(u.primary), pale = hexToInt(u.secondary);
  const s = getStrike(u);
  const cy = uy + h * 0.58;
  const jig = Math.sin(u.bob * 1.2) * 0.8; // egg jiggle

  // Ground shadow — long (it's a wagon of a creature).
  g.fillStyle(0x000000, 0.24);
  g.fillEllipse(cx, uy + h * 1.03, w * 0.84, h * 0.13);

  // Six short hauler legs — dragging the weight, slight stagger.
  const gait = u.state === 'march' ? u.bob * 0.7 : 0;
  g.lineStyle(w * 0.035, lerpColor(green, 0x000000, 0.35), 1);
  for (let i = 0; i < 3; i++) {
    const lx = cx + f * w * (0.24 - i * 0.22);
    const sw = Math.sin(gait + i * 1.4) * w * 0.05;
    g.lineBetween(lx, cy + h * 0.2, lx - w * 0.06 - sw, uy + h);
    g.lineBetween(lx, cy + h * 0.2, lx + w * 0.06 + sw, uy + h);
  }

  // The low flat body — a barge for the brood.
  shadedBlob(g, cx - f * w * 0.1, cy + h * 0.08, w * 0.78, h * 0.42, green);
  shadedBlob(g, cx + f * w * 0.3, cy + h * 0.04, w * 0.32, h * 0.34, green);

  // THE EGG RACK — translucent sacs mounted along the back, embryos inside.
  // The signature windup (rear) makes them flash: the wave is coming.
  const sacGlow = 0.18 + s.coil * 0.5;
  const sacs: Array<[number, number, number]> = [
    [-0.3, -0.18, 0.15], [-0.1, -0.26, 0.18], [0.12, -0.2, 0.16], [-0.2, -0.04, 0.13],
  ];
  for (const [ox, oy, r] of sacs) {
    const sx = cx + f * w * ox, sy = cy + h * oy - jig * (r * 8);
    // membrane
    g.fillStyle(pale, 0.55);
    g.fillCircle(sx, sy, w * r);
    g.fillStyle(0xffffff, 0.25 + sacGlow * 0.4);
    g.fillCircle(sx - w * r * 0.3, sy - w * r * 0.35, w * r * 0.32);
    // the embryo — a curled comma, twitching with the jiggle
    g.lineStyle(w * 0.028, lerpColor(green, 0x000000, 0.2), 0.9);
    g.lineBetween(sx - w * r * 0.3, sy + jig * 0.4, sx + w * r * 0.1, sy - w * r * 0.3 + jig * 0.4);
    g.lineBetween(sx + w * r * 0.1, sy - w * r * 0.3 + jig * 0.4, sx + w * r * 0.35, sy + w * r * 0.05);
    g.fillStyle(lerpColor(green, 0x000000, 0.3), 0.9);
    g.fillCircle(sx + w * r * 0.32, sy + w * r * 0.08, w * r * 0.18);
  }

  // Drooping antennae — exhausted parenthood.
  const hx = cx + f * w * 0.42, hy = cy - h * 0.04;
  g.lineStyle(1, lerpColor(green, 0x000000, 0.25), 0.95);
  g.lineBetween(hx, hy - h * 0.08, hx + f * w * 0.14, hy + h * 0.06 + jig * 0.4);
  g.lineBetween(hx, hy - h * 0.06, hx + f * w * 0.2, hy + h * 0.14 + jig * 0.4);

  // Small weary head + half-lidded eye.
  shadedBlob(g, hx, hy + h * 0.06, w * 0.2, h * 0.22, green);
  const ex = hx + f * w * 0.04, ey = hy + h * 0.03;
  g.fillStyle(lerpColor(green, 0x000000, 0.45)); g.fillCircle(ex, ey, w * 0.035);
  g.fillStyle(0xd8e860); g.fillCircle(ex, ey + h * 0.008, w * 0.018);
  g.lineStyle(1, lerpColor(green, 0x000000, 0.35));
  g.lineBetween(ex - w * 0.035, ey - h * 0.015, ex + w * 0.035, ey - h * 0.015); // the lid

  // Spawn-wave flash — the whole rack lights as the wave releases.
  if (s.impact > 0.01) {
    g.fillStyle(0xf4ffb0, 0.35 * s.impact);
    g.fillEllipse(cx - f * w * 0.08, cy - h * 0.16, w * 0.8, h * 0.5);
  }
};

export default draw;
