# AI Hive v2 — Implementation Plan

> **STATUS: DEFERRED (2026-04-12)** — premature until core game mechanics are stable.
>
> **Why deferred:** Building smart AI on top of incomplete primitives means re-tuning everything when those primitives change. The capacity system isn't implemented, the counter matrix doesn't exist as a formal layer, combat has rough edges, and unit balance hasn't had a real pass. Tuning utility AI considerations against a moving target wastes work.
>
> **Resume after** (in order):
> 1. Capacity system implemented (per-unit cap costs, hard cap, UI feedback)
> 2. Counter matrix or keyword system formalized (so the counter-pick consideration has data to read)
> 3. Combat audit pass (any remaining bugs/holes fixed)
> 4. Unit balance pass (numbers tuned with stable mechanics)
> 5. Manual playtest validation (game feels good for human players)
>
> **What stays valid in this document:** the architecture (3-layer brain, sensors, IAUS with compensation factor), the difficulty model (intelligence axis vs roster axis), the research findings, the file structure plan, and the phase order. None of this changes — only the *timing* changes.
>
> **The current `AIHiveController` (committed `b864d42`) is sufficient as a test opponent** during mechanics work. It plays the game even if not smartly.
>
> **What's still worth building before resume** (if/when needed):
> - Phase 0 — Debug infrastructure (useful for debugging *any* system, mechanics included)
> - Phase 0.5 — AI Lab Scene (test bench for mechanics, not just AI)
> - Phase 1 — Telegraphing concepts (AI v1 can show simple intent now)
>
> **Premature until resume:** Phases 2-6 (sensors, utility AI core, layers, considerations, difficulty knobs).
>
> ---

Plan for replacing the current weighted-random `AIHiveController.think()` with a research-grounded three-layer Utility AI. Locked 2026-04-12 after 5 parallel research threads (IAUS, RTS macro AI, lane-battler patterns, sensor/blackboard patterns, intelligence-based difficulty).

**Goal:** make the AI genuinely *smarter*, not richer or stronger. Difficulty scales by intelligence, never by stat inflation.

## Status

- **Current state**: `AIHiveController` uses weighted random selection over affordable units. Personality biases role weights. No sensors, no goal layer, no memory of plan, no reaction to player.
- **Committed at**: `b864d42` — current behavior is the baseline.
- **Plan locked but not started.** No code yet.

## Architecture decisions (locked)

### 1. Three-layer brain (Strategic / Operational / Tactical)

Validated by RTS macro AI literature (UAlbertaBot, McCoy & Mateas, Halo's nested loops). Two layers were considered but rejected — the third layer is what enables push windows, multi-stage plans, and stable strategic identity under tactical adaptation.

```
Strategic  : winCondition, posture, riskAppetite        (10-30s, event-driven)
Operational: targetComp, investRatio, saveTarget,       (2-5s)
             pushActive
Tactical   : decision = queue(unit) | save | wait       (1.5-4s, every think tick)
```

**Strict contract**: each layer reads only from layers above (or sensors). Lower layers signal upward via `HiveWorldState` writes, never via direct calls. This is what stops three-layer designs from collapsing into a god class.

### 2. Sensors as the "what AI knows" layer

Validated by Halo's `props`, Unreal's `AIPerceptionComponent`, GOAP world state. Single-writer-per-namespace, snapshot-per-think-tick (not per frame).

```
sensors/
  EconomySensor       writes  self.*
  CompositionSensor   writes  player.*  (fidelity-gated by difficulty)
  BaseStateSensor     writes  bases.*
  TimingSensor        writes  timing.*
```

Decision logic is **read-only** against the snapshot. Never touches live `units[]` or `gm.*`. This unlocks:
- Unit-testability (feed fake snapshot, assert decision)
- Imperfect information for lower difficulties (sensor returns blurry/delayed data)
- Single dump-point for "why did the AI do that" debugging

### 3. Utility AI with IAUS Compensation Factor

Validated by Dave Mark's GDC 2013/2015 talks, Game AI Pro Ch.9, Curvature wiki, Guild Wars 2 (shipped). Math:

```
score = product(considerations) with compensation factor
compensation: finalScore = curved + (1 - curved) * modFactor * curved
              modFactor   = 1 - (1 / numConsiderations)
```

Compensation factor is **non-negotiable** — without it, decisions with more considerations get unfairly diluted. Veto property preserved (0 stays 0).

**Considerations stored as data** (not hard-coded), hot-reloadable via debug command. Each consideration has: name, input fn, bookend low/high, response curve, curve params.

### 4. Momentum bonus replaces explicit commitment state

Validated by Curvature wiki and IAUS practice. Previously-picked action gets a flat ~25% score bonus for the next tick. Creates implicit hysteresis without a state machine. Difficulty knob: D1 has 0% momentum (flips constantly), D4 has 40% (locks in plans).

### 5. Difficulty = top-N widening + noise + sensor fidelity

Validated by Into the Breach (ITB's *entire* difficulty system is top-N), Stockfish skill levels, FTL probabilistic smart-mode. **One AI architecture, four difficulty presets.** We do not write four AIs.

Roster composition (size, tier access) scales with **run progression** (node depth), NOT with intelligence. Two orthogonal axes — see the encounter matrix below.

## Difficulty model

### Axis 1: Intelligence (D1-D4) — pure smartness

| Knob | D1 Scout | D2 Soldier | D3 Warrior | D4 Champion |
|---|---|---|---|---|
| Sensor fidelity | self only | + player.fieldCount | + player.dominantRole (2s delay) | full + no delay |
| Strategic layer | fixed posture | fixed posture | adaptive on HP triggers | adaptive + push-window detection |
| Operational layer | skipped (uses defaults) | basic targetComp | full + invest ratio | full + counter-strategy |
| Considerations active | affordability + roleGap | + economyEfficiency + antiRepeat | + counterPick + timing | + desperation |
| Top-N pick width | 4 | 3 | 2 | 1 (optimal) |
| Score noise sigma | 0.25 | 0.15 | 0.05 | 0 |
| Think interval | 4.0s | 3.0s | 2.5s | 1.5s |
| Momentum bonus | 0% | 10% | 25% | 40% |
| Anti-repeat depth | 0 | 2 picks | 3 picks | 5 picks |

All knobs stored in `DifficultyPresets.ts` as data. Tunable without rebuild.

### Axis 2: Roster (run progression) — orthogonal flavor

Driven by node difficulty in `LayerDefs.ts`. Already lives in `HiveProfileGenerator.ts`. NOT a smartness lever.

| Run depth | Roster size | Tier access |
|---|---|---|
| Layer 1 | 3 | T1-T2 |
| Layer 2 | 4 | T1-T3 |
| Layer 3 | 5 | T1-T3 |
| Layer 4 | 6 | T1-T4 |

### Encounter matrix (the design space this unlocks)

| Encounter | Intelligence | Roster | Feel |
|---|---|---|---|
| Tutorial hive | D1 | 3 units | "Easy to read, forgiving" |
| Early elite | D3 | 3 units | "Small roster but plays it perfectly" |
| Late regular | D2 | 5 units | "Diverse but beatable" |
| Boss | D4 | 6 units | "Full surface, perfect play" |
| Surprise elite | D4 | 3 units | "Tiny roster but reads you" |

## File structure

```
app/src/systems/ai/
  HiveWorldState.ts           snapshot type + factory
  sensors/
    EconomySensor.ts          writes self.*
    CompositionSensor.ts      writes player.*  (fidelity-gated)
    BaseStateSensor.ts        writes bases.*
    TimingSensor.ts           writes timing.*
  layers/
    StrategicLayer.ts         winCondition, posture, riskAppetite
    OperationalLayer.ts       targetComp, saveTarget, pushActive
    TacticalLayer.ts          utility AI scoring + pick
  considerations/
    index.ts                  registry
    affordability.ts          hard veto
    roleGap.ts                fill targetComp
    counterPick.ts            react to player.dominantRole
    economyEfficiency.ts      value/cost
    timing.ts                 push window awareness
    desperation.ts            base HP pressure
    antiRepeat.ts             prevent spam
  curves.ts                   linear, logistic, logit, quadratic, smoothstep
  DifficultyPresets.ts        D1-D4 knob table as data
  AIHiveController.ts         orchestrator (shrinks to glue code)
  debug/
    DecisionLog.ts            per-tick decision dump
    AIDebugOverlay.ts         live HUD for inspection
```

Each file under 200 lines, single responsibility.

## Implementation phases

Each phase is independently shippable. Can pause/redirect at any boundary.

### Phase 0 — Debug infrastructure
**Why first**: research consensus is unambiguous. Without decision logging and a live overlay, utility AI is impossible to tune. Build the inspection layer before the AI itself.

- Decision log data structure: per think-tick, every candidate, every consideration's raw -> normalized -> curved -> compensated -> final, momentum/noise contributions
- Live AI overlay (upgrade existing `ai` debug command): goal state, sensor snapshot, top 3 candidates with scores
- Stability metric: decision changes per second
- Hot-reload command stub: `aireload`
- Per-consideration contribution readout

**No visible AI improvement yet** — we're building the lab before the experiment.

### Phase 1 — Telegraphing
**Why second**: highest perceptual ROI in the entire plan. ~50 lines of UI for one of the biggest "feels smart" wins. Reads from existing state — no AI changes needed yet. Doing this early gives us a baseline comparison: telegraphed-but-dumb vs telegraphed-and-smart.

- Enemy HUD: goal mode badge ("DEFENDING" / "PUSHING" / "SAVING")
- Next unit + ETA in incubation slot (already exists, polish it)
- "Reacting to your swarm" flavor text (driven by which consideration dominates)
- Push-window warning ("PREPARING ASSAULT")
- Reads from `gm.waves.intent` and goal state — no new code paths

### Phase 2 — Sensors + WorldState
- `HiveWorldState` interface
- 4 sensors, fidelity-gated
- Snapshot updated at think-tick frequency (not per frame)
- Unit tests with fake game states
- AIHiveController updated to populate snapshot before think()

**No decision changes yet** — just the read layer.

### Phase 3 — Utility AI core
- `curves.ts`: linear, logistic, logit, quadratic, smoothstep + unit tests
- `Consideration` interface
- IAUS scoring with compensation factor + unit tests
- 2 starter considerations: `affordability` (hard veto) + `roleGap`
- Swap into `AIHiveController.think()`, remove old weighted-random logic
- Validate D4 (top-N=1, no noise) feels demonstrably smarter than current

**At this point: AI is better than today with minimal surface area.**

### Phase 4 — Strategic + Operational layers
- `StrategicLayer`: winCondition + posture, personality-anchored, trigger-based re-eval
- `OperationalLayer`: targetComp + investRatio + saveTarget + pushActive
- Cadence: Strategic on events + 10s timer; Operational every 2-5s
- Strict layer contract enforced (read-from-above only)
- Per-layer decision logging

**Adds strategic coherence and push windows.**

### Phase 5 — Remaining considerations
- `counterPick` (reads player.dominantRole)
- `economyEfficiency`
- `timing` (push window awareness)
- `desperation` (base HP pressure)
- `antiRepeat` (recent picks penalty)
- Tuning pass on all curve params via hot-reload

**Full Utility AI surface.**

### Phase 6 — Difficulty knobs
- `DifficultyPresets.ts` as data
- Top-N widening, score noise injection, momentum bonus
- Sensor fidelity gating per tier
- `HiveProfile.intelligence: 1|2|3|4` field
- `HiveProfileGenerator` picks intelligence independently from roster
- Optional `aiIntelligence?: 1|2|3|4` override on `NodeDef`

**Unlocks 4-tier difficulty without 4 codebases.**

## Debug tooling requirements (P0)

Non-negotiable per research consensus. Building these is half the battle.

1. **Decision dump table** — every think tick, log every candidate's full scoring breakdown:
   ```
   tick 42 | nectar=87 | goal=push
   unit       afford  roleGap  counter  econ  timing  desp  -> final  pick?
   grub       1.00    0.30     0.50     0.85  0.40    0.20     0.029
   alpha      0.00    -        -        -     -       -        0.000  (vetoed)
   zephyr     1.00    0.65     0.90     0.55  0.80    0.30     0.247  PICK
   ```
2. **Live overlay** (extend existing `ai` command): goal state, sensor snapshot, top 3 candidates
3. **Hot-reload curves**: change consideration params via debug console without rebuild
4. **Stability metric**: count decision changes per second; flip-flopping = tuning bug
5. **Per-consideration contribution**: instantly see which axis killed a score
6. **Replay capability** (optional, deferred): record snapshots, replay through modified curves offline

## Telegraphing requirements (P1)

Per research: perceived smartness comes from intent display, not decision quality. This is FREE smartness.

1. **Goal mode badge** on enemy HUD (5 lines): "DEFENDING" / "PUSHING" / "SAVING" / "DESPERATE"
2. **Reacting flavor text** (15 lines): when counterPick consideration dominates, show "Reacting to your swarm"
3. **Push-window warning** (10 lines): when Operational sets `pushActive=true`, show "PREPARING ASSAULT"
4. **Next unit + ETA** in incubation slot (already exists, just polish)
5. **Total**: ~50 lines of UI. ROI is enormous.

## Critical pitfalls to avoid

From research synthesis. Re-read before each phase.

- **Score dilution under multiplication** — solved by Compensation Factor, not optional.
- **Single-consideration tyranny** — never let one axis output exactly 0 unless you mean to veto. Use bookends with care.
- **Flip-flopping** — solved by momentum bonus. Watch the stability metric during tuning.
- **God-object blackboard** — single writer per namespace. No sideways writes.
- **Stringly-typed keys** — use TS types for `HiveWorldState`, not `Record<string, any>`.
- **Fake layer separation** — lower layers read upward only, never downward. No direct calls.
- **Top-down-only flow** — Strategic must read upward signals (e.g. "comp gap unfilled") to know its plan is failing.
- **Tight coupling to unit types** — Strategic outputs *roles* not unit IDs. Adding genelines must not break Strategic.
- **HP/damage scaling** — banned. Difficulty is intelligence only.
- **Hidden info cheats** — sensors must respect fidelity tier. No omniscient AI even at D4 (D4 is "perfect reaction to perfect info", not "knows the future").

## Open questions deferred

Not blockers, but worth revisiting after Phase 3.

1. **Strategic re-eval cadence** — pure event-driven, pure timer, or hybrid? Hybrid is safer but may flip-flop. Tune via stability metric.
2. **Phased game plans** — should Operational support multi-stage scripts ("build-up -> spike -> all-in")? Phase 4 starts with single-state goals; revisit if pacing feels flat.
3. **Memory across battles** — should AI remember player tactics from previous battles in the same run? Probably no for v1.
4. **Inter-consideration conflicts** — what if `counterPick` says "tank!" but `roleGap` says "DPS!"? Multiplication handles it, but watch for cases where the answer is genuinely "neither, save."
5. **Debug overlay scope** — shipped overlay vs dev-only? Currently dev-only via `import.meta.env.DEV` tree-shaking.

## Research provenance

Five parallel research threads ran on 2026-04-12. Key sources cited (one per thread):

- **Utility AI / IAUS**: Dave Mark, GDC 2015 "Building a Better Centaur"; Game AI Pro Ch.9 "An Introduction to Utility Theory" (free PDF, gameaipro.com)
- **Three-layer macro AI**: McCoy & Mateas "A Tactical and Strategic AI Interface for RTS Games" (AAAI 2008); UAlbertaBot (github.com/davechurchill/ualbertabot)
- **Lane-battler patterns**: Arun Patro "Thoughts on building a theoretical Clash Royale AI"; Battle Cats wiki spawn schema
- **Sensors / blackboard**: Damian Isla "Handling Complexity in the Halo 2 AI" (GDC 2005); Unreal AIPerceptionComponent docs
- **Intelligence-based difficulty**: Matthew Davis "Into The Breach AI document" (archive.org); Stockfish skill level implementation

Full source list in conversation history (not duplicated here to keep this doc lean).

## Phase tracking

- [ ] Phase 0 — Debug infrastructure
- [ ] Phase 1 — Telegraphing
- [ ] Phase 2 — Sensors + WorldState
- [ ] Phase 3 — Utility AI core
- [ ] Phase 4 — Strategic + Operational layers
- [ ] Phase 5 — Remaining considerations
- [ ] Phase 6 — Difficulty knobs
