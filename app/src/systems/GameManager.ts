import Phaser from 'phaser';
import type { UnitDef, WaveDef, Side, AbilityKey, RenderUnit } from '../types';
import { resolveColors } from '../config/Palettes';
import { W, DEFAULT_WORLD_W, SBW as SBW_CONST } from '../config/Constants';
import type { RunBuff } from './RunState';
// W = viewport width (used for camera), worldW = per-battle battlefield width
import { UNIT_DEFS, drawUnit } from '../units/registry';
import { ENEMY_DEFS } from '../config/EnemyDefs';
import { BaseStructure } from '../entities/BaseStructure';
import { Unit, resetUid } from '../entities/Unit';
import { CombatSystem } from './CombatSystem';
import { WaveManager } from './WaveManager';
import { EconomyManager } from './EconomyManager';
import { AbilityManager } from './AbilityManager';
import { ParticleManager } from './ParticleManager';
import { AudioManager } from './AudioManager';
import { SaveManager } from './SaveManager';
import { IncubationManager } from './IncubationManager';
import { EventBus } from './EventBus';
import { UnitPool } from './UnitPool';
import { CocoonVisuals } from '../entities/CocoonVisuals';
import { LarvaVisuals } from '../entities/LarvaVisuals';
import { registerDebugCommand, unregisterDebugCommand } from './DebugConsole';

export interface SpawnResult {
  success: boolean;
  message: string;
}

export class GameManager {
  scene: Phaser.Scene;
  events: EventBus;
  audio: AudioManager;
  combat: CombatSystem;
  waves: WaveManager;
  economy: EconomyManager;
  abilities: AbilityManager;
  particles: ParticleManager;
  incubation: IncubationManager;
  cocoons: CocoonVisuals;
  larvae: LarvaVisuals;
  playerBase: BaseStructure;
  enemyBase: BaseStructure;
  unitPool: UnitPool;
  units: Unit[];
  deckKeys: string[];
  SBW: number;
  worldW: number;

  // Game state
  running: boolean;
  won: string | null;
  kills: number;
  elapsed: number;

  // Camera
  manualPanTimer: number;

  constructor(scene: Phaser.Scene, deckKeys: string[], startWave: number = 1, worldW: number = DEFAULT_WORLD_W, customWaves?: WaveDef[], runBuffs?: RunBuff[]) {
    this.scene = scene;
    this.events = new EventBus();
    this.worldW = worldW;
    resetUid();

    // Deck
    this.deckKeys = deckKeys;

    // Create bases
    const SBW = SBW_CONST;
    this.SBW = SBW;
    this.playerBase = new BaseStructure(scene, 0, 'player');
    this.enemyBase = new BaseStructure(scene, worldW - SBW, 'enemy');

    // Units
    this.unitPool = new UnitPool(scene);
    this.units = [];

    // Systems
    this.audio = new AudioManager();
    this.combat = new CombatSystem(scene, this.events, worldW);
    this.waves = new WaveManager(scene, startWave, this.events, customWaves);
    this.economy = new EconomyManager(scene);
    this.abilities = new AbilityManager(scene, this.events, worldW);
    this.particles = new ParticleManager(scene);
    this.incubation = new IncubationManager();
    this.cocoons = new CocoonVisuals(scene);
    this.larvae = new LarvaVisuals(scene);

    // Apply run buffs (hive buildings from roguelike rewards)
    if (runBuffs) {
      for (const buff of runBuffs) {
        if (buff.type === 'nectar_income') this.economy.addBaseIncome(buff.value);
      }
    }

    // Game state
    this.running = true;
    this.won = null;
    this.kills = 0;
    this.elapsed = 0;
    this.manualPanTimer = 0;

    // Debug commands (dev only — tree-shaken in production)
    if (import.meta.env.DEV) {
      registerDebugCommand('win', 'Instant victory', () => { this.debugWin(); return 'Victory triggered.'; });
      registerDebugCommand('nectar', 'Set nectar (e.g. nectar 999)', (args) => {
        const n = parseInt(args[0]); if (isNaN(n)) return 'Usage: nectar <amount>';
        this.economy.nectar = n; return `Nectar set to ${n}`;
      });
      registerDebugCommand('wave', 'Skip to wave end', () => {
        this.waves.enemyQueue.length = 0;
        this.waves.waveTimer = this.waves.waveInterval - 0.1;
        return 'Wave skipped.';
      });
      registerDebugCommand('hp', 'Set player base HP (e.g. hp 9999)', (args) => {
        const n = parseInt(args[0]); if (isNaN(n)) return 'Usage: hp <amount>';
        this.playerBase.setHp(n); return `Base HP set to ${n}`;
      });
    }

    // Wire up event listeners
    this.events.on('enemyKilled', (data) => {
      this.economy.earn(data.unit.reward);
      this.kills++;
      this.audio.nectarEarn();
    });

    this.events.on('unitSpawned', (data) => {
      if (data.side === 'enemy') this.spawnEnemy(data.key);
    });

    this.events.on('waveStart', (data) => {
      this.audio.waveStart();
      this.events.emit('logMessage', { message: `\u26A0 Wave ${data.wave} incoming!` });
    });
  }

  tick(dt: number): void {
    if (!this.running) return;

    this.elapsed += dt;

    // Update systems
    this.economy.update(dt);
    this.abilities.update(dt);
    this.waves.update(dt, this.particles);

    // Incubation — hatch ready units
    const hatched = this.incubation.update(dt);
    for (const h of hatched) {
      this.createUnit(h.key, 'player', h.def, this.SBW + 2);
    }
    this.cocoons.update(dt, this.incubation.chambers, this.incubation.numChambers);
    this.larvae.update(dt, this.incubation.larvaCount);

    // Update wall shield visual
    this.playerBase.shielded = this.abilities.wallActive > 0;

    // Combat resolution
    this.combat.resolve(
      this.units, dt,
      this.playerBase, this.enemyBase,
      this.particles,
      this.abilities.wallActive,
      this.audio
    );

    // Clean up dead units — return to pool
    this.units = this.units.filter(u => {
      if (u.dead) {
        this.unitPool.despawn(u);
        return false;
      }
      return true;
    });

    // Update particles
    this.particles.update(dt);

    // Update bases
    this.playerBase.update(dt);
    this.enemyBase.update(dt);

    // Check defeat
    if (this.playerBase.hp <= 0) {
      this.running = false;
      this.won = 'enemy';
      this.audio.defeat();
    }

    // Check victory (finite mode: all waves cleared + no living enemies)
    if (!this.won && this.waves.isComplete) {
      const livingEnemies = this.units.some(u => u.side === 'enemy' && !u.dead);
      if (!livingEnemies) {
        this.running = false;
        this.won = 'player';
        this.audio.waveStart(); // reuse as victory fanfare for now
      }
    }
  }

  playerSpawn(key: string): SpawnResult {
    const def = UNIT_DEFS[key];
    if (!def) return { success: false, message: '' };
    if (!this.economy.canAfford(def.cost)) {
      return { success: false, message: 'Not enough nectar!' };
    }
    if (this.incubation.larvaCount <= 0) {
      return { success: false, message: 'No larvae available!' };
    }
    if (this.incubation.isFull()) {
      return { success: false, message: 'All chambers full!' };
    }
    this.economy.spend(def.cost);
    // Capture larva position before consuming it
    const larvaPos = this.larvae.consumeLarva(this.incubation.larvaCount);
    const chamberIdx = this.incubation.queue(key, def);
    if (chamberIdx >= 0) {
      this.cocoons.setCocoonPosition(chamberIdx, larvaPos.x, larvaPos.y);
    }
    this.audio.spawn();
    return { success: true, message: `Incubating ${def.name}...` };
  }

  cancelIncubation(index: number): SpawnResult {
    const refund = this.incubation.cancel(index);
    if (refund < 0) return { success: false, message: '' };
    this.economy.earn(refund);
    return { success: true, message: `Cancelled! +${refund} nectar refunded.` };
  }

  spawnEnemy(key: string): void {
    const def = ENEMY_DEFS[key];
    if (!def) return;

    const scale = this.waves.getScaleFactor();
    let scaledDef = def;
    if (scale > 1) {
      scaledDef = { ...def, hp: Math.ceil(def.hp * scale), atk: Math.ceil(def.atk * scale) };
    }

    this.createUnit(key, 'enemy', scaledDef, this.worldW - this.SBW - def.w - 2);
  }

  createUnit(key: string, side: Side, def: UnitDef, x: number): void {
    const unitDef = { ...def, _key: key };
    const unit = this.unitPool.spawn(unitDef, side, x);
    this.units.push(unit);
  }

  castAbility(key: AbilityKey): { success: boolean; message: string } {
    if (!this.running) return { success: false, message: '' };
    let success = false;
    let message = '';
    switch (key) {
      case 'nuke':
        success = this.abilities.castNuke(this.economy, this.units, this.enemyBase, this.particles);
        if (success) { message = '\u2622 Acid Nuke hits ALL enemies!'; this.audio.abilityNuke(); }
        break;
      case 'wall':
        success = this.abilities.castWall(this.economy, this.playerBase, this.particles);
        if (success) { message = '\u{1F9F1} Steel Wall active! Base invincible!'; this.audio.abilityWall(); }
        break;
      case 'slow':
        success = this.abilities.castSlow(this.economy, this.units, this.particles);
        if (success) { message = '\u{1F33F} Pheromone! Enemy speed halved!'; this.audio.abilitySlow(); }
        break;
      case 'repair':
        success = this.abilities.castRepair(this.economy, this.playerBase, this.particles);
        if (success) { message = '\u{1F527} Base repaired!'; this.audio.abilityRepair(); }
        break;
    }
    return { success, message };
  }

  generateUnitPreviews(): Record<string, string> {
    const previews: Record<string, string> = {};
    this.deckKeys.forEach(key => {
      const def = UNIT_DEFS[key];
      if (!def) return;
      const pad = 10;
      const pw = def.w + pad * 2;
      const ph = def.h + pad * 2 + 10;
      const g = this.scene.add.graphics();
      const renderUnit: RenderUnit = {
        w: def.w, h: def.h,
        ...resolveColors(def),
        palette: def.palette,
        facing: 1, bob: 0,
        state: 'march', atkCd: 0, atkRate: def.atkRate,
        trait: def.trait, hp: def.hp, maxHp: def.hp,
        burrowed: false, foreswingTimer: 0, backswingTimer: 0,
      };
      drawUnit(g, renderUnit, pw / 2, pad);
      const texKey = '_preview_' + key;
      g.generateTexture(texKey, pw, ph);
      g.destroy();
      const src = this.scene.textures.get(texKey).getSourceImage() as HTMLCanvasElement;
      previews[key] = src.toDataURL();
      this.scene.textures.remove(texKey);
    });
    return previews;
  }

  getGameOverData(): { wavesCleared: number; kills: number; won: boolean; elapsed: number } {
    return {
      wavesCleared: this.waves.stage - 1,
      kills: this.kills,
      won: this.won === 'player',
      elapsed: this.elapsed,
    };
  }

  debugWin(): void {
    // Kill all enemies, skip all waves — triggers victory condition next tick
    this.units.forEach(u => { if (u.side === 'enemy' && !u.dead) u.kill(); });
    this.waves.enemyQueue.length = 0;
    this.waves.waveIdx = this.waves.totalWaves;
  }

  cleanupDebugCommands(): void {
    if (import.meta.env.DEV) {
      unregisterDebugCommand('win');
      unregisterDebugCommand('nectar');
      unregisterDebugCommand('wave');
      unregisterDebugCommand('hp');
    }
  }

  saveAndGetPoints(): number {
    const save = new SaveManager();
    const data = this.getGameOverData();
    return save.recordGameResult(data.wavesCleared, data.kills, data.won, data.elapsed);
  }

  updateCamera(dt: number): void {
    if (this.manualPanTimer > 0) {
      this.manualPanTimer -= dt;
      return;
    }

    // Find frontline — rightmost player unit and leftmost enemy unit
    let playerFront = this.SBW;
    let enemyFront = this.worldW - this.SBW;

    for (const u of this.units) {
      if (u.dead) continue;
      if (u.side === 'player' && u.x > playerFront) playerFront = u.x;
      if (u.side === 'enemy' && u.x < enemyFront) enemyFront = u.x;
    }

    // Camera target: center viewport on midpoint between frontlines
    const cam = this.scene.cameras.main;
    const viewW = W / cam.zoom;
    const midpoint = (playerFront + enemyFront) / 2;
    const targetX = Math.max(0, Math.min(midpoint - viewW / 2, this.worldW - viewW));

    cam.scrollX += (targetX - cam.scrollX) * Math.min(1, 2 * dt); // smooth lerp
  }
}
