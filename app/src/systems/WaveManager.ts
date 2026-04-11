import Phaser from 'phaser';
import type { WaveDef, IParticleManager } from '../types';
import { WAVE_DEFS, WAVE_INTERVAL } from '../config/WaveDefs';
import { ENEMY_DEFS } from '../config/EnemyDefs';
import { W } from '../config/Constants';
import { LANE } from '../config/Layout';
const GND = LANE.land.groundY;
// W used for camera-relative text positioning
import { EventBus } from './EventBus';

export class WaveManager {
  scene: Phaser.Scene;
  events: EventBus;
  waveIdx: number;
  waveTimer: number;
  waveInterval: number;
  enemyQueue: string[];
  enemySpawnInterval: number;
  enemySpawnAcc: number;
  stage: number;
  _infiniteScale: number;
  private waveDefs: WaveDef[];
  private finiteMode: boolean;

  constructor(scene: Phaser.Scene, startWave: number = 1, events?: EventBus, customWaves?: WaveDef[]) {
    this.scene = scene;
    this.events = events || new EventBus();
    this.waveDefs = customWaves || WAVE_DEFS;
    this.finiteMode = !!customWaves;
    this.waveIdx = Math.max(0, startWave - 1);
    this.waveTimer = 0;
    this.waveInterval = WAVE_INTERVAL;
    this.enemyQueue = [];
    this.enemySpawnInterval = 3;
    this.enemySpawnAcc = 0;
    this.stage = startWave;
    this._infiniteScale = 1;

    this.scheduleNextWave();
  }

  get totalWaves(): number { return this.waveDefs.length; }
  get isComplete(): boolean { return this.waveIdx >= this.waveDefs.length && this.enemyQueue.length === 0; }

  scheduleNextWave(): void {
    if (this.waveIdx >= this.waveDefs.length) {
      if (this.finiteMode) return; // finite mode: stop spawning
      this.generateInfiniteWave();
      return;
    }
    const w = this.waveDefs[this.waveIdx];
    this.enemyQueue = [...w.units];
    this.enemySpawnInterval = w.interval;
    this.enemySpawnAcc = 0;
  }

  generateInfiniteWave(): void {
    // Repeat patterns from waves 21-29 with scaling
    const baseWaves = WAVE_DEFS.slice(20, 29);
    const pattern = baseWaves[this.waveIdx % baseWaves.length];
    const scale = 1 + 0.15 * (this.waveIdx - WAVE_DEFS.length);

    // Add extra enemies
    const extraCount = Math.floor((this.waveIdx - WAVE_DEFS.length) / 3);
    const units = [...pattern.units];
    for (let i = 0; i < extraCount; i++) {
      units.push(pattern.units[i % pattern.units.length]);
    }

    this.enemyQueue = units;
    this.enemySpawnInterval = Math.max(0.4, pattern.interval - scale * 0.08);
    this.enemySpawnAcc = 0;
    this._infiniteScale = scale;
  }

  getScaleFactor(): number {
    if (this.waveIdx < this.waveDefs.length) return 1;
    return this._infiniteScale || 1;
  }

  update(dt: number, particles: IParticleManager | null): void {
    // Wave timer
    this.waveTimer += dt;
    if (this.waveTimer >= this.waveInterval) {
      this.waveTimer = 0;
      this.waveIdx++;
      this.stage = this.waveIdx + 1;
      this.scheduleNextWave();

      if (particles) {
        const camX = this.scene.cameras.main.scrollX;
        particles.float(camX + W / 2, GND - 200, `WAVE ${this.stage}!`, 0xf0c040, true);
      }
      this.events.emit('waveStart', { wave: this.stage });
    }

    // Spawn enemies from queue
    if (this.enemyQueue.length > 0) {
      this.enemySpawnAcc += dt;
      if (this.enemySpawnAcc >= this.enemySpawnInterval) {
        this.enemySpawnAcc = 0;
        const key = this.enemyQueue.shift();
        this.events.emit('unitSpawned', { key: key!, side: 'enemy' });
      }
    }
  }
}
