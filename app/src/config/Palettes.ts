import type { GenePalette, UnitDef } from '../types';

/** Geneline color palettes — one entry per geneline.
 *  Adding a new geneline = one entry here, auto-available everywhere. */
export const PALETTES: Record<string, GenePalette> = {
  alpha: { primary: 0xc03030, secondary: 0xd4c4b0, accent: 0x6b1a1a, shadow: 0x3d0e0e },
  // β Swarm — the Fetid Pool: putrid bog-green bodies, pale maggot-flesh,
  // bruised-violet accents (the rot underneath).
  beta: { primary: 0x86a832, secondary: 0xdcd8ac, accent: 0x5a3a72, shadow: 0x28300c },
};

/** Resolve primary/secondary from a UnitDef (prefers explicit primary/secondary, falls back to palette). */
export function resolveColors(def: UnitDef): { primary: number; secondary: number } {
  return {
    primary: def.primary ?? def.palette?.primary ?? 0xffffff,
    secondary: def.secondary ?? def.palette?.secondary ?? 0x808080,
  };
}
