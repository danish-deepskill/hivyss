// Hive maturation (VISION §2.1) — the per-battle TECH-UP arc. The young hive
// matures through discrete phases by PLAYER INVESTMENT (the classic tech-vs-
// units decision — never "mature by winning", which snowballs): Phase 1
// fields only the low tiers, Phase 2 unlocks the Elites, Phase 3 unlocks the
// Royal's ULTIMATE. Costs compete with army, workers, and commands out of the
// built economy. All numbers are playtest knobs.

/** Master switch — false removes all gating (legacy behavior). */
export const MATURATION_ENABLED = true;

export interface MaturationPhase {
  /** Display name — phases are a STORY (Early/Mid/Late), not numbers. */
  name: string;
  /** Highest unit tier deployable in this phase (99 = uncapped). */
  tierCap: number;
  /** Hive capacity in this phase — the young hive holds fewer bodies;
   *  maturing physically GROWS the hive, not just the unlock list. */
  capacity: number;
  /** Passive nectar floor (n/s) — the mature hive secretes more. */
  passiveIncome: number;
  /** The Royal's ultimate is available from this phase on. */
  royalUlt: boolean;
  /** Cost to ADVANCE INTO this phase (undefined on the starting phase).
   *  Three axes: nectar (the wallet), larvae (production throughput), and
   *  VYSS (the battle) — the hive grows by consuming the fallen, so maturing
   *  REQUIRES engaging the war; no turtle-eco straight to Late. (Amends the
   *  "vyss never buys tech" ruling: a bounded twice-per-battle sink is the
   *  anti-snowball, not the snowball — continuous spends stay command-only.) */
  cost?: { nectar: number; larvae: number; vyss: number };
  /** FUTURE HOOK (declared, not yet enforced): per-phase unlocks for
   *  pheromone commands / hive abilities — e.g. the signature pheromone
   *  gated to Late. Wire when the kit layer needs pacing. */
  unlocks?: { pheromones?: string[]; abilities?: string[] };
}

/** Early → Mid → Late. Index 0 is the battle's opening state.
 *  Costs are ERA TRANSITIONS, not upgrades — each should be among the biggest
 *  purchases of the battle (a real bank-up that competes with 2-3 Elites'
 *  worth of army), and the larvae bite production throughput too: the hive
 *  invests its own brood into growing. */
export const MATURATION_PHASES: MaturationPhase[] = [
  { name: 'Early', tierCap: 1,  capacity: 12, passiveIncome: 1, royalUlt: false },                                            // fodder + soldiers
  { name: 'Mid',   tierCap: 2,  capacity: 16, passiveIncome: 2, royalUlt: false, cost: { nectar: 250, larvae: 1, vyss: 20 } }, // the Elites
  { name: 'Late',  tierCap: 99, capacity: 20, passiveIncome: 3, royalUlt: true,  cost: { nectar: 450, larvae: 2, vyss: 40 } }, // everything + the ultimate
];
