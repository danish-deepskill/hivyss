import { describe, it, expect } from 'vitest';
import {
  SpatialIndex,
  findOverlapsInRange,
  matchesFilter,
  type SpatialEntity,
} from '../../src/systems/SpatialIndex';
import type { Route, Side, ComponentTag } from '../../src/types';

// Plain-object fixtures — no Phaser, no Unit construction.
// Everything the index or its pure helpers touch is structural.
type TE = SpatialEntity;

const entity = (
  id: number,
  x: number,
  opts: {
    route?: Route;
    side?: Side;
    dead?: boolean;
    components?: ComponentTag[];
    y?: number;
  } = {},
): TE => ({
  id,
  x,
  y: opts.y ?? 0,
  dead: opts.dead ?? false,
  route: opts.route ?? 'land',
  side: opts.side,
  components: new Set(opts.components ?? ['HasHP', 'IsTargetable', 'HasAI']),
});

// --- Pure helpers --------------------------------------------------

describe('findOverlapsInRange', () => {
  it('returns [] on empty input', () => {
    expect(findOverlapsInRange([], 0, 50)).toEqual([]);
  });

  it('returns the single entity when it is inside range', () => {
    const a = { id: 1, x: 100 };
    expect(findOverlapsInRange([a], 100, 10)).toEqual([a]);
  });

  it('returns [] when the single entity is outside range', () => {
    const a = { id: 1, x: 100 };
    expect(findOverlapsInRange([a], 0, 50)).toEqual([]);
  });

  it('returns entities whose x falls within [cx-range, cx+range]', () => {
    const arr = [
      { id: 1, x: 0 },
      { id: 2, x: 50 },
      { id: 3, x: 100 },
      { id: 4, x: 150 },
      { id: 5, x: 200 },
    ];
    const got = findOverlapsInRange(arr, 100, 50).map(e => e.id);
    expect(got).toEqual([2, 3, 4]);
  });

  it('treats the range boundary as inclusive on both ends', () => {
    const arr = [
      { id: 1, x: 50 },
      { id: 2, x: 100 },
      { id: 3, x: 150 },
    ];
    // cx=100, range=50 → [50, 150], all three included.
    expect(findOverlapsInRange(arr, 100, 50).map(e => e.id)).toEqual([1, 2, 3]);
  });

  it('stops walking once it passes the upper bound', () => {
    const arr = [
      { id: 1, x: 0 },
      { id: 2, x: 50 },
      { id: 3, x: 60 },
      { id: 4, x: 61 }, // just past cx+range
      { id: 5, x: 200 },
    ];
    expect(findOverlapsInRange(arr, 30, 30).map(e => e.id)).toEqual([1, 2, 3]);
  });

  it('skips entities below the lower bound via binary search', () => {
    const arr = [
      { id: 1, x: -1000 },
      { id: 2, x: -500 },
      { id: 3, x: 0 },
      { id: 4, x: 500 },
    ];
    expect(findOverlapsInRange(arr, 500, 10).map(e => e.id)).toEqual([4]);
  });
});

describe('matchesFilter', () => {
  it('rejects dead entities unconditionally', () => {
    const e = entity(1, 0, { dead: true });
    expect(matchesFilter(e)).toBe(false);
  });

  it('accepts a live entity with no filters set', () => {
    const e = entity(1, 0);
    expect(matchesFilter(e)).toBe(true);
  });

  it('route filter admits only matching routes', () => {
    const land = entity(1, 0, { route: 'land' });
    const air  = entity(2, 0, { route: 'air' });
    expect(matchesFilter(land, ['land'])).toBe(true);
    expect(matchesFilter(air, ['land'])).toBe(false);
    expect(matchesFilter(air, ['land', 'air'])).toBe(true);
  });

  it('empty route list is treated as "no route filter"', () => {
    const e = entity(1, 0, { route: 'tunnel' });
    expect(matchesFilter(e, [])).toBe(true);
  });

  it('side filter rejects mismatched sides', () => {
    const player = entity(1, 0, { side: 'player' });
    const enemy  = entity(2, 0, { side: 'enemy' });
    expect(matchesFilter(player, undefined, 'player')).toBe(true);
    expect(matchesFilter(enemy,  undefined, 'player')).toBe(false);
  });

  it('side filter rejects sideless entities (neutral Gravity Well style)', () => {
    const neutral = entity(1, 0, { side: undefined });
    expect(matchesFilter(neutral, undefined, 'player')).toBe(false);
    // But with NO side filter, neutral entities pass.
    expect(matchesFilter(neutral)).toBe(true);
  });

  it('component filter requires ALL tags', () => {
    const e = entity(1, 0, { components: ['HasHP', 'IsTargetable'] });
    expect(matchesFilter(e, undefined, undefined, ['HasHP'])).toBe(true);
    expect(matchesFilter(e, undefined, undefined, ['HasHP', 'IsTargetable'])).toBe(true);
    expect(matchesFilter(e, undefined, undefined, ['HasHP', 'HasAI'])).toBe(false);
  });

  it('empty component list is treated as "no component filter"', () => {
    const e = entity(1, 0, { components: [] });
    expect(matchesFilter(e, undefined, undefined, [])).toBe(true);
  });
});

// --- SpatialIndex (stateful wrapper) -------------------------------

describe('SpatialIndex.add / remove', () => {
  it('tracks size as entities are added and removed', () => {
    const idx = new SpatialIndex();
    expect(idx.size).toBe(0);

    const a = entity(1, 100);
    const b = entity(2, 50);
    const c = entity(3, 200);
    idx.add(a);
    idx.add(b);
    idx.add(c);
    expect(idx.size).toBe(3);

    idx.remove(b);
    expect(idx.size).toBe(2);

    // Removing an unknown entity is a silent no-op.
    idx.remove(entity(99, 0));
    expect(idx.size).toBe(2);
  });

  it('is idempotent on duplicate add', () => {
    const idx = new SpatialIndex();
    const a = entity(1, 0);
    idx.add(a);
    idx.add(a);
    expect(idx.size).toBe(1);
  });
});

describe('SpatialIndex.query — range', () => {
  it('returns [] on an empty index', () => {
    const idx = new SpatialIndex();
    expect(idx.query({ x: 0, range: 50 })).toEqual([]);
  });

  it('returns the single entity when inside range', () => {
    const idx = new SpatialIndex();
    const a = entity(1, 100);
    idx.add(a);
    expect(idx.query({ x: 100, range: 10 })).toEqual([a]);
  });

  it('returns [] when the single entity is outside range', () => {
    const idx = new SpatialIndex();
    idx.add(entity(1, 100));
    expect(idx.query({ x: 0, range: 50 })).toEqual([]);
  });

  it('returns only entities within [cx-range, cx+range]', () => {
    const idx = new SpatialIndex();
    for (const e of [
      entity(1, 0),
      entity(2, 50),
      entity(3, 100),
      entity(4, 150),
      entity(5, 200),
    ]) idx.add(e);
    const ids = idx.query({ x: 100, range: 50 }).map(e => e.id).sort();
    expect(ids).toEqual([2, 3, 4]);
  });

  it('range boundary is inclusive', () => {
    const idx = new SpatialIndex();
    const edge = entity(1, 150);
    idx.add(edge);
    idx.add(entity(2, 151));
    const got = idx.query({ x: 100, range: 50 }).map(e => e.id);
    expect(got).toEqual([1]);
  });
});

describe('SpatialIndex.query — filters', () => {
  it('route filter returns only matching routes', () => {
    const idx = new SpatialIndex();
    idx.add(entity(1, 100, { route: 'land' }));
    idx.add(entity(2, 100, { route: 'air' }));
    idx.add(entity(3, 100, { route: 'tunnel' }));

    const land = idx.query({ x: 100, range: 5, routes: ['land'] }).map(e => e.id);
    expect(land).toEqual([1]);

    const cross = idx.query({ x: 100, range: 5, routes: ['land', 'air'] }).map(e => e.id).sort();
    expect(cross).toEqual([1, 2]);
  });

  it('side filter rejects mismatched sides', () => {
    const idx = new SpatialIndex();
    idx.add(entity(1, 100, { side: 'player' }));
    idx.add(entity(2, 100, { side: 'enemy' }));
    const got = idx.query({ x: 100, range: 5, side: 'enemy' }).map(e => e.id);
    expect(got).toEqual([2]);
  });

  it('component filter requires ALL tags', () => {
    const idx = new SpatialIndex();
    idx.add(entity(1, 100, { components: ['HasHP', 'HasAI'] }));
    idx.add(entity(2, 100, { components: ['HasHP'] }));

    const withAi = idx.query({ x: 100, range: 5, components: ['HasAI'] }).map(e => e.id);
    expect(withAi).toEqual([1]);

    const withHp = idx.query({ x: 100, range: 5, components: ['HasHP'] }).map(e => e.id).sort();
    expect(withHp).toEqual([1, 2]);
  });

  it('dead entities are excluded from query results', () => {
    const idx = new SpatialIndex();
    const a = entity(1, 100);
    idx.add(a);
    expect(idx.query({ x: 100, range: 5 })).toHaveLength(1);
    a.dead = true;
    expect(idx.query({ x: 100, range: 5 })).toHaveLength(0);
  });
});

describe('SpatialIndex.update — post-movement re-sort', () => {
  it('handles a rightward move past a neighbor', () => {
    const idx = new SpatialIndex();
    const a = entity(1, 0);
    const b = entity(2, 10);
    const c = entity(3, 20);
    idx.add(a); idx.add(b); idx.add(c);

    a.x = 15; // crosses b
    idx.update(a);

    const got = idx.query({ x: 12, range: 5 }).map(e => e.id).sort();
    expect(got).toEqual([1, 2]);
  });

  it('handles a leftward move past a neighbor', () => {
    const idx = new SpatialIndex();
    const a = entity(1, 0);
    const b = entity(2, 10);
    const c = entity(3, 20);
    idx.add(a); idx.add(b); idx.add(c);

    c.x = 5; // jumps past b
    idx.update(c);

    const got = idx.query({ x: 5, range: 5 }).map(e => e.id).sort();
    expect(got).toEqual([1, 2, 3]);
  });

  it('no-op update when position is unchanged', () => {
    const idx = new SpatialIndex();
    const a = entity(1, 100);
    idx.add(a);
    idx.update(a);
    expect(idx.query({ x: 100, range: 0 }).map(e => e.id)).toEqual([1]);
  });

  it('update on an untracked entity is a silent no-op', () => {
    const idx = new SpatialIndex();
    const ghost = entity(999, 100);
    expect(() => idx.update(ghost)).not.toThrow();
    expect(idx.size).toBe(0);
  });
});

describe('SpatialIndex — edge cases', () => {
  it('query across many stacked-at-same-x entities returns all of them', () => {
    const idx = new SpatialIndex();
    for (let i = 0; i < 10; i++) idx.add(entity(i, 100));
    expect(idx.query({ x: 100, range: 0 }).length).toBe(10);
  });

  it('clear() empties the index', () => {
    const idx = new SpatialIndex();
    idx.add(entity(1, 0));
    idx.add(entity(2, 100));
    idx.clear();
    expect(idx.size).toBe(0);
    expect(idx.query({ x: 50, range: 1000 })).toEqual([]);
  });

  it('large number of entities sorts correctly by x after random inserts', () => {
    const idx = new SpatialIndex();
    const xs = [340, 12, 999, 45, 780, 120, 55, 600, 333, 7];
    xs.forEach((x, i) => idx.add(entity(i, x)));

    // Range covering everything → results should be dedup'd by reference,
    // and every entity should be reachable.
    expect(idx.query({ x: 500, range: 1000 }).length).toBe(xs.length);
  });
});

// Decision 1 validation — the pure-function equivalent of the Phase 1
// TargetDummy smoke test. A non-Unit WorldEntity with only HasHP +
// IsTargetable must (a) be queryable by spatial+component filters,
// (b) be invisible to AI-requiring selectors, (c) coexist in the index
// alongside full Units without breaking either.
describe('non-Unit entity in the index (TargetDummy shape)', () => {
  it('HP-only dummy is returned by HasHP query, not by HasAI query', () => {
    const idx = new SpatialIndex();
    const unit  = entity(1,   100, { components: ['HasHP', 'HasAI', 'IsTargetable'] });
    const dummy = entity(999, 100, { components: ['HasHP', 'IsTargetable'] });
    idx.add(unit);
    idx.add(dummy);

    const hasHp = idx.query({ x: 100, range: 5, components: ['HasHP'] }).map(e => e.id).sort();
    expect(hasHp).toEqual([1, 999]);

    const hasAi = idx.query({ x: 100, range: 5, components: ['HasAI'] }).map(e => e.id);
    expect(hasAi).toEqual([1]);

    const targetable = idx.query({ x: 100, range: 5, components: ['IsTargetable'] }).map(e => e.id).sort();
    expect(targetable).toEqual([1, 999]);
  });

  it('dummy without side is excluded when a side filter is applied', () => {
    const idx = new SpatialIndex();
    idx.add(entity(1,   100, { side: 'player' }));
    idx.add(entity(999, 100, { side: undefined, components: ['HasHP', 'IsTargetable'] }));

    const player = idx.query({ x: 100, range: 5, side: 'player' }).map(e => e.id);
    expect(player).toEqual([1]);
  });
});
