import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike } from '../../units/renderUtils';

// Burster — a sprinting BOMB. Tiny head and racing legs dragging one enormous
// swollen abdomen, skin stretched taut and translucent over a volatile core
// that glows brighter and pulses faster as it runs. Everything about it says
// "keep away" — which is exactly what it wants you to fail at.
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const green = hexToInt(u.primary), dark = hexToInt(u.secondary);
  const s = getStrike(u);
  const sprint = u.state === 'march' ? u.bob * 1.6 : u.bob * 0.5;
  const cy = uy + h * 0.55;

  // Ground shadow — heavy at the rear where the payload hangs.
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx - f * w * 0.08, uy + h * 1.02, w * 0.66, h * 0.13);

  // Racing legs — long strides for its size (it RUNS at you).
  g.lineStyle(1.2, dark, 1);
  for (let i = -1; i <= 1; i++) {
    const lx = cx + f * w * (0.16 + i * 0.1);
    const sw = Math.sin(sprint + i * 1.3) * w * 0.12;
    g.lineBetween(lx, cy + h * 0.12, lx + sw, uy + h);
  }

  // THE PAYLOAD — a huge taut abdomen, translucent over a glowing core.
  const throb = 0.5 + 0.5 * Math.abs(Math.sin(u.bob * 2.4)); // fast, anxious pulse
  const ax = cx - f * w * 0.12, ay = cy - h * 0.04;
  shadedBlob(g, ax, ay, w * 0.72, h * 0.78, green);
  // Inner core glow — the charge, seen through stretched skin.
  g.fillStyle(0xd8f050, 0.25 + 0.3 * throb);
  g.fillCircle(ax, ay + h * 0.02, w * 0.26);
  g.fillStyle(0xf4ff90, 0.5 + 0.4 * throb);
  g.fillCircle(ax, ay + h * 0.02, w * 0.13);
  // Taut-skin stress highlights — thin stretch lines over the swell.
  g.lineStyle(0.8, lerpColor(green, 0xffffff, 0.45), 0.5);
  g.lineBetween(ax - w * 0.2, ay - h * 0.26, ax + w * 0.16, ay - h * 0.32);
  g.lineBetween(ax - w * 0.26, ay - h * 0.04, ax - w * 0.3, ay + h * 0.18);

  // Tiny head — barely there, tucked in front of the payload.
  const hx = cx + f * (w * 0.3 + s.reach * w * 0.2);
  shadedBlob(g, hx, cy + h * 0.06, w * 0.24, h * 0.26, green);
  g.fillStyle(0xffe070); g.fillCircle(hx + f * w * 0.05, cy + h * 0.02, w * 0.035);
  g.fillStyle(0xffffff); g.fillCircle(hx + f * w * 0.04, cy, w * 0.014);

  // No real attack read — the strike is a desperate headbutt; the body is
  // the weapon. A faint warning flicker when it's coiling.
  if (s.coil > 0.1) {
    g.fillStyle(0xf4ff90, 0.2 * s.coil);
    g.fillCircle(ax, ay, w * 0.4);
  }
};

export default draw;
