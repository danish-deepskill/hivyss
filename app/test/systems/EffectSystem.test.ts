// Phase 5 — EffectSystem integration tests.
//
// Effects have stateful lifecycle hooks (onApply/onTick/onExpire/
// onStack) that mutate target state, so these are integration tests
// rather than pure-function tests. Each test uses a local EffectDef
// with instrumented hooks so we can assert the call sequence and the
// resulting state — this is exactly the pattern Decision 6 calls out
// for stateful systems.

import { describe, it, expect } from 'vitest';
import type { EffectDef, EffectBearer, ActiveEffect } from '../../src/config/combat/effects/types';
import {
  applyEffect,
  removeEffect,
  updateEffects,
  findActiveEffect,
  hasActiveEffect,
  countActiveEffect,
} from '../../src/systems/EffectSystem';

// --- Test helpers ---

type Call = { kind: 'apply' | 'tick' | 'expire' | 'stack'; name: string };

function makeLog(): { calls: Call[]; reset: () => void } {
  const calls: Call[] = [];
  return {
    calls,
    reset: () => { calls.length = 0; },
  };
}

function makeTarget(): EffectBearer & { id: number } {
  return { id: Math.random(), dead: false, activeEffects: [] };
}

function makeEffect(overrides: Partial<EffectDef> & { name: string }, log: Call[]): EffectDef {
  return {
    duration: 3,
    stackable: false,
    onApply: (_t, _ctx) => { log.push({ kind: 'apply', name: overrides.name }); },
    onTick: (_t, _dt, _ctx) => { log.push({ kind: 'tick', name: overrides.name }); },
    onExpire: (_t, _ctx) => { log.push({ kind: 'expire', name: overrides.name }); },
    onStack: (_t, _e, _i) => { log.push({ kind: 'stack', name: overrides.name }); },
    ...overrides,
  };
}

// --- applyEffect: basic cases ---

describe('applyEffect — basic', () => {
  it('adds a new ActiveEffect to target.activeEffects', () => {
    const log = makeLog();
    const burn = makeEffect({ name: 'burn' }, log.calls);
    const t = makeTarget();
    const result = applyEffect(t, burn);
    expect(result).not.toBeNull();
    expect(t.activeEffects).toHaveLength(1);
    expect(t.activeEffects![0].def.name).toBe('burn');
    expect(log.calls).toEqual([{ kind: 'apply', name: 'burn' }]);
  });

  it('initializes remaining to def.duration', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x', duration: 7 }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    expect(t.activeEffects![0].remaining).toBe(7);
  });

  it('respects opts.remaining override', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x', duration: 7 }, log.calls);
    const t = makeTarget();
    applyEffect(t, e, { remaining: 2 });
    expect(t.activeEffects![0].remaining).toBe(2);
  });

  it('stores the source on the ActiveEffect', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x' }, log.calls);
    const t = makeTarget();
    const source = { id: 42 };
    applyEffect(t, e, { source });
    expect(t.activeEffects![0].source).toBe(source);
  });

  it('rejects application to a dead target', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x' }, log.calls);
    const t = makeTarget();
    t.dead = true;
    expect(applyEffect(t, e)).toBeNull();
    expect(log.calls).toHaveLength(0);
  });

  it('creates activeEffects array lazily if absent', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x' }, log.calls);
    const t: EffectBearer = { dead: false };
    applyEffect(t, e);
    expect(t.activeEffects).toHaveLength(1);
  });
});

// --- applyEffect: non-stackable semantics ---

describe('applyEffect — non-stackable', () => {
  it('re-apply merges into existing instance without onApply', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'stun', stackable: false, duration: 2 }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);                 // apply fires
    applyEffect(t, e, { remaining: 5 }); // apply does NOT fire again
    expect(t.activeEffects).toHaveLength(1);
    expect(t.activeEffects![0].remaining).toBe(5); // max-wins
    expect(log.calls.filter(c => c.kind === 'apply')).toHaveLength(1);
  });

  it('re-apply with shorter remaining does not shrink existing', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'stun', stackable: false, duration: 5 }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    applyEffect(t, e, { remaining: 1 });
    expect(t.activeEffects![0].remaining).toBe(5);
  });

  it('onStack does NOT fire for non-stackable', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'stun', stackable: false }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    applyEffect(t, e);
    expect(log.calls.filter(c => c.kind === 'stack')).toHaveLength(0);
  });
});

// --- applyEffect: stackable semantics ---

describe('applyEffect — stackable', () => {
  it('re-apply appends a new entry and fires onApply again', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'burn', stackable: true }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    applyEffect(t, e);
    expect(t.activeEffects).toHaveLength(2);
    expect(log.calls.filter(c => c.kind === 'apply')).toHaveLength(2);
  });

  it('fires onStack on the existing entry BEFORE appending the new one', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'burn', stackable: true }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    log.reset();
    applyEffect(t, e);
    // Expect onStack before onApply
    expect(log.calls).toEqual([
      { kind: 'stack', name: 'burn' },
      { kind: 'apply', name: 'burn' },
    ]);
  });

  it('onStack does NOT fire on first application', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'burn', stackable: true }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    expect(log.calls.filter(c => c.kind === 'stack')).toHaveLength(0);
  });

  it('maxStacks caps the count and rejects overflow', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'burn', stackable: true, maxStacks: 3 }, log.calls);
    const t = makeTarget();
    expect(applyEffect(t, e)).not.toBeNull();
    expect(applyEffect(t, e)).not.toBeNull();
    expect(applyEffect(t, e)).not.toBeNull();
    expect(applyEffect(t, e)).toBeNull();
    expect(countActiveEffect(t, 'burn')).toBe(3);
  });

  it('each stack has an independent remaining', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'burn', stackable: true, duration: 5 }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    applyEffect(t, e, { remaining: 2 });
    expect(t.activeEffects![0].remaining).toBe(5);
    expect(t.activeEffects![1].remaining).toBe(2);
  });
});

// --- prevents semantics ---

describe('applyEffect — prevents', () => {
  it('forward prevents clears listed existing effects on apply', () => {
    const log = makeLog();
    const burn = makeEffect({ name: 'burn', stackable: true }, log.calls);
    const freeze = makeEffect({ name: 'freeze', stackable: false, prevents: ['burn'] }, log.calls);
    const t = makeTarget();
    applyEffect(t, burn);
    applyEffect(t, burn);
    log.reset();
    applyEffect(t, freeze);
    // Both burns should have been removed + onExpire fired for each
    expect(hasActiveEffect(t, 'burn')).toBe(false);
    expect(hasActiveEffect(t, 'freeze')).toBe(true);
    expect(log.calls.filter(c => c.kind === 'expire' && c.name === 'burn')).toHaveLength(2);
    expect(log.calls.filter(c => c.kind === 'apply' && c.name === 'freeze')).toHaveLength(1);
  });

  it('reverse prevents rejects an application when an existing effect blocks it', () => {
    const log = makeLog();
    const burn = makeEffect({ name: 'burn', stackable: true }, log.calls);
    const freeze = makeEffect({ name: 'freeze', stackable: false, prevents: ['burn'] }, log.calls);
    const t = makeTarget();
    applyEffect(t, freeze);
    log.reset();
    const result = applyEffect(t, burn);
    expect(result).toBeNull();
    expect(hasActiveEffect(t, 'burn')).toBe(false);
    expect(log.calls).toHaveLength(0);
  });
});

// --- removeEffect ---

describe('removeEffect', () => {
  it('removes every matching instance and fires onExpire on each', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'burn', stackable: true }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    applyEffect(t, e);
    applyEffect(t, e);
    log.reset();
    expect(removeEffect(t, 'burn')).toBe(3);
    expect(log.calls.filter(c => c.kind === 'expire')).toHaveLength(3);
    expect(t.activeEffects).toHaveLength(0);
  });

  it('returns 0 and no-ops when effect is absent', () => {
    const t = makeTarget();
    expect(removeEffect(t, 'burn')).toBe(0);
  });

  it('leaves unrelated effects untouched', () => {
    const log = makeLog();
    const burn = makeEffect({ name: 'burn', stackable: true }, log.calls);
    const slow = makeEffect({ name: 'slow' }, log.calls);
    const t = makeTarget();
    applyEffect(t, burn);
    applyEffect(t, slow);
    removeEffect(t, 'burn');
    expect(hasActiveEffect(t, 'slow')).toBe(true);
    expect(hasActiveEffect(t, 'burn')).toBe(false);
  });
});

// --- updateEffects (the tick loop) ---

describe('updateEffects', () => {
  it('fires onTick for each active effect per call', () => {
    const log = makeLog();
    const burn = makeEffect({ name: 'burn', stackable: true, duration: 100 }, log.calls);
    const t = makeTarget();
    applyEffect(t, burn);
    applyEffect(t, burn);
    log.reset();
    updateEffects([t], 0.1);
    expect(log.calls.filter(c => c.kind === 'tick')).toHaveLength(2);
  });

  it('decrements remaining by dt', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x', duration: 5 }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    updateEffects([t], 2);
    expect(t.activeEffects![0].remaining).toBe(3);
  });

  it('removes expired effects and fires onExpire', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x', duration: 1 }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    log.reset();
    updateEffects([t], 1);
    expect(t.activeEffects).toHaveLength(0);
    expect(log.calls).toEqual([
      { kind: 'tick', name: 'x' },
      { kind: 'expire', name: 'x' },
    ]);
  });

  it('skips dead targets at loop entry (no tick, no expire)', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x' }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    log.reset();
    t.dead = true;
    updateEffects([t], 1);
    expect(log.calls).toHaveLength(0);
  });

  it('stops ticking an entity mid-loop if an onTick kills it', () => {
    const log = makeLog();
    // First effect's onTick kills the target; second effect should not tick.
    const killer: EffectDef = {
      name: 'killer',
      duration: 10,
      stackable: false,
      onTick: (target) => {
        log.calls.push({ kind: 'tick', name: 'killer' });
        target.dead = true;
      },
    };
    const other = makeEffect({ name: 'other', duration: 10 }, log.calls);
    const t = makeTarget();
    // Note: iteration is reverse, so order of application matters.
    // We want 'killer' to tick before 'other'. Apply other first
    // (index 0), killer second (index 1) — reverse loop picks killer
    // first, kills target, then `break` skips other.
    applyEffect(t, other);
    applyEffect(t, killer);
    log.reset();
    updateEffects([t], 1);
    expect(log.calls).toEqual([{ kind: 'tick', name: 'killer' }]);
  });

  it('handles multiple entities independently', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x', duration: 5 }, log.calls);
    const a = makeTarget();
    const b = makeTarget();
    applyEffect(a, e);
    applyEffect(b, e);
    log.reset();
    updateEffects([a, b], 1);
    expect(log.calls.filter(c => c.kind === 'tick')).toHaveLength(2);
    expect(a.activeEffects![0].remaining).toBe(4);
    expect(b.activeEffects![0].remaining).toBe(4);
  });

  it('large dt removes effect in one tick', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x', duration: 3 }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    updateEffects([t], 10);
    expect(t.activeEffects).toHaveLength(0);
  });
});

// --- Query helpers ---

describe('findActiveEffect / hasActiveEffect / countActiveEffect', () => {
  it('find returns the first instance', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x', stackable: true }, log.calls);
    const t = makeTarget();
    applyEffect(t, e, { remaining: 1 });
    applyEffect(t, e, { remaining: 2 });
    const found = findActiveEffect(t, 'x')!;
    expect(found.remaining).toBe(1);
  });

  it('find returns undefined when absent', () => {
    const t = makeTarget();
    expect(findActiveEffect(t, 'x')).toBeUndefined();
  });

  it('has is true when at least one instance exists', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x' }, log.calls);
    const t = makeTarget();
    expect(hasActiveEffect(t, 'x')).toBe(false);
    applyEffect(t, e);
    expect(hasActiveEffect(t, 'x')).toBe(true);
  });

  it('count returns the number of stacked instances', () => {
    const log = makeLog();
    const e = makeEffect({ name: 'x', stackable: true }, log.calls);
    const t = makeTarget();
    applyEffect(t, e);
    applyEffect(t, e);
    applyEffect(t, e);
    expect(countActiveEffect(t, 'x')).toBe(3);
  });
});
