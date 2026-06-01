import Phaser from 'phaser';
import type { DrawFunction, RenderUnit } from '../../types';
import { hexToInt } from '../../units/renderUtils';

const draw: DrawFunction = (g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = u.palette!.shadow;
  const bone = u.palette!.accent;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // --- Legs (3 pairs, medium) ---
  const lp = u.state === "march" ? u.bob : 0;
  g.lineStyle(w * 0.045, deep);
  const legX = [-f * w * 0.14, f * w * 0.06, f * w * 0.22];
  const legY = [h * 0.78, h * 0.62, h * 0.5];
  const groundY = uy + h + h * 0.16;
  for (let l = 0; l < 3; l++) {
    const lx = cx + legX[l];
    const ly = uy + legY[l];
    const sw = Math.sin(lp + l * 1.2) * w * 0.04;
    g.lineBetween(lx, ly, lx - w * 0.1 - sw, groundY);
    g.lineBetween(lx, ly, lx + w * 0.1 + sw, groundY);
  }

  // --- Abdomen (elongated, tapered — needle storage) ---
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.14, uy + h * 0.66, w * 0.5, h * 0.56);
  g.fillStyle(secondary);
  g.fillEllipse(cx - f * w * 0.14, uy + h * 0.64, w * 0.46, h * 0.52);
  g.fillStyle(primary);
  g.fillEllipse(cx - f * w * 0.14, uy + h * 0.6, w * 0.36, h * 0.38);
  // Needle ridges on abdomen (stored chitin needles)
  g.lineStyle(w * 0.02, bone, 0.5);
  for (let s = 0; s < 3; s++) {
    const ny = uy + h * (0.52 + s * 0.07);
    const nx = cx - f * w * 0.14;
    g.lineBetween(nx - w * 0.1, ny, nx + w * 0.1, ny);
  }

  // --- Petiole ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.02, uy + h * 0.44, w * 0.1, h * 0.12);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.02, uy + h * 0.43, w * 0.07, h * 0.09);

  // --- Thorax (compact, angular) ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.14, uy + h * 0.36, w * 0.34, h * 0.34);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.14, uy + h * 0.34, w * 0.3, h * 0.3);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.14, uy + h * 0.31, w * 0.22, h * 0.2);

  // --- Head (small, angular) ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.32, uy + h * 0.26, w * 0.28, h * 0.28);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.32, uy + h * 0.24, w * 0.24, h * 0.24);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.32, uy + h * 0.21, w * 0.18, h * 0.17);

  // --- Eye (solid compound eye) ---
  const ex = cx + f * w * 0.37;
  const ey = uy + h * 0.2;
  g.fillStyle(0xffffff);
  g.fillCircle(ex, ey, w * 0.045);

  // --- Needle launcher (layered: deep shadow → dark bone → bone) ---
  const bx = cx + f * w * 0.42;
  const by = uy + h * 0.24;
  // Shadow layer (thickest)
  g.lineStyle(w * 0.08, deep);
  g.lineBetween(bx, by, bx + f * w * 0.38, by);
  // Main barrel
  g.lineStyle(w * 0.05, bone);
  g.lineBetween(bx, by, bx + f * w * 0.38, by);
  // Barrel tip
  g.fillStyle(bone);
  g.fillCircle(bx + f * w * 0.38, by, w * 0.03);

  // --- Attack: muzzle flash at barrel tip ---
  if (u.state === "attack") {
    g.fillStyle(0xffee44, 0.8);
    g.fillCircle(bx + f * w * 0.4, by, w * 0.05);
  }

  // --- Antennae (medium, swept back) ---
  g.lineStyle(w * 0.035, secondary);
  const ax = cx + f * w * 0.28;
  const ay = uy + h * 0.12;
  const wave = Math.sin(u.bob) * w * 0.04;
  g.lineBetween(ax, ay, ax + f * w * 0.14 + wave, ay - h * 0.14);
  g.lineBetween(ax, ay, ax + f * w * 0.06 - wave, ay - h * 0.16);
};

export default draw;
