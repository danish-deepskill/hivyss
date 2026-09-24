import { describe, it, expect } from 'vitest';
import { resolve } from '../../src/systems/ReactionRegistry';
import { emptyCell } from '../../src/systems/TerrainGrid';
import type { TerrainCell } from '../../src/types';

// resolve() is PURE: cell + element → { cell, pulses }. Each reaction is a
// one-line test. No grid, no units, no Phaser.

const cell = (p: Partial<TerrainCell> = {}): TerrainCell => ({ ...emptyCell(), ...p });

describe('ReactionRegistry.resolve — laying base terrain', () => {
  it('chitin lays a raised wall (hp, permanent)', () => {
    const { cell: c, pulses } = resolve(cell(), 'chitin');
    expect(c.state).toBe('raised');
    expect(c.element).toBe('chitin');
    expect(c.hp).toBe(100);
    expect(c.ttl).toBe(Infinity);
    expect(pulses).toEqual([]);
  });

  it('acid lays a draining flood', () => {
    const { cell: c } = resolve(cell(), 'acid');
    expect(c.state).toBe('flooded');
    expect(c.ttl).toBe(8);
  });

  it('silk lays a persistent web', () => {
    const { cell: c } = resolve(cell(), 'silk');
    expect(c.state).toBe('covered');
    expect(c.ttl).toBe(Infinity);
  });

  it('fever and nerve lay NO terrain on an empty cell (trigger-only)', () => {
    expect(resolve(cell(), 'fever').cell.state).toBe('empty');
    expect(resolve(cell(), 'nerve').cell.state).toBe('empty');
  });
});

describe('ReactionRegistry.resolve — reactions', () => {
  it('ignite-web: fever on a silk web → fire pulse, web burns away', () => {
    const web = cell({ state: 'covered', element: 'silk' });
    const { cell: c, pulses } = resolve(web, 'fever');
    expect(c.state).toBe('empty');
    expect(pulses).toEqual([{ type: 'heat', dmg: 40, area: 'cell' }]);
  });

  it('electrify-flood: nerve on a flood → shock+stun pulse, ttl shortened', () => {
    const flood = cell({ state: 'flooded', element: 'acid', ttl: 8 });
    const { cell: c, pulses } = resolve(flood, 'nerve');
    expect(c.state).toBe('flooded'); // still a flood
    expect(c.ttl).toBe(6); // ttlDelta -2
    expect(pulses).toEqual([{ type: 'electric', dmg: 30, stun: 0.5, area: 'route-segment' }]);
  });

  it('corrode-wall: acid melts chitin hp; crumbles to empty past 0', () => {
    const wall = cell({ state: 'raised', element: 'chitin', hp: 100 });
    const once = resolve(wall, 'acid');
    expect(once.cell.hp).toBe(40);
    expect(once.cell.state).toBe('raised');
    expect(once.pulses).toEqual([]);

    const low = cell({ state: 'raised', element: 'chitin', hp: 50 });
    const gone = resolve(low, 'acid'); // 50 - 60 < 0
    expect(gone.cell.state).toBe('empty');
  });

  it('steam: fever on a flood → slow pulse, flood evaporates', () => {
    const flood = cell({ state: 'flooded', element: 'acid' });
    const { cell: c, pulses } = resolve(flood, 'fever');
    expect(c.state).toBe('empty');
    expect(pulses).toEqual([{ type: 'none', slow: 2, area: 'cell' }]);
  });

  it('no-match is a no-op (nerve on a wall: no reaction, no lay)', () => {
    const wall = cell({ state: 'raised', element: 'chitin', hp: 100 });
    const { cell: c, pulses } = resolve(wall, 'nerve');
    expect(c).toBe(wall); // unchanged reference
    expect(pulses).toEqual([]);
  });

  it('first match wins by array order (fever→flood is steam, not ignite)', () => {
    const flood = cell({ state: 'flooded', element: 'acid' });
    expect(resolve(flood, 'fever').pulses[0]).toMatchObject({ slow: 2 });
  });

  it('does not mutate the input cell', () => {
    const wall = cell({ state: 'raised', element: 'chitin', hp: 100 });
    resolve(wall, 'acid');
    expect(wall.hp).toBe(100);
  });
});
