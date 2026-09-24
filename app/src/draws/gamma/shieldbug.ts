import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike } from '../../units/renderUtils';

// Shieldbug — γ's mobile wall: a squat body almost entirely hidden behind one
// enormous frontal shield-plate it carries into the line. The plate cracks and
// pales as it soaks the push (the degrading armour, worn on the body).
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const shell = hexToInt(u.primary), dark = hexToInt(u.secondary);
  const s = getStrike(u);
  const cy = uy + h * 0.56;
  const wear = 1 - u.hp / u.maxHp;

  // Ground shadow.
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx - f * w * 0.1, uy + h * 1.02, w * 0.7, h * 0.12);

  // Braced legs, leaning into the shield.
  g.lineStyle(1.6, dark, 1);
  for (let i = -1; i <= 1; i++) {
    const lx = cx - f * w * 0.1 + i * w * 0.16;
    g.lineBetween(lx, cy + h * 0.16, lx - f * w * 0.08, uy + h);
  }

  // Body — tucked behind the plate.
  shadedBlob(g, cx - f * w * 0.18, cy, w * 0.56, h * 0.66, dark);
  // Small head peeking over the rim.
  shadedBlob(g, cx + f * w * 0.02, cy - h * 0.18, w * 0.24, h * 0.24, shell);
  g.fillStyle(0xffe070); g.fillCircle(cx + f * w * 0.06, cy - h * 0.2, w * 0.03);

  // THE SHIELD — a huge rounded plate held forward (the silhouette).
  const bash = s.reach * w * 0.22;
  const px = cx + f * (w * 0.24 + bash);
  shadedBlob(g, px, cy + h * 0.02, w * 0.42, h * 0.96, shell);
  // Central boss + rim.
  g.lineStyle(2, lerpColor(shell, dark, 0.5), 0.9);
  g.strokeEllipse(px, cy + h * 0.02, w * 0.34, h * 0.86);
  g.fillStyle(lerpColor(shell, dark, 0.4), 1);
  g.fillCircle(px + f * w * 0.04, cy + h * 0.02, w * 0.08);
  // Wear cracks across the plate.
  if (wear > 0.25) {
    g.lineStyle(1, lerpColor(shell, 0x000000, 0.6), 0.5 + 0.4 * wear);
    g.lineBetween(px - f * w * 0.06, cy - h * 0.3, px + f * w * 0.1, cy + h * 0.1);
    if (wear > 0.6) g.lineBetween(px + f * w * 0.02, cy - h * 0.1, px - f * w * 0.08, cy + h * 0.34);
  }
  // Plate highlight.
  g.fillStyle(lerpColor(shell, 0xffffff, 0.3), 0.35);
  g.fillEllipse(px - f * w * 0.06, cy - h * 0.22, w * 0.14, h * 0.3);

  // Attack — the shield slams forward.
  if (s.coil > 0.1) {
    g.fillStyle(lerpColor(shell, 0xffffff, 0.4), 0.25 * s.coil);
    g.fillEllipse(px + f * w * 0.2, cy, w * 0.2, h * 0.5);
  }
};

export default draw;
