import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike, drawImpactSpark } from '../../units/renderUtils';

// Swarmling — a PARTICLE of the swarm: the smallest body on any field. An
// oversized head on a tiny teardrop rear (baby-schema — it's a hatchling), a
// frantic leg-blur scuttle, one big hungry eye. One alone reads as vermin;
// ten read as a moving texture — which is the unit.
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const primary = hexToInt(u.primary), dark = hexToInt(u.secondary);
  const s = getStrike(u);
  const reach = s.reach * w * 0.3;
  const skitter = u.state === 'march' ? Math.sin(u.bob * 2.2) : 0; // frantic jitter
  const cy = uy + h * 0.55 + skitter * 0.6;

  // Ground shadow — a fleck.
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(cx, uy + h * 1.02, w * 0.55, h * 0.12);

  // Leg blur — too fast to read as legs: short scuttle strokes.
  g.lineStyle(1, lerpColor(primary, 0x000000, 0.35), 0.9);
  for (let i = -1; i <= 1; i++) {
    const lx = cx + i * w * 0.18 + skitter * w * 0.04;
    g.lineBetween(lx, cy + h * 0.2, lx - f * w * 0.1 - skitter, uy + h);
    g.lineBetween(lx, cy + h * 0.2, lx + f * w * 0.08 + skitter, uy + h);
  }

  // Tiny teardrop rear.
  shadedBlob(g, cx - f * w * 0.22 + f * reach * 0.3, cy + h * 0.06, w * 0.36, h * 0.4, primary);
  // Oversized head — most of the body (a hatchling is mostly mouth).
  shadedBlob(g, cx + f * (w * 0.12 + reach), cy - h * 0.02, w * 0.52, h * 0.55, primary);

  // One big hungry eye.
  const ex = cx + f * (w * 0.2 + reach), ey = cy - h * 0.08;
  g.fillStyle(lerpColor(dark, 0x000000, 0.3)); g.fillCircle(ex, ey, w * 0.1);
  g.fillStyle(0xd8e860); g.fillCircle(ex, ey, w * 0.06);
  g.fillStyle(0xffffff); g.fillCircle(ex - w * 0.02, ey - h * 0.03, w * 0.022);

  // Needle mandibles — gape on windup, snap shut on the bite.
  const jaw = 0.12 + s.coil * 0.2 - s.lunge * 0.1;
  g.lineStyle(1, dark);
  g.lineBetween(ex + f * w * 0.1, ey + h * 0.1, ex + f * w * 0.26, ey + h * (0.1 - jaw));
  g.lineBetween(ex + f * w * 0.1, ey + h * 0.16, ex + f * w * 0.26, ey + h * (0.16 + jaw));

  if (s.impact > 0.01) drawImpactSpark(g, ex + f * w * 0.28, ey + h * 0.1, w, s.impact);
};

export default draw;
