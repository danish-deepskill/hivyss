# Hivyss Mechanics Roadmap

> **Current strategic priority.** Created 2026-04-12 after AI Hive v2 plan was deferred (see [AI_PLAN.md](AI_PLAN.md) status block). The user judged that building smart AI on top of incomplete primitives is wasted work. This document tracks the foundational mechanics work that needs to land **before** AI v2 resumes.
>
> **How to use this doc:** Read top to bottom. Items are in priority order. Each item has a status, scope, open design questions, and (where applicable) my recommended answers. Update status as work progresses. When all items are ✅ done, the AI v2 plan unblocks.

> ## ✅ Combat Rewrite Program ACTIVE (locked 2026-04-12)
>
> The combat rewrite design phase completed 2026-04-12. Two design docs are locked and govern all combat work:
>
> - **[COMBAT_REWRITE_DECISIONS.md](../archive/COMBAT_REWRITE_DECISIONS.md)** — 6 load-bearing structural decisions (entity model, coexistence strategy, spatial index, pipeline coexistence, targeting, test strategy). All approved 2026-04-12 after executor review.
> - **[COMBAT_REWRITE_PLAN.md](../archive/COMBAT_REWRITE_PLAN.md)** — 10-phase implementation plan with exit criteria, deliverables, tests, reversibility, and effort estimates per phase. Approved 2026-04-12 after executor review + revisions (TargetDummy validation, Phase 4 estimate bump, post-rewrite gap acknowledgment).
>
> **Item 2 below is the combat rewrite program.** It is a single roadmap item with 10 sub-phases tracked inside it. Items 4–5 (old Balance / Playtest) are absorbed into Phase 10 of the program; Item 4 in this restructured roadmap is now AI Hive v2 (which still sits after the rewrite). The old "counter matrix / keyword system" framing for Item 2 is dead.
>
> **For fresh sessions:**
>
> 1. Read this doc for top-level program tracking
> 2. Read [COMBAT_REWRITE_PLAN.md](../archive/COMBAT_REWRITE_PLAN.md) for the active phase and its deliverables
> 3. Read [COMBAT_REWRITE_DECISIONS.md](../archive/COMBAT_REWRITE_DECISIONS.md) when you need to understand WHY the architecture is shaped this way
> 4. **Phases 1-6 + 7a + 7b ✅ ALL DONE 2026-04-13.** Eight consecutive clean phases. Phase 7b shipped Skitterling + Cinderfly migration + 4 preflight fixes + burn cadence fix + a pre-existing Mendwing healTimer bug fix caught via live smoke testing. Phase 2 resistance data now drives calculate-phase output in production for the first time (verified via Cinderfly vs Legionnaire 32-37 damage range matching the heat:weak 1.15× multiplier). Phase 8 is in pre-kickoff design session — 7 architectural sub-decisions to lock before the fresh executor starts.
> 5. AI Hive v2 (Item 4) remains deferred until the rewrite program completes

## Current state of the game (snapshot 2026-04-12)

- **Roster**: 11 normal units (committed `4181b66`) + 7 alpha units. Tier curve T1-T4. All 4 roles covered.
- **AI**: `AIHiveController` v1 — weighted random, no sensors, no goal layer. Sufficient as test opponent. Committed `b864d42`.
- **Combat system**: Functional but not audited. Has had bugs surface during AI work (e.g. player units couldn't attack enemy base — fixed in `4181b66` lineage).
- **Economy**: Nectar income + ramp + max cap. Per-unit costs. Tuned by feel.
- **Incubation**: Larvae generate over time, units queue into chambers, hatch on timer. Mirrored on AI.
- **Routes**: Air / land / tunnel exist. RouteMatrix governs what can hit what. Underused gameplay-wise.
- **Abilities**: 4 player abilities (nuke, wall, slow, repair). AI does not cast.
- **Run system**: Roguelike node map, seeded battles, rewards, branching paths. Functional.

## What's missing (the work tracked below)

| Item | Status | Priority |
|---|---|---|
| 1. Capacity system | ✅ DONE 2026-04-12 | P0 |
| 3. Combat audit pass | ✅ DONE 2026-04-12 (legacy baseline for Item 2 rewrite) | P1 |
| 2. Combat Rewrite Program (10 phases + Phase 7 split) | ✅ DONE 2026-04-17 (634 tests, all 10 phases shipped, architecture closed). Balance v1 number tuning iterative, AI Hive v2 unblocked. | P0 |
| 4. AI Hive v2 resume | ⏳ UNBLOCKED 2026-04-17 — combat rewrite DONE, primitives live. See AI_PLAN.md. | P1 |
| 5. Balance v2 (post-AI tuning) | BLOCKED on 4 | P2 |
| 6. New content / Beta geneline | BLOCKED on 5 — supersedes by 7 for scope discipline | P3 |
| 7. MVP geneline slice (v1 scope lock) | 📋 BACKLOG — defines v1.0 vertical-slice geneline set | P2 |
| 8. Effect System v1 | 📋 BACKLOG — 12-effect body-language layer (Qud-inspired) | P2 |
| 9. Territory & Garrison System | 📋 BACKLOG — non-linear map, node capture, garrison/expedition split, raid events, ally quests | P2 |
| 10. Royal Queen-Avatar Implementation | 📋 BACKLOG — unified Queen/Avatar/Hero caste; 4-mode state machine; style package; direct-control hero | P1 |
| 11. Gene Library & Roster Expansion | 📋 BACKLOG — gene acquisition, chamber tuning, reproduction lore mechanics, individual identity (Tier B) | P1 |

---

## Item 1 — Capacity System (P0, ✅ DONE 2026-04-12)

> **Status:** Implemented in `b62bd73`, closed out in follow-up commit. 20 unit tests passing, browser playtest passed all 7 scenarios (deploy rejection, cap bar, cap-blocked card visual, death frees cap, cancel refunds cap, AI never over-caps, hive full at exact 20/20). See `CAPACITY_DESIGN.md` for the full mini-spec.
>
> **Architectural deviation from original scope:** Built as a stateless module (`Capacity.ts`) with 3 pure functions, NOT as a `CapacityManager` class. Reasoning: capacity is fully derived state (sum over live units + chambers), so a class would own zero fields. Confirmed with user. See `CAPACITY_DESIGN.md` for full reasoning.
>
> **Locked card UI principle:** the `cap-blocked` card state is the most important UI element in the system (per finding #9 — chamber × cap asymmetry means players will frequently see "chamber empty but I can't queue heavy"). Implemented as a distinct red pulse + "HIVE FULL" overlay that obscures the icon, NOT as a grey can't-afford state. Do not regress to grey.

### Why
Without capacity, "build a balanced army" has no real meaning. Players can spam any unit they can afford, and the AI does the same. Capacity forces composition decisions: do I field 8 grubs or 2 hulks? It's the missing primitive that makes role/comp/counter decisions matter.

Per `GAME_DESIGN.md`, this was always intended — users and AI should fight for limited cap slots, where each unit's cap cost reflects its tactical weight (swarm=cheap, elite=expensive).

### Design decisions (LOCKED 2026-04-12)

1. **Where does cap live?** → `UnitDef.cap?: number` per-unit field (v1). Keyword system deferred.
2. **What counts against cap?** → **Deployed + incubating**. Larvae are uncommitted so they don't count.
3. **Hard or soft cap?** → **Hard**. Deploy rejected if it would exceed. Clean and learnable.
4. **Cap value source?** → **Explicit per-UnitDef**. No auto-formulas. Designer-controlled.
5. **Symmetric?** → Same max cap for player & AI. Tunable per battle (starting **20**). Run-difficulty scaling deferred.
6. **UI feedback?** → Three elements:
   - Cap bar (primary, top of screen next to nectar bar)
   - Per-card warning when deploy would exceed
   - Field count indicator
7. **Edge cases?**
   - Death frees cap **immediately**
   - Cancelling incubation **refunds cap** (plus existing nectar refund)
   - AI v1 gets minimal cap-aware filter in `getAffordableUnits()`

### Still open (needs decision during implementation)

These are smaller implementation-level questions that surface when writing code. Resolve inline with user as they come up:

1. **Cap values per unit** — the suggested table below is a STARTING point, not final. Should be reviewed unit-by-unit before locking. Expect tuning during balance pass.
2. **Card warning visual** — red border? Greyed out? Crossed out with "CAP FULL"? Pick during UI implementation.
3. **Deploy rejection feedback** — when over-cap deploy is rejected: silent no-op? Error sound? Toast message? Pick during UI implementation.
4. **Cap bar styling** — matches nectar bar visual language but distinct color. Blue for cap? Purple? Pick during UI implementation.

### Suggested cap values (starting point — needs user sign-off before coding)

| Unit | Role | Cost | Suggested cap | Rationale |
|---|---|---|---|---|
| Grub | dps fodder | 15 | **1** | Cheapest, designed for spam |
| Hardshell | tank | 25 | **3** | Tank premium |
| Pricker | ranged | 30 | **2** | Standard ranged |
| Skitterling | dps | 40 | **1** | Fast glass cannon, spammable |
| Mendwing | support | 50 | **2** | Support baseline |
| Domeback | tank | 55 | **4** | Mid-tier tank, heavier |
| Cinderfly | dps AOE | 70 | **3** | AOE premium |
| Longeye | sniper | 85 | **3** | Sniper value |
| Wardling | aura support | 90 | **4** | Heavy support |
| Bashguard | bruiser | 110 | **5** | Elite bruiser |
| Stormfly | chain lightning | 130 | **5** | Elite ranged AOE |

And for Alpha (need values too):

| Unit | Role | Cost | Suggested cap |
|---|---|---|---|
| Grunt | fodder dps | 25 | **1** |
| Mandible | balanced dps | 40 | **2** |
| Needler | ranged dps | 50 | **2** |
| Bombardier | AOE dps | 60 | **3** |
| Legionnaire | heavy tank | 85 | **4** |
| Ravager | berserk dps | 90 | **3** |
| Centurion | commander support | 140 | **5** |

**Max cap of 20 means:**
- Pure swarm: 20 Grubs (all-cap-1) — max density
- Balanced comp: 4-6 mixed units
- Elite comp: 4 Bashguards (20/20) or 2 Centurions + fodder
- Most interesting composition decisions happen at cap 18-20

### Scope estimate (final)
- `UnitDef.cap?: number` field + cap on Unit class — 4 lines
- `Capacity.ts` module with 3 pure functions — 50 lines
- Deploy validation in `GameManager.playerSpawn` — 4 lines
- AI v1 cap-aware filter in `AIHiveController.getAffordableUnits` — 4 lines + constructor `unitsProvider` thread-through
- Cap values applied to all 18 unit defs — 18 lines
- Cap bar DOM (stacked under nectar, cyan/teal, color-shifts amber→red) in MenuUIScene — ~40 lines
- `cap-blocked` distinct red card state + "HIVE FULL" overlay (CSS in `index.html`) — ~10 lines
- `[N]` cap label on UnitCard — 2 lines
- `Capacity.test.ts` — 20 unit tests covering death-frees, cancel-frees, AI integration scenarios
- Vitest dev dep + `test` script

Final total well under the 250-line estimate because the module-of-helpers approach replaced the planned ~80-line manager class.

### Files touched
- `app/src/config/Constants.ts` — `MAX_CAPACITY = 20`
- `app/src/types.ts` — `UnitDef.cap?: number`
- `app/src/entities/Unit.ts` — `cap` field, copied from def in `init()`
- `app/src/units/normal.ts` — cap on all 11 units
- `app/src/units/alpha.ts` — cap on all 7 units
- `app/src/systems/Capacity.ts` — NEW (module of pure helpers)
- `app/src/systems/Capacity.test.ts` — NEW (vitest unit tests)
- `app/src/systems/GameManager.ts` — deploy rejection + AI constructor call site
- `app/src/systems/AIHiveController.ts` — `unitsProvider` constructor param + cap-aware filter
- `app/src/scenes/WorldScene.ts` — `cap.used` / `cap.max` registry writes
- `app/src/scenes/MenuUIScene.ts` — stacked cap bar + cap-blocked card state
- `app/src/ui/UnitCard.ts` — `[N]` cap label
- `app/index.html` — `.cap-blocked` and `.ucap` CSS
- `app/package.json` — vitest dev dep + `test` / `test:watch` scripts
- `app/src/CAPACITY_DESIGN.md` — NEW (mini-spec written before coding, documents the design call)

### Suggested cap values (applied — adjust during balance pass)

Normal: Grub 1, Hardshell 3, Pricker 2, Skitterling 1, Mendwing 2, Domeback 4, Cinderfly 3, Longeye 3, Wardling 4, Bashguard 5, Stormfly 5.
Alpha: Grunt 1, Mandible 2, Needler 2, Bombardier 3, Legionnaire 4, Ravager 3, Centurion 5.
Max cap: 20 (player and AI both).

Pattern: roughly `ceil(cost / 25)` with tank/elite premium. With chamber max of 6, cap binds harder than chambers for elite comps (4 Bashguards = 20 cap, 2 chambers sit empty); chambers bind harder than cap for swarm comps (6 Grubs = 6 cap, plenty of headroom). This asymmetry is intentional design — production rate vs. army weight gate different ends of the spectrum.

### Findings recorded during implementation
- **Unit class does not store a `UnitDef` reference.** It copies select fields in `init()` (e.g. `this.cost = def.cost || 0`). Added `cap: number` following the same pattern. Future work needing more def fields on units will follow this convention.
- **`AIHiveController` had no reference to `gameManager`.** Threaded a `unitsProvider: () => readonly Unit[]` getter through the constructor — the AI calls it whenever it needs to compute its own enemy cap usage. Cleaner than coupling to GameManager directly.
- **`unitDied` event still unfired.** Capacity didn't need it (derived state), so this remains tech debt for whoever needs death notifications next.

### What's still open (deferred to balance pass)
- Cap value tuning (Item 4)
- **Centurion cost drift flagged for balance pass**: roadmap table originally suggested cost=140, but `alpha.ts` has cost=100 and has for some time (this was not changed during capacity work — only the `cap` field was added). Roadmap vs. code drift, not a regression. Decide during balance pass which number is correct.

---

## Item 2 — Combat Rewrite Program (P0, 🚧 ACTIVE)

> **Status:** **Phases 1-6 + 7a + 7b ✅ DONE 2026-04-13.** Eight consecutive clean phases. Phase 7b shipped Skitterling + Cinderfly migration + 4 preflight fixes (burn dps+duration parity, burn.stackable→false, post_apply comment correction, Cinderfly primary-spread filter) + burn cadence fix (time-accumulator) + pre-existing Mendwing healTimer fix (legacy field-storage bug caught via Phase 7b smoke test; Combat Audit Finding 7 corrected). **Phase 2 resistance milestone:** first phase where resistance data drives calculate-phase output in production, verified via Cinderfly vs Legionnaire 32-37 damage range (base 30 × 1.15× heat:weak multiplier ± [-3, +2] variance → [32, 37]). Phase 8 is in pre-kickoff design session — 7 architectural sub-decisions to lock (handler-precedence fork, per-target damage falloff, passive-ability migration pattern, getAtk integration, damage-type default effects lookup, knockback layered model, AOE-effect-rider primitive).
>
> **Authoritative spec:** [COMBAT_REWRITE_PLAN.md](../archive/COMBAT_REWRITE_PLAN.md). The plan is the source of truth for phase deliverables, exit criteria, tests, and reversibility. This roadmap entry tracks top-level progress; the plan tracks the work.

### Why this replaces the old "counter matrix" item

The old Item 2 framing ("counter matrix / keyword system") was discovered mid-session to be a misframing. [DESIGN_PATTERNS.md §460](../reference/DESIGN_PATTERNS.md#L460) and [GAME_DESIGN.md §715](../reference/GAME_DESIGN.md#L715) document a fully-designed 5-layer combat architecture that the project always intended as the eventual replacement for the current combat system. The "counter matrix" is just one piece of that (Layer 1: damage types + Layer 2: resistance tiers); the rest of the architecture (data-driven abilities, lifecycle effects, modifier stacking, event-driven pipeline) is unrelated to counters and also needs to be built.

20 abilities tested across 4 design rounds (rounds 1–4 of the design phase, 2026-04-12) validated the architecture and surfaced 4 additional gaps beyond the original spec: WorldEntity (zones/projectiles/pylons), Resources (charges/ammo), pending events (delayed/grouped resolution), persistent unit state (Soul Graft / identity changes). The combat rewrite is now **8 layers + pipeline + 3 cross-cutting concerns**, all driven by concrete validation.

### Why a program, not a single item

The rewrite is too large for one item. 10 phases, 29–40 executor sessions, 6–10 weeks real-world. Each phase is independently reviewable, has its own exit criteria, and can be reversed without restarting the program. Phase ordering is **option (b) — minimize churn** — simplest units migrate first, complex units last, foundation work is invisible to the player for the first half.

### Phase status

| Phase | Description | Status |
|---|---|---|
| 1 | Foundation (SpatialIndex + ECS-lite + TargetDummy validation) | ✅ DONE 2026-04-12 |
| 2 | Static layers (Attributes + Damage Types) | ✅ DONE 2026-04-12 |
| 3 | Ability data + targeting | ✅ DONE 2026-04-12 |
| 4 | Pipeline scaffolding + wrapper (THE validation moment) | ✅ DONE 2026-04-12 |
| 5 | Effects + Modifiers + Resources + Pending + Persistent | ✅ DONE 2026-04-13 |
| 6 | Unit migration tier 1 (Grunt, Mandible, Needler, Pricker, Hardshell, Domeback) | ✅ DONE 2026-04-13 (main + 2 follow-ups complete) |
| 7a | Effect primitives (heal subscriber, apply-effects subscriber, DOT accumulator, burn.onTick live, updateEffects wired into resolve) — **zero unit migrations** | ✅ DONE 2026-04-13 |
| 7b | Unit migration tier 2 (Skitterling + Cinderfly) — consumes 7a primitives, 4 preflight fixes + burn cadence fix + Mendwing healTimer fix shipped | ✅ DONE 2026-04-13 |
| 8 | Unit migration tier 3 (9 units: Bashguard, Ravager, Legionnaire, Wardling, Centurion, Bombardier, Stormfly, Mendwing, Longeye — 5 stages) | ✅ DONE 2026-04-17 (688 tests, +231 from Phase 7b, 2 smoke-caught fixes, 1 remaining legacy hook) |
| 9 | Legacy combat removal | ✅ DONE 2026-04-17 (694 tests, Batch 1+2+3 landed) |
| 10 | Balance v1 — architectural | ✅ DONE 2026-04-17 (634 tests, 5 batches: variance redesign, baseDamageOverride removal, knockback coordination, Unit.effects Map retirement, renames + base-attack variance + aggressive comment sweep). **Combat rewrite program CLOSED.** |
| — | **Balance v1 — number tuning** | ⏳ Next — iterative playtest-driven work, not a phase |

### Locked decisions (from COMBAT_REWRITE_DECISIONS.md)

1. **Entity model:** ECS-lite, components-as-data flavor. `HasModifiers` first-class.
2. **Coexistence:** A+B hybrid — layer flags 0–5, unit-by-unit migration. Attacker owns the pipeline at the boundary.
3. **SpatialIndex:** Sweep-and-prune over X. One index with route filter at query time.
4. **Pipeline coexistence:** Wrapper. `hitUnit` → `queueAbility('legacy_basic_attack', ...)`. Precondition: Layers 1–3 scaffolded first.
5. **Targeting:** Named selector library, references inside ability data.
6. **Test strategy:** Unit → integration → property; pure-function principle.

### Out of scope (program-level)

- World rollback / Butterfly Effect class abilities (requires deterministic simulation engine, separate workstream if ever pursued)
- AI Hive v2 (Item 4 — sequenced after this program completes)
- New unit content / new genelines (Item 6 — sequenced after Item 5)
- Visual rewrites (effect visual system stays as-is)
- Roguelike map / run structure changes
- Capacity system changes (Item 1 is done, don't touch)
- Final balance (Phase 10 is v1; final tuning is Item 5 — Balance v2)

### Effort estimate

29–40 executor sessions, 6–10 weeks real-world. Phase 4 is the highest-risk phase (validation moment for the entire pipeline). Phase 8 is the most likely to surface architectural gaps (complex units exercise the unproven parts of the architecture).

### Stop-and-report rule

If any phase surfaces an architectural gap that cannot be expressed using the existing primitives, **STOP and escalate.** Patches are forbidden. The orchestrator decides whether to extend the architecture (sub-phase), fall back to a hook escape hatch (and document why), or restructure. This rule is load-bearing — it's how the rewrite avoids dying by a thousand patches.

---

## Item 3 — Combat Audit (P1, ✅ DONE 2026-04-12)

> **Status:** Audit complete. Source-of-truth reference landed at `app/src/COMBAT_REFERENCE.md` — Item 2 counter matrix design hinges on it.
>
> **Summary:** 9 findings surfaced (1 false positive, 1 real-fix, 7 deferred as tech debt with file:line refs). 11 subsystems verified clean. No structural changes to `CombatSystem.ts`. Scope discipline held — no refactors, no new features.

### Result
- **1 false positive** (Finding 5) — agent claimed Stormfly `hitCount` leaked across pool cycles, but `Unit.init()` already resets it at line 173. Verified before touching code.
- **1 fix applied** (Finding 3) — Centurion rally fade-on-exit, committed as `ea29e1f`. Added `_ralliedByUid` scoping for multi-centurion safety. Playtest scenario in the commit message.
- **1 new doc** — `COMBAT_REFERENCE.md` committed as `74cb2bf`. 224 lines. Damage pipeline (9 steps with file:line), hook firing order, status effects table, route matrix, poise rules, death ordering, `afterHit` contract note for Finding 2.
- **7 deferred findings** — see "Combat audit tech debt" section below.

### Key findings documented in COMBAT_REFERENCE.md
- Damage variance is **asymmetric `[−3, +2]`**, not `±3` as you'd expect from code-reading (`CombatSystem.ts:113`).
- `afterHit` fires unconditionally — including after `onAttack`-defined attacks. No current unit hits this contract, but future implementers should not rely on `afterHit` being suppressed.
- Base attacks bypass `hitUnit`. `modifyDamage` and `modifyAllyDamage` do NOT apply to base damage. **Critical for Item 2**: counter matrix must slot in before the branch to cover both unit-vs-unit and unit-vs-base paths.
- DOT ticks (poison/burn) pass through `hitUnit`, so they inherit aura modifiers. Probably intended.

### Verified clean (do not re-audit)
Attack timing (foreswing/backswing/cancel), `atkCd` reset math, poise accumulation (correctly skips DOTs), status effect DOT accumulator thresholds, effects Map getter/setter consistency, `onSpawn` single-fire via `_spawned`, `onUpdate` return semantics, `onAttack` replacement semantics, `CombatContext` field completeness, damage pipeline order (9 steps), route validation (target-find + damage-time).

---

## Item 4 — AI Hive v2 (P1, DEFERRED until Item 2 completes)

> **Status:** Deferred 2026-04-12. Architecture preserved in [AI_PLAN.md](AI_PLAN.md). Sequenced after Item 2 (Combat Rewrite Program) because AI utility scoring depends on combat rewrite primitives.

### Why this comes after Item 2

AI v2 has three hard dependencies on combat rewrite deliverables that make it impossible to build correctly before the rewrite ships:

1. **`previewDamage()` for utility scoring** — AI needs to compute "what damage would this attack do?" without actually applying it. That's a combat rewrite Phase 4 deliverable (queue-based pipeline + dry-run preview). Without it, AI is guessing; with it, AI scores deployment options against real numbers.
2. **Ability data, not hooks** — AI personalities score abilities by stats. "Aggressive favors high-DPS units" requires DPS to be queryable from ability tier tables, not buried in `combat?` hooks. That's combat rewrite Phase 3.
3. **Stable balance numbers** — combat rewrite changes how damage flows. Tuning AI against numbers about to be replaced is throwaway work. Combat rewrite Phase 10 (Balance v1) must complete first.

Building AI on legacy combat then rewriting combat means re-tuning AI from scratch. Better to wait.

### What this unlocks

When AI v2 ships, the user gets:
- Smart opponents that meaningfully differ by personality (aggressive / defensive / swarm)
- AI deployment decisions backed by real damage previews
- Difficulty scaling that comes from AI quality, not stat inflation

### Action items when this resumes

1. Re-read [AI_PLAN.md](AI_PLAN.md) — architecture is preserved verbatim
2. Verify the combat rewrite primitives needed (previewDamage, ability data, modifier system) are present and working
3. Start at Phase 0 (debug infrastructure) of the AI plan
4. Sequence into the existing AI plan phases

---

## Item 5 — Balance v2 (P2, BLOCKED on Item 4)

### Why this is separate from Phase 10 of Item 2

Phase 10 of the combat rewrite is "Balance v1" — tuning numbers against the new pipeline. But Phase 10 happens BEFORE AI v2 ships, which means Phase 10 tunes against WaveManager (a dumb adversary), not against real AI. The numbers from Phase 10 will feel wrong once AI provides real pressure.

Balance v2 is the final tuning pass, run AFTER AI v2 ships, with real AI as the adversary.

### Approach when unblocked

1. Run AI vs AI battles in a sandbox/lab to gather win-rate data
2. Tune costs, HP, atk, atkRate, range, cap value, resistance, ability tier tables
3. Target: no unit dominates, no unit is useless, every unit has a clear best-case scenario
4. Per-role baseline targets:
   - Tank should survive ~3x its cost in DPS
   - Ranged should kill ~1.5x its cost in tanks before being killed
   - Support should enable 2-3 other units to over-perform
   - DPS should kill ~equivalent cost in equal exchanges
5. Difficulty curve calibration against AI personalities

### Action items when this resumes

- Verify AI v2 is stable and providing meaningful adversary signal
- Run automated AI vs AI battles, collect win rates per matchup
- Tune iteratively, document each tuning pass
- Solo playthrough of full runs to validate "feel"

---

## Item 6 — New content / Beta geneline (P3, BLOCKED on Item 5)

### Why this is last

Adding new units mid-rewrite means double-touching every unit. Adding new genelines means scaling decisions need final balance numbers. Both wait until Item 5 (Balance v2) is stable.

### Scope when this resumes

- Beta geneline (the second of 24 planned genelines)
- New unit subfolder structure (`units/<geneline>/`) per [CLAUDE.md](../../../CLAUDE.md) future plan
- Mutation mechanic (depends on Comp System pattern, also future)
- Possibly new abilities surfacing post-Combat-Rewrite that the architecture now supports

### Action items when this resumes

- Decide which geneline ships next (Beta is the planned second, but the user may pivot)
- Apply the lessons from Alpha + Normal genelines (naming convention, trait semantics, 3-tone shading, cap values)
- Restructure `units/` into per-geneline subfolders
- Validate against the final combat numbers from Item 5

---

## Item 7 — MVP Geneline Slice (P2, 📋 BACKLOG)

> **Added 2026-04-19** during cosmology review. The full Hivyss cosmology specifies ~58 genelines × ~7 units = ~400+ base units, plus evolution branches and mutation forms. At current solo-dev velocity (18 units built over the project lifetime), the full vision is a 10-20 year build. Item 7 locks the **v1 vertical slice** — the minimum geneline set that demonstrates the full design language and cosmology in microcosm.

### Why this is on the roadmap now

- The alphabet + faction + tier refinements in `lore/HIVYSS.md` v1.1 establish what the cosmology *requires structurally*. Item 7 defines what the cosmology *ships in v1.0*.
- Without a locked MVP, Item 6 ("new content / Beta geneline") risks expanding into all 58 genelines before the battle mechanics v1 spec stabilizes.
- Pairs with Item 8 (Effect System v1) to define "what ships for the vertical slice."

### Scope

Lock a 5-6 geneline set spanning the cosmology's full design language:

- **1 Classic-tier geneline** — α Alpha (already shipped — the disciplined military baseline)
- **2 Distinct-tier genelines** — β Multitudes (swarm) + θ Feeders (biomass consume-to-upgrade)
- **1 Alien-tier geneline** — pick the cheapest Alien to prototype (ν Beacons OR λ Mirrors; ν is cheaper as a prototype)
- **1 Core-boss geneline** — ω Whole (the Core's answer; contains all 5 primordial aspects at a conceptual level)
- **1 Phoenician dark-mirror** — ℵ Aleph as the shadow of α (proves the dark-mirror system works)

Additionally, mark all other 50+ genelines as **post-launch** — they exist in the doc as proof of depth (Tolkien lesson) but are not authored until v1.0 proves the cosmology is playable and finds an audience.

### Action items when this resumes

- Lock the exact MVP geneline list with user (the 5-6 above is a proposal; user may pivot)
- Author full 9-axis geneline spec (per `lore/HIVYSS.md` §6) for each MVP geneline
- Define per-geneline unit counts and tier distribution within MVP scope
- Create `app/docs/MVP_GENELINE_SPEC.md` when specs settle
- Supersede Item 6 "Beta geneline" — β is now part of the MVP slice, not a standalone item

### Open design questions

- Should ω be a shipped geneline or deferred as post-MVP? (Currently in MVP — but ω is architecturally heavy because it bundles 5 primordial aspects)
- Should Husk/Archaic appear in v1.0 at all? (Currently no — defer all Reckoning content)
- Should Phoenician appear beyond the one ℵ shadow? (Currently no — ℵ only for v1)
- What's the **minimum unit count per geneline** for a legibility test? (Guess: 5-7 per geneline, matching α)

### Estimated v1.0 unit count

- 6 genelines × ~6 units/geneline = ~36 units
- Existing shipped: 18 units (α + Normal)
- Remaining: ~18 new units to author
- At current velocity: tractable for 2026

---

## Item 8 — Effect System v1 (P2, 📋 BACKLOG)

> **Added 2026-04-19** during design review of Caves of Qud's effects pattern. Hivyss currently has damage types (9) with per-ability effects, but lacks a unified "body-language" effect system where each effect has a mechanical definition + narrative flavor + visual signature. This item captures the 12-effect v1 that builds the foundation.

### Why this is on the roadmap now

- Your cosmology is **body-as-planet**. Qud's effect design (effects as body-language, not stat-mods) maps directly to your premise more than any other game's pattern.
- Biome environmental rules (fog, heat, gravity, corruption) per `lore/HIVYSS.md` §8 are currently invisible modifiers — need to become visible effects on units.
- Mutation system (future) needs progressive/transformation effects as a foundation.
- Pairs with Item 7 to define "what the MVP slice's combat feels like."

### Scope (v1 = 12 effects)

Each effect has: mechanic + flavor sentence + visual signature (particle color, body tint, silhouette change).

| Effect | Mechanics | Flavor sentence |
|---|---|---|
| **Burning** | 2 HP/turn (tier-scaled) | *Chitin splitting from within.* |
| **Poisoned** | 2% max HP/turn | *Hemolymph curdling.* |
| **Frozen** | Cannot move, AV up | *Joints seized by cold.* |
| **Stunned (electric)** | Cannot act 1s | *Nerve-flash.* |
| **Fear (psychic)** | Flees 2s | *Hive-bond breaking.* |
| **Void-erased** | Buffs stripped | *Reality forgets this form briefly.* |
| **Cleansed (holy)** | DOTs removed, +regen | *Burned clean.* |
| **Husking** | Vulnerable 1s, then +HP | *Shedding what no longer fits.* |
| **Spore-bloated** | Death AOE, +damage | *Carrying tomorrow's swarm inside.* |
| **Swarm-lust** | +atkSpeed, -accuracy | *Killing has taught the body wanting.* |
| **Hive-severed** | -morale, flee chance | *The commander's scent is gone.* |
| **Mutating** | Transforming, uninterruptible | *In the process of becoming.* |

### Out of scope for v1

- Mental/social states beyond Fear + Hive-severed (defer "lovesick," "shamed," etc. to v2)
- Environmental effects (biome rules applying as visible unit effects) — v2
- Phase/reality effects — v2+
- Equipment/item-level effects — no items shipped yet; N/A
- Progressive effects beyond Mutating + Husking — v2

### Action items when this resumes

- Write `app/docs/EFFECT_SYSTEM_V1_DESIGN.md` with the 12-effect spec
- Audit existing damage-type → effect mapping (burn, poison, freeze, stun, fear already exist implicitly)
- Define the `EffectDef` shape (mechanics, flavor string, visual signature reference)
- Integrate with existing `EffectVisualSystem` (no redraw of unit draw functions)
- Write Vitest coverage per effect
- Audit every existing ability to ensure it applies effects via the new system, not bespoke logic

### Open design questions

- Does "Flavor sentence" belong in `EffectDef` directly, or in a locale-like string table? (Flat in EffectDef for v1; extract when localization is considered)
- Should Husking be mutually exclusive with Burning? (Probably yes — husking implies an intact carapace cycle; burning = carapace already compromised)
- Does Hive-severed trigger on commander-role death specifically, or on any T4+ ally death? (Probably role-specific — only commanders grant the severed effect on death)
- How does Swarm-lust interact with β's Eternal Swarm T6 ability? (Open — test once ω-level abilities exist)

### Dependencies

- Should ship AFTER Item 4 (AI Hive v2) so AI can reason about effects as first-class game state
- Should ship BEFORE Item 7 (MVP geneline slice) because MVP genelines' abilities will want to emit these effects
- Parallel-authorable once battle mechanics v1 spec locks

---

## Item 9 — Territory & Garrison System (P2, 📋 BACKLOG)

> **Added 2026-04-19 session 2.** Captures the non-linear strategic-layer mechanics designed in `lore/HIVYSS.md` §9 "Territory & garrison system."

### Scope

- **Node capture mechanics** — only hostile-faction hives (Phoenician, or Hostile/Vengeful rep Greek/Archaic) can be captured
- **Captured territory states** — generic outpost (no Royal) vs styled sub-hive (Royal placed)
- **Expedition force vs garrison broods** — two separate unit pools; expedition travels, garrison defends
- **Conquest loot** — 4 categories (gene-imprint, egg, larva, specimen) with distinct mechanical meaning
- **Hostile raid events** — periodic rolls for enemy factions to attack captured nodes; 3 player responses (intercept / rush / let garrison fight alone)
- **Allied faction territory & quests** — 5 ally quest categories (defend ally, capture-for-ally, escort, joint assault, artifact delivery)
- **Enemy faction offensive** — factions expand, reinforce, besiege, occasionally raid Home Hive (game-ender)

### Dependencies

- Blocks: Long-form run feel (strategic layer carrying 8-15 hours of gameplay)
- Depends on: AI Hive v2 (factions need strategic-map AI beyond battle AI)
- Interacts with: Item 10 (Royal defines styled hives), Item 11 (gene library grows via conquest loot)

### Action items when this resumes

- Write `app/docs/TERRITORY_SYSTEM_V1_DESIGN.md`
- Define node-capture battle conditions (when does a battle trigger capture option?)
- Define garrison slot count per node (fixed? scales with hive level?)
- Define raid event frequency and targeting rules (deterministic schedule vs random roll?)
- Define ally-quest templates and how they interlock with reputation progression
- Define Home Hive invasion trigger conditions (rare, late-game, high-stakes)

---

## Item 10 — Royal Queen-Avatar Implementation (P1, 📋 BACKLOG)

> **Added 2026-04-19 session 2.** Captures the unified Queen/Avatar/Hero Royal caste designed in `lore/HIVYSS.md` §8.

### Scope

- **4-mode state machine** — docked / traveling / in battle / dead (respawn)
- **Style package (5 facets)** — visual architecture, passive aura, unit production, pheromone signature, neighbor-reputation effect
- **Direct-control combat** — WASD/click input bindings for battle mode; combat stats/abilities
- **Royal Special Bar** — charge through army kills, geneline-specific ultimate
- **Death/respawn flow** — 90-second timer, hive style fully suspended
- **Dormant-hive mechanic** — when Royal is traveling or dead, her hive's style effects are suspended (garrison still defends)
- **Multi-Royal support** — each captured node with a placed Royal becomes a styled sub-hive; acquire additional Royals via T5 evolution, Cooperative faction gift, or post-boss rewards

### Dependencies

- Blocks: ω implementation (ω is a Royal-tier encounter)
- Blocks: Item 9 (Territory & Garrison — styled hives depend on Royals)
- Depends on: Battle mechanics v1 spec, capacity system (done), combat rewrite (done)

### Action items when this resumes

- Write `app/docs/ROYAL_CASTE_V1_DESIGN.md`
- Implement 4-mode state machine as a proper Unit subclass or Comp System
- Define per-geneline Royal unit data (starting with α Supreme Commander as reference)
- Implement style package as a subscription-based effect system (Royal's presence subscribes, departure unsubscribes)
- Integrate with existing Capacity system (Royal has her own cap cost; is she counted toward cap?)
- UI: Royal HUD (charge bar, abilities, position indicator on map)
- Animation: Royal has unique idle/combat/ultimate animations

---

## Item 11 — Gene Library & Roster Expansion (P1, 📋 BACKLOG)

> **Added 2026-04-19 session 2.** Captures the gene-based roster system designed in `lore/HIVYSS.md` §11.

### Scope

- **Gene library data model** — Royal's personal collection of accessible genes; persists across battles in a run
- **9 acquisition paths** — Hive Production (passive), Allied Recruitment, Quest-gated rights, Ally gifts, Captured territory, Evolution, Discovery events, Boss unlocks, Cross-run meta
- **Chamber tuning** — Larva Chambers attune to a gene; tuned chamber produces that form
- **Vyss-egg mechanic** — Royal lays unformed eggs; chamber shapes them during incubation
- **Unit identity tiers** — Generic (gene-spawn, unlimited, death-replaceable) vs Individual (egg/specimen, named, death-permanent)
- **Individual metadata** — name, quality roll, mutation history, kill count, special abilities per Tier B unit
- **Conquest loot integration** — gene-imprint extraction (time-limited 1-2 ticks), egg/larva/specimen acquisition
- **Corruption drift** — Phoenician gene-looting adds Corruption accumulation to Royal
- **Memory Vault** (Home Hive upgrade) — physical preservation of gene library independent of Royal

### Dependencies

- Blocks: v1 roster feeling rich enough to carry 8-15 hour runs
- Depends on: Item 10 (Royal carries the library), Item 9 (conquest gives loot)
- Related to: existing Incubation/Larva system (gene expression happens during incubation)

### Action items when this resumes

- Write `app/docs/GENE_LIBRARY_V1_DESIGN.md`
- Data model: `Gene` type (geneline, formName, baseStats, abilityRefs), `GeneLibrary` on Royal, `Individual` type for Tier B
- Refactor existing UnitDef system to be gene-driven (current hardcoded roster → data-driven library)
- UI: Gene library panel at Home Hive; egg/specimen inventory UI; loot screen with clear "gene added to library" vs "individual joined roster" messaging
- Chamber tuning UI (which gene is this chamber currently producing?)
- Corruption tracking per Royal
- Named individual tracking (names, histories, death permanence)

---

## Decision log

- **2026-04-12** — User questioned whether AI Hive v2 was premature given missing mechanics (capacity, combat completeness). I agreed. Pivoted to mechanics-first roadmap. AI_PLAN.md marked DEFERRED. This doc created.
- **2026-04-12** — Roster overhaul committed `4181b66`. Naming convention, traits, visuals all aligned. Considered "done" for v1 — further roster work blocked on mechanics.
- **2026-04-12** — Capacity system design LOCKED. All 7 questions answered (matches recommended leans): per-unit `cap` field, deployed+incubating counts, hard cap, explicit values, symmetric 20, three UI elements, immediate death-free + cancel refund + AI v1 filter. Remaining open: exact cap values per unit, UI visual style. Ready to implement.
- **2026-04-12** — Capacity implementation pre-review. Executor session surfaced 7 inline questions + 5 findings. Resolved: module (not class) for Capacity.ts, minimal Vitest for pure functions, `[5]` cap label default, stacked vertical bar layout, cyan/teal color, "HIVE FULL" rejection text, distinct red cap-blocked card state (NOT same as can't-afford). Asymmetry of chamber × cap (swarm=chamber-bound, elite=cap-bound) validated as intentional design.
- **2026-04-12** — Capacity implementation REVIEWED and APPROVED. All review criteria passed. Executor made three improvements beyond spec: structural typing in Capacity.ts for test isolation (no Unit/Chamber import dependency), dependency-injection `unitsProvider` pattern for AI (cleaner than coupling to GameManager), bonus cap bar color-shift at 80%/100% thresholds for early warning. Zero scope creep. 20/20 tests passing. TypeScript clean. Minor non-blocking notes: Centurion cost silently changed from 140 to 100 (flag for balance pass), CAPACITY_DESIGN.md still shows "SPEC" status (should be marked implemented), one awkward comment phrasing. Ready for browser playtest validation.
- **2026-04-12** — Capacity system implemented. 20 unit tests passing, production build clean. Architectural deviation: built as stateless module instead of `CapacityManager` class (capacity is fully derived state — 0 mutable fields would have made the class cargo-culted parallel structure). Two design surprises during impl: (1) `Unit` class doesn't store `UnitDef` reference, so added `cap` field copied in `init()` matching the existing `cost` pattern; (2) `AIHiveController` had no `gameManager` reference, so threaded `unitsProvider: () => readonly Unit[]` getter through constructor. Awaiting browser playtest.
- **2026-04-19** — Cosmology/tier design review. Updated `lore/HIVYSS.md` to v1.1: §3 reframed as Expression Tier (biological sophistication, not raw power) with mechanical-complexity + civilization-style columns; §6 added 9th axis (Coptic ancestry); §7 added faction groupings (5 Coptic factions containing Greek+Archaic+Phoenician); §9 reputation restructured per-faction with Phoenician universally hostile for v1; §10 added Reckoning tier (Husk as Primordial prerequisite); §17 added (The Unchosen — unused alphabets as load-bearing absence). Created `app/docs/TIER_CONTRACT.md` as the unit authoring discipline doc (tier complexity ladder, code budget per tier, ability examples per tier, visual signature rules). Added Items 7 (MVP geneline slice) + 8 (Effect System v1) to the roadmap backlog. Scope discipline call: stop adding alphabets, lock 4-alphabet cosmology, ship MVP slice.
- **2026-04-19 (session 3)** — **Cosmology pivot: Archaic ↔ Coptic roles swapped.** Updated `lore/HIVYSS.md` to v1.4. Archaic Greek (7 letters) promoted to Primordials at T10; Coptic (7 letters, expanded from 5) demoted to Husk-preserved at T5-7. Resolves long-running 5-vs-7 tension: 7 primordials emerge naturally from Archaic's letter count, 7 Coptic letters pair 1:1 with primordials as preserved-variants on the Husk. Primordial aspects rewritten as concrete 7 (Motion/Number/Voice/Gradience/Breath/Territory/Wonder) replacing abstract 5 (Being/Form/Hunger/Echo/Turning). Faction count 5 → 7. Reputation tiers 9 → 7 (Favorable + Suspicious collapsed). α Alpha retheme Primal/Foundational (was Military); δ Delta retheme Disciplined Military (was Hunters). σ-χ Greek letters' "Dark Realm bleed" framing removed (stale — Dark Realm is strictly Phoenician). Geneline count 58 → 60. Historical-genealogical coherence recovered (Archaic Greek actually IS older than Coptic). Also updated `TIER_CONTRACT.md` Primordial mechanical theses for the 7 new aspects. All map files (`lore/primordials_map.svg`, `lore/data/primordials_map.json`) will need regeneration — pentagonal → heptagonal.
- **2026-04-19 (session 2)** — Deep design session on run length, territory/garrison, castes, Royal, and gene system. Updated `lore/HIVYSS.md` to v1.3: §3 expanded with Civilization lore per tier (T0-T10 human analogs); §10 added long-form tiered run length (CoQ/DCSS-scale: Casual 2-4h / Main 8-15h / True 20-30h / Beyond 40-60h); §9 expanded into full territory/garrison system (non-linear capture, expedition/garrison split, raids, ally quests, enemy offensive, 4 conquest loot types); §8 caste table rewritten (Caste × Tier orthogonal, Elite = auto+player-trigger+smarter AI, Royal = unified Queen+Avatar+Hero with 4 modes); §11 restructured with gene terminology (gene, gene library, gene-imprint, chamber tuning, vyss-egg, specimen), 9 acquisition paths, Lore of Reproduction 7-step process, Unit Identity Tiers (Generic vs Individual); §14 added terminology discipline; §6 added 10th axis (Elite tactical doctrine). Updated `app/docs/TIER_CONTRACT.md` to v1.1 with §11 Caste authoring contract and §12 Unit identity tier. Added Items 9 (Territory & Garrison), 10 (Royal Queen-Avatar Implementation), 11 (Gene Library & Roster Expansion) to roadmap backlog. Design direction locked: long-form tiered roguelike in CoQ/DCSS tradition, not Hades/StS territory. Royal is a microcosm of the Core. Terminology: "gene" over invented alternatives (consistent with existing "geneline").
- **2026-04-12** — Capacity Item 1 CLOSED. Browser playtest passed all 7 scenarios (deploy cap, cap bar, cap-blocked card visual, death frees, cancel refunds, AI limit, exact 20/20 fit). Two close-out fixes bundled with the roadmap update: (1) AI cap line added to `ai` debug overlay in `GameManager.ts` so future playtests can watch AI cap live, (2) mound slot click-through fix in `index.html` — pre-existing bug since `f5d3da2` where draggable `<img class="lm-preview">` suppressed clicks on the center of the chamber slot. Root cause: HTML images are draggable-by-default, the browser's native drag start suppresses the click event. Fix: `.lm-slot > * { pointer-events: none; }` passes clicks through to the parent onclick. Same latent issue exists on `.ucard .uico-img` but cards are large enough that users never noticed — not fixed proactively, flagged here if anyone hits it later.
- **2026-04-12** — Item 3 combat audit STARTED and reordered ahead of Item 2 (counter matrix depends on stable damage pipeline). Audit surfaced 9 findings via Explore agent; orchestrator verified each against current code before acting. Finding 5 (Stormfly `hitCount` pool leak) verified as **false positive** — `Unit.init()` already resets it at line 173, agent missed it. Avoided fixing a non-existent bug.
- **2026-04-12** — Item 3 combat audit CLOSED. 4 commits planned, 3 committed (Stormfly commit skipped due to false positive). `ea29e1f` landed Centurion rally fade-on-exit with multi-centurion `_ralliedByUid` scoping. `74cb2bf` landed `COMBAT_REFERENCE.md` (224 lines) as the source-of-truth reference for Item 2 counter design. 7 findings deferred as tech debt with file:line refs. 11 subsystems verified clean. Scope discipline held: no structural changes to `CombatSystem.ts`, no hook API changes, no refactors. **Key insight for Item 2:** base attacks bypass `hitUnit`, so counter matrix must slot in BEFORE the branch to cover both unit-vs-unit and unit-vs-base — documented in COMBAT_REFERENCE.md. Also flagged: damage variance is asymmetric `[−3, +2]`, `afterHit` fires unconditionally including for `onAttack` units (contract note in reference doc).
- **2026-04-12** — Combat rewrite reframing discovered. User asked mid-session whether the in-progress combat work was implementing the 5-layer Combat System Architecture documented in DESIGN_PATTERNS.md §460 and GAME_DESIGN.md §715. Orchestrator (me) had missed those docs when scoping Items 2-5. Original Item 2 ("counter matrix") was revealed as one slice of a much larger combat engine rewrite. Decision locked: Option 4 → Option 1. Orchestrator does deep design read first, produces COMBAT_REWRITE_PLAN.md, restructures roadmap. Items 2/4/5 marked as PENDING RESTRUCTURE.
- **2026-04-12** — Combat rewrite design phase, validation rounds 1–4. 20 abilities tested across 4 rounds against the proposed 5-layer architecture. 17/20 fit cleanly using existing primitives. 2/20 (Soul Pylon, Glyph Reservoir, Locust Volley, Triumvirate Beam, Imago Awakening, Salt Field, Soul Pylon, Scent Trail, Gravity Well, Corpse Garden) revealed architectural additions: WorldEntity, Resources, pending events, persistent state, SpatialIndex, per-stat caps, two coordination paradigms (events + spatial queries), component composition vs class hierarchy. 1/20 (Butterfly Effect) hit the right ceiling — world rollback is a simulation-determinism problem, not a combat problem, and is correctly out of scope for the rewrite. Validation generated very high confidence in the architecture.
- **2026-04-12** — Sequencing decision locked. Combat Rewrite (Item 2) → Balance v1 (Item 2 Phase 10) → AI Hive v2 (Item 4) → Balance v2 (Item 5) → New content (Item 6). Reasoning: AI v2 has hard dependencies on combat rewrite primitives (`previewDamage()`, ability data, modifier system, stable balance numbers). Building AI on legacy combat would mean re-tuning AI from scratch when combat ships. Balance v2 is separate from Phase 10 because Phase 10 tunes against WaveManager (dumb adversary) and final tuning needs real AI as adversary.
- **2026-04-12** — `COMBAT_REWRITE_DECISIONS.md` (Doc 1) created. 6 load-bearing decisions: entity model (ECS-lite, components-as-data), coexistence strategy (hybrid layer flags + unit migration, attacker owns pipeline), SpatialIndex (sweep-and-prune over X with one index + route filter), pipeline coexistence (wrapper, with Layers 1–3 precondition), targeting (named selector library, references in ability data), test strategy (unit → integration → property + pure-function principle). Executor reviewed, approved with one trivial correction (O(log n) → O(n log n) terminology). User signed off all 6 decisions as-recommended. Doc 1 LOCKED.
- **2026-04-12** — Phase ordering decided: option (b) minimize churn. Simple units migrate first (Grunt, Mandible, Needler, Pricker, Hardshell, Domeback in Phase 6), medium units next (Skitterling, Mendwing, Cinderfly, Longeye in Phase 7), complex units last (Bashguard, Ravager, Legionnaire, Wardling, Centurion, Bombardier, Stormfly in Phase 8). Trade-off: weeks of foundation work and "Grunt works the same as before" before any visible-to-player change. User self-identified as perfectionist; option (b) matches.
- **2026-04-12** — `COMBAT_REWRITE_PLAN.md` (Doc 2) created. 10-phase plan against the locked decisions. Executor reviewed, approved with revisions: (1) added TargetDummy non-Unit entity validation as Phase 1 deliverable 6 — exercises the component model on a non-Unit before the rewrite commits to Decision 1; (2) bumped Phase 4 effort estimate 3–4 → 4–5 sessions because it's the validation moment for the entire pipeline and conservative is the right default; (3) added Risk #9 acknowledging the post-rewrite component model validation gap (the architecture promises non-Unit support but the rewrite only exercises it on Units, so the first post-rewrite Pylon implementation is the real validation); (4) tightened Phase 5 smoke test to a `_test_all_primitives` ability with five explicit checks; (5) flagged STAT_CAPS as a new design pattern not in Doc 1. Skipped: Decision 3 in risk register (defensible absence). User signed off Doc 2 by delegation. Doc 2 LOCKED. Total estimate: 29–40 executor sessions, 6–10 weeks real-world.
- **2026-04-12** — Roadmap restructured. PENDING RESTRUCTURE block removed. Item 2 replaced with Combat Rewrite Program (10 phases, references COMBAT_REWRITE_PLAN.md). Items 4–5 reordered: Item 4 = AI Hive v2 (was deferred behind P2, now sequenced after Item 2), Item 5 = Balance v2 (was Item 5 Playtest, now final tuning post-AI), Item 6 = New content / Beta geneline (new). Old Item 4 (Unit Balance Pass) absorbed into Phase 10 of Item 2 as "Balance v1." Decision log preserved verbatim.
- **2026-04-12** — Combat Rewrite Phase 1 (Foundation) ✅ DONE. Executor delivered all 6 deliverables: SpatialIndex.ts (sweep-and-prune over X with route/side/component filtering), EntityComponents.ts (11 component tags + query helpers), WorldEntity interface in types.ts (IUnit extends WorldEntity), Unit.init() component population, GameManager spatial index lifecycle (add on createUnit, update post-resolve, remove on despawn), TargetDummy validation wired into live GameManager and deleted before phase exit. Tests: 70 passing (20 Capacity preserved + 35 SpatialIndex + 15 EntityComponents). tsc + vite build clean. Manual smoke test passed (deploy/attack/die/win all clean, no console errors). Architectural decisions made by executor and approved: (1) `SpatialEntity extends WorldEntity` adds required `route` + optional `side` for index inhabitants — clean structural typing, flag for Phase 5 zone-spans-route work; (2) component Set is mutable (not Readonly) — deliberate for Phase 5 effect lifecycle hooks like silence stripping HasAI; (3) spatial index update cadence is post-resolve — fine for now, becomes load-bearing in Phase 4 when pipeline lands; (4) IUnit redundant declarations left in place for Phase 9 cleanup. Zero stop-and-report triggers. Test thoroughness exceeded spec: 35 SpatialIndex tests covered idempotent add, silent no-op remove, dead-skip, update bubbling, large-n stress, stacked-at-same-x. Compile-time wiring check via TargetDummy debug command (built against production bundle, then deleted) was stronger than the spec asked for. Phase 2 unblocked.
- **2026-04-12** — Combat Rewrite Phase 2 (Static layers) ✅ DONE. Executor delivered all 5 deliverables: damageTypes.ts (9 types with category + defaultEffect), resistances.ts (7-tier ladder + pure shiftTier with both-end clamping), UnitDef extension (resistance + penetration optional fields), Unit runtime fields (baseResistance + resistance, init() recycle discipline matching components), conservative initial assignments (Legionnaire { blunt: strong, sharp: strong, heat: weak }, Hardshell { blunt: strong }, Cinderfly { heat: strong, cold: weak }, all other units default to {}). Tests: 99 passing (+11 damageTypes, +18 resistances, all 70 prior preserved). tsc + vite build clean. **Architectural decision approved retroactively: HitFlavor rename.** The plan's spec said `export type DamageType = keyof typeof DAMAGE_TYPES` but the legacy codebase already owned that name as a 9-value FX-routing enum (melee/ranged/aoe/poison/burn/heal/nectar/blocked/base). Executor renamed legacy `DamageType → HitFlavor` (5 references, 2 in types.ts, 4 in CombatSystem.ts, type-only, zero runtime change). The legacy name was misnamed (it's hit flavor for FX, not damage physics). New canonical DamageType is the Layer-1 physics type going forward. Approved retroactively because: (1) low-risk + reversible + clearly documented + invited orchestrator override = exactly what stop-and-report should look like for minor judgment calls, (2) the rename makes the codebase clearer not just compatible, (3) Phase 9 cleanup is cheaper. **Phase 4 design constraint recorded:** the wrapper that converts hitUnit calls into queueAbility events will need to derive a HitFlavor from DamageEvent.dmgType for the FX layer (likely a simple DamageType → HitFlavor map: sharp|blunt → melee|ranged based on attacker range, heat → burn, etc.). Phase 4 review will check for this. Test thoroughness exceeded spec: shiftTier composition test (for Phase 4 penetration math), defensive fallback for unknown tier input, category partition invariant test on damageTypes. Zero migration of any unit, no CombatSystem behavior change, no ability/selector/pipeline work. Phase 3 unblocked.
- **2026-04-13** — Combat Rewrite **Phase 7b (Skitterling + Cinderfly migration) ✅ DONE. Eight consecutive clean phases (1-6 + 7a + 7b).** Headline: 107 modules / 1,642.33 kB raw / 386.16 kB gzip / 457 tests across 18 test files / tsc + vite build clean / zero Phase 5 amendments / zero CombatPipeline.ts touches beyond subscriber registration. **All four preflight fixes landed** (burn dps+duration parity 5→10 and 3→8, burn.stackable→false, post_apply registration-order comment correction, cinderflyCombat.afterHit `e !== target` primary-exclusion filter atomic with Cinderfly migration). **Eight Architectural Decisions (AD) made by the executor during implementation + a retroactive ninth from post-smoke cadence fix:** (AD1) Phase 7a accumulator-test dt-halving strategy preserved semantic intent when Preflight 1 changed dps from 5 to 10; (AD2) per-stack accumulator test rewritten with an inline `testStackableDot` EffectDef pinning the architectural capability independent of production burn's shape — this is a reusable pattern worth naming: **architectural capability pin pattern**, where a test exercises a primitive via a test-only def so the pin survives production data tuning; (AD3) registry test rename + split invariant from "every DoT is stackable" to "poison and bleed are stackable; burn is single-instance post-7b"; (AD4) Phase 6 unmigrated-units-list renamed from "Phase 7+" to "Phase 8+" to match the 2026-04-13 rescope; (AD5) `toBeCloseTo` for resistance divergence tests because the simulateMigratedHit harness captures pre-round calculate output (25.5 for heat-strong, 34.5 for heat-weak) — cleaner than wiring a CombatSystem stub; (AD6) top-level `COMBAT_MAP` import in phase7b.test.ts instead of dynamic require; (AD7) per-test inline pipeline construction over a shared helper (defensible for 3 tests, extract helper at 5+); (AD8 retroactive) burn reframed from damage-accumulator to time-accumulator after Phase 7b smoke caught the cadence mismatch — see "cadence fix" below. **Phase 2 resistance milestone ✅ verified in live production gameplay:** Phase 7b is the first phase where Phase 2 resistance data drives calculate-phase output in production traffic for a damage type matching a target's resistance entry. Automated test at [phase7b.test.ts:414-453](../test/systems/CombatSystem.phase7b.test.ts) pins the harness-captured pre-round values (25.5, 34.5, 30.0); live sandbox verification via user smoke test confirmed **Cinderfly atk 30 vs Legionnaire heat:weak → damage range 32-37**, matching `30 × 1.15 = 34.5 ± [-3, +2] variance → [31.5, 36.5] → Math.round → [32, 37]` exactly. Before this, Phase 2's tier ladder + `shiftTier` + per-unit resistance fields + Phase 4's calculate-phase tier lookup were all shipped but dead code in production because the Phase 4 wrapper's `skipsResistance` fast path short-circuited every legacy battle. Phase 7b's Cinderfly migration is the first production caller that reaches the real calculate path against a resistance-carrying target. **Six smoke test scenarios run, all passed** (1: Skitterling vs Grunt parity; 2: Cinderfly vs 3-Grub cluster with primary + 2 adjacent burning simultaneously, Cinderfly untouched, no double-burn; 3: burn cadence 5 damage per 0.5s via the post-cadence-fix time-accumulator; 4: Cinderfly vs hive BaseEntity wiring smoke, no crashes, no burn-on-hive expected per the legacy melee at-wall path bypassing the pipeline; 5: PLAY mode wave clear with Skitterling + Cinderfly in the deck, full-game integration clean; 6: mixed battle with migrated [Skitterling, Cinderfly, Phase 6 units] + unmigrated [Longeye, Mendwing, Wardling, Legionnaire] — strangler-fig coexistence holds, legacy Longeye pierce at 60/30 damage, Wardling aura still modifies migrated units' damage, Phase 2 resistance divergence on Cinderfly→Legionnaire verified). **Burn cadence fix (post-smoke orchestrator oversight, AD8 retroactive):** Phase 7b Preflight 1 reconciled burn's total damage (80 per application over 8s) via `dps = 10, duration = 8` but missed that legacy burn dispatches a FIXED 5-damage chunk every 0.5s, while the damage-accumulator produced 1-damage ticks every ~100ms (same total, 5× faster cadence, 5× smaller chunks, visually machine-gun vs pulse). User caught it in live smoke test. Fix: reframe burn's tier data from `{ dps }` to `{ chunk, interval }` and rewrite `burn.onTick` to accumulate TIME instead of fractional damage, dispatch `chunk` damage when accumulator crosses `interval`, matching legacy `_processStatusEffects` exactly. ~30 LOC change in [dot.ts:61-130](../src/config/combat/effects/dot.ts#L61-L130), ~5 accumulator tests rewritten at [phase7a.test.ts:498-577](../test/systems/CombatSystem.phase7a.test.ts#L498-L577), FP drift tolerance loosened from [79, 80] to [75, 80] (15-16 dispatches over 8s is the correct legacy-parity bound since `30 * (1/60)` sums to `0.49999...4` in double precision, costing the 16th dispatch; legacy has the same drift). No Phase 5 amendments — `EffectDef.tiers` shape is `Partial<Record<ResistanceTier, Record<string, number>>>` which is loose enough to accommodate `{ chunk, interval }` as burn's specific interpretation. **Parity reconciliation rule refined:** the previous rule "reconcile both or neither" (for two multiplicatively-interacting fields) was insufficient for this case because legacy burn has THREE observable properties (chunk, interval, duration), not two. Refined rule: **"identify every observable field of legacy behavior including cadence, chunk size, tick count, and total damage, not just the ones the automated test measures."** Preflight 1's automated burn-convergence test only checked total damage (80), which is why the cadence mismatch survived to production. The refinement goes into memory as a refinement of the parity reconciliation pattern. **Mendwing healTimer pre-existing bug corrected (Combat Audit Finding 7 reversal):** user ran isolated 2-Mendwing-vs-1-Hardshell test and observed the wounded Mendwing at 8/100 HP never getting healed despite the healthy sibling being right next to it. Orchestrator code-traced the bug: `healTimer` was stored in the effects-Map `duration` field via Unit.ts:372-373 getter/setter, but `Unit.update(dt)` at [Unit.ts:393-397](../src/entities/Unit.ts#L393-L397) decrements ALL effects-Map durations per frame as part of the legacy "effect lasts N seconds" countdown mechanism. Every frame, mendwingCombat's `u.healTimer += dt` was immediately cancelled by Unit.update's `effect.duration -= dt`, pinning healTimer at one-frame's-worth forever. Mendwing has never healed anyone in live play from Phase 1 through Phase 7b — a pre-existing bug, not a rewrite regression. Combat Audit Finding 7 said "Works correctly" — **the audit was wrong**; static code review missed the cross-file interaction between the getter/setter and the unrelated tick loop. Fix: 5-line flip of the getter/setter to use the `accumulator` field instead of `duration`, matching the pattern `burnDmgAcc` and `poisonDmgAcc` already use correctly. Accumulator is not touched by Unit.update's tick loop. [Unit.ts:372-385](../src/entities/Unit.ts#L372-L385) now correct, verified in live sandbox (wounded Mendwing healed +20 every 2s). Combat Audit Finding 7 entry in tech debt section rewritten from "style inconsistency, works correctly" to "BROKEN by double-tick (corrected 2026-04-13)" with full root cause + lesson note. **Two new tech debt findings surfaced during Phase 7b smoke testing** and added to the Combat Audit tech debt section as Findings 10 and 11: **Finding 10 — `regenTimer` is a dead field** (declared on `types.ts:318` and `Unit.ts` getter/setter pair but grep shows zero `regenTimer =` or `regenTimer += ` assignments anywhere in production code; similar shape to Combat Audit Finding 8 `Unit.doAttack()` dead method; safe to delete in Phase 9 cleanup pass); **Finding 11 — Mendwing heal range inconsistency** (`mendwingDef.range = 90` declared for the default attack cycle, but `mendwingCombat.onUpdate`'s heal logic filters `a.side === u.side && a !== u && a.hp < a.maxHp` with NO distance check and picks the nearest wounded ally regardless of distance; effectively infinite heal range; works in typical clustered-ally play but diverges from the declared range; Phase 8 `heal_pulse` ability at `utility.ts:11-19` declares `range: 90` with `targeting: 'lowest_hp_ally_in_range'` so the Phase 8 migration WILL introduce a behavior change — migrated Mendwing caps at 90px range; user should confirm at Phase 8 kickoff whether 90px range is the intended post-migration behavior or whether legacy infinite range should be preserved via a new `lowest_hp_ally_anywhere` selector). **Audit methodology refinement** captured in memory: code review can miss runtime bugs in cross-file interactions between getter/setters and tick loops; audit methodology should include live smoke testing of behaviors declared "works correctly"; Phase 7b's smoke test methodology caught three pre-existing issues static review missed (Finding 7 correction + Findings 10 + 11). **Orchestrator scope discipline rule refined:** previously I was applying "phase scope is sacred" as near-absolute. Refinement from Mendwing fix decision: **scope discipline applies to new features, new architecture, and risky refactors — NOT to trivial legacy patches. When a smoke test catches a pre-existing bug whose fix is (a) ≤10 LOC, (b) single-file, (c) isolated behavior, (d) no risky interaction with current phase work, fix it in the same session.** Over-strict scope discipline creates its own pain for cleanup-oriented developers. User preference shipped the right rule for this codebase. **Two ship-as-is cleanup items** captured from Phase 7b code review (OC1 + OC2, see Phase 7b exit report for details): (OC1 medium) phase7b.test.ts:275-330 no-double-burn describe block name is misleading — only exercises the new-system half of the proof; the legacy-path half lives in the next describe block at lines 337-408; rename + add companion reference in a future opportunistic cleanup pass; (OC2 low) phase7b.test.ts:172-173 says "above" should say "below." OC3 was withdrawn during review after executor code-read proved orchestrator wrong about a pipeline cancelled-check mechanism — reviewer-catches-orchestrator-mistake dynamic working correctly. **Phase 8 handoff inputs consolidated** (F1-F9 from executor's exit report + F10-F14 added during Phase 7b smoke testing): F1 Phase 2 resistance production-live; F2 Phase 8 unit list expansion 7→9; F3 handler-precedence fork (Longeye/Stormfly/Bombardier); F4 per-target damage falloff primitive (Longeye/Stormfly); F5 passive-ability migration pattern (Mendwing/Centurion/Wardling/Bombardier); F6 getAtk override integration (Ravager); F7 burn stackable:false post-7b with capability pin preserved; F8 Cinderfly half-migration state (spread burn still legacy, Phase 9 cleanup target); F9 Cinderfly vs hive base-attack code path bypasses pipeline — no unit currently reaches `applyEffectsPhase` with a BaseEntity target, F9 downgraded from "does it crash" to "legacy base-attack code path is a Phase 9 cleanup concern when it's rewritten to route through queueAbility"; **F10 (NEW) damage-type default effects lookup table** (blunt→knockback, heat→burn, cold→slow, electric→stun, sharp→bleed, toxic→poison, psychic→confuse, void→?, holy→?) per the conversation with user during Phase 7b smoke; **F11 (NEW) knockback layered model** (baseline poise + damage-type default effect + per-unit knockForce, three-axis independent tuning) per the same conversation; **F12 (NEW) AOE-effect-rider primitive** (general `aoeRider?: { radius, targetCount, effect, excludePrimary?, selector? }` on AbilityDef, consumed by Bombardier's death_bomb for Phase 8 migration + Cinderfly's fire_bite for Phase 9 cleanup of legacy spread); **F13 (NEW) Mendwing heal range decision** (legacy infinite range vs Phase 8 `lowest_hp_ally_in_range` 90px — user decides at Phase 8 kickoff); **F14 (NEW) Phase 5 amendment audit log** — the 7a amendments (`ActiveEffect.accumulator`, `EffectContext.instance`) remain the only authorized Phase 5 amendments; Phase 8 kickoff should verify nothing else has drifted and add any new Phase 5 amendments to the authorized list explicitly. **Phase 7b approved on code review, not report** — orchestrator independently verified [dot.ts burn data reframe + time-accumulator body](../src/config/combat/effects/dot.ts), [cinderflyCombat.afterHit filter](../src/units/normal.ts#L386-L412), [CombatSystem.ts:232-245 Preflight 3 comment rewrite](../src/systems/CombatSystem.ts#L232-L245), [phase7a.test.ts:498-577 rewritten accumulator tests](../test/systems/CombatSystem.phase7a.test.ts#L498-L577), [phase7a.test.ts:579-617 per-stack capability pin test unchanged](../test/systems/CombatSystem.phase7a.test.ts#L579-L617), [phase7b.test.ts convergence + flavor tests](../test/systems/CombatSystem.phase7b.test.ts#L234-L279), Mendwing healTimer fix at [Unit.ts:372-385](../src/entities/Unit.ts#L372-L385), MECHANICS_ROADMAP.md Combat Audit Finding 7 correction. Fresh Phase 8 orchestrator session can bootstrap via ORCHESTRATOR_RESUME.md — this decision log entry is the authoritative Phase 7b closure record, all Phase 8 design-session inputs (F1-F14) are in this entry.
- **2026-04-13** — Combat Rewrite **Phase 7a (effect-pipeline primitives) ✅ DONE**. All 6 deliverables shipped clean: heal subscriber on pre_apply slot (`applyHealPhase`, top-level export), apply-effects subscriber on post_apply slot registered SECOND (`applyEffectsPhase`, top-level export), Phase 5 type amendments (`ActiveEffect.accumulator?: number` + `EffectContext.instance: ActiveEffect`, both with inline decision-log references), `burn.onTick` live via accumulator pattern at [dot.ts:80-94](../src/config/combat/effects/dot.ts#L80-L94), DOT damage routed via new leaf [dispatch.ts](../src/config/combat/effects/dispatch.ts) (breaks circular between dot.ts and CombatSystem.ts), `updateEffects(alive, dt)` wired at [CombatSystem.ts:537](../src/systems/CombatSystem.ts#L537) inside `resolve()` before `_currentCtx = null`. Tests: 431 passing (+34 in new `CombatSystem.phase7a.test.ts` — 8 heal subscriber + 7 apply-effects + 2 registration-order pin + 4 save-restore pin + 2 dispatch state + 10 accumulator math + 1 Phase 6 coexistence smoke). Bundle: 97 → 105 modules (+8, within the orchestrator-authorized +6 to +10 range), raw 1,634.54 kB → 1,639.39 kB (+4.85 kB), gzip 384.63 kB → 386.16 kB (+1.53 kB). Zero `CombatPipeline.ts` touches. Zero unit file touches. Zero silent Phase 5 amendments — only the two pre-authorized. tsc + vite build clean. **`makeDotDispatcher` factory extraction** was the key architectural move: CombatSystem's save-restore shape is pinned by tests via a `DotDispatcherHooks` interface without instantiating CombatSystem, mirroring the Phase 6 `applyVarianceModify` pure-function pattern. Save-restore discipline pinned with 4 tests including the try/finally-under-throw path. **Runtime isolation proven via grep independent of the executor's report** (orchestrator re-ran all three checks): (a) `defaultAbility` grep — exactly 6 Phase 6 migrated units, all three ability names (`jaw_strike`, `needle_shot`, `pricker_jab`) are direct-damage, zero heal-category, zero effect-using; (b) `applyEffect\(` production grep — exactly 1 runtime call site at [CombatSystem.ts:150](../src/systems/CombatSystem.ts#L150), other hits are function definition + JSDoc + docs; (c) `event.effects =` production grep — zero writes outside what Phase 4's `queueAbility` already does at [CombatPipeline.ts:243](../src/systems/CombatPipeline.ts#L243), only two hits both in the 7a test file. New subscribers and `burn.onTick` are REACHABLE from production (+8 modules prove the wiring) but never EXECUTED at runtime in 7a. Phase 7b is the first phase where production call sites reach the new paths end-to-end. **Approved on code review, not report** — orchestrator read [dot.ts:80-94](../src/config/combat/effects/dot.ts#L80-L94), [dispatch.ts](../src/config/combat/effects/dispatch.ts), [effects/types.ts](../src/config/combat/effects/types.ts), [CombatSystem.ts:59-255 + :537 + :665-745](../src/systems/CombatSystem.ts), [phase7a.test.ts:245-420](../test/systems/CombatSystem.phase7a.test.ts) directly (~12k tokens of code inspection, aligning with the "validation-moment-adjacent" effort band from feedback_role_orchestrator). **Three real findings surfaced by code review**, all deferred to the Phase 7b commit as data/comment fixes (no dedicated 7a follow-up): (1) **[high] burn dps + duration parity gap is ~5.3× not 2×** — legacy burn deals 5 damage per 0.5s × 8s = 80 total damage; new as declared deals 5 dps × 3s = 15 total damage (ratio 18.75%); executor's proposed fix (dps 5→10 only) closes half the gap (30 damage = 37.5% of legacy); full parity requires BOTH `dps=10` AND `duration=8` = 80. Executor self-identified the root cause: anchored on per-second rate divergence and didn't multiply through duration. Generalized as a class-of-error rule captured in memory: *"when legacy has two divergent numeric fields, reconcile both or neither."* Reusable for Phase 10 balance retune, Phase 8 Stormfly chain-falloff parity, any future parity-diff-vs-legacy audit. (2) **[high] burn.stackable: true → false** — legacy is single-instance-with-timer-reset, and Phase 5 EffectSystem's `stackable: false` semantics take MAX(existing.remaining, incoming.remaining) with no onStack hook, matching legacy exactly. One-line data fix; keep the per-stack accumulator test in place as an architectural capability pin with a doc note that production burn is effectively single-instance post-7b. (3) **[medium] post_apply registration-order comment overclaims** — `CombatSystem.ts:233-240` says "REGISTRATION ORDER IS LOAD-BEARING" and the test at `phase7a.test.ts:280-283` purports to pin it, but `_legacyApplyPhase` at [CombatSystem.ts:718](../src/systems/CombatSystem.ts#L718) calls `u.takeDamage(dmg)` which sets `u.dead = true` DURING the apply phase, before ANY post_apply handler runs; by the time applyEffectsPhase runs, the dead-target guard in `EffectSystem.applyEffect` short-circuits regardless of which post_apply handler ran first. The test passes for the wrong reason. Not a correctness bug — behavior is correct — but a future-regression hazard: if a later refactor moves death-setting out of `apply`, the test would pass spuriously while the real invariant was broken. Fix is comment/test-doc update only, ship in Phase 7b commit. Registration order remains conservatively legacy-first as defensive armor against future apply-phase semantics changes. **Minor style note deferred to Phase 9 cleanup:** `applyEffectsPhase` at [CombatSystem.ts:148](../src/systems/CombatSystem.ts#L148) uses `as unknown as Parameters<typeof applyEffect>[0]` double-cast — cleaner would be importing `EffectBearer` and casting directly. Leave alone if it stays one site; refactor if Phase 8's modifier/resource wiring repeats the pattern. **Manual smoke test skipped** — DOT dispatcher's `no ctx → no-op` guard at [CombatSystem.ts:108](../src/systems/CombatSystem.ts#L108) means a dev-console `EffectSystem.applyEffect` call outside a `resolve()` window silently does nothing, so smoke-testing `burn.onTick` at runtime requires either a real Unit applying burn (Phase 7b Cinderfly) or bespoke test-hook wiring (which is 7b work). Executor chose automated coverage (34 tests covering every code path including the no-ctx guard path) over bespoke wiring — correct call. Phase 7b Cinderfly parity test functions as the deferred smoke test. **Seven consecutive clean phases** (1-6 + 7a). Phase 7b unblocked.
- **2026-04-13** — Combat Rewrite **Phase 7 re-scoped to Phase 7a + Phase 7b**, Mendwing + Longeye folded into Phase 8. Executor's stop-and-report surfaced that 3 of 4 Phase 7 units have primitive-level blockers that cannot be resolved with Phase 6-style `defaultAbility` migrations: **Mendwing** — `heal_pulse.category='heal'` but no heal-phase subscriber exists, so `queueAbility('heal_pulse')` is a no-op at [CombatPipeline.ts:132-133](../src/systems/CombatPipeline.ts#L132-L133) (damage-only routing, `ability.category !== 'damage'` early-returns); **Cinderfly** — `fire_bite.appliesEffects=['burn']` but no subscriber reads `event.effects`, so burn never lands on the target through the new path (verified at [CombatPipeline.ts:243](../src/systems/CombatPipeline.ts#L243) where the event carries the effects list but nothing consumes it); also `dps * dt` at 60fps = 5/60 ≈ 0.083 → defensive `Math.round` at apply phase (Phase 6 follow-up #1) zeros every tick, so burn needs an accumulator somewhere; **Longeye** — `handler.onAttack` fires before the `canMigrate` check at [CombatSystem.ts:241-246](../src/systems/CombatSystem.ts#L241-L246), so setting `defaultAbility` on a unit with an onAttack hook is a silent no-op (Longeye has `longeyeCombat.onAttack`). Orchestrator code-read verified all three blockers against the live files before locking the re-scope (citation discipline enforced — executor's initial line ref for the Longeye fork was 253-282, actual site is 241-246, difference was the Phase 6 follow-up #2 BaseEntity branch insertion shifting the fork down ~10 lines). **Split decision:** Phase 7a ships effect-pipeline primitives only (zero unit migrations, same shape as Phase 5 — reversible, **expected bundle delta ≈ +8 modules proving `CombatSystem → EffectSystem` wiring** per the Phase 5 "+7 proves wiring" pattern, with grep-based proof of runtime isolation replacing the bundle-unchanged exit criterion that an earlier draft incorrectly claimed and the executor caught during preflight 2026-04-13); Phase 7b migrates Skitterling (clean Phase-6-style) + Cinderfly (consumes 7a primitives, half-migrated with legacy `cinderflyCombat.afterHit` spread staying in place as permitted by the Phase 6 kickoff rule "do NOT delete legacy CombatHooks for migrated units"); Mendwing and Longeye fold into Phase 8 because they share architectural sub-decisions with existing Phase 8 units (Mendwing → passive-ability migration pattern, shared with Centurion rally_aura + Wardling guardian_ward, both `category: 'passive'`; Longeye → handler-precedence fix, shared with Stormfly chain + Bombardier death-bomb, all have onAttack or afterHit hooks). A dedicated Phase 7c would re-solve those decisions in isolation while Phase 8 already has to solve them. **Six Phase 7a sub-decisions locked:** (1) **Math.round stays sacred, DOT uses accumulator on ActiveEffect (per-stack)** — localizes fractional-damage state to burn.onTick without weakening the shared defensive guard; (2) **heal routing via new subscriber on existing `pre_apply` slot** — NOT a new pipeline phase, phase enum unchanged, reads `ability.category === 'heal'`, heals target, cancels event to short-circuit the rest of the pipeline; (3) **apply-effects via new subscriber on existing `post_apply` slot, registered SECOND after `_legacyPostApplyPhase`** — order matters so legacy sets `target.dead = true` on lethal hits first, then effect apply silently no-ops via `EffectSystem.applyEffect`'s own dead-target guard, matching legacy "DOTs don't land on corpses"; (4) **Phase 5 type amendment: `ActiveEffect.accumulator?: number` + `EffectContext.instance: ActiveEffect`** — three-line amendment authorized as part of the 7a rescope so a future audit doesn't read it as silent drift; `EffectContext.instance` lets hooks mutate per-stack scratch state, which is a power increase scoped to burn's use case (future expansion requires stop-and-report); (5) **DOT routes damage via `this.hitUnit(target, dmg, 'burn', ctx)`** — Option B (wrapper), NOT direct `target.takeDamage`; reason: legacy DOT ticks pass through `hitUnit` and inherit `modifyDamage`/`modifyAllyDamage` aura hooks (per COMBAT_REFERENCE.md audit finding), so Option A would regress aura parity AND lose particle FX for one Phase 9 cleanup-site savings (not worth the parity cost); implementation uses `hitUnit` directly, not `queueAbility('legacy_basic_attack', { baseDamageOverride, legacyHitFlavor })`, because it's the simpler call shape and matches the exact pattern `_processStatusEffects` uses at [CombatSystem.ts:380-395](../src/systems/CombatSystem.ts#L380-L395); (6) **`updateEffects` wired inside `CombatSystem.resolve()`**, NOT in GameManager.tick — DOT routing needs `_currentCtx` for particle FX and `_currentCtx` is only set during `resolve()`. **Orchestrator-added attacker-attribution pattern:** burn.onTick → hitUnit must use **save-restore** on `_lastAttacker` (save current into local, set to `burnInstance.source`, call hitUnit, restore), NOT set-clear — immune to future reentrancy refactors if `updateEffects` ever runs during an in-flight resolve frame. Cost is one local variable; benefit is immunity to a whole class of cascade-attribution bugs. **Phase 7b preflight trigger (deferred, NOT a 7a concern):** Cinderfly double-burn edge case — executor code-read verified that `cinderflyCombat.afterHit` spread filter at [normal.ts:363-369](../src/units/normal.ts#L363-L369) is `e.side !== u.side && !e.dead && !e.burrowed && distance < 85`, and the primary target matches all four (self-distance = 0), so migrated Cinderfly would apply both new-system `ActiveEffect` burn via `fire_bite.appliesEffects` AND legacy `burnTimer` burn via the afterHit spread to the same primary — parity violation; Phase 7b kickoff must resolve by filtering primary from the spread (orchestrator lean — preserves parity) or accepting documented non-parity. **Framing discipline:** emergent mid-phase sub-split under review pressure is a DIFFERENT pattern from Phase 5 → Phase 6 (pre-planned Doc 2 split); [ORCHESTRATOR_RESUME.md](../process/ORCHESTRATOR_RESUME.md) key-patterns section gained pattern #9 capturing the emergent-split rule ("reject the draft, don't follow it into a patch") so future orchestrators don't misread Phase 5/6 precedent as license to drop unit scope mid-phase. Memory file `project_combat_rewrite.md` gained a Phase 7a sub-decisions section with the six locks + the save-restore attacker attribution pattern. **Six consecutive clean phases + first mid-phase re-scope** — the rewrite's stop-and-report discipline worked exactly as designed; the executor surfaced the architectural gap instead of patching, and the phase was split cleanly before any code shipped. Phase 7a unblocked; executor standing down until 7a kickoff lands.
- **2026-04-13** — Combat Rewrite Phase 6 follow-up #2 (Base-as-WorldEntity) ✅ DONE. Bases wrapped as WorldEntity instances with components `HasHP + IsTargetable + HasAllegiance` (NOT HasAI/HasMovement/HasCapacityCost). Files: 6 touched (1 new BaseEntity.ts + 1 new BaseEntity.test.ts + CombatSystem.ts modifications + GameManager.ts wiring + Targeting.ts new selector variants + Targeting.test.ts new tests). Tests: 397 passing (+25 from Phase 6 main: 18 BaseEntity + 7 Targeting). tsc + vite build clean. Bundle gzip +0.36kB. CombatPipeline.ts untouched. **Architectural decisions approved (orchestrator code-reviewed BaseEntity.ts, CombatSystem._findTarget modifications, and Targeting.ts new selectors directly):** (1) Ranged-only gating via `u.attackRange === 'ranged'` check in `_findTarget` — preserves melee behavior exactly, melee units never see base via _findTarget and fall through to legacy at-wall fallback unchanged; (2) Parallel BaseEntity attack branch instead of refactoring legacy at-wall code per kickoff instruction; (3) Variance kept as `+0..+3` (asymmetric positive) for base attacks per legacy formula; (4) `dead` as field with per-frame `syncDead()` (cleaner than getter); (5) Bases at WALL position (not container origin) — geometric math verified against legacy at-wall snap positions; (6) HasAI default filter — Option (b) chosen, new selector variants `nearest_target_in_range` / `nearest_targets_in_range` added with `IsTargetable` filter, existing `nearest_enemy_in_range` selectors unchanged (regression-guarded by cross-test "legacy selector does NOT find the base"); (7) Spatial index registration without explicit deregister (cheap, no leak risk). **Three side effects flagged:** Mendwing now stops 90px from hive (was: walked to wall, same DPS, slight survivability buff), Longeye now fires single basic shots from 240px (chain bypassed for base targets — Phase 7 Longeye migration will handle), `afterHit` not firing for base targets (no current consumer — Cinderfly is melee). **Beyond-spec discipline:** negative ID space for bases (anti-collision with positive Unit ids), defensive null-handling on `enemyBaseEntity`/`playerBaseEntity` instance fields, intentional `canAttack` route check bypass for base candidates documented in BaseEntity.ts:70-79 (Phase 7+ air/tunnel migrations need to be aware), Phase 7 forward-compat selectors registered but unused in Phase 6, regression test pinning that legacy selectors do NOT find bases. **Manual smoke test results:** Pricker (ranged, range 95) verified stops at range and attacks hive successfully; melee units verified walk to hive base and attack from melee (regression guard); zero console errors; Mendwing/Longeye behavior change verification skipped per user judgment (same code path as Pricker — if Pricker works, they work by construction). **First visible-to-player improvement of the entire combat rewrite shipped** — ranged units now actually use their range against the enemy hive. Phase 7 (medium units, first effect lifecycle hooks in production) unblocked.
- **2026-04-13** — Combat Rewrite Phase 6 (Unit migration tier 1) main migration ✅ DONE. 6 simple units migrated (Grunt, Mandible, Needler, Pricker, Hardshell, Domeback). Wrapper-bypass mechanism: presence-of-defaultAbility check at CombatSystem.ts:182-228 (executor's lean, confirmed) — adding `defaultAbility` to a def is the entire opt-in, no separate flag to manage. Per-unit reversibility: removing the field reverts a unit to legacy. **Variance preservation approach (the load-bearing decision):** executor avoided touching CombatPipeline.ts entirely per stop-and-report trigger #5; threaded variance through a transitional `DamageEvent._attackerVarianceOverride` field + a CombatSystem-owned modify-phase subscriber (`applyVarianceModify`). Variance rolled ONCE per attack at the foreswing-completes site, same value goes through both legacy and migrated paths. Math proof: legacy `max(1, atk + variance)` ≡ migrated `max(1, atk × 1.0 + variance)` at normal tier. **Byte-for-byte parity at normal tier** verified by 36 per-unit parity tests (6 units × 6 variance values), exceeding the spec's ±5% tolerance. Tests: 372 passing (313 baseline + 59 new in CombatSystem.phase6.test.ts). tsc + vite build clean. Bundle modules unchanged 96 → 96 (no new prod modules — Phase 6 is unit-file edits + a test file). Zero CombatPipeline.ts touches. **Important architectural milestone:** the tier multiplier path is now exercised in production for the first time (before Phase 6, every queue event hit the skipsResistance shortcut; Phase 6 makes the real `casterBase × mult` math live). Phase 4's two-path testing pre-staging pays off — the real path was tested but dead code in production until now. **Centurion rally aura "just works" with migrated units** because new calculate phase reads `attacker.atk` directly (live, post-rally), not `def.atk` cached. Verified by code inspection. **Three surprises flagged:** (1) Unit.def doesn't exist as a stored field, executor added `defaultAbility?: string` directly to IUnit + Unit instead of widening to expose the full def — conservative call, matches Phase 1's "copy fields in init()" pattern; (2) `getAtk` guard added to canMigrate check — units with getAtk overrides (Ravager future berserk) fall back to legacy because new path reads attacker.atk directly; flagged for Phase 7-8 review (recommend converting Ravager berserk to a Phase 5 Modifier rather than removing the guard); (3) `legacy_basic_attack + variance override` documented behavior pinned by test (transitional field dies in Phase 10). **Manual smoke test results:** Scenario A Grunt vs Mandible parity confirmed (-32 / -22 in legacy ranges); Scenario A decimal damage on some units flagged but NOT reproducible in 1v1 controlled test (multi-unit interaction artifact, defensive Math.round fix queued); Scenario B Needler ranged on units works ✅, Needler walks to hive ⚠️ (KNOWN legacy bug, Base-as-WorldEntity follow-up fixes); Scenario C Hardshell mirror confirmed (11-16 range); Scenario D mixed battle blocked by sandbox limitation but design preserves correctness via attacker-owns-pipeline + cascade routing through wrapper; Scenario E PLAY mode wave clear ✅. **Two follow-ups queued before Phase 7 kickoff:** (a) defensive Math.round fix at apply phase boundary — guarantees HP only takes integer damage forever, ~5 min executor work, aligns with Phase 10 variance redesign which will need this anyway; (b) Base-as-WorldEntity fix — turns the ranged-units-walk-to-base legacy bug into a real-world validation of the WorldEntity architecture (addresses Risk #9 with a production use case instead of theoretical post-rewrite gap), ~1-2 hours executor work, ~30 LOC. **Six consecutive clean phases.** Phase 7 unblocked once both follow-ups ship.
- **2026-04-13** — Combat Rewrite Phase 5 (Effects + Modifiers + Resources + Pending events + Persistent state) ✅ DONE. Largest phase by deliverable count shipped clean. **Effect name collision resolved via stop-and-report → Option A coexist.** Executor pre-scanned all likely collisions before touching code, found Effect/StatusEffect conflict (legacy 34 references in Unit.ts, simple `{duration, accumulator?}` bag), presented 3 options with honest tradeoffs, and stopped per Phase 5 trigger #1. Orchestrator locked Option A: new system uses Effect/EffectDef/ActiveEffect/EffectSystem/applyEffect/removeEffect, legacy StatusEffect interface and Unit.effects:Map untouched until Phase 10 cleanup deletes them. Both coexist via separate Unit fields (Unit.effects legacy + Unit.activeEffects new). Same strangler fig pattern as Phase 4's hitUnit/queueAbility coexistence. Modifier and Resource clean (no collisions). DamageEvent/AbilityDef already resolved Phases 3-4. Deliverables: 5 grouped effect files (dot/cc/buff/debuff/special) with 18 effect definitions as pure data, EffectSystem with stacking + prevents + dead-target mid-tick handling, ModifierSystem with stat caps (2 seeded entries: healing_received [-50,200], resistance_shift [-3,3]), ResourceSystem with lazy record creation, pending event extension to DamageEvent + CombatPipeline, persistent vs battle-scope state split (UnitPersistent interface, currently only graftedDeathAbilities? — killCount deferred per minimal-state guidance). Tests: 313 passing (203 baseline + 110 new across 4 new test files + 9 added to CombatPipeline.test.ts), expected 250+ delivered 313 (23% over). tsc + vite build clean, bundle modules 89 → 96 (+7 proves wiring), zero production imports of EffectSystem/ModifierSystem/ResourceSystem from CombatSystem/CombatPipeline (verified via grep). _test_all_primitives validation: 6-step ability exercising every Phase 5 primitive in one cast, all 6 steps passed manually via vitest, ability + registration deleted before phase exit (test count dropped exactly 2: 315 → 313). Three senior-level catches beyond spec: (1) **pending event safety cap interaction** — naive implementation would have let 200 pending events eat the cap and drop everything else, executor identified proactively and made pending holds pass-through (test pinned: "pending events do NOT count against the safety cap"); this bug would NOT have surfaced until Phase 6+ when Quantum Strike / Silence Lash patterns actually use pending events; (2) **effect stacking + dead-target mid-tick** — walking effect list in reverse for splice safety, dead-target check at TOP of next iteration so currently-ticking effect finishes bookkeeping before loop bails; matters for Phase 7 DOTs in real combat; (3) **in-place reset for activeEffects** — uses `.length = 0` and `delete entity.resources[k]` instead of reassigning, preserves object identity for any code holding references between ticks, matters for long-lived debug hooks. **Effect hooks deliberately unpopulated in shipping data** — 18 effects ship as pure data, hook firing logic tested via instrumented local defs in EffectSystem.test.ts, Phase 6+ unit migrations populate hooks per real need (Cinderfly's Phase 7 burn.onTick, Bombardier's Phase 8 death_bomb hooks, etc.). Phase 6 simple units have NO effects in basic attacks so they don't need hooks populated — Phase 6 ships without touching hooks at all, Phase 7 starts hook population. Type-only import flagged: Unit.ts imports `import type { Modifier }` from ModifierSystem to give modifiers field a precise type (erased at runtime, doesn't violate Decision 8 strict isolation). STAT_CAPS deliberately conservative (only 2 seeded entries) — flagged for orchestrator review when Phase 6+ surfaces a third (e.g., damage_taken when Cinderfly marked effect lands). **Five consecutive clean phases with senior-level judgment.** Phase 6 unblocked.
- **2026-04-12** — Combat Rewrite Phase 4 (Pipeline scaffolding + wrapper) ✅ DONE — **THE VALIDATION MOMENT PASSED**. Executor delivered all 8 deliverables: CombatPipeline.ts (7-phase event queue with queueAbility, resolveFrame, on/off, findEvents, cancelEvent, clear, SAFETY_CAP=200, dead-target skip), DamageEvent interface (no legacy collision), 5 core phase subscribers (calculate handles both wrapper path AND real path, resist/modify no-op for now, apply/post_apply on CombatSystem reading _currentCtx), hitUnit wrapper routing every legacy hit through queueAbility, HitFlavorBridge.ts (transitional hitFlavorToDamageType mapping with documented defaults, dead in Phase 6+), per-call drain integration into CombatSystem.tick, UnitDef.defaultAbility? optional field, legacy_basic_attack ability in its own legacy.ts file (clearer Phase 9 deletion target), no_targeting sentinel selector, AbilityDef.skipsResistance? flag. Tests: 203 passing (+51 Phase 4: 38 CombatPipeline + 11 HitFlavorBridge + 1 Targeting + 1 abilityRegistry). tsc + vite build clean (95 modules, +16 from Phase 3 — bundle module growth proves wiring is in production graph, opposite of Phase 3's tree-shaking proof). **Manual smoke test passed all 4 critical scenarios:** (1) multi-Bombardier cascade with 4v4 setup — explosions fire, cascades chain, no console errors, ties as expected; (2) Grunt vs Mandible 1v1 parity — damage values -32 and -22 land exactly in legacy variance ranges (29-34 and 17-22); (3) PLAY mode wave clear with base HP routing and victory triggered (player units destroyed enemy hive, validating base attack code path through wrapper); (4) frame time at 60 FPS solid, zero performance regression. **Architectural decision approved retroactively: per-call drain cadence.** Plan said "once per tick" but the executor identified an internal spec inconsistency: legacy hitUnit is synchronous and nested cascades resolve before the outer call returns; once-per-tick would defer cascades to end-of-frame, breaking parity (forEach iterations seeing pre-cascade state, units killed mid-frame still attacking). Per-call drain preserves legacy depth-first synchronous semantics. Approved retroactively because the resolution was obvious from the load-bearing principle ("identical behavior" trumps spec literal text). Plan corrected to reflect per-call drain + Phase 6 switch-to-once-per-tick TODO. **Architectural decision approved retroactively: HitFlavor → DamageType mapping with documented defaults.** Stop-and-report rule technically tripped (3 ambiguous mappings: melee→blunt, ranged→sharp, aoe→blunt) but functionally inert in Phase 4 (skipsResistance flag bypasses tier lookup so dmgType is cosmetic, no Phase 4 subscriber reads it for damage math). **Stealth bug fix flagged: route check now reads event.attacker instead of ctx.sourceUnit** — more correct than legacy in cascade case, no current unit surfaces the difference, recorded for future debugging. Test thoroughness exceeded spec: bundle module growth as wiring proof, two-path calculate testing (Phase 4 production only hits wrapper path but tests cover real path for Phase 6 readiness), property test on resolveFrame with random subscribers/cancellations, synthetic A→B→C→D cascade test verifying depth-first ordering, executor pre-flagged multi-Bombardier as the highest-risk smoke scenario. **Phase 4 follow-up: Debug HP HUD shipped** as separate task between Phase 4 and Phase 5. Command `hphud` toggles a fixed-position DOM panel showing every alive unit (side, name, hp/maxHp, position). Singleton with attachSource pattern (same dependency-injection pattern as AIHiveController unitsProvider), works in WorldScene + SandboxScene. ~106 LOC, 3 files touched, zero combat/architecture changes, will be reused for Phase 6+ unit migration smoke tests. **Phase 10 design call locked: variance redesign — hybrid deterministic-by-default + opt-in RNG fields per ability** (variancePct?, critChance?, critMult? on AbilityTierStats). User identified that legacy `[-3, +2]` scales as ±15% at low tiers but ±1% at high tiers, undercutting purpose. Hybrid approach (deterministic by default, RNG as opt-in feature) is closer to Battle Cats's pattern than Clash Royale's (full determinism) or Diablo's (heavy RNG). Implementation cost ~30 LOC + balance retune. Phase 10 only — Phases 4-8 must preserve legacy variance for parity. Recorded in COMBAT_REWRITE_PLAN.md Phase 10 deliverable #7. **Four consecutive clean phases with senior-level judgment.** Phase 5 unblocked.
- **2026-04-12** — Combat Rewrite Phase 3 (Ability data + targeting) ✅ DONE. Executor delivered all 5 deliverables: AbilityDef + AbilityTierStats interfaces in types.ts, config/combat/abilities/ directory with 10 per-type files (sharp/blunt/heat/cold/toxic/electric/psychic/void/holy/utility) + tier table helper + index registry barrel, 11 abilities covering all 18 legacy units (jaw_strike, pricker_jab, needle_shot, piercing_shot, bash_strike, fire_bite, death_bomb, chain_lightning, heal_pulse, rally_aura, guardian_ward), Targeting.ts with 7 selectors + HasAI default component filter convention documented in module header, lookupAbility/hasAbility helpers. Tests: 152 passing (+29 Targeting, +24 abilityRegistry, all 99 prior preserved). tsc + vite build clean. **Build-level proof of compliance:** vite produces same module count (79) and same bundle size as Phase 2 because new abilities/selectors are tree-shaken out — nothing in production graph imports them yet. Stronger than test pass; bundler-level guarantee that legacy battles run unchanged. **Architectural decision approved retroactively: PlayerAbilityDef rename.** Same pattern as Phase 2 HitFlavor: legacy `AbilityDef` (for nuke/wall/slow/repair player HUD commands) renamed to `PlayerAbilityDef` so the new canonical AbilityDef can own the unprefixed name. Five files, type-only, zero runtime change. **Rule for future collisions established:** rename-legacy pattern OK when type-only + new name is canonical going forward + new name is more specific + documented in report. STOP-AND-REPORT FIRST when rename touches runtime behavior, load-bearing decisions, has no obviously-better legacy name, or collides with spec-referenced names. Specifically: `Effect` (Phase 5) MUST stop-and-report (legacy "status effect" overlaps too closely); `Modifier` (Phase 5) depends on legacy presence; `DamageEvent` (Phase 4) likely no collision. Architecturally: tier tables are multipliers (caster.def.atk × tier mult), normal tier locked at 1.0× across every damage ability as the legacy-parity invariant Phase 4 depends on. Inline Phase 4 design notes added to ability files (piercing_shot falloff, chain_lightning falloff + stun roll, fire_bite burn-spread, death_bomb onDeath routing). SelectorEntity extends WorldEntity locally in Targeting.ts (same pattern as Phase 1 SpatialEntity). Default component filter ['HasAI'] tested via "projectile-shape excluded" + "explicit override" cases. Five unused damage types ship as empty {} exports (future-proofing). No defaultAbility field on UnitDef yet — deferred to Phase 4. Three consecutive clean phases with senior-level judgment. Phase 4 (THE validation moment) unblocked.

## Tech debt / follow-ups (surfaced during other work)

### Capacity-review tech debt (2026-04-12)
- **Phaser registry is stringly-typed and polling-based** (surfaced during capacity architecture review). Codebase-wide pattern: WorldScene writes `registry.set('cap.used', ...)` and MenuUIScene reads `registry.get('cap.used')`. Key typos silently break readers, no schema, `any` return type. Not capacity-specific — inherited from the existing WorldScene → MenuUIScene bridge. Future refactor: typed registry wrapper (`registry.cap.used.get() → number`), possibly with subscription model. Out of scope for mechanics roadmap, flag for a future "codebase architectural hygiene" pass.
- **Module-vs-class decision not hoisted to DESIGN_PATTERNS.md** (surfaced during capacity architecture review). The Capacity.ts reasoning ("stateless helpers → module, stateful systems → class") is documented in CAPACITY_DESIGN.md but is a codebase-level principle. Should be extracted to DESIGN_PATTERNS.md so future implementers have a reference when facing the same call. Low-effort follow-up, high long-term value.
- **No transactional test for deploy-rejection side-effect discipline** (surfaced during capacity architecture review). GameManager.playerSpawn relies on ordering (all validations before economy.spend). A regression test asserting "rejected deploy does not change economy.nectar or units array" would defend against a future contributor inserting a validation after the spend call. Add when writing the first GameManager integration test.

### Combat audit tech debt (2026-04-12 — Item 3 deferred findings)
Each entry has file:line refs so future audits can jump straight to the code.

- **Finding 1: Double-death protection is ordering-dependent.** `hitUnit` early-returns on `u.dead || u.burrowed` [`CombatSystem.ts:244`], which prevents the observable bug today, but the guard is coupled to the order of operations inside `hitUnit`. If damage paths move (e.g. a future refactor splits `hitUnit` into multiple helpers), the guard has to move with them or double-`onDeath` fires become possible. Also covers the death block at [`CombatSystem.ts:295-314`] and `Unit.takeDamage` at [`Unit.ts:329-331`]. No current regression. Fix when touching damage flow for other reasons.
- **Finding 2: `afterHit` fires for `onAttack`-defined units.** `CLAUDE.md` implies `afterHit` only fires for default attacks, but the call at [`CombatSystem.ts:129-131`] runs unconditionally after the default-or-replaced attack branch. Contract violation with no current consumer — Longeye and Stormfly are the only `onAttack` users and neither defines `afterHit`. Documented in `COMBAT_REFERENCE.md` under the `afterHit` contract note so future implementers don't rely on the aspirational contract. Re-audit when a unit needs both hooks.
- **Finding 4: Ravager `atkRate` mutated every frame** [`alpha.ts:240-247`]. Berserker's rage boost recalculates `u.atkRate = base * (hpFrac <= 0.5 ? 1.5 : 1)` on every `onUpdate` tick. The behavior is intended (attack rate scales with damage taken) but the per-frame write is inefficient, and there's theoretical oscillation at the 50% HP boundary if HP fluctuates. No observable gameplay impact. Fix by caching `atkRate` at attack start or adding hysteresis if Ravager balance becomes a real concern.
- **Finding 6: `unitDied` event declared but never emitted** [`EventBus.ts:7`]. Originally surfaced during capacity explore, re-verified during combat audit. `CombatSystem` only emits `enemyKilled` [`CombatSystem.ts:308-312`], which fires for enemy deaths only. Player unit deaths emit nothing. Latent — no current consumer. Fix when the first system needs death notifications (stats tracking, death-triggered abilities, player-unit obituaries, etc.).
- **Finding 7: Mendwing `healTimer` was BROKEN by double-tick (corrected 2026-04-13)** [`Unit.ts:372-373`]. The original Combat Audit 2026-04-12 said "Works correctly" but a Phase 7b smoke test 2026-04-13 caught the bug in live play: healTimer's getter/setter stored the cooldown accumulator in the effects-Map `duration` field, but `Unit.update(dt)` at `Unit.ts` ~line 393 decrements ALL effects-Map durations per frame. Every frame mendwingCombat's `u.healTimer += dt` was immediately cancelled by the next Unit.update tick, so healTimer hovered at one-frame's-worth forever and the 2-second heal threshold was never reached. Mendwing never healed anyone in live play from Phase 1 through Phase 7b (pre-existing bug, not a rewrite regression). Fixed 2026-04-13 by flipping healTimer to use the `accumulator` field instead of `duration`, matching the pattern `burnDmgAcc` and `poisonDmgAcc` already use. Accumulator is not decremented by Unit.update's tick loop. 5-line fix in `Unit.ts:372-373`.

    **Lesson for future audits:** code-review alone can miss runtime bugs in cross-file interactions between getter/setters and tick loops. Audit methodology should include live smoke testing of behaviors declared "works correctly" — the effects-Map-as-cooldown-storage pattern was plausible from static reading but didn't survive first contact with a per-frame decrement loop. Recorded as memory update to `project_combat_rewrite.md` under the "audit methodology" section.
- **Finding 8: `Unit.doAttack()` is dead code** [`Unit.ts:322-325`]. Method calculates damage with variance and returns it, but CombatSystem inlines the calculation at line 113 instead. Never called from anywhere. Safe to delete in a cleanup pass.
- **Finding 9: Aura iteration loops don't filter `burrowed` allies** [`CombatSystem.ts:249-259`]. The `modifyAllyDamage` loop iterates all same-side alive allies, but doesn't exclude burrowed ones. No current burrowing unit exists, so this is theoretical. Fix when/if burrowing becomes a real mechanic.
- **Finding 10 (new, 2026-04-13): `regenTimer` is a dead field** [`Unit.ts:369-370` + `types.ts:318`]. Declared as a getter/setter pair on Unit and as a field on the IUnit interface, but grep shows zero `regenTimer =` or `regenTimer += ` assignments anywhere in production code. No unit hook writes to it, no system reads it. Pure dead code, similar shape to Finding 8 (`Unit.doAttack()`). Surfaced during Phase 7b Mendwing fix audit — executor did a comprehensive timer-getter/setter table while fixing `healTimer`, noticed `regenTimer` had no assignment anywhere. Safe to delete in Phase 9 cleanup pass along with Finding 8. Zero runtime impact.
- **Finding 11 (new, 2026-04-13): Mendwing heal range inconsistency** [`normal.ts:362-368`]. `mendwingDef.range = 90` is declared for Mendwing's default attack cycle (where the legacy `_findTarget` gates enemies within 90px). But `mendwingCombat.onUpdate`'s heal logic filters allies by `a.side === u.side && a !== u && a.hp < a.maxHp` with **no distance check** and picks the nearest wounded ally via `Math.abs(x difference)` regardless of how far away it is. Effectively infinite heal range. Works in typical clustered-ally play (nearest wounded is usually within 90px anyway) but diverges from the declared range. **Phase 8 will introduce a behavior change:** `heal_pulse` ability at [utility.ts:11-19](../src/config/combat/abilities/utility.ts#L11-L19) declares `range: 90` with `targeting: 'lowest_hp_ally_in_range'`, so the Phase 8 migrated Mendwing will cap at 90px. User should confirm at Phase 8 kickoff whether 90px is the intended post-migration behavior or whether legacy infinite range should be preserved via a new `lowest_hp_ally_anywhere` selector (my lean: 90px is the correct, consistent behavior; legacy infinite is almost certainly an oversight from pre-rewrite code that missed the range gate). Surfaced during Phase 7b smoke test discussion about Mendwing's heal scope.
- **Finding 12 (new, 2026-04-14): `_legacyPostApplyPhase` missing cancelled/latch guard — Bombardier double-fire race** [`CombatSystem.ts:760-785`]. The post_apply subscriber checks `if (!u.dead) return;` at [`CombatSystem.ts:765`] but does NOT check `event.cancelled` or use a per-unit latch. If two damage events land on the same unit in one drain cycle — event 1 kills target, fires `handler.onDeath`; event 2's apply phase cancels via the `u.dead` guard at [`CombatSystem.ts:672-673`]; event 2's post_apply still reaches :765, sees `u.dead === true`, fires particles/audio/`handler.onDeath` AGAIN — the onDeath hook can fire twice for the same death. For Bombardier specifically, double-fire means double AOE explosion. Low probability in current Phase 8 workloads (per-call drain cadence means same-frame multi-hits on one target are rare), but the race is real in code. **Fixed in the Phase 8 Stage 1 infrastructure scaffold commit** as part of the F5 IP-4 lock in [COMBAT_REWRITE_PHASE8_DECISIONS.md](../archive/COMBAT_REWRITE_PHASE8_DECISIONS.md): adds `u._deathTriggerFired` scratch field (mirroring the `_spawned` pattern at [`CombatSystem.ts:301-304`]), applies **asymmetric ownership** — `_legacyPostApplyPhase` is CHECK-ONLY (the backport adds `|| u._deathTriggerFired` to its gate but does NOT set the latch), `applyDeathTriggerPhase` is CHECK-AND-SET (the new subscriber sets the latch before its own `!deathAbilityName` early-return so non-Bombardier dying units still arm Finding 12 protection for event 2+). The asymmetric ownership was caught during executor Stage 1 kickoff stop-and-report: first-pass lock had both subscribers set the latch, which made `applyDeathTriggerPhase` unreachable for every dying target in the locked post_apply registration order `[_legacyPostApplyPhase, applyEffectsPhase, applyDeathTriggerPhase]`. Two-file touch (Unit.ts + CombatSystem.ts), borderline on the refined scope discipline rule, orchestrator judgment call per Phase 8 decisions doc. Same treatment as Findings 10 and 11 from Phase 7b closure — record here on surface, fix in-session during the commit that consumes the guard. Surfaced during Phase 8 design review's Max-budget F5 code-ground pass; latch-ordering bug caught during executor kickoff orientation.
- **2026-04-17 — Combat Rewrite Phase 10 (Balance v1 — architectural) ✅ DONE. PROGRAM CLOSED.** Five batches landed clean: **Batch 1** (variance redesign — hybrid deterministic-default + opt-in `variancePct`/`critChance`/`critMult` per ability, `applyVarianceAndCritModify` replaces legacy `[-3, +2]` flat, `_attackerVarianceOverride` deleted). **Batch 2** (Stormfly/Longeye `baseDamageOverride` removal → multi-target attack cycle sets `event._targetIndex` + `event.damageMultiplier`, Phase 8 F4 dead-code calculate-phase falloff goes live, Centurion rally now folds into multi-target via `applyModifiers`). **Batch 3** (DEFAULT_EFFECTS table — `blunt→knockback`, `heat→burn`, `electric→stun`, `cold→slow`, `toxic→poison`; three-state `appliesEffects` resolution; real `knockback.onApply` body with poise accumulation + stagger FX via `ctx.source` attacker access; poise removed from `_legacyApplyPhase`; `stackable: true` on knockback for per-hit parity caught by two-attacker test). **Batch 4** (`Unit.effects` Map fully retired — 6 timer shims audited: slow/stun → `hasActiveEffect()` queries, healTimer → plain numeric field, shieldAbsorb/burrow/summon deleted unused; `StatusEffect` interface deleted). **Batch 5** (renames: `_legacyApplyPhase`→`_applyDamagePhase`, `_legacyPostApplyPhase`→`_applyDeathEffectsPhase`, `legacy_basic_attack`→`override_damage_event`; base-attack variance deleted at 3 sites making base attacks deterministic; **aggressive comment sweep ~2500 lines removed across combat files**, CombatSystem.ts 1661→1000, types.ts 970→600). **Headline: 634 tests green** (from 694 at Phase 9 close; variance-parametrized loops collapsed to deterministic in Batch 1), tsc + vite clean, bundle 1644.88 kB raw / 387.68 kB gzipped. **Documented gameplay shifts carried into Balance v1** (not regressions): +0.5 average per pipeline hit, Centurion rally now buffs Stormfly chain + Longeye pierce (+20% atk fold-in), non-blunt melee no longer contributes to poise (F11 intent), Bombardier death_bomb applies no effect, slow/poison defaults fire inert until bodies ship, resistance now scales multi-target damage, -1.5 average per base attack, stackable knockback one-frame transient. **Balance v1 backlog** (number tuning, not a phase): unit stat retune pass, hive HP retune, Bombardier flat-65 vs atk-scaled decision, drain cadence per-call vs once-per-tick decision, Stormfly/Longeye rally compensation, non-blunt stagger review, slow/poison real body wiring, bleed + sharp default wiring, per-ability variance/crit opt-ins, Longeye forward-arc if 2D content surfaces. **AI Hive v2 UNBLOCKED** — combat primitives (`calculatePhase` for damage preview, `AbilityDef` data surface, `applyModifiers` for aura prediction, `runSelectorInRange` for targeting, `ResourceSystem` for cooldown inspection, pipeline introspection via `findEvents`/`cancelEvent`) all live. Recommended sequence: Balance v1 number tuning first (AI plans against tuned numbers), then AI Hive v2, then Balance v2.
- **2026-04-17 — Combat Rewrite Phase 9 (Legacy combat removal) ✅ DONE.** Three batches landed clean: **Batch 1** (Grub defaultAbility, Bombardier defaultAbility, Cinderfly `aoeRider` primitive replacing legacy `afterHit` spread — user decision 2026-04-17 to keep the spread as gameplay identity). **Batch 2** (DOT dispatcher rewired from `hitUnit` to `queueAbility` with Wardling aura parity preserved via modify phase; `_processStatusEffects` + `hitUnit` wrapper + `CombatContext.hitUnit` deleted; attack cycle simplified to single migrated path; dead `handler.onAttack` / `else` / `afterHit` call sites deleted — executor scope extension from `afterHit` discovery approved). **Batch 3** (`targetCount` cap centralized in `runSelectorInRange`; `CombatHooks` interface + `COMBAT_MAP` deleted; dead `handler.onDeath` dispatch removed; `regenTimer` / `Unit.doAttack` / `hitCount` / `_ralliedByUid` / `_baseAtk` / `_rallied` all purged; scenario helpText modernized; phase-provenance comment cleanup across the board). Headline: **694 tests green** (696 at Batch 2 close, −2 from retired COMBAT_MAP assertions), tsc + vite clean, bundle shrunk ~2kB from deletions. **Legacy surface remaining** (explicit Phase 10 scope): `Unit.effects` Map (backing store for remaining timer shims — slowTimer/stunTimer/shieldAbsorbTimer/burrowTimer/summonTimer/healTimer), `_legacyPostApplyPhase` rename (method is production death handler, not legacy — name misleading), per-call drain cadence, `baseDamageOverride` on multi-target abilities (becomes dead code after variance redesign), stun duration per-ability customization, Longeye forward-arc selector, `legacy_basic_attack` ability rename. **Deferred to Phase 10** (not Phase 9): Item 10 (forward-arc — requires `SelectorEntity.facing` extension, no practical 1D-lane impact), Item 17 (drain cadence — behavior change, not cleanup). **Migration program structurally done** — Phase 10 is gameplay tuning, not architectural work.
- **2026-04-17 — Combat Rewrite Phase 8 (Unit migration tier 3) ✅ DONE.** 9 units migrated across 5 stages (Stages 1-2 infrastructure, Stage 3 Legionnaire + Bashguard, Stage 4 Ravager + Wardling + Centurion + Mendwing, Stage 5 Bombardier + Stormfly + Longeye). **688 tests (+231 from Phase 7b), 111 modules, tsc + vite clean.** Two smoke-caught fixes in Stage 5: (1) first-attack range mismatch — `_findTarget` edge-to-edge distance vs `runSelectorInRange` left-edge-to-left-edge, fixed by using `_findTarget`'s primary directly; (2) `chainRange` parity — legacy chains from primary within 114px, new system selected from attacker, fixed via `chainRange?: number` on AbilityDef. Phase 8 new infrastructure: `targetFalloff`, `_targetIndex`, `overchargeEvery`, `chainRange`, `effectChance` gating, stun `onApply` bridge, `DeathTriggerDispatcher`, multi-target attack cycle. 7 documented divergences from legacy (all accepted or deferred to Phase 10). Only `cinderflyCombat.afterHit` (burn spread) remains as legacy. **Phase 9 backlog: 18 items formalized in [COMBAT_REWRITE_PHASE9_CLEANUP.md](../archive/COMBAT_REWRITE_PHASE9_CLEANUP.md).** Phase 8 design decisions: [COMBAT_REWRITE_PHASE8_DECISIONS.md](../archive/COMBAT_REWRITE_PHASE8_DECISIONS.md) (F3-F14 + 5 new architectural locks).
- **2026-04-15 — Phase 8 Stage 4 (Passive migrations) ✅ COMPLETE on automated gates, pending consolidated smoke.** All four passive-category units migrated to the new architecture across Items 11–14: **Item 11 Ravager** (IP-3 + `selfModifier` step function gated by `hp_below_half` predicate, shipped with new `PassivePredicates.ts` module); **Item 12 Wardling** (IP-1 + FIRST `auraModifier` consumer, walked-list dispatch architecture with Walk 1 enter / Walk 2 exit / `_auraCleanedUp` death latch, 3 documented legacy divergences — distance `<` preserved, rounding `ceil → round` intentional per IP-1 lock, multi-source additive-vs-multiplicative intentional per Phase 5 ModifierSystem design); **Item 13 Centurion** (IP-2 + SECOND aura consumer with ZERO changes to `updatePassives` — second-consumer architectural validation pattern); **Item 14 Mendwing** (IP-5 heal category THIRD dispatch branch with new `runSelectorInRange` helper in `Targeting.ts` as the first production consumer of the selector registry, `PassiveHealConfig` interface, Divergence E cooldown semantics — no reset on empty target, F13=B production-pinned 90px range). **Cumulative Stage 4 test delta: +114** (517 at Stage 3 close → 631 at Stage 4 item 14 checkpoint), biggest single-stage delta in Phase 8. `updatePassives` now carries three orthogonal dispatch categories (self-modifier + aura + heal) each reading a different UnitDef config field. All four Stage 2 IP gates (IP-1/IP-2/IP-3 read-gate subscribers + IP-5 passive tick loop orchestration) now have live production consumers hitting the non-short-circuit path — Task 1's pre-migration pipeline tests predicted the behavior algebraically; Items 11-14 validated it end-to-end through real pipeline assembly. **Pre-implementation audit discipline promoted** — Items 11-14 each shipped with a pre-implementation audit catching 5+ issues across the stage before code touched files (Item 12's 3 divergences, Item 13's 4 stop-trigger greps, Item 14's 2 architectural issues — `runSelectorInRange` missing + Divergence E cooldown semantics). **Second-consumer validation pattern named** at Item 13: when a new architectural primitive's first follow-on consumer requires zero additions to the primitive's code, the primitive is correctly generic. Stage 5 item 15 Bombardier will validate `runSelectorInRange` as the second consumer via the `death_bomb` selector. **Divergences consolidated:** A (distance `<` preserved via `>=` flip), B (Math.round vs ceil, 1-point drift at dmg ∈ {23,24}), C (multi-source additive stacking), D (Phase 5 ModifierSystem read-time semantics for `ally.atk`), E (Mendwing cooldown no-reset-on-empty), F (Mendwing lowest-HP vs nearest triage-priority — locked consequence of F13=B). **F13 production-pinned 2026-04-15** at Item 14 checkpoint — no longer an open user decision. **Phase 9 backlog status: 12 items** (heal_pulse.trigger typo fixed in-session at Item 14, removing backlog item #13; still holding on formalizing COMBAT_REWRITE_PHASE9_CLEANUP.md until Stage 5 close). **Stage 4 close smoke on `stage4AllPassives` scenario is the next gate** — consolidated per the 2026-04-15 smoke cadence revision; stage boundary smoke, not per-migration. Stage 5 unblocks on user confirmation.

## How to resume in a new conversation

1. **Read this doc first** — top-level program tracking. The item table is the single source of truth for what's active.
2. **For combat work (the active program):** read [COMBAT_REWRITE_PLAN.md](../archive/COMBAT_REWRITE_PLAN.md) for the active phase and its deliverables. Read [COMBAT_REWRITE_DECISIONS.md](../archive/COMBAT_REWRITE_DECISIONS.md) when you need to understand why the architecture is shaped this way.
3. **For deferred items:** [AI_PLAN.md](AI_PLAN.md) for AI v2 (Item 4). The plan is preserved verbatim — only timing changed.
4. **Combat Rewrite Program CLOSED 2026-04-17.** All 10 phases shipped. 634 tests, 112 modules, zero legacy combat code surviving. Architecture is data-driven: `UnitDef` + `AbilityDef` + `EffectSystem` + `ModifierSystem` + `ResourceSystem`. Next work is **Balance v1 number tuning** (iterative playtest-driven, not a phase) + **AI Hive v2** ([AI_PLAN.md](AI_PLAN.md) — unblocked). Both can proceed in parallel; recommended sequence is Balance v1 first (AI plans against tuned numbers). Phase 10 exit report + full closure context live in the decision log entry below dated 2026-04-17.
5. **Get design alignment** before coding. The user has consistently asked for design-first. The COMBAT_REWRITE_DECISIONS doc captures the load-bearing calls; if a phase surfaces something that conflicts with those decisions, STOP and escalate per the stop-and-report rule.
6. **Update this doc as work progresses** — mark phases DONE in the Item 2 phase status table, add decision log entries, surface new tech debt to the appropriate section.
