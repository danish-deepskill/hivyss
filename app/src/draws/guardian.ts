import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);

  // Aura ring (behind body)
  const auraPulse = 0.25 + Math.sin(u.bob * 2) * 0.1;
  g.lineStyle(2, 0xd0a020, auraPulse);
  g.strokeCircle(cx, uy + u.h * 0.5, u.w * 0.7);

  // Large body
  g.fillStyle(primary);
  g.fillEllipse(cx - u.facing * 3, uy + u.h * 0.6, u.w * 0.88, u.h * 0.96);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.32, u.w * 0.64, u.h * 0.64);
  g.fillEllipse(cx + u.facing * u.w * 0.32, uy + u.h * 0.18, u.w * 0.5, u.h * 0.48);

  // Shield crest on thorax
  g.fillStyle(secondary, 0.5);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.32, u.w * 0.3, u.h * 0.3);

  // Sturdy legs (3 pairs)
  g.lineStyle(2, secondary);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 3; l++) {
    const lx = cx + (l - 1) * u.w * 0.24;
    const ly = uy + u.h * 0.65;
    const sw = Math.sin(lp + l * 1.1) * 5;
    g.lineBetween(lx, ly, lx + u.facing * 7 + sw, ly + 5);
    g.lineBetween(lx, ly, lx - u.facing * 7 - sw, ly + 5);
    g.lineBetween(lx + u.facing * 7 + sw, ly + 5, lx + u.facing * 8 + sw, ly + 10);
    g.lineBetween(lx - u.facing * 7 - sw, ly + 5, lx - u.facing * 8 - sw, ly + 10);
  }

  // Mandibles
  g.lineStyle(2, secondary);
  const mhx = cx + u.facing * (u.w * 0.42);
  const mhy = uy + u.h * 0.15;
  if (u.state === 'attack') {
    g.lineBetween(mhx, mhy, mhx + u.facing * 6, mhy - 5);
    g.lineBetween(mhx, mhy, mhx + u.facing * 6, mhy + 4);
  } else {
    g.lineBetween(mhx, mhy, mhx + u.facing * 5, mhy - 2);
    g.lineBetween(mhx, mhy, mhx + u.facing * 5, mhy + 2);
  }

  // Antennae
  g.lineStyle(1.5, secondary);
  const ax = cx + u.facing * u.w * 0.28;
  const ay = uy + u.h * 0.08;
  const wave = Math.sin(u.bob) * 2;
  g.lineBetween(ax, ay, ax + u.facing * 7 + wave, ay - 6);
  g.lineBetween(ax, ay, ax + u.facing * 3 - wave, ay - 7);
};

export default draw;
