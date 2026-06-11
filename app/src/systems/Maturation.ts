import { MATURATION_PHASES } from '../config/MaturationDefs';
import type { EconomyManager } from './EconomyManager';
import type { IncubationManager } from './IncubationManager';
import type { VyssEconomy } from './VyssEconomy';

/**
 * Hive maturation (VISION §2.1) — the per-battle tech-up state machine.
 * Phase advances ONLY by spending (mature()); each phase raises the
 * deployable tier cap, and the final phase unlocks the Royal's ultimate.
 * GameManager-layer (the sandbox lab is ungated), like RoyalLifecycle/Forage.
 */
export class Maturation {
  /** Current phase, 1-based (matches the HUD's "PHASE n/3"). */
  phase = 1;

  get phaseCount(): number {
    return MATURATION_PHASES.length;
  }

  /** Display name of the current phase (Early/Mid/Late). */
  get phaseName(): string {
    return MATURATION_PHASES[this.phase - 1].name;
  }

  /** Display name of the FINAL phase (where the ultimate lives). */
  get lastPhaseName(): string {
    return MATURATION_PHASES[MATURATION_PHASES.length - 1].name;
  }

  get tierCap(): number {
    return MATURATION_PHASES[this.phase - 1].tierCap;
  }

  /** Hive capacity in the current phase — maturing GROWS the hive. */
  get capacity(): number {
    return MATURATION_PHASES[this.phase - 1].capacity;
  }

  /** Passive nectar floor (n/s) for the current phase. */
  get passiveIncome(): number {
    return MATURATION_PHASES[this.phase - 1].passiveIncome;
  }

  get royalUltUnlocked(): boolean {
    return MATURATION_PHASES[this.phase - 1].royalUlt;
  }

  /** What the NEXT phase grants, for the MATURE button tooltip; null at max. */
  get nextPerks(): string | null {
    const cur = MATURATION_PHASES[this.phase - 1];
    const next = MATURATION_PHASES[this.phase];
    if (!next) return null;
    const perks: string[] = [];
    perks.push(next.tierCap >= 99 ? 'all tiers' : `tier ${next.tierCap} units`);
    if (next.capacity !== cur.capacity) perks.push(`capacity ${next.capacity}`);
    if (next.passiveIncome !== cur.passiveIncome) perks.push(`+${next.passiveIncome - cur.passiveIncome}⬡/s passive`);
    if (next.royalUlt && !cur.royalUlt) perks.push('the ULTIMATE');
    return perks.join(' · ');
  }

  /** Cost of the NEXT phase, or null at full maturity. */
  get nextCost(): { nectar: number; larvae: number; vyss: number } | null {
    const next = MATURATION_PHASES[this.phase];
    return next?.cost ?? null;
  }

  canDeployTier(tier: number): boolean {
    return tier <= this.tierCap;
  }

  /** Display name of the phase that first allows `tier` — for lock messages. */
  phaseNameForTier(tier: number): string {
    for (const p of MATURATION_PHASES) {
      if (tier <= p.tierCap) return p.name;
    }
    return this.lastPhaseName;
  }

  canMature(economy: EconomyManager, incubation: IncubationManager, vyss: VyssEconomy): boolean {
    const cost = this.nextCost;
    if (!cost) return false;
    if (!economy.canAfford(cost.nectar)) return false;
    if (cost.larvae > 0 && incubation.larvaCount < cost.larvae) return false;
    if (cost.vyss > 0 && !vyss.canAfford(cost.vyss)) return false;
    return true;
  }

  /** Spend and advance. Returns the new phase, or null if it couldn't. */
  mature(economy: EconomyManager, incubation: IncubationManager, vyss: VyssEconomy): number | null {
    const cost = this.nextCost;
    if (!cost || !this.canMature(economy, incubation, vyss)) return null;
    economy.spend(cost.nectar);
    if (cost.larvae > 0) incubation.larvaCount -= cost.larvae;
    if (cost.vyss > 0) vyss.spend(cost.vyss);
    this.phase++;
    return this.phase;
  }
}
