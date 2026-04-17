// ECS-lite — components-as-data flavor (Combat Rewrite Decision 1).
//
// Components answer ONE question: "does this entity participate in this
// system?" They are tags, not state. Logic still lives in core systems
// (CombatSystem, AISystem, future ModifierSystem); those systems query
// for entities carrying the relevant tags via SpatialIndex or the
// entitiesWithComponent helpers below.
//
// This is NOT full ECS: there is no system scheduler, no per-frame
// component iteration loop, and no restructuring of where game logic
// lives. Entities carry a `components: Set<ComponentTag>` and that is
// all the component model contributes at runtime.
//
// Movement note (deliverable 4, Phase 1 plan):
//   Unit movement is HasAI's DEFAULT behavior — lane-follow at def.spd,
//   resolved in CombatSystem. There is NO HasMovement component.
//   Future units that need custom movement override via a different
//   AI behavior; projectiles (HasTrajectory) move independently of AI.
//
// HasAllegiance vs HasSourceAttribution are split deliberately:
//   Pylon      — has both  (belongs to a side AND credits a caster)
//   GravWell   — has neither (neutral / ownerless)
//   TrailSeg   — has only HasAllegiance (side, but no source to credit)
// Splitting them prevents "orphaned WorldEntity" bugs where a system
// blindly assumes `entity.side` exists.

import type { ComponentTag } from '../types';

export type { ComponentTag };

// Default component set applied to Units at UnitPool allocation.
// Kept as a readonly tuple so it can be iterated cheaply in Unit.init()
// without allocating a fresh array every recycle.
export const UNIT_COMPONENTS: readonly ComponentTag[] = [
  'HasHP',
  'HasResistance',
  'IsTargetable',
  'HasOnDeath',
  'HasAI',
  'HasAllegiance',
  'HasSourceAttribution',
  'HasCapacityCost',
  'HasModifiers',
] as const;

// Structural contract for pure-function helpers. Any object carrying a
// components Set satisfies it — Unit, Pylon, Zone, Projectile, or a
// plain test literal.
interface ComponentBearer {
  components: ReadonlySet<ComponentTag>;
}

/** Pure filter: entities whose component set includes the given tag. */
export function entitiesWithComponent<T extends ComponentBearer>(
  entities: readonly T[],
  tag: ComponentTag,
): T[] {
  const out: T[] = [];
  for (const e of entities) {
    if (e.components.has(tag)) out.push(e);
  }
  return out;
}

/** Pure filter: entities whose component set includes ALL given tags. */
export function entitiesWithAllComponents<T extends ComponentBearer>(
  entities: readonly T[],
  tags: readonly ComponentTag[],
): T[] {
  const out: T[] = [];
  for (const e of entities) {
    if (hasAllComponents(e, tags)) out.push(e);
  }
  return out;
}

/** Pure predicate: does an entity carry every one of the given tags? */
export function hasAllComponents(
  entity: ComponentBearer,
  tags: readonly ComponentTag[],
): boolean {
  for (const t of tags) {
    if (!entity.components.has(t)) return false;
  }
  return true;
}
