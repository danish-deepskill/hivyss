import Phaser from 'phaser';
import type { AbilityKey, IUnit, IParticleManager } from '../types';
import { ABILITY_DEFS } from '../config/AbilityDefs';
import { BASE_W, WORLD_W, GND, S } from '../config/Constants';
import { EconomyManager } from './EconomyManager';
import { BaseStructure } from '../entities/BaseStructure';
import { EventBus } from './EventBus';
const SBW: number = Math.round(BASE_W * S);

export class AbilityManager {
  scene: Phaser.Scene;
  events: EventBus;
  cooldowns: Record<string, number>;
  wallActive: number;
  slowActive: number;

  constructor(scene: Phaser.Scene, events?: EventBus) {
    this.scene = scene;
    this.events = events || new EventBus();
    this.cooldowns = {};
    Object.keys(ABILITY_DEFS).forEach(k => this.cooldowns[k] = 0);
    this.wallActive = 0;
    this.slowActive = 0;
  }

  update(dt: number): void {
    Object.keys(this.cooldowns).forEach(k => {
      if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    });
    if (this.wallActive > 0) this.wallActive = Math.max(0, this.wallActive - dt);
    if (this.slowActive > 0) this.slowActive = Math.max(0, this.slowActive - dt);
  }

  canCast(key: string, economy: EconomyManager): boolean {
    const def = ABILITY_DEFS[key as AbilityKey];
    return this.cooldowns[key] <= 0 && economy.canAfford(def.cost);
  }

  castNuke(economy: EconomyManager, units: IUnit[], enemyBase: BaseStructure, particles: IParticleManager | null): boolean {
    const def = ABILITY_DEFS.nuke;
    if (!this.canCast('nuke', economy)) return false;
    economy.spend(def.cost);
    this.cooldowns.nuke = def.cooldown;

    const enemies = units.filter(u => u.side === 'enemy' && !u.dead);
    enemies.forEach(u => {
      u.takeDamage(def.damage!);
      u.dmgFlash = 0.6;
      if (u.dead && particles) {
        particles.burst(u.x + u.unitW / 2, u.y + u.unitH / 2, u.col, 14);
        this.events.emit('enemyKilled', { unit: { key: u.key, reward: u.reward, x: u.x, y: u.y } });
        particles.float(u.x + u.unitW / 2, u.y - 18, `+${u.reward}\u2B21`, 0xf0c040);
      }
      if (particles) {
        particles.float(u.x + u.unitW / 2, u.y - 6, `-${def.damage}`, 0xffee44);
      }
    });

    if (particles) {
      particles.burst(WORLD_W / 2, GND - 40, 0xffee44, 20);
    }
    return true;
  }

  castWall(economy: EconomyManager, playerBase: BaseStructure, particles: IParticleManager | null): boolean {
    const def = ABILITY_DEFS.wall;
    if (!this.canCast('wall', economy)) return false;
    economy.spend(def.cost);
    this.cooldowns.wall = def.cooldown;
    this.wallActive = def.duration!;
    playerBase.shielded = true;
    if (particles) {
      particles.burst(SBW / 2, GND - 40, 0x5ac8f8, 12);
    }
    return true;
  }

  castSlow(economy: EconomyManager, units: IUnit[], particles: IParticleManager | null): boolean {
    const def = ABILITY_DEFS.slow;
    if (!this.canCast('slow', economy)) return false;
    economy.spend(def.cost);
    this.cooldowns.slow = def.cooldown;
    this.slowActive = def.duration!;
    units.filter(u => u.side === 'enemy' && !u.dead).forEach(u => {
      u.slowTimer = def.duration!;
    });
    if (particles) {
      particles.burst(WORLD_W / 2, GND - 30, 0x80f8c0, 15);
    }
    return true;
  }

  castRepair(economy: EconomyManager, playerBase: BaseStructure, particles: IParticleManager | null): boolean {
    const def = ABILITY_DEFS.repair;
    if (!this.canCast('repair', economy)) return false;
    economy.spend(def.cost);
    this.cooldowns.repair = def.cooldown;
    playerBase.setHp(playerBase.hp + def.healAmount!);
    playerBase.flash(0.4);
    if (particles) {
      particles.burst(SBW / 2, GND - 40, 0x80f860, 10);
      particles.float(SBW / 2, GND - 55, `+${def.healAmount} HP`, 0x80f860);
    }
    return true;
  }

  getCooldownPercent(key: string): number {
    const def = ABILITY_DEFS[key as AbilityKey];
    const cd = this.cooldowns[key];
    return cd > 0 ? (1 - cd / def.cooldown) * 100 : 100;
  }
}
