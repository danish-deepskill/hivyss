import { describe, it, expect } from 'vitest';
import {
  SELECTORS,
  lookupSelector,
  laneDistance,
  runSelectorInRange,
  DEFAULT_COMBATANT_FILTER,
  type SelectorEntity,
} from '../../src/systems/Targeting';
import type { ComponentTag, Side, AbilityDef } from '../../src/types';

// Plain-object fixtures — no Phaser, no Unit construction. Selectors
// are pure functions over readonly arrays, so a literal shape that
// satisfies SelectorEntity is enough.

const ent = (
  id: number,
  x: number,
  opts: {
    side?: Side;
    hp?: number;
    maxHp?: number;
    dead?: boolean;
    components?: ComponentTag[];
  } = {},
): SelectorEntity => ({
  id,
  x,
  y: 0,
  dead: opts.dead ?? false,
  side: opts.side,
  hp: opts.hp,
  maxHp: opts.maxHp,
  components: new Set(opts.components ?? ['HasAI', 'HasHP', 'IsTargetable', 'HasAllegiance']),
});

// Convenient defaults: a caster at x=100, an ally at caster's side, an
// enemy on the other side.
const caster = (x = 100) => ent(0, x, { side: 'player', hp: 100, maxHp: 100 });

// ------------------------------------------------------------------
// laneDistance helper
// ------------------------------------------------------------------

describe('laneDistance', () => {
  it('returns absolute X delta', () => {
    expect(laneDistance(ent(1, 0), ent(2, 50))).toBe(50);
    expect(laneDistance(ent(1, 100), ent(2, 30))).toBe(70);
    expect(laneDistance(ent(1, 50), ent(2, 50))).toBe(0);
  });

  it('ignores Y (lane-based combat)', () => {
    const a = { ...ent(1, 0), y: 0 };
    const b = { ...ent(2, 0), y: 999 };
    expect(laneDistance(a, b)).toBe(0);
  });
});

// ------------------------------------------------------------------
// nearest_enemy_in_range
// ------------------------------------------------------------------

describe('nearest_enemy_in_range', () => {
  const sel = SELECTORS['nearest_enemy_in_range'];

  it('returns [] when there are no candidates', () => {
    expect(sel(caster(), {}, [])).toEqual([]);
  });

  it('returns [] when there are no enemies in the candidate set', () => {
    const c = caster();
    const allies = [
      ent(1, 120, { side: 'player' }),
      ent(2, 140, { side: 'player' }),
    ];
    expect(sel(c, {}, allies)).toEqual([]);
  });

  it('returns the single nearest enemy', () => {
    const c = caster();
    const enemies = [
      ent(1, 200, { side: 'enemy' }),
      ent(2, 130, { side: 'enemy' }),
      ent(3, 160, { side: 'enemy' }),
    ];
    const got = sel(c, {}, enemies);
    expect(got.length).toBe(1);
    expect(got[0].id).toBe(2);
  });

  it('honors count parameter (returns up to N nearest)', () => {
    const c = caster();
    const enemies = [
      ent(1, 200, { side: 'enemy' }),
      ent(2, 130, { side: 'enemy' }),
      ent(3, 160, { side: 'enemy' }),
      ent(4, 110, { side: 'enemy' }),
    ];
    const got = sel(c, { count: 2 }, enemies);
    expect(got.map(e => e.id)).toEqual([4, 2]);
  });

  it('excludes the caster even if opposite-side logic would admit it', () => {
    const c = caster();
    const enemies = [c, ent(1, 150, { side: 'enemy' })];
    const got = sel(c, {}, enemies);
    expect(got.map(e => e.id)).toEqual([1]);
  });

  it('excludes dead entities', () => {
    const c = caster();
    const enemies = [
      ent(1, 110, { side: 'enemy', dead: true }),
      ent(2, 150, { side: 'enemy' }),
    ];
    const got = sel(c, {}, enemies);
    expect(got.map(e => e.id)).toEqual([2]);
  });

  it('excludes neutral (no side) entities from enemy selection', () => {
    const c = caster();
    const mixed = [
      ent(1, 110, { side: undefined }),          // neutral — skipped
      ent(2, 130, { side: 'enemy' }),
    ];
    const got = sel(c, {}, mixed);
    expect(got.map(e => e.id)).toEqual([2]);
  });

  it('default component filter excludes projectile-shaped entities (no HasAI)', () => {
    const c = caster();
    const mixed = [
      // Projectile-shape: has HasTrajectory but no HasAI — must NOT be returned.
      ent(1, 110, { side: 'enemy', components: ['HasTrajectory', 'IsTargetable'] }),
      ent(2, 150, { side: 'enemy', components: ['HasAI', 'HasHP'] }),
    ];
    const got = sel(c, {}, mixed);
    expect(got.map(e => e.id)).toEqual([2]);
  });

  it('explicit componentFilter override lets non-AI entities through', () => {
    const c = caster();
    const mixed = [
      ent(1, 110, { side: 'enemy', components: ['HasTrajectory', 'IsTargetable'] }),
      ent(2, 150, { side: 'enemy', components: ['HasAI', 'HasHP'] }),
    ];
    const got = sel(c, { componentFilter: ['IsTargetable'] }, mixed);
    // Both satisfy IsTargetable; nearest wins.
    expect(got.map(e => e.id)).toEqual([1]);
  });
});

// ------------------------------------------------------------------
// nearest_enemies_in_range (multi-target variant)
// ------------------------------------------------------------------

describe('nearest_enemies_in_range', () => {
  const sel = SELECTORS['nearest_enemies_in_range'];

  it('defaults to count=3', () => {
    const c = caster();
    const enemies = [
      ent(1, 110, { side: 'enemy' }),
      ent(2, 130, { side: 'enemy' }),
      ent(3, 150, { side: 'enemy' }),
      ent(4, 170, { side: 'enemy' }),
      ent(5, 200, { side: 'enemy' }),
    ];
    const got = sel(c, {}, enemies);
    expect(got.map(e => e.id)).toEqual([1, 2, 3]);
  });

  it('count=N returns N nearest enemies', () => {
    const c = caster();
    const enemies = [
      ent(1, 110, { side: 'enemy' }),
      ent(2, 130, { side: 'enemy' }),
    ];
    expect(sel(c, { count: 1 }, enemies).map(e => e.id)).toEqual([1]);
    expect(sel(c, { count: 5 }, enemies).map(e => e.id)).toEqual([1, 2]);
  });
});

// ------------------------------------------------------------------
// all_enemies_in_range
// ------------------------------------------------------------------

describe('all_enemies_in_range', () => {
  const sel = SELECTORS['all_enemies_in_range'];

  it('returns every living enemy in the candidate list', () => {
    const c = caster();
    const list = [
      ent(1, 110, { side: 'enemy' }),
      ent(2, 130, { side: 'player' }), // ally, skipped
      ent(3, 150, { side: 'enemy', dead: true }), // dead, skipped
      ent(4, 170, { side: 'enemy' }),
    ];
    const got = sel(c, {}, list).map(e => e.id).sort();
    expect(got).toEqual([1, 4]);
  });

  it('returns [] on an empty candidate list', () => {
    expect(sel(caster(), {}, [])).toEqual([]);
  });
});

// ------------------------------------------------------------------
// nearest_ally_in_range
// ------------------------------------------------------------------

describe('nearest_ally_in_range', () => {
  const sel = SELECTORS['nearest_ally_in_range'];

  it('returns the nearest same-side ally (not the caster)', () => {
    const c = caster();
    const list = [
      c,
      ent(1, 200, { side: 'player' }),
      ent(2, 130, { side: 'player' }),
      ent(3, 120, { side: 'enemy' }),
    ];
    const got = sel(c, {}, list);
    expect(got.map(e => e.id)).toEqual([2]);
  });

  it('returns [] when no allies are around', () => {
    const c = caster();
    const enemies = [ent(1, 110, { side: 'enemy' })];
    expect(sel(c, {}, enemies)).toEqual([]);
  });
});

// ------------------------------------------------------------------
// all_allies_in_range (used by passive auras)
// ------------------------------------------------------------------

describe('all_allies_in_range', () => {
  const sel = SELECTORS['all_allies_in_range'];

  it('returns every living same-side ally except the caster', () => {
    const c = caster();
    const list = [
      c,
      ent(1, 120, { side: 'player' }),
      ent(2, 130, { side: 'player', dead: true }), // dead ally, skipped
      ent(3, 140, { side: 'player' }),
      ent(4, 150, { side: 'enemy' }),               // enemy, skipped
    ];
    const got = sel(c, {}, list).map(e => e.id).sort();
    expect(got).toEqual([1, 3]);
  });
});

// ------------------------------------------------------------------
// lowest_hp_ally_in_range (Mendwing heal target)
// ------------------------------------------------------------------

describe('lowest_hp_ally_in_range', () => {
  const sel = SELECTORS['lowest_hp_ally_in_range'];

  it('returns the wounded ally with the lowest HP fraction', () => {
    const c = caster();
    const allies = [
      ent(1, 120, { side: 'player', hp: 100, maxHp: 100 }), // full, skipped
      ent(2, 130, { side: 'player', hp: 50,  maxHp: 100 }), // 50%
      ent(3, 140, { side: 'player', hp: 10,  maxHp: 100 }), // 10% — winner
      ent(4, 150, { side: 'player', hp: 90,  maxHp: 100 }), // 90%
    ];
    const got = sel(c, {}, allies);
    expect(got.map(e => e.id)).toEqual([3]);
  });

  it('excludes allies at full HP', () => {
    const c = caster();
    const allies = [
      ent(1, 120, { side: 'player', hp: 100, maxHp: 100 }),
      ent(2, 130, { side: 'player', hp: 100, maxHp: 100 }),
    ];
    expect(sel(c, {}, allies)).toEqual([]);
  });

  it('compares by HP FRACTION, not absolute HP', () => {
    const c = caster();
    const allies = [
      // 200/1000 = 20% — lower fraction, wins
      ent(1, 120, { side: 'player', hp: 200, maxHp: 1000 }),
      // 50/100 = 50%
      ent(2, 130, { side: 'player', hp: 50,  maxHp: 100 }),
    ];
    const got = sel(c, {}, allies);
    expect(got.map(e => e.id)).toEqual([1]);
  });

  it('ignores allies without hp/maxHp fields (non-healable entities)', () => {
    const c = caster();
    const allies = [
      ent(1, 120, { side: 'player' }), // no hp fields — skipped
      ent(2, 130, { side: 'player', hp: 10, maxHp: 100 }),
    ];
    const got = sel(c, {}, allies);
    expect(got.map(e => e.id)).toEqual([2]);
  });

  it('count=N returns N lowest-HP wounded allies', () => {
    const c = caster();
    const allies = [
      ent(1, 120, { side: 'player', hp: 10, maxHp: 100 }),
      ent(2, 130, { side: 'player', hp: 50, maxHp: 100 }),
      ent(3, 140, { side: 'player', hp: 30, maxHp: 100 }),
    ];
    const got = sel(c, { count: 2 }, allies).map(e => e.id);
    expect(got).toEqual([1, 3]);
  });
});

// ------------------------------------------------------------------
// self
// ------------------------------------------------------------------

describe('self', () => {
  const sel = SELECTORS['self'];

  it('returns the caster', () => {
    const c = caster();
    expect(sel(c, {}, [])).toEqual([c]);
  });

  it('returns [] when the caster is dead', () => {
    const c = { ...caster(), dead: true };
    expect(sel(c, {}, [])).toEqual([]);
  });
});

// ------------------------------------------------------------------
// no_targeting — sentinel for wrapper abilities (Phase 4)
// ------------------------------------------------------------------

describe('no_targeting', () => {
  const sel = SELECTORS['no_targeting'];

  it('always returns []', () => {
    const c = caster();
    const enemies = [ent(1, 110, { side: 'enemy' }), ent(2, 130, { side: 'enemy' })];
    expect(sel(c, {}, enemies)).toEqual([]);
    expect(sel(c, { count: 5 }, enemies)).toEqual([]);
    expect(sel(c, {}, [])).toEqual([]);
  });
});

// ------------------------------------------------------------------
// lookupSelector + registry invariants
// ------------------------------------------------------------------

describe('lookupSelector', () => {
  it('returns the selector function for a registered name', () => {
    const fn = lookupSelector('nearest_enemy_in_range');
    expect(typeof fn).toBe('function');
    expect(fn).toBe(SELECTORS['nearest_enemy_in_range']);
  });

  it('throws on unknown selector names', () => {
    expect(() => lookupSelector('nonexistent_selector')).toThrow();
  });
});

describe('SELECTORS registry', () => {
  it('includes every name the plan calls out', () => {
    for (const name of [
      'self',
      'no_targeting',
      'nearest_enemy_in_range',
      'nearest_enemies_in_range',
      'all_enemies_in_range',
      'nearest_ally_in_range',
      'all_allies_in_range',
      'lowest_hp_ally_in_range',
      'nearest_target_in_range',
      'nearest_targets_in_range',
    ]) {
      expect(SELECTORS[name]).toBeDefined();
    }
  });

  it('DEFAULT_COMBATANT_FILTER gates on HasAI', () => {
    expect(DEFAULT_COMBATANT_FILTER).toContain('HasAI');
  });
});

// ------------------------------------------------------------------
// Phase 6 follow-up #2 — base-inclusive selector variants
// ------------------------------------------------------------------

describe('nearest_target_in_range / nearest_targets_in_range — Phase 6 follow-up #2', () => {
  // Helper: a base-shaped entity (HasHP + IsTargetable + HasAllegiance,
  // NO HasAI). Mirrors what BaseEntity exposes for selector queries.
  const baseEnt = (id: number, x: number, side: Side): SelectorEntity => ({
    id,
    x,
    y: 0,
    dead: false,
    side,
    hp: 5000,
    maxHp: 5000,
    components: new Set<ComponentTag>(['HasHP', 'IsTargetable', 'HasAllegiance']),
  });

  it('finds a base entity (HasAI excluded but IsTargetable present)', () => {
    const c = caster(100);
    const enemyBase = baseEnt(99, 920, 'enemy');
    const result = SELECTORS['nearest_target_in_range'](c, {}, [enemyBase]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(enemyBase);
  });

  it('the legacy nearest_enemy_in_range does NOT find the same base (HasAI gate)', () => {
    const c = caster(100);
    const enemyBase = baseEnt(99, 920, 'enemy');
    // Default filter is ['HasAI'] — base is excluded.
    const result = SELECTORS['nearest_enemy_in_range'](c, {}, [enemyBase]);
    expect(result).toHaveLength(0);
  });

  it('returns both unit foes and enemy bases mixed in candidate list', () => {
    const c = caster(100);
    const enemyUnit = ent(1, 200, { side: 'enemy', components: ['HasAI', 'HasHP', 'IsTargetable', 'HasAllegiance'] });
    const enemyBase = baseEnt(99, 920, 'enemy');
    const sorted = SELECTORS['nearest_targets_in_range'](c, { count: 5 }, [enemyUnit, enemyBase]);
    expect(sorted).toHaveLength(2);
    // Closer enemy first
    expect(sorted[0]).toBe(enemyUnit);
    expect(sorted[1]).toBe(enemyBase);
  });

  it('respects allegiance — own-side base is filtered out for enemy-targeting selector', () => {
    const c = caster(100);
    const ownBase = baseEnt(99, 50, 'player'); // same side as caster
    const result = SELECTORS['nearest_target_in_range'](c, {}, [ownBase]);
    expect(result).toHaveLength(0);
  });

  it('skips dead bases', () => {
    const c = caster(100);
    const dead = { ...baseEnt(99, 920, 'enemy'), dead: true };
    const result = SELECTORS['nearest_target_in_range'](c, {}, [dead]);
    expect(result).toHaveLength(0);
  });

  it('count parameter caps results', () => {
    const c = caster(100);
    const e1 = baseEnt(1, 200, 'enemy');
    const e2 = baseEnt(2, 300, 'enemy');
    const e3 = baseEnt(3, 400, 'enemy');
    const result = SELECTORS['nearest_targets_in_range'](c, { count: 2 }, [e1, e2, e3]);
    expect(result).toHaveLength(2);
  });

  it('componentFilter override still works (caller-provided)', () => {
    const c = caster(100);
    const enemyBase = baseEnt(99, 920, 'enemy');
    // Override to require HasAI — base no longer qualifies.
    const result = SELECTORS['nearest_target_in_range'](
      c,
      { componentFilter: ['HasAI'] },
      [enemyBase],
    );
    expect(result).toHaveLength(0);
  });
});

// ------------------------------------------------------------------
// runSelectorInRange — Phase 8 F5 IP-5 production entry point
// ------------------------------------------------------------------

describe('runSelectorInRange — Phase 8 F5 IP-5 selector wrapper', () => {
  /**
   * Minimal AbilityDef fixture. We only set the fields
   * runSelectorInRange reads: `targeting`, `range`, `targetCount`.
   * Every other field is undefined/unused by the helper and
   * stubbed with sensible defaults for the type check.
   */
  function makeAbility(opts: {
    targeting: string;
    range?: number;
    targetCount?: number;
  }): AbilityDef {
    return {
      name: 'test_ability',
      category: 'damage',
      targeting: opts.targeting,
      range: opts.range,
      targetCount: opts.targetCount ?? 1,
    } as unknown as AbilityDef;
  }

  it('returns a single wounded in-range ally for lowest_hp_ally_in_range + range 90', () => {
    // F13=B Mendwing layout: Mendwing at x=170, wounded ally at
    // x=100 (distance 70, in range), fresh ally at x=240 (distance
    // 70, in range but full HP so filtered out by selector).
    const mendwing = ent(0, 170, { side: 'player', hp: 100, maxHp: 100 });
    const wounded = ent(1, 100, { side: 'player', hp: 30, maxHp: 100 });
    const fresh = ent(2, 240, { side: 'player', hp: 100, maxHp: 100 });
    const ability = makeAbility({ targeting: 'lowest_hp_ally_in_range', range: 90, targetCount: 1 });

    const result = runSelectorInRange(
      'lowest_hp_ally_in_range',
      mendwing,
      ability,
      [mendwing, wounded, fresh],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(wounded);
  });

  it('filters out-of-range candidates before passing to the selector', () => {
    // Mendwing at x=170, wounded ally at x=50 (distance 120, OUT of
    // range 90). The selector should see an empty candidate list
    // and return empty.
    const mendwing = ent(0, 170, { side: 'player', hp: 100, maxHp: 100 });
    const farWounded = ent(1, 50, { side: 'player', hp: 30, maxHp: 100 });
    const ability = makeAbility({ targeting: 'lowest_hp_ally_in_range', range: 90 });

    const result = runSelectorInRange(
      'lowest_hp_ally_in_range',
      mendwing,
      ability,
      [mendwing, farWounded],
    );

    expect(result).toHaveLength(0);
  });

  it('boundary: candidate at exactly 89px is IN range, 90px is OUT (mirrors item 12 boundary pin)', () => {
    // `distance < ability.range` is strict less-than. Candidate at
    // exactly the range value is OUT. Candidate at range-1 is IN.
    // This mirrors Item 12's 113/114 Wardling boundary pin.
    const mendwing = ent(0, 100, { side: 'player', hp: 100, maxHp: 100 });
    const at89 = ent(1, 189, { side: 'player', hp: 30, maxHp: 100 });
    const at90 = ent(2, 190, { side: 'player', hp: 20, maxHp: 100 });
    const ability = makeAbility({ targeting: 'lowest_hp_ally_in_range', range: 90 });

    const result = runSelectorInRange(
      'lowest_hp_ally_in_range',
      mendwing,
      ability,
      [mendwing, at89, at90],
    );

    // The 89px ally is in range AND more wounded than the 90px one
    // (but 90px is out-of-range so doesn't participate). Selector
    // returns only the 89px wounded ally.
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(at89);
  });

  it('boundary: lower-hp ally at 90px (OUT) loses to higher-hp ally at 89px (IN)', () => {
    // Specifically pins the < vs <= question. The ally at exactly
    // 90px is the LOWEST HP (hp=5), but it's out of range. The ally
    // at 89px has hp=50. If the helper incorrectly uses `<=`, the
    // at-90px ally would be returned; correct `<` returns at-89px.
    const mendwing = ent(0, 100, { side: 'player', hp: 100, maxHp: 100 });
    const at89 = ent(1, 189, { side: 'player', hp: 50, maxHp: 100 });
    const at90CriticallyWounded = ent(2, 190, { side: 'player', hp: 5, maxHp: 100 });
    const ability = makeAbility({ targeting: 'lowest_hp_ally_in_range', range: 90 });

    const result = runSelectorInRange(
      'lowest_hp_ally_in_range',
      mendwing,
      ability,
      [mendwing, at89, at90CriticallyWounded],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(at89);
  });

  it('empty candidate list returns empty result', () => {
    const mendwing = ent(0, 170, { side: 'player', hp: 100, maxHp: 100 });
    const ability = makeAbility({ targeting: 'lowest_hp_ally_in_range', range: 90 });

    const result = runSelectorInRange('lowest_hp_ally_in_range', mendwing, ability, []);
    expect(result).toHaveLength(0);
  });

  it('respects ability.targetCount — returns multiple targets for multi-target selectors', () => {
    // Forward pin for Stage 5 item 15 Bombardier death trigger
    // (`death_bomb` with targetCount: 5, targeting:
    // 'all_enemies_in_range'). Verify the count forwards correctly
    // into SelectorParams.
    const bombardier = ent(0, 100, { side: 'player', hp: 0, maxHp: 100, dead: true });
    const e1 = ent(1, 120, { side: 'enemy', hp: 100, maxHp: 100 });
    const e2 = ent(2, 130, { side: 'enemy', hp: 100, maxHp: 100 });
    const e3 = ent(3, 140, { side: 'enemy', hp: 100, maxHp: 100 });
    const ability = makeAbility({ targeting: 'all_enemies_in_range', range: 50, targetCount: 5 });

    const result = runSelectorInRange(
      'all_enemies_in_range',
      bombardier,
      ability,
      [bombardier, e1, e2, e3],
    );

    // All 3 enemies in range (distance 20/30/40 < 50). Count 5 >=
    // available; all 3 returned.
    expect(result).toHaveLength(3);
  });

  it('undefined ability.range falls through to Infinity (no range filter)', () => {
    // Defensive branch — future utility abilities might omit range.
    // Helper should treat missing range as "no range limit".
    const mendwing = ent(0, 100, { side: 'player', hp: 100, maxHp: 100 });
    const farWounded = ent(1, 1000, { side: 'player', hp: 30, maxHp: 100 });
    const ability = makeAbility({ targeting: 'lowest_hp_ally_in_range' });
    // range is undefined

    const result = runSelectorInRange(
      'lowest_hp_ally_in_range',
      mendwing,
      ability,
      [mendwing, farWounded],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(farWounded);
  });

  it('throws on unknown selector name (propagates lookupSelector throw)', () => {
    const caster = ent(0, 100, { side: 'player' });
    const ability = makeAbility({ targeting: '__nonexistent__' });

    expect(() =>
      runSelectorInRange('__nonexistent__', caster, ability, [caster]),
    ).toThrow();
  });
});
