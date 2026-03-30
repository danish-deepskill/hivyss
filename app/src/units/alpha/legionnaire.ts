import type { UnitDef, RenderUnit } from '../../types';
import { hexToInt } from '../renderUtils';

export const def: UnitDef = {
  name: 'Legionnaire', ico: '\u{1FAB2}', hp: 800, atk: 18, spd: 0.6, range: 10, atkRate: 0.5,
  cost: 85, reward: 40, w: 30, h: 22, col: 0xc03030, dk: 0x6b1a1a,
  trait: 'massive', desc: 'Massive HP', tier: 'D', incubation: 7, knockForce: 20, knockResist: 40,
  caste: 'soldier', geneline: 'alpha',
};

export function draw(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);
  const dk = hexToInt(u.dk);
  const deep = 0x3d0e0e;
  const bone = 0xd4c4b0;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // --- Legs (3 pairs, thick and sturdy) ---
  const lp = u.state === 'march' ? u.bob : 0;
  g.lineStyle(w * 0.06, deep);
  const legX = [-f * w * 0.16, f * w * 0.04, f * w * 0.2];
  const legY = [h * 0.8, h * 0.68, h * 0.56];
  const groundY = uy + h + h * 0.1;
  for (let l = 0; l < 3; l++) {
    const lx = cx + legX[l];
    const ly = uy + legY[l];
    const sw = Math.sin(lp + l * 1.1) * w * 0.04;
    g.lineBetween(lx, ly, lx - w * 0.12 - sw, groundY);
    g.lineBetween(lx, ly, lx + w * 0.12 + sw, groundY);
  }

  // --- Shell / elytra (massive dome, beetle-like) ---
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.06, uy + h * 0.56, w * 0.82, h * 0.8);
  g.fillStyle(dk);
  g.fillEllipse(cx - f * w * 0.06, uy + h * 0.54, w * 0.76, h * 0.74);
  g.fillStyle(col);
  g.fillEllipse(cx - f * w * 0.06, uy + h * 0.48, w * 0.64, h * 0.56);
  // Shell ridge (center line)
  g.fillStyle(dk, 0.5);
  g.fillRect(cx - f * w * 0.06 - w * 0.01, uy + h * 0.22, w * 0.02, h * 0.55);
  // Armor plate segments
  g.fillStyle(deep, 0.3);
  g.fillRect(cx - f * w * 0.06 - w * 0.24, uy + h * 0.42, w * 0.48, h * 0.04);
  g.fillRect(cx - f * w * 0.06 - w * 0.2, uy + h * 0.54, w * 0.4, h * 0.04);

  // --- Pronotum (front plate — wide, armored) ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.22, uy + h * 0.42, w * 0.38, h * 0.46);
  g.fillStyle(dk);
  g.fillEllipse(cx + f * w * 0.22, uy + h * 0.4, w * 0.34, h * 0.4);
  g.fillStyle(col);
  g.fillEllipse(cx + f * w * 0.22, uy + h * 0.36, w * 0.26, h * 0.28);
  // Bone accent on pronotum
  g.fillStyle(bone, 0.3);
  g.fillEllipse(cx + f * w * 0.22, uy + h * 0.32, w * 0.14, h * 0.08);

  // --- Head (small, tucked under pronotum) ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.38, uy + h * 0.42, w * 0.18, h * 0.24);
  g.fillStyle(dk);
  g.fillEllipse(cx + f * w * 0.38, uy + h * 0.4, w * 0.14, h * 0.2);

  // --- Eye (solid compound eye) ---
  g.fillStyle(0xffffff);
  g.fillCircle(cx + f * w * 0.42, uy + h * 0.38, w * 0.035);

  // --- Mandible jaws (heavy, layered) ---
  const jx = cx + f * w * 0.44;
  const jy = uy + h * 0.42;
  if (u.state === 'attack') {
    g.lineStyle(w * 0.08, deep);
    g.lineBetween(jx, jy - h * 0.03, jx + f * w * 0.16, jy - h * 0.14);
    g.lineBetween(jx, jy + h * 0.03, jx + f * w * 0.16, jy + h * 0.12);
    g.lineStyle(w * 0.05, bone);
    g.lineBetween(jx, jy - h * 0.03, jx + f * w * 0.16, jy - h * 0.14);
    g.lineBetween(jx, jy + h * 0.03, jx + f * w * 0.16, jy + h * 0.12);
  } else {
    g.lineStyle(w * 0.08, deep);
    g.lineBetween(jx, jy - h * 0.03, jx + f * w * 0.12, jy - h * 0.03);
    g.lineBetween(jx, jy + h * 0.03, jx + f * w * 0.12, jy + h * 0.03);
    g.lineStyle(w * 0.05, bone);
    g.lineBetween(jx, jy - h * 0.03, jx + f * w * 0.12, jy - h * 0.03);
    g.lineBetween(jx, jy + h * 0.03, jx + f * w * 0.12, jy + h * 0.03);
  }

  // --- Short antennae ---
  g.lineStyle(w * 0.03, dk);
  const ax = cx + f * w * 0.34;
  const ay = uy + h * 0.3;
  const wave = Math.sin(u.bob) * w * 0.03;
  g.lineBetween(ax, ay, ax + f * w * 0.08 + wave, ay - h * 0.08);
  g.lineBetween(ax, ay, ax + f * w * 0.04 - wave, ay - h * 0.1);
}
