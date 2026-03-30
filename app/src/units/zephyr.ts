import type { UnitDef, RenderUnit } from '../types';
import { hexToInt, drawCommonParts } from './renderUtils';

export const def: UnitDef = {
  name: 'Zephyr', ico: '\u{1F4A8}', hp: 40, atk: 40, spd: 3.5, range: 18, atkRate: 1.2,
  cost: 40, reward: 15, w: 13, h: 12, col: 0x80f8c0, dk: 0x208050,
  trait: 'swift', desc: 'Very Fast', tier: 'E', incubation: 3, caste: 'soldier',
};

export function draw(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);

  g.fillStyle(col);
  g.fillEllipse(cx - u.facing * 3, uy + u.h * 0.65, u.w * 0.6, u.h * 0.7);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.3, u.w * 0.44, u.h * 0.48);
  g.fillEllipse(cx + u.facing * u.w * 0.26, uy + u.h * 0.14, u.w * 0.36, u.h * 0.34);

  // Speed lines when marching
  if (u.state === 'march') {
    g.lineStyle(1, col, 0.5);
    [-4, -8, -12].forEach(ox => {
      g.lineBetween(
        cx - u.facing * ox, uy + u.h * 0.4,
        cx - u.facing * (ox + 5), uy + u.h * 0.4
      );
    });
  }

  drawCommonParts(g, u, cx, uy);
}
