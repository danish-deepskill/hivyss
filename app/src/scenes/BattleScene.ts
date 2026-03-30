import Phaser from 'phaser';
import { W, WORLD_W, H, GND, S } from '../config/Constants';
import { UNIT_DEFS } from '../units/registry';
import { HUD } from '../ui/HUD';
import { UnitTray } from '../ui/UnitTray';
import { AbilityBar } from '../ui/AbilityBar';
import { LarvaMound } from '../ui/LarvaMound';
import { SaveManager } from '../systems/SaveManager';
import { GameManager } from '../systems/GameManager';

interface BattleSceneData {
  deck?: string[];
  startWave?: number;
}

export class BattleScene extends Phaser.Scene {
  private gm!: GameManager;
  private hud!: HUD;
  private unitTray!: UnitTray;
  private larvaMound!: LarvaMound;
  private abilityBar!: AbilityBar;
  private dragStartX: number = 0;
  private camStartX: number = 0;
  private dragging: boolean = false;
  private panKeys!: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  constructor() {
    super('BattleScene');
  }

  create(data?: BattleSceneData): void {
    // Load deck from scene data or save
    const save: SaveManager = new SaveManager();
    let deckKeys: string[] = (data && data.deck) || save.getDeck();
    if (!deckKeys.length) deckKeys = Object.keys(UNIT_DEFS).filter(k => !UNIT_DEFS[k].unlock).slice(0, 10);

    // Draw static background
    this.drawBackground();

    // Check for start wave from scene data or URL param (?wave=30)
    const urlWave = new URLSearchParams(window.location.search).get('wave');
    const startWave = (data && data.startWave) || (urlWave ? parseInt(urlWave, 10) : 1);

    // Create game manager (owns all systems, entities, and game state)
    this.gm = new GameManager(this, deckKeys, startWave);

    // Generate unit preview images
    const previews: Record<string, string> = this.gm.generateUnitPreviews();

    // UI
    this.hud = new HUD();
    this.larvaMound = new LarvaMound((index: number) => {
      const result = this.gm.cancelIncubation(index);
      if (result.message) this.hud.setLog(result.message);
    }, previews);
    this.unitTray = new UnitTray((key: string) => {
      const result = this.gm.playerSpawn(key);
      if (result.message) this.hud.setLog(result.message);
    }, previews, deckKeys);
    this.abilityBar = new AbilityBar((key: string) => {
      const result = this.gm.castAbility(key as import('../types').AbilityKey);
      if (result.message) this.hud.setLog(result.message);
    });

    this.hud.setLog('Deploy units to push to the enemy base!');

    // Keyboard shortcuts: 1-9, 0 = slots 1-10, arrows = pan camera
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      const k = e.key;
      let idx = -1;
      if (k >= '1' && k <= '9') idx = parseInt(k) - 1;
      else if (k === '0') idx = 9;
      if (idx >= 0 && idx < deckKeys.length) {
        const result = this.gm.playerSpawn(deckKeys[idx]);
        if (result.message) this.hud.setLog(result.message);
      }
    });

    // Arrow keys for camera pan
    this.panKeys = {
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };

    // Wave start event (UI-only concern)
    this.events.on('waveStart', (stage: number) => {
      document.getElementById('stage-lbl')!.textContent = 'STAGE ' + stage;
      this.hud.setLog(`\u26A0 Wave ${stage} incoming!`);
      this.gm.audio.waveStart();
    });

    // Game over overlay restart button
    document.getElementById('ov-restart')!.onclick = () => {
      document.getElementById('overlay')!.classList.remove('on');
      this.scene.restart();
    };

    // Camera setup — scrollable world wider than viewport
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, H);
    cam.setScroll(0, 0);

    // Drag to pan camera
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragStartX = p.x;
      this.camStartX = cam.scrollX;
      this.dragging = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const dx = this.dragStartX - p.x;
      if (Math.abs(dx) > 5) this.dragging = true;
      if (this.dragging) {
        const viewW = W / cam.zoom;
        cam.scrollX = Math.max(0, Math.min(this.camStartX + dx, WORLD_W - viewW));
        this.gm.manualPanTimer = 2;
      }
    });
  }

  update(time: number, delta: number): void {
    const dt: number = Math.min(delta / 1000, 0.05);
    if (!this.gm.running) return;

    // Tick game logic
    this.gm.tick(dt);

    // Keyboard camera pan
    const panSpeed = 2000;
    if (this.panKeys.left.isDown) {
      const cam = this.cameras.main;
      const viewW = W / cam.zoom;
      cam.scrollX = Math.max(0, cam.scrollX - panSpeed * dt);
      this.gm.manualPanTimer = 1;
    } else if (this.panKeys.right.isDown) {
      const cam = this.cameras.main;
      const viewW = W / cam.zoom;
      cam.scrollX = Math.min(WORLD_W - viewW, cam.scrollX + panSpeed * dt);
      this.gm.manualPanTimer = 1;
    }

    // this.gm.updateCamera(dt); // disabled — manual pan only for now

    // Update UI
    this.hud.update(this.gm.playerBase.hp, this.gm.enemyBase.hp, this.gm.economy, this.gm.waves.stage, this.gm.incubation);
    this.larvaMound.update(this.gm.incubation.chambers, this.gm.incubation.numChambers, this.gm.incubation.larvaCount);
    this.unitTray.update(this.gm.economy, this.gm.incubation);
    this.abilityBar.update(this.gm.abilities, this.gm.economy, this.gm.running);

    // Check game over (GameManager sets running=false)
    if (!this.gm.running && this.gm.won) {
      this.time.delayedCall(400, () => this.showGameOver());
    }
  }

  private showGameOver(): void {
    const points: number = this.gm.saveAndGetPoints();
    const data = this.gm.getGameOverData();

    const ov: HTMLElement = document.getElementById('overlay')!;
    ov.classList.add('on');
    const t: HTMLElement = document.getElementById('ov-title')!;
    t.className = 'lose';
    t.textContent = 'BASE DESTROYED!';
    document.getElementById('ov-sub')!.textContent = `You survived ${data.wavesCleared} waves`;
    document.getElementById('ov-stats')!.innerHTML =
      `Enemies crushed: ${data.kills}<br>Time survived: ${Math.floor(data.elapsed)}s<br><span style="color:#f0c040">+${points} Colony Points</span>`;
  }

  private drawBackground(): void {
    const bg: Phaser.GameObjects.Graphics = this.add.graphics();

    // Time-of-day palettes
    const themes = {
      day:    { sky: 0x5c9ee8, skyLow: 0x8ec4f0, mtn: 0x6a8a5a, ground: 0x4a6a28, groundTop: 0x5c7a34, groundTex: 0x3e5a1e, stars: false },
      sunset: { sky: 0xd45020, skyLow: 0xf0a040, mtn: 0x4a2a20, ground: 0x2e2a10, groundTop: 0x3e3818, groundTex: 0x36300e, stars: false },
      night:  { sky: 0x0e0e18, skyLow: 0x0e0e18, mtn: 0x141420, ground: 0x1e1a0c, groundTop: 0x2a2410, groundTex: 0x2e2810, stars: true },
    };
    const themeKeys = Object.keys(themes) as (keyof typeof themes)[];
    const t = themes[themeKeys[Math.floor(Math.random() * themeKeys.length)]];

    // Sky — gradient from top to horizon
    const skySteps = 12;
    const stepH = Math.ceil(GND / skySteps);
    for (let i = 0; i < skySteps; i++) {
      const frac = i / (skySteps - 1);
      const r = ((t.sky >> 16) & 0xff) + (((t.skyLow >> 16) & 0xff) - ((t.sky >> 16) & 0xff)) * frac;
      const g2 = ((t.sky >> 8) & 0xff) + (((t.skyLow >> 8) & 0xff) - ((t.sky >> 8) & 0xff)) * frac;
      const b = (t.sky & 0xff) + ((t.skyLow & 0xff) - (t.sky & 0xff)) * frac;
      bg.fillStyle((Math.round(r) << 16) | (Math.round(g2) << 8) | Math.round(b));
      bg.fillRect(0, i * stepH, WORLD_W, stepH + 1);
    }

    // Stars (night only)
    if (t.stars) {
      bg.fillStyle(0xffffff, 0.15);
      for (let i = 0; i < 200; i++) {
        bg.fillRect((i * 137.5) % WORLD_W, (i * 73) % (GND - 20), 1, 1);
      }
    }

    // Distant mountains
    bg.fillStyle(t.mtn);
    const mtnStep: number = 130;
    const mtnCount: number = Math.ceil(WORLD_W / mtnStep) + 1;
    for (let i = 0; i < mtnCount; i++) {
      bg.beginPath();
      bg.moveTo(i * mtnStep, GND);
      bg.lineTo(i * mtnStep + 90, GND - 70);
      bg.lineTo(i * mtnStep + 180, GND);
      bg.closePath();
      bg.fillPath();
    }

    // Ground
    bg.fillStyle(t.ground);
    bg.fillRect(0, GND, WORLD_W, H - GND);
    bg.fillStyle(t.groundTop);
    bg.fillRect(0, GND, WORLD_W, 8);

    // Ground texture
    bg.lineStyle(1, t.groundTex);
    for (let i = 0; i < WORLD_W; i += 14) {
      bg.beginPath();
      bg.moveTo(i, GND + 2);
      bg.lineTo(i + 7, GND + 6);
      bg.strokePath();
    }

    // Midline marker
    bg.lineStyle(1, 0xffffff, 0.06);
    for (let y = GND - 10; y < GND; y += 12) {
      bg.beginPath();
      bg.moveTo(WORLD_W / 2, y);
      bg.lineTo(WORLD_W / 2, Math.min(y + 4, GND));
      bg.strokePath();
    }
  }
}
