import Phaser from 'phaser';
import { W, H } from '../config/Constants';
import { BG_THEMES } from '../config/BackgroundDefs';
import { LANE } from '../config/Layout';
const GND = LANE.land.groundY;
import { SaveManager } from '../systems/SaveManager';
import { UNIT_DEFS, drawUnit } from '../units/registry';
import { resolveColors } from '../config/Palettes';
import type { RenderUnit } from '../types';

const UNIT_KEYS: string[] = Object.keys(UNIT_DEFS);

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
      bg.fillRect((i * 195.6) % W, (i * 73) % (GND - 20), 2, 2);
    }

    // Mountains
    bg.fillStyle(0x141420);
    const mtnW = 256;
    const mtnStep = 185;
    const mtnCount = Math.ceil(W / mtnStep) + 1;
    for (let i = 0; i < mtnCount; i++) {
      bg.beginPath();
      bg.moveTo(i * mtnStep, GND);
      bg.lineTo(i * mtnStep + 128, GND - 70);
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
      fontSize: '40px',
      color: '#f0c040',
      letterSpacing: 3,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(W / 2, cy - 16, 'BUG BATTLE', {
      fontFamily: '"Courier New", monospace',
      fontSize: '17px',
      color: '#666',
      letterSpacing: 5,
    }).setOrigin(0.5);

    // Stats
    const bestWave = save.data.stats.bestWave;
    if (bestWave > 0) {
      this.add.text(W / 2, cy + 10, `Best Wave: ${bestWave}  |  Colony Points: ${save.data.colonyPoints}`, {
        fontFamily: '"Courier New", monospace',
        fontSize: '16px',
        color: '#665520',
      }).setOrigin(0.5);
    }

    // Play button
    const playBtn = this.add.text(W / 2, cy + 50, '\u25B6  PLAY', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '20px',
      color: '#f0c040',
      backgroundColor: '#150e04',
      padding: { x: 34, y: 14 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playBtn.on('pointerover', () => playBtn.setColor('#ffe080'));
    playBtn.on('pointerout', () => playBtn.setColor('#f0c040'));
    playBtn.on('pointerdown', () => {
      this.scene.start('BattleScene', { startWave: startWaveValue, theme: themeValue });
    });

    // Wave start selector — right of PLAY
    let startWaveValue = 1;
    const playRight = playBtn.x + playBtn.width / 2 + 20;
    const updateWaveLbl = () => {
      waveLbl.setText(String(startWaveValue));
      waveLbl.setColor(startWaveValue > 1 ? '#f0c040' : '#555');
    };
    const btnStyle = { fontFamily: '"Press Start 2P", monospace', fontSize: '14px', color: '#555' };
    const minusBtn = this.add.text(playRight, cy + 50, '<', btnStyle).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const waveLbl = this.add.text(playRight + 28, cy + 50, '1', {
      fontFamily: '"Courier New", monospace', fontSize: '16px', color: '#555',
    }).setOrigin(0.5);
    const plusBtn = this.add.text(playRight + 57, cy + 50, '>', btnStyle).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.add.text(playRight + 82, cy + 50, 'W', {
      fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#444',
    }).setOrigin(0, 0.5);
    minusBtn.on('pointerdown', () => { startWaveValue = Math.max(1, startWaveValue - 1); updateWaveLbl(); });
    plusBtn.on('pointerdown', () => { startWaveValue++; updateWaveLbl(); });
    minusBtn.on('pointerover', () => minusBtn.setColor('#ccc'));
    minusBtn.on('pointerout', () => minusBtn.setColor('#555'));
    plusBtn.on('pointerover', () => plusBtn.setColor('#ccc'));
    plusBtn.on('pointerout', () => plusBtn.setColor('#555'));

    // Theme picker
    const themeOptions = ['random', ...Object.keys(BG_THEMES)];
    let themeIdx = 0;
    let themeValue = themeOptions[themeIdx];
    const themeLbl = this.add.text(playRight + 28, cy + 72, 'random', {
      fontFamily: '"Courier New", monospace', fontSize: '14px', color: '#555',
    }).setOrigin(0.5);
    const updateThemeLbl = () => {
      themeValue = themeOptions[themeIdx];
      themeLbl.setText(themeValue);
      themeLbl.setColor(themeValue !== 'random' ? '#f0c040' : '#555');
    };
    const themeLeft = this.add.text(playRight, cy + 72, '<', btnStyle).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const themeRight = this.add.text(playRight + 57, cy + 72, '>', btnStyle).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.add.text(playRight + 82, cy + 72, 'BG', {
      fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#444',
    }).setOrigin(0, 0.5);
    themeLeft.on('pointerdown', () => { themeIdx = (themeIdx - 1 + themeOptions.length) % themeOptions.length; updateThemeLbl(); });
    themeRight.on('pointerdown', () => { themeIdx = (themeIdx + 1) % themeOptions.length; updateThemeLbl(); });
    themeLeft.on('pointerover', () => themeLeft.setColor('#ccc'));
    themeLeft.on('pointerout', () => themeLeft.setColor('#555'));
    themeRight.on('pointerover', () => themeRight.setColor('#ccc'));
    themeRight.on('pointerout', () => themeRight.setColor('#555'));

    // Deck button
    const deckBtn = this.add.text(W / 2, cy + 90, '\u2261  DECK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#888',
      backgroundColor: '#0a0a14',
      padding: { x: 26, y: 11 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    deckBtn.on('pointerover', () => deckBtn.setColor('#ccc'));
    deckBtn.on('pointerout', () => deckBtn.setColor('#888'));
    deckBtn.on('pointerdown', () => {
      this.scene.start('DeckScene');
    });

    // Upgrades button
    const upgradeBtn = this.add.text(W / 2, cy + 126, '\u2B21  UPGRADES', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#888',
      backgroundColor: '#0a0a14',
      padding: { x: 26, y: 11 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    upgradeBtn.on('pointerover', () => upgradeBtn.setColor('#ccc'));
    upgradeBtn.on('pointerout', () => upgradeBtn.setColor('#888'));
    upgradeBtn.on('pointerdown', () => {
      this.scene.start('UpgradeScene');
    });

    // Sandbox button
    const sandboxBtn = this.add.text(W / 2, cy + 162, '\u2694  SANDBOX', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#888',
      backgroundColor: '#0a0a14',
      padding: { x: 26, y: 11 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    sandboxBtn.on('pointerover', () => sandboxBtn.setColor('#ccc'));
    sandboxBtn.on('pointerout', () => sandboxBtn.setColor('#888'));
    sandboxBtn.on('pointerdown', () => {
      this.scene.start('SandboxScene');
    });

    // Marching bugs decoration — random units, live animated
    this.marchAnts = [];
    const bugCount = 20;
    for (let i = 0; i < bugCount; i++) {
      const key = UNIT_KEYS[Math.floor(Math.random() * UNIT_KEYS.length)];
      const def = UNIT_DEFS[key];
      const dir = Math.random() > 0.5 ? 1 : -1;
      const sw = def.w;
      const sh = def.h;
      const container = this.add.container(Math.random() * W, GND - sh);
      const gfx = this.add.graphics();
      container.add(gfx);
      this.marchAnts.push({
        obj: container, gfx, spd: (0.2 + Math.random() * 0.4) * def.spd, dir,
        bob: Math.random() * Math.PI * 2,
        renderUnit: {
          w: sw, h: sh,
          ...resolveColors(def),
          palette: def.palette,
          facing: dir, bob: 0, state: 'march',
          atkCd: 0, atkRate: def.atkRate,
          trait: def.trait, hp: def.hp, maxHp: def.hp,
          burrowed: false, hitCount: 0, foreswingTimer: 0, backswingTimer: 0,
        },
      });
    }

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

}
