import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);

  // Armored body (shield shape)
  g.fillStyle(primary);
  g.fillEllipse(cx - u.facing * 2, uy + u.h * 0.62, u.w * 0.8, u.h * 0.88);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.34, u.w * 0.6, u.h * 0.58);
  g.fillEllipse(cx + u.facing * u.w * 0.28, uy + u.h * 0.18, u.w * 0.46, u.h * 0.4);

  // Shell ridge
  g.lineStyle(1.5, secondary, 0.4);
  g.lineBetween(cx - u.facing * 2, uy + u.h * 0.25, cx - u.facing * 2, uy + u.h * 0.95);

  // Shield plate on front
  g.fillStyle(secondary, 0.8);
  g.fillEllipse(cx + u.facing * u.w * 0.45, uy + u.h * 0.45, u.w * 0.2, u.h * 0.55);
  g.lineStyle(1.5, 0xffffff, 0.3);
  g.strokeEllipse(cx + u.facing * u.w * 0.45, uy + u.h * 0.45, u.w * 0.2, u.h * 0.55);

  // Poison drips from mandibles
  g.fillStyle(0x80ff40, 0.7);
  g.fillCircle(cx + u.facing * u.w * 0.42, uy + u.h * 0.22, 2);
  g.fillCircle(cx + u.facing * u.w * 0.38, uy + u.h * 0.32, 1.5);

  // Poison sac on abdomen
  g.fillStyle(0xa0ff60, 0.4);
  g.fillEllipse(cx - u.facing * 4, uy + u.h * 0.55, u.w * 0.25, u.h * 0.3);

  // Thick armored legs (3 pairs)
  g.lineStyle(2, secondary);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 3; l++) {
    const lx = cx + (l - 1) * u.w * 0.22;
    const ly = uy + u.h * 0.65;
    const sw = Math.sin(lp + l * 1.1) * 5;
    g.lineBetween(lx, ly, lx + u.facing * 7 + sw, ly + 5);
    g.lineBetween(lx, ly, lx - u.facing * 7 - sw, ly + 5);
    g.lineBetween(lx + u.facing * 7 + sw, ly + 5, lx + u.facing * 8 + sw, ly + 9);
    g.lineBetween(lx - u.facing * 7 - sw, ly + 5, lx - u.facing * 8 - sw, ly + 9);
  }

  // Heavy mandibles with poison
  g.lineStyle(2, secondary);
  const mhx = cx + u.facing * (u.w * 0.42);
  const mhy = uy + u.h * 0.15;
  if (u.state === 'attack') {
    g.lineBetween(mhx, mhy, mhx + u.facing * 7, mhy - 5);
    g.lineBetween(mhx, mhy, mhx + u.facing * 7, mhy + 4);
  } else {
    g.lineBetween(mhx, mhy, mhx + u.facing * 5, mhy - 2);
    g.lineBetween(mhx, mhy, mhx + u.facing * 5, mhy + 2);
  }

  // Antennae
  g.lineStyle(1.5, secondary);
  const ax = cx + u.facing * u.w * 0.28;
  const ay = uy + u.h * 0.08;
  const wave = Math.sin(u.bob) * 2;
  g.lineBetween(ax, ay, ax + u.facing * 7 + wave, ay - 5);
  g.lineBetween(ax, ay, ax + u.facing * 3 - wave, ay - 6);
};

export default draw;
