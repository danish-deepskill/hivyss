import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Wardling — protector with prominent shield-emblem carapace and rune-like aura
// Distinct features: angular shield-shaped body, glowing ward runes, golden aura ring
const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = 0x402810;
  const rune = 0xffe680;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Aura ring (behind body) — pulsing
  const auraPulse = 0.2 + Math.sin(u.bob * 2) * 0.08;
  g.lineStyle(2, rune, auraPulse);
  g.strokeCircle(cx, uy + h * 0.5, w * 0.7);
  // Inner aura
  g.lineStyle(1, rune, auraPulse * 0.7);
  g.strokeCircle(cx, uy + h * 0.5, w * 0.58);

  // Floating ward runes around body (4 dots)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + u.bob * 0.5;
    const rx = cx + Math.cos(angle) * w * 0.7;
    const ry = uy + h * 0.5 + Math.sin(angle) * h * 0.5;
    g.fillStyle(rune, 0.7);
    g.fillCircle(rx, ry, 1.5);
  }

  // Body shadow under unit
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(cx, uy + h * 0.96, w * 0.78, h * 0.12);

  // Lower abdomen (3-tone, broad)
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.04, uy + h * 0.66, w * 0.78, h * 0.66);
  g.fillStyle(secondary);
  g.fillEllipse(cx - f * w * 0.04, uy + h * 0.64, w * 0.72, h * 0.6);
  g.fillStyle(primary);
  g.fillEllipse(cx - f * w * 0.04, uy + h * 0.6, w * 0.62, h * 0.5);

  // Shield-shaped thorax plate (the signature) — angular not round
  g.fillStyle(deep);
  g.beginPath();
  g.moveTo(cx + f * w * 0.04, uy + h * 0.16);  // top point
  g.lineTo(cx + f * w * 0.26, uy + h * 0.32);  // upper right
  g.lineTo(cx + f * w * 0.22, uy + h * 0.52);  // mid right
  g.lineTo(cx + f * w * 0.04, uy + h * 0.6);   // bottom point
  g.lineTo(cx - f * w * 0.16, uy + h * 0.52);  // mid left
  g.lineTo(cx - f * w * 0.2, uy + h * 0.32);   // upper left
  g.closePath();
  g.fillPath();

  g.fillStyle(secondary);
  g.beginPath();
  g.moveTo(cx + f * w * 0.04, uy + h * 0.18);
  g.lineTo(cx + f * w * 0.22, uy + h * 0.32);
  g.lineTo(cx + f * w * 0.18, uy + h * 0.5);
  g.lineTo(cx + f * w * 0.04, uy + h * 0.56);
  g.lineTo(cx - f * w * 0.12, uy + h * 0.5);
  g.lineTo(cx - f * w * 0.16, uy + h * 0.32);
  g.closePath();
  g.fillPath();

  g.fillStyle(primary);
  g.beginPath();
  g.moveTo(cx + f * w * 0.04, uy + h * 0.22);
  g.lineTo(cx + f * w * 0.18, uy + h * 0.32);
  g.lineTo(cx + f * w * 0.14, uy + h * 0.46);
  g.lineTo(cx + f * w * 0.04, uy + h * 0.5);
  g.lineTo(cx - f * w * 0.08, uy + h * 0.46);
  g.lineTo(cx - f * w * 0.12, uy + h * 0.32);
  g.closePath();
  g.fillPath();

  // Glowing rune symbol on the shield
  g.fillStyle(rune, 0.85);
  // Vertical bar
  g.fillRect(cx + f * w * 0.02, uy + h * 0.28, 2, h * 0.16);
  // Cross bar
  g.fillRect(cx - f * w * 0.04, uy + h * 0.34, w * 0.14, 2);

  // Head poking up above the shield
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.04, uy + h * 0.12, w * 0.22, h * 0.22);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.04, uy + h * 0.1, w * 0.18, h * 0.18);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.04, uy + h * 0.08, w * 0.14, h * 0.12);

  // Stoic eye
  g.fillStyle(0x000000);
  g.fillCircle(cx + f * w * 0.08, uy + h * 0.1, 1.5);
  g.fillStyle(rune, 0.9);
  g.fillCircle(cx + f * w * 0.085, uy + h * 0.095, 0.7);

  // Sturdy legs (3 pairs, planted firm)
  g.lineStyle(2, deep);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 3; l++) {
    const lx = cx + (l - 1) * w * 0.22;
    const ly = uy + h * 0.78;
    const sw = Math.sin(lp + l * 1.1) * w * 0.03;
    g.lineBetween(lx, ly, lx + f * w * 0.12 + sw, uy + h);
    g.lineBetween(lx, ly, lx - f * w * 0.12 - sw, uy + h);
  }

  // Aura burst pulse when attacking
  if (u.state === 'attack') {
    g.lineStyle(2, rune, 0.8);
    g.strokeCircle(cx, uy + h * 0.5, w * 0.85);
  }
};

export default draw;
