import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike } from '../../units/renderUtils';

// Hivespitter — squat living artillery. A fat gourd body planted on stubby
// braced legs, a long spit-TUBE raised at an angle, and a throat-sac that
// visibly INFLATES through the windup and slaps flat on the spit. The bile
// drip at the muzzle never quite stops (greenish digestive fluid, not acid).
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const green = hexToInt(u.primary), dark = hexToInt(u.secondary);
  const s = getStrike(u);
  const waddle = u.state === 'march' ? Math.sin(u.bob * 0.8) : 0;
  const cy = uy + h * 0.6 + Math.abs(waddle) * 0.8; // heavy side-to-side waddle

  // Ground shadow — broad and planted.
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, uy + h * 1.02, w * 0.7, h * 0.14);

  // Stubby braced legs — artillery footing, not runner's legs.
  g.lineStyle(1.6, dark, 1);
  for (let i = -1; i <= 1; i += 2) {
    const lx = cx + i * w * 0.2;
    g.lineBetween(lx, cy + h * 0.18, lx + i * w * 0.1 + waddle * w * 0.03, uy + h);
    g.lineBetween(lx, cy + h * 0.18, lx + i * w * 0.02 - waddle * w * 0.03, uy + h);
  }

  // The gourd body — fat rear, tapering up toward the tube mount.
  shadedBlob(g, cx - f * w * 0.1, cy + h * 0.02, w * 0.62, h * 0.6, green);
  shadedBlob(g, cx + f * w * 0.14, cy - h * 0.14, w * 0.4, h * 0.4, green);

  // THROAT-SAC — inflates with the windup, slaps flat on the spit.
  const sac = 0.16 + s.coil * 0.55 - s.lunge * 0.1;
  g.fillStyle(lerpColor(green, 0xffffff, 0.3), 0.95);
  g.fillEllipse(cx + f * w * 0.1, cy + h * 0.1, w * 0.3 * (1 + sac), h * 0.26 * (1 + sac * 1.4));

  // The spit-TUBE — raised ~30°, recoiling slightly on the lunge.
  const tx = cx + f * w * 0.22, ty = cy - h * 0.2;
  const recoil = s.lunge * w * 0.06;
  const mx = tx + f * (w * 0.34 - recoil), my = ty - h * 0.3;
  g.lineStyle(w * 0.09, dark);
  g.lineBetween(tx, ty, mx, my);
  g.lineStyle(w * 0.05, lerpColor(dark, 0x000000, 0.3));
  g.lineBetween(mx - f * w * 0.04, my + h * 0.04, mx, my);
  // Muzzle drip — a hanging bile bead (always), a glob on the way out (strike).
  g.fillStyle(0xb8e040, 0.9);
  g.fillCircle(mx, my + h * 0.06 + Math.sin(u.bob) * 0.6, w * 0.035);
  if (s.impact > 0.01) {
    g.fillStyle(0xd0f060, 0.9 * s.impact);
    g.fillCircle(mx + f * w * 0.12, my - h * 0.06, w * 0.07 * s.impact + w * 0.02);
  }

  // Small set-back eye — a gunner's squint.
  const ex = cx + f * w * 0.18, ey = cy - h * 0.26;
  g.fillStyle(lerpColor(dark, 0x000000, 0.3)); g.fillCircle(ex, ey, w * 0.05);
  g.fillStyle(0xd8e860); g.fillCircle(ex, ey, w * 0.028);
  g.fillStyle(0xffffff); g.fillCircle(ex - w * 0.01, ey - h * 0.012, w * 0.012);
};

export default draw;
