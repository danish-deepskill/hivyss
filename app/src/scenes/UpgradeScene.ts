import Phaser from 'phaser';
import { W, H } from '../config/Constants';
import { UPGRADE_DEFS } from '../config/UpgradeDefs';
import { SaveManager } from '../systems/SaveManager';

const S: number = W / 900;
function fs(px: number): string { return `${Math.round(px * S)}px`; }

interface UpgradeButtonEntry {
  key: string;
  txt: Phaser.GameObjects.Text;
  costTxt: Phaser.GameObjects.Text;
  descTxt: Phaser.GameObjects.Text;
}

export class UpgradeScene extends Phaser.Scene {
  private save!: SaveManager;
  private pointsText!: Phaser.GameObjects.Text;
  private upgradeButtons!: UpgradeButtonEntry[];

  constructor() {
    super('UpgradeScene');
  }

  create(): void {
    this.save = new SaveManager();

    // Background
    const bg: Phaser.GameObjects.Graphics = this.add.graphics();
    bg.fillStyle(0x0a0a14);
    bg.fillRect(0, 0, W, H);

    // Title
    this.add.text(W / 2, Math.round(16 * S), '\u2B21 UPGRADES', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: fs(14),
      color: '#f0c040',
    }).setOrigin(0.5);

    // Colony points
    this.pointsText = this.add.text(W / 2, Math.round(38 * S), `Colony Points: ${this.save.data.colonyPoints}`, {
      fontFamily: '"Courier New", monospace',
      fontSize: fs(12),
      color: '#f0c040',
    }).setOrigin(0.5);

    // Upgrade grid
    this.upgradeButtons = [];
    const entries = Object.entries(UPGRADE_DEFS);
    const cols: number = 2;
    const colW: number = Math.round(W * 0.42);
    const startX: number = Math.round((W - cols * colW) / 2);
    const startY: number = Math.round(60 * S);
    const rowH: number = Math.round(40 * S);

    entries.forEach(([key, def], i: number) => {
      const col: number = i % cols;
      const row: number = Math.floor(i / cols);
      const x: number = startX + col * colW;
      const y: number = startY + row * rowH;

      const level: number = this.save.getUpgradeLevel(key);
      const maxed: boolean = level >= def.maxLevel;
      const cost: number | string = maxed ? '---' : def.costPerLevel[level];
      const canAfford: boolean = !maxed && this.save.data.colonyPoints >= def.costPerLevel[level];

      const label: string = `${def.name} [${level}/${def.maxLevel}]`;
      const costLabel: string = maxed ? ' MAX' : ` \u2B21${cost}`;

      const txt: Phaser.GameObjects.Text = this.add.text(x, y, label, {
        fontFamily: '"Courier New", monospace',
        fontSize: fs(11),
        color: maxed ? '#555' : (canAfford ? '#ddd' : '#666'),
      });

      const costTxt: Phaser.GameObjects.Text = this.add.text(x + Math.round(220 * S), y, costLabel, {
        fontFamily: '"Courier New", monospace',
        fontSize: fs(11),
        color: maxed ? '#333' : (canAfford ? '#f0c040' : '#553'),
      });

      const descTxt: Phaser.GameObjects.Text = this.add.text(x, y + Math.round(16 * S), def.desc, {
        fontFamily: '"Courier New", monospace',
        fontSize: fs(9),
        color: '#444',
      });

      if (!maxed) {
        const hitArea: Phaser.GameObjects.Rectangle = this.add.rectangle(x + Math.round(140 * S), y + Math.round(10 * S), Math.round(300 * S), Math.round(34 * S), 0xffffff, 0)
          .setOrigin(0.5).setInteractive({ useHandCursor: canAfford });

        hitArea.on('pointerdown', () => {
          this.purchaseUpgrade(key);
        });

        if (canAfford) {
          hitArea.on('pointerover', () => txt.setColor('#ffe080'));
          hitArea.on('pointerout', () => txt.setColor('#ddd'));
        }
      }

      this.upgradeButtons.push({ key, txt, costTxt, descTxt });
    });

    // Back button
    const backBtn: Phaser.GameObjects.Text = this.add.text(W / 2, H - Math.round(20 * S), '\u25C0  BACK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: fs(10),
      color: '#888',
      backgroundColor: '#0a0a14',
      padding: { x: Math.round(14 * S), y: Math.round(6 * S) },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#ccc'));
    backBtn.on('pointerout', () => backBtn.setColor('#888'));
    backBtn.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });
  }

  private purchaseUpgrade(key: string): void {
    const def = UPGRADE_DEFS[key];
    const level: number = this.save.getUpgradeLevel(key);
    if (level >= def.maxLevel) return;

    const cost: number = def.costPerLevel[level];
    if (this.save.data.colonyPoints < cost) return;

    this.save.data.colonyPoints -= cost;
    this.save.data.upgrades[key] = level + 1;
    this.save.save();

    this.scene.restart();
  }
}
