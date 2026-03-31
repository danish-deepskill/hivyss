import Phaser from 'phaser';
import { W, DEFAULT_WORLD_W, H } from '../config/Constants';
import { LANE } from '../config/Layout';
const GND = LANE.land.groundY;
import { ABILITY_DEFS } from '../config/AbilityDefs';
import { GameManager } from '../systems/GameManager';
import type { AbilityKey } from '../types';

interface WorldSceneData {
  deck: string[];
  startWave: number;
  worldW?: number;
}

export class WorldScene extends Phaser.Scene {
  gm!: GameManager;
  private worldW: number = DEFAULT_WORLD_W;
  private mouseX: number = -1;
  private dragStartX: number = 0;
  private camStartX: number = 0;
  private dragging: boolean = false;
  private panKeys!: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  constructor() {
    super('WorldScene');
  }

  create(data: WorldSceneData): void {
    this.worldW = data.worldW ?? DEFAULT_WORLD_W;

    this.drawBackground();

    // Create game manager (owns all systems, entities, and game state)
    this.gm = new GameManager(this, data.deck, data.startWave, this.worldW);

    // Store shared data on registry for HUDScene + MenuUIScene
    this.registry.set('worldW', this.worldW);
    this.registry.set('deckKeys', data.deck);
    this.registry.set('previews', this.gm.generateUnitPreviews());
    this.registry.set('eventBus', this.gm.events);

    // Subscribe to UI action events (MenuUIScene emits these)
    const onDeploy = (evt: { key: string }) => {
      const result = this.gm.playerSpawn(evt.key);
      if (result.message) this.gm.events.emit('logMessage', { message: result.message });
    };
    const onAbility = (evt: { key: string }) => {
      const result = this.gm.castAbility(evt.key as AbilityKey);
      if (result.message) this.gm.events.emit('logMessage', { message: result.message });
    };
    const onCancel = (evt: { index: number }) => {
      const result = this.gm.cancelIncubation(evt.index);
      if (result.message) this.gm.events.emit('logMessage', { message: result.message });
    };
    this.gm.events.on('deployUnit', onDeploy);
    this.gm.events.on('useAbility', onAbility);
    this.gm.events.on('cancelIncubation', onCancel);

    // Cleanup EventBus listeners on shutdown
    this.events.once('shutdown', () => {
      this.gm.events.off('deployUnit', onDeploy);
      this.gm.events.off('useAbility', onAbility);
      this.gm.events.off('cancelIncubation', onCancel);
    });

    // Arrow keys for camera pan
    this.panKeys = {
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };

    // Camera setup — scrollable world wider than viewport
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.worldW, H);
    cam.setScroll(0, 0);

    // Track mouse position via canvas event (bypasses DOM container)
    const canvas = this.sys.game.canvas;
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - rect.left) / rect.width) * W;
    };
    const onMouseLeave = () => { this.mouseX = -1; };
    canvas.parentElement!.addEventListener('mousemove', onMouseMove);
    canvas.parentElement!.addEventListener('mouseleave', onMouseLeave);
    this.events.once('shutdown', () => {
      canvas.parentElement!.removeEventListener('mousemove', onMouseMove);
      canvas.parentElement!.removeEventListener('mouseleave', onMouseLeave);
    });

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
        cam.scrollX = Math.max(0, Math.min(this.camStartX + dx, this.worldW - viewW));
        this.gm.manualPanTimer = 2;
      }
    });
  }

  update(_time: number, delta: number): void {
    const dt: number = Math.min(delta / 1000, 0.05);

    // Write shared state to registry every frame (HUDScene + MenuUIScene read these)
    const cam = this.cameras.main;
    this.registry.set('cam.scrollX', cam.scrollX);
    if (this.gm) {
      // Base HP (HUDScene)
      this.registry.set('playerBase.hp', this.gm.playerBase.hp);
      this.registry.set('playerBase.maxHp', this.gm.playerBase.maxHp);
      this.registry.set('enemyBase.hp', this.gm.enemyBase.hp);
      this.registry.set('enemyBase.maxHp', this.gm.enemyBase.maxHp);
      this.registry.set('SBW', this.gm.SBW);

      // Economy (MenuUIScene)
      this.registry.set('eco.nectar', this.gm.economy.nectar);
      this.registry.set('eco.maxNectar', this.gm.economy.maxNectar);
      this.registry.set('eco.income', this.gm.economy.income);
      this.registry.set('eco.nectarPct', this.gm.economy.getNectarPercent());

      // Incubation (MenuUIScene)
      this.registry.set('inc.chambers', this.gm.incubation.chambers);
      this.registry.set('inc.numChambers', this.gm.incubation.numChambers);
      this.registry.set('inc.larvaCount', this.gm.incubation.larvaCount);
      this.registry.set('inc.larvaTimer', this.gm.incubation.larvaTimer);
      this.registry.set('inc.canQueue', this.gm.incubation.canQueue());

      // Abilities (MenuUIScene)
      const ablCanCast: Record<string, boolean> = {};
      const ablCdPct: Record<string, number> = {};
      Object.keys(ABILITY_DEFS).forEach(k => {
        ablCanCast[k] = this.gm.abilities.canCast(k, this.gm.economy);
        ablCdPct[k] = this.gm.abilities.getCooldownPercent(k);
      });
      this.registry.set('abl.canCast', ablCanCast);
      this.registry.set('abl.cooldownPct', ablCdPct);

      // Game state (MenuUIScene)
      this.registry.set('wave.stage', this.gm.waves.stage);
      this.registry.set('game.running', this.gm.running);
    }

    if (!this.gm.running) return;

    // Tick game logic
    this.gm.tick(dt);

    // Camera pan — keyboard or mouse at screen edge
    const panSpeed = 2000;
    const edgeZone = 40;
    const atLeftEdge = this.mouseX >= 0 && this.mouseX < edgeZone;
    const atRightEdge = this.mouseX > W - edgeZone && this.mouseX <= W;

    if (this.panKeys.left.isDown || atLeftEdge) {
      cam.scrollX = Math.max(0, cam.scrollX - panSpeed * dt);
      this.gm.manualPanTimer = 1;
    } else if (this.panKeys.right.isDown || atRightEdge) {
      const viewW = W / cam.zoom;
      cam.scrollX = Math.min(this.worldW - viewW, cam.scrollX + panSpeed * dt);
      this.gm.manualPanTimer = 1;
    }
  }

  private drawBackground(): void {
    const ww = this.worldW;
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
      bg.fillRect(0, i * stepH, ww, stepH + 1);
    }

    // Stars (night only)
    if (t.stars) {
      bg.fillStyle(0xffffff, 0.15);
      for (let i = 0; i < 200; i++) {
        bg.fillRect((i * 137.5) % ww, (i * 73) % (GND - 20), 1, 1);
      }
    }

    // Distant mountains
    bg.fillStyle(t.mtn);
    const mtnStep: number = 130;
    const mtnCount: number = Math.ceil(ww / mtnStep) + 1;
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
    bg.fillRect(0, GND, ww, H - GND);
    bg.fillStyle(t.groundTop);
    bg.fillRect(0, GND, ww, 8);

    // Ground texture
    bg.lineStyle(1, t.groundTex);
    for (let i = 0; i < ww; i += 14) {
      bg.beginPath();
      bg.moveTo(i, GND + 2);
      bg.lineTo(i + 7, GND + 6);
      bg.strokePath();
    }

    // Air lane indicator — faint dashed line in the sky
    const airY = LANE.air.groundY;
    bg.lineStyle(1, 0xffffff, 0.06);
    for (let x = 0; x < ww; x += 30) {
      bg.lineBetween(x, airY, x + 15, airY);
    }

    // Tunnel lane indicator — dark strip below ground
    const tunY = LANE.tunnel.groundY;
    bg.fillStyle(0x000000, 0.15);
    bg.fillRect(0, tunY - 10, ww, 25);
    bg.lineStyle(1, 0x604020, 0.2);
    for (let x = 0; x < ww; x += 20) {
      bg.lineBetween(x, tunY, x + 10, tunY);
    }

    // Midline marker
    bg.lineStyle(1, 0xffffff, 0.06);
    for (let y = GND - 10; y < GND; y += 12) {
      bg.beginPath();
      bg.moveTo(ww / 2, y);
      bg.lineTo(ww / 2, Math.min(y + 4, GND));
      bg.strokePath();
    }
  }
}
