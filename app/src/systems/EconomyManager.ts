import Phaser from 'phaser';
import { MAX_NECTAR, START_NECTAR } from '../config/Constants';

export class EconomyManager {
  scene: Phaser.Scene;
  nectar: number;
  maxNectar: number;
  income: number;
  incomeAcc: number;
  elapsed: number;
  /** Time-ramped passive income (8→30/s). OFF in forage mode — scaling income
   *  is BUILT (gatherer workers) instead of waited for; the base 8/s stays. */
  rampEnabled = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.nectar = START_NECTAR;
    this.maxNectar = MAX_NECTAR;
    this.income = 8;
    this.incomeAcc = 0;
    this.elapsed = 0;
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.incomeAcc += dt;
    if (this.incomeAcc >= 1) {
      this.incomeAcc -= 1;
      this.nectar = Math.min(this.maxNectar, this.nectar + this.income);
      // Increase income slowly over time (legacy passive ramp; forage mode
      // replaces this scaling with gatherer workers).
      if (this.rampEnabled) this.income = Math.min(30, 8 + Math.floor(this.elapsed / 30) * 2);
    }
  }

  addBaseIncome(amount: number): void {
    this.income += amount;
  }

  canAfford(cost: number): boolean {
    return this.nectar >= cost;
  }

  spend(cost: number): boolean {
    if (this.nectar < cost) return false;
    this.nectar -= cost;
    return true;
  }

  earn(amount: number): void {
    this.nectar = Math.min(this.maxNectar, this.nectar + amount);
  }

  getNectarPercent(): number {
    return (this.nectar / this.maxNectar) * 100;
  }
}
