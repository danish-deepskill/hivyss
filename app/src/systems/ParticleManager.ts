import Phaser from 'phaser';
import type { IParticleManager } from '../types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  col: number;
  r: number;
}

interface Floater {
  text: Phaser.GameObjects.Text;
  life: number;
  vy: number;
}

// Manages burst particles and floating text effects
export class ParticleManager implements IParticleManager {
  scene: Phaser.Scene;
  particles: Particle[];
  floaters: Floater[];
  gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.particles = [];
    this.floaters = [];
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(100);
  }

  burst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 3.5;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 1,
        life: 0.5 + Math.random() * 0.4,
        col: color,
        r: 1.5 + Math.random() * 2,
      });
    }
  }

  float(x: number, y: number, txt: string, color: number, big: boolean = false): void {
    const text = this.scene.add.text(x, y, txt, {
      fontFamily: '"Courier New", monospace',
      fontSize: big ? '15px' : '11px',
      fontStyle: 'bold',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5).setDepth(101);

    this.floaters.push({
      text,
      life: 1.4,
      vy: -22,
    });
  }

  update(dt: number): void {
    // Update particles
    this.gfx.clear();
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= dt * 2;
      if (p.life <= 0) return false;

      this.gfx.fillStyle(p.col, Math.max(0, p.life * 0.8));
      this.gfx.fillCircle(p.x, p.y, p.r);
      return true;
    });

    // Update floaters
    this.floaters = this.floaters.filter(f => {
      f.life -= dt;
      f.text.y += f.vy * dt;
      f.text.setAlpha(Math.min(1, f.life * 1.8));
      if (f.life <= 0) {
        f.text.destroy();
        return false;
      }
      return true;
    });
  }

  destroy(): void {
    this.floaters.forEach(f => f.text.destroy());
    this.floaters = [];
    this.particles = [];
    this.gfx.destroy();
  }
}
