import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Pricker — fragile slim hornet with prominent rear stinger, hornet stripes
const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = 0x281404;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Vestigial wings — small flicker behind thorax
  const flap = Math.sin(u.bob * 7) * 1.5;
  g.fillStyle(0xffffff, 0.3);
  g.fillEllipse(cx - f * w * 0.05, uy + h * 0.26 + flap, w * 0.36, h * 0.18);
  g.lineStyle(0.5, secondary, 0.4);
  g.strokeEllipse(cx - f * w * 0.05, uy + h * 0.26 + flap, w * 0.36, h * 0.18);

  // Slim elongated abdomen with hornet stripes (3-tone)
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.22, uy + h * 0.58, w * 0.58, h * 0.46);
  g.fillStyle(secondary);
  g.fillEllipse(cx - f * w * 0.22, uy + h * 0.56, w * 0.52, h * 0.4);
  g.fillStyle(primary);
  g.fillEllipse(cx - f * w * 0.22, uy + h * 0.54, w * 0.46, h * 0.34);

  // Black hornet stripes on abdomen (3 stripes)
  g.fillStyle(deep, 0.85);
  for (let i = 0; i < 3; i++) {
    g.fillRect(cx - f * (w * 0.4 - i * w * 0.13), uy + h * 0.42, w * 0.05, h * 0.26);
  }

  // Thorax (smaller, joins to head)
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.06, uy + h * 0.45, w * 0.32, h * 0.38);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.06, uy + h * 0.43, w * 0.28, h * 0.32);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.06, uy + h * 0.4, w * 0.22, h * 0.26);

  // Round head
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.32, uy + h * 0.38, w * 0.3, h * 0.34);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.32, uy + h * 0.36, w * 0.26, h * 0.28);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.32, uy + h * 0.34, w * 0.2, h * 0.22);

  // Compound eyes
  g.fillStyle(0x000000);
  g.fillCircle(cx + f * w * 0.38, uy + h * 0.34, 1.8);
  g.fillStyle(0xffffff, 0.7);
  g.fillCircle(cx + f * w * 0.39, uy + h * 0.33, 0.6);

  // PROMINENT REAR STINGER — long sharp spike pointing back
  g.fillStyle(deep);
  g.beginPath();
  g.moveTo(cx - f * w * 0.46, uy + h * 0.55);
  g.lineTo(cx - f * w * 0.78, uy + h * 0.5);
  g.lineTo(cx - f * w * 0.46, uy + h * 0.62);
  g.closePath();
  g.fillPath();
  // Stinger highlight
  g.fillStyle(secondary);
  g.beginPath();
  g.moveTo(cx - f * w * 0.46, uy + h * 0.56);
  g.lineTo(cx - f * w * 0.7, uy + h * 0.52);
  g.lineTo(cx - f * w * 0.46, uy + h * 0.6);
  g.closePath();
  g.fillPath();
  // Stinger tip glint when attacking
  if (u.state === 'attack') {
    g.fillStyle(0xfff080, 0.9);
    g.fillCircle(cx - f * w * 0.78, uy + h * 0.5, 1.8);
    // Venom drip
    g.fillStyle(0xa0ff40, 0.7);
    g.fillCircle(cx - f * w * 0.82, uy + h * 0.55, 1);
  }

  // Forward antennae (alert)
  g.lineStyle(1, deep);
  const ax = cx + f * w * 0.32;
  const ay = uy + h * 0.24;
  const wave = Math.sin(u.bob) * 1.5;
  g.lineBetween(ax, ay, ax + f * 6 + wave, ay - 5);
  g.lineBetween(ax, ay, ax + f * 4 - wave, ay - 6);

  // Thin legs — 3 pairs
  g.lineStyle(1, deep);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 3; l++) {
    const lx = cx + (l - 1) * w * 0.18;
    const ly = uy + h * 0.62;
    const sw = Math.sin(lp + l * 1.1) * 3;
    g.lineBetween(lx, ly, lx + f * 4 + sw, ly + 7);
    g.lineBetween(lx, ly, lx - f * 4 - sw, ly + 7);
  }
};

export default draw;
