import type { UnitDef, CombatHooks, RenderUnit, IUnit, CombatContext } from '../../types';
import { hexToInt } from '../renderUtils';

export const def: UnitDef = {
  name: 'Centurion', ico: '\u{2694}\uFE0F', hp: 250, atk: 26, spd: 0.9, range: 24, atkRate: 0.8,
  cost: 100, reward: 48, w: 26, h: 22, col: 0xc03030, dk: 0x6b1a1a,
  trait: 'rally', desc: '+20% Ally ATK', tier: 'C', incubation: 8, knockResist: 15,
  caste: 'soldier', geneline: 'alpha',
};

const AURA_RANGE = 80;

export const combat: CombatHooks = {
  onUpdate(u: IUnit, dt: number, ctx: CombatContext) {
    // Rally aura: up to 5 nearest allies within range get +20% ATK
    const allies = ctx.allAlive.filter(a =>
      a.side === u.side && a !== u && !a.dead &&
      Math.abs((a.x + a.unitW / 2) - (u.x + u.unitW / 2)) < AURA_RANGE * ctx.S
    ).sort((a, b) =>
      Math.abs(a.x - u.x) - Math.abs(b.x - u.x)
    ).slice(0, 5);

    for (const a of allies) {
      if (!(a as any)._rallied) {
        (a as any)._baseAtk = (a as any)._baseAtk ?? a.atk;
        a.atk = Math.round((a as any)._baseAtk * 1.2);
        (a as any)._rallied = true;
      }
    }
    // Store buff count so draw can show chevrons
    (u as any).rallyCount = allies.length;
    return false;
  },
  onDeath(u: IUnit, ctx: CombatContext) {
    // Remove rally buff from all allies when centurion dies
    for (const a of ctx.allAlive) {
      if (a.side === u.side && (a as any)._rallied) {
        a.atk = (a as any)._baseAtk ?? a.atk;
        (a as any)._rallied = false;
      }
    }
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

  // --- Legs (3 pairs, armored — deep shadow + bone plate) ---
  const lp = u.state === 'march' ? u.bob : 0;
  const legX = [-f * w * 0.16, f * w * 0.08, f * w * 0.26];
  const legY = [h * 0.76, h * 0.58, h * 0.46];
  const groundY = uy + h + h * 0.15;
  for (let l = 0; l < 3; l++) {
    const lx = cx + legX[l];
    const ly = uy + legY[l];
    const sw = Math.sin(lp + l * 1.2) * w * 0.04;
    const lFootX = lx - w * 0.1 - sw;
    const rFootX = lx + w * 0.1 + sw;
    // Shadow layer (thick)
    g.lineStyle(w * 0.07, deep);
    g.lineBetween(lx, ly, lFootX, groundY);
    g.lineBetween(lx, ly, rFootX, groundY);
    // Bone armor plate on upper leg
    g.lineStyle(w * 0.04, bone, 0.5);
    const midLY = ly + (groundY - ly) * 0.4;
    g.lineBetween(lx, ly, lx - w * 0.04 - sw * 0.4, midLY);
    g.lineBetween(lx, ly, lx + w * 0.04 + sw * 0.4, midLY);
  }

  // --- Abdomen (layered) ---
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.12, uy + h * 0.64, w * 0.56, h * 0.6);
  g.fillStyle(dk);
  g.fillEllipse(cx - f * w * 0.12, uy + h * 0.62, w * 0.52, h * 0.56);
  g.fillStyle(col);
  g.fillEllipse(cx - f * w * 0.12, uy + h * 0.58, w * 0.42, h * 0.42);
  // Segment ridges
  g.fillStyle(dk, 0.5);
  for (let s = 0; s < 2; s++) {
    g.fillRect(cx - f * w * 0.12 - w * 0.12, uy + h * (0.5 + s * 0.08), w * 0.24, h * 0.04);
  }

  // --- Petiole ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.02, uy + h * 0.42, w * 0.1, h * 0.12);
  g.fillStyle(dk);
  g.fillEllipse(cx + f * w * 0.02, uy + h * 0.41, w * 0.07, h * 0.09);

  // --- Thorax (layered, with bone crest) ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.16, uy + h * 0.34, w * 0.4, h * 0.38);
  g.fillStyle(dk);
  g.fillEllipse(cx + f * w * 0.16, uy + h * 0.32, w * 0.36, h * 0.34);
  g.fillStyle(col);
  g.fillEllipse(cx + f * w * 0.16, uy + h * 0.28, w * 0.28, h * 0.22);
  // Gold crest on thorax (commander insignia)
  g.fillStyle(bone, 0.6);
  g.fillEllipse(cx + f * w * 0.16, uy + h * 0.24, w * 0.12, h * 0.08);

  // --- Head (layered) ---
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.34, uy + h * 0.24, w * 0.34, h * 0.32);
  g.fillStyle(dk);
  g.fillEllipse(cx + f * w * 0.34, uy + h * 0.22, w * 0.3, h * 0.28);
  g.fillStyle(col);
  g.fillEllipse(cx + f * w * 0.34, uy + h * 0.19, w * 0.24, h * 0.2);

  // --- Crest / plume (bone, on top of head — centurion signature) ---
  g.fillStyle(bone, 0.8);
  g.beginPath();
  const crX = cx + f * w * 0.3;
  const crY = uy + h * 0.06;
  const crWave = Math.sin(u.bob * 1.5) * w * 0.02;
  g.moveTo(crX - w * 0.06, crY + h * 0.12);
  g.lineTo(crX - w * 0.02 + crWave, crY);
  g.lineTo(crX + w * 0.04, crY + h * 0.02);
  g.lineTo(crX + w * 0.1 + crWave, crY - h * 0.02);
  g.lineTo(crX + w * 0.08, crY + h * 0.1);
  g.closePath();
  g.fillPath();
  // Plume shadow
  g.fillStyle(0x8a6a10, 0.5);
  g.beginPath();
  g.moveTo(crX - w * 0.04, crY + h * 0.12);
  g.lineTo(crX, crY + h * 0.04);
  g.lineTo(crX + w * 0.06, crY + h * 0.06);
  g.lineTo(crX + w * 0.04, crY + h * 0.12);
  g.closePath();
  g.fillPath();

  // --- Eye (solid compound eye) ---
  g.fillStyle(0xffffff);
  g.fillCircle(cx + f * w * 0.4, uy + h * 0.18, w * 0.045);

  // --- Mandible jaws (layered: deep → bone) ---
  const jx = cx + f * w * 0.46;
  const jy = uy + h * 0.24;
  if (u.state === 'attack') {
    g.lineStyle(w * 0.08, deep);
    g.lineBetween(jx, jy - h * 0.04, jx + f * w * 0.2, jy - h * 0.16);
    g.lineBetween(jx, jy + h * 0.04, jx + f * w * 0.2, jy + h * 0.14);
    g.lineStyle(w * 0.05, bone);
    g.lineBetween(jx, jy - h * 0.04, jx + f * w * 0.2, jy - h * 0.16);
    g.lineBetween(jx, jy + h * 0.04, jx + f * w * 0.2, jy + h * 0.14);
  } else {
    g.lineStyle(w * 0.08, deep);
    g.lineBetween(jx, jy - h * 0.04, jx + f * w * 0.16, jy - h * 0.05);
    g.lineBetween(jx, jy + h * 0.04, jx + f * w * 0.16, jy + h * 0.05);
    g.lineStyle(w * 0.05, bone);
    g.lineBetween(jx, jy - h * 0.04, jx + f * w * 0.16, jy - h * 0.05);
    g.lineBetween(jx, jy + h * 0.04, jx + f * w * 0.16, jy + h * 0.05);
  }

  // --- Antennae (medium, military) ---
  g.lineStyle(w * 0.04, dk);
  const ax = cx + f * w * 0.3;
  const ay = uy + h * 0.08;
  const wave = Math.sin(u.bob) * w * 0.04;
  g.lineBetween(ax, ay, ax + f * w * 0.12 + wave, ay - h * 0.12);
  g.lineBetween(ax, ay, ax + f * w * 0.05 - wave, ay - h * 0.14);

  // --- Floating chevrons (rising ▲ — commander signature) ---
  for (let i = 0; i < 2; i++) {
    const phase = u.bob * 0.6 + i * 1.8;
    const rise = (phase % 2.5) / 2.5;
    const chX = cx + (i === 0 ? -w * 0.12 : w * 0.12);
    const chY = uy - h * 0.05 - rise * h * 0.5;
    const chAlpha = 0.9 * (1 - rise);
    const chSz = w * 0.08;
    g.fillStyle(0xffffff, chAlpha);
    g.beginPath();
    g.moveTo(chX, chY - chSz);
    g.lineTo(chX - chSz * 0.8, chY + chSz * 0.4);
    g.lineTo(chX + chSz * 0.8, chY + chSz * 0.4);
    g.closePath();
    g.fillPath();
  }
}
