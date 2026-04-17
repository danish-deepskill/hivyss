// Sweep-and-prune spatial index over X (Combat Rewrite Decision 3).
//
// Hivyss is lane-based: units mostly move along X. A 1D sweep-and-prune
// exploits that structure and is cheap to maintain — each entity holds
// near its sorted position frame-to-frame, so update() is amortized O(1)
// via bubble-sort. There is ONE index; route, side, and component
// filters run at query time, not by splitting into separate indices.
//
// The stateful class is thin glue around two pure helpers
// (`findOverlapsInRange`, `matchesFilter`) so all query logic is
// testable without instantiating SpatialIndex or constructing Units.

import type { Route, Side, WorldEntity, ComponentTag } from '../types';

// Structural contract for entities the index stores. Unit satisfies it
// (Unit has route/side). Non-Unit WorldEntities (Pylon, Zone, etc.)
// carry route as well; `side` is optional because neutral entities like
// Gravity Well have no allegiance.
export interface SpatialEntity extends WorldEntity {
  route: Route;
  side?: Side;
}

export interface SpatialQuery {
  x: number;
  range: number;
  routes?: readonly Route[];
  side?: Side;
  components?: readonly ComponentTag[];
}

// --- Pure helpers ---

/**
 * Returns all entities from a sorted-by-x array whose x falls within
 * [centerX - range, centerX + range]. Uses binary search for the lower
 * bound and linear walk to the upper bound — O(log n + k) where k is
 * the match count.
 *
 * Pure: no index state, testable with plain object arrays.
 */
export function findOverlapsInRange<T extends { x: number }>(
  sorted: readonly T[],
  centerX: number,
  range: number,
): T[] {
  const min = centerX - range;
  const max = centerX + range;
  const n = sorted.length;
  if (n === 0) return [];

  // Binary search for first index where sorted[i].x >= min.
  let lo = 0, hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid].x < min) lo = mid + 1;
    else hi = mid;
  }

  const out: T[] = [];
  for (let i = lo; i < n; i++) {
    const e = sorted[i];
    if (e.x > max) break;
    out.push(e);
  }
  return out;
}

/**
 * Pure predicate: does an entity satisfy a query's non-spatial filters?
 * Excludes dead entities unconditionally (spatial queries should never
 * return a corpse mid-despawn).
 */
export function matchesFilter(
  entity: SpatialEntity,
  routes?: readonly Route[],
  side?: Side,
  components?: readonly ComponentTag[],
): boolean {
  if (entity.dead) return false;
  if (routes && routes.length > 0 && !routes.includes(entity.route)) return false;
  if (side !== undefined) {
    if (entity.side === undefined || entity.side !== side) return false;
  }
  if (components && components.length > 0) {
    for (const c of components) {
      if (!entity.components.has(c)) return false;
    }
  }
  return true;
}

// --- Stateful index ---

export class SpatialIndex {
  // Sorted ascending by x. Duplicates are not expected; insert is
  // binary-search'd, update bubbles toward correct position.
  private entities: SpatialEntity[] = [];

  get size(): number {
    return this.entities.length;
  }

  /** Insert at the sorted position. Idempotent: re-adding a known entity is a no-op. */
  add(entity: SpatialEntity): void {
    if (this.entities.indexOf(entity) !== -1) return;
    const lo = this.insertionIndex(entity.x);
    this.entities.splice(lo, 0, entity);
  }

  /** Remove by reference. Silently no-ops if entity isn't tracked. */
  remove(entity: SpatialEntity): void {
    const idx = this.entities.indexOf(entity);
    if (idx < 0) return;
    this.entities.splice(idx, 1);
  }

  /**
   * Re-sort a single entity after its x moved. Bubbles toward its new
   * sorted position — O(k) where k is the distance traveled in index
   * space. For typical per-frame micro-movements k is 0 or 1.
   * Silently no-ops if entity isn't tracked (caller may update a unit
   * that died this frame before the index cleanup ran).
   */
  update(entity: SpatialEntity): void {
    const n = this.entities.length;
    const idx = this.entities.indexOf(entity);
    if (idx < 0) return;

    let i = idx;
    // Bubble right while the right neighbor has smaller x.
    while (i + 1 < n && this.entities[i + 1].x < entity.x) {
      this.entities[i] = this.entities[i + 1];
      i++;
    }
    // Bubble left while the left neighbor has larger x.
    while (i > 0 && this.entities[i - 1].x > entity.x) {
      this.entities[i] = this.entities[i - 1];
      i--;
    }
    this.entities[i] = entity;
  }

  /**
   * Range query. Returns entities within [x - range, x + range] whose
   * route/side/components match the filter. Dead entities are excluded.
   */
  query(q: SpatialQuery): SpatialEntity[] {
    const candidates = findOverlapsInRange(this.entities, q.x, q.range);
    if (candidates.length === 0) return candidates;
    const out: SpatialEntity[] = [];
    for (const e of candidates) {
      if (matchesFilter(e, q.routes, q.side, q.components)) out.push(e);
    }
    return out;
  }

  /** Drop all entries (used when a battle ends / GameManager is rebuilt). */
  clear(): void {
    this.entities.length = 0;
  }

  // --- Internal ---

  private insertionIndex(x: number): number {
    // First index where entities[i].x >= x.
    let lo = 0, hi = this.entities.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.entities[mid].x < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}
