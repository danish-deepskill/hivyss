import type { BuildingDef } from '../types';

// Per-variant building definitions — the data-driven building roster (mirrors
// TowerDefs / UnitDef). Each building TYPE differs here, not via constants.
// Adding a type = one entry here + one draw variant in draws/buildings + (if it
// should be placeable) an entry in BUILDING_ORDER.
//
// A building's FUNCTION is data too: `income` makes it an economy node, applied
// by the Buildings manager while the building is complete + alive. New effect
// kinds become new optional fields here + a branch in the manager.
export const BUILDING_DEFS: Record<string, BuildingDef> = {
  // The example PROP — destructible, cell-occupying, buildable, no effect.
  totem: {
    variant: 'totem',
    name: 'Totem',
    ico: '\u{1F5FF}', // moai
    hp: 220,
    buildTime: 6,
    cost: 40,
  },
  // The economy node — passive nectar income while built + alive.
  nectarfont: {
    variant: 'nectarfont',
    name: 'Nectar Font',
    ico: '\u{26F2}', // fountain
    hp: 180,
    buildTime: 8,
    cost: 60,
    income: 2, // nectar/sec while alive (pays back in ~30s)
  },
};

/** Placeable buildings, in build-palette order. */
export const BUILDING_ORDER: readonly string[] = ['totem', 'nectarfont'];

const DEFAULT_BUILDING = BUILDING_DEFS.totem;

/** Resolve a building's def by variant, falling back to the totem. */
export function getBuildingDef(variant: string): BuildingDef {
  return BUILDING_DEFS[variant] ?? DEFAULT_BUILDING;
}
