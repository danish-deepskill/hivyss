import type { UnitDef } from '../types';
import { UNIT_DEFS } from '../units/registry';
import { resolveColors } from './Palettes';

// Darken a color by a factor (0 = black, 1 = unchanged)
function darken(col: number, factor: number): number {
  const r = Math.round(((col >> 16) & 0xff) * factor);
  const g = Math.round(((col >> 8) & 0xff) * factor);
  const b = Math.round((col & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

// Auto-generate enemy mirrors — same hue, slightly darker
const MIRROR_DEFS: Record<string, UnitDef> = {};
Object.entries(UNIT_DEFS).forEach(([key, def]) => {
  const { primary, secondary } = resolveColors(def);
  MIRROR_DEFS['e' + key] = {
    ...def,
    primary: darken(primary, 0.65),
    secondary: darken(secondary, 0.65),
    cost: 0,
  };
});

export const ENEMY_DEFS: Record<string, UnitDef> = { ...MIRROR_DEFS };
