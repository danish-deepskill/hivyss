// Game world dimensions — full width, fixed height
export const W = Math.max(900, window.innerWidth); // viewport width
export const H = 400;
export const GND = 330;
export const BASE_W = 60;
export const S = W / 900; // scale factor for proportional sizing
export const SPD_MULT = 0.5; // global speed multiplier for all units (tune gameplay pace)
export const BASE_HP = 1000;
export const MAX_GOLD = 300;
export const WORLD_W = Math.round(W * 2); // battlefield width (camera scrolls across this)
