# Combat Rewrite — Implementation Plan

**Status:** Active. Doc 1 ([COMBAT_REWRITE_DECISIONS.md](COMBAT_REWRITE_DECISIONS.md)) is locked as of 2026-04-12. This plan is built against those locked decisions.
**Phase ordering principle:** Minimize churn (option B). Validate the system on simple units before tackling complex ones. Foundation work is invisible to the player; payoff comes in late phases. Perfectionist tax is real and accepted.
**Audience:** Executor agent. Each phase is a self-contained work unit with explicit exit criteria.

## How to use this doc

Phases are sequential. Each phase:
- States its purpose, what it ships, what's behind flags, and its exit criteria.
- Lists deliverables granular enough for one executor session to pick up and start.
- Names tests that must pass before the phase is "done."
- Identifies what's reversible and what isn't.

**Do not start a phase until the prior phase's exit criteria are met.** Skipping ahead breaks the dependency chain and the strangler fig invariants.

If a phase reveals an architectural gap, **stop and report — do not patch.** The orchestrator decides whether to extend the architecture (sub-phase) or restructure. Patches in this plan are how rewrites die.

## Locked decisions reference

| # | Decision | Locked answer |
|---|---|---|
| 1 | Entity model | ECS-lite (components-as-data, NOT full ECS), `HasModifiers` first-class |
| 2 | Coexistence | A+B hybrid: layer flags 0–5, unit-by-unit migration; **attacker owns the pipeline** at the boundary |
| 3 | SpatialIndex | Sweep-and-prune over X, **one index with route filter at query time** |
| 4 | Pipeline coexistence | Wrapper. `hitUnit` → `queueAbility('legacy_basic_attack', ...)`. Precondition: Layers 1–3 scaffolded first. |
| 5 | Targeting | Named selector library, references inside ability data |
| 6 | Test strategy | Unit → integration → property; pure-function principle |

---

## Layer dependency graph

```
Phase 1 ────────────────────────────────────────────
│
│   Layer 0:   SpatialIndex
│   Layer 0.5: ECS-lite component system + WorldEntity
│
└── Exit: legacy combat still runs unchanged. Units are now WorldEntities with components.
    Spatial queries work. Nothing else changed.

Phase 2 ────────────────────────────────────────────
│
│   Layer 1: Attributes (resistance, penetration on UnitDef)
│   Layer 2: Damage Types config (9 types, categories, default effects)
│
└── Exit: every unit has resistance config. Damage type lookup works.
    Nothing reads these values yet — pure data layer.

Phase 3 ────────────────────────────────────────────
│
│   Layer 3: Abilities (data registry, tier tables)
│   Layer 3.5: Targeting (named selector library)
│
└── Exit: ability registry populated for every legacy unit's basic attack.
    Targeting selectors exist for every legacy attack pattern.
    No unit uses them yet.

Phase 4 ────────────────────────────────────────────
│
│   Pipeline: 7-phase event-driven queue (queueAbility, resolveFrame)
│   Wrapper:  hitUnit → queueAbility('legacy_basic_attack', ...)
│
└── Exit: every legacy attack flows through the queue.
    Damage numbers identical to legacy. Visible behavior identical.
    THIS IS THE VALIDATION MOMENT for the pipeline.

Phase 5 ────────────────────────────────────────────
│
│   Layer 4: Effects (lifecycle hooks, stacking)
│   Layer 5: Modifiers (sources, stacking rules, per-stat caps)
│   Layer 6: Resources (charges, ammo, mana)
│   Cross-cutting: Pending events (first-class), Persistent vs battle-scope state
│
└── Exit: all primitives exist as APIs. No unit uses them yet.

Phase 6 ────────────────────────────────────────────
│
│   Unit migration tier 1 — simple units
│   Grunt, Mandible, Needler, Pricker, Hardshell, Domeback
│
└── Exit: 6 simplest units run fully on the new system.

Phase 7 ────────────────────────────────────────────
│
│   Unit migration tier 2 — medium units
│   Skitterling, Mendwing, Cinderfly, Longeye
│
└── Exit: 4 effect-using units run fully on the new system.

Phase 8 ────────────────────────────────────────────
│
│   Unit migration tier 3 — complex units
│   Bombardier, Centurion, Wardling, Stormfly, Bashguard, Ravager, Legionnaire
│
└── Exit: all units on the new system. Nothing on legacy.

Phase 9 ────────────────────────────────────────────
│
│   Legacy removal: delete hitUnit, remove flags, delete dead code
│
└── Exit: codebase clean. Single combat path.

Phase 10 ────────────────────────────────────────────
│
│   Balance v1: tune numbers against the new pipeline
│
└── Exit: combat feels balanced against existing waves.
    Note: this is v1 — final balance comes after AI plan ships.
```

---

## Phase 1 — Foundation

**Goal:** Build the entity model and spatial index. No combat changes.

**Why first:** Every subsequent phase depends on entities being queryable in space and addressable by component. Decision 1 (very low reversibility) lands here — get this wrong and everything downstream is wrong.

### Deliverables

1. **`systems/SpatialIndex.ts`** — sweep-and-prune over X with route filter.
   - `index.add(entity)`, `index.remove(entity)`, `index.update(entity)` (call when entity moves).
   - `index.query({ x, range, routes?, side?, components? })` returns entities matching all filters.
   - Internal: sorted-array-by-X with insertion sort (O(n) worst, O(1) amortized for small movements).
   - **Pure function helpers:** `findOverlapsInRange(sortedArray, x, range)` — testable without instantiating the index.

2. **`systems/EntityComponents.ts`** — component tag definitions and the `hasComponent` query helper.
   - Component tags as a const enum or string union: `HasHP`, `HasResistance`, `IsTargetable`, `HasOnDeath`, `HasZoneShape`, `HasAI`, `HasTrajectory`, `HasAllegiance`, `HasSourceAttribution`, `HasCapacityCost`, `HasModifiers`.
   - `entity.components: Set<ComponentTag>` field added to a base `WorldEntity` interface.
   - Query helper: `entitiesWithComponent(entities, tag)` — pure function over plain arrays.

3. **`types.ts` extension** — add `WorldEntity` interface that `Unit` extends.
   - `WorldEntity { id, x, y, dead, components: Set<ComponentTag> }`
   - `Unit extends WorldEntity` with all existing Unit fields
   - **No behavior changes** — Unit's existing methods stay where they are.

4. **`UnitPool` integration** — when a Unit is allocated, populate its `components` set.
   - Default Unit components: `HasHP`, `HasResistance`, `IsTargetable`, `HasOnDeath`, `HasAI`, `HasAllegiance`, `HasSourceAttribution`, `HasCapacityCost`, `HasModifiers`.
   - **Movement clarification (per executor's Doc 2 observation):** Unit movement is `HasAI`'s default behavior (lane-follow at `def.spd`). There is no separate `HasMovement` component. Override via custom AI behavior in future units. Document this in `EntityComponents.ts` JSDoc.

5. **Spatial index integration into Unit.update()** — when a unit moves, call `spatialIndex.update(unit)`. When spawned, `add`. When dead, `remove`.

6. **Throwaway `TargetDummy` non-Unit entity (validation only — deleted at phase exit).**
   - Build a minimal `TargetDummy` WorldEntity with a deliberately different component set: `HasHP + IsTargetable` only. **No** `HasAI`, **no** `HasAllegiance`, **no** `HasCapacityCost`.
   - Spawn one via debug console. Verify:
     - Spatial queries return it when filtered by `HasHP` or `IsTargetable`.
     - Selectors that require `HasAI` (e.g. `'nearest_enemy_in_range'`) **do not** return it.
     - It does not move (no AI tick).
     - It does not count toward capacity.
     - It can be damaged via legacy `hitUnit` directly (uses `IsTargetable` only, no AI dependency).
   - **Why this exists:** the component model is architected for non-Unit entities (Pylon, Zone, Projectile, Trail) but the rewrite only migrates Units. Without this validation, the component query API could be implicitly Unit-shaped in some subtle way and we wouldn't notice until the first post-rewrite Pylon implementation. ~1 hour of work, major de-risk of Decision 1.
   - **Delete the TargetDummy + its registration after Phase 1 exits.** It is validation scaffolding, not a feature.

### Exit criteria

- All existing battles run unchanged. Same damage, same victories, same wave clears.
- Spatial index has unit tests for: range query correctness, route filter correctness, edge cases (empty index, single entity, entity at exact range boundary).
- Component query helper has unit tests for: single-component query, multi-component AND query, empty result.
- Manual smoke test: run a battle, console-log `spatialIndex.query({ x: player.x, range: 80 })` mid-battle and verify it returns the expected enemies.
- **TargetDummy validation passes** (deliverable 6) — non-Unit entity is queryable, not movable, not capacity-counted, not selectable by AI-requiring selectors.
- TargetDummy + its registration deleted before phase exit.
- `tsc --noEmit` passes.

### Tests

- **Pure function tests (priority — Capacity pattern):**
  - `SpatialIndex.test.ts` — feed plain arrays of `{ id, x, side, route, components }` objects, assert query results. No Phaser instantiation.
  - `EntityComponents.test.ts` — feed plain arrays of mock entities, assert `entitiesWithComponent` returns correct subset.
- **Integration tests:** none yet — combat behavior unchanged, integration tests would just retest legacy behavior.

### Reversibility

**Very low.** This is Decision 1 made concrete. If the component model is wrong, half of subsequent phases need rework. Mitigation: do not start Phase 2 until Phase 1's spatial index AND component query helpers have green tests AND a working manual smoke test.

### Effort estimate

3–5 executor sessions.

---

## Phase 2 — Static layers (Attributes + Damage Types)

**Goal:** Lay down the static data layers. No code reads them yet.

**Why second:** Layers 3, 4, 5 all reference damage types and resistance tiers. They have to exist first as data before anything can be built on top.

### Deliverables

1. **`config/combat/damageTypes.ts`** — the 9 types.
   ```ts
   export const DAMAGE_TYPES = {
     blunt:    { category: 'physical',  defaultEffect: 'knockback' },
     sharp:    { category: 'physical',  defaultEffect: 'pierce' },
     heat:     { category: 'elemental', defaultEffect: 'burn' },
     cold:     { category: 'elemental', defaultEffect: 'slow' },
     toxic:    { category: 'elemental', defaultEffect: 'poison' },
     electric: { category: 'elemental', defaultEffect: 'stun' },
     psychic:  { category: 'dark',      defaultEffect: 'fear' },
     void:     { category: 'dark',      defaultEffect: 'armor_bypass' },
     holy:     { category: 'dark',      defaultEffect: 'cleanse' },
   } as const;
   export type DamageType = keyof typeof DAMAGE_TYPES;
   ```

2. **`config/combat/resistances.ts`** — the 7-tier table and `shiftTier` helper.
   ```ts
   export const RESISTANCE_TIERS = ['weakest','weaker','weak','normal','strong','stronger','strongest'] as const;
   export type ResistanceTier = typeof RESISTANCE_TIERS[number];
   export function shiftTier(tier: ResistanceTier, delta: number): ResistanceTier { ... }
   ```
   - **Pure function:** `shiftTier('strong', -1)` → `'normal'`. Clamped to ends. Testable in isolation.

3. **`UnitDef` extension** — add optional `resistance` and `penetration` fields. All existing units default to `{}` (everything `'normal'`, no penetration).
   ```ts
   interface UnitDef {
     // ...existing
     resistance?: Partial<Record<DamageType, ResistanceTier>>;
     penetration?: Partial<Record<DamageType, number>>;
   }
   ```

4. **`Unit` runtime fields** — add `unit.baseResistance` (immutable copy of def.resistance) and `unit.resistance` (mutable, modified by effects later). Initialized in Unit.init().

5. **Initial resistance assignments for existing units** — small, conservative pass. Most units stay all-normal. Only obvious cases get tier shifts:
   - Legionnaire: `{ blunt: 'strong', sharp: 'strong', heat: 'weak' }`
   - Hardshell: `{ blunt: 'strong' }`
   - Cinderfly: `{ heat: 'strong', cold: 'weak' }`
   - This is a balance call — keep it minimal in Phase 2. Most tuning happens in Phase 10.

### Exit criteria

- `tsc --noEmit` passes.
- `shiftTier` has unit tests for: shift up/down/zero, clamping at both ends.
- All units have `resistance` field populated (even if `{}`).
- Existing battles still run unchanged — no code reads resistance yet.

### Tests

- **Pure function tests:** `shiftTier.test.ts`, `damageTypes.test.ts` (verify category groupings).
- **No integration tests** — nothing reads this data yet.

### Reversibility

**High.** Pure data. Renaming damage types or adjusting tiers is mechanical.

### Effort estimate

2 executor sessions.

---

## Phase 3 — Ability data + targeting

**Goal:** Build the ability registry and targeting library. No unit uses them yet.

**Why third:** Layer 4 references abilities. Targeting is needed by every ability. Both must exist before pipeline scaffolding in Phase 4.

### Deliverables

1. **`config/combat/abilities/` directory** with one file per damage type:
   - `sharp.ts`, `blunt.ts`, `heat.ts`, `cold.ts`, `toxic.ts`, `electric.ts`, `psychic.ts`, `void.ts`, `holy.ts`, `utility.ts`
   - Each file exports a `Record<string, AbilityDef>` with the abilities of that type.

2. **`AbilityDef` interface in `types.ts`:**
   ```ts
   interface AbilityDef {
     name: string;
     category: 'damage' | 'heal' | 'utility' | 'passive';
     dmgType?: DamageType;
     targeting: string;  // selector reference (Decision 5)
     appliesEffects?: string[];
     tiers?: Partial<Record<ResistanceTier, AbilityTierStats>>;
     // ...etc
   }
   ```

3. **Initial ability population** — define abilities matching every legacy unit's current behavior:
   - `'jaw_strike'` (sharp) — Mandible, Grunt default
   - `'pricker_jab'` (sharp) — Pricker
   - `'needle_shot'` (sharp ranged) — Needler, Longeye
   - `'fire_bite'` (heat) — Cinderfly
   - `'heal_pulse'` (utility) — Mendwing
   - `'rally_aura'` (utility passive) — Centurion
   - `'death_bomb'` (heat AOE) — Bombardier death
   - ... etc, one per legacy unit attack pattern.
   - **Tier tables:** start with simple linear distributions matching legacy damage. Detailed balance is Phase 10.

4. **`systems/Targeting.ts`** — named selector library.
   ```ts
   export const SELECTORS: Record<string, TargetSelector> = {
     'nearest_enemy_in_range': (caster, range, index) => { ... },
     'nearest_ally_in_range':  (caster, range, index) => { ... },
     'all_enemies_in_range':   (caster, range, index) => { ... },
     'lowest_hp_ally_in_range':(caster, range, index) => { ... },
     // ...one per legacy attack pattern
   };
   ```
   - **Type filter (per executor's Doc 2 observation):** every selector takes an optional `componentFilter` so `'nearest_enemy_in_range'` defaults to entities with `HasAI` (excludes Projectiles, Zones). Specialized selectors like `'projectiles_in_radius'` filter on `HasTrajectory`. **Document this in the selector module header** so future selectors follow the convention.
   - **Pure functions:** each selector takes `(caster, params, candidates: WorldEntity[])` and returns `WorldEntity[]`. Spatial query happens BEFORE the selector is called — selectors operate on plain arrays. Testable in isolation.

5. **Ability registry lookup** — `lookupAbility(name: string): AbilityDef`. Throws on missing. Used by Phase 4.

### Exit criteria

- `tsc --noEmit` passes.
- Every legacy unit has at least one ability defined that matches its current behavior.
- Targeting library has selectors for every legacy attack pattern.
- Pure function tests for each selector (feed plain arrays, assert results).
- Pure function tests for ability lookup (verify error on missing).
- Existing battles still run unchanged.

### Tests

- **Pure function tests:** `Targeting.test.ts` (one test per selector, plain-array inputs), `abilityRegistry.test.ts`.
- **No integration tests yet.**

### Reversibility

**Medium.** Ability data is mass-editable. Selector renames are mechanical. Targeting filter convention is sticky once selectors start using it.

### Effort estimate

2–3 executor sessions.

---

## Phase 4 — Pipeline scaffolding + wrapper

**Goal:** Build the 7-phase event-driven pipeline. Wrap `hitUnit` so legacy attacks flow through the queue.

**Why fourth:** This is the validation moment. Decision 4's precondition is now met (Layers 1–3 scaffolded with sensible defaults). Every legacy attack flowing through the queue without behavior change proves the queue handles real load before any unit migration begins.

### Deliverables

1. **`systems/CombatPipeline.ts`** — the 7-phase event queue.
   - `queueAbility(attacker, target, abilityName, opts?)` — pushes a `DamageEvent` onto the queue.
   - `resolveFrame()` — drains the queue, runs each event through the 7 phases.
   - 7 phases as `EventBus`-style channels: `pre_damage`, `calculate`, `resist`, `modify`, `pre_apply`, `apply`, `post_apply`.
   - Subscribers via `on('phase_name', handler)`.
   - Safety cap: 200 events per `resolveFrame` call.
   - **Dead-target skip:** events with `target.dead === true` skipped at start of resolution.

2. **`DamageEvent` interface in `types.ts`** — matches the spec from [DESIGN_PATTERNS.md:803](../reference/DESIGN_PATTERNS.md#L803):
   ```ts
   interface DamageEvent {
     attacker: WorldEntity;
     target: WorldEntity;
     ability: AbilityDef;
     dmgType: DamageType;
     baseDamage: number;
     finalDamage: number;
     effectiveTier: ResistanceTier;
     effects: string[];
     cancelled: boolean;
     isReflected: boolean;
     isRedirected: boolean;
     damageMultiplier: number;
   }
   ```

3. **Core phase subscribers** (always present):
   - `calculate` — look up ability tier from target resistance + attacker penetration, set `baseDamage` and `finalDamage`.
   - `resist` — apply resistance modifications (Phase 5 will extend this).
   - `modify` — apply attacker modifiers (Phase 5 will populate; in Phase 4, this is a no-op).
   - `apply` — `target.hp -= event.finalDamage`.
   - `post_apply` — death check; set `target.dead = true` if HP ≤ 0; trigger legacy `onDeath` hooks.

4. **Wrapper: `hitUnit` → `queueAbility`** — modify [CombatSystem.ts](../src/systems/CombatSystem.ts) so the `hitUnit` function becomes:
   ```ts
   function hitUnit(target, damage, type) {
     queueAbility(currentAttacker, target, 'legacy_basic_attack', {
       baseDamageOverride: damage,
       legacyType: type,
     });
   }
   ```
   - The `legacy_basic_attack` ability has `category: 'damage'`, no resistance lookup (uses the override), no effects, no targeting (already-targeted).
   - **Every existing unit's attack now flows through the queue** without changing the unit's code.

5. **`resolveFrame()` integration** — **drain per-`hitUnit`-call** during the wrapper phase, NOT once-per-tick. **Plan correction (2026-04-12, post-Phase-4):** the original "once per tick" cadence was internally inconsistent with the "identical behavior" exit criterion. Legacy `hitUnit` is synchronous and nested `ctx.hitUnit` cascades resolve before the outer call returns. Once-per-tick would defer cascades to end-of-frame, breaking parity (forEach iterations would see pre-cascade state; units killed mid-frame would still attack — "leviathan attacks ghost"). Per-call drain preserves legacy depth-first synchronous semantics. **Switch to once-per-tick in Phase 6** when per-unit abilities replace the legacy wrapper as the queue ingress — at that point the wrapper is no longer the only entry and batched draining becomes safe.

6. **Identical-behavior validation** — run all existing battles (PLAY mode, SandboxScene, RUN mode). Damage numbers, HP, victories must be identical to pre-Phase-4. **This is the integration test for the entire phase.**

### Exit criteria

- `tsc --noEmit` passes.
- All existing battles produce identical results to pre-Phase-4 (visual + final state).
- Pure function tests on each core phase subscriber (feed mock `DamageEvent`, assert mutation).
- Property test on `resolveFrame`: feed N random events, verify queue drains, no event left unprocessed, safety cap honored.
- Manual smoke: run a battle with `console.log` on `resolveFrame` event count per frame. Should see 1–10 events/frame in normal play.
- Performance: frame time within 5% of pre-Phase-4 baseline.

### Tests

- **Unit tests:** each phase subscriber as a pure function (mutate `DamageEvent`, assert).
- **Integration test:** "all units attack each other for 10 seconds, final HP matches legacy snapshot."
- **Property test:** `resolveFrame` with random event sequences — never crashes, never leaves events, never exceeds safety cap.

### Reversibility

**Low cost.** The wrapper is opt-in per call site. If it breaks, revert `hitUnit` to direct damage and the rest of the rewrite still works (just slower to ship Phase 5).

### Effort estimate

**4–5 executor sessions.** This is the validation moment for the entire pipeline; downstream phases all depend on it working correctly. Conservative is the right default — if it ships in 3, that's a bonus. Most of the risk in the rewrite lives in this phase. **This phase is the most likely to run long; budget accordingly.**

---

## Phase 5 — Effects, Modifiers, Resources, Pending events, Persistent state

**Goal:** Build the remaining primitives. No unit uses them yet.

**Why fifth:** Phase 6+ unit migration needs all these primitives. Building them in isolation here means migration is "swap legacy hook for new primitive" rather than "build primitive AND swap hook."

### Deliverables

1. **`config/combat/effects/` directory** with grouped files:
   - `dot.ts` — burn, poison, bleed
   - `cc.ts` — stun, slow, freeze, fear
   - `buff.ts` — atk_buff, speed_buff, shield, bloodlust
   - `debuff.ts` — atk_debuff, armor_crack, marked
   - `special.ts` — lifesteal, reflect, soul_linked, rally_target

2. **`EffectDef` interface and lifecycle hooks** — matches spec from [DESIGN_PATTERNS.md:660](../reference/DESIGN_PATTERNS.md#L660):
   - `onApply`, `onTick`, `onExpire`, `onStack`
   - Stackable / non-stackable rules
   - Per-tier stats

3. **`systems/EffectSystem.ts`** — the effect update loop.
   - `applyEffect(target, effectName, stats)` — adds to `target.activeEffects`, fires `onApply`.
   - `removeEffect(target, effectName)` — fires `onExpire`, removes.
   - `updateEffects(units, dt)` — per-frame tick for all units, fires `onTick`, decrements duration, removes expired.
   - **Dead-target skip** in tick loop. Effect breaks if unit dies mid-tick.

4. **`systems/ModifierSystem.ts`** — the modifier stack.
   - `Modifier { stat, type: 'flat'|'percent'|'override', value, source, duration? }`
   - `applyModifiers(entity, baseValue, statName)` — flat → percent additive → override. Respects per-stat caps.
   - **Per-stat caps** — `STAT_CAPS: Record<string, { min?: number, max?: number }>`. Initial caps: `healing_received: { min: -50, max: 200 }`, `resistance_shift: { min: -3, max: 3 }`. Document the cap convention.
   - **Note:** `STAT_CAPS` is a new design pattern not specified in Doc 1 — adding it here as the concrete implementation of Doc 1's "per-stat caps" gap. Not scope creep; a known gap getting its concrete shape.
   - **`HasModifiers` component gating** — `applyModifiers` early-returns if entity lacks `HasModifiers`. No special-casing in callers.
   - Source-tracked removal: `removeModifiersBySource(entity, source)`.

5. **`systems/ResourceSystem.ts`** — Layer 6, the resources primitive.
   - `entity.resources: Record<string, number>` — flat key-value.
   - `getResource(entity, key)`, `addResource(entity, key, delta, max?)`, `spendResource(entity, key, amount): boolean`.
   - **Pure functions over entity.resources** — testable without instantiation.

6. **Pending events as first-class** — extend `DamageEvent`:
   ```ts
   interface DamageEvent {
     // ...existing
     pending?: boolean;
     pendingGroupId?: string;
     pendingCollapseAt?: number;
     pendingTriggers?: { onTargetDamage?: bool; onTargetMove?: { from: Vec2, threshold: number } };
   }
   ```
   - `resolveFrame` skips pending events.
   - `findEvents(predicate)` — query the queue.
   - `cancelEvent(eventId)` — set `cancelled = true`, will be skipped on next drain.
   - `updatePendingEvents(dt)` — checks collapse triggers, marks events non-pending when triggered.

7. **Persistent vs battle-scope unit state** — small but explicit decision in `Unit.init()`:
   - **Battle-scope state** (cleared on init): hp, dead, atkCd, activeEffects, modifiers, resources, etc.
   - **Persistent state** (NOT cleared on init): id, def, components, `unit.persistent: { graftedDeathAbilities, killCount, ... }`.
   - Document the convention in [Unit.ts](../src/entities/Unit.ts) JSDoc.
   - **`UnitPool.recycle`** — only resets battle-scope. Persistent survives.

### Exit criteria

- `tsc --noEmit` passes.
- All primitives have unit tests (pure-function-first for stat math, integration tests for stateful systems).
- Existing battles still run unchanged — nothing reads these primitives yet.
- **Throwaway `_test_all_primitives` ability** (validation only — deleted at phase exit):
  - Single test ability that exercises every Phase 5 primitive in one cast:
    - (a) **Spends a Resource** (e.g., consumes 1 charge from a stackable resource pool)
    - (b) **Applies a stackable Modifier** with explicit source tracking
    - (c) **Applies a stackable Effect** with `onTick` (e.g., a 3-tick test DOT)
    - (d) **Queues a Pending event** that collapses on a trigger condition
    - (e) **Reads a persistent-state field** (verify it survives unit recycle)
  - Deploy via debug console. Each primitive logs to verify it executed. Verify each step in order.
  - **Delete the test ability + its registration after Phase 5 exits.** Validation scaffolding, not a feature. Same pattern as Phase 1's TargetDummy.

### Tests

- **Pure function tests (priority):** `ResourceSystem.test.ts`, `ModifierSystem.test.ts` (stat math), per-effect tier table tests.
- **Integration tests:** apply a burn to a dummy unit, tick 5 frames, verify HP decrement matches expected. Apply two stacking modifiers from different sources, verify both removed independently.
- **Property test:** modifier stacking — random sequence of apply/remove with random sources, verify final value matches the formula.

### Reversibility

**Medium.** Each primitive is a self-contained system. If the modifier system is wrong, only the modifier code changes. If the effect system is wrong, only the effect code changes.

### Effort estimate

4–5 executor sessions. Largest phase by code volume.

---

## Phase 6 — Unit migration tier 1 (simple units)

**Goal:** Migrate the simplest units — those with only basic attacks, no effects, no death hooks, no auras.

**Why sixth:** First proof that the new system can replace legacy combat for real units. If Phase 4 was the validation moment for the pipeline, Phase 6 is the validation moment for unit migration.

### Migration order (simplest first)

1. **Grunt** — `defaultAbility: 'jaw_strike'`. Nothing else.
2. **Mandible** — `defaultAbility: 'jaw_strike'`. Same as Grunt.
3. **Needler** — `defaultAbility: 'needle_shot'` (ranged variant of jaw_strike).
4. **Pricker** — `defaultAbility: 'pricker_jab'`.
5. **Hardshell** — `defaultAbility: 'jaw_strike'`, `resistance: { blunt: 'strong' }`.
6. **Domeback** — `defaultAbility: 'jaw_strike'`, similar resistance.

### Per-unit migration recipe

For each unit:

1. Add `defaultAbility: '<name>'` to the unit's def.
2. Verify the ability exists in the registry (added in Phase 3).
3. Set a feature flag: `unit.useNewCombat = true` in Unit.init() for this specific unit type.
4. **Behavior fork in CombatSystem:** when a unit attacks, check `attacker.useNewCombat`. If true, call `queueAbility(attacker, target, attacker.def.defaultAbility)`. If false, call legacy `hitUnit`.
5. **Attacker owns the pipeline (Decision 2)** — if attacker is new-system, use queueAbility regardless of target. Legacy targets just receive damage with default resistance.
6. Run integration test: "1 new-Grunt vs 1 legacy-Mandible, run for 30 seconds, both should die at same rate as legacy-Grunt vs legacy-Mandible."
7. Run smoke battle: deploy mixed legacy + new units, verify gameplay feels identical.

### Exit criteria

- All 6 simple units run on the new system.
- Mixed-system battles work (new units fighting legacy units).
- Damage parity: integration tests show identical or near-identical (±3%) outcomes vs full-legacy battles.
- `tsc --noEmit` passes.
- No new architectural gaps surfaced. **If a gap is found, STOP and report — do not patch.**

### Tests

- **Integration test per unit:** new-system unit vs legacy mirror, assert HP-over-time parity.
- **Cross-system test:** mixed battle, verify no errors, no infinite loops, no stuck units.

### Reversibility

**Per-unit reversible.** Flip `useNewCombat = false` and the unit reverts to legacy. Each unit migration is a self-contained change.

### Effort estimate

2–3 executor sessions for the batch (units share the same recipe).

### Phase 6 follow-up candidate — Base as WorldEntity (ranged-attack-base fix)

**Recorded 2026-04-13 from gameplay observation.** Currently, ranged units (Needler range 90, Longeye range 90, etc.) walk all the way up to the enemy hive wall before attacking it, ignoring their range. Cause: the base isn't represented as a target in the range-based targeting system at all — it's only attackable by physical proximity in the march-branch fallback at [CombatSystem.ts:177–197](../src/systems/CombatSystem.ts#L177-L197). Range-based `_findTarget(u, foes)` only iterates the units array, which excludes the base. So Needlers and Longeyes lose their entire ranged advantage against the hive — they walk 90px deeper into the danger zone than necessary.

**Fix (Phase 6 follow-up, NOT a phase deliverable):**
1. Wrap the player base and enemy base as `WorldEntity` instances with components: `HasHP`, `IsTargetable`, `HasAllegiance`. **NOT** `HasAI` (it doesn't decide), **NOT** `HasMovement` (it sits), **NOT** `HasCapacityCost` (structures don't count).
2. Register them in the spatial index at battle start, deregister at battle end.
3. Update `_findTarget` (or its successor in the new pipeline) to include `HasHP + IsTargetable` entities, not just units. Range-based selectors then naturally find the base.
4. Adjust the attack code path: when attacker's target IS the base AND attacker is in range, fire base attack from the current position (don't snap to wall). Melee units still have to walk up; ranged units stop at range and fire.
5. ~30 LOC across the entity wrapping + spatial index registration + targeting tweak.

**Why this is a Phase 6 follow-up specifically:**
- Phase 6 is when unit attack code starts being touched anyway as units migrate
- The fix validates the WorldEntity architecture on a real non-Unit entity, addressing **Risk #9** in the risk register ("component model is validated only on Units during the rewrite") with a real production use case rather than a theoretical post-rewrite gap
- It's a small, contained, visible-to-player win midway through the program (motivation boost during the long migration phases)
- It does NOT change Phase 4-5 behavior, so it doesn't risk legacy parity

**Cannot be done before Phase 6** because Phase 4 must preserve legacy base-attack behavior for parity validation, and Phase 5 has its own scope (effects/modifiers/resources).

**Cannot be deferred past Phase 7** because Phase 7 migrates Longeye (a ranged unit) — having Longeye actually shoot the base from range during its smoke test is valuable.

**Effort: 1-2 hours within a Phase 6 follow-up session.** Not a phase, just a contained task between Phase 6 and Phase 7.

---

## Phase 7a — Effect-pipeline primitives (re-scoped 2026-04-13)

**Goal:** Ship the effect-pipeline primitives that Phase 7 migrations depend on. **Zero unit migrations in this sub-phase.**

**Why re-scoped:** Original Phase 7 draft asked the executor to migrate 4 medium units + build the effect/heal/DOT primitives in one phase. Executor code-read surfaced that 3 of 4 units have primitive-level blockers: Mendwing `heal_pulse.category='heal'` is a no-op in the damage-only pipeline at [CombatPipeline.ts:132-133](../src/systems/CombatPipeline.ts#L132-L133); Cinderfly `fire_bite.appliesEffects` is populated on the event at [CombatPipeline.ts:243](../src/systems/CombatPipeline.ts#L243) but no subscriber consumes it; Longeye `handler.onAttack` short-circuits the `canMigrate` check at [CombatSystem.ts:241-246](../src/systems/CombatSystem.ts#L241-L246). Phase 7a ships primitives cleanly; Phase 7b consumes them; Mendwing + Longeye fold into Phase 8. See `MECHANICS_ROADMAP.md` decision log entry dated 2026-04-13 for the full rationale and six locked sub-decisions.

### Deliverables

1. **Heal subscriber on existing `pre_apply` phase slot.** Reads `event.ability.category === 'heal'`, heals `event.target` by `event.ability.healAmount`, cancels event to short-circuit the rest of the pipeline. NOT a new pipeline phase — phase enum unchanged.

2. **Apply-effects subscriber on existing `post_apply` phase slot, registered SECOND after `_legacyPostApplyPhase`.** Reads `event.effects` (already populated in `queueAbility`), calls `EffectSystem.applyEffect(event.target, effectName)` for each. **Registration order matters:** legacy's `_legacyPostApplyPhase` runs first and sets `target.dead = true` on lethal hits; the new subscriber then silently no-ops via `EffectSystem.applyEffect`'s dead-target guard. Matches legacy "DOTs don't land on corpses."

3. **Phase 5 type amendment: `ActiveEffect.accumulator?: number`.** Per-stack scratch state for fractional-damage accumulation. Localizes the "this source produces fractional damage" concern to the DOT hook without weakening the apply-phase `Math.round` defensive guard (Phase 6 follow-up #1).

4. **Phase 5 type amendment: `EffectContext.instance: ActiveEffect`.** Lets hooks read/write the active effect instance they're running on. Required for `burn.onTick` to touch its own accumulator. **Power increase** — future hook authors expanding usage beyond scratch-state mutation require stop-and-report.

5. **`burn.onTick` live hook.** Reads `ctx.instance.accumulator ?? 0`, adds `burn.tiers[tier].dps * dt`, checks if accumulator >= 1 HP. If so: **uses save-restore on `_lastAttacker`** (save current into local, set to `ctx.instance.source`, call `this.hitUnit(target, Math.floor(accumulator), 'burn', ctx)`, restore local), decrements accumulator by the integer amount dispatched. **Save-restore is mandatory** — set-clear is forbidden (immune to future reentrancy refactors if `updateEffects` ever runs during an in-flight resolve frame). Uses `hitUnit` directly, not `queueAbility('legacy_basic_attack', ...)` — simpler call shape, matches the exact pattern `_processStatusEffects` uses at [CombatSystem.ts:380-395](../src/systems/CombatSystem.ts#L380-L395), inherits `modifyDamage`/`modifyAllyDamage` aura hooks for parity with legacy DOT ticks.

6. **`updateEffects` wired inside `CombatSystem.resolve()`.** NOT in `GameManager.tick`. Per-unit effect tick runs in the same loop as `_processStatusEffects` (legacy), so `_currentCtx` is available for particle FX routing.

### Exit criteria

- All 6 deliverables land.
- `tsc --noEmit` clean, `vite build` clean.
- **Bundle module count grows by approximately +8 vs Phase 6 (97 → ~105)** proving that `EffectSystem` is now reachable from production via `CombatSystem.resolve → updateEffects`. Expected additions: `EffectSystem.ts` + `config/combat/effects/index.ts` + `dot.ts` / `cc.ts` / `buff.ts` / `debuff.ts` / `special.ts` + one DOT dispatch wiring leaf (name TBD by executor — avoids circular import between `dot.ts` and `CombatSystem.ts`). This mirrors Phase 5's "+7 proves wiring" pattern — **the new code path is reachable from production but no production caller populates it yet.** Correction 2026-04-13: an earlier draft of this criterion said "bundle unchanged" which contradicted Deliverable 6; the executor caught it during preflight. The correct framing is "+N proves wiring, 0 production callers execute the path."
- **Proof of runtime isolation** (the actual exit criterion, separate from module count): (a) `grep` confirms zero `UnitDef.defaultAbility` points to an effect-using ability or a heal-category ability — only the six Phase 6 simple units have `defaultAbility`; (b) `grep` confirms no production call site invokes `EffectSystem.applyEffect` on a real `Unit` target (tests use synthetic targets constructed inside the test); (c) `grep` confirms no call site populates `event.effects[]` beyond what Phase 4's `queueAbility` already does. The new subscribers and `burn.onTick` are *reachable* from production but never *executed* at runtime in 7a. Phase 7b is the first phase where production call sites reach the new paths end-to-end.
- All 397 prior tests pass.
- ~30 new tests minimum (heal subscriber unit + integration; apply-effects subscriber ordering + dead-target no-op; DOT accumulator math incl. fractional accumulation + integer dispatch + Math.round interaction; burn.onTick save-restore attacker attribution — include a test that pins `_lastAttacker` is restored after the `hitUnit` call).
- **Zero unit migrations.** No `UnitDef` gains `defaultAbility`. No unit combat hooks are touched. 7a is API-only.
- **No silent Phase 5 amendments.** The Phase 7a report must include a "Phase 5 amendments discovered" section — empty if clean, listed with justification if not. Only `ActiveEffect.accumulator` and `EffectContext.instance` are pre-authorized; any other shape change to `EffectDef` / `EffectContext` / `ActiveEffect` / `ModifierSystem` / `ResourceSystem` is a STOP-AND-REPORT trigger.

### Stop-and-report triggers

1. A deliverable requires a new pipeline phase enum entry (beyond `pre_damage` / `calculate` / `resist` / `modify` / `pre_apply` / `apply` / `post_apply`). Phase enum is load-bearing; extending it is a spec amendment.
2. A deliverable requires touching `CombatPipeline.ts` beyond registering new subscribers. Phase 7a protects structural pipeline code.
3. Any Phase 5 interface shape change beyond the two pre-authorized amendments (`ActiveEffect.accumulator`, `EffectContext.instance`).
4. The save-restore pattern for `_lastAttacker` cannot be implemented because of an unforeseen CombatSystem state constraint.
5. Bundle module count grows **beyond ~+10 vs Phase 6** (expected: ~+8 from `EffectSystem` + effects tree + DOT dispatch leaf; any additional growth indicates unexpected wiring). The expected ~+8 growth is NOT a trigger — it's the direct consequence of Deliverable 6 landing as specified, and mirrors Phase 5's "+7 proves wiring" pattern. Unexpected growth (e.g., ModifierSystem/ResourceSystem/etc. accidentally chain-imported) IS the trigger.

### Tests

- `EffectSystem.test.ts` additions for accumulator math, save-restore attribution, dead-target apply no-op ordering.
- `CombatPipeline.test.ts` additions for heal subscriber (pre_apply cancel semantics) and apply-effects subscriber (post_apply registration-order sensitivity).
- New `CombatSystem.phase7a.test.ts` for integration tests wiring heal + apply-effects + burn.onTick against synthetic targets. Synthetic targets only — no production unit defs touched.

### Reversibility

**High.** Zero unit migrations means no gameplay changes to revert. The subscribers + hooks + type amendments can be stripped in a single commit.

### Effort estimate

1–2 executor sessions. High effort level — first-time primitive work for the effect pipeline. Executor session continuity: keep the current session (Phase 6 → Phase 7a → Phase 7b), fresh session reserved for Phase 8 per existing rule.

---

## Phase 7b — Unit migration tier 2 (Skitterling + Cinderfly)

**Goal:** Migrate the two medium units whose blockers are resolved by Phase 7a primitives. Mendwing and Longeye do NOT ship in 7b — they fold into Phase 8.

**Why seventh-b:** Phase 7a shipped the effect pipeline primitives without production consumers. Phase 7b is the first production consumer — Cinderfly exercises `burn.onTick` + apply-effects subscriber in a real battle.

### Migration order

1. **Skitterling** — `defaultAbility` set to its tier-2 basic-attack ability (verify against `config/combat/abilities/`). No effects, no modifiers — cleanest possible Phase-6-style migration. Ships first as sanity check that nothing broke between Phase 6 and 7b.

2. **Cinderfly** — `defaultAbility: 'fire_bite'` with `appliesEffects: ['burn']`. **First production consumer of Phase 7a primitives.** Direct-target burn goes through the new path (apply-effects `post_apply` subscriber → `EffectSystem.applyEffect` → burn on `ActiveEffect` → `burn.onTick` dispatches accumulated damage via `hitUnit`). Half-migrated: `cinderflyCombat.afterHit` (spread burn to nearby enemies) stays in place per the Phase 6 kickoff rule "do NOT delete legacy CombatHooks for migrated units." Phase 9 cleanup deletes the legacy spread.

### Preflight triggers (resolve BEFORE Cinderfly migration ships)

1. **Cinderfly double-burn parity violation.** `cinderflyCombat.afterHit` spread filter at [normal.ts:363-369](../src/units/normal.ts#L363-L369) is `e.side !== u.side && !e.dead && !e.burrowed && distance < 85`. The primary target passes all four (self-distance = 0), so migrated Cinderfly would apply both new-system `ActiveEffect` burn via `fire_bite.appliesEffects` AND legacy `burnTimer` burn via the spread loop to the same primary. Resolve by filtering the primary from the spread loop (orchestrator lean — preserves parity) or accepting documented non-parity. **Must decide in the Phase 7b kickoff before migration ships.**

### Per-unit recipe (extends Phase 6)

Same as Phase 6, plus: verify the Phase 7a primitives work end-to-end via integration tests before marking each unit done.

### Exit criteria

- Skitterling + Cinderfly run on the new system.
- Burn DOT behaves identically to legacy burn (dps per tick, duration, stacking rules, expire-on-host-death behavior) via the new `ActiveEffect` system.
- Byte-for-byte parity at normal tier for Skitterling basic attack (same Phase 6 variance-preservation invariant).
- Cinderfly direct-target burn parity AND spread-target burn parity (spread burn stays as legacy path).
- Mixed-system battles work (migrated tier-2 alongside legacy Mendwing / Longeye / tier-3 units).
- All 397 + ~30 (from 7a) + ~40 new tests pass.
- `tsc --noEmit` clean, `vite build` clean.

### Stop-and-report triggers

1. Cinderfly's direct-target burn does not reproduce legacy burn timing within ±1 HP per tick.
2. A Phase 7a primitive gap surfaces that should have been caught in 7a. Report it instead of working around it.
3. Skitterling parity tests fail beyond the Phase 6 tolerance at normal tier.

### Tests

- Per-unit parity tests in `CombatSystem.phase7b.test.ts`: 2 units × 6 variance values = 12 parity tests minimum.
- Cinderfly-specific burn integration: apply → tick → expire → total HP delta matches legacy formula.
- Cinderfly double-burn regression test (pins the decision made in preflight trigger #1).

### Reversibility

**Per-unit reversible** (same as Phase 6 — remove `defaultAbility` field).

### Effort estimate

1–2 executor sessions. Smaller than original Phase 7 estimate (4 units → 2 units) but each exercises the new primitives so test coverage is dense.

---

## Phase 8 — Unit migration tier 3 (complex units) — EXPANDED 2026-04-13

**Goal:** Migrate the units with exotic mechanics — death hooks, auras, modifier sources, knockback, chains, rage — **plus the two Phase 7 units (Mendwing, Longeye) that were folded here during the 2026-04-13 rescope**.

**Why eighth:** These are the riskiest migrations. Phases 6 / 7a / 7b prove the system works on simple and medium cases. Phase 8 proves it can handle the hard cases. **If the architecture is wrong, this is where it shows.**

**Why Mendwing + Longeye folded here (2026-04-13):** Mendwing needs the passive-ability migration pattern. Legacy heal runs via `mendwingCombat.onUpdate` ticking a `healTimer`, and `heal_pulse` targets ALLIES not foes — but the attack cycle is built around enemy targets via `_findTarget(u, foes)`. The new path needs either an ally-targeting attack-cycle variant OR a passive-tick mechanism that fires `heal_pulse` via the Phase 7a `pre_apply` heal subscriber. That pattern is shared with Centurion `rally_aura` and Wardling `guardian_ward` (both `category: 'passive'` in `utility.ts`), already Phase 8 work. Longeye needs the handler-precedence fix at [CombatSystem.ts:241-246](../src/systems/CombatSystem.ts#L241-L246) — the `if (handler.onAttack) { ... } else { /* canMigrate here */ }` fork short-circuits migration for any unit with `onAttack`, so `defaultAbility` is silently ignored. That decision is shared with Stormfly chain (`onAttack`) and Bombardier death-bomb (`afterHit`). A dedicated Phase 7c would re-solve those decisions in isolation while Phase 8 has to solve them anyway. **Phase 8 effort absorbs the expansion:** fresh executor session + Max effort per existing rule, 2-unit expansion stays within the Max budget.

### Migration order

1. **Bashguard** — `defaultAbility: 'ram_strike'` with knockback effect. Validates knockback as a Layer 4 effect.
2. **Ravager** — basic attack + rage passive (`onUpdate` checks HP%, applies atkRate modifier). First test of passive abilities.
3. **Legionnaire** — high HP, high resistance. Mostly a stat test, low risk.
4. **Wardling** — aura passive. Validates Layer 5 modifier sources with cleanup on aura-leaver.
5. **Centurion** — rally aura. **Critical test:** the spec's modifier system must replace the current uid-tracked rally cleanup. If the modifier system can't express rally with source-tracked removal, the architecture has a gap.
6. **Bombardier** — `deathAbility: 'death_bomb'`. **Critical test:** death-as-data + queueAbility for AOE on death + safety cap on death cascades.
7. **Stormfly** — chain lightning. **Critical test:** post_apply phase subscriber that queues followup events with damage falloff. If chain lightning works, every "this triggers more of this" pattern works.
8. **Mendwing (folded from Phase 7)** — `defaultAbility: 'heal_pulse'` + **passive-ability migration pattern**. Legacy heal runs via `mendwingCombat.onUpdate` ticking a `healTimer`; the new path needs either an ally-targeting attack-cycle variant OR a passive-tick mechanism that fires `heal_pulse` via the Phase 7a heal subscriber. Shares the architectural sub-decision with Centurion `rally_aura` (#5) and Wardling `guardian_ward` (#4). Locks the passive-migration pattern for all three.
9. **Longeye (folded from Phase 7)** — `defaultAbility` set to its piercing ability (verify against `config/combat/abilities/sharp.ts`) + **handler-precedence fix**. Requires either (a) a `canMigrate`-style precedence rule where `defaultAbility` presence always wins over legacy `handler.onAttack` hooks, or (b) a narrower per-unit override gate. Decision shared with Stormfly chain (#7, `onAttack`) and Bombardier death-bomb (#6, `afterHit` unconditionally). Longeye-unique: per-target damage falloff for piercing — trivial once the handler-precedence primitive exists. Locking order matters: solve handler-precedence BEFORE migrating Stormfly / Bombardier / Longeye, otherwise you're re-deriving it three times.

### Per-unit recipe (extends Phase 7b)

Same as Phases 6–7 plus, for each complex unit:

- **Pre-migration:** read the unit's existing `combat?` hook. Map each behavior to: ability data, effect, modifier source, or phase subscriber.
- **Document the mapping** in a comment at the top of the migrated unit's file.
- **Migration:** define new abilities/effects/modifiers as needed in `config/combat/`. Add phase subscribers for behaviors that don't fit pure data.
- **Validation:** integration test must show identical gameplay outcome vs legacy. Visual fidelity must match.
- **STOP-AND-REPORT trigger:** if any unit's behavior cannot be expressed cleanly using the existing primitives (ability data + effects + modifiers + phase subscribers), STOP. Do not invent new primitives in this phase. Report to orchestrator. The orchestrator decides: extend the architecture (sub-phase 8.5), fall back to a hook escape hatch (and document why), or restructure.

### Exit criteria

- All complex units run on the new system.
- All units in the codebase are on the new system. **Nothing on legacy.**
- Centurion rally cleanup works correctly in multi-Centurion compositions (the existing `_ralliedByUid` pattern must be replaced by source-tracked modifiers, NOT preserved).
- Bombardier death cascade respects the safety cap (200 events/frame).
- Stormfly chain falloff works without recursion (queue-based).
- Mixed-system battles no longer happen (everything is new-system).

### Tests

- **Integration test per unit:** full behavior parity vs legacy.
- **Cross-unit tests:** 3 Centurions buffing overlapping allies, all Centurions die in different orders, verify modifiers cleaned up correctly per source.
- **Stress test:** 5 Bombardiers die in the same frame, verify safety cap engages, no infinite loop.

### Reversibility

**Medium per unit, low for the architecture itself.** If a unit migration is wrong, flip the flag back. If the architecture has a gap, this is the phase where it must be addressed — patching it is forbidden, escalation is mandatory.

### Effort estimate

5–7 executor sessions. **The most likely place for the rewrite to surface a problem.** Budget conservatively.

---

## Phase 9 — Legacy removal

**Goal:** Delete all legacy combat code. Remove flags. Clean codebase.

**Why ninth:** All units are on the new system. Legacy code is dead weight that confuses readers.

### Deliverables

1. Delete legacy `hitUnit` function and all its helpers.
2. Delete the `useNewCombat` flag and all branching code.
3. Delete `legacy_basic_attack` ability (no longer needed).
4. Delete the legacy combat code path in CombatSystem.ts.
5. Remove the wrapper indirection from Phase 4 (now that nothing calls hitUnit, the wrapper has no callers).
6. Delete legacy effect tracking (the `if (effect === 'burn')` style branches replaced by Layer 4).
7. Delete legacy modifier tracking (the `_ralliedByUid` style fields replaced by Layer 5).
8. Run all tests. Run all battles. Verify nothing broke.

### Exit criteria

- `tsc --noEmit` passes.
- All tests pass.
- All battles run correctly.
- `grep -r "hitUnit" app/src` returns nothing in production code.
- `grep -r "useNewCombat" app/src` returns nothing.
- Codebase audit: confirm no dead code from legacy combat.

### Tests

- Re-run all integration tests from Phases 6–8.
- Re-run all existing combat scenarios.

### Reversibility

**Low after deletion** (you'd be restoring deleted code from git). Mitigation: this phase is a single commit, easy to revert if something is missed.

### Effort estimate

1–2 executor sessions.

---

## Phase 10 — Balance v1

**Goal:** Tune numbers against the new pipeline so combat feels balanced. **This is v1 — final balance comes after AI plan ships.**

**Why tenth:** Until all units are on the new system, balance numbers don't reflect reality. Once everything is migrated, real tuning can happen.

### Deliverables

1. **Damage type spread audit** — ensure each unit has a sensible damage type. Update resistance fields where the new system surfaced obvious mismatches.
2. **Resistance pass** — assign resistances to all units that should have them (not just the conservative Phase 2 set).
3. **Ability tier table tuning** — fill out the tier tables for each ability so weak/normal/strong tiers feel meaningfully different.
4. **Modifier numbers** — Centurion +20% rally, Wardling aura, etc. Tune to feel.
5. **Wave difficulty regression test** — run all existing waves, verify they're still beatable but not trivial.
6. **Capacity-aware playtest** — verify capacity costs still feel right with the new combat math.

7. **Variance redesign — replace legacy `[-3, +2]` with deterministic-by-default + opt-in RNG fields.** Recorded 2026-04-12 during Phase 4 smoke testing. The legacy variance is hardcoded `base + random(-3, +2)` ([CombatSystem.ts:113](../src/systems/CombatSystem.ts#L113)) which scales as ±15% at low tiers (Grunt atk 20) but only ±1% at high tiers (future Yottavyss atk 300). Variance becomes invisible at high tiers, undercutting its purpose (anti-determinism, drama, anti-cheese, glance/crit feel). **Worse**, applying variance to every unit by default makes RNG a baseline tax — it adds noise without giving designer control or build-axis value.

**Design call locked 2026-04-12: hybrid — deterministic by default, opt-in RNG per ability.** Reference games: Clash Royale and StarCraft 2 use full determinism for competitive integrity; Battle Cats uses crits as a per-cat opt-in feature. Hivyss is single-player roguelike PvE, closest to Battle Cats. The opt-in approach makes RNG a deliberate design statement (this unit is the lucky one, this unit is the wild one) rather than background noise on every unit.

**Implementation:** add two optional fields to `AbilityTierStats`:
```ts
interface AbilityTierStats {
  damage: number;          // base multiplier on caster.atk
  variancePct?: number;    // optional, default 0 (no variance)
  critChance?: number;     // optional, default 0 (no crit)
  critMult?: number;       // optional, default 1 (no crit multiplier)
}
```

Calculation in the `calculate` phase subscriber:
```ts
const stats = event.ability.tiers[event.effectiveTier];
let dmg = event.attacker.atk * stats.damage;
if (stats.critChance && random() < stats.critChance) dmg *= stats.critMult ?? 1;
if (stats.variancePct) dmg *= 1 - stats.variancePct + random() * 2 * stats.variancePct;
event.finalDamage = Math.round(dmg);
```

**Default behavior (no fields set):** `dmg = attacker.atk × stats.damage` — exact integer damage. Most units are blank in both columns. RNG is a property a unit explicitly opts into.

**Designer guidance for assigning crit/variance:**
- **Default (most units):** no RNG fields. Predictable, calculable, clean. Examples: Grunt, Mandible, Bombardier, Hardshell, Domeback.
- **Crit-themed units (occasional dramatic spike):** set `critChance` 5-25% with `critMult` 1.5-2.0×. Examples: Stormfly (lightning forks harder), Longeye (sniper headshot). Battle Cats's "savage blow" pattern.
- **Variance-themed units (wild swings):** set `variancePct` 0.20-0.40. Rare. Reserved for explicitly RNG-themed units like a future Berserker Wasp.
- **Anti-RNG units (deliberately exact):** explicitly comment "no RNG fields by design" so future devs don't add them. The "precision" archetype.

**Why hybrid > pure determinism:** RNG units become a build axis for the roguelike. Crit-focused compositions become a strategy. Anti-crit defenders become a counter. Mutation system can add `critChance` as an effect. Larva quality can roll variants with bonus RNG fields. None of these emerge if RNG doesn't exist OR if RNG is global.

**Why hybrid > pure crit (my original Option B):** Default-zero crit fields are wasteful — they imply "this unit could have crit but doesn't" for every unit. Default-absent fields signal "RNG is a special property here, not a baseline." Cleaner code, cleaner UnitDef files, cleaner mental model.

**Cannot land before Phase 10** because Phases 4-8 must preserve legacy variance for parity validation; changing variance now would invalidate the wrapper and unit migration tests. **Phase 10 is the natural landing place.** Implementation cost is small: ~30 LOC (two AbilityTierStats fields, one calc tweak, per-unit RNG assignments documented in unit files).

**Out of scope for the variance work:** the legacy `[-3, +2]` is removed completely. Phase 10 includes a balance pass to retune unit damage values to compensate for the average shift (legacy average was `base - 0.5` due to asymmetry; new default average is `base` exactly).

### Exit criteria

- All existing waves can be cleared by a competent player.
- No unit is dramatically over- or under-powered relative to its cost.
- Damage type counters feel meaningful (Cinderfly burns Cinderfly less than it burns Hardshell).
- **Documented as v1.** Final balance pass happens after AI plan.

### Tests

- **Playtest** — manual, multi-session.
- **Wave clear regression** — run each existing wave, log clear time + remaining player HP. Should be within reasonable range vs pre-rewrite baselines.

### Reversibility

**Trivial.** Numbers are data. Tuning is iterative.

### Effort estimate

3–4 executor sessions + manual playtesting time.

---

## Risk register

| # | Risk | Phase | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| 1 | ECS-lite is the wrong call (Decision 1 was wrong) | 1 | Low | Catastrophic | Smoke-test the component model on Unit before scaffolding all systems. If component queries feel awkward, STOP and reconsider. |
| 2 | Pipeline overhead is unacceptable | 4 | Low-medium | High | Profile during Phase 4 validation. Optimize hot paths only if profiler shows >10% frame time regression. |
| 3 | Effect lifecycle bugs (DOTs misbehave during stacking/expire) | 5–7 | Medium | Medium | Property tests on effect application/expire/stack. Cinderfly's Phase 7 migration is the live integration test. |
| 4 | Complex unit (Centurion / Bombardier / Stormfly) cannot be expressed cleanly | 8 | Medium | High | STOP and escalate. Do not patch. Sub-phase 8.5 may be needed if the architecture has a gap. Phase 8 is budgeted conservatively for this reason. |
| 5 | Balance drift — combat feels different even with matched numbers | 10 | Medium | Low-medium | This is expected. Phase 10 is v1 tuning for a reason. Don't try to ship perfect balance before AI plan provides real adversary signal. |
| 6 | Migration takes longer than estimated | All | Medium-high | Low | Estimates are ranges. Each phase has clear exit criteria — if a phase drags, the orchestrator can scope-cut or extend the phase. No global deadline. |
| 7 | Mixed-system battles produce subtle bugs in Phases 6–7 | 6–7 | Medium | Medium | Attacker-owns-pipeline rule (Decision 2) makes this tractable. Integration tests target mixed battles explicitly. |
| 8 | A future ability concept invalidates the rewrite mid-flight | All | Low | High | The 20-ability validation (rounds 1–4) reduces this risk. If a new ability concept arrives that doesn't fit, evaluate at Phase 8 boundary, not mid-phase. |
| 9 | Component model is validated only on Units during the rewrite | Post-rewrite | Medium | Medium | The component model is architected for non-Unit entities (Pylon, Zone, Projectile, Trail) but only exercised on Units during the rewrite. Phase 1's TargetDummy (deliverable 6) catches the most obvious "implicitly Unit-shaped query API" failure modes, but the first post-rewrite feature introducing a new entity type is the real validation. **If the first Pylon implementation surfaces gaps, treat as a targeted sub-phase, not a rewrite failure.** This is a known acceptable risk — validating fully would mean building a Pylon during the rewrite, which is scope creep. |

---

## Out of scope (stays out)

The following are explicitly NOT part of the combat rewrite:

1. **World rollback / divergent timeline abilities** (Butterfly Effect class). Requires deterministic simulation engine across AI/movement/RNG/particles. Separate workstream if ever pursued.
2. **AI plan.** Deferred until after Combat Rewrite + Balance v1. See [MECHANICS_ROADMAP.md](../active/MECHANICS_ROADMAP.md).
3. **New unit content.** No new units during the rewrite. Migrate existing units only. New units come post-rewrite.
4. **Visual rewrites.** Effect visuals stay on the legacy `EffectVisualSystem` path. Replacing the visual system is a separate concern.
5. **New genelines.** Beta and beyond wait for combat rewrite to land. Adding genelines mid-rewrite would double-touch every unit.
6. **Roguelike map / run structure changes.** RunController and NodeMapScene stay as they are.
7. **Capacity system changes.** Capacity is done. Don't touch it.
8. **Final balance.** Phase 10 is v1. Final balance is post-AI-plan.

## Effort summary

| Phase | Description | Sessions | Cumulative |
|---|---|---|---|
| 1 | Foundation (SpatialIndex + ECS-lite + TargetDummy validation) | 3–5 | 3–5 |
| 2 | Static layers (Attributes + Damage Types) | 2 | 5–7 |
| 3 | Ability data + targeting | 2–3 | 7–10 |
| 4 | Pipeline scaffolding + wrapper | **4–5** | 11–15 |
| 5 | Effects + Modifiers + Resources + Pending + Persistent | 4–5 | 15–20 |
| 6 | Unit tier 1 (simple) | 2–3 | 17–23 |
| 7 | Unit tier 2 (medium) | 3–4 | 20–27 |
| 8 | Unit tier 3 (complex) | 5–7 | 25–34 |
| 9 | Legacy removal | 1–2 | 26–36 |
| 10 | Balance v1 | 3–4 | 29–40 |

**Total: 29–40 executor sessions.** At 1–2 focused sessions per day, that's **4–8 weeks** of executor work. Plus orchestrator review time, plus user playtesting time, plus the inevitable surprises.

**Conservative real-world estimate: 6–10 weeks end-to-end.**

Phase 4 was bumped from 3–4 to 4–5 sessions per executor review — it's the validation moment for the entire pipeline, downstream phases all depend on it, and conservative is the right default for the highest-leverage phase.

## After the rewrite

When Phase 10 ships:

1. **Update `MECHANICS_ROADMAP.md`** — mark combat rewrite complete, advance to next program.
2. **Activate AI plan** — the combat primitives now exist for AI utility scoring (`previewDamage()`, ability data, modifier system).
3. **Balance v2** — final balance pass against the real AI adversary.
4. **New unit content** — Beta geneline can begin.

## Related docs

- [COMBAT_REWRITE_DECISIONS.md](COMBAT_REWRITE_DECISIONS.md) — locked decisions this plan is built on
- [COMBAT_REFERENCE.md](../reference/COMBAT_REFERENCE.md) — legacy combat baseline (what we're replacing)
- [DESIGN_PATTERNS.md](../reference/DESIGN_PATTERNS.md#L460) — original 5-layer spec (now extended)
- [GAME_DESIGN.md](../reference/GAME_DESIGN.md#L715) — damage types and resistance design
- [MECHANICS_ROADMAP.md](../active/MECHANICS_ROADMAP.md) — overall program tracking
- [Capacity.ts](../src/systems/Capacity.ts), [Capacity.test.ts](../test/systems/Capacity.test.ts) — pure-function test pattern reference
