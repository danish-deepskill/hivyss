// Skitterling + Cinderfly migration parity tests.
//
// Coverage:
//   - Skitterling deterministic damage parity
//   - Cinderfly direct-hit deterministic parity
//   - Cinderfly burn end-to-end (80 damage over 8s)
//   - No-double-burn on primary (Preflight Fix 4 regression pin)
//   - Phase 2 resistance divergence sanity check (Cinderfly vs
//     heat-strong target — intentional Phase 2 resistance milestone)
//   - Phase 6/7a coexistence smoke

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CombatPipeline } from '../../src/systems/CombatPipeline';
import {
  applyHealPhase,
  applyEffectsPhase,
  applyVarianceAndCritModify,
} from '../../src/systems/CombatPhases';
import {
  applyEffect,
  updateEffects,
  findActiveEffect,
  countActiveEffect,
} from '../../src/systems/EffectSystem';
import {
  setDotDispatcher,
} from '../../src/config/combat/effects/dispatch';
import { UNIT_DEFS } from '../../src/units/registry';
import type {
  DamageEvent,
  WorldEntity,
  ComponentTag,
  HitFlavor,
} from '../../src/types';
import type { DamageType } from '../../src/config/combat/damageTypes';
import type { ResistanceTier } from '../../src/config/combat/resistances';
import type { ActiveEffect } from '../../src/config/combat/effects/types';

// ------------------------------------------------------------------
// Fixture builders
// ------------------------------------------------------------------

let _id = 0;
function makeEntity(opts: {
  x?: number;
  dead?: boolean;
  hp?: number;
  atk?: number;
  resistance?: Partial<Record<DamageType, ResistanceTier>>;
  components?: ComponentTag[];
} = {}): WorldEntity & {
  hp?: number;
  atk?: number;
  resistance?: Partial<Record<DamageType, ResistanceTier>>;
  activeEffects?: ActiveEffect[];
} {
  return {
    id: ++_id,
    x: opts.x ?? 0,
    y: 0,
    dead: opts.dead ?? false,
    components: new Set(opts.components ?? ['HasHP', 'HasAI', 'IsTargetable']),
    hp: opts.hp,
    atk: opts.atk,
    resistance: opts.resistance,
    activeEffects: [],
  };
}

/** Deterministic baseline — `max(1, round(atk × tierMult))`. */
function deterministicDmg(atk: number, tierMult: number = 1): number {
  return Math.max(1, Math.round(atk * tierMult));
}

/**
 * Migrated path simulator. Builds a fresh pipeline with the
 * variance/crit subscriber + Phase 7a heal/effects subscribers (so
 * any cross-contamination from heal/effects registration leaks into
 * this test), queues the real ability, drains, returns finalDamage.
 */
function simulateMigratedHit(
  abilityName: string,
  atk: number,
  targetResistance?: Partial<Record<DamageType, ResistanceTier>>,
): number {
  const pipeline = new CombatPipeline();
  pipeline.on('modify', applyVarianceAndCritModify);
  pipeline.on('pre_apply', applyHealPhase);
  pipeline.on('post_apply', applyEffectsPhase);

  let captured = 0;
  pipeline.on('apply', (e: DamageEvent) => {
    captured = e.finalDamage;
    e.cancelled = true; // skip post_apply so apply-effects doesn't run on this synthetic target
  });

  const attacker = makeEntity({ atk });
  const target = makeEntity({ resistance: targetResistance });

  pipeline.queueAbility(attacker, target, abilityName);
  pipeline.resolveFrame();

  return captured;
}

// ------------------------------------------------------------------
// Skitterling migration parity
// ------------------------------------------------------------------

describe('Skitterling — deterministic damage parity', () => {
  it('def declares defaultAbility = "jaw_strike"', () => {
    const def = UNIT_DEFS['skitterling'];
    expect(def).toBeDefined();
    expect(def.defaultAbility).toBe('jaw_strike');
  });

  it('migrated jaw_strike finalDamage = max(1, round(skitterling.atk × 1.0))', () => {
    const def = UNIT_DEFS['skitterling'];
    const atk = def.atk;
    const actual = simulateMigratedHit('jaw_strike', atk);
    expect(actual).toBe(deterministicDmg(atk));
  });

  it('jaw_strike cross-unit sanity: 42 atk → 42 dmg, 20 atk → 20 dmg', () => {
    expect(simulateMigratedHit('jaw_strike', 42)).toBe(42);
    expect(simulateMigratedHit('jaw_strike', 20)).toBe(20);
  });
});

// ------------------------------------------------------------------
// Cinderfly direct-hit parity (heat-resistance-free target)
// ------------------------------------------------------------------

describe('Cinderfly — deterministic direct-hit parity', () => {
  it('def declares defaultAbility = "fire_bite"', () => {
    const def = UNIT_DEFS['cinderfly'];
    expect(def).toBeDefined();
    expect(def.defaultAbility).toBe('fire_bite');
  });

  it('migrated fire_bite direct hit = max(1, round(cinderfly.atk × 1.0)) vs heat-neutral target', () => {
    const def = UNIT_DEFS['cinderfly'];
    expect(def.atk).toBe(30); // fixture sanity check
    const atk = def.atk;
    const actual = simulateMigratedHit('fire_bite', atk, {});
    expect(actual).toBe(deterministicDmg(atk));
  });
});

// ------------------------------------------------------------------
// Cinderfly burn end-to-end (Phase 7a primitive validation)
// ------------------------------------------------------------------

describe('Phase 7b — Cinderfly burn end-to-end via Phase 7a primitives', () => {
  // Capture dispatched DOT damage so we can assert on burn ticks.
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

  it('burn applied via fire_bite.appliesEffects lands on the target', () => {
    // This is the integration test: ability queued → event.effects
    // populated from ability.appliesEffects → applyEffectsPhase
    // runs in post_apply → EffectSystem.applyEffect lands burn on
    // target. Without the apply-effects subscriber, the burn never
    // arrives. This test is the Phase 7a validation Cinderfly was
    // drafted for.
    const pipeline = new CombatPipeline();
    pipeline.on('modify', applyVarianceAndCritModify);
    pipeline.on('apply', (e: DamageEvent) => {
      // Stub apply — we only care about post_apply effect landing.
      e.finalDamage = e.finalDamage; // no-op, just keep linter happy
    });
    pipeline.on('post_apply', applyEffectsPhase);

    const attacker = makeEntity({ atk: 30 });
    const target = makeEntity({ hp: 100 });

    const event = pipeline.queueAbility(attacker, target, 'fire_bite');
    expect(event.effects).toEqual(['burn']); // Phase 4 populated this
    pipeline.resolveFrame();

    // After post_apply, burn should be an ActiveEffect on target.
    const burn = findActiveEffect(target, 'burn');
    expect(burn).toBeDefined();
    expect(burn!.def.name).toBe('burn');
  });

  it('burn ticks to ~80 total damage over 8s at 60fps (legacy parity)', () => {
    // End-to-end: apply burn, tick 480 frames (8s at 60fps),
    // dispatcher captures each chunk dispatch.
    //
    // Phase 7b cadence fix: burn now dispatches 5-damage chunks at
    // 0.5s intervals via a time-accumulator. Expected total is 80
    // (16 chunks × 5) but FP drift at the exact-0.5s boundary can
    // cost the 16th dispatch — 30*(1/60) sums to 0.49999...4 in
    // double precision, so cadence runs frame-31/61/91/... and the
    // 16th chunk lands at frame ~481 (outside the 480-frame window).
    // Legacy _processStatusEffects has the same drift pattern, so
    // [75, 80] is the correct legacy-parity bound.
    const target = makeEntity({ hp: 100 });
    applyEffect(target, 'burn');
    const dt = 1 / 60;
    for (let i = 0; i < 480; i++) {
      updateEffects([target], dt);
    }
    const total = dispatched.reduce((s, d) => s + d.dmg, 0);
    expect(total).toBeGreaterThanOrEqual(75);
    expect(total).toBeLessThanOrEqual(80);
  });

  it('burn expires at the end of its 8s duration', () => {
    const target = makeEntity({ hp: 100 });
    applyEffect(target, 'burn');
    const dt = 1 / 60;
    // Tick just over 8s — burn should be gone.
    for (let i = 0; i < 490; i++) {
      updateEffects([target], dt);
    }
    expect(findActiveEffect(target, 'burn')).toBeUndefined();
  });

  it('burn uses flavor="burn" for particle routing parity with legacy', () => {
    // Legacy _processStatusEffects calls hitUnit(u, 5, 'burn', ctx).
    // New path must also pass 'burn' as HitFlavor so particles and
    // sound route to the fire color/channel.
    const target = makeEntity({ hp: 100 });
    applyEffect(target, 'burn');
    // Phase 7b cadence fix: burn now dispatches at 0.5s intervals.
    // Tick exactly one interval to trigger one dispatch.
    updateEffects([target], 0.5);
    expect(dispatched.length).toBeGreaterThan(0);
    expect(dispatched[0].flavor).toBe('burn');
  });
});

// ------------------------------------------------------------------
// No-double-burn on primary (Preflight Fix 4 regression pin)
// ------------------------------------------------------------------

describe('Phase 7b — Cinderfly fire_bite applies ActiveEffect burn to primary', () => {
  // Phase 7b Preflight Fix 4 pinned the no-double-burn invariant:
  // primary target gets new-system ActiveEffect burn via
  // appliesEffects, NOT legacy burnTimer via afterHit spread.
  // Phase 9 Batch 1 retired cinderflyCombat.afterHit entirely (burn
  // spread now goes through the aoeRider primitive), so the legacy
  // burnTimer write path is gone. This test now pins the simpler
  // invariant: fire_bite lands exactly one ActiveEffect burn on the
  // primary target.

  it('primary target receives exactly one ActiveEffect burn after fire_bite', () => {
    const pipeline = new CombatPipeline();
    pipeline.on('modify', applyVarianceAndCritModify);
    pipeline.on('apply', (_e: DamageEvent) => { /* no-op */ });
    pipeline.on('post_apply', applyEffectsPhase);

    const attacker = makeEntity({ atk: 30 });
    const target = {
      ...makeEntity({ hp: 100 }),
    } as WorldEntity & {
      hp?: number;
      activeEffects?: ActiveEffect[];
    };

    pipeline.queueAbility(attacker, target, 'fire_bite');
    pipeline.resolveFrame();

    expect(countActiveEffect(target, 'burn')).toBe(1);
  });
});

// ------------------------------------------------------------------
// cinderflyCombat.afterHit filter regression (Preflight Fix 4
// direct unit test against the hook)
// ------------------------------------------------------------------

// Phase 9 Batch 3 Item 20: COMBAT_MAP + CombatHooks deleted entirely.
// The previous describe block verifying "Cinderfly has no combat hooks"
// is trivially satisfied now (there is no COMBAT_MAP). Parity tests for
// the aoeRider path live in phase8.test.ts.

// ------------------------------------------------------------------
// Phase 2 resistance divergence (intentional, not a regression)
// ------------------------------------------------------------------

describe('Phase 2 resistance goes live in production traffic', () => {
  // The variance/crit subscriber rounds finalDamage at end-of-phase,
  // so the captured value is the integer that lands at apply.

  it('heat-strong target divergence: 30 × 0.85 = 25.5 → round → 26', () => {
    // Cinderfly's atk (30) vs a heat-strong target. Phase 2 resistance
    // data driving calculate-phase output — NOT a parity regression.
    const actual = simulateMigratedHit('fire_bite', 30, { heat: 'strong' });
    expect(actual).toBe(26);
  });

  it('heat-weak target divergence: 30 × 1.15 = 34.5 → round → 35', () => {
    const actual = simulateMigratedHit('fire_bite', 30, { heat: 'weak' });
    expect(actual).toBe(35);
  });

  it('heat target with NO resistance entry stays at 1.0× → 30', () => {
    const actual = simulateMigratedHit('fire_bite', 30, {});
    expect(actual).toBe(30);
  });
});

// ------------------------------------------------------------------
// Phase 6/7a coexistence smoke
// ------------------------------------------------------------------

describe('subscriber coexistence', () => {
  it('variance/crit + heal + apply-effects can all run in the same pipeline without cross-contamination', () => {
    const pipeline = new CombatPipeline();
    pipeline.on('modify', applyVarianceAndCritModify);
    pipeline.on('pre_apply', applyHealPhase);
    let applyFinalDamage = 0;
    pipeline.on('apply', (e: DamageEvent) => {
      applyFinalDamage = e.finalDamage;
      e.cancelled = true;
    });
    pipeline.on('post_apply', applyEffectsPhase);

    const attacker = makeEntity({ atk: 20 });
    const target = makeEntity({ hp: 100 });

    pipeline.queueAbility(attacker, target, 'jaw_strike');
    pipeline.resolveFrame();

    // 20 × 1.0 (normal tier) → deterministic 20.
    expect(applyFinalDamage).toBe(20);
  });
});
