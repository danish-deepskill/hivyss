import type { UnitDef, CombatHooks, RenderUnit, IUnit, CombatContext } from '../types';
import { hexToInt, drawCommonParts } from './renderUtils';

export const def: UnitDef = {
  name: 'Ember', ico: '\u{1F525}', hp: 80, atk: 40, spd: 1.85, range: 43, atkRate: 0.8,
  cost: 65, reward: 28, w: 21, h: 20, col: 0xf08020, dk: 0xa04008,
  trait: 'burn', desc: 'Burns Foes', route: 'land', attackRange: 'melee',
  tier: 'D', incubation: 8, knockForce: 10, caste: 'soldier',
};

export const combat: CombatHooks = {
  afterHit(u: IUnit, target: IUnit, dmg: number, ctx: CombatContext) {
    // Spread burn to up to 3 nearby enemies
    const foes = ctx.allAlive.filter(e =>
      e.side !== u.side && !e.dead && !e.burrowed &&
      Math.abs((e.x + e.unitW / 2) - (target.x + target.unitW / 2)) < 85
    ).sort((a, b) =>
      Math.abs(a.x - target.x) - Math.abs(b.x - target.x)
    ).slice(0, 3);
    foes.forEach(e => {
      e.burnTimer = 8;
      e.burnDmgAcc = 0;
    });
  },
};

export function draw(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);
  const dk = hexToInt(u.dk);
  const t = u.bob;

  // Heat shimmer aura (warm glow behind body)
  const glowPulse = 0.12 + Math.sin(t * 3) * 0.06;
  g.fillStyle(0xff4010, glowPulse);
  g.fillCircle(cx, uy + u.h * 0.5, u.w * 0.6);

  // Animated flame tongues rising from abdomen (layered, back to front)
  // Each flame is a teardrop shape that flickers independently
  const flames = [
    { ox: -0.15, oy: 0.35, sz: 0.9, spd: 4.2, phase: 0 },
    { ox: 0.05,  oy: 0.28, sz: 1.0, spd: 3.5, phase: 1.2 },
    { ox: -0.25, oy: 0.45, sz: 0.7, spd: 5.0, phase: 2.5 },
    { ox: 0.15,  oy: 0.32, sz: 0.8, spd: 3.8, phase: 3.8 },
    { ox: -0.05, oy: 0.5,  sz: 0.6, spd: 4.8, phase: 5.0 },
  ];
  flames.forEach(f => {
    const flicker = Math.sin(t * f.spd + f.phase);
    const rise = flicker * 3;
    const fx = cx + u.facing * u.w * f.ox;
    const fy = uy + u.h * f.oy + rise;
    const sz = (3 + flicker * 1.2) * f.sz;

    // Outer flame (red-orange)
    g.fillStyle(0xff4010, 0.5 + flicker * 0.15);
    g.beginPath();
    g.moveTo(fx, fy - sz * 2.2);
    g.lineTo(fx - sz * 0.7, fy + sz * 0.3);
    g.lineTo(fx + sz * 0.7, fy + sz * 0.3);
    g.closePath();
    g.fillPath();

    // Inner flame (bright yellow-white core)
    g.fillStyle(0xffdd30, 0.6 + flicker * 0.2);
    g.beginPath();
    g.moveTo(fx, fy - sz * 1.3);
    g.lineTo(fx - sz * 0.35, fy + sz * 0.15);
    g.lineTo(fx + sz * 0.35, fy + sz * 0.15);
    g.closePath();
    g.fillPath();
  });

  // Dark charred body underneath flames
  g.fillStyle(dk);
  g.fillEllipse(cx - u.facing * 2, uy + u.h * 0.64, u.w * 0.7, u.h * 0.78);
  // Magma cracks on abdomen
  g.lineStyle(1, 0xff6020, 0.6);
  g.lineBetween(cx - u.facing * 4, uy + u.h * 0.5, cx - u.facing * 1, uy + u.h * 0.7);
  g.lineBetween(cx - u.facing * 1, uy + u.h * 0.7, cx + u.facing * 2, uy + u.h * 0.55);
  g.lineStyle(1, 0xffaa20, 0.4);
  g.lineBetween(cx - u.facing * 2, uy + u.h * 0.58, cx + u.facing * 1, uy + u.h * 0.75);

  // Thorax (smoldering)
  g.fillStyle(col);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.34, u.w * 0.5, u.h * 0.5);

  // Head with glowing eyes
  g.fillStyle(col);
  g.fillEllipse(cx + u.facing * u.w * 0.28, uy + u.h * 0.18, u.w * 0.4, u.h * 0.36);
  // Fiery eyes
  const eyeGlow = 0.7 + Math.sin(t * 6) * 0.3;
  g.fillStyle(0xffee40, eyeGlow);
  g.fillCircle(cx + u.facing * u.w * 0.32, uy + u.h * 0.14, 2);
  g.fillStyle(0xff4020, eyeGlow * 0.8);
  g.fillCircle(cx + u.facing * u.w * 0.32, uy + u.h * 0.14, 1);

  // Floating ember sparks (small particles drifting upward)
  g.fillStyle(0xffaa20, 0.6);
  const sp1x = cx + Math.sin(t * 2.3) * 6;
  const sp1y = uy + u.h * 0.1 + Math.cos(t * 1.8) * 4;
  g.fillCircle(sp1x, sp1y, 1.2);
  g.fillStyle(0xff6020, 0.5);
  const sp2x = cx + Math.cos(t * 3.1) * 8;
  const sp2y = uy - 2 + Math.sin(t * 2.5) * 3;
  g.fillCircle(sp2x, sp2y, 0.8);
  g.fillStyle(0xffdd40, 0.4);
  const sp3x = cx + Math.sin(t * 1.7 + 2) * 5;
  const sp3y = uy + u.h * 0.05 + Math.cos(t * 3.3) * 4;
  g.fillCircle(sp3x, sp3y, 1);

  // Fire breath when attacking
  if (u.state === 'attack') {
    const bx = cx + u.facing * u.w * 0.4;
    const by = uy + u.h * 0.2;
    // Outer fire cone
    g.fillStyle(0xff4010, 0.5);
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx + u.facing * 14, by - 5);
    g.lineTo(bx + u.facing * 16, by + 2);
    g.lineTo(bx + u.facing * 14, by + 7);
    g.closePath();
    g.fillPath();
    // Inner bright core
    g.fillStyle(0xffcc30, 0.6);
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx + u.facing * 10, by - 2);
    g.lineTo(bx + u.facing * 10, by + 4);
    g.closePath();
    g.fillPath();
    // Muzzle flash
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(bx + u.facing * 2, by + 1, 2.5);
  }

  drawCommonParts(g, u, cx, uy);
}
