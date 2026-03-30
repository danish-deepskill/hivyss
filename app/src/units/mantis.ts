import type { UnitDef, CombatHooks, RenderUnit, IUnit, CombatContext } from '../types';
import { hexToInt } from './renderUtils';

export const def: UnitDef = {
  name: 'Mantis', ico: '\u{1F52D}', hp: 100, atk: 120, spd: 0.5, range: 200, atkRate: 0.25,
  cost: 85, reward: 38, w: 15, h: 14, col: 0xc0a0f0, dk: 0x503080,
  trait: 'sniper', desc: 'Long Range', tier: 'C', incubation: 14, caste: 'soldier',
};

export const combat: CombatHooks = {
  onAttack(u: IUnit, target: IUnit, foes: IUnit[], dmg: number, ctx: CombatContext) {
    // Piercing shot hits up to 2 enemies, second at 50% damage
    const targets = foes.filter(e => {
      if (e.burrowed) return false;
      const d = u.facing > 0 ? (e.x - (u.x + u.unitW)) : (u.x - (e.x + e.unitW));
      return Math.max(0, d) <= u.range;
    }).sort((a, b) => {
      const da = u.facing > 0 ? a.x - u.x : u.x - a.x;
      const db = u.facing > 0 ? b.x - u.x : u.x - b.x;
      return da - db;
    }).slice(0, 2);
    targets.forEach((e, i) => ctx.hitUnit(e, i === 0 ? dmg : Math.ceil(dmg * 0.5), 'ranged'));
    ctx.playHitSound('ranged');
  },
};

export function draw(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);
  const dk = hexToInt(u.dk);

  // Slim elongated abdomen
  g.fillStyle(col);
  g.fillEllipse(cx - u.facing * 4, uy + u.h * 0.65, u.w * 0.5, u.h * 0.7);

  // Long thin thorax
  g.fillEllipse(cx + u.facing * 2, uy + u.h * 0.35, u.w * 0.35, u.h * 0.45);

  // Triangular head (praying mantis shape)
  g.fillStyle(col);
  g.beginPath();
  g.moveTo(cx + u.facing * u.w * 0.2, uy + u.h * 0.05);
  g.lineTo(cx + u.facing * u.w * 0.42, uy + u.h * 0.18);
  g.lineTo(cx + u.facing * u.w * 0.15, uy + u.h * 0.3);
  g.closePath();
  g.fillPath();

  // Big compound eyes (bulging out)
  g.fillStyle(0xffffff, 0.6);
  g.fillCircle(cx + u.facing * u.w * 0.28, uy + u.h * 0.08, 3);
  g.fillCircle(cx + u.facing * u.w * 0.28, uy + u.h * 0.25, 3);

  // Raptorial forelegs (folded sniper arms)
  g.lineStyle(2, dk);
  const armX = cx + u.facing * u.w * 0.15;
  const armY = uy + u.h * 0.3;
  g.lineBetween(armX, armY, armX + u.facing * 10, armY + 3);
  g.lineBetween(armX + u.facing * 10, armY + 3, armX + u.facing * 6, armY + 10);

  // Scope / crosshair when attacking
  if (u.state === 'attack') {
    g.lineStyle(1, 0xff4040, 0.6);
    const tx = cx + u.facing * u.w * 0.6;
    const ty = uy + u.h * 0.15;
    g.strokeCircle(tx, ty, 4);
    g.lineBetween(tx - 6, ty, tx + 6, ty);
    g.lineBetween(tx, ty - 6, tx, ty + 6);

    // Muzzle flash
    g.fillStyle(0xffee44, 0.7);
    g.fillCircle(cx + u.facing * u.w * 0.45, uy + u.h * 0.18, 3);
  }

  // Hind legs
  g.lineStyle(1, dk);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 2; l++) {
    const lx = cx + (l - 1) * u.w * 0.25;
    const ly = uy + u.h * 0.6;
    const sw = Math.sin(lp + l * 1.3) * 5;
    g.lineBetween(lx, ly, lx + u.facing * 5 + sw, ly + 8);
    g.lineBetween(lx, ly, lx - u.facing * 5 - sw, ly + 8);
  }

  // Antennae
  g.lineStyle(1, dk);
  const anx = cx + u.facing * u.w * 0.25;
  const any = uy + u.h * 0.05;
  const wave = Math.sin(u.bob) * 2;
  g.lineBetween(anx, any, anx + u.facing * 10 + wave, any - 5);
  g.lineBetween(anx, any, anx + u.facing * 5 - wave, any - 6);
}
