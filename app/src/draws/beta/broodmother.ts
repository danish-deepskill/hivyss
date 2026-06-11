import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike } from '../../units/renderUtils';

// Broodmother — β's ROYAL: the birthing queen. Nothing like α's Matriarch —
// her mass is one vast PALE translucent brood-sac dragging behind her, with
// embryo Swarmlings visibly curled and WRIGGLING inside. The fore-body is a
// small dark crowned thing — a bone collar-FRILL flared behind the head (the
// royal marker), egg-slick dripping from the sac's vent. Sickly majesty: the
// tide pours out of her and never stops.
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const green = hexToInt(u.primary), pale = hexToInt(u.secondary);
  const violet = u.palette ? u.palette.accent : 0x5a3a72;
  const s = getStrike(u);
  const cy = uy + h * 0.55;
  const breathe = Math.sin(u.bob * 0.7); // slow royal breathing

  // Ground shadow — vast, dragged behind.
  g.fillStyle(0x000000, 0.24);
  g.fillEllipse(cx - f * w * 0.08, uy + h * 1.03, w * 0.92, h * 0.15);

  // Walking legs under the fore-body only — the sac DRAGS.
  const gait = u.state === 'march' ? u.bob * 0.6 : 0;
  g.lineStyle(w * 0.032, lerpColor(green, 0x000000, 0.3), 1);
  for (let i = 0; i < 3; i++) {
    const lx = cx + f * w * (0.3 - i * 0.12);
    const sw = Math.sin(gait + i * 1.1) * w * 0.04;
    g.lineBetween(lx, cy + h * 0.16, lx - w * 0.05 - sw, uy + h);
    g.lineBetween(lx, cy + h * 0.16, lx + w * 0.05 + sw, uy + h);
  }

  // === THE BROOD-SAC — a vast translucent womb dragging low behind her,
  // swelling with the breath; the brood is visible inside.
  const sx = cx - f * w * 0.2, sy = cy + h * 0.1;
  const swell = 1 + breathe * 0.04 + s.coil * 0.08; // the surge gathers in the sac
  shadedBlob(g, sx - f * w * 0.34, sy + h * 0.06, w * 0.3, h * 0.4, pale); // dragging tip
  shadedBlob(g, sx, sy, w * 0.74 * swell, h * 0.66 * swell, pale);
  // Membrane sheen.
  g.fillStyle(0xffffff, 0.18 + 0.06 * breathe);
  g.fillEllipse(sx - w * 0.1, sy - h * 0.2, w * 0.3, h * 0.16);

  // EMBRYO SWARMLINGS — curled silhouettes inside, each wriggling on its own
  // phase. The queen is full of the next wave.
  const embryos: Array<[number, number, number, number]> = [
    [-0.34, 0.04, 0.085, 0], [-0.12, -0.1, 0.1, 2.1], [-0.04, 0.16, 0.09, 4.2], [-0.26, -0.16, 0.07, 1.3],
  ];
  g.lineStyle(w * 0.025, lerpColor(green, 0x000000, 0.15), 0.7);
  for (const [ox, oy, r, ph] of embryos) {
    const wx = sx + f * w * ox + Math.sin(u.bob * 1.4 + ph) * w * 0.012;
    const wy = sy + h * oy + Math.cos(u.bob * 1.1 + ph) * h * 0.012;
    // a curled comma: body arc + head dot
    g.lineBetween(wx - w * r * 0.7, wy + w * r * 0.3, wx, wy - w * r * 0.5);
    g.lineBetween(wx, wy - w * r * 0.5, wx + w * r * 0.6, wy + w * r * 0.1);
    g.fillStyle(lerpColor(green, 0x000000, 0.25), 0.75);
    g.fillCircle(wx + w * r * 0.55, wy + w * r * 0.15, w * r * 0.32);
  }

  // Birth-vent at the sac's rear — egg-slick drip (she is never not birthing).
  const vx = sx - f * w * 0.46, vy = sy + h * 0.2;
  g.fillStyle(lerpColor(pale, 0x000000, 0.2), 0.9);
  g.fillEllipse(vx, vy, w * 0.08, h * 0.1);
  g.fillStyle(0xd8e860, 0.7);
  g.fillCircle(vx, vy + h * (0.14 + 0.04 * Math.abs(breathe)), w * 0.025);

  // === The fore-body — small, dark, regal: she rises out of her own womb.
  shadedBlob(g, cx + f * w * 0.22, cy - h * 0.1, w * 0.3, h * 0.34, green);
  const hx = cx + f * (w * 0.36 + s.reach * w * 0.15);
  const hy = cy - h * 0.22 + s.coil * h * 0.04;
  shadedBlob(g, hx, hy, w * 0.18, h * 0.2, green);

  // The COLLAR-FRILL — a flared bone ruff behind the head (β's royal marker;
  // a frill, not α's coronet). Violet-edged.
  g.lineStyle(w * 0.035, lerpColor(pale, 0x000000, 0.15));
  for (let i = -1; i <= 1; i++) {
    const a = i * 0.5;
    g.lineBetween(
      hx - f * w * 0.08, hy + h * 0.02,
      hx - f * w * (0.2 + Math.abs(i) * 0.02), hy - h * (0.16 - a * 0.16),
    );
  }
  g.lineStyle(w * 0.02, violet, 0.9);
  g.lineBetween(hx - f * w * 0.2, hy - h * 0.16, hx - f * w * 0.22, hy + h * 0.14);

  // Eyes — two small royal points, watching over the sac.
  for (const o of [0.0, 0.07]) {
    const ex = hx + f * w * o, ey = hy - h * 0.03;
    g.fillStyle(lerpColor(green, 0x000000, 0.5)); g.fillCircle(ex, ey, w * 0.026);
    g.fillStyle(0xe8f070); g.fillCircle(ex, ey, w * 0.014);
  }

  // Brood Surge — at the release, the whole sac flashes and clenches.
  if (s.impact > 0.01) {
    g.fillStyle(0xf4ffb0, 0.4 * s.impact);
    g.fillEllipse(sx, sy, w * 0.8, h * 0.6);
  }
};

export default draw;
