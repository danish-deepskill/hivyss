import Phaser from 'phaser';
import type { Side, GeneLine } from '../types';
import { BASE_HP, SBW } from '../config/Constants';
import { LANE } from '../config/Layout';
import { drawHive } from '../draws/hives/registry';
const GND = LANE.land.groundY;

export class BaseStructure extends Phaser.GameObjects.Container {
  side: Side;
  /** Which geneline's body to draw — its architecture/identity. Late-bindable
   *  via setGeneline (the deck/Royal may be resolved after construction). */
  geneline: GeneLine;
  hp: number;
  maxHp: number;
  flashTimer: number;
  shielded: boolean;
  gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, side: Side, geneline: GeneLine = 'normal') {
    super(scene, x, 0);
    this.side = side;
    this.geneline = geneline;
    this.hp = BASE_HP;
    this.maxHp = BASE_HP;
    this.flashTimer = 0;
    this.shielded = false;

    this.gfx = scene.add.graphics();
    this.add(this.gfx);

    scene.add.existing(this);
    this.redraw();
  }

  /** Rebind the geneline (e.g. once the deck's Royal is known) + redraw. */
  setGeneline(geneline: GeneLine): void {
    if (this.geneline === geneline) return;
    this.geneline = geneline;
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

  // BaseStructure owns only the SHARED STATE CHROME (ground shadow, hit-flash
  // back-glow, shield membrane) — feedback that must read identically on every
  // hive. The geneline BODY is delegated to its registered draw (its identity).
  redraw(): void {
    const g = this.gfx;
    const isBlue = this.side === 'player';
    const frac = Math.max(0, this.hp / this.maxHp);
    const bw = SBW;
    const cx = bw / 2;

    g.clear();

    // Ground shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(cx + 3, GND + 3, bw * 1.04, 20);

    // Hit-flash back-glow (rims the silhouette; side-colored)
    if (this.flashTimer > 0) {
      g.fillStyle(isBlue ? 0x50b4ff : 0xff5050, this.flashTimer * 0.5);
      g.fillEllipse(cx, GND - 42, bw, 92);
    }

    // The geneline body
    drawHive(g, this.geneline, { side: this.side, frac, bw, groundY: GND });

    // Shield membrane
    if (this.shielded) {
      g.lineStyle(3, 0x5ac8f8, 0.3);
      g.strokeEllipse(cx, GND - 42, bw * 1.1, 100);
    }
  }
}
