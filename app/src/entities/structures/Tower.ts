import type { Side, TowerDef } from '../../types';
import { getGroundY } from '../../config/RouteMatrix';
import { getTowerDef } from '../../config/TowerDefs';
import { Structure } from './Structure';
import { drawTower } from '../../draws/structures/towers/registry';
import { TOWER_HEIGHT, TOWER_HALF_W } from '../../draws/structures/towers/dims';
import { drawStructureChrome } from '../../draws/structures/bars';

// Tower — the generic DEFENSIVE STRUCTURE (spire, bunker, …). A Structure with a
// per-variant body (drawTower) + an own HP bar. The WEAPON (range/damage/cooldown)
// + firing live in the Towers manager; this owns body, state, and placement. It
// sits at its x on the land surface and fires at any enemy in range.
const FLARE_DURATION = 0.18;

export class Tower extends Structure {
  /** Body draw key — 'spire' today; 'bunker' etc. later (one file + map entry). */
  variant: string;
  /** Per-variant data (hp / range / damage / fireInterval). */
  readonly def: TowerDef;
  /** The tower's ground line (the land surface). */
  groundY: number;
  fireTimer: number;

  constructor(scene: Phaser.Scene, x: number, side: Side, variant = 'spire') {
    const def = getTowerDef(variant);
    super(scene, x, side, def.hp);
    this.def = def;
    this.variant = variant;
    this.groundY = getGroundY('land');
    this.fireTimer = 0;
    this.redraw();
  }

  /** World position the projectile launches from (the crystal eye). */
  get muzzle(): { x: number; y: number } {
    return { x: this.x, y: this.groundY - TOWER_HEIGHT };
  }

  /** The crystal / projectile tint (side identity) — one source for body + FX. */
  get crystalColor(): number {
    return this.side === 'player' ? 0x70d8ff : 0xff7048;
  }

  /** Flash the crystal — call on fire (the bolt is an FxDirector one-shot). */
  fire(): void {
    this.fireTimer = FLARE_DURATION;
    this.redraw();
  }

  update(dt: number): void {
    let dirty = false;
    if (this.flashTimer > 0) { this.flashTimer = Math.max(0, this.flashTimer - dt); dirty = true; }
    if (this.fireTimer > 0) { this.fireTimer = Math.max(0, this.fireTimer - dt); dirty = true; }
    if (dirty) this.redraw();
  }

  redraw(): void {
    const g = this.gfx;
    g.clear();
    const frac = Math.max(0, this.hp / this.maxHp);
    const fire = this.fireTimer > 0 ? this.fireTimer / FLARE_DURATION : 0;

    // Body (variant) — owns the standing / wear / broken-rubble states.
    drawTower(g, this.variant, {
      side: this.side,
      frac,
      dead: this.hp <= 0,
      fire,
      hitFlash: this.flashTimer,
      groundY: this.groundY,
      crystal: this.crystalColor,
    });

    // Shared chrome: an HP bar above the standing tower (like the hive's bar).
    if (this.hp > 0) drawStructureChrome(g, { halfW: TOWER_HALF_W, height: TOWER_HEIGHT, groundY: this.groundY, frac });
  }
}
