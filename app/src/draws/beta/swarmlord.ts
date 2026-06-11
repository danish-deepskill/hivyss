import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike, drawImpactSpark } from '../../units/renderUtils';

// Swarmlord — the tyrant that EATS its own tide. A broad armored bulk with a
// wide BALEEN-GRATE maw (built for straining swarm, not biting), long feeler
// tendrils sweeping the ground ahead — herding bodies toward the mouth — and
// attendant fly-dots orbiting it. Bruised-violet crown spikes mark the rank.
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const green = hexToInt(u.primary), bone = hexToInt(u.secondary);
  const violet = u.palette ? u.palette.accent : 0x5a3a72;
  const s = getStrike(u);
  const reach = s.reach * w * 0.26;
  const cy = uy + h * 0.52;

  // Ground shadow — wide and heavy.
  g.fillStyle(0x000000, 0.24);
  g.fillEllipse(cx, uy + h * 1.03, w * 0.8, h * 0.14);

  // Heavy legs — four thick stumps, slow gait.
  const gait = u.state === 'march' ? u.bob * 0.8 : 0;
  g.lineStyle(w * 0.045, lerpColor(green, 0x000000, 0.35), 1);
  for (let i = 0; i < 4; i++) {
    const lx = cx + f * w * (0.26 - i * 0.16);
    const sw = Math.sin(gait + i * 1.2) * w * 0.04;
    g.lineBetween(lx, cy + h * 0.2, lx + sw - f * w * 0.04, uy + h);
  }

  // FEELER TENDRILS — long whips sweeping the ground ahead, herding the
  // swarm toward the maw. They reach further on the Tide windup (gathering).
  const sweep = Math.sin(u.bob * 1.1) * 0.12 + s.coil * 0.3;
  g.lineStyle(1.4, violet, 0.9);
  const fx0 = cx + f * w * 0.36, fy0 = cy - h * 0.06;
  g.lineBetween(fx0, fy0, fx0 + f * w * (0.3 + sweep), fy0 + h * 0.32);
  g.lineBetween(fx0 + f * w * (0.3 + sweep), fy0 + h * 0.32, fx0 + f * w * (0.5 + sweep), fy0 + h * 0.42);
  g.lineBetween(fx0, fy0 + h * 0.08, fx0 + f * w * (0.24 - sweep * 0.5), fy0 + h * 0.44);

  // The bulk — broad segmented carapace, mass forward (it leads with the mouth).
  shadedBlob(g, cx - f * (w * 0.22 - reach * 0.2), cy + h * 0.02, w * 0.5, h * 0.52, green);
  shadedBlob(g, cx + f * (w * 0.02 + reach * 0.6), cy - h * 0.04, w * 0.56, h * 0.6, green);
  shadedBlob(g, cx + f * (w * 0.26 + reach), cy + h * 0.02, w * 0.42, h * 0.5, green);

  // CROWN SPIKES — short bruised-violet rank markers along the back ridge.
  g.lineStyle(w * 0.035, violet);
  for (let i = 0; i < 3; i++) {
    const sxp = cx - f * w * (0.16 - i * 0.14);
    g.lineBetween(sxp, cy - h * 0.3, sxp + f * w * 0.03, cy - h * (0.44 + i * 0.02));
  }

  // The BALEEN MAW — a wide grate of bone slats across the face: it strains
  // the swarm in. Gapes wide on the Tide windup.
  const mx = cx + f * (w * 0.4 + reach);
  const gape = 0.16 + s.coil * 0.3 - s.lunge * 0.1;
  g.fillStyle(lerpColor(green, 0x000000, 0.45));
  g.fillEllipse(mx, cy + h * 0.04, w * 0.18, h * (0.3 + gape * 0.3));
  g.lineStyle(1.2, bone, 0.95);
  for (let i = 0; i < 4; i++) {
    const gy = cy - h * (0.08 - i * 0.08) + h * gape * 0.1;
    g.lineBetween(mx - f * w * 0.07, gy, mx + f * w * 0.07, gy + h * 0.02);
  }

  // Paired eyes — small, set wide above the maw (it watches the herd, not you).
  for (const o of [-0.06, 0.08]) {
    const ex = mx - f * w * 0.02 + f * w * o, ey = cy - h * 0.2;
    g.fillStyle(lerpColor(green, 0x000000, 0.5)); g.fillCircle(ex, ey, w * 0.035);
    g.fillStyle(0xd8e860); g.fillCircle(ex, ey, w * 0.02);
  }

  // Attendant flies — the swarm never leaves its lord. Two dots orbiting.
  for (let i = 0; i < 2; i++) {
    const a = u.bob * 1.3 + i * Math.PI;
    g.fillStyle(lerpColor(green, 0x000000, 0.2), 0.85);
    g.fillCircle(cx + Math.cos(a) * w * 0.5, cy - h * 0.34 + Math.sin(a) * h * 0.16, w * 0.025);
  }

  if (s.impact > 0.01) drawImpactSpark(g, mx + f * w * 0.16, cy + h * 0.04, w, s.impact);
};

export default draw;
