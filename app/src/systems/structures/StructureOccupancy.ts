// Structure occupancy — the ONE shared authority for "is this footprint free?"
// across every placed structure (hives + towers + buildings). PER-PIXEL: a
// structure sits at its exact placed x and occupancy is a 1-D interval-overlap
// test, NOT a cell grid. So a 32px building no longer costs a whole 48px cell,
// placement lands exactly where pointed, and the field reads as organic growth
// rather than a snapped lattice.
//
// Replaces the old StructureGrid (segment cells + snap-to-center). Terrain keeps
// its OWN grid (TerrainGrid): terrain is an environment you sample by position;
// this is placed-object occupancy you query by overlap — two different spatial
// kinds, deliberately not merged.
//
// Pure data + interval math, no Phaser — testable in isolation.

import type { StructureEntity } from '../../entities/structures/StructureEntity';

interface Span {
  ref: StructureEntity;
  min: number;
  max: number;
}

export class StructureOccupancy {
  private spans: Span[] = [];

  // worldW is accepted for call-site parity with the old grid (BattleCore passes
  // it); bounds are enforced by the hive footprints reserving the lane ends, not
  // by this object — it only knows overlap.
  constructor(_worldW?: number) {}

  /** Would a footprint of half-width `halfW` centered at `x` overlap anything
   *  already placed? Strict overlap — exactly abutting (edge === edge) is free. */
  overlaps(x: number, halfW: number): boolean {
    const min = x - halfW;
    const max = x + halfW;
    return this.spans.some((s) => min < s.max && max > s.min);
  }

  /** Occupy the footprint [x ± halfW] for a point structure (tower/building). */
  add(ref: StructureEntity, x: number, halfW: number): void {
    this.spans.push({ ref, min: x - halfW, max: x + halfW });
  }

  /** Occupy a wide span [xStart, xEnd] for `ref` — the hive base footprints. */
  addSpan(ref: StructureEntity, xStart: number, xEnd: number): void {
    this.spans.push({ ref, min: xStart, max: xEnd });
  }

  /** Free everything `ref` occupies (death / removal / teardown). */
  remove(ref: StructureEntity): void {
    this.spans = this.spans.filter((s) => s.ref !== ref);
  }

  /** Drop all occupancy. */
  reset(): void {
    this.spans = [];
  }
}
