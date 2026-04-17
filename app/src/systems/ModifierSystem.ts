// Modifier stack — generic pipe for transient stat changes.
// Everything that shifts a stat (effects, buffs, debuffs, auras, future
// equipment) routes through addModifier rather than direct mutation.
// Pure stacking math (`stackModifiers`) + thin component-gated wrapper
// (`applyModifiers`). Strict isolation: imports only ComponentTag.

import type { ComponentTag } from '../types';

export type ModifierType = 'flat' | 'percent' | 'override';

/**
 * A transient stat change, source-tracked for clean removal.
 *
 * - `stat`: any string key (`atk`, `spd`, `dmg_taken`, `resistance_shift`, ...).
 * - `type`:
 *     `flat`     — added directly to base
 *     `percent`  — +N% where 20 means +20%; stacks additively
 *     `override` — forces final value; last-wins on conflict
 * - `source`: opaque origin tag. Effects pass the effect name; auras
 *   use the owner id; future equipment uses the item id.
 *   `removeModifiersBySource` uses this for clean removal.
 * - `duration`: optional seconds; `tickModifiers` decrements and
 *   removes at 0. Omit for permanent-until-explicit-removal.
 */
export interface Modifier {
  stat: string;
  type: ModifierType;
  value: number;
  source: string;
  duration?: number;
}

/**
 * Per-stat final-value caps. Applied after stacking. Absence of an
 * entry means "no cap" — don't add one without a design-derived reason.
 */
export const STAT_CAPS: Record<string, { min?: number; max?: number }> = {
  // Healing amp ceilings + reduction floor — keeps heals a dial, not a boolean.
  healing_received: { min: -50, max: 200 },
  // Resistance ladder is 7 tiers; ±3 is the practical shift limit
  // before resistance becomes immune/dead.
  resistance_shift: { min: -3, max: 3 },
};

export interface ModifierBearer {
  components: ReadonlySet<ComponentTag>;
  modifiers?: Modifier[];
}

/**
 * Pure stacking math. Application order:
 *   1. flat:     base + Σ flat.value
 *   2. percent:  × (1 + Σ percent.value / 100)
 *   3. override: last-wins replaces the result
 *   4. cap:      clamp to [min, max] if provided
 *
 * Override "last wins" is deliberate — overrides are forced values
 * (e.g. silence sets atk=0); callers wanting exclusivity should
 * removeModifiersBySource before addModifier.
 */
export function stackModifiers(
  base: number,
  mods: readonly Modifier[],
  cap?: { min?: number; max?: number },
): number {
  let flatSum = 0;
  let percentSum = 0;
  let override: number | undefined;

  for (const m of mods) {
    switch (m.type) {
      case 'flat':
        flatSum += m.value;
        break;
      case 'percent':
        percentSum += m.value;
        break;
      case 'override':
        override = m.value;
        break;
    }
  }

  let result: number;
  if (override !== undefined) {
    result = override;
  } else {
    result = (base + flatSum) * (1 + percentSum / 100);
  }

  if (cap) {
    if (cap.min !== undefined && result < cap.min) result = cap.min;
    if (cap.max !== undefined && result > cap.max) result = cap.max;
  }

  return result;
}

/**
 * Entity-aware apply. Reads the entity's modifier list, filters to
 * `statName`, stacks + caps, returns the final value.
 *
 * Component-gated at the single gate: entities lacking `HasModifiers`
 * short-circuit to `baseValue`. Callers do NOT check components.
 */
export function applyModifiers(
  entity: ModifierBearer,
  baseValue: number,
  statName: string,
): number {
  if (!entity.components.has('HasModifiers')) return baseValue;

  const cap = STAT_CAPS[statName];
  const mods = entity.modifiers;
  if (!mods || mods.length === 0) {
    return cap ? stackModifiers(baseValue, [], cap) : baseValue;
  }

  const filtered: Modifier[] = [];
  for (const m of mods) {
    if (m.stat === statName) filtered.push(m);
  }
  return stackModifiers(baseValue, filtered, cap);
}

export function addModifier(entity: ModifierBearer, mod: Modifier): void {
  if (!entity.modifiers) entity.modifiers = [];
  entity.modifiers.push(mod);
}

/**
 * Remove every modifier matching the source tag. Not component-gated
 * — removal is safe on entities that never carried HasModifiers.
 */
export function removeModifiersBySource(
  entity: ModifierBearer,
  source: string,
): number {
  const mods = entity.modifiers;
  if (!mods || mods.length === 0) return 0;
  let removed = 0;
  for (let i = mods.length - 1; i >= 0; i--) {
    if (mods[i].source === source) {
      mods.splice(i, 1);
      removed++;
    }
  }
  return removed;
}

/**
 * Decrement `duration` on every modifier that carries one; remove at
 * zero. Permanent modifiers (no duration) are skipped. Not yet wired
 * into the production frame — callers register it when needed.
 */
export function tickModifiers(entity: ModifierBearer, dt: number): number {
  const mods = entity.modifiers;
  if (!mods || mods.length === 0) return 0;
  let removed = 0;
  for (let i = mods.length - 1; i >= 0; i--) {
    const m = mods[i];
    if (m.duration === undefined) continue;
    m.duration -= dt;
    if (m.duration <= 0) {
      mods.splice(i, 1);
      removed++;
    }
  }
  return removed;
}
