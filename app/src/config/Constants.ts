// Fixed design resolution — Scale.FIT handles screen adaptation
export const W = 1280; // viewport width (fixed, no longer dynamic)
export const H = 720;  // viewport height
// GND removed — use LANE.land.groundY from Layout.ts
export const BASE_W = 60;
export const SBW = 85; // scaled base width (was Math.round(BASE_W * 1.422))
export const SPD_MULT = 1.0; // global speed multiplier — 1.0 = neutral; the real per-unit speeds live in def.spd. Slide live to sweep tempo.
export const BASE_HP = 1000;
// Nectar wallet cap — raised for the forage era: rich-bloom deposits land in
// ~90n bursts and maturation tech requires BANKING; a tight cap punishes saving.
export const MAX_NECTAR = 500;
// Opening nectar — THE opening-build dial under forage: eco-open (2 gatherers)
// vs aggro-open (fodder rush) both spend from this.
export const START_NECTAR = 80;
export const MAX_CAPACITY = 20;
export const DEFAULT_WORLD_W = 2560; // default battlefield width — override via BattleSceneData.worldW
