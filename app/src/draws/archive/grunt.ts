import Phaser from 'phaser';
import type { DrawFunction, RenderUnit } from '../../types';
import { hexToInt, getStrike, drawImpactSpark } from '../../units/renderUtils';

const draw: DrawFunction = (g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const darkBone = 0x8a7a6a;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Strike swing — coil back on the wind-up, lunge forward on impact.
  const s = getStrike(u);
  const fwd = f * s.reach * w * 0.36;          // body reach along facing
  const dip = s.lunge * h * 0.08 - s.coil * h * 0.03; // head drops into the bite

  // --- Legs (walk-cycle while marching; rear legs brace + push on the lunge) ---
  const lp = u.state === "march" ? u.bob : 0;
  const brace = s.lunge * f * w * 0.06;
  g.lineStyle(w * 0.035, secondary);
  const legX = [-f * w * 0.08, f * w * 0.12, f * w * 0.28];
  const legY = [h * 0.82, h * 0.72, h * 0.62];
  const groundY = uy + h + h * 0.12;
  for (let l = 0; l < 3; l++) {
    const lx = cx + legX[l];
    const ly = uy + legY[l];
    const sw = Math.sin(lp + l * 1.2) * w * 0.04;
    g.lineBetween(lx, ly, lx - w * 0.08 - sw - brace, groundY);
    g.lineBetween(lx, ly, lx + w * 0.08 + sw - brace, groundY);
  }

  // --- Abdomen (lags behind the lunge — body weight trailing) ---
  const abx = cx - f * w * 0.06 + fwd * 0.25;
  g.fillStyle(secondary);
  g.fillEllipse(abx, uy + h * 0.72, w * 0.38, h * 0.4);
  g.fillStyle(primary);
  g.fillEllipse(abx, uy + h * 0.7, w * 0.3, h * 0.3);

  // --- Petiole ---
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.1 + fwd * 0.5, uy + h * 0.62, w * 0.08, h * 0.08);

  // --- Thorax (follows the lunge) ---
  const tx = cx + f * w * 0.2 + fwd * 0.8;
  g.fillStyle(secondary);
  g.fillEllipse(tx, uy + h * 0.58 + dip * 0.5, w * 0.24, h * 0.2);
  g.fillStyle(primary);
  g.fillEllipse(tx, uy + h * 0.56 + dip * 0.5, w * 0.18, h * 0.14);

  // --- Head (leads the lunge fully) ---
  const hx = cx + f * w * 0.36 + fwd;
  const hy = uy + h * 0.5 + dip;
  g.fillStyle(secondary);
  g.fillEllipse(hx, hy + h * 0.02, w * 0.22, h * 0.2);
  g.fillStyle(primary);
  g.fillEllipse(hx, hy, w * 0.17, h * 0.15);

  // --- Eye ---
  g.fillStyle(0xffffff);
  g.fillCircle(hx + f * w * 0.06, hy - h * 0.02, w * 0.04);

  // --- Mandibles: gape wide on the wind-up, snap shut + jab on the strike ---
  const jx = hx + f * w * 0.1;
  const jy = hy + h * 0.03;
  const gape = s.coil * h * 0.16;              // jaws open during wind-up
  const thrust = s.lunge * w * 0.14;           // jaws jab forward on impact
  const tipx = jx + f * (w * 0.13 + thrust);
  g.lineStyle(w * 0.05, darkBone);
  // upper + lower mandible
  g.lineBetween(jx, jy - h * 0.02, tipx, jy - h * 0.02 - gape);
  g.lineBetween(jx, jy + h * 0.02, tipx, jy + h * 0.02 + gape);
  // inward-hooked tips (the biting points)
  g.lineBetween(tipx, jy - h * 0.02 - gape, tipx + f * w * 0.04, jy);
  g.lineBetween(tipx, jy + h * 0.02 + gape, tipx + f * w * 0.04, jy);

  // --- Impact burst at the bite point (only at contact) ---
  if (s.impact > 0.01) drawImpactSpark(g, jx + f * (w * 0.2 + thrust), jy, w, s.impact);

  // --- Antennae (flick back on the lunge) ---
  g.lineStyle(w * 0.03, secondary);
  const ax = hx - f * w * 0.02;
  const ay = hy - h * 0.08;
  const wave = Math.sin(u.bob) * w * 0.03;
  const sweep = -f * s.lunge * w * 0.07;
  g.lineBetween(ax, ay, ax + f * w * 0.08 + wave + sweep, ay - h * 0.08);
  g.lineBetween(ax, ay, ax + f * w * 0.04 - wave + sweep, ay - h * 0.08);
};

export default draw;
