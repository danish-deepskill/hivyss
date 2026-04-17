// Effect runtime — lifecycle driver for ActiveEffect instances.
// Strict isolation: imports only config/combat/effects/. EffectBearer
// is structural — any object carrying `dead` and `activeEffects` works.

import type {
  EffectDef,
  EffectBearer,
  EffectContext,
  ActiveEffect,
} from '../config/combat/effects/types';
import { lookupEffect } from '../config/combat/effects';

function contextOf(eff: ActiveEffect): EffectContext {
  return {
    source: eff.source,
    stacks: eff.stacks,
    remaining: eff.remaining,
    instance: eff,
  };
}

/**
 * Apply an effect. Returns the resulting ActiveEffect, or `null` if
 * the application was rejected.
 *
 * REJECTION RULES (in order):
 *   1. target.dead        → null
 *   2. reverse prevents   → any existing effect whose `prevents` lists
 *                           this name blocks the application
 *   3. forward prevents   → this effect's `prevents` removes any
 *                           listed existing effects (firing onExpire)
 *                           BEFORE the new one lands
 *   4. non-stackable dup  → remaining takes MAX(existing, incoming);
 *                           no new entry; onApply does NOT re-fire
 *   5. stackable at cap   → null
 *   6. stackable success  → onStack on first existing (if any), then
 *                           append, then onApply on the new entry
 */
export function applyEffect(
  target: EffectBearer,
  defOrName: EffectDef | string,
  opts: { source?: unknown; remaining?: number } = {},
): ActiveEffect | null {
  if (target.dead) return null;

  const def: EffectDef =
    typeof defOrName === 'string' ? lookupEffect(defOrName) : defOrName;

  if (!target.activeEffects) target.activeEffects = [];
  const list = target.activeEffects;

  for (const existing of list) {
    const blocks = existing.def.prevents;
    if (blocks && blocks.indexOf(def.name) >= 0) return null;
  }

  if (def.prevents && def.prevents.length > 0) {
    const toRemove = def.prevents;
    for (let i = list.length - 1; i >= 0; i--) {
      if (toRemove.indexOf(list[i].def.name) >= 0) {
        const gone = list.splice(i, 1)[0];
        gone.def.onExpire?.(target, contextOf(gone));
      }
    }
  }

  const incoming: ActiveEffect = {
    def,
    remaining: opts.remaining ?? def.duration,
    stacks: 1,
    source: opts.source,
  };

  if (!def.stackable) {
    const existing = findFirst(list, def.name);
    if (existing) {
      if (incoming.remaining > existing.remaining) {
        existing.remaining = incoming.remaining;
      }
      return existing;
    }
    list.push(incoming);
    def.onApply?.(target, contextOf(incoming));
    return incoming;
  }

  const firstExisting = findFirst(list, def.name);
  if (def.maxStacks !== undefined) {
    let count = 0;
    for (const e of list) if (e.def.name === def.name) count++;
    if (count >= def.maxStacks) return null;
  }
  if (firstExisting && def.onStack) {
    def.onStack(target, firstExisting, incoming);
  }
  list.push(incoming);
  def.onApply?.(target, contextOf(incoming));
  return incoming;
}

/** Remove every ActiveEffect with the given name. Fires onExpire per removal. */
export function removeEffect(target: EffectBearer, effectName: string): number {
  const list = target.activeEffects;
  if (!list || list.length === 0) return 0;
  let removed = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].def.name === effectName) {
      const gone = list.splice(i, 1)[0];
      gone.def.onExpire?.(target, contextOf(gone));
      removed++;
    }
  }
  return removed;
}

/**
 * Per-frame tick. Fires onTick on each instance, decrements remaining
 * by dt, splices + fires onExpire on instances that hit zero. Walks in
 * reverse so splicing is safe. Skips dead entities at loop entry and
 * mid-loop (if an onTick kills them).
 */
export function updateEffects(
  entities: readonly EffectBearer[],
  dt: number,
): void {
  for (const entity of entities) {
    if (entity.dead) continue;
    const list = entity.activeEffects;
    if (!list || list.length === 0) continue;

    for (let i = list.length - 1; i >= 0; i--) {
      if (entity.dead) break;

      const eff = list[i];
      eff.def.onTick?.(entity, dt, contextOf(eff));

      eff.remaining -= dt;
      if (eff.remaining <= 0) {
        list.splice(i, 1);
        eff.def.onExpire?.(entity, contextOf(eff));
      }
    }
  }
}

export function findActiveEffect(
  target: EffectBearer,
  effectName: string,
): ActiveEffect | undefined {
  const list = target.activeEffects;
  if (!list) return undefined;
  for (const e of list) {
    if (e.def.name === effectName) return e;
  }
  return undefined;
}

export function hasActiveEffect(target: EffectBearer, effectName: string): boolean {
  return findActiveEffect(target, effectName) !== undefined;
}

export function countActiveEffect(target: EffectBearer, effectName: string): number {
  const list = target.activeEffects;
  if (!list) return 0;
  let count = 0;
  for (const e of list) {
    if (e.def.name === effectName) count++;
  }
  return count;
}

function findFirst(list: readonly ActiveEffect[], name: string): ActiveEffect | undefined {
  for (const e of list) {
    if (e.def.name === name) return e;
  }
  return undefined;
}
