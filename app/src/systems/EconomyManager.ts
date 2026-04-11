import Phaser from 'phaser';
import { MAX_NECTAR } from '../config/Constants';

export class EconomyManager {
  scene: Phaser.Scene;
  nectar: number;
  maxNectar: number;
  income: number;
  incomeAcc: number;
  elapsed: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.nectar = 80;
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
      // Increase income slowly over time
      this.income = Math.min(30, 8 + Math.floor(this.elapsed / 30) * 2);
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
