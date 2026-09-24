import type { GenePalette, UnitDef } from '../types';

/** Geneline color palettes — one entry per geneline.
 *  Adding a new geneline = one entry here, auto-available everywhere. */
export const PALETTES: Record<string, GenePalette> = {
  // Normal — the universal baseline geneline. White-ish chitin bodies with a
  // dark grey outline/limb tone (à la Battle Cats' normal cats): distinguished
  // by SILHOUETTE, not colour. Per-unit `primary`/`secondary` still override
  // (e.g. the Gatherer stays economy-gold).
  normal: { primary: 0xece8e0, secondary: 0x585660, accent: 0xb4aea4, shadow: 0x2c2a30 },
  alpha: { primary: 0xc03030, secondary: 0xd4c4b0, accent: 0x6b1a1a, shadow: 0x3d0e0e },
  // β Swarm — the Fetid Pool: putrid bog-green bodies, pale maggot-flesh,
  // bruised-violet accents (the rot underneath).
  beta: { primary: 0x86a832, secondary: 0xdcd8ac, accent: 0x5a3a72, shadow: 0x28300c },
  // γ Fortress — the Chitin Ridge: calcified pale-tan shell, dark stone shade,
  // a cool mineral-slate accent (the crystal in the rock).
  gamma: { primary: 0xa89878, secondary: 0x5a5040, accent: 0x7088a0, shadow: 0x2c2820 },
};

/**
 * Resolve primary/secondary for a UnitDef. Precedence: explicit per-unit
 * `primary`/`secondary` → the def's `palette` → the geneline's palette
 * (PALETTES[geneline]) → the hard fallback. So a unit gets its geneline colour
 * for free (no per-unit colour needed); set `primary`/`secondary` only to deviate.
 */
export function resolveColors(def: UnitDef): { primary: number; secondary: number } {
  const pal = def.palette ?? PALETTES[def.geneline];
  return {
    primary: def.primary ?? pal?.primary ?? 0xffffff,
    secondary: def.secondary ?? pal?.secondary ?? 0x808080,
  };
}
