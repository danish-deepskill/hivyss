// Effect type declarations. Strict-isolation module: imports nothing
// from systems/ or entities/. `EffectBearer` is structural — any
// object carrying `dead` and `activeEffects` satisfies it.

import type { ResistanceTier } from '../resistances';

/**
 * Scratch context passed to every lifecycle hook.
 *
 * `source` is the applier of the effect (Unit, Pylon, ability owner).
 * Typed as `unknown` to keep this file free of Unit imports — hooks
 * narrow locally with a guard. knockback.onApply reads it as the
 * attacker (forwarded by applyEffectsPhase from event.attacker).
 *
 * `instance` is the live ActiveEffect being ticked. Hooks needing
 * per-stack scratch state across ticks (burn's time accumulator) write
 * through ctx.instance.*. Mutations persist because the caller and
 * callee share the same reference.
 */
export interface EffectContext {
  source?: unknown;
  stacks: number;
  remaining: number;
  instance: ActiveEffect;
}

/** Minimal contract the EffectSystem needs from an entity. */
export interface EffectBearer {
  dead: boolean;
  activeEffects?: ActiveEffect[];
}

/**
 * Static config describing an effect type.
 *
 * LIFECYCLE:
 *   onApply  — fires once when the effect first lands on a target
 *   onTick   — fires every updateEffects call, BEFORE duration decrement
 *   onExpire — fires once when duration hits 0 OR removeEffect is called
 *   onStack  — fires on the FIRST existing instance when a stackable
 *              effect re-applies, BEFORE the new stack is appended
 *
 * STACKING:
 *   stackable=false — re-apply takes MAX(existing, incoming) remaining;
 *                     no new array entry, no onApply re-fire.
 *   stackable=true  — re-apply appends a new ActiveEffect, fires onStack
 *                     on the first existing match, then fires onApply
 *                     on the new instance. `maxStacks` caps the count.
 *
 * PREVENTS:
 *   Listed effect names are cleared on apply of THIS effect, and
 *   cannot land on a target already carrying this effect.
 *
 * PER-TIER STATS:
 *   `tiers` is a loose numeric bag keyed by ResistanceTier. Shape is
 *   per-effect (burn uses chunk/interval; slow uses amount; etc.).
 *
 * ON HOST DEATH:
 *   'cancel'  — silently removed on host death (default)
 *   'spread'  — transfers to nearby entities (unwired)
 *   'trigger' — onExpire fires before removal (unwired)
 */
export interface EffectDef {
  name: string;
  duration: number;
  stackable: boolean;
  maxStacks?: number;
  prevents?: readonly string[];
  onHostDeath?: 'cancel' | 'spread' | 'trigger';
  tiers?: Partial<Record<ResistanceTier, Record<string, number>>>;
  onApply?(target: EffectBearer, ctx: EffectContext): void;
  onTick?(target: EffectBearer, dt: number, ctx: EffectContext): void;
  onExpire?(target: EffectBearer, ctx: EffectContext): void;
  onStack?(target: EffectBearer, existing: ActiveEffect, incoming: ActiveEffect): void;
}

/**
 * Runtime instance of an effect on an entity. Multiple instances per
 * effect name exist for stackable effects — each ticks independently.
 *
 * `accumulator` is per-instance scratch storage for DOT hooks that
 * need to carry fractional state (time or damage) across ticks.
 */
export interface ActiveEffect {
  def: EffectDef;
  remaining: number;
  stacks: number;
  source?: unknown;
  accumulator?: number;
}
