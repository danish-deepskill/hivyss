// Terrain presentation — decoupled + stub-able (mirrors FxDirector). Reads the
// grid each frame and paints organic blobs; the sim never reads anything back,
// so a battle with no renderer is byte-identical. Depth 48: above the biome
// background (~45), below the unit band (60-70).
//
// Determinism: jitter comes from a pure hash of (route, index, k) — NEVER
// Math.random — so the look is stable frame-to-frame (only the sin(t) wobble
// animates) and replay-safe.

import Phaser from 'phaser';
import type { TerrainGrid } from './TerrainGrid';
import { LANE } from '../config/Layout';
import { TERRAIN_TYPES, TERRAIN_SEGMENT_WIDTH } from '../config/TerrainDefs';
import type { Route } from '../types';
import { isTerrainDebug } from './TerrainDebug';

/** Terrain renders between the biome background and the unit band. */
export const TERRAIN_DEPTH = 48;

/** Pure hash → [0,1). Deterministic jitter seed from cell coords. */
function hash(a: number, b: number, k: number): number {
  let h = (a * 374761393 + b * 668265263 + k * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const ROUTE_INDEX: Record<string, number> = { air: 0, land: 1, tunnel: 2 };

export class TerrainRenderer {
  private readonly gfx: Phaser.GameObjects.Graphics;
  // Debug grid lives on its OWN Graphics, painted ONCE (it's static — boundary
  // lines don't animate), so it stays out of the per-frame blob clear+redraw.
  private readonly dbg: Phaser.GameObjects.Graphics;
  private dbgShown = false;   // is the static grid currently painted?
  private dbgSegments = -1;   // segment count it was painted for (repaint on resize)

  constructor(gfx: Phaser.GameObjects.Graphics) {
    this.gfx = gfx;
    this.gfx.setDepth(TERRAIN_DEPTH);
    this.dbg = gfx.scene.add.graphics();
    this.dbg.setDepth(TERRAIN_DEPTH + 1); // grid just above the blobs, below units
  }

  /** Repaint the whole grid. `t` is wall-clock seconds (drives the wobble). */
  draw(grid: TerrainGrid, t: number): void {
    const g = this.gfx;
    g.clear();

    grid.forEach((route, index, cell) => {
      if (cell.state === 'empty' || cell.element === null) return;
      const type = TERRAIN_TYPES[cell.element];
      if (!type) return;

      const pal = type.render.palette;
      const shape = type.render.shape;
      const x0 = index * TERRAIN_SEGMENT_WIDTH;
      const cxc = x0 + TERRAIN_SEGMENT_WIDTH / 2;
      const groundY = LANE[route].groundY;
      const ri = ROUTE_INDEX[route] ?? 1;
      // intensity drives size + opacity; ttl-fade keeps a dying pool from popping.
      const inten = Math.max(0.35, Math.min(1, cell.intensity));
      const fade = cell.ttl !== Infinity ? Math.max(0.3, Math.min(1, cell.ttl / 2)) : 1;
      const alpha = (0.42 + 0.4 * inten) * fade;
      const wob = Math.sin(t * 2.2 + index * 1.3 + ri) * 2;

      if (shape === 'wall') {
        // A chunky barrier rising off the ground — stacked rounded blobs.
        const halfW = TERRAIN_SEGMENT_WIDTH * 0.52; // overlap neighbors → hide seams
        const top = groundY - 30 - 8 * inten;
        g.fillStyle(pal.rim, alpha);
        g.fillRoundedRect(cxc - halfW, top - 3, halfW * 2, groundY - top + 6, 7);
        g.fillStyle(pal.fill, alpha);
        g.fillRoundedRect(cxc - halfW + 3, top, halfW * 2 - 6, groundY - top, 6);
        // A few brick-blobs for texture (deterministic).
        if (pal.glow !== undefined) {
          g.fillStyle(pal.glow, alpha * 0.5);
          for (let k = 0; k < 3; k++) {
            const bx = cxc + (hash(ri, index, k) - 0.5) * halfW * 1.2;
            const by = top + hash(index, ri, k + 9) * (groundY - top) * 0.8;
            g.fillCircle(bx, by, 3 + hash(k, index, ri) * 3);
          }
        }
      } else if (shape === 'pool') {
        // A flat puddle on the surface, with jittered edge lobes + a wobble.
        const halfW = TERRAIN_SEGMENT_WIDTH * 0.56;
        const py = groundY - 1;
        g.fillStyle(pal.rim, alpha);
        g.fillEllipse(cxc, py + 1, halfW * 2.05, 12 + 2 * inten);
        g.fillStyle(pal.fill, alpha);
        g.fillEllipse(cxc, py, halfW * 1.9, 9 + 2 * inten);
        for (let k = 0; k < 3; k++) {
          const lx = cxc + (hash(ri, index, k) - 0.5) * halfW * 1.7;
          g.fillEllipse(lx, py + wob * 0.4, 10 + hash(k, ri, index) * 12, 6);
        }
        if (pal.glow !== undefined) {
          g.fillStyle(pal.glow, alpha * 0.55);
          g.fillEllipse(cxc, py - 1.5, halfW, 4);
        }
      } else {
        // web — a pale translucent sheet with a crossed mesh.
        const halfW = TERRAIN_SEGMENT_WIDTH * 0.5;
        const cy = groundY - 8;
        g.fillStyle(pal.fill, alpha * 0.5);
        g.fillEllipse(cxc, cy, halfW * 2, 26);
        g.lineStyle(1, pal.rim, alpha * 0.9);
        for (let k = 0; k < 4; k++) {
          const sx = x0 + (k / 4) * TERRAIN_SEGMENT_WIDTH;
          g.lineBetween(sx, cy - 12, sx + TERRAIN_SEGMENT_WIDTH * 0.3, cy + 12 + wob);
          g.lineBetween(sx + TERRAIN_SEGMENT_WIDTH * 0.3, cy - 12, sx, cy + 12 - wob);
        }
      }
    });

    if (isTerrainDebug()) {
      // Static grid: repaint only when first shown or the grid resized.
      if (!this.dbgShown || this.dbgSegments !== grid.segments) {
        this.paintGrid(grid);
        this.dbgShown = true;
        this.dbgSegments = grid.segments;
      }
      // Active-cell outlines change with terrain → cheap per-frame, on the blob gfx.
      this.drawActiveCells(grid);
    } else if (this.dbgShown) {
      this.dbg.clear();
      this.dbgShown = false;
      this.dbgSegments = -1;
    }
  }

  /** STATIC debug grid (console `terrain`) — drawn ONCE onto its own Graphics.
   *  Each boundary is ONE continuous, pixel-snapped vertical line spanning all
   *  three routes (NOT three per-route stubs — that stagger was the "offset"),
   *  thin + low-alpha so it reads as a grid, not noise. */
  private paintGrid(grid: TerrainGrid): void {
    const d = this.dbg;
    d.clear();
    const span = grid.segments * TERRAIN_SEGMENT_WIDTH;
    const top = LANE.air.groundY - 44;     // above the highest route
    const bot = LANE.tunnel.groundY + 6;   // below the lowest route
    d.lineStyle(1, 0x00ff88, 0.13);        // subtle segment boundaries
    for (let i = 0; i <= grid.segments; i++) {
      const x = Math.round(i * TERRAIN_SEGMENT_WIDTH); // snap → crisp at zoom 1.5
      d.lineBetween(x, top, x, bot);
    }
    d.lineStyle(1, 0x00ff88, 0.28);        // brighter per-route ground lines
    for (const route of ['air', 'land', 'tunnel'] as Route[]) {
      const gy = Math.round(LANE[route].groundY);
      d.lineBetween(0, gy, span, gy);
    }
  }

  /** Active-cell outlines — per-frame on the blob gfx (terrain changes), snapped
   *  EXACTLY to the cell box [x .. x+W] so edges sit on the dividers (no inset). */
  private drawActiveCells(grid: TerrainGrid): void {
    const g = this.gfx;
    g.lineStyle(1, 0xffe000, 0.6);
    grid.forEach((route, index, cell) => {
      if (cell.state === 'empty') return;
      const gy = Math.round(LANE[route].groundY);
      const x = Math.round(index * TERRAIN_SEGMENT_WIDTH);
      g.strokeRect(x, gy - 38, TERRAIN_SEGMENT_WIDTH, 42);
    });
  }

  /** Clear the canvas (battle reset). */
  reset(): void {
    this.gfx.clear();
    this.dbg.clear();
    this.dbgShown = false;
    this.dbgSegments = -1;
  }

  destroy(): void {
    this.gfx.destroy();
    this.dbg.destroy();
  }
}
