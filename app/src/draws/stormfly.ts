import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Stormfly — electric flying bug with crackling lightning wings
// Distinct features: glowing storm-cloud abdomen, jagged lightning wings, arc flashes
const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = 0x081830;
  const arc = 0x80ffff;
  const arcCore = 0xffffff;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Storm cloud aura (behind body)
  const auraPulse = 0.18 + Math.sin(u.bob * 2.5) * 0.08;
  g.fillStyle(0x4080c0, auraPulse * 0.5);
  g.fillCircle(cx, uy + h * 0.5, w * 0.62);

  // LIGHTNING WINGS — jagged, crackling, the signature feature
  const flap = Math.sin(u.bob * 8) * 0.4;
  // Each wing is a jagged polygon (not smooth)
  // Back wing pair
  g.fillStyle(arc, 0.3);
  g.beginPath();
  g.moveTo(cx + f * w * 0.0, uy + h * 0.3);
  g.lineTo(cx - f * w * 0.36, uy + h * 0.05 - flap * 4);
  g.lineTo(cx - f * w * 0.32, uy + h * 0.18 - flap * 3);
  g.lineTo(cx - f * w * 0.42, uy + h * 0.22 - flap * 2);
  g.lineTo(cx - f * w * 0.22, uy + h * 0.32);
  g.closePath();
  g.fillPath();

  // Front wing pair
  g.beginPath();
  g.moveTo(cx + f * w * 0.05, uy + h * 0.3);
  g.lineTo(cx + f * w * 0.34, uy + h * 0.04 - flap * 4);
  g.lineTo(cx + f * w * 0.28, uy + h * 0.16 - flap * 3);
  g.lineTo(cx + f * w * 0.4, uy + h * 0.2 - flap * 2);
  g.lineTo(cx + f * w * 0.18, uy + h * 0.32);
  g.closePath();
  g.fillPath();

  // Wing edges (electric outline)
  g.lineStyle(1, arc, 0.8);
  g.beginPath();
  g.moveTo(cx + f * w * 0.0, uy + h * 0.3);
  g.lineTo(cx - f * w * 0.36, uy + h * 0.05 - flap * 4);
  g.lineTo(cx - f * w * 0.32, uy + h * 0.18 - flap * 3);
  g.lineTo(cx - f * w * 0.42, uy + h * 0.22 - flap * 2);
  g.lineTo(cx - f * w * 0.22, uy + h * 0.32);
  g.strokePath();
  g.beginPath();
  g.moveTo(cx + f * w * 0.05, uy + h * 0.3);
  g.lineTo(cx + f * w * 0.34, uy + h * 0.04 - flap * 4);
  g.lineTo(cx + f * w * 0.28, uy + h * 0.16 - flap * 3);
  g.lineTo(cx + f * w * 0.4, uy + h * 0.2 - flap * 2);
  g.lineTo(cx + f * w * 0.18, uy + h * 0.32);
  g.strokePath();

  // Glowing storm abdomen (the cloud belly)
  const glow = 0.5 + Math.sin(u.bob * 3) * 0.25;
  g.fillStyle(arc, glow * 0.4);
  g.fillCircle(cx - f * w * 0.04, uy + h * 0.65, w * 0.36);

  // Abdomen body (3-tone)
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.04, uy + h * 0.66, w * 0.66, h * 0.74);
  g.fillStyle(secondary);
  g.fillEllipse(cx - f * w * 0.04, uy + h * 0.64, w * 0.6, h * 0.66);
  g.fillStyle(primary);
  g.fillEllipse(cx - f * w * 0.04, uy + h * 0.6, w * 0.5, h * 0.54);

  // Crackling arc lines on abdomen (storm energy)
  g.lineStyle(1, arc, glow);
  g.lineBetween(cx - f * w * 0.18, uy + h * 0.55, cx - f * w * 0.08, uy + h * 0.7);
  g.lineBetween(cx - f * w * 0.08, uy + h * 0.7, cx + f * w * 0.04, uy + h * 0.58);
  g.lineStyle(0.5, arcCore, glow * 0.8);
  g.lineBetween(cx - f * w * 0.16, uy + h * 0.55, cx - f * w * 0.08, uy + h * 0.68);

  // Thorax (smaller, dark)
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.16, uy + h * 0.4, w * 0.32, h * 0.4);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.16, uy + h * 0.38, w * 0.28, h * 0.34);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.16, uy + h * 0.36, w * 0.22, h * 0.28);

  // Head
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.34, uy + h * 0.32, w * 0.26, h * 0.32);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.34, uy + h * 0.3, w * 0.22, h * 0.28);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.34, uy + h * 0.28, w * 0.18, h * 0.22);

  // Glowing electric eyes
  const eyeGlow = 0.7 + Math.sin(u.bob * 5) * 0.3;
  g.fillStyle(arc, eyeGlow);
  g.fillCircle(cx + f * w * 0.4, uy + h * 0.28, 2);
  g.fillStyle(arcCore, eyeGlow);
  g.fillCircle(cx + f * w * 0.4, uy + h * 0.28, 1);

  // Lightning bolt projectile when attacking
  if (u.state === 'attack') {
    const sx = cx + f * w * 0.46;
    const sy = uy + h * 0.32;
    // Outer bolt glow
    g.lineStyle(3, arc, 0.5);
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + f * 8, sy - 4);
    g.lineTo(sx + f * 14, sy + 3);
    g.lineTo(sx + f * 22, sy - 2);
    g.strokePath();
    // Inner bolt core
    g.lineStyle(1.5, arcCore, 0.95);
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + f * 8, sy - 4);
    g.lineTo(sx + f * 14, sy + 3);
    g.lineTo(sx + f * 22, sy - 2);
    g.strokePath();

    // Overcharge ring (every 4th hit)
    if (u.hitCount && u.hitCount % 4 === 3) {
      g.lineStyle(2, 0xffff60, 0.6);
      g.strokeCircle(cx, uy + h * 0.45, w * 0.6);
    }
  }

  // Ambient electric sparks orbiting
  const sp1x = cx + Math.sin(u.bob * 3) * 8;
  const sp1y = uy + h * 0.3 + Math.cos(u.bob * 2.5) * 4;
  g.fillStyle(arcCore, 0.7);
  g.fillCircle(sp1x, sp1y, 1);
  const sp2x = cx + Math.cos(u.bob * 2.2) * 6;
  const sp2y = uy + h * 0.7 + Math.sin(u.bob * 3.1) * 4;
  g.fillCircle(sp2x, sp2y, 0.8);

  // Thin legs (3 pairs)
  g.lineStyle(1, deep);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 3; l++) {
    const lx = cx + (l - 1) * w * 0.18;
    const ly = uy + h * 0.74;
    const sw = Math.sin(lp + l * 1.1) * 3;
    g.lineBetween(lx, ly, lx + f * 4 + sw, ly + 6);
    g.lineBetween(lx, ly, lx - f * 4 - sw, ly + 6);
  }
};

export default draw;
