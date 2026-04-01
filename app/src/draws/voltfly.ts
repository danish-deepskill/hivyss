import type { DrawFunction } from '../types';
import { hexToInt, drawCommonParts } from '../units/renderUtils';

const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);

  // Glowing abdomen (firefly light bulb)
  const glowPulse = 0.4 + Math.sin(u.bob * 2) * 0.3;
  g.fillStyle(0x80ffff, glowPulse);
  g.fillCircle(cx - u.facing * 4, uy + u.h * 0.62, u.w * 0.32);

  // Abdomen (translucent electric)
  g.fillStyle(primary);
  g.fillEllipse(cx - u.facing * 3, uy + u.h * 0.6, u.w * 0.68, u.h * 0.78);

  // Thorax
  g.fillStyle(secondary);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.32, u.w * 0.48, u.h * 0.5);

  // Head
  g.fillStyle(primary);
  g.fillEllipse(cx + u.facing * u.w * 0.28, uy + u.h * 0.16, u.w * 0.4, u.h * 0.36);

  // Wings (dragonfly-like, translucent)
  g.fillStyle(0x80e0ff, 0.25);
  g.fillEllipse(cx - u.facing * 1, uy + u.h * 0.05, u.w * 0.5, u.h * 0.2);
  g.fillEllipse(cx + u.facing * 2, uy + u.h * 0.1, u.w * 0.4, u.h * 0.15);

  // Lightning bolt symbol on thorax
  g.fillStyle(0xffee40, 0.7);
  const bx = cx + u.facing * 1;
  const by = uy + u.h * 0.26;
  g.beginPath();
  g.moveTo(bx - 2, by - 4);
  g.lineTo(bx + 2, by - 1);
  g.lineTo(bx - 1, by);
  g.lineTo(bx + 2, by + 4);
  g.lineTo(bx - 2, by + 1);
  g.lineTo(bx + 1, by);
  g.closePath();
  g.fillPath();

  // Electric sparks when attacking
  if (u.state === 'attack') {
    g.lineStyle(1.5, 0x80ffff, 0.8);
    const sx = cx + u.facing * u.w * 0.45;
    const sy = uy + u.h * 0.2;
    // Zig-zag lightning bolt projectile
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + u.facing * 8, sy - 4);
    g.lineTo(sx + u.facing * 14, sy + 3);
    g.lineTo(sx + u.facing * 20, sy - 2);
    g.strokePath();

    // Overcharge glow (every 4th hit)
    if (u.hitCount && u.hitCount % 4 === 3) {
      g.fillStyle(0xffff60, 0.4);
      g.fillCircle(cx, uy + u.h * 0.4, u.w * 0.55);
    }
  }

  // Ambient static particles
  g.fillStyle(0xffff80, 0.5);
  const sp1 = Math.sin(u.bob * 3) * 6;
  const sp2 = Math.cos(u.bob * 2.5) * 5;
  g.fillCircle(cx + sp1, uy + u.h * 0.3 + sp2, 1);
  g.fillCircle(cx - sp2, uy + u.h * 0.7 + sp1, 1);

  drawCommonParts(g, u, cx, uy);
};

export default draw;
