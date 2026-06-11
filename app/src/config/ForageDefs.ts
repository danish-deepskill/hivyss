// Forage — the active economy (VISION §4 worker job (b)). Nectar BLOOMS are
// scattered per-battle (seeded); GATHERER workers run the harvest loop:
// walk out → harvest → carry home → deposit. Carriers are killable (the
// eco-raid counterplay), blooms DEPLETE and wilt, and fresh blooms reseed
// center-biased over time — late-game economy demands map control. The old
// passive ramp is gone; income is built (a +1/s floor prevents softlock).
// All numbers here are playtest knobs.

/** Master switch — false reverts to the old passive income ramp untouched. */
export const FORAGE_ENABLED = true;

/** Passive income floor (n/s) while forage is on — recovery, not an economy.
 *  The +2/s building run-reward stacks on top of this. */
export const PASSIVE_FLOOR = 1;

/** AI hive income multiplier under forage — the AI doesn't gather (v1), so its
 *  passive-era curve is consciously tuned down toward a plausible eco. */
export const AI_INCOME_MULT = 0.7;

/** Bloom archetypes. `carry` = nectar per gatherer trip; `pool` = total nectar
 *  in the bloom before it wilts. Rich blooms render as a 3-flower cluster. */
export const BLOOM_POOR = { carry: 30, pool: 300, rich: false };
export const BLOOM_RICH = { carry: 90, pool: 720, rich: true };

/** Initial scatter (fractions of field width, player side). The POOR bloom
 *  seeds in the safe band, the RICH one deeper — risk premium. */
export const POOR_BAND: [number, number] = [0.10, 0.20];
export const RICH_BAND: [number, number] = [0.24, 0.40];
/** Min x-spacing between blooms (px) so two sites read apart. */
export const BLOOM_SPACING = 160;

/** Reseeding — every CHECK seconds, CHANCE to seed a fresh rich bloom in the
 *  contested CENTER band (the late-game "soft Baron"), capped at MAX_ACTIVE.
 *  When ALL blooms are dry, a reseed fires immediately (no stalemates). */
export const RESEED_CHECK = 20;
export const RESEED_CHANCE = 0.35;
export const RESEED_BAND: [number, number] = [0.35, 0.55];
export const MAX_ACTIVE_BLOOMS = 3;

/** Seconds spent harvesting at the bloom (exposed + stationary). */
export const HARVEST_TIME = 3;

/** Arrival tolerance (px) for "reached the bloom / home". */
export const FORAGE_ARRIVE = 10;

/** Income readout window (sec) — the HUD's forage rate is deposits/window. */
export const RATE_WINDOW = 15;

/** Click radius (px) for picking a bloom in G-mode (gather priority). */
export const BLOOM_CLICK_RADIUS = 70;
