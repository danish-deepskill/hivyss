import Phaser from 'phaser';
import { MAX_GOLD } from '../config/Constants';

export class EconomyManager {
  scene: Phaser.Scene;
  gold: number;
  maxGold: number;
  income: number;
  incomeAcc: number;
  elapsed: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gold = 80;
    this.maxGold = MAX_GOLD;
    this.income = 8;
    this.incomeAcc = 0;
    this.elapsed = 0;
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.incomeAcc += dt;
    if (this.incomeAcc >= 1) {
      this.incomeAcc -= 1;
      this.gold = Math.min(this.maxGold, this.gold + this.income);
      // Increase income slowly over time
      this.income = Math.min(30, 8 + Math.floor(this.elapsed / 30) * 2);
    }
  }

  canAfford(cost: number): boolean {
    return this.gold >= cost;
  }

  spend(cost: number): boolean {
    if (this.gold < cost) return false;
    this.gold -= cost;
    return true;
  }

  earn(amount: number): void {
    this.gold = Math.min(this.maxGold, this.gold + amount);
  }

  getGoldPercent(): number {
    return (this.gold / this.maxGold) * 100;
  }
}
