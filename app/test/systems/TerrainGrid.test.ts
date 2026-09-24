import { describe, it, expect } from 'vitest';
import { TerrainGrid, emptyCell, isActive } from '../../src/systems/TerrainGrid';

// These tests pin segWidth=128 explicitly (the constructor's 2nd arg) so the
// index/sizing math is deterministic, independent of the production default.

describe('TerrainGrid.segmentOf', () => {
  const g = new TerrainGrid(2560, 128);

  it('maps world-x to segments of fixed width', () => {
    expect(g.segmentOf(0)).toBe(0);
    expect(g.segmentOf(127)).toBe(0);
    expect(g.segmentOf(128)).toBe(1);
    expect(g.segmentOf(256)).toBe(2);
  });

  it('clamps out-of-range positions', () => {
    expect(g.segmentOf(-50)).toBe(0);
    expect(g.segmentOf(999999)).toBe(g.segments - 1);
  });

  it('sizes the grid to the map length', () => {
    expect(g.segments).toBe(20); // ceil(2560 / 128)
    expect(new TerrainGrid(5120, 128).segments).toBe(40);
  });
});

describe('TerrainGrid cells', () => {
  it('starts every cell empty', () => {
    const g = new TerrainGrid(640);
    g.forEach((_r, _i, cell) => expect(isActive(cell)).toBe(false));
  });

  it('set / cellAt round-trips by world position', () => {
    const g = new TerrainGrid(640);
    const wall = { ...emptyCell(), state: 'raised' as const, element: 'chitin' as const, hp: 100 };
    g.set('land', g.segmentOf(300), wall);
    expect(g.cellAt('land', 300).state).toBe('raised');
    expect(g.cellAt('air', 300).state).toBe('empty'); // per-route scope
  });

  it('reset clears everything', () => {
    const g = new TerrainGrid(640);
    g.set('land', 0, { ...emptyCell(), state: 'flooded', element: 'acid' });
    g.reset();
    expect(g.cell('land', 0).state).toBe('empty');
  });
});

describe('TerrainGrid.neighbors (cross-route seam, delta #5)', () => {
  const g = new TerrainGrid(2560, 128); // 20 segments

  it('includes same-route ±1 and cross-route same index', () => {
    const n = g.neighbors('land', 5);
    expect(n).toContainEqual({ route: 'land', index: 4 });
    expect(n).toContainEqual({ route: 'land', index: 6 });
    expect(n).toContainEqual({ route: 'air', index: 5 });
    expect(n).toContainEqual({ route: 'tunnel', index: 5 });
    expect(n).toHaveLength(4);
  });

  it('drops out-of-bounds neighbors at the edges', () => {
    const top = g.neighbors('air', 0); // no air-up, no index-1
    expect(top).toContainEqual({ route: 'land', index: 0 });
    expect(top).toContainEqual({ route: 'air', index: 1 });
    expect(top).toHaveLength(2);
  });
});
