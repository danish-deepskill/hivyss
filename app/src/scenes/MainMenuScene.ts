import Phaser from 'phaser';
import { W, H, GND } from '../config/Constants';
import { SaveManager } from '../systems/SaveManager';
import { UNIT_DEFS, drawUnit } from '../units/registry';
import type { RenderUnit } from '../types';

const S: number = W / 900;
const UNIT_KEYS: string[] = Object.keys(UNIT_DEFS);
function fs(px: number): string { return `${Math.round(px * S)}px`; }

interface MarchAnt {
  obj: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  spd: number;
  dir: number;
  bob: number;
  renderUnit: RenderUnit;
}

export class MainMenuScene extends Phaser.Scene {
  private marchAnts!: MarchAnt[];

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    const save = new SaveManager();

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0e0e18);
    bg.fillRect(0, 0, W, H);

    // Stars
    bg.fillStyle(0xffffff, 0.15);
    for (let i = 0; i < 80; i++) {
      bg.fillRect((i * 137.5 * S) % W, (i * 73) % (GND - 20), Math.ceil(S), Math.ceil(S));
    }

    // Mountains
    bg.fillStyle(0x141420);
    const mtnW = Math.round(180 * S);
    const mtnStep = Math.round(130 * S);
    const mtnCount = Math.ceil(W / mtnStep) + 1;
    for (let i = 0; i < mtnCount; i++) {
      bg.beginPath();
      bg.moveTo(i * mtnStep, GND);
      bg.lineTo(i * mtnStep + Math.round(90 * S), GND - 70);
      bg.lineTo(i * mtnStep + mtnW, GND);
      bg.closePath();
      bg.fillPath();
    }

    // Ground
    bg.fillStyle(0x1e1a0c);
    bg.fillRect(0, GND, W, H - GND);

    const cy = H * 0.35;

    // Title
    this.add.text(W / 2, cy - 50, 'Hivyss', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: fs(28),
      color: '#f0c040',
      letterSpacing: 3,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(W / 2, cy - 16, 'BUG BATTLE', {
      fontFamily: '"Courier New", monospace',
      fontSize: fs(12),
      color: '#666',
      letterSpacing: 5,
    }).setOrigin(0.5);

    // Stats
    const bestWave = save.data.stats.bestWave;
    if (bestWave > 0) {
      this.add.text(W / 2, cy + 10, `Best Wave: ${bestWave}  |  Colony Points: ${save.data.colonyPoints}`, {
        fontFamily: '"Courier New", monospace',
        fontSize: fs(11),
        color: '#665520',
      }).setOrigin(0.5);
    }

    // Play button
    const playBtn = this.add.text(W / 2, cy + 50, '\u25B6  PLAY', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: fs(14),
      color: '#f0c040',
      backgroundColor: '#150e04',
      padding: { x: Math.round(24 * S), y: Math.round(10 * S) },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playBtn.on('pointerover', () => playBtn.setColor('#ffe080'));
    playBtn.on('pointerout', () => playBtn.setColor('#f0c040'));
    playBtn.on('pointerdown', () => {
      const startWave = startWaveValue;
      this.scene.start('BattleScene', { startWave });
    });

    // Wave start selector — right of PLAY
    let startWaveValue = 1;
    const playRight = playBtn.x + playBtn.width / 2 + Math.round(14 * S);
    const updateWaveLbl = () => {
      waveLbl.setText(String(startWaveValue));
      waveLbl.setColor(startWaveValue > 1 ? '#f0c040' : '#555');
    };
    const btnStyle = { fontFamily: '"Press Start 2P", monospace', fontSize: fs(10), color: '#555' };
    const minusBtn = this.add.text(playRight, cy + 50, '<', btnStyle).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const waveLbl = this.add.text(playRight + Math.round(20 * S), cy + 50, '1', {
      fontFamily: '"Courier New", monospace', fontSize: fs(11), color: '#555',
    }).setOrigin(0.5);
    const plusBtn = this.add.text(playRight + Math.round(40 * S), cy + 50, '>', btnStyle).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.add.text(playRight + Math.round(58 * S), cy + 50, 'W', {
      fontFamily: '"Courier New", monospace', fontSize: fs(8), color: '#444',
    }).setOrigin(0, 0.5);
    minusBtn.on('pointerdown', () => { startWaveValue = Math.max(1, startWaveValue - 1); updateWaveLbl(); });
    plusBtn.on('pointerdown', () => { startWaveValue++; updateWaveLbl(); });
    minusBtn.on('pointerover', () => minusBtn.setColor('#ccc'));
    minusBtn.on('pointerout', () => minusBtn.setColor('#555'));
    plusBtn.on('pointerover', () => plusBtn.setColor('#ccc'));
    plusBtn.on('pointerout', () => plusBtn.setColor('#555'));

    // Deck button
    const deckBtn = this.add.text(W / 2, cy + 90, '\u2261  DECK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: fs(10),
      color: '#888',
      backgroundColor: '#0a0a14',
      padding: { x: Math.round(18 * S), y: Math.round(8 * S) },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    deckBtn.on('pointerover', () => deckBtn.setColor('#ccc'));
    deckBtn.on('pointerout', () => deckBtn.setColor('#888'));
    deckBtn.on('pointerdown', () => {
      this.scene.start('DeckScene');
    });

    // Upgrades button
    const upgradeBtn = this.add.text(W / 2, cy + 126, '\u2B21  UPGRADES', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: fs(10),
      color: '#888',
      backgroundColor: '#0a0a14',
      padding: { x: Math.round(18 * S), y: Math.round(8 * S) },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    upgradeBtn.on('pointerover', () => upgradeBtn.setColor('#ccc'));
    upgradeBtn.on('pointerout', () => upgradeBtn.setColor('#888'));
    upgradeBtn.on('pointerdown', () => {
      this.scene.start('UpgradeScene');
    });

    // Sandbox button
    const sandboxBtn = this.add.text(W / 2, cy + 162, '\u2694  SANDBOX', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: fs(10),
      color: '#888',
      backgroundColor: '#0a0a14',
      padding: { x: Math.round(18 * S), y: Math.round(8 * S) },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    sandboxBtn.on('pointerover', () => sandboxBtn.setColor('#ccc'));
    sandboxBtn.on('pointerout', () => sandboxBtn.setColor('#888'));
    sandboxBtn.on('pointerdown', () => {
      this.scene.start('SandboxScene');
    });

    // Marching bugs decoration — random units, live animated
    this.marchAnts = [];
    const bugCount = Math.round(14 * S);
    for (let i = 0; i < bugCount; i++) {
      const key = UNIT_KEYS[Math.floor(Math.random() * UNIT_KEYS.length)];
      const def = UNIT_DEFS[key];
      const dir = Math.random() > 0.5 ? 1 : -1;
      const sw = Math.round(def.w * S);
      const sh = Math.round(def.h * S);
      const container = this.add.container(Math.random() * W, GND - sh);
      const gfx = this.add.graphics();
      container.add(gfx);
      this.marchAnts.push({
        obj: container, gfx, spd: (0.2 + Math.random() * 0.4) * def.spd, dir,
        bob: Math.random() * Math.PI * 2,
        renderUnit: {
          w: sw, h: sh, col: def.col, dk: def.dk,
          facing: dir, bob: 0, state: 'march',
          atkCd: 0, atkRate: def.atkRate,
          trait: def.trait, hp: def.hp, maxHp: def.hp,
          burrowed: false, hitCount: 0, foreswingTimer: 0, backswingTimer: 0,
        },
      });
    }

    this.setDomUiVisible(false);
    this.events.once('shutdown', () => this.setDomUiVisible(true));
  }

  update(time: number, delta: number): void {
    const dt: number = delta / 1000;
    this.marchAnts.forEach((a: MarchAnt) => {
      a.obj.x += a.dir * a.spd * 60 * dt;
      if (a.obj.x > W + 30) a.obj.x = -30;
      if (a.obj.x < -30) a.obj.x = W + 30;

      // Animate bob and redraw
      a.bob += dt * 10;
      a.renderUnit.bob = a.bob;
      a.gfx.clear();
      const uy = Math.sin(a.bob) * 1.5;
      drawUnit(a.gfx, a.renderUnit, a.renderUnit.w / 2, uy);
    });
  }

  private setDomUiVisible(visible: boolean): void {
    ['header', 'resbar', 'tray', 'abilities', 'log-row'].forEach((id: string) => {
      const el: HTMLElement | null = document.getElementById(id);
      if (el) el.style.display = visible ? '' : 'none';
    });
  }
}
