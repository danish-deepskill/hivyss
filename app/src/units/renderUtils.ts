// Shared rendering utilities for bug drawing functions
import type { RenderUnit } from '../types';

// Alpha geneline palette constants
export const ALPHA = {
  col: 0xc03030,     // primary red
  dk: 0x6b1a1a,      // dark red
  shadow: 0x3d0e0e,  // deep shadow
  bone: 0xd4c4b0,    // pale bone/chitin accent
  darkBone: 0x8a7a6a, // dark bone
  eye: 0x220000,      // pupil
} as const;

export function hexToInt(hex: number | string): number {
  return typeof hex === 'number' ? hex : parseInt((hex as string).replace('#', ''), 16);
}

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const rr = (ar + t * (br - ar)) | 0;
  const rg = (ag + t * (bg - ag)) | 0;
  const rb = (ab + t * (bb - ab)) | 0;
  return (rr << 16) | (rg << 8) | rb;
}

// Draw Kurzgesagt-style jointed legs (3 pairs, 2-segment, sturdy)
export function drawLegs(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const dk = hexToInt(u.dk);
  const lp = u.state === 'march' ? u.bob : 0;
  g.lineStyle(2, dk);
  const legX = [-u.facing * 5, u.facing * 3, u.facing * 9];
  const legY = [u.h * 0.76, u.h * 0.54, u.h * 0.42];
  for (let l = 0; l < 3; l++) {
    const lx = cx + legX[l];
    const ly = uy + legY[l];
    const sw = Math.sin(lp + l * 1.2) * 3;
    const groundY = uy + u.h + 5;
    g.lineBetween(lx, ly, lx - 9 - sw, groundY);
    g.lineBetween(lx, ly, lx + 9 + sw, groundY);
  }
}

// Draw bone-colored mandible jaws (Kurzgesagt style)
export function drawMandibles(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const jx = cx + u.facing * u.w * 0.46;
  const jy = uy + u.h * 0.24;
  g.lineStyle(2.5, ALPHA.darkBone);
  if (u.state === 'attack') {
    g.beginPath(); g.moveTo(jx, jy - 1); g.lineTo(jx + u.facing * 12, jy - 8); g.strokePath();
    g.beginPath(); g.moveTo(jx, jy + 1); g.lineTo(jx + u.facing * 12, jy + 7); g.strokePath();
    g.fillStyle(ALPHA.bone, 0.8);
    g.fillCircle(jx + u.facing * 12, jy - 8, 1.8);
    g.fillCircle(jx + u.facing * 12, jy + 7, 1.8);
  } else {
    g.beginPath(); g.moveTo(jx, jy - 2); g.lineTo(jx + u.facing * 10, jy - 3); g.lineTo(jx + u.facing * 9, jy); g.strokePath();
    g.beginPath(); g.moveTo(jx, jy + 2); g.lineTo(jx + u.facing * 10, jy + 3); g.lineTo(jx + u.facing * 9, jy); g.strokePath();
  }
}

// Draw short stiff antennae (military style)
export function drawAntennae(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const dk = hexToInt(u.dk);
  g.lineStyle(1.5, dk);
  const ax = cx + u.facing * u.w * 0.3;
  const ay = uy + u.h * 0.08;
  const wave = Math.sin(u.bob) * 2;
  g.lineBetween(ax, ay, ax + u.facing * 8 + wave, ay - 6);
  g.lineBetween(ax, ay, ax + u.facing * 3 - wave, ay - 6);
}

// Draw small intense eyes (bone sclera + dark pupil)
export function drawEyes(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number, size?: number): void {
  const sz = size || 2;
  const ex = cx + u.facing * u.w * 0.39;
  const ey = uy + u.h * 0.18;
  g.fillStyle(ALPHA.bone, 0.9);
  g.fillCircle(ex, ey, sz);
  g.fillStyle(ALPHA.eye);
  g.fillCircle(ex + u.facing * 0.5, ey, sz * 0.5);
}

// Draw standard 3-segment insect body (shadow → dk → col layers)
export function drawBody(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);
  const dk = hexToInt(u.dk);
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // --- Abdomen (armored) ---
  g.fillStyle(dk);
  g.fillEllipse(cx - f * 4, uy + h * 0.64, w * 0.58, h * 0.62);
  g.fillStyle(col);
  g.fillEllipse(cx - f * 4, uy + h * 0.6, w * 0.5, h * 0.48);
  // Segment ridges
  g.lineStyle(1, dk, 0.6);
  for (let s = 0; s < 3; s++) {
    const sy = uy + h * (0.5 + s * 0.08);
    const sx = cx - f * 4;
    g.lineBetween(sx - w * 0.15, sy, sx + w * 0.15, sy);
  }

  // --- Petiole (waist) ---
  g.fillStyle(dk);
  g.fillEllipse(cx + f * 1, uy + h * 0.42, w * 0.12, h * 0.14);

  // --- Thorax (armored plate) ---
  g.fillStyle(dk);
  g.fillEllipse(cx + f * 5, uy + h * 0.34, w * 0.4, h * 0.38);
  g.fillStyle(col);
  g.fillEllipse(cx + f * 5, uy + h * 0.32, w * 0.34, h * 0.28);
  // Bone armor ridge
  g.fillStyle(ALPHA.bone, 0.4);
  g.fillEllipse(cx + f * 5, uy + h * 0.28, w * 0.2, h * 0.08);

  // --- Head (angular, armored) ---
  g.fillStyle(dk);
  g.fillEllipse(cx + f * w * 0.34, uy + h * 0.22, w * 0.36, h * 0.34);
  g.fillStyle(col);
  g.fillEllipse(cx + f * w * 0.34, uy + h * 0.2, w * 0.3, h * 0.26);
  // Bone plate on forehead
  g.fillStyle(ALPHA.bone, 0.35);
  g.fillEllipse(cx + f * w * 0.32, uy + h * 0.15, w * 0.14, h * 0.08);
}

// Draw common bug parts: mandibles, antennae, legs (original style — used by existing units)
export function drawCommonParts(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const dk = hexToInt(u.dk);

  // Mandibles
  g.lineStyle(1.5, dk);
  const mhx = cx + u.facing * (u.w * 0.42);
  const mhy = uy + u.h * 0.15;
  if (u.state === 'attack') {
    g.lineBetween(mhx, mhy, mhx + u.facing * 5, mhy - 5);
    g.lineBetween(mhx, mhy, mhx + u.facing * 5, mhy + 4);
  } else {
    g.lineBetween(mhx, mhy, mhx + u.facing * 4, mhy - 2);
    g.lineBetween(mhx, mhy, mhx + u.facing * 4, mhy + 2);
  }

  // Antennae
  g.lineStyle(1, dk);
  const ax = cx + u.facing * u.w * 0.25;
  const ay = uy + u.h * 0.1;
  const wave = Math.sin(u.bob) * 3;
  g.lineBetween(ax, ay, ax + u.facing * 8 + wave, ay - 7);
  g.lineBetween(ax, ay, ax + u.facing * 3 - wave, ay - 7);

  // Legs
  g.lineStyle(1, dk);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 3; l++) {
    const lx = cx + (l - 1) * u.w * 0.2;
    const ly = uy + u.h * 0.55;
    const sw = Math.sin(lp + l * 1.1) * 5;
    g.lineBetween(lx, ly, lx + u.facing * 6 + sw, ly + 8);
    g.lineBetween(lx, ly, lx - u.facing * 6 - sw, ly + 8);
  }
}

// Fallback draw for unmapped traits
export function drawBasicBody(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);
  g.fillStyle(col);
  g.fillEllipse(cx - u.facing * 2, uy + u.h * 0.62, u.w * 0.74, u.h * 0.84);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.34, u.w * 0.54, u.h * 0.54);
  g.fillEllipse(cx + u.facing * u.w * 0.28, uy + u.h * 0.18, u.w * 0.42, u.h * 0.38);
  drawCommonParts(g, u, cx, uy);
}
