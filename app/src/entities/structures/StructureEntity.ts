import type { WorldEntity, Side, ComponentTag, Route } from '../../types';
import type { DamageType } from '../../config/combat/damageTypes';
import { resistanceDamageMult, type ResistanceTier } from '../../config/combat/resistances';
import { terrainEffectAt } from '../../systems/TerrainDispatch';

// StructureEntity — the shared WorldEntity wrapper for any BUILDING (hive base,
// spire, …). It is the spatial-index / targeting view over a Structure: combat
// sees a real, destructible, targetable entity. HiveEntity and SpireEntity are
// thin generic subclasses — adding a building's targetability is one line.
//
// Components: HasHP + IsTargetable + HasAllegiance, deliberately NO HasAI — so
// the combatant-AI selectors (DEFAULT_COMBATANT_FILTER = ['HasAI']) skip
// structures; units hit them through CombatSystem's structure-damage branch
// (which keys off `instanceof StructureEntity`). HP/side live on the wrapped
// structure; this stays free of the Phaser visual class (so it's node-safe and
// combat can `instanceof` it in tests).

/** The minimal structure surface the wrapper reads (no Phaser dependency). */
export interface StructureCore {
  hp: number;
  maxHp: number;
  side: Side;
  setHp(hp: number): void;
  flash(duration?: number): void;
}

// ONE negative id space for EVERY structure — unique within the spatial index
// (positive ids belong to Units). Reset between battles / in tests.
let _structureUid = 0;
function nextStructureId(): number { return --_structureUid; }
export function resetStructureUid(): void { _structureUid = 0; }

export class StructureEntity<S extends StructureCore = StructureCore> implements WorldEntity {
  id: number;
  x: number;
  y: number;
  dead: boolean;
  components: Set<ComponentTag>;
  route: Route;
  side: Side;
  /** Width zero — distance is measured to the structure's point (the wall edge
   *  for the base; the tower x for a spire). */
  readonly unitW: number = 0;
  readonly structure: S;
  /** Per-damage-type resistance for terrain DoT scaling (omit = 'normal'). */
  readonly resistance?: Partial<Record<DamageType, ResistanceTier>>;
  /** Fractional terrain-DoT carry — whole-chunk dispatch (framerate-independent). */
  private _terrainDotAccum = 0;

  constructor(structure: S, hitX: number, resistance?: Partial<Record<DamageType, ResistanceTier>>) {
    this.id = nextStructureId();
    this.x = hitX;
    this.y = 0;
    this.dead = structure.hp <= 0;
    this.components = new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAllegiance']);
    this.route = 'land';
    this.side = structure.side;
    this.structure = structure;
    this.resistance = resistance;
  }

  get hp(): number { return this.structure.hp; }
  get maxHp(): number { return this.structure.maxHp; }

  /** Re-derive dead from HP — caller-driven, once per frame (mirrors the legacy
   *  HiveEntity contract: a plain field, not a getter). */
  syncDead(): void {
    this.dead = this.structure.hp <= 0;
  }

  /** Damage delegation — setHp on the structure. The caller flashes (the combat
   *  structure-branch does), matching the legacy HiveEntity behaviour. */
  takeDamage(dmg: number): void {
    this.structure.setHp(this.structure.hp - dmg);
  }

  /**
   * Phase A — "snap what you place, flow what you move": a STATIC building
   * self-consults the terrain seam (the grid is a lookup) and a damaging cell
   * under it corrodes it. Resistance-scaled + framerate-independent via a
   * fractional accumulator, mirroring TerrainSystem.tickUnits — but structures
   * are NEVER added to that units-only tick; they query terrain themselves.
   * Applied via the structure damage path (setHp), since buildings aren't
   * combat-pipeline entities (units already damage them the same way).
   * Caller ticks this each frame (after syncDead).
   */
  tickTerrain(dt: number): void {
    if (this.dead) return;
    const te = terrainEffectAt(this.route, this.x);
    if (te?.dot) {
      const tier: ResistanceTier = this.resistance?.[te.dot.type] ?? 'normal';
      this._terrainDotAccum += te.dot.dps * resistanceDamageMult(tier) * dt;
      const whole = Math.floor(this._terrainDotAccum);
      if (whole >= 1) this.takeDamage(whole);
      this._terrainDotAccum -= whole;
    } else if (this._terrainDotAccum) {
      this._terrainDotAccum = 0; // left the damaging cell — drop the carry
    }
  }
}
