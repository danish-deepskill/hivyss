import Phaser from 'phaser';
import { MAX_LARVAE } from '../systems/IncubationManager';
import { GND, S, BASE_W } from '../config/Constants';

/** Per-larva roaming state. */
interface LarvaState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: number;
}

/** Bounding box for larva roaming — below the hive. */
const ROAM_MIN_X = -0.8;
const ROAM_MAX_X = 1.2;
const ROAM_MIN_Y = 2;
const ROAM_MAX_Y = 14;
const LARVA_SPEED = 8;

/**
 * Canvas-rendered larvae that roam on the ground below the player hive.
 * Purely cosmetic — one larva per empty incubation chamber.
 * When a chamber is occupied (incubating), its larva disappears.
 */
export class LarvaVisuals {
  scene: Phaser.Scene;
  graphics: Phaser.GameObjects.Graphics[];
  hiveCenter: number;
  bobTime: number;
  larvae: LarvaState[];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const bw = Math.round(BASE_W * S);
    this.hiveCenter = bw / 2;
    this.bobTime = 0;
    this.graphics = [];
    this.larvae = [];

    for (let i = 0; i < MAX_LARVAE; i++) {
      const g = scene.add.graphics();
      g.setDepth(5);
      this.graphics.push(g);

      this.larvae.push({
        x: this.randomRoamX(),
        y: this.randomRoamY(),
        targetX: this.randomRoamX(),
        targetY: this.randomRoamY(),
        facing: 1,
      });
    }
  }

  private randomRoamX(): number {
    const range = ROAM_MAX_X - ROAM_MIN_X;
    return this.hiveCenter + (ROAM_MIN_X + Math.random() * range) * BASE_W * S / 2;
  }

  private randomRoamY(): number {
    return GND + ROAM_MIN_Y + Math.random() * (ROAM_MAX_Y - ROAM_MIN_Y);
  }

  /** Show one roaming larva per available larva in the pool. */
  update(dt: number, larvaCount: number): void {
    this.bobTime += dt;

    for (let i = 0; i < MAX_LARVAE; i++) {
      const g = this.graphics[i];
      g.clear();

      if (i >= larvaCount) continue;

      this.updateLarva(i, dt);
      this.drawLarva(g, this.larvae[i], i);
    }
  }

  private updateLarva(index: number, dt: number): void {
    const l = this.larvae[index];
    const dx = l.targetX - l.x;
    const dy = l.targetY - l.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      l.targetX = this.randomRoamX();
      l.targetY = this.randomRoamY();
    } else {
      const speed = LARVA_SPEED * S * dt;
      l.x += (dx / dist) * speed;
      l.y += (dy / dist) * speed;
      l.facing = dx > 0 ? 1 : -1;
    }
  }

  private drawLarva(
    g: Phaser.GameObjects.Graphics,
    l: LarvaState, index: number,
  ): void {
    const w = Math.round(3 * S);
    const h = Math.round(5 * S);

    const wiggle = Math.sin(this.bobTime * 4 + index * 2.3) * 1.5;
    const squirm = Math.sin(this.bobTime * 5 + index * 1.9) * 0.8;

    const cx = l.x;
    const cy = l.y + squirm;
    const f = l.facing;

    // Shadow
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(l.x, l.y + h * 0.6, w * 1.4, 2);

    const bodyColor = 0xd0ccb8;
    const darkColor = 0x908878;

    // Tail
    g.fillStyle(bodyColor, 0.7);
    g.fillEllipse(cx - f * 3 + wiggle * 0.2, cy + h * 0.15, w * 1.1, h * 0.65);

    // Mid body
    g.fillStyle(bodyColor, 0.8);
    g.fillEllipse(cx + wiggle * 0.1, cy, w * 1.3, h * 0.75);

    // Head
    g.fillStyle(bodyColor, 0.9);
    g.fillEllipse(cx + f * 3 - wiggle * 0.2, cy - h * 0.1, w * 1.0, h * 0.6);

    // Segment line
    g.lineStyle(0.5, darkColor, 0.35);
    g.beginPath();
    g.moveTo(cx - w * 0.45, cy + h * 0.02);
    g.lineTo(cx + w * 0.45, cy + h * 0.02);
    g.strokePath();

    // Eyes
    g.fillStyle(0x302820, 0.8);
    const headX = cx + f * 3 - wiggle * 0.2;
    const headY = cy - h * 0.1;
    g.fillCircle(headX + f * w * 0.15 - w * 0.15, headY - h * 0.08, 0.8);
    g.fillCircle(headX + f * w * 0.15 + w * 0.15, headY - h * 0.08, 0.8);
  }

  /** Consume the last visible larva and return its position. Resets it so it spawns fresh later. */
  consumeLarva(larvaCount: number): { x: number; y: number } {
    const idx = Math.max(0, larvaCount - 1);
    const l = this.larvae[idx];
    const pos = { x: l.x, y: l.y };
    // Reset so when this index becomes visible again it's not on top of the cocoon
    l.x = this.randomRoamX();
    l.y = this.randomRoamY();
    l.targetX = this.randomRoamX();
    l.targetY = this.randomRoamY();
    return pos;
  }

  destroy(): void {
    this.graphics.forEach(g => g.destroy());
    this.graphics = [];
  }
}
