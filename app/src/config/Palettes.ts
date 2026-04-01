import type { GenePalette, UnitDef } from '../types';

/** Geneline color palettes — one entry per geneline.
 *  Adding a new geneline = one entry here, auto-available everywhere. */
export const PALETTES: Record<string, GenePalette> = {
  alpha: { primary: 0xc03030, secondary: 0x6b1a1a, accent: 0xd4c4b0, shadow: 0x3d0e0e },
};

/** Resolve primary/secondary from a UnitDef (prefers explicit primary/secondary, falls back to palette). */
export function resolveColors(def: UnitDef): { primary: number; secondary: number } {
  return {
    primary: def.primary ?? def.palette?.primary ?? 0xffffff,
    secondary: def.secondary ?? def.palette?.secondary ?? 0x808080,
  };
}
