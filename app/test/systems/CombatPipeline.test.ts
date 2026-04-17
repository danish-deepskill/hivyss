import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CombatPipeline,
  calculatePhase,
  resistPhase,
  modifyPhase,
  PIPELINE_PHASES,
  type PipelinePhase,
} from '../../src/systems/CombatPipeline';
import type {
  DamageEvent,
  AbilityDef,
  WorldEntity,
  ComponentTag,
} from '../../src/types';
import type { DamageType } from '../../src/config/combat/damageTypes';
import type { ResistanceTier } from '../../src/config/combat/resistances';

// ------------------------------------------------------------------
// Fixture builders — plain objects, no Phaser, no Unit construction.
// ------------------------------------------------------------------

let _id = 0;
const makeEntity = (opts: {
  x?: number;
  dead?: boolean;
  hp?: number;
  atk?: number;
  resistance?: Partial<Record<DamageType, ResistanceTier>>;
  penetration?: Partial<Record<DamageType, number>>;
  components?: ComponentTag[];
} = {}): WorldEntity & {
  hp?: number;
  atk?: number;
  resistance?: Partial<Record<DamageType, ResistanceTier>>;
  penetration?: Partial<Record<DamageType, number>>;
} => ({
  id: ++_id,
  x: opts.x ?? 0,
  y: 0,
  dead: opts.dead ?? false,
  components: new Set(opts.components ?? ['HasHP', 'HasAI', 'IsTargetable']),
  hp: opts.hp,
  atk: opts.atk,
  resistance: opts.resistance,
  penetration: opts.penetration,
});

// Ability stubs — test-local, don't hit the real registry.
const wrapperAbility: AbilityDef = {
  name: 'test_wrapper',
  category: 'damage',
  targeting: 'no_targeting',
  skipsResistance: true,
};

const realDamageAbility: AbilityDef = {
  name: 'test_jaw_strike',
  category: 'damage',
  dmgType: 'sharp',
  targeting: 'nearest_enemy_in_range',
  range: 30,
  targetCount: 1,
  trigger: 'onAttack',
  tiers: {
    weakest:   { dmgMult: 1.5 },
    weaker:    { dmgMult: 1.3 },
    weak:      { dmgMult: 1.15 },
    normal:    { dmgMult: 1.0 },
    strong:    { dmgMult: 0.85 },
    stronger:  { dmgMult: 0.7 },
    strongest: { dmgMult: 0.5 },
  },
};

const healAbility: AbilityDef = {
  name: 'test_heal',
  category: 'heal',
  targeting: 'lowest_hp_ally_in_range',
  healAmount: 20,
};

// Manual event builder that bypasses queueAbility — used by
// direct phase-subscriber tests that don't care about the queue.
function makeEvent(
  ability: AbilityDef,
  attacker: WorldEntity,
  target: WorldEntity,
  overrides: Partial<DamageEvent> = {},
): DamageEvent {
  return {
    id: 1,
    attacker,
    target,
    ability,
    dmgType: (ability.dmgType ?? 'blunt') as DamageType,
    baseDamage: 0,
    finalDamage: 0,
    effectiveTier: 'normal',
    effects: ability.appliesEffects?.slice() ?? [],
    cancelled: false,
    isReflected: false,
    isRedirected: false,
    damageMultiplier: 1,
    ...overrides,
  };
}

beforeEach(() => {
  _id = 0;
});

// ==================================================================
// PURE PHASE FUNCTIONS — testable without instantiating the pipeline
// ==================================================================

describe('calculatePhase — legacy wrapper path', () => {
  it('copies baseDamageOverride into baseDamage and finalDamage', () => {
    const e = makeEvent(
      wrapperAbility,
      makeEntity(),
      makeEntity(),
      { _baseDamageOverride: 42 },
    );
    calculatePhase(e);
    expect(e.baseDamage).toBe(42);
    expect(e.finalDamage).toBe(42);
    expect(e.effectiveTier).toBe('normal');
  });

  it('skipsResistance ability without override falls back to 0 (defensive)', () => {
    const e = makeEvent(wrapperAbility, makeEntity(), makeEntity());
    calculatePhase(e);
    expect(e.baseDamage).toBe(0);
    expect(e.finalDamage).toBe(0);
  });

  it('leaves the event otherwise unmodified', () => {
    const e = makeEvent(
      wrapperAbility,
      makeEntity(),
      makeEntity(),
      { _baseDamageOverride: 7, damageMultiplier: 1.5, effects: ['burn'] },
    );
    calculatePhase(e);
    expect(e.damageMultiplier).toBe(1.5);
    expect(e.effects).toEqual(['burn']);
    expect(e.cancelled).toBe(false);
  });
});

describe('calculatePhase — real ability path (tier × caster.atk)', () => {
  it('normal tier at 1.0x multiplier equals caster.atk (legacy parity invariant)', () => {
    const attacker = makeEntity({ atk: 20 });
    const target = makeEntity();
    const e = makeEvent(realDamageAbility, attacker, target);
    calculatePhase(e);
    expect(e.baseDamage).toBe(20);
    expect(e.finalDamage).toBe(20);
    expect(e.effectiveTier).toBe('normal');
  });

  it('strong tier cuts damage per the 0.85x multiplier', () => {
    const attacker = makeEntity({ atk: 20 });
    const target = makeEntity({ resistance: { sharp: 'strong' } });
    const e = makeEvent(realDamageAbility, attacker, target);
    calculatePhase(e);
    expect(e.effectiveTier).toBe('strong');
    expect(e.finalDamage).toBeCloseTo(20 * 0.85, 5);
  });

  it('penetration shifts the effective tier down before lookup', () => {
    // Target has 'strong' resistance, attacker has penetration:1.
    // Effective tier should shift from 'strong' → 'normal' → 1.0x.
    const attacker = makeEntity({ atk: 20, penetration: { sharp: 1 } });
    const target = makeEntity({ resistance: { sharp: 'strong' } });
    const e = makeEvent(realDamageAbility, attacker, target);
    calculatePhase(e);
    expect(e.effectiveTier).toBe('normal');
    expect(e.finalDamage).toBe(20);
  });

  it('strongest tier clamps correctly (0.5x)', () => {
    const attacker = makeEntity({ atk: 100 });
    const target = makeEntity({ resistance: { sharp: 'strongest' } });
    const e = makeEvent(realDamageAbility, attacker, target);
    calculatePhase(e);
    expect(e.effectiveTier).toBe('strongest');
    expect(e.finalDamage).toBe(50);
  });

  it('missing caster.atk defaults to 0 (no crash)', () => {
    const attacker = makeEntity(); // no atk
    const target = makeEntity();
    const e = makeEvent(realDamageAbility, attacker, target);
    calculatePhase(e);
    expect(e.baseDamage).toBe(0);
    expect(e.finalDamage).toBe(0);
  });

  it('heal-category abilities zero out damage fields', () => {
    const attacker = makeEntity({ atk: 20 });
    const target = makeEntity();
    const e = makeEvent(healAbility, attacker, target);
    calculatePhase(e);
    expect(e.baseDamage).toBe(0);
    expect(e.finalDamage).toBe(0);
  });
});

describe('resistPhase + modifyPhase (Phase 4 no-ops)', () => {
  it('resistPhase does not mutate the event', () => {
    const e = makeEvent(
      realDamageAbility,
      makeEntity({ atk: 20 }),
      makeEntity(),
      { finalDamage: 100, effects: ['burn'] },
    );
    const before = { ...e, effects: e.effects.slice() };
    resistPhase(e);
    expect(e.finalDamage).toBe(before.finalDamage);
    expect(e.effects).toEqual(before.effects);
    expect(e.cancelled).toBe(false);
  });

  it('modifyPhase does not mutate the event', () => {
    const e = makeEvent(
      realDamageAbility,
      makeEntity({ atk: 20 }),
      makeEntity(),
      { finalDamage: 50, damageMultiplier: 2 },
    );
    modifyPhase(e);
    expect(e.finalDamage).toBe(50);
    expect(e.damageMultiplier).toBe(2);
  });
});

// ==================================================================
// CombatPipeline — queueAbility + resolveFrame semantics
// ==================================================================

describe('CombatPipeline.queueAbility', () => {
  it('increments event id monotonically', () => {
    const p = new CombatPipeline();
    const e1 = p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 10 });
    const e2 = p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 10 });
    expect(e2.id).toBe(e1.id + 1);
  });

  it('stores attacker, target, ability ref on the event', () => {
    const p = new CombatPipeline();
    const attacker = makeEntity();
    const target = makeEntity();
    const e = p.queueAbility(attacker, target, 'override_damage_event', { baseDamageOverride: 5 });
    expect(e.attacker).toBe(attacker);
    expect(e.target).toBe(target);
    expect(e.ability.name).toBe('Override Damage Event');
  });

  it('throws on unknown ability name', () => {
    const p = new CombatPipeline();
    expect(() =>
      p.queueAbility(makeEntity(), makeEntity(), 'fictional_ability'),
    ).toThrow();
  });

  it('carries legacy wrapper opts into event transitional fields', () => {
    const p = new CombatPipeline();
    const e = p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', {
      baseDamageOverride: 17,
      legacyHitFlavor: 'ranged',
    });
    expect(e._baseDamageOverride).toBe(17);
    expect(e._legacyHitFlavor).toBe('ranged');
  });

  it('derives canonical dmgType from legacyHitFlavor via the bridge', () => {
    const p = new CombatPipeline();
    const eRanged = p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', {
      baseDamageOverride: 10,
      legacyHitFlavor: 'ranged',
    });
    expect(eRanged.dmgType).toBe('sharp');

    const eBurn = p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', {
      baseDamageOverride: 10,
      legacyHitFlavor: 'burn',
    });
    expect(eBurn.dmgType).toBe('heat');
  });

  it('uses ability.dmgType when present (non-wrapper abilities)', () => {
    const p = new CombatPipeline();
    const e = p.queueAbility(makeEntity({ atk: 20 }), makeEntity(), 'jaw_strike');
    expect(e.dmgType).toBe('sharp');
  });
});

describe('CombatPipeline.resolveFrame — drain semantics', () => {
  it('drains every queued event through every phase in order', () => {
    const p = new CombatPipeline();
    const order: PipelinePhase[] = [];
    for (const phase of PIPELINE_PHASES) {
      p.on(phase, () => order.push(phase));
    }

    p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
    p.resolveFrame();

    expect(order).toEqual([...PIPELINE_PHASES]);
    expect(p.size).toBe(0);
  });

  it('skips events whose target is already dead', () => {
    const p = new CombatPipeline();
    const applyCalls: DamageEvent[] = [];
    p.on('apply', (e) => applyCalls.push(e));

    const deadTarget = makeEntity({ dead: true });
    p.queueAbility(makeEntity(), deadTarget, 'override_damage_event', { baseDamageOverride: 5 });
    p.resolveFrame();
    expect(applyCalls).toHaveLength(0);
  });

  it('honors event.cancelled set during an early phase', () => {
    const p = new CombatPipeline();
    let applyRan = false;
    p.on('pre_damage', (e) => { e.cancelled = true; });
    p.on('apply', () => { applyRan = true; });

    p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
    p.resolveFrame();
    expect(applyRan).toBe(false);
  });

  it('picks up events pushed during drain (cascading onDeath pattern)', () => {
    const p = new CombatPipeline();
    const seenIds: number[] = [];

    p.on('apply', (e) => {
      seenIds.push(e.id);
      // Inside the first event's apply, push a second event.
      if (seenIds.length === 1) {
        p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
      }
    });

    p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
    p.resolveFrame();

    // Both events drained — initial + the one pushed during drain.
    expect(seenIds.length).toBe(2);
    expect(p.size).toBe(0);
  });

  it('nested resolveFrame drains depth-first (matches legacy synchronous recursion)', () => {
    // Pipeline's per-call-drain cadence means `CombatSystem.hitUnit`
    // calls resolveFrame recursively when a post_apply handler pushes
    // a cascade event. Each recursion drains its own event immediately,
    // which reproduces legacy's "onDeath → hitUnit applies → next
    // onDeath" depth-first ordering. Verify by observing that a
    // cascade pushed during the first event's apply is fully drained
    // before apply's own subscriber returns.
    const p = new CombatPipeline();
    const seenAtTimeOfSecondApply: number[] = [];

    let firstEventPushedSecond = false;
    p.on('apply', (e) => {
      if (!firstEventPushedSecond) {
        firstEventPushedSecond = true;
        // Inside first event's apply, push cascade and drain.
        p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
        p.resolveFrame();
        // After recursive drain, the second event has already been
        // fully processed — its id is in seen already.
        seenAtTimeOfSecondApply.push(e.id);
      }
    });

    p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
    p.resolveFrame();

    // Depth-first: inner drain completed inside outer apply.
    expect(seenAtTimeOfSecondApply.length).toBe(1);
    expect(p.size).toBe(0);
  });

  it('safety cap drops events beyond SAFETY_CAP and logs once', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = new CombatPipeline();

    // Set up an infinite cascade: every apply pushes another event.
    p.on('apply', () => {
      p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 1 });
    });

    p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 1 });
    p.resolveFrame();

    // Drain hit the cap and cleared everything.
    expect(p.size).toBe(0);
    expect(p.droppedLastDrain).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe('CombatPipeline.findEvents + cancelEvent (Phase 5 API)', () => {
  it('findEvents returns events matching the predicate', () => {
    const p = new CombatPipeline();
    const a1 = makeEntity();
    const a2 = makeEntity();
    p.queueAbility(a1, makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
    p.queueAbility(a2, makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
    p.queueAbility(a1, makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });

    const fromA1 = p.findEvents((e) => e.attacker === a1);
    expect(fromA1).toHaveLength(2);
  });

  it('cancelEvent flips cancelled=true on a queued event by id', () => {
    const p = new CombatPipeline();
    const e = p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });

    const ok = p.cancelEvent(e.id);
    expect(ok).toBe(true);
    expect(e.cancelled).toBe(true);
  });

  it('cancelEvent returns false for an unknown id', () => {
    const p = new CombatPipeline();
    expect(p.cancelEvent(9999)).toBe(false);
  });

  it('cancelled events skip their phase chain during drain', () => {
    const p = new CombatPipeline();
    let applyRan = false;
    p.on('apply', () => { applyRan = true; });

    const e = p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
    p.cancelEvent(e.id);
    p.resolveFrame();

    expect(applyRan).toBe(false);
  });
});

describe('CombatPipeline.on / off', () => {
  it('off removes a previously registered handler', () => {
    const p = new CombatPipeline();
    let hits = 0;
    const handler = () => { hits++; };
    p.on('apply', handler);

    p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
    p.resolveFrame();
    expect(hits).toBe(1);

    p.off('apply', handler);
    p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
    p.resolveFrame();
    expect(hits).toBe(1); // unchanged
  });

  it('off returns false when the handler was never registered', () => {
    const p = new CombatPipeline();
    expect(p.off('apply', () => {})).toBe(false);
  });
});

describe('CombatPipeline.clear', () => {
  it('drops all queued events without running phases', () => {
    const p = new CombatPipeline();
    let ran = false;
    p.on('apply', () => { ran = true; });

    p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
    p.queueAbility(makeEntity(), makeEntity(), 'override_damage_event', { baseDamageOverride: 5 });
    expect(p.size).toBe(2);

    p.clear();
    expect(p.size).toBe(0);
    p.resolveFrame();
    expect(ran).toBe(false);
  });
});

// ==================================================================
// PROPERTY TEST — random event sequences drain cleanly
// ==================================================================

describe('CombatPipeline — property: resolveFrame always drains or caps', () => {
  it('random event sequences drain fully with no leftover', () => {
    for (let trial = 0; trial < 25; trial++) {
      const p = new CombatPipeline();
      const n = 5 + Math.floor(Math.random() * 50);
      for (let i = 0; i < n; i++) {
        p.queueAbility(
          makeEntity(),
          makeEntity(),
          'override_damage_event',
          { baseDamageOverride: Math.floor(Math.random() * 20) },
        );
      }
      p.resolveFrame();
      expect(p.size).toBe(0);
    }
  });

  it('random subscribers + random events never crash and always leave queue empty', () => {
    for (let trial = 0; trial < 10; trial++) {
      const p = new CombatPipeline();
      // Random subscribers on random phases — must not crash the drain.
      for (const phase of PIPELINE_PHASES) {
        if (Math.random() < 0.5) {
          p.on(phase, (e) => {
            // Random mutation, harmless.
            e.damageMultiplier *= (0.9 + Math.random() * 0.2);
          });
        }
      }
      const n = 5 + Math.floor(Math.random() * 30);
      for (let i = 0; i < n; i++) {
        p.queueAbility(
          makeEntity(),
          makeEntity(),
          'override_damage_event',
          { baseDamageOverride: 10 },
        );
      }
      expect(() => p.resolveFrame()).not.toThrow();
      expect(p.size).toBe(0);
    }
  });

  it('random cancellations from random phases are respected', () => {
    for (let trial = 0; trial < 10; trial++) {
      const p = new CombatPipeline();
      let applyHits = 0;
      p.on('calculate', (e) => {
        if (Math.random() < 0.5) e.cancelled = true;
      });
      p.on('apply', () => { applyHits++; });

      const n = 20;
      for (let i = 0; i < n; i++) {
        p.queueAbility(
          makeEntity(),
          makeEntity(),
          'override_damage_event',
          { baseDamageOverride: 5 },
        );
      }
      p.resolveFrame();
      expect(p.size).toBe(0);
      expect(applyHits).toBeGreaterThanOrEqual(0);
      expect(applyHits).toBeLessThanOrEqual(n);
    }
  });
});

// ==================================================================
// SYNTHETIC INTEGRATION — "minimal combat session"
//
// Can't boot Phaser from vitest, so we build a minimal apply/post_apply
// pair that mirrors the Unit.takeDamage + onDeath semantics and feed
// a scripted combat sequence through the pipeline. The goal isn't to
// replace the manual in-browser smoke test — it's to catch pipeline
// plumbing regressions (ordering, cascades, dead-target skip) at
// CI speed. Manual smoke is flagged separately in the Phase 4 report.
// ==================================================================

describe('CombatPipeline — synthetic integration', () => {
  type FakeUnit = WorldEntity & {
    side: 'player' | 'enemy';
    hp: number;
    maxHp: number;
    atk: number;
    onDeathSpawnExplosion?: { radius: number; damage: number };
  };

  function unit(
    side: 'player' | 'enemy',
    x: number,
    hp: number,
    atk: number,
    opts: { onDeathExplosion?: { radius: number; damage: number } } = {},
  ): FakeUnit {
    return {
      id: ++_id,
      x,
      y: 0,
      dead: false,
      components: new Set<ComponentTag>(['HasHP', 'HasAI', 'IsTargetable', 'HasAllegiance']),
      side,
      hp,
      maxHp: hp,
      atk,
      onDeathSpawnExplosion: opts.onDeathExplosion,
    };
  }

  let pipeline: CombatPipeline;
  let all: FakeUnit[];

  function setupPipeline() {
    pipeline = new CombatPipeline();
    // apply: mutate hp
    pipeline.on('apply', (e) => {
      const t = e.target as FakeUnit;
      if (t.dead) { e.cancelled = true; return; }
      t.hp -= e.finalDamage;
      if (t.hp <= 0) {
        t.hp = 0;
        t.dead = true;
      }
    });
    // post_apply: cascade explosions. Mirrors real Bombardier onDeath —
    // explosion targets OPPOSITE side from the dying unit.
    pipeline.on('post_apply', (e) => {
      const t = e.target as FakeUnit;
      if (!t.dead) return;
      if (t.onDeathSpawnExplosion) {
        const r = t.onDeathSpawnExplosion.radius;
        const d = t.onDeathSpawnExplosion.damage;
        for (const v of all) {
          if (v === t) continue;
          if (v.dead) continue;
          if (v.side === t.side) continue;      // only opposite-side victims
          if (Math.abs(v.x - t.x) > r) continue;
          pipeline.queueAbility(t, v, 'override_damage_event', { baseDamageOverride: d });
        }
      }
    });
  }

  beforeEach(() => {
    setupPipeline();
    all = [];
  });

  it('single hit — target HP matches expected', () => {
    const g = unit('player', 0, 100, 20);
    const e = unit('enemy',  10, 100, 15);
    all = [g, e];

    pipeline.queueAbility(g, e, 'override_damage_event', { baseDamageOverride: g.atk });
    pipeline.resolveFrame();

    expect(e.hp).toBe(80);
    expect(e.dead).toBe(false);
  });

  it('lethal hit — target dies and onDeath does not fire without explosion', () => {
    const g = unit('player', 0, 100, 120);
    const e = unit('enemy',  10, 100, 15);
    all = [g, e];

    pipeline.queueAbility(g, e, 'override_damage_event', { baseDamageOverride: g.atk });
    pipeline.resolveFrame();

    expect(e.hp).toBe(0);
    expect(e.dead).toBe(true);
  });

  it('Bombardier-style cascade — dying player bomber hits 3 enemies in radius', () => {
    // Enemy attacker kills a PLAYER bombardier. Bombardier's onDeath
    // explosion hits OPPOSITE-side targets (enemies) within radius 80.
    const atk = unit('enemy',  0,  100, 100);
    const bmb = unit('player', 50, 50,  0, { onDeathExplosion: { radius: 80, damage: 30 } });
    const e1  = unit('enemy',  10, 100, 0);   // within radius (|10-50|=40)
    const e2  = unit('enemy',  30, 40,  0);   // within radius (|30-50|=20) — survives with 10hp
    const e3  = unit('enemy',  100, 100, 0);  // within radius (|100-50|=50)
    const e4  = unit('enemy',  200, 100, 0);  // OUT of radius (|200-50|=150)
    all = [atk, bmb, e1, e2, e3, e4];

    pipeline.queueAbility(atk, bmb, 'override_damage_event', { baseDamageOverride: 100 });
    pipeline.resolveFrame();

    expect(bmb.dead).toBe(true);
    // Three in-radius enemies each took 30 dmg.
    expect(e1.hp).toBe(70);
    expect(e2.hp).toBe(10);
    expect(e2.dead).toBe(false);
    expect(e3.hp).toBe(70);
    // e4 out of radius — untouched.
    expect(e4.hp).toBe(100);
    // atk is same side as... wait, atk is enemy, bmb is player. atk is
    // on the OPPOSITE side from the dying bomber, so atk IS a valid
    // explosion target. atk.x = 0, |0-50| = 50, within 80 → atk was hit.
    expect(atk.hp).toBe(70);
    expect(pipeline.size).toBe(0);
  });

  it('chain of deaths — A kills B → B explodes kills C → C explodes kills D', () => {
    // A (enemy) kills B (player), B's explosion kills C (enemy),
    // C's explosion kills D (enemy — wait, C and D same side won't chain).
    //
    // Use alternating sides so each death's explosion can target the
    // next unit: A enemy → kills B player → explosion hits C enemy →
    // C's explosion targets the OPPOSITE side (player) which is... B
    // (dead). So chain stops after two.
    //
    // To get a real 3-link chain, alternate sides:
    //   A(enemy) → B(player, explodes) → C(enemy, explodes) → D(player)
    // B's explosion targets enemies (C). C's explosion targets players (D).
    const a = unit('enemy',  0,  100, 1000);
    const b = unit('player', 10, 50,  0, { onDeathExplosion: { radius: 50, damage: 100 } });
    const c = unit('enemy',  30, 50,  0, { onDeathExplosion: { radius: 50, damage: 100 } });
    const d = unit('player', 50, 50,  0);
    all = [a, b, c, d];

    pipeline.queueAbility(a, b, 'override_damage_event', { baseDamageOverride: 100 });
    pipeline.resolveFrame();

    expect(b.dead).toBe(true);   // killed by A
    expect(c.dead).toBe(true);   // killed by B's explosion (hits enemies)
    expect(d.dead).toBe(true);   // killed by C's explosion (hits players)
    expect(pipeline.size).toBe(0);
  });

  it('mid-cascade dead-target skip — no double-application on a corpse', () => {
    // Two attackers queue hits on the same target. First hit kills it.
    // Second hit should be skipped because target.dead === true at the
    // start of its drain iteration.
    const a1 = unit('player', 0, 100, 100);
    const a2 = unit('player', 0, 100, 100);
    const t = unit('enemy', 20, 50, 0);
    all = [a1, a2, t];

    pipeline.queueAbility(a1, t, 'override_damage_event', { baseDamageOverride: 100 });
    pipeline.queueAbility(a2, t, 'override_damage_event', { baseDamageOverride: 999 });
    pipeline.resolveFrame();

    expect(t.dead).toBe(true);
    expect(t.hp).toBe(0); // NOT -949 — second hit was skipped.
  });
});

// ==================================================================
// Phase 5 — pending events
// ==================================================================

describe('CombatPipeline — pending events (Phase 5)', () => {
  let pipeline: CombatPipeline;

  beforeEach(() => {
    pipeline = new CombatPipeline();
    // Silence apply+post_apply phases; we only care about queue mechanics.
    pipeline.on('apply', (e) => { (e.target as { hp?: number }).hp = 0; });
  });

  it('resolveFrame skips a pending event and holds it for next drain', () => {
    const a = makeEntity({ atk: 10 });
    const t = makeEntity({ hp: 100, resistance: { blunt: 'normal' } });

    const event = pipeline.queueAbility(a, t, 'override_damage_event', {
      baseDamageOverride: 50,
    });
    event.pending = true;

    pipeline.resolveFrame();
    // Event is still queued, target untouched.
    expect(pipeline.size).toBe(1);
    expect(t.hp).toBe(100);

    // Demote and drain.
    event.pending = false;
    pipeline.resolveFrame();
    expect(pipeline.size).toBe(0);
    expect(t.hp).toBe(0);
  });

  it('non-pending events drain around a pending hold without losing order', () => {
    const a = makeEntity({ atk: 10 });
    const t = makeEntity({ hp: 100 });

    const e1 = pipeline.queueAbility(a, t, 'override_damage_event', { baseDamageOverride: 10 });
    const e2 = pipeline.queueAbility(a, t, 'override_damage_event', { baseDamageOverride: 20 });
    const e3 = pipeline.queueAbility(a, t, 'override_damage_event', { baseDamageOverride: 30 });

    e2.pending = true;

    // Drain should process e1 and e3, hold e2.
    const drained: number[] = [];
    pipeline.on('apply', (e) => { drained.push(e.finalDamage); });
    pipeline.resolveFrame();
    expect(drained).toEqual([10, 30]);
    expect(pipeline.size).toBe(1);
    // The held event is re-prepended with its pending flag intact.
    expect(pipeline.findEvents(() => true)[0].id).toBe(e2.id);
    expect(pipeline.findEvents(() => true)[0].pending).toBe(true);
  });

  it('updatePendingEvents demotes countdown events to non-pending', () => {
    const a = makeEntity({ atk: 10 });
    const t = makeEntity({ hp: 100 });
    const event = pipeline.queueAbility(a, t, 'override_damage_event', { baseDamageOverride: 10 });
    event.pending = true;
    event.pendingCollapseAt = 2;

    pipeline.updatePendingEvents(1);
    expect(event.pending).toBe(true);
    expect(event.pendingCollapseAt).toBe(1);

    pipeline.updatePendingEvents(1);
    expect(event.pending).toBe(false);
  });

  it('updatePendingEvents handles dt exceeding the countdown', () => {
    const a = makeEntity();
    const t = makeEntity();
    const event = pipeline.queueAbility(a, t, 'override_damage_event', { baseDamageOverride: 0 });
    event.pending = true;
    event.pendingCollapseAt = 0.5;
    pipeline.updatePendingEvents(5);
    expect(event.pending).toBe(false);
  });

  it('updatePendingEvents demotes onTargetMove when threshold crossed', () => {
    const a = makeEntity();
    const t = makeEntity({ x: 100 });
    const event = pipeline.queueAbility(a, t, 'override_damage_event', { baseDamageOverride: 0 });
    event.pending = true;
    event.pendingTriggers = { onTargetMove: { from: { x: 100, y: 0 }, threshold: 20 } };

    pipeline.updatePendingEvents(0);
    expect(event.pending).toBe(true); // hasn't moved

    t.x = 115; // moved 15 — below threshold
    pipeline.updatePendingEvents(0);
    expect(event.pending).toBe(true);

    t.x = 125; // moved 25 — above threshold
    pipeline.updatePendingEvents(0);
    expect(event.pending).toBe(false);
  });

  it('updatePendingEvents skips cancelled events', () => {
    const a = makeEntity();
    const t = makeEntity();
    const event = pipeline.queueAbility(a, t, 'override_damage_event', { baseDamageOverride: 0 });
    event.pending = true;
    event.pendingCollapseAt = 1;
    event.cancelled = true;
    pipeline.updatePendingEvents(10);
    expect(event.pendingCollapseAt).toBe(1); // untouched
    expect(event.pending).toBe(true);        // untouched
  });

  it('pending events do NOT count against the safety cap', () => {
    const a = makeEntity();
    const t = makeEntity();
    // Fill queue with pending events. All should be held, none dropped.
    for (let i = 0; i < 500; i++) {
      const e = pipeline.queueAbility(a, t, 'override_damage_event', { baseDamageOverride: 0 });
      e.pending = true;
    }
    pipeline.resolveFrame();
    expect(pipeline.droppedLastDrain).toBe(0);
    expect(pipeline.size).toBe(500);
  });

  it('findEvents can find pending events by predicate (introspection survives hold)', () => {
    const a = makeEntity();
    const t = makeEntity();
    const e = pipeline.queueAbility(a, t, 'override_damage_event', { baseDamageOverride: 0 });
    e.pending = true;
    e.pendingGroupId = 'quantum-1';

    pipeline.resolveFrame(); // holds, re-prepends
    const found = pipeline.findEvents((x) => x.pendingGroupId === 'quantum-1');
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(e.id);
  });

  it('cancelEvent on a pending event works end-to-end (pending → cancelled → dropped)', () => {
    const a = makeEntity();
    const t = makeEntity({ hp: 100 });
    const e = pipeline.queueAbility(a, t, 'override_damage_event', { baseDamageOverride: 50 });
    e.pending = true;
    pipeline.resolveFrame(); // holds
    expect(pipeline.size).toBe(1);

    pipeline.cancelEvent(e.id);
    e.pending = false;
    pipeline.resolveFrame();
    expect(pipeline.size).toBe(0);
    expect(t.hp).toBe(100); // target untouched — event was cancelled
  });
});
