import type { Side, GeneLine } from '../../types';
import { BASE_HP, SBW } from '../../config/Constants';
import { LANE } from '../../config/Layout';
import { drawHive } from '../../draws/structures/hives/registry';
import { Structure } from './Structure';
const GND = LANE.land.groundY;

// HiveStructure — the HIVE building. Owns the shared state chrome (ground
// shadow, hit-flash back-glow, shield membrane); the geneline BODY is delegated
// to its registered draw (drawHive). A Structure subclass (HP/flash/gfx shared).
export class HiveStructure extends Structure {
  /** Which geneline's body to draw — its architecture/identity. Late-bindable
   *  via setGeneline (the deck/Royal may resolve after construction). */
  geneline: GeneLine;
  shielded: boolean;

  constructor(scene: Phaser.Scene, x: number, side: Side, geneline: GeneLine = 'normal') {
    super(scene, x, side, BASE_HP);
    this.geneline = geneline;
    this.shielded = false;
    this.redraw();
  }

  /** Rebind the geneline (e.g. once the deck's Royal is known) + redraw. */
  setGeneline(geneline: GeneLine): void {
    if (this.geneline === geneline) return;
    this.geneline = geneline;
    this.redraw();
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
