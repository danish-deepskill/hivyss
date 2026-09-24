import type { TowerDef } from '../types';

// Per-variant tower definitions — the data-driven tower roster (mirrors UnitDef
// / AbilityDefs). Each tower TYPE differs here, not via uniform constants. Adding
// a type = one entry here + one draw variant in draws/towers. All numbers are
// playtest knobs.
export const TOWER_DEFS: Record<string, TowerDef> = {
  // γ's spire — a long-range bio-turret that fires at any enemy in range.
  spire: {
    variant: 'spire',
    hp: 480,
    range: 155,
    damage: 20,
    fireInterval: 0.85,
  },
};

const DEFAULT_TOWER = TOWER_DEFS.spire;

/** Resolve a tower's def by variant, falling back to the spire. */
export function getTowerDef(variant: string): TowerDef {
  return TOWER_DEFS[variant] ?? DEFAULT_TOWER;
}
