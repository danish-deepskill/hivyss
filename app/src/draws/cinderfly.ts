import type { DrawFunction } from '../types';
import { hexToInt, drawCommonParts } from '../units/renderUtils';

// Cinderfly — burning fly with translucent ember wings (the "fly" in the name)
const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const t = u.bob;
  const f = u.facing;

  // Heat shimmer aura (warm glow behind body)
  const glowPulse = 0.12 + Math.sin(t * 3) * 0.06;
  g.fillStyle(0xff4010, glowPulse);
  g.fillCircle(cx, uy + u.h * 0.5, u.w * 0.6);

  // FLAMING WINGS — translucent fire-tinted, flapping
  const flap = Math.sin(t * 8) * 0.4;
  // Outer wing glow
  g.fillStyle(0xff6020, 0.25);
  g.fillEllipse(cx - f * u.w * 0.18, uy + u.h * 0.18 - flap * 3, u.w * 0.42, u.h * 0.5 + flap * 4);
  g.fillEllipse(cx + f * u.w * 0.06, uy + u.h * 0.16 - flap * 3, u.w * 0.42, u.h * 0.5 + flap * 4);
  // Inner wing membrane
  g.fillStyle(0xffaa30, 0.35);
  g.fillEllipse(cx - f * u.w * 0.18, uy + u.h * 0.22 - flap * 3, u.w * 0.32, u.h * 0.4 + flap * 3);
  g.fillEllipse(cx + f * u.w * 0.06, uy + u.h * 0.2 - flap * 3, u.w * 0.32, u.h * 0.4 + flap * 3);
  // Wing edges (ember outline)
  g.lineStyle(1, 0xffdd40, 0.6);
  g.strokeEllipse(cx - f * u.w * 0.18, uy + u.h * 0.18 - flap * 3, u.w * 0.42, u.h * 0.5 + flap * 4);
  g.strokeEllipse(cx + f * u.w * 0.06, uy + u.h * 0.16 - flap * 3, u.w * 0.42, u.h * 0.5 + flap * 4);

  // Animated flame tongues rising from abdomen (layered, back to front)
  // Each flame is a teardrop shape that flickers independently
  const flames = [
    { ox: -0.15, oy: 0.35, sz: 0.9, spd: 4.2, phase: 0 },
    { ox: 0.05,  oy: 0.28, sz: 1.0, spd: 3.5, phase: 1.2 },
    { ox: -0.25, oy: 0.45, sz: 0.7, spd: 5.0, phase: 2.5 },
    { ox: 0.15,  oy: 0.32, sz: 0.8, spd: 3.8, phase: 3.8 },
    { ox: -0.05, oy: 0.5,  sz: 0.6, spd: 4.8, phase: 5.0 },
  ];
  flames.forEach(f => {
    const flicker = Math.sin(t * f.spd + f.phase);
    const rise = flicker * 3;
    const fx = cx + u.facing * u.w * f.ox;
    const fy = uy + u.h * f.oy + rise;
    const sz = (3 + flicker * 1.2) * f.sz;

    // Outer flame (red-orange)
    g.fillStyle(0xff4010, 0.5 + flicker * 0.15);
    g.beginPath();
    g.moveTo(fx, fy - sz * 2.2);
    g.lineTo(fx - sz * 0.7, fy + sz * 0.3);
    g.lineTo(fx + sz * 0.7, fy + sz * 0.3);
    g.closePath();
    g.fillPath();

    // Inner flame (bright yellow-white core)
    g.fillStyle(0xffdd30, 0.6 + flicker * 0.2);
    g.beginPath();
    g.moveTo(fx, fy - sz * 1.3);
    g.lineTo(fx - sz * 0.35, fy + sz * 0.15);
    g.lineTo(fx + sz * 0.35, fy + sz * 0.15);
    g.closePath();
    g.fillPath();
  });

  // Dark charred body underneath flames
  g.fillStyle(secondary);
  g.fillEllipse(cx - u.facing * 2, uy + u.h * 0.64, u.w * 0.7, u.h * 0.78);
  // Magma cracks on abdomen
  g.lineStyle(1, 0xff6020, 0.6);
  g.lineBetween(cx - u.facing * 4, uy + u.h * 0.5, cx - u.facing * 1, uy + u.h * 0.7);
  g.lineBetween(cx - u.facing * 1, uy + u.h * 0.7, cx + u.facing * 2, uy + u.h * 0.55);
  g.lineStyle(1, 0xffaa20, 0.4);
  g.lineBetween(cx - u.facing * 2, uy + u.h * 0.58, cx + u.facing * 1, uy + u.h * 0.75);

  // Thorax (smoldering)
  g.fillStyle(primary);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.34, u.w * 0.5, u.h * 0.5);

  // Head with glowing eyes
  g.fillStyle(primary);
  g.fillEllipse(cx + u.facing * u.w * 0.28, uy + u.h * 0.18, u.w * 0.4, u.h * 0.36);
  // Fiery eyes
  const eyeGlow = 0.7 + Math.sin(t * 6) * 0.3;
  g.fillStyle(0xffee40, eyeGlow);
  g.fillCircle(cx + u.facing * u.w * 0.32, uy + u.h * 0.14, 2);
  g.fillStyle(0xff4020, eyeGlow * 0.8);
  g.fillCircle(cx + u.facing * u.w * 0.32, uy + u.h * 0.14, 1);

  // Floating ember sparks (small particles drifting upward)
  g.fillStyle(0xffaa20, 0.6);
  const sp1x = cx + Math.sin(t * 2.3) * 6;
  const sp1y = uy + u.h * 0.1 + Math.cos(t * 1.8) * 4;
  g.fillCircle(sp1x, sp1y, 1.2);
  g.fillStyle(0xff6020, 0.5);
  const sp2x = cx + Math.cos(t * 3.1) * 8;
  const sp2y = uy - 2 + Math.sin(t * 2.5) * 3;
  g.fillCircle(sp2x, sp2y, 0.8);
  g.fillStyle(0xffdd40, 0.4);
  const sp3x = cx + Math.sin(t * 1.7 + 2) * 5;
  const sp3y = uy + u.h * 0.05 + Math.cos(t * 3.3) * 4;
  g.fillCircle(sp3x, sp3y, 1);

  // Fire breath when attacking
  if (u.state === 'attack') {
    const bx = cx + u.facing * u.w * 0.4;
    const by = uy + u.h * 0.2;
    // Outer fire cone
    g.fillStyle(0xff4010, 0.5);
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx + u.facing * 14, by - 5);
    g.lineTo(bx + u.facing * 16, by + 2);
    g.lineTo(bx + u.facing * 14, by + 7);
    g.closePath();
    g.fillPath();
    // Inner bright core
    g.fillStyle(0xffcc30, 0.6);
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx + u.facing * 10, by - 2);
    g.lineTo(bx + u.facing * 10, by + 4);
    g.closePath();
    g.fillPath();
    // Muzzle flash
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(bx + u.facing * 2, by + 1, 2.5);
  }

  drawCommonParts(g, u, cx, uy);
};

export default draw;
