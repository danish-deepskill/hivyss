// Phase 6 follow-up #2 — BaseEntity wrapper tests.
//
// Pure-function tests over the wrapper's contract:
//   - WorldEntity field shape (id, x, y, dead, components)
//   - SpatialEntity fields (route, side)
//   - HP read-through, damage delegation, dead derivation
//   - Component set is exactly { HasHP, IsTargetable, HasAllegiance }
//
// We use a stub BaseStructure rather than the real one (real
// BaseStructure extends Phaser.Container and needs a Scene). The
// stub satisfies the structural contract BaseEntity actually reads
// from (`hp`, `maxHp`, `setHp`, `flash`, `side`).

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseEntity, resetBaseUid } from '../../src/entities/BaseEntity';
import type { BaseStructure } from '../../src/entities/BaseStructure';
import type { Side } from '../../src/types';

// Stub BaseStructure satisfying the fields BaseEntity reads.
function makeStubBase(side: Side, hp: number = 1000): BaseStructure {
  const stub = {
    side,
    hp,
    maxHp: hp,
    flashTimer: 0,
    setHp(n: number): void {
      stub.hp = Math.max(0, Math.min(stub.maxHp, n));
    },
    flash(_d: number = 0.2): void {
      stub.flashTimer = _d;
    },
  } as unknown as BaseStructure;
  return stub;
}

beforeEach(() => {
  resetBaseUid();
});

describe('BaseEntity — WorldEntity contract', () => {
  it('exposes id, x, y, dead, components', () => {
    const stub = makeStubBase('player');
    const e = new BaseEntity(stub, 80);
    expect(typeof e.id).toBe('number');
    expect(e.x).toBe(80);
    expect(e.y).toBe(0);
    expect(e.dead).toBe(false);
    expect(e.components).toBeInstanceOf(Set);
  });

  it('uses a negative id space (does not collide with Unit ids)', () => {
    const a = new BaseEntity(makeStubBase('player'), 80);
    const b = new BaseEntity(makeStubBase('enemy'), 920);
    expect(a.id).toBeLessThan(0);
    expect(b.id).toBeLessThan(0);
    expect(a.id).not.toBe(b.id);
  });

  it('has exactly the locked component set: HasHP, IsTargetable, HasAllegiance', () => {
    const e = new BaseEntity(makeStubBase('player'), 80);
    expect(e.components.has('HasHP')).toBe(true);
    expect(e.components.has('IsTargetable')).toBe(true);
    expect(e.components.has('HasAllegiance')).toBe(true);
    expect(e.components.size).toBe(3);
  });

  it('does NOT have HasAI (excluded from DEFAULT_COMBATANT_FILTER on purpose)', () => {
    const e = new BaseEntity(makeStubBase('player'), 80);
    expect(e.components.has('HasAI')).toBe(false);
  });

  it('does NOT have HasMovement, HasCapacityCost, HasZoneShape (Decision 1 sub-gap B)', () => {
    const e = new BaseEntity(makeStubBase('player'), 80);
    // HasMovement is not in the canonical 11-component set, but the
    // intent is "bases don't move" — verified by the absence of any
    // movement-related field on BaseEntity itself.
    expect(e.components.has('HasCapacityCost')).toBe(false);
    expect(e.components.has('HasZoneShape')).toBe(false);
  });
});

describe('BaseEntity — SpatialEntity contract', () => {
  it('has route="land" (canonical placement)', () => {
    const e = new BaseEntity(makeStubBase('player'), 80);
    expect(e.route).toBe('land');
  });

  it('mirrors structure.side', () => {
    const p = new BaseEntity(makeStubBase('player'), 80);
    const en = new BaseEntity(makeStubBase('enemy'), 920);
    expect(p.side).toBe('player');
    expect(en.side).toBe('enemy');
  });

  it('has unitW=0 (point target — distance measured to wall edge)', () => {
    const e = new BaseEntity(makeStubBase('player'), 80);
    expect(e.unitW).toBe(0);
  });
});

describe('BaseEntity — read-through accessors', () => {
  it('hp / maxHp delegate to underlying structure', () => {
    const stub = makeStubBase('enemy', 5000);
    const e = new BaseEntity(stub, 920);
    expect(e.hp).toBe(5000);
    expect(e.maxHp).toBe(5000);
  });

  it('hp reflects subsequent structure.setHp calls', () => {
    const stub = makeStubBase('enemy', 100);
    const e = new BaseEntity(stub, 920);
    stub.setHp(60);
    expect(e.hp).toBe(60);
  });
});

describe('BaseEntity — damage delegation', () => {
  it('takeDamage subtracts from structure.hp', () => {
    const stub = makeStubBase('enemy', 100);
    const e = new BaseEntity(stub, 920);
    e.takeDamage(30);
    expect(stub.hp).toBe(70);
  });

  it('takeDamage clamps to 0 (BaseStructure.setHp clamps internally)', () => {
    const stub = makeStubBase('enemy', 50);
    const e = new BaseEntity(stub, 920);
    e.takeDamage(999);
    expect(stub.hp).toBe(0);
  });

  it('multiple takeDamage calls accumulate', () => {
    const stub = makeStubBase('enemy', 100);
    const e = new BaseEntity(stub, 920);
    e.takeDamage(20);
    e.takeDamage(15);
    e.takeDamage(10);
    expect(stub.hp).toBe(55);
  });
});

describe('BaseEntity — dead synchronization', () => {
  it('dead is false on a fresh entity', () => {
    const e = new BaseEntity(makeStubBase('player', 100), 80);
    expect(e.dead).toBe(false);
  });

  it('syncDead derives from current hp', () => {
    const stub = makeStubBase('player', 100);
    const e = new BaseEntity(stub, 80);
    stub.setHp(50);
    e.syncDead();
    expect(e.dead).toBe(false);
    stub.setHp(0);
    e.syncDead();
    expect(e.dead).toBe(true);
  });

  it('dead does NOT auto-update without syncDead (caller-driven derivation)', () => {
    const stub = makeStubBase('player', 100);
    const e = new BaseEntity(stub, 80);
    stub.setHp(0);
    // Without syncDead, the cached dead flag is stale.
    expect(e.dead).toBe(false);
    e.syncDead();
    expect(e.dead).toBe(true);
  });

  it('syncDead is idempotent — running twice does not flip back', () => {
    const stub = makeStubBase('enemy', 50);
    const e = new BaseEntity(stub, 920);
    stub.setHp(0);
    e.syncDead();
    e.syncDead();
    expect(e.dead).toBe(true);
  });

  it('a fresh entity built on a 0-hp structure starts dead', () => {
    const stub = makeStubBase('player', 100);
    stub.setHp(0);
    const e = new BaseEntity(stub, 80);
    expect(e.dead).toBe(true);
  });
});
