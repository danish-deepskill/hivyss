import { describe, it, expect } from 'vitest';
import { StructureOccupancy } from '../../src/systems/structures/StructureOccupancy';
import type { StructureEntity } from '../../src/entities/structures/StructureEntity';

// Occupancy only stores + compares refs by identity, so a tagged stub is enough.
const ref = (id: number) => ({ id }) as unknown as StructureEntity;

describe('StructureOccupancy', () => {
  it('empty field: nothing overlaps', () => {
    const occ = new StructureOccupancy(640);
    expect(occ.overlaps(300, 16)).toBe(false);
  });

  it('add → footprint overlaps within [x ± halfW], free outside', () => {
    const occ = new StructureOccupancy(640);
    occ.add(ref(1), 300, 16); // occupies [284, 316]
    expect(occ.overlaps(300, 16)).toBe(true);  // same spot
    expect(occ.overlaps(310, 16)).toBe(true);  // [294,326] overlaps
    expect(occ.overlaps(340, 16)).toBe(false); // [324,356] clear
  });

  it('strict overlap — exactly abutting footprints are allowed', () => {
    const occ = new StructureOccupancy(640);
    occ.add(ref(1), 300, 16); // [284, 316]
    // A footprint whose left edge == the placed right edge (332-16 = 316) just touches.
    expect(occ.overlaps(332, 16)).toBe(false);
    // One pixel closer overlaps.
    expect(occ.overlaps(331, 16)).toBe(true);
  });

  it('addSpan (hive footprint) rejects placement inside the span', () => {
    const occ = new StructureOccupancy(2560);
    occ.addSpan(ref(99), 0, 120); // player hive footprint
    expect(occ.overlaps(60, 16)).toBe(true);   // inside the hive span
    expect(occ.overlaps(150, 16)).toBe(false); // clear of it
  });

  it('remove frees the footprint (death / teardown)', () => {
    const occ = new StructureOccupancy(640);
    const r = ref(1);
    occ.add(r, 300, 16);
    expect(occ.overlaps(300, 16)).toBe(true);
    occ.remove(r);
    expect(occ.overlaps(300, 16)).toBe(false);
  });

  it('remove only frees the named ref (others stay occupied)', () => {
    const occ = new StructureOccupancy(640);
    const a = ref(1), b = ref(2);
    occ.add(a, 200, 16);
    occ.add(b, 400, 16);
    occ.remove(a);
    expect(occ.overlaps(200, 16)).toBe(false); // a freed
    expect(occ.overlaps(400, 16)).toBe(true);  // b still there
  });

  it('two non-overlapping structures coexist; the gap between them is free', () => {
    const occ = new StructureOccupancy(640);
    occ.add(ref(1), 200, 16); // [184, 216]
    occ.add(ref(2), 300, 16); // [284, 316]
    expect(occ.overlaps(250, 16)).toBe(false); // [234,266] fits the gap
  });

  it('reset drops all occupancy', () => {
    const occ = new StructureOccupancy(640);
    occ.add(ref(1), 100, 16);
    occ.addSpan(ref(2), 0, 80);
    occ.reset();
    expect(occ.overlaps(100, 16)).toBe(false);
    expect(occ.overlaps(40, 16)).toBe(false);
  });
});
