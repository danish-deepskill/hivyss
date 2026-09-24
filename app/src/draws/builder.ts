import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Builder — the construction worker (caste 'worker', non-combatant). A plain
// worker silhouette hauling a stone build-block on its back + a raised mandible
// "tool". Killing it stalls whatever it was building. White-bodied like all
// normals; the brown block + tool read as "construction".
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const primary = hexToInt(u.primary);
  const dark = hexToInt(u.secondary);
  const bob = Math.sin(u.bob * 1.4) * 0.7;
  const cy = uy + h / 2 + bob;

  // Ground shadow.
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx, uy + h * 1.02, w * 0.6, h * 0.13);

  // Legs (3 pairs).
  g.lineStyle(1.3, dark, 1);
  for (let i = -1; i <= 1; i++) {
    const lx = cx + i * w * 0.16;
    g.lineBetween(lx, cy + h * 0.08, lx - f * w * 0.18, cy + h * 0.46);
    g.lineBetween(lx, cy + h * 0.08, lx + f * w * 0.14, cy + h * 0.46);
  }

  // Body — abdomen · thorax · head.
  g.fillStyle(dark, 1);
  g.fillEllipse(cx - f * w * 0.24, cy, w * 0.4, h * 0.5);
  g.fillStyle(primary, 1);
  g.fillEllipse(cx + f * w * 0.04, cy - h * 0.02, w * 0.34, h * 0.46);
  g.fillStyle(dark, 1);
  g.fillEllipse(cx + f * w * 0.3, cy - h * 0.04, w * 0.26, h * 0.36);

  // Carried build-block on the back (a stone/chitin slab).
  g.fillStyle(0x8a7a52, 1);
  g.fillRect(cx - f * w * 0.46, cy - h * 0.52, w * 0.38, h * 0.24);
  g.lineStyle(1, 0x4a3d24, 0.85);
  g.strokeRect(cx - f * w * 0.46, cy - h * 0.52, w * 0.38, h * 0.24);

  // Raised mandible "tool".
  g.lineStyle(1.6, primary, 1);
  const hx = cx + f * w * 0.4, hy = cy - h * 0.1;
  g.lineBetween(hx, hy, hx + f * w * 0.3, hy - h * 0.42);

  // Eye glint.
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(cx + f * w * 0.34, cy - h * 0.06, w * 0.05);
};

export default draw;
