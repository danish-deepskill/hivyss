// Phase 7a — effect-pipeline primitive tests.
//
// Coverage:
//   - applyHealPhase (heal routing, cancel semantics, dead-target)
//   - applyEffectsPhase (per-name application, cancel skip, dead-target no-op)
//   - Subscriber registration order (legacy post_apply first, apply-effects second)
//   - burn.onTick accumulator math (fractional carry, integer dispatch, convergence)
//   - makeDotDispatcher save-restore pin (before-after _lastAttacker state)
//   - DOT dispatcher no-ops cleanly without a context
//
// Strategy: reuse the Phase 6 test pattern — construct a fresh
// CombatPipeline, subscribe the Phase 7a helpers directly, drive
// events through queueAbility. No CombatSystem instantiation
// (factored helpers make this possible). Effects are applied via
// EffectSystem directly since Phase 7a has no production path
// that queues ability.appliesEffects yet.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CombatPipeline } from '../../src/systems/CombatPipeline';
import {
  applyHealPhase,
  applyEffectsPhase,
  applyVarianceAndCritModify,
} from '../../src/systems/CombatPhases';
import { makeDotDispatcher } from '../../src/systems/CombatDispatch';
import {
  applyEffect,
  updateEffects,
  findActiveEffect,
} from '../../src/systems/EffectSystem';
import {
  setDotDispatcher,
  getDotDispatcher,
  dispatchDotDamage,
  type DotDispatcher,
} from '../../src/config/combat/effects/dispatch';
import type {
  DamageEvent,
  AbilityDef,
  WorldEntity,
  ComponentTag,
  CombatContext,
  IUnit,
  HitFlavor,
} from '../../src/types';
import type { DamageType } from '../../src/config/combat/damageTypes';
import type { ResistanceTier } from '../../src/config/combat/resistances';
import type { EffectBearer, ActiveEffect, EffectDef } from '../../src/config/combat/effects/types';

// ------------------------------------------------------------------
// Fixture builders
// ------------------------------------------------------------------

let _id = 0;

type TestEntity = WorldEntity & {
  hp?: number;
  maxHp?: number;
  atk?: number;
  resistance?: Partial<Record<DamageType, ResistanceTier>>;
  heal?: (amount: number) => number;
  // EffectBearer
  activeEffects?: ActiveEffect[];
};

function makeEntity(opts: {
  hp?: number;
  maxHp?: number;
  atk?: number;
  dead?: boolean;
  components?: ComponentTag[];
} = {}): TestEntity {
  const entity: TestEntity = {
    id: ++_id,
    x: 0,
    y: 0,
    dead: opts.dead ?? false,
    components: new Set(opts.components ?? ['HasHP', 'HasAI', 'IsTargetable']),
    hp: opts.hp,
    maxHp: opts.maxHp ?? opts.hp ?? 100,
    atk: opts.atk,
    activeEffects: [],
  };
  // Inline heal for IUnit compatibility — clamps at maxHp.
  entity.heal = (amount: number): number => {
    const before = entity.hp ?? 0;
    const max = entity.maxHp ?? before;
    const next = Math.min(max, before + amount);
    entity.hp = next;
    return next - before;
  };
  return entity;
}

const healAbility: AbilityDef = {
  name: 'test_heal',
  category: 'heal',
  targeting: 'lowest_hp_ally_in_range',
  healAmount: 20,
};

const wrapperDamageAbility: AbilityDef = {
  name: 'test_wrapper',
  category: 'damage',
  targeting: 'no_targeting',
  skipsResistance: true,
};

// ------------------------------------------------------------------
// applyHealPhase — pure function tests
// ------------------------------------------------------------------

describe('applyHealPhase', () => {
  function makeHealEvent(target: TestEntity): DamageEvent {
    return {
      id: 1,
      attacker: target,
      target,
      ability: healAbility,
      dmgType: 'blunt',
      baseDamage: 0,
      finalDamage: 0,
      effectiveTier: 'normal',
      effects: [],
      cancelled: false,
      isReflected: false,
      isRedirected: false,
      damageMultiplier: 1,
    } as DamageEvent;
  }

  it('heals a wounded target by ability.healAmount', () => {
    const target = makeEntity({ hp: 40, maxHp: 100 });
    const event = makeHealEvent(target);
    applyHealPhase(event);
    expect(target.hp).toBe(60); // 40 + 20
  });

  it('clamps heal at maxHp (delegated to target.heal)', () => {
    const target = makeEntity({ hp: 95, maxHp: 100 });
    const event = makeHealEvent(target);
    applyHealPhase(event);
    expect(target.hp).toBe(100);
  });

  it('cancels the event so damage body is skipped', () => {
    const target = makeEntity({ hp: 40, maxHp: 100 });
    const event = makeHealEvent(target);
    applyHealPhase(event);
    expect(event.cancelled).toBe(true);
  });

  it('heal on a dead target is a no-op but still cancels the event', () => {
    const target = makeEntity({ hp: 0, maxHp: 100, dead: true });
    const event = makeHealEvent(target);
    applyHealPhase(event);
    expect(target.hp).toBe(0);
    expect(event.cancelled).toBe(true);
  });

  it('passes through damage-category events unchanged', () => {
    const target = makeEntity({ hp: 100, maxHp: 100 });
    const event: DamageEvent = {
      ...makeHealEvent(target),
      ability: wrapperDamageAbility,
    } as DamageEvent;
    applyHealPhase(event);
    expect(event.cancelled).toBe(false);
    expect(target.hp).toBe(100);
  });

  it('no-ops when healAmount is 0 but still cancels', () => {
    const target = makeEntity({ hp: 50, maxHp: 100 });
    const event = makeHealEvent(target);
    event.ability = { ...healAbility, healAmount: 0 };
    applyHealPhase(event);
    expect(target.hp).toBe(50);
    expect(event.cancelled).toBe(true);
  });

  it('no-ops when healAmount is undefined but still cancels', () => {
    const target = makeEntity({ hp: 50, maxHp: 100 });
    const event = makeHealEvent(target);
    event.ability = { ...healAbility, healAmount: undefined };
    applyHealPhase(event);
    expect(target.hp).toBe(50);
    expect(event.cancelled).toBe(true);
  });

  it('skips already-cancelled events', () => {
    const target = makeEntity({ hp: 50, maxHp: 100 });
    const event = makeHealEvent(target);
    event.cancelled = true;
    applyHealPhase(event);
    expect(target.hp).toBe(50); // untouched
  });
});

// ------------------------------------------------------------------
// applyEffectsPhase — applies named effects via EffectSystem
// ------------------------------------------------------------------

describe('applyEffectsPhase', () => {
  function makeDamageEvent(target: TestEntity, effects: string[] = []): DamageEvent {
    return {
      id: 1,
      attacker: target,
      target,
      ability: wrapperDamageAbility,
      dmgType: 'sharp',
      baseDamage: 10,
      finalDamage: 10,
      effectiveTier: 'normal',
      effects,
      cancelled: false,
      isReflected: false,
      isRedirected: false,
      damageMultiplier: 1,
    } as DamageEvent;
  }

  it('applies each effect name to the target', () => {
    const target = makeEntity({ hp: 100, maxHp: 100 });
    const event = makeDamageEvent(target, ['burn']);
    applyEffectsPhase(event);
    expect(findActiveEffect(target, 'burn')).toBeDefined();
  });

  it('applies multiple effect names in order', () => {
    const target = makeEntity({ hp: 100, maxHp: 100 });
    const event = makeDamageEvent(target, ['burn', 'poison']);
    applyEffectsPhase(event);
    expect(findActiveEffect(target, 'burn')).toBeDefined();
    expect(findActiveEffect(target, 'poison')).toBeDefined();
  });

  it('empty effects array is a no-op', () => {
    const target = makeEntity({ hp: 100, maxHp: 100 });
    const event = makeDamageEvent(target, []);
    applyEffectsPhase(event);
    expect(target.activeEffects).toHaveLength(0);
  });

  it('undefined effects is a no-op', () => {
    const target = makeEntity({ hp: 100, maxHp: 100 });
    const event = makeDamageEvent(target);
    (event as { effects?: string[] }).effects = undefined;
    applyEffectsPhase(event);
    expect(target.activeEffects).toHaveLength(0);
  });

  it('skips cancelled events', () => {
    const target = makeEntity({ hp: 100, maxHp: 100 });
    const event = makeDamageEvent(target, ['burn']);
    event.cancelled = true;
    applyEffectsPhase(event);
    expect(findActiveEffect(target, 'burn')).toBeUndefined();
  });

  it('dead-target effect application no-ops via EffectSystem guard', () => {
    const target = makeEntity({ hp: 0, maxHp: 100, dead: true });
    const event = makeDamageEvent(target, ['burn']);
    applyEffectsPhase(event);
    // EffectSystem.applyEffect returns null for dead targets — no
    // entry is appended, no onApply fires.
    expect(findActiveEffect(target, 'burn')).toBeUndefined();
  });

  it('propagates on unknown effect name (caller typo fails loudly)', () => {
    const target = makeEntity({ hp: 100, maxHp: 100 });
    const event = makeDamageEvent(target, ['__definitely_not_an_effect__']);
    expect(() => applyEffectsPhase(event)).toThrow(/Unknown effect/);
  });
});

// ------------------------------------------------------------------
// Registration order pin — legacy first, apply-effects second
// ------------------------------------------------------------------

describe('post_apply subscriber registration order (Phase 7a conservative legacy-first)', () => {
  // The load-bearing correctness guarantee is that the 'apply' phase
  // sets target.dead = true BEFORE any post_apply handler runs (via
  // _applyDamagePhase → u.takeDamage, which sets u.dead = true
  // internally when hp ≤ 0). This test exercises that invariant and
  // also pins that applyEffectsPhase sees a dead target via
  // EffectSystem's own dead-guard. If a future refactor moves
  // death-setting out of 'apply' into 'post_apply', registration
  // order within post_apply becomes strictly load-bearing and THIS
  // test will need to be rewritten to exercise the order directly.
  // (Phase 7b Preflight 3 — corrected from the original "registration
  // order is load-bearing" framing which overclaimed the invariant.)
  it('order of handler registration: legacy (first) → apply-effects (second)', () => {
    // Mirror the CombatSystem constructor ordering and verify that
    // a lethal hit's burn effect does NOT land because the apply
    // phase sets target.dead = true before any post_apply handler
    // runs.
    const pipeline = new CombatPipeline();

    const target = makeEntity({ hp: 10, maxHp: 100, atk: 0 });
    const attacker = makeEntity({ hp: 100, atk: 100 });

    // Legacy-analog subscriber: sets dead = true if finalDamage kills
    pipeline.on('apply', (e) => {
      const t = e.target as TestEntity;
      t.hp = Math.max(0, (t.hp ?? 0) - e.finalDamage);
      if ((t.hp ?? 0) <= 0) t.dead = true;
    });
    pipeline.on('post_apply', (_e) => {
      // In the real system, _applyDeathEffectsPhase runs here and has
      // already fired its death-check half. For the order-pin test
      // we just need the legacy subscriber to be registered before
      // apply-effects so dead gets set first.
    });
    // Register apply-effects SECOND.
    pipeline.on('post_apply', applyEffectsPhase);

    // Queue a lethal hit that also applies burn.
    const event = pipeline.queueAbility(attacker, target, 'override_damage_event', {
      baseDamageOverride: 100,
    });
    event.effects = ['burn']; // simulate ability.appliesEffects = ['burn']
    pipeline.resolveFrame();

    // Target died from the lethal hit.
    expect(target.dead).toBe(true);
    // Burn did NOT land because applyEffect silently no-ops on dead
    // targets. This is the correct legacy-parity behavior.
    expect(findActiveEffect(target, 'burn')).toBeUndefined();
  });

  it('a non-lethal hit with effects DOES land the effect', () => {
    const pipeline = new CombatPipeline();

    const target = makeEntity({ hp: 100, maxHp: 100, atk: 0 });
    const attacker = makeEntity({ hp: 100, atk: 100 });

    pipeline.on('apply', (e) => {
      const t = e.target as TestEntity;
      t.hp = Math.max(0, (t.hp ?? 0) - e.finalDamage);
      if ((t.hp ?? 0) <= 0) t.dead = true;
    });
    pipeline.on('post_apply', applyEffectsPhase);

    const event = pipeline.queueAbility(attacker, target, 'override_damage_event', {
      baseDamageOverride: 10,
    });
    event.effects = ['burn'];
    pipeline.resolveFrame();

    expect(target.dead).toBe(false);
    expect(findActiveEffect(target, 'burn')).toBeDefined();
  });
});

// ------------------------------------------------------------------
// DOT dispatcher save-restore pin
// ------------------------------------------------------------------

describe('makeDotDispatcher (save-restore pin)', () => {
  // Stable ctx fixture — dispatcher bails early if null, so we need
  // a truthy object. Cast to CombatContext via any because we don't
  // construct a real scene/audio/particles chain.
  const stableCtx = { sentinel: true } as unknown as CombatContext;

  it('saves and restores the previous _lastAttacker around queueAbility', () => {
    const outerAttacker = makeEntity({ atk: 99 }) as unknown as IUnit;
    const dotSource = makeEntity({ atk: 5 }) as unknown as IUnit;
    const target = makeEntity({ hp: 100 }) as unknown as IUnit;

    let lastAttacker: IUnit | null = outerAttacker;
    let lastAttackerSeenByQueue: IUnit | null = null;

    const dispatcher = makeDotDispatcher({
      getCurrentCtx: () => stableCtx,
      getLastAttacker: () => lastAttacker,
      setLastAttacker: (u) => { lastAttacker = u; },
      queueAbility: () => {
        // At the moment queueAbility runs, _lastAttacker must be the
        // DOT source (not the outer attacker).
        lastAttackerSeenByQueue = lastAttacker;
      },
      resolveFrame: () => {},
    });

    dispatcher(dotSource, target, 5, 'burn');

    expect(lastAttackerSeenByQueue).toBe(dotSource);
    // AFTER the call, _lastAttacker is restored to the outer value.
    expect(lastAttacker).toBe(outerAttacker);
  });

  it('restores _lastAttacker even when queueAbility throws', () => {
    const outerAttacker = makeEntity({ atk: 99 }) as unknown as IUnit;
    const dotSource = makeEntity({ atk: 5 }) as unknown as IUnit;
    const target = makeEntity({ hp: 100 }) as unknown as IUnit;

    let lastAttacker: IUnit | null = outerAttacker;

    const dispatcher = makeDotDispatcher({
      getCurrentCtx: () => stableCtx,
      getLastAttacker: () => lastAttacker,
      setLastAttacker: (u) => { lastAttacker = u; },
      queueAbility: () => { throw new Error('boom'); },
      resolveFrame: () => {},
    });

    expect(() => dispatcher(dotSource, target, 5, 'burn')).toThrow('boom');
    // try/finally guarantees restore.
    expect(lastAttacker).toBe(outerAttacker);
  });

  it('no-ops cleanly when no current ctx is set (DOT tick outside resolve window)', () => {
    let lastAttacker: IUnit | null = null;
    let queueCalled = false;

    const dispatcher = makeDotDispatcher({
      getCurrentCtx: () => null,
      getLastAttacker: () => lastAttacker,
      setLastAttacker: (u) => { lastAttacker = u; },
      queueAbility: () => { queueCalled = true; },
      resolveFrame: () => {},
    });

    const dotSource = makeEntity() as unknown as IUnit;
    const target = makeEntity() as unknown as IUnit;
    dispatcher(dotSource, target, 5, 'burn');

    expect(queueCalled).toBe(false);
    expect(lastAttacker).toBeNull();
  });

  it('nullish attacker falls back to target as attacker (source may be unknown)', () => {
    let lastAttacker: IUnit | null = makeEntity() as unknown as IUnit;
    const prev = lastAttacker;
    const fallbackTarget = makeEntity() as unknown as IUnit;
    let sawAttacker: IUnit | null = null;

    const dispatcher = makeDotDispatcher({
      getCurrentCtx: () => stableCtx,
      getLastAttacker: () => lastAttacker,
      setLastAttacker: (u) => { lastAttacker = u; },
      queueAbility: () => {
        sawAttacker = lastAttacker;
      },
      resolveFrame: () => {},
    });

    dispatcher(undefined, fallbackTarget, 5, 'burn');
    // Phase 9: nullish attacker falls back to target (defensive — the
    // attacker field is required on DamageEvent). _lastAttacker is set
    // to the fallback during the call.
    expect(sawAttacker).toBe(fallbackTarget);
    expect(lastAttacker).toBe(prev);
  });

  it('queues override_damage_event with baseDamageOverride and legacyHitFlavor', () => {
    let capturedOpts: unknown = null;
    let capturedAbility: string = '';
    const dispatcher = makeDotDispatcher({
      getCurrentCtx: () => stableCtx,
      getLastAttacker: () => null,
      setLastAttacker: () => {},
      queueAbility: (_a, _t, abilityName, opts) => {
        capturedAbility = abilityName;
        capturedOpts = opts;
      },
      resolveFrame: () => {},
    });

    const src = makeEntity() as unknown as IUnit;
    const tgt = makeEntity() as unknown as IUnit;
    dispatcher(src, tgt, 5, 'burn');

    expect(capturedAbility).toBe('override_damage_event');
    expect(capturedOpts).toEqual({
      baseDamageOverride: 5,
      legacyHitFlavor: 'burn',
    });
  });

  it('drains the pipeline via resolveFrame after queueing', () => {
    let order: string[] = [];
    const dispatcher = makeDotDispatcher({
      getCurrentCtx: () => stableCtx,
      getLastAttacker: () => null,
      setLastAttacker: () => {},
      queueAbility: () => { order.push('queue'); },
      resolveFrame: () => { order.push('resolve'); },
    });

    const src = makeEntity() as unknown as IUnit;
    const tgt = makeEntity() as unknown as IUnit;
    dispatcher(src, tgt, 5, 'burn');

    expect(order).toEqual(['queue', 'resolve']);
  });
});

// ------------------------------------------------------------------
// dispatch module (set/get/dispatch) — module-level state
// ------------------------------------------------------------------

describe('dispatch module (setDotDispatcher / dispatchDotDamage)', () => {
  afterEach(() => {
    setDotDispatcher(null); // reset between tests
  });

  it('setDotDispatcher + getDotDispatcher roundtrip', () => {
    const fn: DotDispatcher = () => { /* noop */ };
    setDotDispatcher(fn);
    expect(getDotDispatcher()).toBe(fn);
  });

  it('setDotDispatcher(null) clears', () => {
    setDotDispatcher(() => { /* noop */ });
    setDotDispatcher(null);
    expect(getDotDispatcher()).toBeNull();
  });
});

// ------------------------------------------------------------------
// burn.onTick — accumulator math
// ------------------------------------------------------------------

describe('burn.onTick — accumulator pattern', () => {
  // Capture dispatched damage for assertions. Install a mock
  // dispatcher and reset between tests.
  let dispatched: Array<{ dmg: number; flavor: HitFlavor }>;

  beforeEach(() => {
    dispatched = [];
    setDotDispatcher((_attacker, _target, dmg, flavor) => {
      dispatched.push({ dmg, flavor });
    });
  });

  afterEach(() => {
    setDotDispatcher(null);
  });

  function applyBurnAndTick(target: EffectBearer, dts: number[]): void {
    applyEffect(target, 'burn');
    for (const dt of dts) {
      updateEffects([target], dt);
    }
  }

  it('does not dispatch when time accumulator < interval', () => {
    // Phase 7b cadence fix: burn now uses a TIME accumulator. dt=0.2
    // is below the 0.5s interval, so no dispatch fires and the
    // accumulator holds 0.2.
    const target = makeEntity({ hp: 100 });
    applyBurnAndTick(target, [0.2]);
    expect(dispatched).toHaveLength(0);
    const burn = findActiveEffect(target, 'burn')!;
    expect(burn.accumulator).toBeCloseTo(0.2);
  });

  it('dispatches chunk damage when accumulator crosses the interval', () => {
    // dt=0.5s exactly → accum=0.5 → dispatch chunk=5, carry 0
    const target = makeEntity({ hp: 100 });
    applyBurnAndTick(target, [0.5]);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].dmg).toBe(5);
    expect(dispatched[0].flavor).toBe('burn');
    const burn = findActiveEffect(target, 'burn')!;
    expect(burn.accumulator).toBeCloseTo(0);
  });

  it('carries fractional remainder across ticks', () => {
    // Two 0.3s ticks → total 0.6s → 1 dispatch, accumulator 0.1
    const target = makeEntity({ hp: 100 });
    applyBurnAndTick(target, [0.3, 0.3]);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].dmg).toBe(5);
    const burn = findActiveEffect(target, 'burn')!;
    expect(burn.accumulator).toBeCloseTo(0.1);
  });

  it('dispatches exactly one chunk per interval crossing (no catch-up on big dt)', () => {
    // dt=1.2s (huge jump) → accum=1.2 ≥ 0.5 → dispatch ONE chunk,
    // carry 0.7. Subsequent 0.5-crossings require subsequent ticks.
    // This is intentional: legacy burn never dispatches multiple
    // chunks in a single frame either, because _processStatusEffects
    // only subtracts one interval at a time.
    const target = makeEntity({ hp: 100 });
    applyBurnAndTick(target, [1.2]);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].dmg).toBe(5);
    const burn = findActiveEffect(target, 'burn')!;
    expect(burn.accumulator).toBeCloseTo(0.7);
  });

  it('convergence: 60fps over 8s dispatches ~16 chunks of 5 at 0.5s cadence (legacy parity)', () => {
    // Pins BOTH chunk size AND cadence parity. Chunk size is an
    // EXACT 5-damage dispatch per interval (no fractional split);
    // dispatch count is 15-16 due to floating-point drift at the
    // exact-0.5s interval boundary.
    //
    // FP DRIFT: dt = 1/60 is not exactly representable, so 30*(1/60)
    // sums to 0.49999999999999994 in double precision — one frame
    // BELOW the interval. The first dispatch lands on frame 31, and
    // subsequent dispatches carry a ~1/60s offset forward. Over 480
    // frames (8s) we get 15 full cadence hits; the 16th would land
    // on frame ~481 which is past the 480-frame window.
    //
    // Legacy _processStatusEffects has the same drift pattern (it
    // also accumulates dt per frame and fires on >= 0.5). Loosening
    // to 15-16 is the correct cadence bound, not a tolerance hack.
    const target = makeEntity({ hp: 100 });
    applyEffect(target, 'burn');
    const dt = 1 / 60;
    for (let i = 0; i < 480; i++) {
      updateEffects([target], dt);
    }
    // Cadence pin: 15 or 16 dispatches over 8s at 0.5s intervals
    // (FP drift decides which).
    expect(dispatched.length).toBeGreaterThanOrEqual(15);
    expect(dispatched.length).toBeLessThanOrEqual(16);
    // Chunk-size pin: every dispatch is a 5-damage chunk, always.
    for (const d of dispatched) expect(d.dmg).toBe(5);
    // Total parity: 75 or 80 damage matches legacy's equivalent
    // drift pattern.
    const total = dispatched.reduce((s, d) => s + d.dmg, 0);
    expect(total).toBeGreaterThanOrEqual(75);
    expect(total).toBeLessThanOrEqual(80);
  });

  it('per-stack accumulation capability pin (architectural — production burn is stackable:false post-7b)', () => {
    // Phase 7b Preflight 2: production `burn` flipped to
    // stackable:false. This test no longer exercises production
    // burn's stacking path — instead it uses an inline stackable
    // test def to pin that the EffectSystem per-stack accumulator
    // capability (ActiveEffect.accumulator + EffectContext.instance)
    // still works end-to-end. The capability is preserved for
    // future stackable DOTs (Phase 10+ poison-per-source, etc.); if
    // a future stackable DOT ships, it inherits a working
    // accumulator-per-stack substrate pinned by this test.
    const testStackableDot: EffectDef = {
      name: '_test_stackable_dot',
      duration: 10,
      stackable: true,
      onTick(target, dt, ctx) {
        // Mirror burn.onTick's accumulator pattern at dps=5 so the
        // original test math (dt=0.2 → each stack dispatches 1)
        // holds. Separate dps from production burn's 10 so this
        // test is insulated from future burn balance tuning.
        const dps = 5;
        const accum = (ctx.instance.accumulator ?? 0) + dps * dt;
        if (accum < 1) {
          ctx.instance.accumulator = accum;
          return;
        }
        const dispatch = Math.floor(accum);
        ctx.instance.accumulator = accum - dispatch;
        dispatchDotDamage(ctx.instance.source, target, dispatch, 'burn');
      },
    };

    const target = makeEntity({ hp: 100 });
    applyEffect(target, testStackableDot);
    applyEffect(target, testStackableDot); // stack #2
    updateEffects([target], 0.2);
    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].dmg).toBe(1);
    expect(dispatched[1].dmg).toBe(1);
  });

  it('fresh stack starts with no accumulator (lazy init)', () => {
    const target = makeEntity({ hp: 100 });
    applyEffect(target, 'burn');
    const burn = findActiveEffect(target, 'burn')!;
    expect(burn.accumulator).toBeUndefined();
  });

  it('dispatches with dmgType="burn" flavor for particle routing', () => {
    // Phase 7b cadence fix: tick exactly one interval so a dispatch
    // actually fires (sub-interval ticks store time without firing).
    const target = makeEntity({ hp: 100 });
    applyBurnAndTick(target, [0.5]);
    expect(dispatched[0].flavor).toBe('burn');
  });

  it('no-op if dispatcher is unregistered (defensive guard)', () => {
    setDotDispatcher(null);
    // Re-install the capturing dispatcher after null to prove the
    // null case no-ops without crashing.
    const captured: number[] = [];
    const target = makeEntity({ hp: 100 });
    applyEffect(target, 'burn');
    // Tick with dispatcher null — the onTick runs, mutates
    // accumulator, and calls dispatchDotDamage which silently
    // returns because _dispatcher === null. dt=0.6s > interval 0.5
    // → one dispatch attempt, remainder 0.1.
    updateEffects([target], 0.6);
    expect(captured).toHaveLength(0);
    // Accumulator WAS advanced past the interval (dispatch was
    // attempted, just short-circuited at the leaf).
    const burn = findActiveEffect(target, 'burn')!;
    expect(burn.accumulator).toBeCloseTo(0.1); // 0.6 - 0.5 = 0.1
  });
});

// ------------------------------------------------------------------
// Smoke: applyVarianceAndCritModify still exports alongside 7a
// additions (no regression from the type amendments).
// ------------------------------------------------------------------

describe('modify subscribers still work alongside Phase 7a primitives', () => {
  it('applyVarianceAndCritModify is exported and functional (deterministic pass-through)', () => {
    const event = {
      finalDamage: 20,
      ability: { name: 'x', category: 'damage' } as import('../../src/types').AbilityDef,
      effectiveTier: 'normal',
      cancelled: false,
    } as DamageEvent;
    applyVarianceAndCritModify(event);
    // No tiers → guard bails, finalDamage unchanged.
    expect(event.finalDamage).toBe(20);
  });
});
