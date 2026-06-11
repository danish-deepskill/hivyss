import type { TierKey, UnitDef, PheromoneKind } from '../types';

// The CORPSE economy — the battle's second, TACTICAL currency. Deaths drop
// PHYSICAL corpse pickups on the field; gatherers SCAVENGE them home (G-mode:
// click a corpse → all gatherers switch to corpse-duty, with the full
// fallback chain: target taken → next corpse → none left → back to the
// blooms). Corpses fund the COMMAND layer only (pheromones + hive abilities),
// never units or tech. Ownership is SPATIAL: your own dead fall near home
// (safe comeback scavenging), your kills fall deep (risk pay) — no share
// knobs, just geography. Battle-scoped; β Swarm will exaggerate this layer
// (corpse-spawn, yield multipliers). All numbers are playtest knobs.

/** Seconds a dropped corpse lasts before the field absorbs it. */
export const CORPSE_DECAY = 14;

/** Pool cap — commands stay a rhythm, not a hoard. */
export const VYSS_MAX = 60;

/** Default corpse yield by tier — bigger vyssids are bigger windfalls.
 *  Override per-unit via UnitDef.vyssYield. */
export const VYSS_TIER_YIELD: Record<number, number> = {
  0: 1, 1: 2, 2: 5, 3: 8, 4: 12,
};

/** A unit's corpse yield: explicit override, else the tier default. */
export function vyssYieldOf(def: Pick<UnitDef, 'vyssYield' | 'tier'>): number {
  return def.vyssYield ?? VYSS_TIER_YIELD[def.tier as TierKey] ?? 1;
}

/** Pheromone command costs (corpses) — the courier Scout is spawned free;
 *  the COMMAND is what costs the hive its harvested chitin. */
export const PHEROMONE_VYSS_COST: Record<PheromoneKind, number> = {
  rally: 8,
  charge: 10,
  retreat: 6,
  frenzy: 12, // the signature command — premium
};
