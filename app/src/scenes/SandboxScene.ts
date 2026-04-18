import Phaser from 'phaser';
import { W, H, SBW } from '../config/Constants';
import { LANE } from '../config/Layout';
const GND = LANE.land.groundY;
import { UNIT_DEFS, TIER_DEFS, drawUnit } from '../units/registry';
import { resolveColors } from '../config/Palettes';
import { Unit, resetUid } from '../entities/Unit';
import { BaseStructure } from '../entities/BaseStructure';
import { BaseEntity } from '../entities/BaseEntity';
import { CombatSystem } from '../systems/CombatSystem';
import { EventBus } from '../systems/EventBus';
import { ParticleManager } from '../systems/ParticleManager';
import { AudioManager } from '../systems/AudioManager';
import { HpHud } from '../systems/HpHud';
import { ScenarioEngine } from '../debug/scenarioEngine';
import { registerPhase8Scenarios } from '../debug/phase8Scenarios';
import type { EffectBearer } from '../config/combat/effects/types';
import type { RenderUnit, Side } from '../types';

// Sandbox base HP — matches production BASE_HP. Low enough that a
// sustained front line breaks through in 10-30 seconds (fast enough
// for smoke iteration), high enough that a single unit observing
// burn/DOT has time to watch ticks before the base falls.
const SANDBOX_BASE_HP = 1000;
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
  // Base targets wired via the production BaseStructure + BaseEntity
  // pair so sandbox smoke tests exercise the same code paths as
  // WorldScene (ranged base targeting, applyEffectsPhase on
  // BaseEntity, etc.).
  private playerBaseStructure!: BaseStructure;
  private enemyBaseStructure!: BaseStructure;
  private playerBaseEntity!: BaseEntity;
  private enemyBaseEntity!: BaseEntity;
  // HP bars drawn above each base. WorldScene gets its bars from
  // HUDScene (registry-driven); sandbox draws them inline to avoid
  // launching a second scene just for two bars.
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private enemyHpBar!: Phaser.GameObjects.Graphics;
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
    // Pass W as worldW so the in-CombatSystem wall checks (at
    // `this.worldW - SBW`) align with the sandbox's visible arena
    // instead of DEFAULT_WORLD_W=2560. Without this, player units
    // would march past the visible right edge chasing an invisible
    // wall, and the BaseEntity wired below would never be reached.
    this.combat = new CombatSystem(this, new EventBus(), W);
    this.particles = new ParticleManager(this);
    this.audio = new AudioManager();

    // Generate unit preview textures
    this.previews = this.generatePreviews();

    // Draw background
    this.drawBackground();

    // Build UI
    this.buildUI();

    // Real BaseEntity wiring — mirrors GameManager.ts:104-125 but
    // without larvae / cocoons / wave logic / HP UI. HP is bumped to
    // SANDBOX_BASE_HP so scenarios have room to observe DOT and
    // repeated hits before the base dies.
    this.playerBaseStructure = new BaseStructure(this, 0, 'player');
    this.playerBaseStructure.maxHp = SANDBOX_BASE_HP;
    this.playerBaseStructure.setHp(SANDBOX_BASE_HP);
    this.enemyBaseStructure = new BaseStructure(this, W - SBW, 'enemy');
    this.enemyBaseStructure.maxHp = SANDBOX_BASE_HP;
    this.enemyBaseStructure.setHp(SANDBOX_BASE_HP);
    this.playerBaseEntity = new BaseEntity(this.playerBaseStructure, SBW);
    this.enemyBaseEntity = new BaseEntity(this.enemyBaseStructure, W - SBW);
    this.combat.setBaseEntities(this.playerBaseEntity, this.enemyBaseEntity);

    // HP bars above each hive, drawn inline (no HUDScene in sandbox).
    this.playerHpBar = this.add.graphics();
    this.enemyHpBar = this.add.graphics();
    this.redrawHpBars();

    // Spawn initial preview
    this.resetArena();

    // Debug HP HUD — type `hphud` in the debug console to toggle.
    // Smoke scenarios — type `scenarios list` in the debug console.
    if (import.meta.env.DEV) {
      HpHud.attachSource(() => this.units);
      ScenarioEngine.attachSandbox(() => ({
        spawn: (key, side, x) => this.scenarioSpawn(key, side, x),
        clear: () => this.scenarioClear(),
        startFight: () => this.scenarioStartFight(),
      }));
      registerPhase8Scenarios();
      this.events.once('shutdown', () => {
        HpHud.detachSource();
        ScenarioEngine.detachSandbox();
      });
    }
  }

  /**
   * Scenario API — used by the `/scenarios` dev command to set up
   * Phase-scoped smoke tests. These helpers mirror the internal
   * resetArena spawn path but let callers position units at specific
   * coordinates and mix unit types on the same side. No gameplay
   * code should call these; they're debug tooling only.
   */
  scenarioClear(): void {
    this.resultText.setText('');
    this.statsText.setText('');
    this.running = false;
    this.elapsed = 0;
    this.units.forEach((u: Unit) => u.kill());
    this.units = [];
    this.resetBases();
  }

  /**
   * Restore bases to full HP and wipe any ActiveEffects they may
   * have accumulated (e.g., burn from a previous Cinderfly run).
   * Called from both resetArena and scenarioClear so every fresh
   * scenario starts with clean base state. EffectBearer.activeEffects
   * is set by EffectSystem.applyEffect lazily; BaseEntity does not
   * declare the field in its class shape so the reset casts through
   * the interface the EffectSystem uses.
   */
  private resetBases(): void {
    this.playerBaseStructure.setHp(SANDBOX_BASE_HP);
    this.enemyBaseStructure.setHp(SANDBOX_BASE_HP);
    this.playerBaseEntity.syncDead();
    this.enemyBaseEntity.syncDead();
    (this.playerBaseEntity as EffectBearer).activeEffects = [];
    (this.enemyBaseEntity as EffectBearer).activeEffects = [];
    if (this.playerHpBar) this.redrawHpBars();
  }

  /** Redraw HP bars above each hive. Mirrors HUDScene.drawHpBar. */
  private redrawHpBars(): void {
    this.drawHpBar(this.playerHpBar, 2, GND - 114, SBW - 4,
      this.playerBaseStructure.hp, this.playerBaseStructure.maxHp, 'player');
    this.drawHpBar(this.enemyHpBar, W - SBW + 2, GND - 114, SBW - 4,
      this.enemyBaseStructure.hp, this.enemyBaseStructure.maxHp, 'enemy');
  }

  private drawHpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, hp: number, maxHp: number, side: Side): void {
    g.clear();
    const frac = Math.max(0, hp / maxHp);
    const isBlue = side === 'player';
    g.fillStyle(0x080810);
    g.fillRect(x, y, w, 6);
    let hpColor: number;
    if (frac > 0.5) hpColor = isBlue ? 0x4ab0f0 : 0xf05050;
    else if (frac > 0.25) hpColor = 0xf0c040;
    else hpColor = 0xf03030;
    g.fillStyle(hpColor);
    g.fillRect(x, y, w * frac, 6);
    g.lineStyle(0.5, 0x111111);
    g.strokeRect(x, y, w, 6);
  }

  scenarioSpawn(key: string, side: Side, x: number): Unit {
    const def = UNIT_DEFS[key];
    if (!def) throw new Error(`Unknown unit key: ${key}`);
    const unit = new Unit(this, { ...def, _key: key }, side, x);
    this.units.push(unit);
    return unit;
  }

  scenarioStartFight(): void {
    this.running = true;
    this.elapsed = 0;
    this.resultText.setText('');
    this.statsText.setText('');
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
    const lt = TIER_DEFS[ld.tier] || TIER_DEFS[0];
    const rt = TIER_DEFS[rd.tier] || TIER_DEFS[0];
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

    // Restore bases to full HP so repeat reset/fight cycles don't
    // accumulate damage across runs.
    this.resetBases();

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

    // Advance base flash animations (mirrors GameManager.tick's
    // per-frame base.update). Even though the structures are hidden,
    // update is cheap and keeps state consistent.
    this.playerBaseStructure.update(dt);
    this.enemyBaseStructure.update(dt);

    this.combat.resolve(
      this.units,
      dt,
      this.playerBaseStructure,
      this.enemyBaseStructure,
      this.particles,
      0,
      this.audio,
    );

    // Re-derive BaseEntity.dead so spatial-index / _findTarget
    // queries stop returning a destroyed base on the next frame.
    // Mirrors GameManager.ts:296-297.
    this.playerBaseEntity.syncDead();
    this.enemyBaseEntity.syncDead();

    this.redrawHpBars();

    // Clean up dead units
    this.units = this.units.filter((u: Unit) => {
      if (u.dead) { u.kill(); return false; }
      return true;
    });

    // Win condition: a base was destroyed. Mirrors WorldScene/
    // GameManager victory semantics so sandbox smoke tests reflect
    // real-match win state. Unit wipeout does NOT end the fight on
    // its own — the surviving side marches to the opposing wall and
    // naturally destroys the enemy base.
    const playerBaseDead = this.playerBaseStructure.hp <= 0;
    const enemyBaseDead = this.enemyBaseStructure.hp <= 0;

    if (playerBaseDead || enemyBaseDead) {
      this.running = false;
      const leftAlive = this.units.filter((u: Unit) => u.side === 'player');
      const rightAlive = this.units.filter((u: Unit) => u.side === 'enemy');

      if (playerBaseDead && enemyBaseDead) {
        this.resultText.setText('DRAW!');
        this.resultText.setColor('#888888');
        this.statsText.setText(`both bases destroyed | ${this.elapsed.toFixed(1)}s`);
      } else if (enemyBaseDead) {
        this.resultText.setText('PLAYER WINS!');
        this.resultText.setColor('#40c0ff');
        const totalHp = leftAlive.reduce((s: number, u: Unit) => s + u.hp, 0);
        const maxHp = leftAlive.reduce((s: number, u: Unit) => s + u.maxHp, 0);
        this.statsText.setText(`${leftAlive.length} survived | ${totalHp}/${maxHp} HP | ${this.elapsed.toFixed(1)}s`);
      } else {
        this.resultText.setText('ENEMY WINS!');
        this.resultText.setColor('#ff6040');
        const totalHp = rightAlive.reduce((s: number, u: Unit) => s + u.hp, 0);
        const maxHp = rightAlive.reduce((s: number, u: Unit) => s + u.maxHp, 0);
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
        burrowed: false, foreswingTimer: 0, backswingTimer: 0,
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
