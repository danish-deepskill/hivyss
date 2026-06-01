import { describe, it, expect } from 'vitest';
import { charge, ram, lunge, combine, NEUTRAL, type MotionCtx } from '../../src/units/motions';

const ctx = (phase: MotionCtx['phase'], phaseT: number, t = 0.5): MotionCtx => ({ t, phase, phaseT });

describe('motion primitives', () => {
  describe('charge', () => {
    const m = charge({ rear: 0.3, lunge: 0.6 });

    it('rears BACK (dx < 0) during windup', () => {
      expect(m(ctx('windup', 1)).dx).toBeLessThan(0);
    });

    it('lunges FORWARD (dx > 0) by the end of active', () => {
      expect(m(ctx('active', 1)).dx).toBeGreaterThan(0);
    });

    it('honors the lunge distance at active peak', () => {
      expect(m(ctx('active', 1)).dx).toBeCloseTo(0.6, 5);
    });

    it('settles toward neutral by the end of recover', () => {
      const r = m(ctx('recover', 1));
      expect(Math.abs(r.dx)).toBeLessThan(1e-6);
      expect(r.lean).toBeCloseTo(0, 5);
    });

    it('always returns finite values across the whole clip', () => {
      for (const phase of ['windup', 'active', 'recover'] as const) {
        for (let p = 0; p <= 1; p += 0.25) {
          const r = m(ctx(phase, p));
          for (const v of [r.dx, r.dy, r.lean, r.squash]) expect(Number.isFinite(v)).toBe(true);
        }
      }
    });
  });

  describe('ram', () => {
    const m = ram({ thrust: 0.6, recoil: 0.25 });

    it('crouches back (dx<0, squash<1) during windup', () => {
      const w = m(ctx('windup', 1));
      expect(w.dx).toBeLessThan(0);
      expect(w.squash).toBeLessThan(1);
    });

    it('thrusts forward to ~thrust by the end of active', () => {
      expect(m(ctx('active', 1)).dx).toBeCloseTo(0.6, 5);
    });

    it('RECOILS backward (dx<0) early in recover — the bounce', () => {
      // at phaseT 0.4 the snap-back reaches -recoil
      expect(m(ctx('recover', 0.4)).dx).toBeCloseTo(-0.25, 5);
    });

    it('settles to neutral by the end of recover', () => {
      expect(m(ctx('recover', 1)).dx).toBeCloseTo(0, 5);
    });
  });

  describe('lunge', () => {
    const m = lunge({ dist: 0.4 });

    it('moves only during the active phase', () => {
      expect(m(ctx('windup', 0.5))).toEqual(NEUTRAL);
      expect(m(ctx('recover', 0.5))).toEqual(NEUTRAL);
      expect(m(ctx('active', 0.5)).dx).toBeGreaterThan(0);
    });

    it('returns to zero offset at the active extremes (arc)', () => {
      expect(m(ctx('active', 0)).dx).toBeCloseTo(0, 5);
      expect(m(ctx('active', 1)).dx).toBeCloseTo(0, 5);
    });
  });

  describe('combine', () => {
    it('sums offsets/lean and multiplies squash', () => {
      const a = charge({ rear: 0.2, lunge: 0.5 });
      const b = lunge({ dist: 0.3 });
      const c = combine(a, b);
      const at = a(ctx('active', 0.5));
      const bt = b(ctx('active', 0.5));
      const ct = c(ctx('active', 0.5));
      expect(ct.dx).toBeCloseTo(at.dx + bt.dx, 5);
      expect(ct.squash).toBeCloseTo(at.squash * bt.squash, 5);
    });
  });
});
