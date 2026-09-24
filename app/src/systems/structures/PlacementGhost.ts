import Phaser from 'phaser';

// PlacementGhost — a decoupled, REUSABLE placement preview (the "root" the user
// asked for). It renders nothing of its own logic: a driver feeds it a flat
// GhostSpec (placement position + footprint geometry + validity) and it paints a
// tinted footprint preview. Generic over any placeable (buildings today,
// walls/towers later) — it knows geometry, not buildings. The VALIDITY + POSITION
// come from one authority (GameManager.previewPlacement), so the ghost can never
// disagree with where the thing actually lands. Mirrors the FxDirector /
// TerrainRenderer presentation pattern (reads state, the sim reads nothing back).

export interface GhostSpec {
  /** Placement world-x (from the placement authority — per-pixel, no snap). */
  x: number;
  /** Ground baseline the footprint sits on. */
  groundY: number;
  /** Footprint half-width + height (px). */
  halfW: number;
  height: number;
  /** Legal placement here? green when true, red when false. */
  valid: boolean;
}

/** Above the unit band (60-70) + FX (80) so the preview reads on top. */
export const GHOST_DEPTH = 90;

export class PlacementGhost {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private shown = false;

  constructor(gfx: Phaser.GameObjects.Graphics, depth = GHOST_DEPTH) {
    this.gfx = gfx;
    this.gfx.setDepth(depth);
  }

  /** Paint the preview at `spec` (green = valid, red = invalid). */
  show(spec: GhostSpec): void {
    this.shown = true;
    const g = this.gfx;
    g.clear();
    const col = spec.valid ? 0x40d060 : 0xd04040;
    const topY = spec.groundY - spec.height;
    const x0 = spec.x - spec.halfW;
    const x1 = spec.x + spec.halfW;

    // Footprint ground bracket — a baseline + end ticks under where it'll stand.
    g.lineStyle(1.5, col, 0.7);
    g.lineBetween(x0, spec.groundY, x1, spec.groundY);
    g.lineBetween(x0, spec.groundY, x0, spec.groundY - 6);
    g.lineBetween(x1, spec.groundY, x1, spec.groundY - 6);

    // Translucent footprint silhouette (where the body will stand).
    g.fillStyle(col, 0.22);
    g.fillRect(spec.x - spec.halfW, topY, spec.halfW * 2, spec.height);
    g.lineStyle(1.5, col, 0.85);
    g.strokeRect(spec.x - spec.halfW, topY, spec.halfW * 2, spec.height);
  }

  /** Clear the preview (left build mode / placed). */
  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.gfx.clear();
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
