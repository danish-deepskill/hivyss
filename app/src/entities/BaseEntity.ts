// Phase 6 follow-up #2 — WorldEntity wrapper around the existing
// BaseStructure. Lets ranged units' targeting see the hive as a real
// targetable entity instead of a wall the unit must walk into. Fixes
// the legacy quirk where ranged units (Needler, Longeye, ...) ignored
// their range entirely against the hive and walked all the way up.
//
// Validates the WorldEntity / ECS-lite architecture (Decision 1) on
// a real non-Unit entity ahead of Phase 7 — addresses Risk #9 in the
// rewrite plan ("component model is validated only on Units during
// the rewrite").
//
// Strict thin wrapper:
//   - HP / maxHp / side state lives on the underlying BaseStructure;
//     BaseEntity is a read view + the WorldEntity-required fields.
//   - `dead` is synced from `structure.hp <= 0` once per frame by
//     GameManager.tick (or any caller that owns the entity). It is
//     NOT a getter — making it a plain field keeps WorldEntity's
//     `dead: boolean` interface satisfied without a setter no-op.
//   - `x` is the WALL position, not the BaseStructure container
//     origin. The wall is what units' range checks measure against.
//
// Components (Decision 1 sub-gap B):
//   HasHP            yes — can be damaged
//   IsTargetable     yes — `_findTarget` and Phase 7+ selectors include it
//   HasAllegiance    yes — side filter works
//   HasAI            NO  — bases don't decide. CRITICAL: this means the
//                          DEFAULT_COMBATANT_FILTER (['HasAI']) excludes
//                          bases from existing Phase 3 selectors. Phase 7+
//                          ranged abilities that should hit the hive use
//                          the IsTargetable-based selector variants added
//                          in Targeting.ts at the same time as this file.
//   HasMovement      N/A — bases don't move
//   HasCapacityCost  NO  — structures don't count toward capacity
//
// Intentional NON-Unit:
//   Bases are NOT Unit instances. They have a strict subset of Unit
//   functionality (HP + position + side + components + dead). Anything
//   that operates on Unit fields (knockback, foreswing, atkRate, ...)
//   does not apply. The whole point of this entity is to validate
//   that the WorldEntity contract supports non-Unit participants
//   without forcing Unit's full surface on them.

import type {
  WorldEntity,
  Side,
  ComponentTag,
  Route,
} from '../types';
import type { BaseStructure } from './BaseStructure';

// Bases use a separate id space (negative integers, decrementing)
// so they never collide with Unit ids (which are positive, allocated
// from `uid()` in Unit.ts). Spatial index queries that compare by
// reference don't care, but log output and debug HUDs benefit from
// the namespacing.
let _baseUid = 0;
function nextBaseId(): number { return --_baseUid; }
/** Reset for tests — mirrors `resetUid` from Unit.ts. */
export function resetBaseUid(): void { _baseUid = 0; }

export class BaseEntity implements WorldEntity {
  // --- WorldEntity contract ---
  id: number;
  x: number;
  y: number;
  dead: boolean;
  components: Set<ComponentTag>;

  // --- Spatial index contract (SpatialEntity) ---
  /**
   * Bases live on the ground; route='land' is the canonical placement
   * for spatial-index purposes. Air units attacking the hive currently
   * use the at-wall fallback (which is route-agnostic) because the
   * legacy ROUTE_MATRIX disallows land→tunnel and tunnel→land. The
   * route field here only affects spatial-index `routes` filters; the
   * canAttack route check on bases is bypassed by the in-range base
   * attack code (a base is universally attackable from any compatible
   * route at attack time, by design).
   */
  route: Route;
  side: Side;

  // --- Distance-math contract (matches IUnit's unitW field) ---
  /**
   * Width is zero — distance is measured from the wall edge. Player
   * units' right edges (`u.x + u.unitW`) reach `enemyBase.x` exactly
   * when they touch the wall; ranged units fire when `enemyBase.x -
   * (u.x + u.unitW) <= u.range`. Setting unitW > 0 would shift the
   * effective fire distance, which would diverge from the legacy at-
   * wall geometry the base damage code uses.
   */
  readonly unitW: number = 0;

  // --- Damage delegation ---
  /** Reference to the underlying structure for HP write + flash FX. */
  readonly structure: BaseStructure;

  constructor(structure: BaseStructure, wallX: number) {
    this.id = nextBaseId();
    this.x = wallX;
    this.y = 0;
    this.dead = structure.hp <= 0;
    this.components = new Set<ComponentTag>([
      'HasHP',
      'IsTargetable',
      'HasAllegiance',
    ]);
    this.route = 'land';
    this.side = structure.side;
    this.structure = structure;
  }

  // --- Read-through accessors ---
  get hp(): number { return this.structure.hp; }
  get maxHp(): number { return this.structure.maxHp; }

  /**
   * Re-derive `dead` from the underlying HP. Called by GameManager.tick
   * once per frame after combat resolves so spatial index queries
   * (which exclude dead entities via matchesFilter) stop returning a
   * destroyed base on the next frame.
   */
  syncDead(): void {
    this.dead = this.structure.hp <= 0;
  }

  /**
   * Apply damage. Mirrors the legacy `playerBase.setHp(playerBase.hp -
   * dmg)` pattern at CombatSystem.ts at-wall fallback. Note that
   * BaseStructure.setHp clamps to [0, maxHp] internally — negative
   * remainder doesn't underflow and over-heal is impossible.
   */
  takeDamage(dmg: number): void {
    this.structure.setHp(this.structure.hp - dmg);
  }
}
