// Fixed design resolution — Scale.FIT handles screen adaptation
export const W = 1280; // viewport width (fixed, no longer dynamic)
export const H = 720;  // viewport height
// GND removed — use LANE.land.groundY from Layout.ts
export const BASE_W = 60;
export const SBW = 85; // scaled base width (was Math.round(BASE_W * 1.422))
export const SPD_MULT = 1.0; // global speed multiplier — 1.0 = neutral; the real per-unit speeds live in def.spd. Slide live to sweep tempo.
// Royal lane-switch "reach" — the logical distance of a cross-lane redeploy. The
// duration is REACH / royalSpeed, so a lane-switch scales with the geneline's
// Royal speed (nimble Royals flit, ponderous ones commit). Tuned so the Matriarch
// (spd 0.43) takes ~3s; faster Royals cross quicker. A strategy knob, not physics.
export const LANE_CROSS_REACH = 1.3;
export const BASE_HP = 1000;
export const MAX_NECTAR = 300;
export const MAX_CAPACITY = 20;
export const DEFAULT_WORLD_W = 2560; // default battlefield width — override via BattleSceneData.worldW
