import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike } from '../../units/renderUtils';

// Burrower — γ's planted wall: a broad digger half-sunk into a mound of its own
// upthrown earth, anchored by two great shovel-mandibles. It barely moves; it is
// a position more than a creature.
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const shell = hexToInt(u.primary), dark = hexToInt(u.secondary);
  const s = getStrike(u);
  const cy = uy + h * 0.5;
  const moundY = uy + h * 0.82;

  // Ground shadow (wide — broad and low).
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx, uy + h * 1.03, w * 0.86, h * 0.12);

  // Upthrown earth mound around its base (it is dug in).
  g.fillStyle(lerpColor(dark, 0x3a2a14, 0.5), 1);
  g.fillEllipse(cx, moundY + h * 0.06, w * 0.96, h * 0.3);
  g.fillStyle(lerpColor(dark, 0x4a3820, 0.5), 1);
  g.fillEllipse(cx, moundY, w * 0.8, h * 0.2);

  // Broad armoured back, hunkered low.
  shadedBlob(g, cx - f * w * 0.08, cy + h * 0.02, w * 0.84, h * 0.72, shell);
  // Segment ridges.
  g.lineStyle(1.4, lerpColor(shell, dark, 0.55), 0.8);
  for (let i = -1; i <= 1; i++) {
    g.lineBetween(cx + i * w * 0.22 - w * 0.04, cy - h * 0.26, cx + i * w * 0.22 + w * 0.04, cy + h * 0.2);
  }

  // THE SHOVEL-MANDIBLES — two great digging blades at the front.
  const dig = s.reach * w * 0.22 + Math.sin(u.bob * 1.2) * w * 0.03;
  const mx = cx + f * (w * 0.42 + dig);
  g.fillStyle(dark, 1);
  g.fillTriangle(mx, cy - h * 0.14, mx + f * w * 0.34, cy - h * 0.02, mx, cy + h * 0.04);
  g.fillTriangle(mx, cy + h * 0.06, mx + f * w * 0.34, cy + h * 0.14, mx, cy + h * 0.22);
  // Blade highlight.
  g.lineStyle(1, lerpColor(dark, 0xffffff, 0.4), 0.5);
  g.lineBetween(mx + f * w * 0.04, cy - h * 0.08, mx + f * w * 0.3, cy);

  // Low eyes between the blades.
  g.fillStyle(0xffe070); g.fillCircle(cx + f * w * 0.3, cy - h * 0.04, w * 0.03);

  // Attack — the shovels grind inward.
  if (s.coil > 0.1) {
    g.fillStyle(lerpColor(dark, 0x000000, 0.3), 0.3 * s.coil);
    g.fillEllipse(mx + f * w * 0.2, cy + h * 0.04, w * 0.2, h * 0.18);
  }
};

export default draw;
