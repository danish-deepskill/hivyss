import Phaser from 'phaser';
import { W, H } from '../config/Constants';
import { LANE } from '../config/Layout';
const GND = LANE.land.groundY;
import { UNIT_DEFS, TIER_DEFS, drawUnit } from '../units/registry';
import { resolveColors } from '../config/Palettes';
import { Unit, resetUid } from '../entities/Unit';
import { CombatSystem } from '../systems/CombatSystem';
import { EventBus } from '../systems/EventBus';
import { ParticleManager } from '../systems/ParticleManager';
import { AudioManager } from '../systems/AudioManager';
import type { RenderUnit } from '../types';
const UNIT_KEYS: string[] = Object.keys(UNIT_DEFS);

export class SandboxScene extends Phaser.Scene {
  private leftKey!: string;
  private rightKey!: string;
  private leftCount!: number;
  private rightCount!: number;
  private units!: Unit[];
  private running!: boolean;
  private elapsed!: number;
  private combat!: CombatSystem;
  private particles!: ParticleManager;
  private audio!: AudioManager;
  private previews!: void;
  private leftIcon!: Phaser.GameObjects.Image;
  private leftLabel!: Phaser.GameObjects.Text;
  private leftCountLabel!: Phaser.GameObjects.Text;
  private rightIcon!: Phaser.GameObjects.Image;
  private rightLabel!: Phaser.GameObjects.Text;
  private rightCountLabel!: Phaser.GameObjects.Text;
  private fightBtn!: Phaser.GameObjects.Text;
  private resetBtn!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;

  constructor() {
    super('SandboxScene');
  }

  create(): void {
    resetUid();

    // State
    this.leftKey = UNIT_KEYS[0];
    this.rightKey = UNIT_KEYS[1];
    this.leftCount = 3;
    this.rightCount = 3;
    this.units = [];
    this.running = false;
    this.combat = new CombatSystem(this, new EventBus());
    this.particles = new ParticleManager(this);
    this.audio = new AudioManager();

    // Generate unit preview textures
    this.previews = this.generatePreviews();

    // Draw background
    this.drawBackground();

    // Build UI
    this.buildUI();

    // Spawn initial preview
    this.resetArena();
  }

  private buildUI(): void {
    const cy: number = 28;

    // Title
    this.add.text(W / 2, 10, 'SANDBOX', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '20px', color: '#f0c040',
    }).setOrigin(0.5, 0);

    // Left side controls
    this.leftIcon = this.add.image(W * 0.2 - 71, cy + 8, '_sb_preview_' + this.leftKey).setScale(1.5);
    this.leftLabel = this.add.text(W * 0.2 + 14, cy, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px', color: '#40c0ff',
    }).setOrigin(0.5, 0);

    this.leftCountLabel = this.add.text(W * 0.2, cy + 22, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px', color: '#aaa',
    }).setOrigin(0.5, 0);

    // Left arrows
    this.makeBtn(W * 0.2 - 114, cy, '\u25C0', () => this.cycleUnit('left', -1));
    this.makeBtn(W * 0.2 + 114, cy, '\u25B6', () => this.cycleUnit('left', 1));
    this.makeBtn(W * 0.2 - 57, cy + 20, '-', () => this.adjustCount('left', -1));
    this.makeBtn(W * 0.2 + 57, cy + 20, '+', () => this.adjustCount('left', 1));

    // Right side controls (capped so it doesn't overflow on wide screens)
    const rx: number = Math.min(W * 0.8, W - 157);
    this.rightIcon = this.add.image(rx + 71, cy + 8, '_sb_preview_' + this.rightKey).setScale(1.5);
    this.rightLabel = this.add.text(rx - 14, cy, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px', color: '#ff6040',
    }).setOrigin(0.5, 0);

    this.rightCountLabel = this.add.text(rx, cy + 22, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px', color: '#aaa',
    }).setOrigin(0.5, 0);

    this.makeBtn(rx - 114, cy, '\u25C0', () => this.cycleUnit('right', -1));
    this.makeBtn(rx + 114, cy, '\u25B6', () => this.cycleUnit('right', 1));
    this.makeBtn(rx - 57, cy + 20, '-', () => this.adjustCount('right', -1));
    this.makeBtn(rx + 57, cy + 20, '+', () => this.adjustCount('right', 1));

    // Center buttons
    this.fightBtn = this.makeBtn(W / 2, cy + 4, '\u2694 FIGHT', () => this.startFight(), '#f0c040', '16px');
    this.resetBtn = this.makeBtn(W / 2, cy + 26, '\u21BB RESET', () => this.resetArena(), '#888', '13px');

    // Back button
    this.makeBtn(85, H - 30, '\u25C0 BACK', () => {
      this.scene.start('MainMenuScene');
    }, '#888', '13px');

    // Result text
    this.resultText = this.add.text(W / 2, GND + 20, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '17px', color: '#f0c040',
    }).setOrigin(0.5, 0);

    // Stats text
    this.statsText = this.add.text(W / 2, GND + 38, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '13px', color: '#666',
    }).setOrigin(0.5, 0);

    this.updateLabels();
  }

  private makeBtn(x: number, y: number, label: string, cb: () => void, color: string = '#ccc', size: string = '14px'): Phaser.GameObjects.Text {
    const btn: Phaser.GameObjects.Text = this.add.text(x, y, label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: size, color: color,
      backgroundColor: '#0a0a14',
      padding: { x: 11, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setAlpha(0.7));
    btn.on('pointerout', () => btn.setAlpha(1));
    btn.on('pointerdown', cb);
    return btn;
  }

  private cycleUnit(side: string, dir: number): void {
    if (this.running) return;
    const key: 'leftKey' | 'rightKey' = side === 'left' ? 'leftKey' : 'rightKey';
    let idx: number = UNIT_KEYS.indexOf(this[key]) + dir;
    if (idx < 0) idx = UNIT_KEYS.length - 1;
    if (idx >= UNIT_KEYS.length) idx = 0;
    this[key] = UNIT_KEYS[idx];
    this.updateLabels();
    this.resetArena();
  }

  private adjustCount(side: string, dir: number): void {
    if (this.running) return;
    const key: 'leftCount' | 'rightCount' = side === 'left' ? 'leftCount' : 'rightCount';
    this[key] = Math.max(1, Math.min(10, this[key] + dir));
    this.updateLabels();
    this.resetArena();
  }

  private updateLabels(): void {
    const ld = UNIT_DEFS[this.leftKey];
    const rd = UNIT_DEFS[this.rightKey];
    const lt = TIER_DEFS[ld.tier] || TIER_DEFS.F;
    const rt = TIER_DEFS[rd.tier] || TIER_DEFS.F;
    this.leftLabel.setText(ld.name);
    this.leftLabel.setColor(lt.color);
    this.leftCountLabel.setText(`x${this.leftCount}`);
    this.leftIcon.setTexture('_sb_preview_' + this.leftKey);
    this.rightLabel.setText(rd.name);
    this.rightLabel.setColor(rt.color);
    this.rightCountLabel.setText(`x${this.rightCount}`);
    this.rightIcon.setTexture('_sb_preview_' + this.rightKey);
  }

  private resetArena(): void {
    resetUid();
    this.running = false;
    this.resultText.setText('');
    this.statsText.setText('');
    this.elapsed = 0;

    // Clear existing units
    this.units.forEach((u: Unit) => u.kill());
    this.units = [];

    // Spawn left team (player side)
    const ld = UNIT_DEFS[this.leftKey];
    const spacing: number = Math.round((ld.w + 4) * 1.2);
    for (let i = 0; i < this.leftCount; i++) {
      const x: number = Math.round(57) + i * spacing;
      const unit: Unit = new Unit(this, { ...ld, _key: this.leftKey }, 'player', x);
      this.units.push(unit);
    }

    // Spawn right team (enemy side)
    const rd = UNIT_DEFS[this.rightKey];
    const rSpacing: number = Math.round((rd.w + 4) * 1.2);
    for (let i = 0; i < this.rightCount; i++) {
      const x: number = Math.round(W - 57) - i * rSpacing - Math.round(rd.w);
      const unit: Unit = new Unit(this, { ...rd, _key: this.rightKey, primary: this.toEnemyColor(rd.primary ?? 0xffffff), secondary: this.toEnemyDark(rd.secondary ?? 0x808080) }, 'enemy', x);
      this.units.push(unit);
    }
  }

  private startFight(): void {
    if (this.running) return;
    this.running = true;
    this.elapsed = 0;
    this.resultText.setText('');
    this.statsText.setText('');
  }

  update(time: number, delta: number): void {
    const dt: number = Math.min(delta / 1000, 0.05);

    this.particles.update(dt);

    if (!this.running) return;

    this.elapsed += dt;

    // Dummy bases (no base damage in sandbox -- fight until one side is wiped)
    const dummyBase = { hp: 999999, setHp(): void {}, flash(): void {} } as any;

    this.combat.resolve(this.units, dt, dummyBase, dummyBase, this.particles, 0, this.audio);

    // Clean up dead
    this.units = this.units.filter((u: Unit) => {
      if (u.dead) { u.kill(); return false; }
      return true;
    });

    // Check winner
    const leftAlive: Unit[] = this.units.filter((u: Unit) => u.side === 'player');
    const rightAlive: Unit[] = this.units.filter((u: Unit) => u.side === 'enemy');

    if (leftAlive.length === 0 || rightAlive.length === 0) {
      this.running = false;
      const ld = UNIT_DEFS[this.leftKey];
      const rd = UNIT_DEFS[this.rightKey];
      if (leftAlive.length === 0 && rightAlive.length === 0) {
        this.resultText.setText('DRAW!');
        this.resultText.setColor('#888888');
      } else if (leftAlive.length > 0) {
        this.resultText.setText(`${ld.name} WINS!`);
        this.resultText.setColor('#40c0ff');
        const totalHp: number = leftAlive.reduce((s: number, u: Unit) => s + u.hp, 0);
        const maxHp: number = leftAlive.reduce((s: number, u: Unit) => s + u.maxHp, 0);
        this.statsText.setText(`${leftAlive.length} survived | ${totalHp}/${maxHp} HP | ${this.elapsed.toFixed(1)}s`);
      } else {
        this.resultText.setText(`${rd.name} WINS!`);
        this.resultText.setColor('#ff6040');
        const totalHp: number = rightAlive.reduce((s: number, u: Unit) => s + u.hp, 0);
        const maxHp: number = rightAlive.reduce((s: number, u: Unit) => s + u.maxHp, 0);
        this.statsText.setText(`${rightAlive.length} survived | ${totalHp}/${maxHp} HP | ${this.elapsed.toFixed(1)}s`);
      }
    }
  }

  private generatePreviews(): void {
    // Clean up any leftover textures from previous visits
    UNIT_KEYS.forEach((key: string) => {
      const texKey: string = '_sb_preview_' + key;
      if (this.textures.exists(texKey)) this.textures.remove(texKey);
    });
    UNIT_KEYS.forEach((key: string) => {
      const def = UNIT_DEFS[key];
      const pad: number = 10;
      const pw: number = def.w + pad * 2;
      const ph: number = def.h + pad * 2 + 10;
      const g: Phaser.GameObjects.Graphics = this.add.graphics();
      const renderUnit: RenderUnit = {
        w: def.w, h: def.h,
        ...resolveColors(def),
        palette: def.palette,
        facing: 1, bob: 0,
        state: 'march' as const, atkCd: 0, atkRate: def.atkRate,
        trait: def.trait, hp: def.hp, maxHp: def.hp,
        burrowed: false, hitCount: 0, foreswingTimer: 0, backswingTimer: 0,
      };
      drawUnit(g, renderUnit, pw / 2, pad);
      const texKey: string = '_sb_preview_' + key;
      g.generateTexture(texKey, pw, ph);
      g.destroy();
    });
  }

  private toEnemyColor(col: number): number {
    const r: number = (col >> 16) & 0xff, g: number = (col >> 8) & 0xff, b: number = col & 0xff;
    const lum: number = (r + g + b) / 3;
    return (Math.min(255, Math.round(lum * 0.5 + 140)) << 16) | (Math.round(lum * 0.25 + 16) << 8) | Math.round(lum * 0.2 + 16);
  }

  private toEnemyDark(dk: number): number {
    const r: number = (dk >> 16) & 0xff, g: number = (dk >> 8) & 0xff, b: number = dk & 0xff;
    const lum: number = (r + g + b) / 3;
    return (Math.min(255, Math.round(lum * 0.4 + 80)) << 16) | (Math.round(lum * 0.12 + 8) << 8) | Math.round(lum * 0.1 + 8);
  }

  private drawBackground(): void {
    const bg: Phaser.GameObjects.Graphics = this.add.graphics();
    bg.fillStyle(0x0e0e18);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(0xffffff, 0.1);
    for (let i = 0; i < 50; i++) {
      bg.fillRect((i * 137.5) % W, (i * 73) % (GND - 20), 1, 1);
    }
    bg.fillStyle(0x1e1a0c);
    bg.fillRect(0, GND, W, H - GND);
    bg.fillStyle(0x2a2410);
    bg.fillRect(0, GND, W, 8);

    // VS divider
    bg.lineStyle(1, 0xffffff, 0.08);
    for (let y = 50; y < GND; y += 12) {
      bg.beginPath();
      bg.moveTo(W / 2, y);
      bg.lineTo(W / 2, Math.min(y + 4, GND));
      bg.strokePath();
    }
    this.add.text(W / 2, GND * 0.5, 'VS', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '28px', color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.06);
  }

}
