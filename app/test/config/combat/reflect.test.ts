import { describe, it, expect } from 'vitest';
import { computeReflect } from '../../../src/config/combat/reflect';
import type { DamageEvent } from '../../../src/types';

// Minimal DamageEvent stub — only the fields computeReflect reads.
const ev = (over: Record<string, unknown> = {}): DamageEvent =>
  ({
    isReflected: false,
    finalDamage: 100,
    target: { dead: false, reflect: { pct: 0.3 } },
    attacker: { dead: false },
    ...over,
  }) as unknown as DamageEvent;

describe('computeReflect', () => {
  it('returns pct of finalDamage from a real hit on a reflector', () => {
    const r = computeReflect(ev());
    expect(r).not.toBeNull();
    expect(r!.amount).toBe(30);
  });

  it('returns null when the target carries no reflect', () => {
    expect(computeReflect(ev({ target: { dead: false } }))).toBeNull();
  });

  it('never reflects a reflected hit (the loop break)', () => {
    expect(computeReflect(ev({ isReflected: true }))).toBeNull();
  });

  it('never reflects override damage (DoT / terrain / death)', () => {
    expect(computeReflect(ev({ _baseDamageOverride: 12 }))).toBeNull();
  });

  it('returns null on a whiff (zero damage)', () => {
    expect(computeReflect(ev({ finalDamage: 0 }))).toBeNull();
  });

  it('returns null when the attacker is already dead', () => {
    expect(computeReflect(ev({ attacker: { dead: true } }))).toBeNull();
  });

  it('floors and drops sub-1 reflects', () => {
    // 2 × 0.1 = 0.2 → floored to 0 → dropped
    expect(computeReflect(ev({ finalDamage: 2, target: { dead: false, reflect: { pct: 0.1 } } }))).toBeNull();
  });
});
