import { describe, it, expect, afterEach } from 'vitest';
import { StructureEntity, type StructureCore } from '../../src/entities/structures/StructureEntity';
import { setTerrainQuery } from '../../src/systems/TerrainDispatch';

// A node-safe fake building (no Phaser). setHp clamps like the real Structure.
function fakeStructure(hp = 100): StructureCore {
  return {
    hp,
    maxHp: hp,
    side: 'player',
    setHp(h: number) { this.hp = Math.max(0, Math.min(this.maxHp, h)); },
    flash() {},
  };
}

afterEach(() => setTerrainQuery(null));

describe('StructureEntity.tickTerrain (Phase A — structures query terrain)', () => {
  it('a building on a damaging cell is corroded (≈ authored dps, framerate-independent)', () => {
    setTerrainQuery(() => ({ dot: { type: 'toxic', dps: 6 } }));
    const s = fakeStructure(100);
    const e = new StructureEntity(s, 300); // no resistance → 'normal' 1.0×
    for (let i = 0; i < 60; i++) e.tickTerrain(1 / 60); // ~1s
    expect(100 - s.hp).toBeGreaterThanOrEqual(5); // ≈6, NOT 60 (per-frame floor)
    expect(100 - s.hp).toBeLessThanOrEqual(6);
  });

  it('a toxic-resistant building shrugs off the same acid cell', () => {
    setTerrainQuery(() => ({ dot: { type: 'toxic', dps: 6 } }));
    const s = fakeStructure(100);
    const e = new StructureEntity(s, 300, { toxic: 'strongest' }); // 0.1× → ~0.6 dps
    for (let i = 0; i < 60; i++) e.tickTerrain(1 / 60);
    expect(100 - s.hp).toBeLessThanOrEqual(1);
  });

  it('takes no damage off terrain', () => {
    setTerrainQuery(() => null);
    const s = fakeStructure(100);
    const e = new StructureEntity(s, 300);
    for (let i = 0; i < 60; i++) e.tickTerrain(1 / 60);
    expect(s.hp).toBe(100);
  });

  it('does not corrode a dead building', () => {
    setTerrainQuery(() => ({ dot: { type: 'toxic', dps: 6 } }));
    const s = fakeStructure(0); // already rubble
    const e = new StructureEntity(s, 300);
    for (let i = 0; i < 60; i++) e.tickTerrain(1 / 60);
    expect(s.hp).toBe(0);
  });
});
