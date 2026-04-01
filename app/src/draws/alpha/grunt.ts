import Phaser from 'phaser';
import type { DrawFunction, RenderUnit } from '../../types';
import { hexToInt } from '../../units/renderUtils';

const draw: DrawFunction = (g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const darkBone = 0x8a7a6a;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // --- Legs (shorter, thinner — rookie) ---
  const lp = u.state === "march" ? u.bob : 0;
  g.lineStyle(w * 0.035, secondary);
  const legX = [-f * w * 0.08, f * w * 0.12, f * w * 0.28];
  const legY = [h * 0.82, h * 0.72, h * 0.62];
  const groundY = uy + h + h * 0.12;
  for (let l = 0; l < 3; l++) {
    const lx = cx + legX[l];
    const ly = uy + legY[l];
    const sw = Math.sin(lp + l * 1.2) * w * 0.04;
    g.lineBetween(lx, ly, lx - w * 0.08 - sw, groundY);
    g.lineBetween(lx, ly, lx + w * 0.08 + sw, groundY);
  }

  // --- Abdomen (small, round — no deep shadow layer, simpler) ---
  g.fillStyle(secondary);
  g.fillEllipse(cx - f * w * 0.06, uy + h * 0.72, w * 0.38, h * 0.4);
  g.fillStyle(primary);
  g.fillEllipse(cx - f * w * 0.06, uy + h * 0.7, w * 0.3, h * 0.3);

  // --- Petiole ---
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.1, uy + h * 0.62, w * 0.08, h * 0.08);

  // --- Thorax (low, flat — hunched near ground) ---
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.2, uy + h * 0.58, w * 0.24, h * 0.2);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.2, uy + h * 0.56, w * 0.18, h * 0.14);

  // --- Head (far forward and low — crouching posture) ---
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.36, uy + h * 0.52, w * 0.22, h * 0.2);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.36, uy + h * 0.5, w * 0.17, h * 0.15);

  // --- Eye (solid compound eye) ---
  const ex = cx + f * w * 0.42;
  const ey = uy + h * 0.48;
  g.fillStyle(0xffffff);
  g.fillCircle(ex, ey, w * 0.04);

  // --- Tiny jaws (nubs, not real mandibles) ---
  const jx = cx + f * w * 0.45;
  const jy = uy + h * 0.53;
  g.lineStyle(w * 0.04, darkBone);
  if (u.state === "attack") {
    g.lineBetween(jx, jy - h * 0.02, jx + f * w * 0.1, jy - h * 0.08);
    g.lineBetween(jx, jy + h * 0.02, jx + f * w * 0.1, jy + h * 0.06);
  } else {
    g.lineBetween(jx, jy - h * 0.01, jx + f * w * 0.08, jy - h * 0.01);
    g.lineBetween(jx, jy + h * 0.01, jx + f * w * 0.08, jy + h * 0.01);
  }

  // --- Antennae (tiny nubs — barely visible) ---
  g.lineStyle(w * 0.03, secondary);
  const ax = cx + f * w * 0.34;
  const ay = uy + h * 0.42;
  const wave = Math.sin(u.bob) * w * 0.03;
  g.lineBetween(ax, ay, ax + f * w * 0.08 + wave, ay - h * 0.08);
  g.lineBetween(ax, ay, ax + f * w * 0.04 - wave, ay - h * 0.08);
};

export default draw;
