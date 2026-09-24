// Reaction resolution — PURE. Given a cell and an incoming element, returns the
// transformed cell plus any pulses to apply to units. NO side effects: no grid
// writes, no unit damage, no events — so every reaction is a one-line unit test
// (cell + element → assert the result). The orchestrator (TerrainSystem) owns
// the impure parts (grid writes, pulse application, emits).
//
// resolve(cell, element) → { cell, pulses } is the STABLE signature (delta #4):
// future Composite states add cases here; callers never change.

import type { TerrainCell, Element } from '../types';
import {
  REACTIONS,
  TERRAIN_TYPES,
  type ReactionDef,
  type TerrainTypeDef,
  type Pulse,
} from '../config/TerrainDefs';
import { emptyCell } from './TerrainGrid';

export interface ResolveResult {
  cell: TerrainCell;
  pulses: Pulse[];
}

/**
 * OCP escape hatch (delta #6) — a named handler registry, mirroring
 * PASSIVE_HANDLERS. A ReactionDef may reference a handler id for logic that
 * can't be expressed as the declarative `result` (e.g. intensity-scaled
 * cascades). v1 ships EMPTY — every starter reaction is pure data — but the
 * seam exists so the first such reaction is a registration, not a resolve rewrite.
 */
export type ReactionHandler = (
  cell: TerrainCell,
  element: Element,
  def: ReactionDef,
) => ResolveResult;

export const REACTION_HANDLERS: Record<string, ReactionHandler> = {};

/** Does an incoming element match a reaction row against this cell? */
function matches(def: ReactionDef, cell: TerrainCell, element: Element): boolean {
  if (def.on.element !== element) return false;
  if (def.on.targetState !== undefined && def.on.targetState !== cell.state) return false;
  if (def.on.targetElement !== undefined && def.on.targetElement !== cell.element) return false;
  return true;
}

/** Lay an element's base terrain onto an empty cell (intensity/hp overrides are
 *  applied by the caller from the event, keeping resolve 2-arg + pure). */
function layBase(element: Element, type: TerrainTypeDef): TerrainCell {
  return {
    state: type.state,
    element,
    intensity: 1,
    hp: type.hp ?? 0,
    ttl: type.ttl,
  };
}

/** Apply a matched reaction's declarative `result` to the cell. */
function applyResult(cell: TerrainCell, def: ReactionDef): ResolveResult {
  const r = def.result;
  const pulses = r.pulse ? [r.pulse] : [];

  // become 'empty' fully clears the cell (and still fires the pulse).
  if (r.become?.state === 'empty') {
    return { cell: emptyCell(), pulses };
  }

  const next: TerrainCell = { ...cell };
  if (r.hpDelta) next.hp = next.hp + r.hpDelta;
  if (r.ttlDelta) next.ttl = next.ttl + r.ttlDelta;
  if (r.become) Object.assign(next, r.become);

  // A wall corroded past 0 hp (hpDelta with no explicit become) crumbles to empty.
  if (cell.hp > 0 && next.hp <= 0 && r.become === undefined) {
    return { cell: emptyCell(), pulses };
  }

  return { cell: next, pulses };
}

/**
 * Resolve an incoming element against a cell.
 *   1. First matching REACTION row (array order) → apply its result.
 *   2. else, empty cell + element lays base terrain → lay it.
 *   3. else → no-op (cell unchanged, no pulses).
 */
export function resolve(cell: TerrainCell, element: Element): ResolveResult {
  for (const def of REACTIONS) {
    if (!matches(def, cell, element)) continue;
    const handlerId = def.result.handler;
    if (handlerId) {
      const handler = REACTION_HANDLERS[handlerId];
      if (handler) return handler(cell, element, def);
      // Unknown handler id → fall through to declarative application (defensive).
    }
    return applyResult(cell, def);
  }

  if (cell.state === 'empty') {
    const type = TERRAIN_TYPES[element];
    if (type) return { cell: layBase(element, type), pulses: [] };
  }

  return { cell, pulses: [] };
}
