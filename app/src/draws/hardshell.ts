import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Hardshell — slow squat pillbug-like wall, layered armor segments, no antennae
const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = 0x282020;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Wide ground shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, uy + h * 0.96, w * 0.94, h * 0.18);

  // Main domed body — wide and low (3-tone)
  g.fillStyle(deep);
  g.fillEllipse(cx, uy + h * 0.62, w * 0.98, h * 0.82);
  g.fillStyle(secondary);
  g.fillEllipse(cx, uy + h * 0.6, w * 0.92, h * 0.74);
  g.fillStyle(primary);
  g.fillEllipse(cx, uy + h * 0.55, w * 0.82, h * 0.62);

  // Horizontal armor segments — 4 visible bands, the signature feature
  g.lineStyle(1.5, deep, 0.8);
  for (let i = 0; i < 4; i++) {
    const segY = uy + h * (0.3 + i * 0.13);
    const taper = 1 - Math.abs(i - 1.5) * 0.08;
    const segW = w * 0.78 * taper;
    g.beginPath();
    g.moveTo(cx - segW * 0.5, segY);
    g.lineTo(cx + segW * 0.5, segY);
    g.strokePath();
  }
  // Lighter highlight on each band's top
  g.lineStyle(0.5, primary, 0.4);
  for (let i = 0; i < 4; i++) {
    const segY = uy + h * (0.3 + i * 0.13) - 1;
    const segW = w * 0.7;
    g.beginPath();
    g.moveTo(cx - segW * 0.5, segY);
    g.lineTo(cx + segW * 0.5, segY);
    g.strokePath();
  }

  // Front bump / head segment
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.36, uy + h * 0.46, w * 0.34, h * 0.42);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.36, uy + h * 0.44, w * 0.3, h * 0.36);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.36, uy + h * 0.41, w * 0.24, h * 0.28);

  // Tiny eye on the head bump
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(cx + f * w * 0.42, uy + h * 0.4, 1.3);
  g.fillStyle(0x000000);
  g.fillCircle(cx + f * w * 0.43, uy + h * 0.4, 0.8);

  // 6 stubby legs (3 pairs)
  g.lineStyle(1.5, deep);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 3; l++) {
    const lx = cx + (l - 1) * w * 0.22;
    const ly = uy + h * 0.78;
    const sw = Math.sin(lp + l * 0.9) * w * 0.025;
    g.lineBetween(lx, ly, lx + sw, uy + h);
    g.lineBetween(lx, ly, lx - sw, uy + h);
  }

  // Heavy mandibles when attacking
  if (u.state === 'attack') {
    g.lineStyle(2, deep);
    const mhx = cx + f * (w * 0.46);
    const mhy = uy + h * 0.5;
    g.lineBetween(mhx, mhy - 3, mhx + f * 5, mhy - 5);
    g.lineBetween(mhx, mhy + 3, mhx + f * 5, mhy + 5);
  }
};

export default draw;
