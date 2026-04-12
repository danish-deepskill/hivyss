# Hivyss Mechanics Roadmap

> **Current strategic priority.** Created 2026-04-12 after AI Hive v2 plan was deferred (see [AI_PLAN.md](AI_PLAN.md) status block). The user judged that building smart AI on top of incomplete primitives is wasted work. This document tracks the foundational mechanics work that needs to land **before** AI v2 resumes.
>
> **How to use this doc:** Read top to bottom. Items are in priority order. Each item has a status, scope, open design questions, and (where applicable) my recommended answers. Update status as work progresses. When all items are ✅ done, the AI v2 plan unblocks.

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
| 1. Capacity system | ✅ REVIEWED & APPROVED (awaiting browser playtest) | P0 |
| 2. Counter matrix / keyword system | NOT STARTED | P1 |
| 3. Combat audit pass | NOT STARTED | P1 |
| 4. Unit balance pass | BLOCKED on 1-3 | P2 |
| 5. Playtest validation | BLOCKED on 1-4 | P2 |
| (Then) AI Hive v2 resume | DEFERRED | After P2 |

---

## Item 1 — Capacity System (P0, ✅ IMPLEMENTED 2026-04-12)

> **Status:** Code landed, 20 unit tests passing (`Capacity.test.ts`), production build clean. Awaiting user browser playtest to validate visuals and gameplay feel. See `CAPACITY_DESIGN.md` for the full mini-spec.
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

### What's still open
- Browser playtest validation (cap-blocked card visibility, cap bar layout feel, AI behavior reads correctly under cap)
- Cap value tuning during balance pass (Item 4)
- **Centurion cost drift flagged for balance pass**: roadmap table originally suggested cost=140, but `alpha.ts` has cost=100 and has for some time (this was not changed during capacity work — only the `cap` field was added). Roadmap vs. code drift, not a regression. Decide during balance pass which number is correct.

---

## Item 2 — Counter Matrix / Keyword System (P1, NOT STARTED)

### Why
Right now, "what counters what" lives in the player's head. There's no formal layer that says "AOE counters swarm" or "ranged counters slow tank". Without this:
- The AI can never make meaningful counter-pick decisions
- Unit design has no anchor for "what should this unit be strong/weak against"
- Players can't learn matchups except by feel

### Two competing approaches
- **(A) Counter Matrix** — explicit `[role][role] → multiplier` table. Simple, designer-friendly, easy to read.
- **(B) Keyword System** — units have tags (`armored`, `flying`, `swarm`, `unit`), other units have bonuses against tags (`vs_armored: +50%`). More flexible, scales to many unit types, follows Warcraft 3 / SC2 / MTG pattern.

### Recommendation
**(B) Keyword system** — more powerful, fits the planned 24 genelines, integrates with existing route system (air/land/tunnel are already keyword-like).

### Open design questions
1. What keywords exist? (armored, flying, swarm, unit, beast, machine?)
2. How do bonuses combine? (additive, multiplicative, max?)
3. Are bonuses on attacker (Grub does +50% vs swarm) or defender (Swarm takes +50% from AOE)?
4. Does this layer over the existing damage system or replace parts of it?

### Scope estimate
- New `keywords?: Keyword[]` field on UnitDef
- New `bonuses?: { vs: Keyword, mult: number }[]` field
- Damage calculation changes in CombatSystem
- ~150 lines + tuning

### Action items when this resumes
1. Decide A vs B with user
2. If B: list of keywords
3. Apply to existing units
4. Implement in CombatSystem

---

## Item 3 — Combat Audit (P1, NOT STARTED)

### Why
The combat system has accumulated complexity and bugs surface during testing. Before tuning numbers (Item 4), the system itself needs a once-over to catch any other "player units couldn't attack enemy base"-class bugs.

### What to audit
1. **Attack timing** — foreswing/backswing, animation sync, cancel logic
2. **Knockback / stagger** — poise system, edge cases, stacking
3. **Status effects** — poison, burn, stun, slow, shield — interactions, stacking, expiration
4. **Combat hooks** — onSpawn, onUpdate, onAttack, afterHit, onDeath, modifyDamage, modifyAllyDamage, getAtk — verify all fire correctly, no missed cases
5. **Route validation** — `canAttack` matrix, edge cases for multi-route units
6. **Death effects** — onDeath hooks (e.g. bombardier explosion), reward distribution
7. **Healing** — heal hook, max HP cap, friendly fire prevention
8. **Aura systems** — range, stacking, friendly-only enforcement
9. **Damage type system** — melee/ranged/aoe/poison/burn/heal/nectar/blocked/base — color codes, sound triggers, modifier application order

### Approach
- Read CombatSystem.ts top to bottom, take notes
- Read each combat hook in normal.ts and alpha.ts
- Construct test scenarios for each interaction
- Fix bugs as found
- No new mechanics added during audit

### Action items when this resumes
1. Read CombatSystem.ts and the current state of all combat hooks
2. List bugs / unclear behaviors
3. Fix in priority order
4. Document the system in DESIGN_PATTERNS.md if anything is non-obvious

---

## Item 4 — Unit Balance Pass (P2, BLOCKED on 1-3)

### Why
Balancing units before mechanics are stable means re-balancing later. Wait until capacity, counters, and combat are settled.

### Approach when unblocked
1. Set up AI vs AI battles in a sandbox/lab to gather win-rate data
2. Tune costs, HP, atk, atkRate, range, cap value
3. Target: no unit dominates, no unit is useless, every unit has a clear best-case scenario
4. Per-role baseline targets:
   - Tank should survive ~3x its cost in DPS
   - Ranged should kill ~1.5x its cost in tanks before being killed
   - Support should enable 2-3 other units to over-perform
   - DPS should kill ~equivalent cost in equal exchanges

### Open questions
- Should there be a published "balance bible" or just a designer-tuned set of numbers?
- How often is rebalance acceptable (per major version)?
- Are there "anchor units" that define the meta and others tune around?

### Action items when this resumes
- Build basic AI Lab Scene if not already (mechanics test bench, not for AI work)
- Run automated AI vs AI battles
- Track win rates per matchup
- Tune iteratively

---

## Item 5 — Playtest Validation (P2, BLOCKED on 1-4)

### Why
Numbers and mechanics that look right on paper might not be fun. Real human play surfaces issues that math doesn't.

### Approach
- Solo playthrough of the roguelike run mode
- Note: friction points, confusing UI, broken matchups, dead picks, exploits
- Iterate
- Get external playtesters if possible

### Action items when this resumes
- Define a "playtest checklist" — what to look for
- Run 5-10 full runs solo
- Take notes
- Apply fixes

---

## After all of P0-P2 are done: Resume AI Hive v2

See [AI_PLAN.md](AI_PLAN.md) for the locked architecture, research, and phase order. The plan is preserved verbatim — only the timing was changed. When mechanics are stable, jump back into Phase 0 (debug infra) and continue.

---

## Decision log

- **2026-04-12** — User questioned whether AI Hive v2 was premature given missing mechanics (capacity, combat completeness). I agreed. Pivoted to mechanics-first roadmap. AI_PLAN.md marked DEFERRED. This doc created.
- **2026-04-12** — Roster overhaul committed `4181b66`. Naming convention, traits, visuals all aligned. Considered "done" for v1 — further roster work blocked on mechanics.
- **2026-04-12** — Capacity system design LOCKED. All 7 questions answered (matches recommended leans): per-unit `cap` field, deployed+incubating counts, hard cap, explicit values, symmetric 20, three UI elements, immediate death-free + cancel refund + AI v1 filter. Remaining open: exact cap values per unit, UI visual style. Ready to implement.
- **2026-04-12** — Capacity implementation pre-review. Executor session surfaced 7 inline questions + 5 findings. Resolved: module (not class) for Capacity.ts, minimal Vitest for pure functions, `[5]` cap label default, stacked vertical bar layout, cyan/teal color, "HIVE FULL" rejection text, distinct red cap-blocked card state (NOT same as can't-afford). Asymmetry of chamber × cap (swarm=chamber-bound, elite=cap-bound) validated as intentional design.
- **2026-04-12** — Capacity implementation REVIEWED and APPROVED. All review criteria passed. Executor made three improvements beyond spec: structural typing in Capacity.ts for test isolation (no Unit/Chamber import dependency), dependency-injection `unitsProvider` pattern for AI (cleaner than coupling to GameManager), bonus cap bar color-shift at 80%/100% thresholds for early warning. Zero scope creep. 20/20 tests passing. TypeScript clean. Minor non-blocking notes: Centurion cost silently changed from 140 to 100 (flag for balance pass), CAPACITY_DESIGN.md still shows "SPEC" status (should be marked implemented), one awkward comment phrasing. Ready for browser playtest validation.
- **2026-04-12** — Capacity system implemented. 20 unit tests passing, production build clean. Architectural deviation: built as stateless module instead of `CapacityManager` class (capacity is fully derived state — 0 mutable fields would have made the class cargo-culted parallel structure). Two design surprises during impl: (1) `Unit` class doesn't store `UnitDef` reference, so added `cap` field copied in `init()` matching the existing `cost` pattern; (2) `AIHiveController` had no `gameManager` reference, so threaded `unitsProvider: () => readonly Unit[]` getter through constructor. Awaiting browser playtest.

## Tech debt / follow-ups (surfaced during other work)

- **`unitDied` event declared but never fired** (surfaced 2026-04-12 during capacity explore). Not blocking capacity (derived state doesn't need it). Latent issue — any future system needing death notifications will hit this gap. Fix when first real consumer appears, or during combat audit (Item 3). Location: `EventBus` declares event, no `emit('unitDied', ...)` call exists in codebase.

## How to resume in a new conversation

1. **Read this doc first** — it's the source of truth for what's next
2. **Read [AI_PLAN.md](AI_PLAN.md)** — understand what's deferred and why
3. **Pick the next P0/P1 item** — start with Item 1 (Capacity) unless user redirects
4. **Get design alignment** before coding — user has consistently asked for design-first
5. **Update this doc as work progresses** — mark items DONE, add new items if discovered
