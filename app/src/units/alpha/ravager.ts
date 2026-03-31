import type { UnitDef, CombatHooks, RenderUnit, IUnit } from '../../types';
import { hexToInt, lerpColor } from '../renderUtils';

export const def: UnitDef = {
  name: 'Ravager', ico: '\u{1F41D}', hp: 160, atk: 60, spd: 2.2, range: 20, atkRate: 1.25,
  cost: 70, reward: 32, w: 22, h: 18, col: 0xc03030, dk: 0x6b1a1a,
  trait: 'berserk', desc: 'Rage SPD', route: 'air', attackRange: 'melee',
  tier: 'D', incubation: 6,
  caste: 'soldier', geneline: 'alpha',
};

export const combat: CombatHooks = {
  onUpdate(u: IUnit, dt: number) {
    // Rage: attack rate increases as HP drops
    const base = def.atkRate;
    const hpFrac = u.hp / u.maxHp;
    if (hpFrac <= 0.5) u.atkRate = base * 1.5;
    else u.atkRate = base;
    return false;
  },
};

export function draw(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);
  const dk = hexToInt(u.dk);
  const deep = 0x3d0e0e;
  const bone = 0xd4c4b0;
  const f = u.facing;
  const w = u.w;
  const h = u.h;
  const hpFrac = u.hp / u.maxHp;
  const bodyCol = hpFrac < 0.5 ? lerpColor(col, 0xff0000, 0.5) : col;

  // Hover offset — floats above ground (wasp-like)
  const hover = Math.sin(u.bob * 2.5) * h * 0.06 - h * 0.2;

  // --- Wing blur (fast vibrating) ---
  const wingFlicker = Math.sin(u.bob * 12) * h * 0.06;
  g.fillStyle(0xffffff, 0.15);
  g.fillEllipse(cx - f * w * 0.04, uy + hover + h * 0.15 + wingFlicker, w * 0.5, h * 0.18);
  g.fillEllipse(cx + f * w * 0.08, uy + hover + h * 0.2 - wingFlicker, w * 0.4, h * 0.14);

  // --- Legs (short, tucked while hovering) ---
  g.lineStyle(w * 0.03, deep);
  const lp = u.bob * 0.5;
  for (let l = 0; l < 2; l++) {
    const lx = cx + (l - 0.5) * w * 0.18;
    const ly = uy + hover + h * 0.6;
    const sw = Math.sin(lp + l) * w * 0.04;
    g.lineBetween(lx, ly, lx + sw, ly + h * 0.2);
  }

  // --- Abdomen (striped wasp pattern) ---
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.12, uy + hover + h * 0.62, w * 0.52, h * 0.6);
  g.fillStyle(dk);
  g.fillEllipse(cx - f * w * 0.12, uy + hover + h * 0.6, w * 0.48, h * 0.56);
  g.fillStyle(bodyCol);
  g.fillEllipse(cx - f * w * 0.12, uy + hover + h * 0.56, w * 0.38, h * 0.42);
  // Dark stripes
  g.fillStyle(deep, 0.5);
  g.fillRect(cx - f * w * 0.12 - w * 0.14, uy + hover + h * 0.48, w * 0.28, h * 0.04);
  g.fillRect(cx - f * w * 0.12 - w * 0.12, uy + hover + h * 0.58, w * 0.24, h * 0.04);

  // --- Stinger (bone, rear) ---
  g.lineStyle(w * 0.06, deep);
  g.lineBetween(cx - f * w * 0.34, uy + hover + h * 0.6, cx - f * w * 0.48, uy + hover + h * 0.64);
  g.lineStyle(w * 0.035, bone);
  g.lineBetween(cx - f * w * 0.34, uy + hover + h * 0.6, cx - f * w * 0.48, uy + hover + h * 0.64);

  // --- Narrow waist ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.02, uy + hover + h * 0.42, w * 0.08, h * 0.1);

  // --- Thorax ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.12, uy + hover + h * 0.34, w * 0.3, h * 0.32);
  g.fillStyle(dk);
  g.fillEllipse(cx + f * w * 0.12, uy + hover + h * 0.32, w * 0.26, h * 0.28);
  g.fillStyle(bodyCol);
  g.fillEllipse(cx + f * w * 0.12, uy + hover + h * 0.29, w * 0.18, h * 0.18);

  // --- Head ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.3, uy + hover + h * 0.24, w * 0.3, h * 0.3);
  g.fillStyle(dk);
  g.fillEllipse(cx + f * w * 0.3, uy + hover + h * 0.22, w * 0.26, h * 0.26);
  g.fillStyle(bodyCol);
  g.fillEllipse(cx + f * w * 0.3, uy + hover + h * 0.19, w * 0.2, h * 0.18);

  // --- Eye (turns red when enraged) ---
  const ex = cx + f * w * 0.36;
  const ey = uy + hover + h * 0.18;
  g.fillStyle(hpFrac < 0.5 ? 0xff2020 : 0xffffff);
  g.fillCircle(ex, ey, w * 0.045);

  // --- Mandible jaws (layered: deep → bone) ---
  const jx = cx + f * w * 0.42;
  const jy = uy + hover + h * 0.24;
  if (u.state === 'attack') {
    g.lineStyle(w * 0.07, deep);
    g.lineBetween(jx, jy - h * 0.03, jx + f * w * 0.18, jy - h * 0.14);
    g.lineBetween(jx, jy + h * 0.03, jx + f * w * 0.18, jy + h * 0.12);
    g.lineStyle(w * 0.04, bone);
    g.lineBetween(jx, jy - h * 0.03, jx + f * w * 0.18, jy - h * 0.14);
    g.lineBetween(jx, jy + h * 0.03, jx + f * w * 0.18, jy + h * 0.12);
  } else {
    g.lineStyle(w * 0.07, deep);
    g.lineBetween(jx, jy - h * 0.03, jx + f * w * 0.14, jy - h * 0.03);
    g.lineBetween(jx, jy + h * 0.03, jx + f * w * 0.14, jy + h * 0.03);
    g.lineStyle(w * 0.04, bone);
    g.lineBetween(jx, jy - h * 0.03, jx + f * w * 0.14, jy - h * 0.03);
    g.lineBetween(jx, jy + h * 0.03, jx + f * w * 0.14, jy + h * 0.03);
  }

  // --- Antennae ---
  g.lineStyle(w * 0.035, dk);
  const ax = cx + f * w * 0.26;
  const ay = uy + hover + h * 0.1;
  const wave = Math.sin(u.bob * 1.5) * w * 0.05;
  g.lineBetween(ax, ay, ax + f * w * 0.14 + wave, ay - h * 0.14);
  g.lineBetween(ax, ay, ax + f * w * 0.06 - wave, ay - h * 0.16);}
