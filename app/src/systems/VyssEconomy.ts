import { VYSS_MAX } from '../config/VyssDefs';

/**
 * VYSS — the battle's TACTICAL currency: the essence harvested from fallen
 * vyssids. Deaths drop physical corpse pickups; gatherers scavenge them home
 * and the hive renders them into vyss, spent on the COMMAND layer (pheromones
 * + hive abilities). Battle-scoped (a fresh pool every battle). Implements the same wallet shape
 * as EconomyManager (canAfford/spend) so AbilityManager accepts either.
 */
export class VyssEconomy {
  vyss = 0;
  readonly max = VYSS_MAX;

  earn(amount: number): void {
    this.vyss = Math.min(this.max, this.vyss + amount);
  }

  canAfford(cost: number): boolean {
    return this.vyss >= cost;
  }

  spend(cost: number): boolean {
    if (this.vyss < cost) return false;
    this.vyss -= cost;
    return true;
  }
}
