import Phaser from 'phaser';
import type { Chamber } from '../systems/IncubationManager';
import { MAX_CHAMBERS } from '../systems/IncubationManager';
import { S } from '../config/Constants';

/**
 * Canvas-rendered cocoons on the ground near the hive.
 * Each cocoon appears where its larva was standing when consumed.
 */
export class CocoonVisuals {
  scene: Phaser.Scene;
  graphics: Phaser.GameObjects.Graphics[];
  /** Per-chamber cocoon position, set when a larva morphs. */
  positions: ({ x: number; y: number } | null)[];
  bobTime: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bobTime = 0;
    this.graphics = [];
    this.positions = new Array(MAX_CHAMBERS).fill(null);

    for (let i = 0; i < MAX_CHAMBERS; i++) {
      const g = scene.add.graphics();
      g.setDepth(5);
      this.graphics.push(g);
    }
  }

  /** Set the ground position for a cocoon when a larva is consumed. */
  setCocoonPosition(chamberIndex: number, x: number, y: number): void {
    this.positions[chamberIndex] = { x, y };
  }

  update(dt: number, chambers: ReadonlyArray<Chamber | null>, numChambers: number): void {
    this.bobTime += dt;

    for (let i = 0; i < MAX_CHAMBERS; i++) {
      const g = this.graphics[i];
      g.clear();

      if (i >= numChambers || !chambers[i]) {
        // Clear position when chamber empties (hatched or cancelled)
        if (!chambers[i]) this.positions[i] = null;
        continue;
      }

      const pos = this.positions[i];
      if (!pos) continue;

      const chamber = chambers[i]!;
      const progress = chamber.total > 0 ? 1 - chamber.remaining / chamber.total : 1;

      this.drawCocoon(g, pos.x, pos.y, progress, i);
    }
  }

  private drawCocoon(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number,
    progress: number, index: number,
  ): void {
    const size = 0.5 + progress * 0.5;
    const w = Math.round(5 * S * size);
    const h = Math.round(8 * S * size);

    const pulse = 1 + Math.sin(this.bobTime * 2.5 + index * 1.7) * 0.05;

    const cx = x;
    const cy = y;
    const drawW = w * 2 * pulse;
    const drawH = h * 2 / pulse;

    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(cx, y + h * 0.8, w * 1.6, 3);

    // Outer membrane
    const memR = Math.round(80 + progress * 140);
    const memG = Math.round(120 + progress * 60);
    const memB = Math.round(40 - progress * 10);
    const memColor = (memR << 16) | (memG << 8) | memB;
    g.fillStyle(memColor, 0.7 + progress * 0.2);
    g.fillEllipse(cx, cy, drawW, drawH);

    // Inner segments
    const segAlpha = 0.2 + progress * 0.15;
    const segColor = (Math.round(memR * 0.7) << 16) | (Math.round(memG * 0.6) << 8) | Math.round(memB * 0.8);
    g.lineStyle(1, segColor, segAlpha);
    for (let s = -1; s <= 1; s++) {
      const segY = cy + s * h * 0.35;
      const segSpread = w * 0.6 * (1 - Math.abs(s) * 0.25);
      g.beginPath();
      g.moveTo(cx - segSpread, segY);
      g.lineTo(cx + segSpread, segY);
      g.strokePath();
    }

    // Highlight
    g.fillStyle(0xffffff, 0.1 + progress * 0.08);
    g.fillEllipse(cx - w * 0.2, cy - h * 0.35, w * 0.7, h * 0.5);

    // Veins at 40%+
    if (progress > 0.4) {
      const veinAlpha = (progress - 0.4) / 0.6 * 0.35;
      g.lineStyle(0.7, 0x506030, veinAlpha);

      g.beginPath();
      g.moveTo(cx - w * 0.4, cy - h * 0.5);
      g.lineTo(cx - w * 0.1, cy);
      g.lineTo(cx - w * 0.3, cy + h * 0.4);
      g.strokePath();

      g.beginPath();
      g.moveTo(cx + w * 0.3, cy - h * 0.3);
      g.lineTo(cx + w * 0.1, cy + h * 0.2);
      g.strokePath();
    }

    // Cracks at 80%+
    if (progress > 0.8) {
      const crackAlpha = (progress - 0.8) / 0.2 * 0.5;
      g.lineStyle(1, 0x302010, crackAlpha);

      g.beginPath();
      g.moveTo(cx - w * 0.2, cy - h * 0.6);
      g.lineTo(cx + w * 0.15, cy - h * 0.15);
      g.lineTo(cx - w * 0.05, cy + h * 0.3);
      g.strokePath();
    }

    // Pulsing glow at 90%+
    if (progress > 0.9) {
      const glowPulse = (Math.sin(this.bobTime * 7 + index * 1.3) * 0.5 + 0.5) * 0.35;
      g.fillStyle(0xc0e060, glowPulse);
      g.fillEllipse(cx, cy, drawW * 1.4, drawH * 1.4);
    }
  }

  destroy(): void {
    this.graphics.forEach(g => g.destroy());
    this.graphics = [];
  }
}
