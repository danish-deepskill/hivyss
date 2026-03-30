import type { UnitDef, RenderUnit } from '../types';
import { hexToInt } from './renderUtils';

export const def: UnitDef = {
  name: 'Rhino', ico: '\u{1F98F}', hp: 280, atk: 45, spd: 1.0, range: 24, atkRate: 0.7,
  cost: 95, reward: 42, w: 40, h: 24, col: 0x908060, dk: 0x504030,
  trait: 'knockback', desc: 'Rams Enemies', tier: 'C', incubation: 13, caste: 'soldier',
  knockForce: 100, knockResist: 30,
};

export function draw(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);
  const dk = hexToInt(u.dk);
  const deep = 0x2a2018;
  const horn = 0xd4c4b0;
  const hornDk = 0x8a7a6a;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  const lean = u.state === 'march' ? f * w * 0.03 : 0;

  // Body tilt angle (~12 degrees, front rises)
  const angle = -f * 0.21;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const pivotX = cx + lean;
  const pivotY = uy + h * 0.55;

  function rot(px: number, py: number): [number, number] {
    const dx = px - pivotX;
    const dy = py - pivotY;
    return [pivotX + dx * cosA - dy * sinA, pivotY + dx * sinA + dy * cosA];
  }

  // Draw a rotated ellipse as a polygon (16 segments)
  function fillRotEllipse(ecx: number, ecy: number, ew: number, eh: number): void {
    const steps = 16;
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const px = ecx + Math.cos(t) * ew * 0.5;
      const py = ecy + Math.sin(t) * eh * 0.5;
      const [rx, ry] = rot(px, py);
      if (i === 0) g.moveTo(rx, ry);
      else g.lineTo(rx, ry);
    }
    g.closePath();
    g.fillPath();
  }

  // --- Legs (short, sturdy) ---
  const lp = u.state === 'march' ? u.bob : 0;
  g.lineStyle(w * 0.055, deep);
  const legX = [-f * w * 0.16, f * w * 0.0, f * w * 0.14];
  const legY = [h * 0.85, h * 0.78, h * 0.7];
  const groundY = uy + h + h * 0.12;
  for (let l = 0; l < 3; l++) {
    const [lx, ly] = rot(cx + legX[l] + lean, uy + legY[l]);
    const sw = Math.sin(lp + l * 1.1) * w * 0.03;
    g.lineBetween(lx, ly, lx - w * 0.07 - sw, groundY);
    g.lineBetween(lx, ly, lx + w * 0.07 + sw, groundY);
  }

  // --- Shell / elytra ---
  g.fillStyle(deep);
  fillRotEllipse(cx - f * w * 0.06 + lean, uy + h * 0.58, w * 0.72, h * 0.72);
  g.fillStyle(dk);
  fillRotEllipse(cx - f * w * 0.06 + lean, uy + h * 0.56, w * 0.68, h * 0.68);
  g.fillStyle(col);
  fillRotEllipse(cx - f * w * 0.06 + lean, uy + h * 0.5, w * 0.58, h * 0.5);

  // --- Pronotum (front shield) ---
  g.fillStyle(deep);
  fillRotEllipse(cx + f * w * 0.2 + lean, uy + h * 0.48, w * 0.32, h * 0.58);
  g.fillStyle(dk);
  fillRotEllipse(cx + f * w * 0.2 + lean, uy + h * 0.46, w * 0.28, h * 0.52);
  g.fillStyle(col);
  fillRotEllipse(cx + f * w * 0.2 + lean, uy + h * 0.42, w * 0.22, h * 0.38);

  // --- Head (small, tucked under) ---
  g.fillStyle(deep);
  fillRotEllipse(cx + f * w * 0.34 + lean, uy + h * 0.5, w * 0.16, h * 0.34);
  g.fillStyle(dk);
  fillRotEllipse(cx + f * w * 0.34 + lean, uy + h * 0.48, w * 0.13, h * 0.28);

  // --- Horn (thick, sturdy) ---
  const [hbX, hbY] = rot(cx + f * w * 0.36 + lean, uy + h * 0.34);
  // Wide outer shape
  g.fillStyle(hornDk);
  g.beginPath();
  g.moveTo(hbX - f * w * 0.05, hbY + h * 0.18);   // base bottom
  g.lineTo(hbX - f * w * 0.04, hbY - h * 0.02);    // base top-back
  g.lineTo(hbX + f * w * 0.02, hbY - h * 0.18);    // mid
  g.lineTo(hbX + f * w * 0.1, hbY - h * 0.34);     // tip
  g.lineTo(hbX + f * w * 0.12, hbY - h * 0.22);    // tip front edge
  g.lineTo(hbX + f * w * 0.08, hbY - h * 0.08);    // mid front
  g.lineTo(hbX + f * w * 0.04, hbY + h * 0.1);     // base front
  g.closePath();
  g.fillPath();
  // Inner highlight
  g.fillStyle(horn);
  g.beginPath();
  g.moveTo(hbX - f * w * 0.02, hbY + h * 0.1);
  g.lineTo(hbX, hbY - h * 0.04);
  g.lineTo(hbX + f * w * 0.05, hbY - h * 0.2);
  g.lineTo(hbX + f * w * 0.09, hbY - h * 0.28);
  g.lineTo(hbX + f * w * 0.1, hbY - h * 0.18);
  g.lineTo(hbX + f * w * 0.06, hbY - h * 0.04);
  g.lineTo(hbX + f * w * 0.02, hbY + h * 0.06);
  g.closePath();
  g.fillPath();

  // --- Eye (solid compound eye) ---
  const [ex, ey] = rot(cx + f * w * 0.36 + lean, uy + h * 0.46);
  g.fillStyle(0xffffff);
  g.fillCircle(ex, ey, w * 0.035);

  // --- Dust trail ---
  if (u.state === 'march') {
    const dustA = 0.1 + Math.sin(u.bob * 3) * 0.06;
    g.fillStyle(0x806040, dustA);
    g.fillCircle(cx - f * w * 0.4, uy + h * 0.9, w * 0.06 + Math.sin(u.bob * 2) * w * 0.03);
    g.fillCircle(cx - f * w * 0.48, uy + h * 0.94, w * 0.04);
  }

  // --- Impact shockwave ---
  if (u.state === 'attack') {
    g.lineStyle(w * 0.04, 0xffcc40, 0.6);
    const [ix, iy] = rot(cx + f * w * 0.5 + lean, uy + h * 0.45);
    g.beginPath();
    g.arc(ix, iy, w * 0.12, -Math.PI * 0.4, Math.PI * 0.4, false);
    g.strokePath();
  }


}
