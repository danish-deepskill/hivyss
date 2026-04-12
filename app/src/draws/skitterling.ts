import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Skitterling — tiny fast scuttling bug, low silhouette, many flailing legs
const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = 0x102818;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Speed dust trail (behind, only when marching)
  if (u.state === 'march') {
    const trail = 0.25 + Math.sin(u.bob * 6) * 0.1;
    g.fillStyle(0xa0e0c0, trail * 0.5);
    g.fillCircle(cx - f * w * 0.6, uy + h * 0.85, w * 0.1);
    g.fillCircle(cx - f * w * 0.5, uy + h * 0.9, w * 0.07);
    g.fillCircle(cx - f * w * 0.4, uy + h * 0.92, w * 0.05);
  }

  // Tiny low-slung body — three small segments
  // Rear segment
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.22, uy + h * 0.65, w * 0.32, h * 0.42);
  g.fillStyle(secondary);
  g.fillEllipse(cx - f * w * 0.22, uy + h * 0.63, w * 0.28, h * 0.36);
  g.fillStyle(primary);
  g.fillEllipse(cx - f * w * 0.22, uy + h * 0.6, w * 0.22, h * 0.28);

  // Middle segment
  g.fillStyle(deep);
  g.fillEllipse(cx, uy + h * 0.6, w * 0.34, h * 0.44);
  g.fillStyle(secondary);
  g.fillEllipse(cx, uy + h * 0.58, w * 0.3, h * 0.38);
  g.fillStyle(primary);
  g.fillEllipse(cx, uy + h * 0.55, w * 0.24, h * 0.3);

  // Head segment
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.24, uy + h * 0.55, w * 0.3, h * 0.42);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.24, uy + h * 0.53, w * 0.26, h * 0.36);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.24, uy + h * 0.5, w * 0.2, h * 0.28);

  // Bright tiny eye
  g.fillStyle(0xffffff);
  g.fillCircle(cx + f * w * 0.32, uy + h * 0.5, 1.2);

  // 8 fast-flailing legs — leg flurry signature
  const lp = u.state === 'march' ? u.bob * 3 : u.bob * 0.5;
  g.lineStyle(1, deep);
  for (let l = 0; l < 4; l++) {
    const lx = cx + (l - 1.5) * w * 0.18;
    const ly = uy + h * 0.7;
    const swA = Math.sin(lp + l * 1.7) * w * 0.15;
    const swB = Math.cos(lp + l * 1.7) * w * 0.15;
    // Left leg
    g.lineBetween(lx, ly, lx - f * w * 0.18 + swA, uy + h);
    // Right leg
    g.lineBetween(lx, ly, lx + f * w * 0.18 + swB, uy + h);
  }

  // Whippy antennae trailing back from speed
  g.lineStyle(1, deep);
  const ax = cx + f * w * 0.32;
  const ay = uy + h * 0.42;
  const wave = Math.sin(u.bob * 4) * 3;
  g.lineBetween(ax, ay, ax - f * w * 0.4, ay - 4 + wave);
  g.lineBetween(ax, ay, ax - f * w * 0.3, ay - 7 - wave);

  // Speed lines when attacking (rapid blur)
  if (u.state === 'attack') {
    g.lineStyle(1, primary, 0.6);
    g.lineBetween(cx + f * w * 0.4, uy + h * 0.5, cx + f * w * 0.55, uy + h * 0.5);
    g.lineBetween(cx + f * w * 0.4, uy + h * 0.55, cx + f * w * 0.52, uy + h * 0.55);
  }
};

export default draw;
