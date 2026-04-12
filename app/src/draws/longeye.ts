import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Longeye — slow sniper bug with HUGE single dominant compound eye (the signature)
// Distinct features: massive front-mounted eye, slim spider-like body, raptorial arms
const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = 0x180828;
  const lens = 0x60c0ff;
  const lensCore = 0xffffff;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Slim crouched abdomen
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.24, uy + h * 0.7, w * 0.52, h * 0.5);
  g.fillStyle(secondary);
  g.fillEllipse(cx - f * w * 0.24, uy + h * 0.68, w * 0.46, h * 0.42);
  g.fillStyle(primary);
  g.fillEllipse(cx - f * w * 0.24, uy + h * 0.65, w * 0.38, h * 0.32);

  // Stalk thorax (narrow neck connecting body to head)
  g.fillStyle(deep);
  g.fillEllipse(cx, uy + h * 0.55, w * 0.22, h * 0.36);
  g.fillStyle(secondary);
  g.fillEllipse(cx, uy + h * 0.53, w * 0.18, h * 0.3);

  // Head base — small cap behind the giant eye
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.18, uy + h * 0.42, w * 0.24, h * 0.32);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.18, uy + h * 0.4, w * 0.2, h * 0.26);

  // GIGANTIC FRONT-MOUNTED EYE — the signature
  const ex = cx + f * w * 0.36;
  const ey = uy + h * 0.4;
  // Eye socket (deep)
  g.fillStyle(deep);
  g.fillCircle(ex, ey, w * 0.2);
  // Lens body (bright color)
  g.fillStyle(secondary);
  g.fillCircle(ex, ey, w * 0.18);
  g.fillStyle(lens);
  g.fillCircle(ex, ey, w * 0.16);
  // Inner lens segments (compound eye facets — hexagonal feel)
  g.lineStyle(0.5, deep, 0.6);
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(ex - w * 0.16, ey + i * h * 0.06);
    g.lineTo(ex + w * 0.16, ey + i * h * 0.06);
    g.strokePath();
  }
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(ex + i * w * 0.06, ey - h * 0.16);
    g.lineTo(ex + i * w * 0.06, ey + h * 0.16);
    g.strokePath();
  }
  // Pupil / focus point (tracks target)
  const focus = u.state === 'attack' ? f * w * 0.04 : 0;
  g.fillStyle(deep);
  g.fillCircle(ex + focus, ey, w * 0.06);
  // Bright lens highlight (glints)
  g.fillStyle(lensCore, 0.9);
  g.fillCircle(ex - w * 0.04, ey - h * 0.06, w * 0.04);
  g.fillStyle(lensCore, 0.5);
  g.fillCircle(ex + w * 0.06, ey + h * 0.04, w * 0.02);

  // Raptorial fore-arms (folded sniper-rifle pose) — chunkier than before
  g.lineStyle(2, deep);
  const armX = cx + f * w * 0.1;
  const armY = uy + h * 0.5;
  // Upper arm
  g.lineBetween(armX, armY, armX + f * w * 0.32, armY + h * 0.05);
  // Forearm
  g.lineBetween(armX + f * w * 0.32, armY + h * 0.05, armX + f * w * 0.22, armY + h * 0.22);
  // Joint
  g.fillStyle(deep);
  g.fillCircle(armX + f * w * 0.32, armY + h * 0.05, 1.5);

  // Crosshair targeting beam when attacking
  if (u.state === 'attack') {
    g.lineStyle(0.5, 0xff4040, 0.8);
    const beamY = ey;
    const beamStart = ex + f * w * 0.18;
    const beamEnd = beamStart + f * w * 1.2;
    g.lineBetween(beamStart, beamY, beamEnd, beamY);
    // Crosshair at beam end
    g.lineStyle(1, 0xff4040, 0.7);
    g.strokeCircle(beamEnd, beamY, 4);
    g.lineBetween(beamEnd - 6, beamY, beamEnd + 6, beamY);
    g.lineBetween(beamEnd, beamY - 6, beamEnd, beamY + 6);
    // Muzzle flash from arm tip
    g.fillStyle(0xffee44, 0.7);
    g.fillCircle(armX + f * w * 0.36, armY + h * 0.06, 2.5);
  }

  // Long thin spider legs (4 pairs) — pre-sprung crouch
  g.lineStyle(1, deep);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 4; l++) {
    const lx = cx + (l - 1.5) * w * 0.18 - f * w * 0.05;
    const ly = uy + h * 0.78;
    const sw = Math.sin(lp + l * 1.2) * w * 0.05;
    // Outward-then-down leg with knee
    g.lineBetween(lx, ly, lx - f * w * 0.12, ly - h * 0.08);
    g.lineBetween(lx - f * w * 0.12, ly - h * 0.08, lx - f * w * 0.18 + sw, uy + h);
    g.lineBetween(lx, ly, lx + f * w * 0.12, ly - h * 0.08);
    g.lineBetween(lx + f * w * 0.12, ly - h * 0.08, lx + f * w * 0.18 + sw, uy + h);
  }
};

export default draw;
