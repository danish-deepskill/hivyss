import type { UnitDef, CombatHooks, RenderUnit, IUnit, CombatContext } from '../types';
import { hexToInt, drawCommonParts } from './renderUtils';

export const def: UnitDef = {
  name: 'Aphid', ico: '\u{1F33F}', hp: 120, atk: 8, spd: 0.8, range: 60, atkRate: 0.6,
  cost: 50, reward: 25, w: 16, h: 15, col: 0xf060c0, dk: 0x801060,
  trait: 'healer', desc: 'Heals Allies', tier: 'D', incubation: 8, knockResist: 5, caste: 'soldier',
};

export const combat: CombatHooks = {
  onUpdate(u: IUnit, dt: number, ctx: CombatContext) {
    // Heal nearest wounded ally every 2 seconds
    u.healTimer = (u.healTimer || 0) + dt;
    if (u.healTimer >= 2) {
      u.healTimer = 0;
      const allies = ctx.allAlive.filter(a => a.side === u.side && a !== u && a.hp < a.maxHp);
      if (allies.length > 0) {
        const nearest = allies.reduce((a, b) =>
          Math.abs(a.x - u.x) < Math.abs(b.x - u.x) ? a : b
        );
        const healAmt = nearest.heal(20);
        if (healAmt > 0) {
          if (ctx.particles) ctx.particles.float(nearest.x + nearest.unitW / 2, nearest.y - 8, `+${healAmt}`, 0x60f880);
          ctx.playHitSound('heal');
        }
      }
    }
    return false; // doesn't skip normal AI
  },
};

export function draw(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);

  g.fillStyle(col);
  g.fillEllipse(cx - u.facing * 2, uy + u.h * 0.62, u.w * 0.72, u.h * 0.84);
  g.fillEllipse(cx + u.facing * 0.5, uy + u.h * 0.32, u.w * 0.56, u.h * 0.56);
  g.fillEllipse(cx + u.facing * u.w * 0.28, uy + u.h * 0.16, u.w * 0.44, u.h * 0.4);

  // Cross symbol
  g.fillStyle(0xffffff, 0.6);
  g.fillRect(cx - 1, uy + u.h * 0.54 - 4, 2, 8);
  g.fillRect(cx - 4, uy + u.h * 0.54 - 1, 8, 2);

  drawCommonParts(g, u, cx, uy);
}
