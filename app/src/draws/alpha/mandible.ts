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

  // --- Legs (line-based, animated) ---
  const lp = u.state === "march" ? u.bob : 0;
  g.lineStyle(w * 0.055, deep);
  const legX = [-f * w * 0.17, f * w * 0.1, f * w * 0.3];
  const legY = [h * 0.76, h * 0.54, h * 0.42];
  const groundY = uy + h + h * 0.19;
  for (let l = 0; l < 3; l++) {
    const lx = cx + legX[l];
    const ly = uy + legY[l];
    const sw = Math.sin(lp + l * 1.2) * w * 0.06;
    g.lineBetween(lx, ly, lx - w * 0.12 - sw, groundY);
    g.lineBetween(lx, ly, lx + w * 0.12 + sw, groundY);
  }

  // --- Abdomen (layered: shadow → dark → main) ---
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.13, uy + h * 0.66, w * 0.62, h * 0.66);
  g.fillStyle(secondary);
  g.fillEllipse(cx - f * w * 0.13, uy + h * 0.64, w * 0.58, h * 0.62);
  g.fillStyle(primary);
  g.fillEllipse(cx - f * w * 0.13, uy + h * 0.58, w * 0.48, h * 0.42);
  // Segment ridges
  g.fillStyle(secondary, 0.5);
  for (let s = 0; s < 3; s++) {
    g.fillRect(
      cx - f * w * 0.13 - w * 0.14,
      uy + h * (0.49 + s * 0.08),
      w * 0.28,
      h * 0.05,
    );
  }

  // --- Petiole ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.03, uy + h * 0.42, w * 0.13, h * 0.15);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.03, uy + h * 0.41, w * 0.1, h * 0.12);

  // --- Thorax (layered depth) ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.17, uy + h * 0.36, w * 0.42, h * 0.4);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.17, uy + h * 0.34, w * 0.38, h * 0.36);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.17, uy + h * 0.3, w * 0.3, h * 0.24);

  // --- Head (layered depth) ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.34, uy + h * 0.24, w * 0.38, h * 0.36);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.34, uy + h * 0.22, w * 0.34, h * 0.32);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.34, uy + h * 0.18, w * 0.28, h * 0.22);

  // --- Eye (solid compound eye) ---
  const ex = cx + f * w * 0.39;
  const ey = uy + h * 0.18;
  g.fillStyle(0xffffff);
  g.fillCircle(ex, ey, w * 0.05);

  // --- Mandible jaws (layered: deep shadow → bone) ---
  const jx = cx + f * w * 0.46;
  const jy = uy + h * 0.24;
  if (u.state === "attack") {
    g.lineStyle(w * 0.1, deep);
    g.beginPath(); g.moveTo(jx, jy - h * 0.04); g.lineTo(jx + f * w * 0.28, jy - h * 0.22); g.strokePath();
    g.beginPath(); g.moveTo(jx, jy + h * 0.04); g.lineTo(jx + f * w * 0.28, jy + h * 0.2); g.strokePath();
    g.lineStyle(w * 0.07, bone);
    g.beginPath(); g.moveTo(jx, jy - h * 0.04); g.lineTo(jx + f * w * 0.28, jy - h * 0.22); g.strokePath();
    g.beginPath(); g.moveTo(jx, jy + h * 0.04); g.lineTo(jx + f * w * 0.28, jy + h * 0.2); g.strokePath();
    g.fillStyle(bone);
    g.fillCircle(jx + f * w * 0.28, jy - h * 0.22, w * 0.05);
    g.fillCircle(jx + f * w * 0.28, jy + h * 0.2, w * 0.05);
  } else {
    g.lineStyle(w * 0.1, deep);
    g.beginPath(); g.moveTo(jx, jy - h * 0.06); g.lineTo(jx + f * w * 0.24, jy - h * 0.08); g.lineTo(jx + f * w * 0.22, jy); g.strokePath();
    g.beginPath(); g.moveTo(jx, jy + h * 0.06); g.lineTo(jx + f * w * 0.24, jy + h * 0.08); g.lineTo(jx + f * w * 0.22, jy); g.strokePath();
    g.lineStyle(w * 0.07, bone);
    g.beginPath(); g.moveTo(jx, jy - h * 0.06); g.lineTo(jx + f * w * 0.24, jy - h * 0.08); g.lineTo(jx + f * w * 0.22, jy); g.strokePath();
    g.beginPath(); g.moveTo(jx, jy + h * 0.06); g.lineTo(jx + f * w * 0.24, jy + h * 0.08); g.lineTo(jx + f * w * 0.22, jy); g.strokePath();
  }

  // --- Antennae (line-based, animated) ---
  g.lineStyle(w * 0.05, secondary);
  const ax = cx + f * w * 0.3;
  const ay = uy + h * 0.08;
  const wave = Math.sin(u.bob) * w * 0.07;
  const midX1 = ax + f * w * 0.2;
  const midY1 = ay - h * 0.19;
  g.lineBetween(ax, ay, midX1, midY1);
  g.lineBetween(midX1, midY1, midX1 + f * w * 0.17 + wave, midY1 - h * 0.19);
  const midX2 = ax + f * w * 0.07;
  const midY2 = ay - h * 0.19;
  g.lineBetween(ax, ay, midX2, midY2);
  g.lineBetween(midX2, midY2, midX2 - f * w * 0.03 - wave, midY2 - h * 0.19);
};

export default draw;
