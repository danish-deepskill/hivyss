import type { IUnit, PassiveDef, PassiveKind } from '../types';
import type { CombatPipeline } from './CombatPipeline';
import { addModifier, removeModifiersBySource } from './ModifierSystem';
import { lookupPredicate } from './PassivePredicates';
import { runSelectorInRange } from './Targeting';
import { lookupAbility } from '../config/combat/abilities';

/**
 * Per-frame passive engine — the "tick band" registry.
 *
 * Each PassiveKind registers ONE handler here. The driver
 * (`CombatSystem.updatePassives`) sweeps units once per handler and
 * dispatches every matching `PassiveDef` entry to `handler.tick`. Adding
 * a passive kind = add a union variant in types.ts + register a handler
 * below. No new UnitDef field, no new branch hand-wired into the loop.
 *
 * SCOPE FENCE (see `PassiveDef` doc): this is ONLY for behaviors that
 * tick every frame. Event-driven behaviors (reflect, thorns, lifesteal)
 * belong in combat-pipeline phases; terrain/structures in the
 * WorldEntity layer; T6+ apex behaviors in bespoke subsystems.
 *
 * The three handlers below are verbatim ports of the original
 * three-branch `updatePassives` body — byte-for-byte behavior preserved
 * (source-tag scheme, strict-less-than aura range, dead-owner cleanup
 * latch, healTimer carry-over). Handler order in `PASSIVE_HANDLERS`
 * reproduces the original sweep order: self → aura → heal.
 */
export interface PassiveTickEnv {
  /** Living units only — self-modifier and heal-cast sweep this. */
  alive: IUnit[];
  /** All units incl. dead — aura sweeps this for dead-owner cleanup. */
  units: IUnit[];
  dt: number;
  pipeline: CombatPipeline;
}

export interface PassiveHandler {
  kind: PassiveKind;
  /**
   * Which list the driver sweeps for this handler. `'all'` includes dead
   * units (aura needs them for the one-time cleanup pass); `'alive'`
   * excludes them.
   */
  sweep: 'alive' | 'all';
  /** Tick one passive entry of this kind on one carrying unit. */
  tick(unit: IUnit, passive: PassiveDef, env: PassiveTickEnv): void;
}

/**
 * Self-modifier: toggles a source-tagged modifier on the unit itself
 * based on a named predicate (e.g. Ravager's "hp_below_half" rage).
 */
const selfModifierHandler: PassiveHandler = {
  kind: 'self_modifier',
  sweep: 'alive',
  tick(u, passive) {
    if (passive.kind !== 'self_modifier') return;

    const predicate = lookupPredicate(passive.condition);
    if (!predicate) return; // unknown predicate — silent skip

    const sourceTag = `self:${u.id}:${passive.stat}`;
    const shouldBeActive = predicate(u);
    const hasModifier = u.modifiers?.some((m) => m.source === sourceTag) ?? false;

    if (shouldBeActive && !hasModifier) {
      addModifier(u, {
        stat: passive.stat,
        type: passive.type,
        value: passive.value,
        source: sourceTag,
      });
    } else if (!shouldBeActive && hasModifier) {
      removeModifiersBySource(u, sourceTag);
    }
  },
};

/**
 * Aura: maintains a source-tagged modifier (`aura:${ownerId}:${stat}`)
 * on every in-range same-side ally. Multi-source stacks additively.
 *
 * Three owner states:
 *   - Dead owner + `_auraCleanedUp: false` → ONE-TIME cleanup pass
 *     removes the owner's source tag from every same-side unit carrying
 *     it; latch flips to true.
 *   - Dead owner + `_auraCleanedUp: true` → skip.
 *   - Alive owner → Walk 1 (enter) adds the tag to in-range allies
 *     missing it; Walk 2 (exit) removes it from carrying allies now out
 *     of range.
 *
 * Distance uses strict-less-than (`>= range` is OUT) for legacy
 * byte-parity on the boundary.
 */
const auraModifierHandler: PassiveHandler = {
  kind: 'aura_modifier',
  sweep: 'all',
  tick(u, passive, env) {
    if (passive.kind !== 'aura_modifier') return;

    const sourceTag = `aura:${u.id}:${passive.stat}`;

    if (u.dead) {
      if (u._auraCleanedUp) return;
      for (const ally of env.units) {
        if (ally === u) continue;
        if (ally.side !== u.side) continue;
        if (!ally.modifiers?.some((m) => m.source === sourceTag)) continue;
        removeModifiersBySource(ally, sourceTag);
      }
      u._auraCleanedUp = true;
      return;
    }

    const ux = u.x + u.unitW / 2;

    // Walk 1 — enter.
    for (const ally of env.alive) {
      if (ally === u) continue;
      if (ally.side !== u.side) continue;
      const ax = ally.x + ally.unitW / 2;
      const distance = Math.abs(ax - ux);
      if (distance >= passive.range) continue;
      const hasModifier = ally.modifiers?.some((m) => m.source === sourceTag) ?? false;
      if (!hasModifier) {
        addModifier(ally, {
          stat: passive.stat,
          type: passive.type,
          value: passive.value,
          source: sourceTag,
        });
      }
    }

    // Walk 2 — exit.
    for (const ally of env.alive) {
      if (ally === u) continue;
      if (ally.side !== u.side) continue;
      const hasModifier = ally.modifiers?.some((m) => m.source === sourceTag) ?? false;
      if (!hasModifier) continue;
      const ax = ally.x + ally.unitW / 2;
      const distance = Math.abs(ax - ux);
      if (distance >= passive.range) {
        removeModifiersBySource(ally, sourceTag);
      }
    }
  },
};

/**
 * Passive heal: accumulates `healTimer` by dt; when >= cooldown AND the
 * heal ability's selector finds a target, queues the heal and resets the
 * timer. On empty-target frames the timer stays at/above cooldown so
 * next-frame acquisition fires immediately (no artificial delay).
 */
const healCastHandler: PassiveHandler = {
  kind: 'heal_cast',
  sweep: 'alive',
  tick(u, passive, env) {
    if (passive.kind !== 'heal_cast') return;

    u.healTimer = (u.healTimer ?? 0) + env.dt;
    if (u.healTimer < passive.cooldown) return;

    const ability = lookupAbility(passive.abilityName);
    const targets = runSelectorInRange(ability.targeting, u, ability, env.alive);
    if (targets.length === 0) return;

    u.healTimer = 0;
    env.pipeline.queueAbility(u, targets[0] as IUnit, passive.abilityName, {});
  },
};

/**
 * Registration order reproduces the original `updatePassives` sweep
 * order: self-modifier, then aura, then heal-cast. The driver calls
 * `pipeline.resolveFrame()` once after all handlers run, so queued heals
 * land before the same-frame attack pass.
 */
export const PASSIVE_HANDLERS: readonly PassiveHandler[] = [
  selfModifierHandler,
  auraModifierHandler,
  healCastHandler,
];
