import type { PheromoneKind } from '../types';

/**
 * Pheromone command definitions — the player-painted lane/movement zones
 * (Rally / Charge / Retreat). See `app/docs/mvp/ALPHA.md` §2
 * for the design intent (tight-vs-spread tension drives α's Pack Cohesion).
 *
 * `radius` here is the authoring default copied onto each placed
 * `PheromoneZone`; `duration` is the zone lifetime in seconds (decayed in
 * GameManager.tick). NUMBERS ARE PLACEHOLDERS — tuned at the Phase-0
 * playtest gate, not design.
 */
export interface PheromoneDef {
  /** Display name (HUD button label). */
  name: string;
  /** Zone fill / ring color. */
  color: number;
  /** Default influence radius in px. */
  radius: number;
  /** Lifetime in seconds. */
  duration: number;
}

export const PHEROMONE_DEFS: Record<PheromoneKind, PheromoneDef> = {
  rally:   { name: 'Rally',   color: 0x40c0ff, radius: 90,  duration: 8 },
  charge:  { name: 'Charge',  color: 0xff8030, radius: 110, duration: 6 },
  retreat: { name: 'Retreat', color: 0xc060ff, radius: 90,  duration: 7 },
};

/** Stable ordering for HUD button rows / keyboard binding (1/2/3). */
export const PHEROMONE_ORDER: PheromoneKind[] = ['rally', 'charge', 'retreat'];

// --- Deposit-fade trail (VISION §5) — the courier Scout lays scent as it runs ---
// A Scout carrying a command drops a small fading scent-blob every TRAIL_SPACING
// px it travels. The trail = the union of live blobs; a unit obeys if it sits in
// ANY blob. Kill the courier → no new drops → the trail is exactly as long as it
// survived (proportional deposit); laid blobs fade on their own timer. Placeholder
// numbers, tuned at the playtest gate.
export const TRAIL_SPACING = 28;     // px between dropped blobs
export const TRAIL_BLOB_RADIUS = 26; // each blob's influence radius (overlap → continuous trail)
export const TRAIL_BLOB_FADE = 5;    // seconds a blob lives before it fades out
