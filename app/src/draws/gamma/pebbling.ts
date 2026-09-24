import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike } from '../../units/renderUtils';

// Pebbling — γ's brick: a low, round, over-plated crawler that is mostly armoured
// shell on stubby legs — a walking cobblestone. Its domed carapace cracks and
// darkens as it wears down (the degrading-armour read, on the body).
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const shell = hexToInt(u.primary), dark = hexToInt(u.secondary);
  const s = getStrike(u);
  const cy = uy + h * 0.62;
  const wear = 1 - u.hp / u.maxHp; // 0 fresh → 1 cracked

  // Ground shadow.
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, uy + h * 1.02, w * 0.72, h * 0.13);

  // Stubby legs.
  g.lineStyle(1.4, dark, 1);
  for (let i = -1; i <= 1; i++) {
    const lx = cx + i * w * 0.26;
    const sw = Math.sin(u.bob * 1.4 + i) * w * 0.05;
    g.lineBetween(lx, cy + h * 0.16, lx + sw, uy + h);
  }

  // Little head poking out from under the shell brow.
  const hx = cx + f * (w * 0.32 + s.reach * w * 0.18);
  shadedBlob(g, hx, cy + h * 0.1, w * 0.26, h * 0.28, dark);
  g.fillStyle(0xffe070); g.fillCircle(hx + f * w * 0.04, cy + h * 0.05, w * 0.04);

  // THE SHELL — a broad low dome of armour (the silhouette).
  shadedBlob(g, cx - f * w * 0.04, cy - h * 0.06, w * 0.92, h * 0.78, shell);
  // Plate ridges across the dome.
  g.lineStyle(1.4, lerpColor(shell, dark, 0.5), 0.8);
  for (let r = 0; r < 3; r++) {
    const ry = cy - h * (0.18 - r * 0.16);
    g.lineBetween(cx - w * 0.34, ry, cx + w * 0.34, ry);
  }
  // Wear cracks — the degrading armour, made visible as HP drops.
  if (wear > 0.25) {
    g.lineStyle(1, lerpColor(shell, 0x000000, 0.6), 0.5 + 0.4 * wear);
    g.lineBetween(cx - w * 0.1, cy - h * 0.3, cx + w * 0.05, cy + h * 0.05);
    if (wear > 0.6) g.lineBetween(cx + w * 0.12, cy - h * 0.24, cx + w * 0.2, cy + h * 0.1);
  }
  // Top highlight.
  g.fillStyle(lerpColor(shell, 0xffffff, 0.3), 0.4);
  g.fillEllipse(cx - f * w * 0.1, cy - h * 0.28, w * 0.4, h * 0.12);

  // Attack — a stony shove.
  if (s.coil > 0.1) {
    g.fillStyle(lerpColor(shell, 0xffffff, 0.4), 0.25 * s.coil);
    g.fillEllipse(cx + f * w * 0.3, cy, w * 0.3, h * 0.3);
  }
};

export default draw;
