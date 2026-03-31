import type { UnitDef, CombatHooks, RenderUnit, IUnit, CombatContext } from '../types';
import { hexToInt, drawCommonParts } from './renderUtils';

export const def: UnitDef = {
  name: 'Voltfly', ico: '\u{26A1}', hp: 240, atk: 55, spd: 1.56, range: 128, atkRate: 0.6,
  cost: 130, reward: 50, w: 24, h: 21, col: 0x40c0f0, dk: 0x1060a0,
  trait: 'lightning', desc: 'Chain Lightning', route: 'land', attackRange: 'ranged',
  tier: 'B', incubation: 18, knockForce: 20, knockResist: 10, caste: 'elite',
};

export const combat: CombatHooks = {
  onAttack(u: IUnit, target: IUnit, foes: IUnit[], dmg: number, ctx: CombatContext) {
    // Chain lightning: hit primary + up to 2 nearby foes
    u.hitCount = (u.hitCount || 0) + 1;
    const isOvercharge = u.hitCount % 4 === 0;
    const chainDmg = isOvercharge ? dmg * 2 : dmg;
    const chainTargets = [target];

    const chainRange = 114;
    const others = foes.filter(e =>
      e !== target && !e.burrowed && !e.dead &&
      Math.abs(e.x - target.x) <= chainRange
    ).sort((a, b) =>
      Math.abs(a.x - target.x) - Math.abs(b.x - target.x)
    );
    if (others[0]) chainTargets.push(others[0]);
    if (others[1]) chainTargets.push(others[1]);

    const dmgScale = [1.0, 0.7, 0.4];
    chainTargets.forEach((t, i) => {
      const d = Math.max(1, Math.round(chainDmg * dmgScale[i]));
      ctx.hitUnit(t, d, 'ranged');
      // 25% stun per target
      if (!t.dead && Math.random() < 0.25) {
        t.stunTimer = 0.6;
        if (ctx.particles) ctx.particles.float(t.x + t.unitW / 2, t.y - 18, 'STUNNED!', 0x80ffff);
      }
      // Chain arc particles
      if (i > 0 && ctx.particles) {
        const prev = chainTargets[i - 1];
        ctx.particles.burst(
          (prev.x + t.x) / 2 + (prev.unitW + t.unitW) / 4,
          (prev.y + t.y) / 2, 0x80ffff, 3
        );
      }
    });
    if (isOvercharge && ctx.particles) {
      ctx.particles.float(u.x + u.unitW / 2, u.y - 18, 'OVERCHARGE!', 0xffff40);
    }
    ctx.playHitSound('aoe');
  },
};

export function draw(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);
  const dk = hexToInt(u.dk);

  // Glowing abdomen (firefly light bulb)
  const glowPulse = 0.4 + Math.sin(u.bob * 2) * 0.3;
  g.fillStyle(0x80ffff, glowPulse);
  g.fillCircle(cx - u.facing * 4, uy + u.h * 0.62, u.w * 0.32);

  // Abdomen (translucent electric)
  g.fillStyle(col);
  g.fillEllipse(cx - u.facing * 3, uy + u.h * 0.6, u.w * 0.68, u.h * 0.78);

  // Thorax
  g.fillStyle(dk);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.32, u.w * 0.48, u.h * 0.5);

  // Head
  g.fillStyle(col);
  g.fillEllipse(cx + u.facing * u.w * 0.28, uy + u.h * 0.16, u.w * 0.4, u.h * 0.36);

  // Wings (dragonfly-like, translucent)
  g.fillStyle(0x80e0ff, 0.25);
  g.fillEllipse(cx - u.facing * 1, uy + u.h * 0.05, u.w * 0.5, u.h * 0.2);
  g.fillEllipse(cx + u.facing * 2, uy + u.h * 0.1, u.w * 0.4, u.h * 0.15);

  // Lightning bolt symbol on thorax
  g.fillStyle(0xffee40, 0.7);
  const bx = cx + u.facing * 1;
  const by = uy + u.h * 0.26;
  g.beginPath();
  g.moveTo(bx - 2, by - 4);
  g.lineTo(bx + 2, by - 1);
  g.lineTo(bx - 1, by);
  g.lineTo(bx + 2, by + 4);
  g.lineTo(bx - 2, by + 1);
  g.lineTo(bx + 1, by);
  g.closePath();
  g.fillPath();

  // Electric sparks when attacking
  if (u.state === 'attack') {
    g.lineStyle(1.5, 0x80ffff, 0.8);
    const sx = cx + u.facing * u.w * 0.45;
    const sy = uy + u.h * 0.2;
    // Zig-zag lightning bolt projectile
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + u.facing * 8, sy - 4);
    g.lineTo(sx + u.facing * 14, sy + 3);
    g.lineTo(sx + u.facing * 20, sy - 2);
    g.strokePath();

    // Overcharge glow (every 4th hit)
    if (u.hitCount && u.hitCount % 4 === 3) {
      g.fillStyle(0xffff60, 0.4);
      g.fillCircle(cx, uy + u.h * 0.4, u.w * 0.55);
    }
  }

  // Ambient static particles
  g.fillStyle(0xffff80, 0.5);
  const sp1 = Math.sin(u.bob * 3) * 6;
  const sp2 = Math.cos(u.bob * 2.5) * 5;
  g.fillCircle(cx + sp1, uy + u.h * 0.3 + sp2, 1);
  g.fillCircle(cx - sp2, uy + u.h * 0.7 + sp1, 1);

  drawCommonParts(g, u, cx, uy);
}
