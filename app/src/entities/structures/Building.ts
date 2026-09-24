import type { Side, BuildingDef } from '../../types';
import { getGroundY } from '../../config/RouteMatrix';
import { getBuildingDef } from '../../config/BuildingDefs';
import { Structure } from './Structure';
import { drawBuilding } from '../../draws/structures/buildings/registry';
import { BUILDING_HEIGHT, BUILDING_HALF_W } from '../../draws/structures/buildings/dims';
import { drawStructureChrome } from '../../draws/structures/bars';
import { advanceConstruction } from './construction';

// Building — a player-PLACED structure with a CONSTRUCTION lifecycle. Same
// Structure contract as Tower (body + HP + flash), plus `progress` (0..1) that a
// builder worker accrues via build() until `complete`. Self-renders (Container).
// The WEAPON/economy/etc. that a finished building might DO lives in the Buildings
// manager (none in v1 — this is the example prop); this owns body + build state.
export class Building extends Structure {
  /** Body draw key — 'totem' today. */
  variant: string;
  readonly def: BuildingDef;
  /** The building's ground line (the land surface). */
  groundY: number;
  /** Construction progress 0..1. */
  progress: number;
  /** True once construction completes. */
  complete: boolean;

  constructor(scene: Phaser.Scene, x: number, side: Side, variant = 'totem') {
    const def = getBuildingDef(variant);
    super(scene, x, side, def.hp);
    this.def = def;
    this.variant = variant;
    this.groundY = getGroundY('land');
    this.progress = 0;
    this.complete = false;
    this.redraw();
  }

  /** Accrue `dt` seconds of builder-work. Returns true the FRAME it completes. */
  build(dt: number): boolean {
    if (this.complete) return false;
    const step = advanceConstruction(this.progress, dt, this.def.buildTime);
    this.progress = step.progress;
    const justFinished = step.complete && !this.complete;
    if (justFinished) this.complete = true;
    this.redraw();
    return justFinished;
  }

  update(dt: number): void {
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
      this.redraw();
    }
  }

  redraw(): void {
    const g = this.gfx;
    g.clear();
    const frac = Math.max(0, this.hp / this.maxHp);
    drawBuilding(g, this.variant, {
      side: this.side,
      frac,
      dead: this.hp <= 0,
      hitFlash: this.flashTimer,
      groundY: this.groundY,
      progress: this.progress,
      complete: this.complete,
    });

    // Chrome (above the body). Buildings are destructible combat targets, so the
    // HP bar is always shown while alive; a build-progress bar sits above it while
    // under construction.
    if (this.hp > 0) {
      drawStructureChrome(g, {
        halfW: BUILDING_HALF_W,
        height: BUILDING_HEIGHT,
        groundY: this.groundY,
        frac,
        progress: this.complete ? undefined : this.progress,
      });
    }
  }
}
