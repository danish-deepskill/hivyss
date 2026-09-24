import type { BattleCore } from '../BattleCore';
import type { Side, IUnit } from '../../types';
import { Building } from '../../entities/structures/Building';
import { StructureManager, type StructureSlot } from './StructureManager';
import { BUILDING_HALF_W } from '../../draws/structures/buildings/dims';

// Buildings — the manager for player-PLACED, builder-CONSTRUCTED structures. The
// placement/occupancy/terrain/targetability/free-on-death lifecycle lives in
// StructureManager; this adds ONLY the construction lifecycle: each placed
// building gets ONE assigned builder worker that walks to the site and accrues
// progress until complete ("tied" model). The build seam (tickConstruction) is
// written so a future persistent-builder workforce just changes WHO gets
// assigned. A completed income-building (Nectar Font) pays through `earn`.

/** A builder must be within this of the site's center to work the build. */
const BUILD_ARRIVE = 18;
/** A retiring builder despawns within this of the hive doorstep. */
const HOME_ARRIVE = 8;

interface BuildingSlot extends StructureSlot<Building> {
  /** Assigned builder unit id (tied: one per building). null = builder gone
   *  (killed → construction stalls) or the build finished. */
  builderId: number | null;
}

export class Buildings extends StructureManager<Building, BuildingSlot> {
  /** Builder ids walking home after finishing a build (despawn on arrival). */
  private retiring: number[] = [];

  constructor(
    scene: Phaser.Scene,
    core: BattleCore,
    /** Where retiring builders walk back to (the hive doorstep). */
    private homeX = 0,
    /** Narrow economy seam — a built income-building (Nectar Font) pays through
     *  this each frame (ISP: the manager only needs "earn N", not the whole economy). */
    private earn?: (amount: number) => void,
  ) {
    super(scene, core, 'buildings');
  }

  protected makeSlot(base: StructureSlot<Building>): BuildingSlot {
    return { ...base, builderId: null };
  }

  protected footprintHalfW(): number {
    return BUILDING_HALF_W;
  }

  /**
   * Place a building for `side` at world-x: placed exactly there (per-pixel;
   * REJECT → null if its footprint overlaps another structure), construct the
   * blueprint at 0% progress. The caller spawns + ties a builder via assignBuilder().
   */
  place(side: Side, x: number, variant = 'totem'): Building | null {
    const slot = this.install(side, x, (placedX) => new Building(this.scene, placedX, side, variant));
    return slot ? slot.structure : null;
  }

  /** Tie a builder worker to a placed building (it walks there + constructs it). */
  assignBuilder(building: Building, builderId: number): void {
    const slot = this.slots.find(s => s.structure === building);
    if (slot) slot.builderId = builderId;
  }

  /** Pre-combat tick (sets builder move-orders before CombatSystem moves them). */
  tick(dt: number): void {
    for (const slot of this.slots) {
      if (!this.tickSlot(slot, dt)) {
        // Destroyed — base freed the cell + retargeted. Send the still-alive
        // builder home so it isn't stranded (findUnit guards one killed in the
        // same blow; nulling builderId stops this re-firing each dead frame).
        if (slot.builderId != null) {
          const b = this.findUnit(slot.builderId);
          if (b) this.retiring.push(b.id);
          slot.builderId = null;
        }
        continue;
      }
      if (!slot.structure.complete) {
        this.tickConstruction(slot, dt);
      } else if (slot.structure.def.income) {
        // Active economy building (Nectar Font) — pays nectar while complete + alive.
        this.earn?.(slot.structure.def.income * dt);
      }
    }
    this.tickRetiring();
  }

  /** Walk the assigned builder to the site; accrue progress on arrival; retire it
   *  on completion. THE BUILD SEAM — a future workforce re-assigns idle builders
   *  here instead of relying on the one tied at placement. */
  private tickConstruction(slot: BuildingSlot, dt: number): void {
    const builder = slot.builderId != null ? this.findUnit(slot.builderId) : null;
    if (!builder) { slot.builderId = null; return; } // builder gone → construction stalls

    const siteX = slot.structure.x;
    builder.order = { kind: 'move', x: siteX }; // reuses the worker move-order seam
    if (Math.abs((builder.x + builder.unitW / 2) - siteX) > BUILD_ARRIVE) return; // still walking

    // On site — work the build. The frame it finishes, send the builder HOME (it
    // despawns on arrival, see tickRetiring) instead of vanishing on the spot.
    if (slot.structure.build(dt)) {
      this.retiring.push(builder.id);
      slot.builderId = null;
    }
  }

  /** Walk finished builders home; despawn them on arrival (or drop if killed en
   *  route). Returning to the hive reads better than vanishing on-site. */
  private tickRetiring(): void {
    if (this.retiring.length === 0) return;
    for (let i = this.retiring.length - 1; i >= 0; i--) {
      const b = this.findUnit(this.retiring[i]);
      if (!b) { this.retiring.splice(i, 1); continue; } // killed en route → gone
      b.order = { kind: 'move', x: this.homeX };
      if (Math.abs((b.x + b.unitW / 2) - this.homeX) <= HOME_ARRIVE) {
        b.dead = true; // home — retire (silent reap by BattleCore.postResolve)
        this.retiring.splice(i, 1);
      }
    }
  }

  private findUnit(id: number): IUnit | null {
    for (const u of this.core.units) if (u.id === id && !u.dead) return u;
    return null;
  }

  destroy(): void {
    super.destroy();
    this.retiring = [];
  }
}
