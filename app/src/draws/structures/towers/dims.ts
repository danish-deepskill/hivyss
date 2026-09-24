// Shared tower body dimensions — one source for the variant draws + the Tower
// (which needs the height for the muzzle / HP-bar placement). A separate tiny
// module avoids a Tower↔registry import cycle.
export const TOWER_HEIGHT = 76;
export const TOWER_HALF_W = 11;
