import { describe, it, expect } from 'vitest';
import { advanceConstruction } from '../../src/entities/structures/construction';

describe('advanceConstruction (build-time math)', () => {
  it('completes after buildTime seconds of builder-work', () => {
    let p = 0;
    let complete = false;
    for (let i = 0; i < 60; i++) { // 60 * 0.1s = 6s = buildTime
      const s = advanceConstruction(p, 0.1, 6);
      p = s.progress;
      complete = s.complete;
    }
    expect(complete).toBe(true);
    expect(p).toBe(1);
  });

  it('is partway through before buildTime elapses', () => {
    let p = 0;
    for (let i = 0; i < 30; i++) p = advanceConstruction(p, 0.1, 6).progress; // 3s of 6
    expect(p).toBeCloseTo(0.5, 5);
    expect(advanceConstruction(p, 0.1, 6).complete).toBe(false);
  });

  it('clamps progress at 1 (no overshoot)', () => {
    const s = advanceConstruction(0.95, 1, 1);
    expect(s.progress).toBe(1);
    expect(s.complete).toBe(true);
  });

  it('buildTime 0 completes instantly', () => {
    expect(advanceConstruction(0, 0.1, 0).complete).toBe(true);
  });
});
