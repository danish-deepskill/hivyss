// Terrain data model — a coarse logical grid: 3 routes × N segments of fixed
// world-width. Pure data + index math; no reactions, no effects, no Phaser.
// The grid sizes to the map length (segments = ceil(worldW / segWidth)) so
// terrain reads the same coarse size on short and long maps (delta #1).

import type { Route, TerrainCell } from '../types';
import { SegmentAxis, ROUTES } from './SegmentAxis';

/** A fresh inert cell. */
export function emptyCell(): TerrainCell {
  return { state: 'empty', element: null, intensity: 0, hp: 0, ttl: Infinity };
}

/** True once the cell carries terrain (anything but the inert default). */
export function isActive(cell: TerrainCell): boolean {
  return cell.state !== 'empty';
}

export interface CellRef {
  route: Route;
  index: number;
}

export class TerrainGrid {
  private readonly axis: SegmentAxis;
  private readonly cells: Record<Route, TerrainCell[]>;

  constructor(worldW: number, segWidth?: number) {
    this.axis = new SegmentAxis(worldW, segWidth);
    this.cells = this.axis.columns(emptyCell);
  }

  /** Segment count per route (sized to the map). */
  get segments(): number { return this.axis.segments; }

  /** world-x → segment index (clamped to the grid). */
  segmentOf(x: number): number { return this.axis.segmentOf(x); }

  /** Left-edge world-x of a segment (the renderer anchors blobs by this). */
  segmentStart(index: number): number { return this.axis.segmentStart(index); }

  /** Center world-x of a segment. */
  segmentCenter(index: number): number { return this.axis.segmentCenter(index); }

  /** The cell at a world position on a route. */
  cellAt(route: Route, x: number): TerrainCell {
    return this.cells[route][this.segmentOf(x)];
  }

  /** The cell at an explicit index (assumed valid; callers clamp via segmentOf). */
  cell(route: Route, index: number): TerrainCell {
    return this.cells[route][index];
  }

  /** Replace a cell (used by the reaction-resolved transform). */
  set(route: Route, index: number, cell: TerrainCell): void {
    this.cells[route][index] = cell;
  }

  /**
   * Neighbor cells of (route, index) — same-route ±1 AND cross-route same index
   * (route±1 in the air↔land↔tunnel stack). DECLARED SEAM (delta #5): the
   * `spread` reaction pass and future cross-route bleed walk this; nothing in v1
   * consumes it yet, but the adjacency is defined here so those land as a pass,
   * not a rewrite.
   */
  neighbors(route: Route, index: number): CellRef[] {
    const out: CellRef[] = [];
    if (index - 1 >= 0) out.push({ route, index: index - 1 });
    if (index + 1 < this.segments) out.push({ route, index: index + 1 });
    const r = ROUTES.indexOf(route);
    if (r - 1 >= 0) out.push({ route: ROUTES[r - 1], index });
    if (r + 1 < ROUTES.length) out.push({ route: ROUTES[r + 1], index });
    return out;
  }

  /** Visit every cell (renderer + decay tick). */
  forEach(cb: (route: Route, index: number, cell: TerrainCell) => void): void {
    for (const r of ROUTES) {
      const col = this.cells[r];
      for (let i = 0; i < col.length; i++) cb(r, i, col[i]);
    }
  }

  /** Clear every cell to empty (battle reset). */
  reset(): void {
    for (const r of ROUTES) {
      const col = this.cells[r];
      for (let i = 0; i < col.length; i++) col[i] = emptyCell();
    }
  }
}
