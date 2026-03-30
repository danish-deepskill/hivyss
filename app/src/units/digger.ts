import type { UnitDef, CombatHooks, RenderUnit, IUnit, CombatContext } from '../types';
import { hexToInt, drawCommonParts } from './renderUtils';

export const def: UnitDef = {
  name: 'Digger', ico: '\u{1F573}\uFE0F', hp: 100, atk: 35, spd: 2.5, range: 20, atkRate: 1.0,
  cost: 55, reward: 20, w: 14, h: 13, col: 0xc09050, dk: 0x604020,
  trait: 'burrow', desc: 'Burrows Past', tier: 'D', incubation: 7, caste: 'soldier',
};

export const combat: CombatHooks = {
  onSpawn(u: IUnit, ctx: CombatContext) {
    u.burrowed = true;
    u.burrowTimer = 5; // max burrow time (safety cap)
  },
  onUpdate(u: IUnit, dt: number, ctx: CombatContext) {
    if (!u.burrowed) return false; // not handled, proceed normally
    u.burrowTimer -= dt;
    u.x += u.facing * u.getSpeed() * 60 * dt * 1.5;

    // Surface once past at least one enemy, or safety timer expires
    const foes = ctx.allAlive.filter(e => e.side !== u.side && !e.dead);
    const gap = 30 * ctx.S; // surface a short distance behind the enemy
    const passed = foes.some(e => (u.x - e.x) * u.facing > gap);

    if (passed || u.burrowTimer <= 0) {
      u.burrowed = false;
      u.ambush = true; // first hit deals critical damage
      if (ctx.particles) {
        ctx.particles.burst(u.x + u.unitW / 2, u.y + u.unitH / 2, u.col, 10);
        ctx.particles.float(u.x + u.unitW / 2, u.y - 14, 'SURFACE!', 0x906030);
      }
    }
    return true; // handled, skip normal AI
  },
  getAtk(u: IUnit) {
    if (u.ambush) return u.atk * 2; // ambush crit
    return u.atk;
  },
  afterHit(u: IUnit, _target: IUnit, dmg: number, ctx: CombatContext) {
    if (u.ambush) {
      u.ambush = false;
      if (ctx.particles) {
        ctx.particles.float(u.x + u.unitW / 2, u.y - 14, 'AMBUSH!', 0xff4444);
      }
    }
  },
};

export function draw(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);

  if (u.burrowed) {
    // Underground: just a dirt mound
    g.fillStyle(0x604020, 0.5);
    g.fillEllipse(cx, uy + u.h * 0.8, u.w * 0.6, u.h * 0.3);
    return;
  }

  g.fillStyle(col);
  g.fillEllipse(cx - u.facing * 2, uy + u.h * 0.62, u.w * 0.74, u.h * 0.84);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.34, u.w * 0.54, u.h * 0.54);
  g.fillEllipse(cx + u.facing * u.w * 0.28, uy + u.h * 0.18, u.w * 0.42, u.h * 0.38);

  // Dirt particles
  g.fillStyle(0x805030, 0.4);
  g.fillCircle(cx - u.facing * 4, uy + u.h * 0.8, 2);
  g.fillCircle(cx + u.facing * 2, uy + u.h * 0.85, 1.5);

  drawCommonParts(g, u, cx, uy);
}
