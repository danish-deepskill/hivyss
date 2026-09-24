// Shared structure chrome — the HP / progress bars drawn above any building
// (Tower, Building, …). One source so every structure's bars read identically.
// Drawn in the structure's LOCAL space (cx = 0 at the container origin).

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A health bar: black backing + a green→amber→red fill by `frac` (hp/maxHp). */
export function drawHpBar(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  w: number,
  frac: number,
): void {
  const x = cx - w / 2;
  g.fillStyle(0x000000, 0.6);
  g.fillRect(x - 1, y - 1, w + 2, 5);
  const f = clamp01(frac);
  const col = f > 0.5 ? 0x40d060 : f > 0.25 ? 0xd0c040 : 0xd04040;
  g.fillStyle(col, 1);
  g.fillRect(x, y, w * f, 3);
}

/** A build-progress bar: black backing + a colored fill by `frac` (0..1). */
export function drawProgressBar(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  w: number,
  frac: number,
  color = 0x70d8ff,
): void {
  const x = cx - w / 2;
  g.fillStyle(0x000000, 0.6);
  g.fillRect(x - 1, y - 1, w + 2, 5);
  g.fillStyle(color, 1);
  g.fillRect(x, y, w * clamp01(frac), 3);
}

/**
 * The standard structure chrome above a body (local space, cx = 0): an HP bar,
 * plus a build-progress bar above it when `progress` is given. Owns the bar width
 * factor + the vertical offsets in ONE place so every structure reads identically.
 */
export function drawStructureChrome(
  g: Phaser.GameObjects.Graphics,
  opts: { halfW: number; height: number; groundY: number; frac: number; progress?: number },
): void {
  const w = opts.halfW * 2.6;
  const hpY = opts.groundY - opts.height - 12;
  drawHpBar(g, 0, hpY, w, opts.frac);
  if (opts.progress !== undefined) drawProgressBar(g, 0, hpY - 6, w, opts.progress);
}
