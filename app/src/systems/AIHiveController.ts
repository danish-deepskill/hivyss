// AI Hive Controller — replaces WaveManager for roguelike battles
// Mirrors player systems: economy + incubation + deployment decisions

import Phaser from 'phaser';
import type { IWaveController, IParticleManager, HiveProfile, AIPersonality, UnitRole } from '../types';
import { UNIT_DEFS } from '../units/registry';
import { EventBus } from './EventBus';
import { SeededRNG } from './SeededRNG';
import { IncubationManager } from './IncubationManager';
import type { Chamber } from './IncubationManager';
import { capUsed, capRemaining } from './Capacity';
import type { Unit } from '../entities/Unit';

// Personality-specific tuning
const PERSONALITY_CONFIG: Record<AIPersonality, {
  thinkInterval: number;
  maxPerCycle: number;
  saveMultiplier: number;
  roleWeights: Record<UnitRole, number>;
}> = {
  aggressive: {
    thinkInterval: 2.5,
    maxPerCycle: 3,
    saveMultiplier: 1.0,
    roleWeights: { dps: 4, ranged: 3, tank: 1, support: 1 },
  },
  defensive: {
    thinkInterval: 4.0,
    maxPerCycle: 2,
    saveMultiplier: 1.5,
    roleWeights: { dps: 1, ranged: 2, tank: 4, support: 3 },
  },
  swarm: {
    thinkInterval: 1.5,
    maxPerCycle: 3,
    saveMultiplier: 1.0,
    roleWeights: { dps: 3, ranged: 2, tank: 1, support: 1 },
  },
};

export class AIHiveController implements IWaveController {
  private scene: Phaser.Scene;
  private events: EventBus;
  private rng: SeededRNG;
  private profile: HiveProfile;
  private config: typeof PERSONALITY_CONFIG.aggressive;

  // AI Economy (mirrors player's EconomyManager)
  nectar: number;
  income: number;
  private incomeAcc: number;
  private elapsed: number;

  // AI Incubation (same system as player)
  incubation: IncubationManager;

  // AI Brain
  private thinkAcc: number;

  // Live view of all units (player + enemy) — used to compute enemy cap usage
  private unitsProvider: () => readonly Unit[];

  // Debug log (recent actions, capped)
  debugLog: string[] = [];

  // Intent (visible to player via HUD)
  currentIncubation: { key: string; progress: number } | null = null;
  intent: { action: string; details: string } = { action: 'waiting', details: '' };

  // IWaveController interface
  stage: number;
  waveTimer: number;
  waveInterval: number;
  waveIdx: number;
  enemyQueue: string[];

  get totalWaves(): number { return Infinity; }

  get isComplete(): boolean {
    // AI depleted: broke + no income growth left + nothing incubating + nothing queued
    return this.nectar <= 0
      && this.income >= this.profile.maxIncome
      && !this.incubation.chambers.some(c => c !== null)
      && this.enemyQueue.length === 0;
  }

  getScaleFactor(): number { return 1; }

  constructor(
    scene: Phaser.Scene,
    profile: HiveProfile,
    events: EventBus,
    rng: SeededRNG,
    unitsProvider: () => readonly Unit[],
  ) {
    this.scene = scene;
    this.events = events;
    this.rng = rng;
    this.profile = profile;
    this.config = PERSONALITY_CONFIG[profile.personality];
    this.unitsProvider = unitsProvider;

    // Economy
    this.nectar = profile.startNectar;
    this.income = profile.baseIncome;
    this.incomeAcc = 0;
    this.elapsed = 0;

    // Incubation (same system as player)
    this.incubation = new IncubationManager();

    // Brain
    this.thinkAcc = 0;

    // IWaveController compat
    this.stage = 1;
    this.waveTimer = 0;
    this.waveInterval = 20;
    this.waveIdx = 0;
    this.enemyQueue = [];
  }

  update(dt: number, _particles: IParticleManager | null): void {
    this.elapsed += dt;

    // 1. Economy tick (mirrors EconomyManager)
    this.incomeAcc += dt;
    if (this.incomeAcc >= 1) {
      this.incomeAcc -= 1;
      this.nectar += this.income;
      this.income = Math.min(
        this.profile.maxIncome,
        this.profile.baseIncome + Math.floor(this.elapsed / this.profile.incomeRampTime) * 2,
      );
    }

    // 2. Think tick — AI decides what to incubate
    this.thinkAcc += dt;
    if (this.thinkAcc >= this.config.thinkInterval) {
      this.thinkAcc = 0;
      this.think();
    }

    // Update intent — what will the AI do next?
    this.updateIntent();

    // 3. Incubation tick — hatch units (same as player)
    const hatched = this.incubation.update(dt);
    for (const unit of hatched) {
      // Convert to enemy key and spawn
      const enemyKey = unit.key.startsWith('e') ? unit.key : 'e' + unit.key;
      this.events.emit('unitSpawned', { key: enemyKey, side: 'enemy' });
      this.log(`HATCHED ${unit.key}`);
    }

    // Update intent for HUD — show first active chamber
    const activeChamber = this.incubation.chambers.find(c => c !== null) as Chamber | null;
    if (activeChamber) {
      this.currentIncubation = {
        key: activeChamber.key,
        progress: 1 - activeChamber.remaining / activeChamber.total,
      };
    } else {
      this.currentIncubation = null;
    }

    // Internal score clock — ticks quietly; surfaced to the player as the battle
    // TIMER (HUD), NOT as stages. The roguelike has no stage mechanic, so there's
    // no WAVE! popup and no stage/waveStart event here.
    this.waveTimer += dt;
    if (this.waveTimer >= this.waveInterval) {
      this.waveTimer = 0;
      this.stage++;
      this.waveIdx++;
    }
  }

  private think(): void {
    if (!this.incubation.canQueue()) return;

    const affordable = this.getAffordableUnits();
    if (affordable.length === 0) return;

    let queued = 0;
    while (queued < this.config.maxPerCycle && this.incubation.canQueue()) {
      const candidates = this.getAffordableUnits();
      if (candidates.length === 0) break;

      // Defensive personality saves up
      if (this.config.saveMultiplier > 1) {
        const maxCost = Math.max(...candidates.map(c => c.cost));
        if (this.nectar < maxCost * this.config.saveMultiplier) break;
      }

      // Weighted random selection
      const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
      let roll = this.rng.next() * totalWeight;
      let picked = candidates[0];
      for (const c of candidates) {
        roll -= c.weight;
        if (roll <= 0) { picked = c; break; }
      }

      // Spend nectar and queue into incubation
      this.nectar -= picked.cost;
      const playerKey = picked.key.startsWith('e') ? picked.key.slice(1) : picked.key;
      const def = UNIT_DEFS[playerKey];
      if (def) {
        this.incubation.queue(picked.key, def);
        this.log(`QUEUE ${picked.key} (-${picked.cost}n)`);
      }
      queued++;
    }
  }

  private getAffordableUnits(): { key: string; cost: number; weight: number }[] {
    const results: { key: string; cost: number; weight: number }[] = [];

    // Cap-aware: enemy cap usage = enemy units alive + AI's own incubating chambers.
    // v1 filter only — AI does NOT plan compositions, just won't queue what won't fit.
    const aiCapUsed = capUsed(this.unitsProvider(), 'enemy', this.incubation.chambers);
    const remaining = capRemaining(aiCapUsed);

    for (const key of this.profile.roster) {
      const playerKey = key.startsWith('e') ? key.slice(1) : key;
      const def = UNIT_DEFS[playerKey];
      if (!def) continue;
      if (def.cost > this.nectar) continue;
      if ((def.cap ?? 0) > remaining) continue;

      const weight = this.config.roleWeights[def.role] || 1;
      const cheapBonus = this.profile.personality === 'swarm'
        ? Math.max(0, (50 - def.cost) / 25)
        : 0;

      results.push({ key, cost: def.cost, weight: weight + cheapBonus });
    }

    return results;
  }

  private updateIntent(): void {
    const timeToThink = Math.max(0, this.config.thinkInterval - this.thinkAcc);

    if (!this.incubation.canQueue()) {
      this.intent = { action: 'waiting', details: `No larvae (${Math.ceil(timeToThink)}s)` };
      return;
    }

    const affordable = this.getAffordableUnits();
    if (affordable.length === 0) {
      // Find cheapest unit in roster to show savings target
      const cheapest = this.profile.roster.reduce((min, key) => {
        const pk = key.startsWith('e') ? key.slice(1) : key;
        const def = UNIT_DEFS[pk];
        return def && def.cost < min.cost ? { key, cost: def.cost } : min;
      }, { key: '', cost: Infinity });
      this.intent = {
        action: 'saving',
        details: `${cheapest.key} (need ${cheapest.cost}n, have ${Math.floor(this.nectar)}n)`,
      };
      return;
    }

    // Show top candidate by weight
    const sorted = [...affordable].sort((a, b) => b.weight - a.weight);
    const top = sorted[0];
    const pk = top.key.startsWith('e') ? top.key.slice(1) : top.key;
    const name = UNIT_DEFS[pk]?.name || top.key;
    this.intent = {
      action: 'deploying',
      details: `${name} (${top.cost}n) in ${Math.ceil(timeToThink)}s`,
    };
  }

  private log(msg: string): void {
    const t = Math.floor(this.elapsed);
    this.debugLog.push(`[${t}s] ${msg}`);
    if (this.debugLog.length > 10) this.debugLog.shift();
  }
}
