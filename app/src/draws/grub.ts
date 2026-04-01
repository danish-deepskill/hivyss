import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = 0x1e3008;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // --- Stubby legs (short, simple) ---
  const lp = u.state === 'march' ? u.bob : 0;
  g.lineStyle(w * 0.05, deep);
  const groundY = uy + h + h * 0.12;
  for (let l = 0; l < 3; l++) {
    const lx = cx + (l - 1) * w * 0.2 * f;
    const ly = uy + h * 0.7;
    const sw = Math.sin(lp + l * 1.3) * w * 0.04;
    g.lineBetween(lx, ly, lx - w * 0.08 - sw, groundY);
    g.lineBetween(lx, ly, lx + w * 0.08 + sw, groundY);
  }

  // --- Body segments (3 overlapping, back to front) ---
  // Rear segment
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.18, uy + h * 0.65, w * 0.42, h * 0.58);
  g.fillStyle(secondary);
  g.fillEllipse(cx - f * w * 0.18, uy + h * 0.63, w * 0.38, h * 0.54);
  g.fillStyle(primary);
  g.fillEllipse(cx - f * w * 0.18, uy + h * 0.59, w * 0.3, h * 0.38);

  // Middle segment
  g.fillStyle(deep);
  g.fillEllipse(cx, uy + h * 0.58, w * 0.4, h * 0.55);
  g.fillStyle(secondary);
  g.fillEllipse(cx, uy + h * 0.56, w * 0.36, h * 0.5);
  g.fillStyle(primary);
  g.fillEllipse(cx, uy + h * 0.52, w * 0.28, h * 0.36);

  // Front segment
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.16, uy + h * 0.52, w * 0.38, h * 0.5);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.16, uy + h * 0.5, w * 0.34, h * 0.46);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.16, uy + h * 0.46, w * 0.26, h * 0.32);

  // --- Head (small, round) ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.32, uy + h * 0.42, w * 0.28, h * 0.32);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.32, uy + h * 0.4, w * 0.24, h * 0.28);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.32, uy + h * 0.37, w * 0.18, h * 0.2);

  // --- Eye (solid compound eye) ---
  const ex = cx + f * w * 0.36;
  const ey = uy + h * 0.37;
  g.fillStyle(0xffffff);
  g.fillCircle(ex, ey, w * 0.04);

  // --- Small mandibles (tiny nippers) ---
  const jx = cx + f * w * 0.42;
  const jy = uy + h * 0.42;
  g.lineStyle(w * 0.045, secondary);
  if (u.state === 'attack') {
    g.beginPath(); g.moveTo(jx, jy - h * 0.03); g.lineTo(jx + f * w * 0.14, jy - h * 0.1); g.strokePath();
    g.beginPath(); g.moveTo(jx, jy + h * 0.03); g.lineTo(jx + f * w * 0.14, jy + h * 0.08); g.strokePath();
  } else {
    g.beginPath(); g.moveTo(jx, jy - h * 0.02); g.lineTo(jx + f * w * 0.12, jy); g.strokePath();
    g.beginPath(); g.moveTo(jx, jy + h * 0.02); g.lineTo(jx + f * w * 0.12, jy); g.strokePath();
  }

  // --- Short antennae (stubby) ---
  g.lineStyle(w * 0.04, secondary);
  const ax = cx + f * w * 0.3;
  const ay = uy + h * 0.3;
  const wave = Math.sin(u.bob) * w * 0.04;
  g.lineBetween(ax, ay, ax + f * w * 0.12 + wave, ay - h * 0.12);
  g.lineBetween(ax, ay, ax + f * w * 0.04 - wave, ay - h * 0.14);
};

export default draw;
