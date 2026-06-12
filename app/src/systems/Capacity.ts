import type { UnitDef, Side, CasteKey } from '../types';
import { MAX_CAPACITY } from '../config/Constants';

export { MAX_CAPACITY };

// Capacity is fully derived state. There is no manager/cache/event-bus —
// every query walks the live units array + chambers and recomputes from
// scratch. This is deliberate: death frees cap automatically (the unit's
// `dead` flag flips, capUsed skips it on the next read) and cancelled
// incubation frees cap automatically (the chamber slot goes null, capUsed
// sees one less entry). There is no decrement path because there is no
// stored total to decrement. If you find yourself adding increment or
// decrement calls anywhere, stop — you're fighting the model.

interface CapBearer {
  side: Side;
  dead: boolean;
  cap: number;
  caste?: CasteKey;
}

interface CapChamber {
  def: { cap?: number };
}

export function capUsed(
  units: readonly CapBearer[],
  side: Side,
  chambers: readonly (CapChamber | null)[],
): number {
  let total = 0;
  for (const u of units) {
    // ROYALS are hero units (one per hive, auto-spawned, not deployed) — they
    // sit OUTSIDE the army-capacity budget, so the field can hold a full army
    // PLUS the Royal. One rule here covers every geneline's Royal, both sides;
    // a Royal's def `cap` is therefore moot for capacity.
    if (!u.dead && u.side === side && u.caste !== 'royal') total += u.cap;
  }
  for (const c of chambers) {
    if (c) total += c.def.cap ?? 0;
  }
  return total;
}

export function canDeploy(
  def: UnitDef,
  used: number,
  max: number = MAX_CAPACITY,
): boolean {
  return used + (def.cap ?? 0) <= max;
}

export function capRemaining(used: number, max: number = MAX_CAPACITY): number {
  return Math.max(0, max - used);
}
