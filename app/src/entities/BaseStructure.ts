import Phaser from 'phaser';
import type { Side } from '../types';
import { BASE_W, BASE_HP, GND, S } from '../config/Constants';

export class BaseStructure extends Phaser.GameObjects.Container {
  side: Side;
  hp: number;
  maxHp: number;
  flashTimer: number;
  shielded: boolean;
  gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, side: Side) {
    super(scene, x, 0);
    this.side = side;
    this.hp = BASE_HP;
    this.maxHp = BASE_HP;
    this.flashTimer = 0;
    this.shielded = false;

    this.gfx = scene.add.graphics();
    this.add(this.gfx);

    scene.add.existing(this);
    this.redraw();
  }

  setHp(hp: number): void {
    this.hp = Math.max(0, Math.min(this.maxHp, hp));
    this.redraw();
  }

  flash(duration: number = 0.2): void {
    this.flashTimer = duration;
  }

  update(dt: number): void {
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - dt * 2);
      this.redraw();
    }
  }

  redraw(): void {
    const g = this.gfx;
    const isBlue = this.side === 'player';
    const frac = Math.max(0, this.hp / this.maxHp);
    const bw = Math.round(BASE_W * S);
    const cx = bw / 2;

    g.clear();

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(cx + 3, GND + 3, bw * 1.04, 20);

    // Flash overlay
    if (this.flashTimer > 0) {
      const flashAlpha = this.flashTimer * 0.5;
      g.fillStyle(isBlue ? 0x50b4ff : 0xff5050, flashAlpha);
      g.fillEllipse(cx, GND - 42, bw, 92);
    }

    // Main hive dome — layered organic shape
    // Base mound (wider, sits on ground)
    g.fillStyle(isBlue ? 0x2a1e08 : 0x3a1008);
    g.beginPath();
    g.moveTo(0, GND + 2);
    g.lineTo(2, GND - 50);
    g.arc(cx, GND - 50, bw / 2 - 2, Math.PI, 0, false);
    g.lineTo(bw, GND + 2);
    g.closePath();
    g.fillPath();

    // Inner dome (taller, narrower)
    g.fillStyle(isBlue ? 0x3a2c10 : 0x4a1810);
    g.beginPath();
    g.moveTo(6, GND - 4);
    g.arc(cx, GND - 24, bw / 2 - 6, Math.PI * 0.85, Math.PI * 0.15, false);
    g.lineTo(bw - 8, GND + 2);
    g.lineTo(8, GND + 2);
    g.closePath();
    g.fillPath();

    // Waxy ridges (horizontal bands on the hive)
    g.lineStyle(1.5, isBlue ? 0x4a3c18 : 0x5a2818, 0.5);
    for (let i = 0; i < 4; i++) {
      const ry = GND - 20 - i * 16;
      const spread = (bw * 0.44) * (1 - i * 0.15);
      g.beginPath();
      g.moveTo(cx - spread, ry);
      g.lineTo(cx - spread * 0.3, ry - 3);
      g.lineTo(cx + spread * 0.3, ry - 3);
      g.lineTo(cx + spread, ry);
      g.strokePath();
    }

    // Honeycomb cells (hexagonal pattern)
    const cellR = Math.round(5 * S);
    const cells = [
      { x: cx - 12, y: GND - 60 },
      { x: cx + 8, y: GND - 62 },
      { x: cx - 2, y: GND - 48 },
      { x: cx - 16, y: GND - 42 },
      { x: cx + 14, y: GND - 44 },
      { x: cx + 2, y: GND - 72 },
    ];
    cells.forEach(c => {
      // Cell glow (amber when healthy, red when damaged)
      const cellColor = frac > 0.4 ? (isBlue ? 0xc89020 : 0xa06818) : 0xff3232;
      const cellAlpha = frac > 0.4 ? 0.35 : 0.45;
      g.fillStyle(cellColor, cellAlpha);
      this.drawHexagon(g, c.x, c.y, cellR);
      g.fillPath();

      // Cell border
      g.lineStyle(0.8, isBlue ? 0x5a4820 : 0x6a3020, 0.4);
      this.drawHexagon(g, c.x, c.y, cellR);
      g.strokePath();
    });

    // Entrance tunnel (facing the battlefield)
    g.fillStyle(0x0a0806);
    const tunnelW = Math.round(10 * S);
    const tx = isBlue ? bw - tunnelW - 2 : 2;
    g.beginPath();
    g.arc(tx + tunnelW / 2, GND - 4, tunnelW / 2, Math.PI, 0, false);
    g.fillPath();

    // Tunnel rim (wax lip)
    g.lineStyle(2, isBlue ? 0x4a3c18 : 0x5a2818, 0.7);
    g.beginPath();
    g.arc(tx + tunnelW / 2, GND - 4, tunnelW / 2 + 1, Math.PI, 0, false);
    g.strokePath();

    // Damage — oozing resin and broken cells
    if (frac < 0.5) {
      const dmgAlpha = 0.6 * (1 - frac);
      // Resin drips
      g.fillStyle(0x806020, dmgAlpha);
      g.beginPath();
      g.moveTo(cx - 8, GND - 55);
      g.lineTo(cx - 6, GND - 35);
      g.lineTo(cx - 10, GND - 30);
      g.closePath();
      g.fillPath();

      g.beginPath();
      g.moveTo(cx + 12, GND - 50);
      g.lineTo(cx + 14, GND - 28);
      g.lineTo(cx + 10, GND - 25);
      g.closePath();
      g.fillPath();

      // Cracked cell outlines
      g.lineStyle(1, 0x000000, dmgAlpha);
      g.beginPath();
      g.moveTo(cx - 14, GND - 58);
      g.lineTo(cx - 8, GND - 48);
      g.lineTo(cx - 16, GND - 38);
      g.strokePath();
    }

    // Crown spire (organic antenna/spike on top)
    g.fillStyle(isBlue ? 0x4a3c18 : 0x5a2818);
    g.beginPath();
    g.moveTo(cx - 3, GND - 86);
    g.lineTo(cx - 1, GND - 104);
    g.lineTo(cx + 1, GND - 104);
    g.lineTo(cx + 3, GND - 86);
    g.closePath();
    g.fillPath();

    // Spire tip glow
    g.fillStyle(isBlue ? 0x70d8ff : 0xff8060, 0.6);
    g.fillCircle(cx, GND - 104, Math.round(2 * S));

    // HP bar
    const hpW = bw - 4;
    g.fillStyle(0x080810);
    g.fillRect(2, GND - 114, hpW, 6);

    let hpColor: number;
    if (frac > 0.5) hpColor = isBlue ? 0x4ab0f0 : 0xf05050;
    else if (frac > 0.25) hpColor = 0xf0c040;
    else hpColor = 0xf03030;
    g.fillStyle(hpColor);
    g.fillRect(2, GND - 114, hpW * frac, 6);

    g.lineStyle(0.5, 0x111111);
    g.strokeRect(2, GND - 114, hpW, 6);

    // Shield aura (organic membrane)
    if (this.shielded) {
      g.lineStyle(3, 0x5ac8f8, 0.3);
      g.strokeEllipse(cx, GND - 42, bw * 1.1, 100);
    }
  }

  private drawHexagon(g: Phaser.GameObjects.Graphics, hx: number, hy: number, r: number): void {
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = hx + r * Math.cos(angle);
      const py = hy + r * Math.sin(angle);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  }
}
