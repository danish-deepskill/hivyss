import type { UnitDef } from '../types';

export interface Chamber {
  key: string;
  def: UnitDef;
  remaining: number;
  total: number;
}

export interface HatchedUnit {
  key: string;
  def: UnitDef;
}

export const START_CHAMBERS = 6;
export const MAX_CHAMBERS = 6;
export const CANCEL_REFUND = 0.5;
export const MAX_LARVAE = 10;
export const LARVA_SPAWN_RATE = 5; // seconds per larva
export const START_LARVAE = 3;     // larvae available at game start

export class IncubationManager {
  chambers: (Chamber | null)[];
  numChambers: number;
  larvaCount: number;
  larvaTimer: number;

  constructor(startChambers: number = START_CHAMBERS) {
    this.numChambers = startChambers;
    this.chambers = new Array(MAX_CHAMBERS).fill(null);
    this.larvaCount = START_LARVAE;
    this.larvaTimer = 0;
  }

  /** Queue a unit into the first empty unlocked chamber. Consumes one larva.
   *  Returns chamber index or -1 if full/no larvae. */
  queue(key: string, def: UnitDef): number {
    if (this.larvaCount <= 0) return -1;
    for (let i = 0; i < this.numChambers; i++) {
      if (this.chambers[i] === null) {
        this.chambers[i] = { key, def, remaining: def.incubation, total: def.incubation };
        this.larvaCount--;
        return i;
      }
    }
    return -1;
  }

  /** Whether a unit can be queued (has larvae and an empty chamber). */
  canQueue(): boolean {
    if (this.larvaCount <= 0) return false;
    return !this.isFull();
  }

  /** Cancel an incubating chamber. Returns the nectar to refund, or -1 if slot is empty/locked. Refunds the larva. */
  cancel(index: number): number {
    if (index >= this.numChambers) return -1;
    const chamber = this.chambers[index];
    if (!chamber) return -1;

    const refund = Math.floor(chamber.def.cost * CANCEL_REFUND);
    this.chambers[index] = null;
    this.larvaCount = Math.min(this.larvaCount + 1, MAX_LARVAE);
    return refund;
  }

  /** Tick all chambers and generate larvae. Returns array of units that finished incubation this frame. */
  update(dt: number): HatchedUnit[] {
    // Generate larvae over time
    if (this.larvaCount < MAX_LARVAE) {
      this.larvaTimer += dt;
      if (this.larvaTimer >= LARVA_SPAWN_RATE) {
        this.larvaTimer -= LARVA_SPAWN_RATE;
        this.larvaCount = Math.min(this.larvaCount + 1, MAX_LARVAE);
      }
    } else {
      this.larvaTimer = 0;
    }

    const hatched: HatchedUnit[] = [];

    for (let i = 0; i < this.numChambers; i++) {
      const c = this.chambers[i];
      if (!c) continue;

      c.remaining -= dt;
      if (c.remaining <= 0) {
        hatched.push({ key: c.key, def: c.def });
        this.chambers[i] = null;
      }
    }

    return hatched;
  }

  isFull(): boolean {
    for (let i = 0; i < this.numChambers; i++) {
      if (this.chambers[i] === null) return false;
    }
    return true;
  }

  /** Unlock one additional chamber. Returns false if already at max. */
  unlockChamber(): boolean {
    if (this.numChambers >= MAX_CHAMBERS) return false;
    this.numChambers++;
    return true;
  }
}
