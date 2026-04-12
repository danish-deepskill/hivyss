import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Bashguard — heavy bruiser with massive front-mounted hammer-jaw (no horn)
const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = 0x2a2018;
  const club = 0x6a5a3a;
  const clubLight = 0xa89870;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Heavy ground shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, uy + h * 0.96, w * 0.8, h * 0.12);

  // Legs (4 thick stumps)
  const lp = u.state === 'march' ? u.bob : 0;
  g.lineStyle(w * 0.06, deep);
  const groundY = uy + h + h * 0.04;
  for (let l = 0; l < 4; l++) {
    const lx = cx + (l - 1.5) * w * 0.16;
    const ly = uy + h * 0.78;
    const sw = Math.sin(lp + l * 0.9) * w * 0.025;
    g.lineBetween(lx, ly, lx + sw, groundY);
  }

  // Massive bulky body (3-tone)
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.08, uy + h * 0.58, w * 0.74, h * 0.74);
  g.fillStyle(secondary);
  g.fillEllipse(cx - f * w * 0.08, uy + h * 0.56, w * 0.7, h * 0.68);
  g.fillStyle(primary);
  g.fillEllipse(cx - f * w * 0.08, uy + h * 0.5, w * 0.6, h * 0.54);

  // Plate ridges along back (3 segments)
  g.lineStyle(1.5, deep, 0.6);
  for (let i = 0; i < 3; i++) {
    const px = cx + (i - 1) * w * 0.12 - f * w * 0.08;
    g.lineBetween(px, uy + h * 0.32, px, uy + h * 0.68);
  }

  // Squat head, low and forward
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.28, uy + h * 0.55, w * 0.26, h * 0.46);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.28, uy + h * 0.53, w * 0.22, h * 0.4);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.28, uy + h * 0.5, w * 0.18, h * 0.32);

  // Tiny angry eye
  g.fillStyle(0xff4020);
  g.fillCircle(cx + f * w * 0.34, uy + h * 0.48, 1.5);

  // MASSIVE FRONT HAMMER-JAW — the bash signature
  // It's a chunky club-like protrusion mounted on the front
  const hx = cx + f * w * 0.4;
  const hy = uy + h * 0.55;
  const swing = u.state === 'attack' ? Math.sin(u.bob * 12) * w * 0.05 : 0;

  // Hammer base (connects to head)
  g.fillStyle(deep);
  g.beginPath();
  g.moveTo(hx, hy - h * 0.18);
  g.lineTo(hx + f * w * 0.06, hy - h * 0.22);
  g.lineTo(hx + f * w * 0.06, hy + h * 0.22);
  g.lineTo(hx, hy + h * 0.18);
  g.closePath();
  g.fillPath();

  // Hammer head (the bash plate)
  g.fillStyle(club);
  g.beginPath();
  g.moveTo(hx + f * (w * 0.06 + swing), hy - h * 0.32);
  g.lineTo(hx + f * (w * 0.22 + swing), hy - h * 0.28);
  g.lineTo(hx + f * (w * 0.24 + swing), hy + h * 0.28);
  g.lineTo(hx + f * (w * 0.06 + swing), hy + h * 0.32);
  g.closePath();
  g.fillPath();

  // Hammer face highlight
  g.fillStyle(clubLight);
  g.beginPath();
  g.moveTo(hx + f * (w * 0.18 + swing), hy - h * 0.24);
  g.lineTo(hx + f * (w * 0.22 + swing), hy - h * 0.2);
  g.lineTo(hx + f * (w * 0.22 + swing), hy + h * 0.2);
  g.lineTo(hx + f * (w * 0.18 + swing), hy + h * 0.24);
  g.closePath();
  g.fillPath();

  // Hammer rivets/studs (3)
  g.fillStyle(deep);
  for (let i = -1; i <= 1; i++) {
    g.fillCircle(hx + f * (w * 0.18 + swing), hy + i * h * 0.14, 1.2);
  }

  // Impact shockwave when attacking
  if (u.state === 'attack') {
    g.lineStyle(2, 0xffcc40, 0.7);
    const ix = hx + f * (w * 0.3 + swing);
    const iy = hy;
    g.beginPath();
    g.arc(ix, iy, w * 0.14, -Math.PI * 0.4, Math.PI * 0.4, false);
    g.strokePath();
    // Impact lines
    g.lineStyle(1.5, 0xffaa20, 0.6);
    g.lineBetween(ix + f * 4, iy - h * 0.15, ix + f * 8, iy - h * 0.18);
    g.lineBetween(ix + f * 5, iy + h * 0.15, ix + f * 9, iy + h * 0.18);
  }

  // Dust on march
  if (u.state === 'march') {
    const dustA = 0.12 + Math.sin(u.bob * 2.5) * 0.06;
    g.fillStyle(0x806040, dustA);
    g.fillCircle(cx - f * w * 0.4, uy + h * 0.9, w * 0.05);
    g.fillCircle(cx - f * w * 0.5, uy + h * 0.94, w * 0.04);
  }
};

export default draw;
