// Fixed design resolution — Scale.FIT handles screen adaptation
export const W = 1280; // viewport width (fixed, no longer dynamic)
export const H = 720;  // viewport height
// GND removed — use LANE.land.groundY from Layout.ts
export const BASE_W = 60;
export const SBW = 85; // scaled base width (was Math.round(BASE_W * 1.422))
export const SPD_MULT = 0.5; // global speed multiplier for all units (tune gameplay pace)
export const BASE_HP = 1000;
export const MAX_NECTAR = 300;
export const DEFAULT_WORLD_W = 2560; // default battlefield width — override via BattleSceneData.worldW
