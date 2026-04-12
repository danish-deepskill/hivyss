import { describe, it, expect } from 'vitest';
import { capUsed, canDeploy, capRemaining, MAX_CAPACITY } from './Capacity';
import type { UnitDef, Side } from '../types';

// Minimal test stand-ins. Capacity helpers are typed against structural
// interfaces, so plain objects satisfy them — no Phaser/Unit construction.
type TestUnit = { side: Side; dead: boolean; cap: number };
type TestChamber = { def: { cap?: number } } | null;

const unit = (side: Side, cap: number, dead = false): TestUnit => ({ side, cap, dead });
const chamber = (cap: number): TestChamber => ({ def: { cap } });

// Stub UnitDef for canDeploy — only `cap` is read
const def = (cap?: number): UnitDef => ({ cap } as unknown as UnitDef);

describe('capUsed', () => {
  it('returns 0 when no units and no chambers', () => {
    expect(capUsed([], 'player', [])).toBe(0);
  });

  it('sums cap of alive units on the requested side', () => {
    const units = [
      unit('player', 3),
      unit('player', 5),
      unit('player', 1),
    ];
    expect(capUsed(units, 'player', [])).toBe(9);
  });

  it('ignores units of the other side', () => {
    const units = [
      unit('player', 3),
      unit('enemy', 5),
      unit('enemy', 4),
    ];
    expect(capUsed(units, 'player', [])).toBe(3);
    expect(capUsed(units, 'enemy', [])).toBe(9);
  });

  it('frees cap immediately when a unit dies (does not count u.dead)', () => {
    const u1 = unit('player', 5);
    const u2 = unit('player', 3);
    const units = [u1, u2];
    expect(capUsed(units, 'player', [])).toBe(8);
    u1.dead = true;
    expect(capUsed(units, 'player', [])).toBe(3);
  });

  it('counts incubating chambers', () => {
    const chambers: TestChamber[] = [chamber(2), chamber(5), null, chamber(1)];
    expect(capUsed([], 'player', chambers)).toBe(8);
  });

  it('frees cap immediately when a chamber is cancelled (chamber set to null)', () => {
    const chambers: TestChamber[] = [chamber(2), chamber(5), chamber(3)];
    expect(capUsed([], 'player', chambers)).toBe(10);
    chambers[1] = null;
    expect(capUsed([], 'player', chambers)).toBe(5);
  });

  it('combines deployed units and incubating chambers', () => {
    const units = [unit('player', 3), unit('player', 2)];
    const chambers: TestChamber[] = [chamber(4), null, chamber(1)];
    expect(capUsed(units, 'player', chambers)).toBe(10);
  });

  it('treats chambers with undefined cap as 0', () => {
    const chambers: TestChamber[] = [{ def: {} }, chamber(3)];
    expect(capUsed([], 'player', chambers)).toBe(3);
  });

  it('does not count enemy chambers when querying player side', () => {
    // Both sides share the same units array but each has its own chambers list,
    // so the helper just walks whichever chambers were passed.
    const playerChambers: TestChamber[] = [chamber(2)];
    const enemyChambers: TestChamber[] = [chamber(7)];
    const units = [unit('player', 1), unit('enemy', 4)];
    expect(capUsed(units, 'player', playerChambers)).toBe(3);
    expect(capUsed(units, 'enemy', enemyChambers)).toBe(11);
  });
});

describe('canDeploy', () => {
  it('allows deploy when used + cap <= max', () => {
    expect(canDeploy(def(5), 10, 20)).toBe(true);
  });

  it('allows deploy when used + cap exactly equals max', () => {
    expect(canDeploy(def(5), 15, 20)).toBe(true);
  });

  it('rejects deploy when used + cap exceeds max', () => {
    expect(canDeploy(def(5), 16, 20)).toBe(false);
  });

  it('treats undefined cap as 0 (always deployable up to max)', () => {
    expect(canDeploy(def(undefined), 20, 20)).toBe(true);
    expect(canDeploy(def(undefined), 100, 20)).toBe(false);
  });

  it('uses MAX_CAPACITY default when max not provided', () => {
    expect(canDeploy(def(1), MAX_CAPACITY - 1)).toBe(true);
    expect(canDeploy(def(2), MAX_CAPACITY - 1)).toBe(false);
  });
});

describe('capRemaining', () => {
  it('returns max - used', () => {
    expect(capRemaining(7, 20)).toBe(13);
  });

  it('clamps to 0 when used exceeds max', () => {
    expect(capRemaining(25, 20)).toBe(0);
  });

  it('uses MAX_CAPACITY default when max not provided', () => {
    expect(capRemaining(5)).toBe(MAX_CAPACITY - 5);
  });
});

describe('AI cap-aware filter (integration scenario)', () => {
  // Simulates how AIHiveController.getAffordableUnits uses Capacity:
  // it computes enemy cap from live units + its own incubation chambers,
  // then rejects roster picks whose cap > remaining.
  it('AI cannot queue a unit when remaining cap is insufficient', () => {
    const units = [
      unit('enemy', 4),
      unit('enemy', 5),
      unit('player', 3), // ignored — wrong side
    ];
    const aiChambers: TestChamber[] = [chamber(5), chamber(3)];
    const aiUsed = capUsed(units, 'enemy', aiChambers); // 4+5+5+3 = 17
    expect(aiUsed).toBe(17);
    const remaining = capRemaining(aiUsed); // 20-17 = 3
    expect(remaining).toBe(3);

    // Roster picks
    expect(canDeploy(def(2), aiUsed)).toBe(true);  // fits
    expect(canDeploy(def(3), aiUsed)).toBe(true);  // exact fit
    expect(canDeploy(def(4), aiUsed)).toBe(false); // over
    expect(canDeploy(def(5), aiUsed)).toBe(false); // over
  });

  it('after an enemy unit dies, AI can queue what previously did not fit', () => {
    const elite = unit('enemy', 5);
    const units = [unit('enemy', 4), elite];
    const aiChambers: TestChamber[] = [chamber(5), chamber(3)];
    expect(canDeploy(def(4), capUsed(units, 'enemy', aiChambers))).toBe(false);

    // Death frees 5 cap immediately
    elite.dead = true;
    expect(capUsed(units, 'enemy', aiChambers)).toBe(12);
    expect(canDeploy(def(4), capUsed(units, 'enemy', aiChambers))).toBe(true);
  });

  it('after an AI chamber finishes (becomes null), cap drops by that chamber size', () => {
    const units = [unit('enemy', 4)];
    const aiChambers: TestChamber[] = [chamber(5), chamber(3)];
    expect(capUsed(units, 'enemy', aiChambers)).toBe(12);

    // IncubationManager nulls the slot when a unit hatches —
    // but that hatched unit then enters `units`, so net cap is unchanged.
    aiChambers[0] = null;
    units.push(unit('enemy', 5));
    expect(capUsed(units, 'enemy', aiChambers)).toBe(12);
  });
});
