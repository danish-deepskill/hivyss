# Combat Rewrite — Decisions

**Status:** Awaiting sign-off
**Created:** 2026-04-12
**Blocks:** `COMBAT_REWRITE_PLAN.md` (Doc 2) — cannot be written until these are locked, half the plan would be conditional on unanswered questions.

## How to use this doc

Read each decision. Approve the recommendation, redirect, or request more analysis. Spend real attention on Decisions **1** and **3**; Decisions **4–6** can be skimmed (they're easy to flip later without cascade damage).

## Background

Driven by 20-ability validation across 4 test rounds. The original 5-layer spec from [DESIGN_PATTERNS.md:460](../reference/DESIGN_PATTERNS.md#L460) was necessary but incomplete. Test abilities surfaced load-bearing gaps:

- **WorldEntity** — zones, projectiles, pylons, pickups, trail segments don't fit "Unit"
- **Resources** — charges, ammo, mana need a non-HP non-cooldown primitive
- **Pending events** — delayed/grouped resolution for Quantum Strike, Silence Lash, Probability Well
- **Persistent unit state** — Soul Graft / Imago Awakening need data that survives recycle and identity change
- **SpatialIndex** — zones and projectiles apply real per-frame query pressure
- **Per-stat caps** — healing reduction caps at -50%, modifier system needs per-stat ceilings

The combat rewrite is now **8 layers + pipeline + 3 cross-cutting concerns**, not 5 layers. Every addition is driven by concrete abilities, not speculation.

---

## Reversibility at a glance

| # | Decision | Reversibility | Cost if flipped later |
|---|---|---|---|
| 1 | Entity model | **Very low** | Rewrites half the rewrite |
| 2 | Coexistence strategy | Medium (per layer) | Per-layer migration repeat |
| 3 | SpatialIndex shape | Medium | Index internals rewrite, callers unchanged |
| 4 | Pipeline wrapper | **Low cost** | Wrapper is opt-in per call site |
| 5 | Targeting reference location | Medium-low | Selector references are data, mass-swap |
| 6 | Test strategy | **Trivial** | Add what's missing whenever |

---

## Decision 1 — Entity model

**Reversibility: very low.** This is THE structural decision. It shapes how every other system in the rewrite is written.

### Context

Soul Pylon (round-4 test ability #2) is unit-like (HP, resistance, position, `onDeath`, targetable) but missing unit-specific things (movement, attack, capacity cost). Today's `Unit` class can't model it cleanly. Same problem applies to Projectiles, Zones, Pickups, Trail segments — all the non-Unit things that **8 of 20** test abilities depend on.

### Three options

**A. WorldEntity is parent class. Unit extends it.**
- Pro: conceptually clean, single targeting iterator
- Con: every Unit-specific system needs `if (entity instanceof Unit)` checks; inheritance is rigid (Pylon needs HP from Unit but not movement); base class drift is inevitable

**B. WorldEntity and Unit are siblings.**
- Pro: clean separation
- Con: Pylon doesn't fit either box; forces awkward duplication of HP/damage/death machinery into both

**C. Component composition (ECS-lite).**
- Entities carry components as data; logic stays in core systems that query for them
- Pro: Pylon falls out naturally; new entity types = pick a component set; scales to 24 genelines + roguelike complexity
- Con: ~1 week of upfront design before any combat code

### Sub-gap A: ECS-lite flavor

"ECS-lite" is ambiguous. Two distinct architectures hide under that name:

- **Full ECS** — system loops iterate component sets, logic moves out of classes into systems, requires a scheduler. Conflicts with Phaser's update model. Big mental-model shift. Hard to debug.
- **Components-as-data** — entities carry a `components: Set<ComponentTag>` field, core systems (CombatSystem, AISystem) query `entities.where('HasHP')`, logic stays where it lives today. Components answer "does this entity participate in this system?" — nothing more.

**Recommendation: components-as-data, NOT full ECS.** Reasoning: full ECS adds debugging complexity and a system scheduler we don't need at our scale. Components-as-data gets the entity flexibility benefit (Pylon = pick components, done) without restructuring how systems work.

### Component set (initial — Doc 2 will expand if needed)

| Component | Purpose | Owners |
|---|---|---|
| `HasHP` | Has HP, can be damaged | Unit, Pylon |
| `HasResistance` | Per-damage-type resistance | Unit, Pylon |
| `IsTargetable` | Can be targeted by abilities | Unit, Pylon, Projectile (intercept) |
| `HasOnDeath` | Fires onDeath hooks | Unit, Pylon |
| `HasZoneShape` | Spatial extent for area effects | Salt Field, Gravity Well, Corpse Garden |
| `HasAI` | Runs decision-making (target acquisition, deploy logic) | Unit only |
| `HasTrajectory` | Moves on a path independent of AI | Projectile only |
| `HasAllegiance` | Belongs to a side (player/ai) | Unit, Pylon (but **NOT** Gravity Well — neutral) |
| `HasSourceAttribution` | Credits a source for kills / modifier sources | Unit, Pylon (caster ref) |
| `HasCapacityCost` | Counts toward capacity | Unit only |
| `HasModifiers` | Can have Layer 5 modifiers applied | **see Sub-gap B** |

Note: `HasAllegiance` and `HasSourceAttribution` are split deliberately. A Pylon has both (it has a side AND a caster). A Gravity Well has neither (neutral, ownerless). A Trail segment has only allegiance (side, but no source to credit). Splitting them prevents "orphaned WorldEntity" bugs where systems assume `entity.side` exists.

### Sub-gap B: HasModifiers — does Layer 5 target WorldEntities or only Units?

This is load-bearing. Two answers:

- **Yes** — Pylons can be buffed (extend lifetime, increase HP), Gravity Wells can be debuffed (shrink radius), zones become first-class for the modifier system. Uniform across all entity types.
- **No** — modifiers are Unit-only. Pylons/Zones/Projectiles bypass Layer 5 entirely. Simpler initially, but cuts off design space and means Layer 5 has special-cased "is this a Unit?" logic.

**Recommendation: YES — Layer 5 targets any entity with `HasModifiers`.** Cost is small (the modifier system already iterates a list and applies them; component-gating that list is one filter line). Benefit is architectural uniformity. If we say "no" now and a future ability needs zone modifiers, we re-do Layer 5.

### Recommended option

**Option C — ECS-lite, components-as-data flavor, with `HasModifiers` as a first-class component opt-in.**

### Sign-off

- [ ] Approved as recommended
- [ ] Approved with changes: ___________
- [ ] Redirect to: ___________

---

## Decision 2 — Coexistence strategy

**Reversibility: medium per layer.** Flipping mid-migration costs you a per-layer redo of the migration steps already done.

### Context

New combat and legacy combat must coexist for the duration of the rewrite (weeks-to-months). Three flavors of strangler fig:

- **A. Layer-by-layer flags** — each layer ships behind a feature flag. Old + new coexist per concern. Most reversible, slowest to "fully migrated."
- **B. Unit-by-unit migration** — new combat owns units that opt in; legacy owns the rest. Cleaner cutover, harder to test cross-faction interactions during transition.
- **C. Forked combat** — parallel systems, only one active per battle. Fastest to ship, hardest to compare.

### Recommendation: hybrid — A for layers 0–5 + pipeline, B for the unit-visible cutover

Layers 0–5 land behind flags. Once layers stabilize, individual units migrate to the new pipeline one at a time. This means a partially-migrated battle has new-system Mandibles fighting legacy Grubs.

### Sub-gap: transition boundary behavior

What happens when a new-system unit hits a legacy unit during migration? Three answers:

1. **Attacker owns the pipeline.** If attacker is new-system, damage flows through `queueAbility`. The legacy target is treated as a valid pipeline target with default resistance (`normal`) and no Layer 5 modifiers.
2. **Target owns the pipeline.** If target is new-system, defender's pipeline runs.
3. **Whichever is "newer."** Hierarchy of system versions; latest wins.

**Recommendation: attacker owns the pipeline.**

Reasoning: attacker-owned makes "migrate Mandible to new" a self-contained change. The Mandible's behavior is determined by the Mandible's code path. No coordination required between attacker and target. Legacy target acts as a pipeline target with default values. Migration is per-unit, not per-pair.

### Sign-off

- [ ] Approved as recommended (A+B hybrid, attacker owns pipeline)
- [ ] Approved with changes: ___________
- [ ] Redirect to: ___________

---

## Decision 3 — SpatialIndex shape

**Reversibility: medium.** Index internals can be rewritten without touching callers, but the query API shape is sticky.

### Context

Hivyss is lane-based — units mostly move along X. That changes the answer from "what's the best generic spatial index" to "what exploits the lane structure."

### Three options

- **A. Grid (2D).** Generic, fine, ~1 day to build.
- **B. Sweep-and-prune over X.** Exploits lane structure, faster for the common case, ~2 days to build.
- **C. None initially, defer.** Implement when the first zone/projectile system needs it.

### Recommendation: B (sweep-and-prune over X)

The lane structure makes it the right shape; defer is a trap because zones/projectiles apply pressure on day 1 of any real migration; grid is fine but doesn't exploit Hivyss's structure.

### Sub-gap: Route × SpatialIndex

Hivyss has air / land / tunnel as parallel routes. Two options:

1. **One index, route filter at query time.** `index.query({ x: 100, range: 80, routes: ['land', 'air'] })`. Single source of truth, simple maintenance, cross-route abilities (zones spanning routes, ranged land→air) work without special-casing.
2. **Three indices (one per route).** Faster for same-route queries (which dominate), but maintenance is per-route and cross-route abilities query all three.

**Recommendation: one index with route filter at query time.**

Reasoning:
- Cross-route abilities are a real class (zones, ranged land→air, gravity wells, future air-drop mechanics). They need to be cheap, not special-cased.
- Maintenance is simpler with one index — one insert/remove per unit lifecycle event.
- Sweep-and-prune is already efficient at our unit counts (O(n log n) sort, O(n + k) incremental where k = reported overlaps); splitting into three indices is at most a constant-factor improvement.
- Cross-route logic isn't a special case, it's just a different filter parameter — the API stays uniform.

### Sign-off

- [ ] Approved as recommended (sweep-and-prune over X, one index with route filter)
- [ ] Approved with changes: ___________
- [ ] Redirect to: ___________

---

## Decision 4 — Pipeline coexistence

**Reversibility: low cost.** The wrapper is opt-in per call site. If wrong, switch call sites back to direct legacy paths trivially.

### Context

How does new `queueAbility` coexist with legacy `hitUnit`?

### Three options

- **A. Wrapper.** `hitUnit` becomes a thin call into `queueAbility('legacy_basic_attack', ...)`. Old call sites unchanged, every legacy attack pays queue overhead.
- **B. Parallel.** Both exist independently. Units explicitly opt into one. Clean per-unit, confusing for shared targets.
- **C. Cutover at flag.** Flag determines which path runs. Can't mix.

### Recommendation: A (wrapper)

Reasoning: from the moment Layers 1–3 exist with sensible defaults, every legacy attack already flows through the queue. This is the main thing we want to validate (does the queue handle real load). Performance hit is acceptable for validation; legacy paths get optimized only if the profiler complains.

### Hidden precondition (load-bearing for Doc 2)

The wrapper only works once Layers 1–3 are scaffolded enough for legacy attacks to resolve through `queueAbility`. **"Day 1" is not literally day 1 of the rewrite** — it's "Day 1 after Layers 0–3 exist with sensible defaults."

This sequences phases in Doc 2:
- **Phase 1** — scaffold Layers 0–3 (Entity model, SpatialIndex, Attributes, Damage Types, Abilities) with sensible defaults. No call sites changed yet.
- **Phase 2** — wrap `hitUnit`. Every legacy attack now flows through the queue. Layers 4–5 still legacy.

If Doc 2 lists the wrapper as a Phase 1 deliverable while Layers 1–3 are in Phase 2, the plan is internally inconsistent.

### Sign-off

- [ ] Approved as recommended (wrapper, with phase precondition noted)
- [ ] Approved with changes: ___________
- [ ] Redirect to: ___________

---

## Decision 5 — Targeting reference location

**Reversibility: medium-low.** Selector references are data — mass-swap is mechanical if needed.

### Context

Targeting (`findEnemiesWithin`, `findNearbyAllyWithAura`) appears in nearly every test ability. Three places it could live:

- **A. Inline functions per ability.** Fast to write, no reuse, scattered.
- **B. Named selector library.** `'nearest_enemy_in_range'` as a string reference. Reusable. Abilities reference selectors the way they reference effects.
- **C. Selector DSL.** `{ type: 'enemy', within: 80, sort: 'lowest_hp', limit: 3 }` as data.

### Recommendation: B (named selector library)

DSL is over-engineering for current scope; inline doesn't scale; named selectors are the middle path.

### Sub-gap: where does the selector reference live?

Inside ability data, e.g.

```ts
'jaw_strike': {
  dmgType: 'sharp',
  targeting: 'nearest_enemy_in_range',
  tiers: { ... }
}
```

Or as a runtime parameter the combat system passes into `queueAbility`?

**Recommendation: inside ability data, matching the "effects referenced by string" precedent.** Keeps ability files pure configuration with consistent shape. Combat system reads `ability.targeting`, calls the named selector, queues events for each result.

### Sign-off

- [ ] Approved as recommended (named selector library, references in ability data)
- [ ] Approved with changes: ___________
- [ ] Redirect to: ___________

---

## Decision 6 — Test strategy

**Reversibility: trivial.** Add whatever's missing whenever.

### Context

What does "this layer is done" mean?

### Recommendation: all three, in order

1. **Unit tests** as you build each layer — fast, isolated, catches regressions per concern
2. **Integration tests** as you migrate each unit — slow, holistic, validates real behavior
3. **Property tests** on the queue resolver after it stabilizes — finds edge cases nobody thinks of

### Pure-function principle (carry forward from Capacity)

Pure-function tests are disproportionately valuable. [Capacity.ts](../src/systems/Capacity.ts) got 20 tests in 50 lines because its three functions were stateless and took plain data — no Phaser, no `IUnit` mocks, no scene setup. Test file: [Capacity.test.ts](../test/systems/Capacity.test.ts), 10ms total run time.

**Layer 1–2 of the rewrite have this exact shape** — attribute reads, resistance lookup, penetration tier shift, base damage calculation. All can be pure functions over plain data.

**Principle:** every layer's core computation should be a pure function that's unit-testable without instantiating Phaser. Not always possible (effect lifecycle hooks need entity state), but when it is, it pays off linearly in test coverage for near-zero cost. Push as much logic into pure helpers as possible, keep stateful glue in thin coordinator classes.

### Sign-off

- [ ] Approved as recommended (unit → integration → property; pure-function principle)
- [ ] Approved with changes: ___________
- [ ] Redirect to: ___________

---

## After sign-off

Once all 6 decisions are locked:

1. **Doc 2 — `COMBAT_REWRITE_PLAN.md`** — written against the approved answers. Layer dependency graph, migration phases with exit criteria, risk register, out-of-scope list, rough effort estimate. ~600–1000 lines.
2. **Doc 3 — `MECHANICS_ROADMAP.md` update** — replace the PENDING RESTRUCTURE block with the actual program of work (8–9 items: SpatialIndex, ECS-lite, Layer 1, Layer 2, ... Pipeline migration, Unit migration, Balance v1).
3. **Handoff to executor** — Doc 2 ships with implementation kickoff for Phase 1.

If any decision is redirected, Doc 2 waits. That's why this split exists — locking the wrong answers into 800 lines of plan is the failure mode it prevents.

## Out of scope (already decided, restated for fresh sessions)

- **World rollback / divergent timeline abilities** (Butterfly Effect class) — combat rewrite cannot enable these. Requires deterministic simulation engine spanning AI/movement/RNG/particles. Separate workstream if ever pursued.
- **AI plan** — deferred until after Combat Rewrite + Balance v1. See [MECHANICS_ROADMAP.md](../active/MECHANICS_ROADMAP.md) sequencing.
