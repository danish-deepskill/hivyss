import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Grub — chubby segmented larva, simple but with character
// Distinct features: round dimpled body segments, hungry mouth, twitchy antennae
const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = 0x14260a;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Soft ground shadow
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, uy + h * 0.96, w * 0.78, h * 0.12);

  // Pulsing slight wiggle on march (vertical sine)
  const wiggle = u.state === 'march' ? Math.sin(u.bob * 4) * 0.015 : 0;

  // 4 plump body segments — each a little ball, smallest at rear
  // Drawn back to front
  const segments = [
    { ox: -0.32, sz: 0.28 }, // tail
    { ox: -0.12, sz: 0.36 }, // mid-rear
    { ox:  0.08, sz: 0.4  }, // mid-front
    { ox:  0.28, sz: 0.36 }, // shoulder
  ];

  segments.forEach((seg, i) => {
    const sx = cx + f * w * seg.ox;
    const sy = uy + h * (0.6 + wiggle * (i + 1));
    const sw = w * seg.sz;
    const sh = h * (seg.sz * 1.1);

    // Deep shadow
    g.fillStyle(deep);
    g.fillEllipse(sx, sy + 1, sw, sh);
    // Mid tone
    g.fillStyle(secondary);
    g.fillEllipse(sx, sy, sw * 0.92, sh * 0.92);
    // Highlight
    g.fillStyle(primary);
    g.fillEllipse(sx, sy - sh * 0.08, sw * 0.78, sh * 0.7);
    // Tiny dimple highlight (shiny grub skin)
    g.fillStyle(0xffffff, 0.25);
    g.fillEllipse(sx + sw * 0.1, sy - sh * 0.18, sw * 0.18, sh * 0.14);
  });

  // Head segment — biggest, with face
  const hx = cx + f * w * 0.4;
  const hy = uy + h * 0.5;
  g.fillStyle(deep);
  g.fillEllipse(hx, hy + 1, w * 0.42, h * 0.52);
  g.fillStyle(secondary);
  g.fillEllipse(hx, hy, w * 0.38, h * 0.46);
  g.fillStyle(primary);
  g.fillEllipse(hx, hy - h * 0.04, w * 0.32, h * 0.36);

  // Hungry round mouth — opens on attack
  if (u.state === 'attack') {
    g.fillStyle(deep);
    g.fillCircle(hx + f * w * 0.14, hy + h * 0.06, w * 0.08);
    g.fillStyle(0x602010);
    g.fillCircle(hx + f * w * 0.14, hy + h * 0.06, w * 0.05);
    // Tiny inner teeth
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(hx + f * w * 0.12, hy + h * 0.04, 0.6);
    g.fillCircle(hx + f * w * 0.16, hy + h * 0.08, 0.6);
  } else {
    // Closed mouth — small line
    g.lineStyle(1, deep);
    g.lineBetween(
      hx + f * w * 0.1, hy + h * 0.06,
      hx + f * w * 0.18, hy + h * 0.06
    );
  }

  // Pair of dot eyes
  g.fillStyle(0x000000);
  g.fillCircle(hx + f * w * 0.08, hy - h * 0.04, 1.3);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(hx + f * w * 0.085, hy - h * 0.05, 0.5);

  // Twitchy short antennae
  const wave = Math.sin(u.bob * 3) * 1.5;
  g.lineStyle(1, deep);
  const ax = hx + f * w * 0.06;
  const ay = hy - h * 0.18;
  g.lineBetween(ax, ay, ax + f * 4 + wave, ay - 5);
  g.lineBetween(ax, ay, ax - f * 1 - wave, ay - 6);

  // Tiny stubby legs (5 pairs along the body)
  g.lineStyle(1, deep);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 5; l++) {
    const lx = cx + (l - 2) * w * 0.16;
    const ly = uy + h * 0.82;
    const sw = Math.sin(lp + l * 0.7) * w * 0.025;
    g.lineBetween(lx, ly, lx + sw, uy + h);
  }
};

export default draw;
