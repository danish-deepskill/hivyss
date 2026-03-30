import type { UnitDef } from '../types';
import { UNIT_DEFS } from '../units/registry';

// Convert a player color to an enemy red-tinted color
function toEnemyColor(col: number): number {
  const r = (col >> 16) & 0xff;
  const g = (col >> 8) & 0xff;
  const b = col & 0xff;
  const lum = (r + g + b) / 3;
  const er = Math.min(255, Math.round(lum * 0.5 + 140));
  const eg = Math.round(lum * 0.25 + 16);
  const eb = Math.round(lum * 0.2 + 16);
  return (er << 16) | (eg << 8) | eb;
}

function toEnemyDark(dk: number): number {
  const r = (dk >> 16) & 0xff;
  const g = (dk >> 8) & 0xff;
  const b = dk & 0xff;
  const lum = (r + g + b) / 3;
  const er = Math.min(255, Math.round(lum * 0.4 + 80));
  const eg = Math.round(lum * 0.12 + 8);
  const eb = Math.round(lum * 0.1 + 8);
  return (er << 16) | (eg << 8) | eb;
}

// Auto-generate enemy mirrors from every player unit
const MIRROR_DEFS: Record<string, UnitDef> = {};
Object.entries(UNIT_DEFS).forEach(([key, def]) => {
  MIRROR_DEFS['e' + key] = {
    ...def,
    col: toEnemyColor(def.col),
    dk: toEnemyDark(def.dk),
    cost: 0,
  };
});

// Boss-only enemies (no player counterpart)
const BOSS_DEFS: Record<string, Partial<UnitDef>> = {
  eboss: {
    name: 'QUEEN', ico: '\u{1F451}', hp: 1800, atk: 35, spd: 0.4, range: 35, atkRate: 0.4,
    cost: 0, reward: 200, w: 34, h: 28, col: 0xd020d0, dk: 0x601060, trait: 'boss', incubation: 0,
  },
  egeneral: {
    name: 'GENERAL', ico: '\u{2694}\uFE0F', hp: 3500, atk: 50, spd: 0.35, range: 30, atkRate: 0.35,
    cost: 0, reward: 400, w: 36, h: 30, col: 0xc04040, dk: 0x601010, trait: 'boss_summon', incubation: 0,
  },
  eempress: {
    name: 'EMPRESS', ico: '\u{1F478}', hp: 6000, atk: 65, spd: 0.3, range: 35, atkRate: 0.3,
    cost: 0, reward: 800, w: 40, h: 32, col: 0xe040e0, dk: 0x801080, trait: 'boss_regen', incubation: 0,
  },
};

export const ENEMY_DEFS: Record<string, UnitDef> = { ...MIRROR_DEFS, ...(BOSS_DEFS as Record<string, UnitDef>) };
