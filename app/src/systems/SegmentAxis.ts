// SegmentAxis — the ONE 1-D segment coordinate system that both the terrain grid
// and the structure-occupancy grid index by. Sharing the sizing + segmentOf math
// here means the two parallel layers literally cannot drift (no parity test
// needed), and any future per-route grid reuses it. Pure math, no Phaser.

import type { Route } from '../types';
import { TERRAIN_SEGMENT_WIDTH } from '../config/TerrainDefs';

/** Route order — also the cross-route adjacency order (air ↔ land ↔ tunnel). */
export const ROUTES: readonly Route[] = ['air', 'land', 'tunnel'];

export class SegmentAxis {
  /** Segment count (sized to the map: ceil(worldW / segWidth), min 1). */
  readonly segments: number;
  private readonly segWidth: number;

  constructor(worldW: number, segWidth: number = TERRAIN_SEGMENT_WIDTH) {
    this.segWidth = segWidth;
    this.segments = Math.max(1, Math.ceil(worldW / segWidth));
  }

  /** world-x → segment index (clamped). laneStart is 0. */
  segmentOf(x: number): number {
    const i = Math.floor(x / this.segWidth);
    return i < 0 ? 0 : i >= this.segments ? this.segments - 1 : i;
  }

  /** Left-edge world-x of a segment. */
  segmentStart(index: number): number {
    return index * this.segWidth;
  }

  /** Center world-x of a segment (placement snaps to this). */
  segmentCenter(index: number): number {
    return index * this.segWidth + this.segWidth / 2;
  }

  /** Allocate a fresh per-route column set (one cell per segment) via `factory`. */
  columns<T>(factory: () => T): Record<Route, T[]> {
    const cols: Record<Route, T[]> = { air: [], land: [], tunnel: [] };
    for (const r of ROUTES) {
      for (let i = 0; i < this.segments; i++) cols[r].push(factory());
    }
    return cols;
  }
}
