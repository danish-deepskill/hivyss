import Phaser from 'phaser';
import { W, H } from '../config/Constants';
import { BG_THEMES } from '../config/BackgroundDefs';
import { LANE } from '../config/Layout';
const GND = LANE.land.groundY;
import { SaveManager } from '../systems/SaveManager';
import { UNIT_DEFS, drawUnit } from '../units/registry';
import { resolveColors } from '../config/Palettes';
import { generateSeedString, formatSeedInput } from '../systems/SeededRNG';
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

    // UI depth — above marching units
    const UI_DEPTH = 10;

    // Title
    this.add.text(W / 2, cy - 50, 'Hivyss', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '40px',
      color: '#f0c040',
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(UI_DEPTH);

    // Subtitle
    this.add.text(W / 2, cy - 16, 'BUG BATTLE', {
      fontFamily: '"Courier New", monospace',
      fontSize: '17px',
      color: '#666',
      letterSpacing: 5,
    }).setOrigin(0.5).setDepth(UI_DEPTH);

    // Stats
    const bestWave = save.data.stats.bestWave;
    if (bestWave > 0) {
      this.add.text(W / 2, cy + 10, `Best Wave: ${bestWave}  |  Colony Points: ${save.data.colonyPoints}`, {
        fontFamily: '"Courier New", monospace',
        fontSize: '16px',
        color: '#665520',
      }).setOrigin(0.5).setDepth(UI_DEPTH);
    }

    // Button factory
    const BTN_W = 220;
    const makeBtn = (y: number, label: string, onClick: () => void, color = '#888', hoverColor = '#ccc') => {
      const btn = this.add.text(W / 2, y, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '14px',
        color,
        backgroundColor: '#0a0a14',
        padding: { x: 26, y: 11 },
        fixedWidth: BTN_W,
        align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(UI_DEPTH);
      btn.on('pointerover', () => btn.setColor(hoverColor));
      btn.on('pointerout', () => btn.setColor(color));
      btn.on('pointerdown', onClick);
      return btn;
    };

    // Menu buttons
    let startWaveValue = 1;
    let themeIdx = 0;
    const themeOptions = ['random', ...Object.keys(BG_THEMES)];
    let themeValue = themeOptions[themeIdx];

    // NEW RUN button — primary action
    let currentSeed = generateSeedString();
    let runMode: 'permadeath' | 'persistent' = 'permadeath';
    makeBtn(cy + 50, 'NEW RUN',
      () => this.scene.start('BroodScene', { mode: 'run', seed: currentSeed, runMode }),
      '#f0c040', '#ffe080');

    // Seed input (right of NEW RUN)
    const seedX = W / 2 + BTN_W / 2 + 20;
    const seedContainer = document.createElement('div');
    seedContainer.style.cssText = 'display:flex; align-items:center; gap:4px; pointer-events:auto;';

    const seedInput = document.createElement('input');
    seedInput.type = 'text';
    seedInput.value = currentSeed;
    seedInput.maxLength = 9;
    seedInput.style.cssText = 'width:100px; height:20px; font-family:"Courier New",monospace; font-size:12px; color:#f0c040; background:#0a0a14; border:1px solid #333; border-radius:3px; padding:0 6px; text-align:center; outline:none; box-sizing:border-box;';
    seedInput.addEventListener('input', () => {
      const formatted = formatSeedInput(seedInput.value);
      seedInput.value = formatted;
      currentSeed = formatted;
    });
    seedInput.addEventListener('focus', () => { seedInput.style.borderColor = '#f0c040'; });
    seedInput.addEventListener('blur', () => { seedInput.style.borderColor = '#333'; });

    const btnStyle = 'font-family:"Courier New",monospace; font-size:9px; height:20px; background:none; border:1px solid #333; border-radius:3px; padding:0 6px; cursor:pointer; color:#888; box-sizing:border-box;';

    const randomBtn = document.createElement('button');
    randomBtn.style.cssText = btnStyle;
    randomBtn.textContent = 'RNG';
    randomBtn.title = 'Random seed';
    randomBtn.onclick = () => { currentSeed = generateSeedString(); seedInput.value = currentSeed; };
    randomBtn.onmouseenter = () => { randomBtn.style.borderColor = '#f0c040'; };
    randomBtn.onmouseleave = () => { randomBtn.style.borderColor = '#333'; };

    const copyBtn = document.createElement('button');
    copyBtn.style.cssText = btnStyle;
    copyBtn.textContent = 'COPY';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(currentSeed);
      copyBtn.textContent = 'OK!';
      setTimeout(() => { copyBtn.textContent = 'COPY'; }, 1000);
    };
    copyBtn.onmouseenter = () => { copyBtn.style.borderColor = '#f0c040'; };
    copyBtn.onmouseleave = () => { copyBtn.style.borderColor = '#333'; };

    seedContainer.append(seedInput, randomBtn, copyBtn);
    this.add.dom(seedX + 82, cy + 50, seedContainer).setDepth(UI_DEPTH);

    // Mode toggle
    const modeLbl = this.add.text(seedX, cy + 74, 'PERMADEATH', {
      fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#c04040',
    }).setOrigin(0, 0.5).setDepth(UI_DEPTH).setInteractive({ useHandCursor: true });
    modeLbl.on('pointerdown', () => {
      runMode = runMode === 'permadeath' ? 'persistent' : 'permadeath';
      modeLbl.setText(runMode === 'permadeath' ? 'PERMADEATH' : 'PERSISTENT');
      modeLbl.setColor(runMode === 'permadeath' ? '#c04040' : '#4080c0');
    });
    modeLbl.on('pointerover', () => modeLbl.setAlpha(0.7));
    modeLbl.on('pointerout', () => modeLbl.setAlpha(1));

    // Legacy buttons
    const playBtn = makeBtn(cy + 96, 'PLAY',
      () => this.scene.start('BattleScene', { startWave: startWaveValue, theme: themeValue }));
    makeBtn(cy + 132, 'BROOD', () => this.scene.start('BroodScene'));
    makeBtn(cy + 168, 'SANDBOX', () => this.scene.start('SandboxScene'));

    // Wave start selector — right of PLAY
    const playRight = playBtn.x + BTN_W / 2 + 20;
    const pickerStyle = { fontFamily: '"Press Start 2P", monospace', fontSize: '14px', color: '#555' };
    const updateWaveLbl = () => {
      waveLbl.setText(String(startWaveValue));
      waveLbl.setColor(startWaveValue > 1 ? '#f0c040' : '#555');
    };
    const minusBtn = this.add.text(playRight, cy + 96, '<', pickerStyle).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(UI_DEPTH);
    const waveLbl = this.add.text(playRight + 28, cy + 96, '1', {
      fontFamily: '"Courier New", monospace', fontSize: '16px', color: '#555',
    }).setOrigin(0.5).setDepth(UI_DEPTH);
    const plusBtn = this.add.text(playRight + 57, cy + 96, '>', pickerStyle).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(UI_DEPTH);
    this.add.text(playRight + 82, cy + 96, 'W', {
      fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#444',
    }).setOrigin(0, 0.5).setDepth(UI_DEPTH);
    minusBtn.on('pointerdown', () => { startWaveValue = Math.max(1, startWaveValue - 1); updateWaveLbl(); });
    plusBtn.on('pointerdown', () => { startWaveValue++; updateWaveLbl(); });
    minusBtn.on('pointerover', () => minusBtn.setColor('#ccc'));
    minusBtn.on('pointerout', () => minusBtn.setColor('#555'));
    plusBtn.on('pointerover', () => plusBtn.setColor('#ccc'));
    plusBtn.on('pointerout', () => plusBtn.setColor('#555'));

    // Theme picker
    const themeLbl = this.add.text(playRight + 28, cy + 118, 'random', {
      fontFamily: '"Courier New", monospace', fontSize: '14px', color: '#555',
    }).setOrigin(0.5).setDepth(UI_DEPTH);
    const updateThemeLbl = () => {
      themeValue = themeOptions[themeIdx];
      themeLbl.setText(themeValue);
      themeLbl.setColor(themeValue !== 'random' ? '#f0c040' : '#555');
    };
    const themeLeft = this.add.text(playRight, cy + 118, '<', pickerStyle).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(UI_DEPTH);
    const themeRight = this.add.text(playRight + 57, cy + 118, '>', pickerStyle).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(UI_DEPTH);
    this.add.text(playRight + 82, cy + 118, 'BG', {
      fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#444',
    }).setOrigin(0, 0.5).setDepth(UI_DEPTH);
    themeLeft.on('pointerdown', () => { themeIdx = (themeIdx - 1 + themeOptions.length) % themeOptions.length; updateThemeLbl(); });
    themeRight.on('pointerdown', () => { themeIdx = (themeIdx + 1) % themeOptions.length; updateThemeLbl(); });
    themeLeft.on('pointerover', () => themeLeft.setColor('#ccc'));
    themeLeft.on('pointerout', () => themeLeft.setColor('#555'));
    themeRight.on('pointerover', () => themeRight.setColor('#ccc'));
    themeRight.on('pointerout', () => themeRight.setColor('#555'));

    // Marching bugs decoration — random units, live animated
    this.marchAnts = [];
    const bugCount = 20;
    for (let i = 0; i < bugCount; i++) {
      const key = UNIT_KEYS[Math.floor(Math.random() * UNIT_KEYS.length)];
      const def = UNIT_DEFS[key];
      const dir = Math.random() > 0.5 ? 1 : -1;
      const sw = def.w;
      const sh = def.h;
      const container = this.add.container(Math.random() * W, GND - sh).setDepth(0);
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
          burrowed: false, windup: 0, recover: 0,
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
