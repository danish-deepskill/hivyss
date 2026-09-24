import type { BattleCore } from '../BattleCore';
import type { Side, StructureDef } from '../../types';
import type { Structure } from '../../entities/structures/Structure';
import { StructureEntity } from '../../entities/structures/StructureEntity';

// StructureManager — the shared base for structure managers (Towers, Buildings,
// future Walls / Warren chambers). Owns the lifecycle EVERY placed structure has:
//   - per-pixel placement + StructureOccupancy footprint-overlap reject,
//   - combat targetability (publish live entities),
//   - per-frame syncDead -> terrain-DoT -> body update -> free-on-death,
//   - reset (re-occupy live footprints) + destroy (teardown).
// Subclasses add ONLY their type-specific behavior (a Tower fires; a Building
// constructs over time) via a richer Slot + their own tick() that calls tickSlot.
//
// This collapsed the ~70 lines Towers and Buildings duplicated near-verbatim, so
// the placement/occupancy/terrain/free-on-death contract lives in ONE place.

/** Slot is the structure on the field — wrapped (entity) + occupancy bookkeeping. */
export interface StructureSlot<S extends Structure> {
  structure: S;
  entity: StructureEntity<S>;
  /** Footprint half-width — the occupancy interval is [x ± halfW]. */
  halfW: number;
  /** Currently occupying (cleared on death, re-added on reset). */
  registered: boolean;
}

/** S must be a Structure body that carries a `def` (Tower/Building do — for resistance). */
type StructureWithDef = Structure & { def: StructureDef };

export abstract class StructureManager<S extends StructureWithDef, Slot extends StructureSlot<S>> {
  protected slots: Slot[] = [];

  constructor(
    protected scene: Phaser.Scene,
    protected core: BattleCore,
    /** This manager's source key in the combat structure-target registry
     *  (e.g. 'towers', 'buildings') — keeps coexisting managers from clobbering. */
    private targetKey: string,
  ) {}

  /** Complete the type-specific slot from the shared base fields (add cooldown / builderId / …). */
  protected abstract makeSlot(base: StructureSlot<S>): Slot;

  /** This structure type's footprint half-width (Tower vs Building differ). */
  protected abstract footprintHalfW(): number;

  /**
   * Place a structure at the EXACT world-x `x` (per-pixel — no cell snap), REJECT
   * -> null if its footprint would overlap an already-placed structure or a hive
   * span. Construct the body there via `make` and register it (spatial index +
   * occupancy + targets). Returns the new slot, or null if the spot is taken.
   */
  protected install(side: Side, x: number, make: (placedX: number) => S): Slot | null {
    const halfW = this.footprintHalfW();
    if (this.core.structures.overlaps(x, halfW)) return null; // footprint would overlap
    const structure = make(x);
    const entity = new StructureEntity(structure, x, structure.def.resistance);
    this.core.spatialIndex.add(entity);
    this.core.structures.add(entity, x, halfW);
    const slot = this.makeSlot({ structure, entity, halfW, registered: true });
    this.slots.push(slot);
    this.publishTargets();
    return slot;
  }

  /** Re-publish the LIVE structure targets to combat (prunes destroyed ones so the
   *  target list can't grow unbounded across a match). */
  protected publishTargets(): void {
    this.core.combat.setStructureTargets(this.targetKey, this.slots.filter(s => !s.entity.dead).map(s => s.entity));
  }

  /**
   * Common per-slot frame work: sync dead state, apply terrain DoT, update the
   * body, and free the grid cell ONCE on death. Returns true while alive (the
   * subclass then does its type-specific work); false when the slot is dead.
   */
  protected tickSlot(slot: Slot, dt: number): boolean {
    slot.entity.syncDead();
    slot.entity.tickTerrain(dt); // a damaging cell under the structure corrodes it
    slot.structure.update(dt);
    if (slot.structure.hp <= 0) {
      if (slot.registered) {
        this.core.structures.remove(slot.entity);
        slot.registered = false;
        this.publishTargets();
      }
      return false;
    }
    return true;
  }

  /** Re-occupy footprints freed by a prior death (driver reset). */
  reset(): void {
    for (const slot of this.slots) {
      slot.entity.syncDead();
      if (!slot.registered && slot.structure.hp > 0) {
        this.core.structures.add(slot.entity, slot.structure.x, slot.halfW);
        slot.registered = true;
      }
    }
    // A resurrected structure must rejoin the combat target list — install() and
    // the death branch both republish; reset is the inverse path and must too,
    // or a revived structure is alive + occupying yet untargetable.
    this.publishTargets();
  }

  /** Tear down every structure (scene shutdown). */
  destroy(): void {
    for (const slot of this.slots) {
      this.core.spatialIndex.remove(slot.entity);
      if (slot.registered) this.core.structures.remove(slot.entity);
      slot.structure.destroy();
    }
    this.slots = [];
    this.publishTargets(); // emit the now-empty list — no dangling refs to destroyed entities
  }
}
