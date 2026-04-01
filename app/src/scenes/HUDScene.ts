import Phaser from 'phaser';
import type { Side } from '../types';
import { DEFAULT_WORLD_W, SBW as SBW_DEFAULT } from '../config/Constants';
import { LANE } from '../config/Layout';
const GND = LANE.land.groundY;

export class HUDScene extends Phaser.Scene {
  private playerBar!: Phaser.GameObjects.Graphics;
  private enemyBar!: Phaser.GameObjects.Graphics;

  constructor() {
    super('HUDScene');
  }

  create(): void {
    const worldW: number = this.registry.get('worldW') ?? DEFAULT_WORLD_W;
    this.cameras.main.setBounds(0, 0, worldW, 720);
    this.playerBar = this.add.graphics();
    this.enemyBar = this.add.graphics();
  }

  update(): void {
    const scrollX: number = this.registry.get('cam.scrollX') ?? 0;
    const zoom: number = this.registry.get('cam.zoom') ?? 1;
    this.cameras.main.scrollX = scrollX;
    this.cameras.main.zoom = zoom;

    const playerHp: number = this.registry.get('playerBase.hp') ?? 1000;
    const playerMax: number = this.registry.get('playerBase.maxHp') ?? 1000;
    const enemyHp: number = this.registry.get('enemyBase.hp') ?? 1000;
    const enemyMax: number = this.registry.get('enemyBase.maxHp') ?? 1000;
    const SBW: number = this.registry.get('SBW') ?? SBW_DEFAULT;
    const worldW: number = this.registry.get('worldW') ?? DEFAULT_WORLD_W;

    this.drawHpBar(this.playerBar, 2, GND - 114, SBW - 4, playerHp, playerMax, 'player');
    this.drawHpBar(this.enemyBar, worldW - SBW + 2, GND - 114, SBW - 4, enemyHp, enemyMax, 'enemy');
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
}
