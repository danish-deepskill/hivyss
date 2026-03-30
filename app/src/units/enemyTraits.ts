// Draw functions and combat hooks for enemy-only traits (bosses, etc.)
import type { CombatHooks, RenderUnit, IUnit, CombatContext } from '../types';
import { hexToInt, drawCommonParts } from './renderUtils';

// --- Combat hooks for enemy-only traits ---

export const bossCombat: CombatHooks = {}; // no special combat, just big

export const bossSummonCombat: CombatHooks = {
  onUpdate(u: IUnit, dt: number, ctx: CombatContext) {
    u.summonTimer = (u.summonTimer || 0) + dt;
    if (u.summonTimer >= 8) {
      u.summonTimer = 0;
      ctx.events.emit('unitSpawned', { key: 'emandible', side: 'enemy' });
      ctx.events.emit('unitSpawned', { key: 'emandible', side: 'enemy' });
      if (ctx.particles) {
        ctx.particles.float(u.x + u.unitW / 2, u.y - 14, 'SUMMON!', 0xf06060);
      }
    }
    return false;
  },
};

export const bossRegenCombat: CombatHooks = {
  onUpdate(u: IUnit, dt: number, ctx: CombatContext) {
    u.regenTimer = (u.regenTimer || 0) + dt;
    if (u.regenTimer >= 1) {
      u.regenTimer = 0;
      const healed = u.heal(20);
      if (healed > 0 && ctx.particles) {
        ctx.particles.float(u.x + u.unitW / 2, u.y - 8, `+${healed}`, 0x80f860);
      }
    }
    return false;
  },
};

export const shieldCombat: CombatHooks = {
  modifyDamage(u: IUnit, dmg: number, _ctx: CombatContext) {
    if (u.shieldAbsorbTimer === undefined) u.shieldAbsorbTimer = 3;
    if (u.shieldAbsorbTimer > 0) return Math.ceil(dmg * 0.5);
    return dmg;
  },
};

export const poisonCombat: CombatHooks = {
  afterHit(_u: IUnit, target: IUnit, _dmg: number, _ctx: CombatContext) {
    target.poisonTimer = 3;
    target.poisonDmgAcc = 0;
  },
};

// --- Draw functions ---

export function drawBoss(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);

  g.fillStyle(col);
  g.fillEllipse(cx - u.facing * 4, uy + u.h * 0.65, u.w * 0.9, u.h * 0.9);
  g.fillEllipse(cx, uy + u.h * 0.35, u.w * 0.64, u.h * 0.64);
  g.fillEllipse(cx + u.facing * u.w * 0.3, uy + u.h * 0.18, u.w * 0.5, u.h * 0.44);

  // Crown
  g.fillStyle(0xf0d040);
  const hx2 = cx + u.facing * u.w * 0.3;
  const hy2 = uy + u.h * 0.05;
  [-3, 0, 3].forEach(ox => {
    g.fillRect(hx2 + ox * u.facing - 2, hy2 - 8, 4, 7);
  });
  g.fillRect(hx2 - 5, hy2 - 4, 10, 5);

  drawCommonParts(g, u, cx, uy);
}

export function drawShield(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);
  const dk = hexToInt(u.dk);

  g.fillStyle(col);
  g.fillEllipse(cx - u.facing * 2, uy + u.h * 0.62, u.w * 0.8, u.h * 0.88);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.34, u.w * 0.6, u.h * 0.58);
  g.fillEllipse(cx + u.facing * u.w * 0.28, uy + u.h * 0.18, u.w * 0.46, u.h * 0.4);

  // Shield plate on front
  g.fillStyle(dk, 0.8);
  g.fillEllipse(cx + u.facing * u.w * 0.45, uy + u.h * 0.45, u.w * 0.2, u.h * 0.55);
  g.lineStyle(1.5, 0xffffff, 0.3);
  g.strokeEllipse(cx + u.facing * u.w * 0.45, uy + u.h * 0.45, u.w * 0.2, u.h * 0.55);

  drawCommonParts(g, u, cx, uy);
}

export function drawPoison(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);

  g.fillStyle(col);
  g.fillEllipse(cx - u.facing * 2, uy + u.h * 0.62, u.w * 0.6, u.h * 0.84);
  g.fillEllipse(cx + u.facing * 0.5, uy + u.h * 0.32, u.w * 0.48, u.h * 0.52);
  g.fillEllipse(cx + u.facing * u.w * 0.27, uy + u.h * 0.16, u.w * 0.4, u.h * 0.36);

  // Dripping mandibles
  g.fillStyle(0x80ff40, 0.7);
  g.fillCircle(cx + u.facing * u.w * 0.42, uy + u.h * 0.25, 2);
  g.fillCircle(cx + u.facing * u.w * 0.38, uy + u.h * 0.35, 1.5);

  // Spit barrel
  g.lineStyle(2, hexToInt(u.dk));
  g.lineBetween(
    cx + u.facing * u.w * 0.36, uy + u.h * 0.2,
    cx + u.facing * (u.w * 0.36 + 12), uy + u.h * 0.2
  );

  drawCommonParts(g, u, cx, uy);
}
