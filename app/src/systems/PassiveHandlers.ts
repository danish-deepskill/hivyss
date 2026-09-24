import type { IUnit, PassiveDef, PassiveKind } from '../types';
import type { CombatPipeline } from './CombatPipeline';
import { addModifier, removeModifiersBySource, applyModifiers } from './ModifierSystem';
import { hasActiveEffect } from './EffectSystem';
import { lookupPredicate } from './PassivePredicates';
import { runSelectorInRange } from './Targeting';
import { lookupAbility } from '../config/combat/abilities';
import { dispatchSpawn } from './CombatDispatch';
import { recalcify, type ArmorTiers } from '../config/combat/recalcify';

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
 * Pack Cohesion (α Primal): the herd grows stronger the tighter it packs.
 * Each frame, count same-geneline same-side allies within `radius` and
 * apply a self-modifier scaled by that count (capped at `maxAllies`).
 * Recomputed each frame (remove-then-add) since the value is dynamic.
 *
 * This is the registry's FIRST new consumer beyond the migrated three —
 * adding a brand-new geneline hook = one handler + one union variant,
 * exactly as the registry was designed for.
 */
const cohesionHandler: PassiveHandler = {
  kind: 'cohesion',
  sweep: 'alive',
  tick(u, passive, env) {
    if (passive.kind !== 'cohesion') return;

    // Frenzy Musk (α's signature): while surging, the bank is SPENT — the
    // frozen frenzy modifier carries the (doubled) snapshot and live cohesion
    // tracking suspends. It resumes naturally the frame the surge expires.
    if (hasActiveEffect(u, 'frenzy_surge')) {
      removeModifiersBySource(u, `cohesion:${u.id}:${passive.stat}`);
      return;
    }

    // Read radius + perAlly through the modifier stack so an *amplifier*
    // aura (e.g. Goliath's, which adds a `cohesion_perAlly` modifier to
    // nearby allies) can boost a unit's cohesion. With no amplifier present
    // applyModifiers returns the base value untouched — zero-cost seam.
    const radius = applyModifiers(u, passive.radius, 'cohesion_radius');
    const perAlly = applyModifiers(u, passive.perAlly, 'cohesion_perAlly');

    const ux = u.x + u.unitW / 2;
    let count = 0;
    for (const ally of env.alive) {
      if (ally === u) continue;
      if (ally.side !== u.side) continue;
      if (ally.geneline !== u.geneline) continue;
      const ax = ally.x + ally.unitW / 2;
      if (Math.abs(ax - ux) < radius) count++;
    }

    // Primal Roar (Matriarch's ultimate): while roaring, the unit fights as if
    // FULLY massed — cohesion surges to its cap regardless of real packing, so
    // even a scattered herd hits at peak for the roar window.
    if (hasActiveEffect(u, 'herd_roar')) count = passive.maxAllies;

    const effective = Math.min(count, passive.maxAllies) * perAlly;
    const sourceTag = `cohesion:${u.id}:${passive.stat}`;
    removeModifiersBySource(u, sourceTag);
    if (effective > 0) {
      addModifier(u, {
        stat: passive.stat,
        type: passive.type,
        value: effective,
        source: sourceTag,
      });
    }
  },
};

/**
 * Spawner (β Broodmother): periodically BIRTHS units at the carrier via the
 * spawn dispatcher (substrate-installed; no-op in tests, so spawner units
 * simply don't multiply there). The brood emerges slightly behind the
 * mother — she leads, the spawn follows.
 */
const spawnerHandler: PassiveHandler = {
  kind: 'spawner',
  sweep: 'alive',
  tick(u, passive, env) {
    if (passive.kind !== 'spawner') return;
    u.spawnTimer = (u.spawnTimer ?? 0) + env.dt;
    if (u.spawnTimer < passive.interval) return;
    u.spawnTimer = 0;
    const behind = u.side === 'player' ? -1 : 1;
    const cx = u.x + u.unitW / 2;
    for (let i = 0; i < passive.count; i++) {
      dispatchSpawn(passive.unitKey, u.side, cx + behind * (10 + i * 12));
    }
  },
};

/**
 * Re-calcify (γ Calcifier): every `interval` seconds the wall RE-HARDENS —
 * steps its degraded physical armour one tier back toward the immutable
 * spawn-time `baseResistance` and resets the soak meter. The interval-timer
 * shape mirrors the spawner handler; the tier math is the pure `recalcify`
 * (the inverse of the `degradeArmor` post_apply hook in CombatSystem).
 */
const recalcifyHandler: PassiveHandler = {
  kind: 'recalcify',
  sweep: 'alive',
  tick(u, passive, env) {
    if (passive.kind !== 'recalcify') return;
    u.recalcifyTimer = (u.recalcifyTimer ?? 0) + env.dt;
    if (u.recalcifyTimer < passive.interval) return;
    u.recalcifyTimer = 0;
    // resistance/baseResistance/_armorWear live on the Unit class, not IUnit
    // (the calc layer carries them via CalcTarget) — cast, same as the degrade
    // hook in CombatSystem. Always present at runtime (init sets {} / 0).
    const t = u as IUnit & { resistance?: ArmorTiers; baseResistance?: ArmorTiers; _armorWear?: number };
    if (!t.resistance || !t.baseResistance) return;
    const res = recalcify(t.resistance, t.baseResistance);
    if (res.sharp !== undefined) t.resistance.sharp = res.sharp;
    if (res.blunt !== undefined) t.resistance.blunt = res.blunt;
    t._armorWear = 0; // a re-harden re-sets the wear meter — the wall is fresh
  },
};

/**
 * Registration order: self-modifier → cohesion → aura → heal-cast → spawner
 * → recalcify. The driver calls `pipeline.resolveFrame()` once after all
 * handlers run, so queued heals land before the same-frame attack pass.
 */
export const PASSIVE_HANDLERS: readonly PassiveHandler[] = [
  selfModifierHandler,
  cohesionHandler,
  auraModifierHandler,
  healCastHandler,
  spawnerHandler,
  recalcifyHandler,
];
