# Unit Lifecycle Roadmap

> **Purpose:** Single source of truth for the Unit Lifecycle program — balance tuning of the 18 existing units AND addition of new units toward the 24-geneline / 100+ unit vision.
>
> **Pairs with:**
> - `UNIT_LIFECYCLE_DECISIONS.md` — locked decisions, dated log
> - `TIER_CONTRACT.md` — tier authoring contract (T0–T10 mechanical/visual budget)
> - `MECHANICS_ROADMAP.md` — adjacent program (capacity, AI v2)
> - `app/src/units/CLAUDE.md` — unit file structure + draw conventions
>
> **Status (2026-05-30):** **Batch 0 (passives refactor) — DONE.** Built as a passive **handler registry** (escalated from Option B; see [UNIT_LIFECYCLE_DECISIONS.md](UNIT_LIFECYCLE_DECISIONS.md) 2026-05-30 entries). `tsc` clean + 632/632 tests green. Next: **Balance (Batch 1) is now unblocked** — manual sandbox playtest, matchup-pair batches.

---

## 1. Program shape

Two motions, **sequenced — balance first, then addition**:

1. **BALANCE** — tune the 18 existing units for fair / interesting matchups via sandbox playtest.
2. **ADDITION** — author new units toward the 100+ unit vision. First scheduled addition: **cannon (alpha T2 Megavyss)** — deferred until balance produces tuning intuition.

**Pre-program work:** **Batch 0 (passives union refactor)** lands BEFORE balance starts. Foundation cleanup so balance + addition both ride a clean shape. See [UNIT_LIFECYCLE_DECISIONS.md](UNIT_LIFECYCLE_DECISIONS.md) 2026-04-20 entry.

---

## 2. Scope

### In scope

- Balance tuning of all 18 existing units (hp, atk, atkRate, spd, range, cost, cap)
- Passive shape refactor (Batch 0)
- Addition of new units (cannon + future units toward 24 genelines)
- Architectural primitives REQUIRED to ship a scheduled unit (e.g., projectile system for cannon) — gated by stop-and-report, treated as architectural sub-batches before the data unit
- New AbilityDef entries composing existing primitives
- New PassiveDef union variants when a unit needs a new passive shape
- Geneline kickoff work (alpha is alive; beta + later genelines as they activate)
- `units/<geneline>/` subfolder restructure when second geneline ships (per CLAUDE.md note)

### Out of scope

- Combat system internals (combat rewrite program closed 2026-04-17 — this program touches only the passive subscriber loop in Batch 0)
- AI Hive v2 (separate program, blocked until balance pass produces tuned numbers)
- Capacity system (P0 in `MECHANICS_ROADMAP.md`, separate program — `cap` field tuning here is forward-looking metadata only)
- Sandbox features (closed program — Phase 2 presets / Phase 3 polish are deferred there, not here)
- Procedural visual style overhauls (only adjust draws when adding/refactoring a specific unit)

### Stop-and-report triggers (executor pauses, orchestrator decides)

1. **New primitive needed.** A unit's ability needs a system that doesn't exist (projectile, channel, summon, etc.). Stop, report. Orchestrator decides: extend architecture (sub-batch), workaround (documented), or defer the unit.
2. **Passive shape doesn't fit union.** A new unit's passive doesn't fit existing PassiveDef variants. Stop, report. Orchestrator decides: add a new union variant or reshape the unit.
3. **Balance change cascades.** A single matchup-pair tune unexpectedly breaks 3+ other matchups. Stop, report — orchestrator escalates to user for scope adjustment.
4. **Cross-program dependency surfaces.** Touching Unit Lifecycle requires editing combat system, capacity system, or AI controller. Stop, report — likely belongs in the other program.
5. **AbilityDef field count grows by ≥3 in one batch.** Sign that AbilityDef may be approaching its own refactor inflection. Stop, report — orchestrator evaluates.

---

## 3. Batch table

| Batch | Title | Status | Notes |
|---|---|---|---|
| **0** | **Passives handler registry** | **✅ DONE (2026-05-30)** | Built as `kind→handler` registry (`systems/PassiveHandlers.ts`), not just the union. `tsc` clean + 632 tests green. Execution-model split documented (event-passives → pipeline phases). |
| **1** | Balance — matchup pairs | **NOW ACTIVE** | Unblocked by Batch 0. Manual sandbox playtest; first pair = highest-friction matchup observed. NOTE: uncommitted balance scratch (centurion aura 80→100, several normal.ts stats) still in tree — fold in or revert. |
| ? | Cannon (alpha T2) | DEFERRED | Requires projectile primitive (architectural sub-batch first). 8th alpha unit. |
| ? | Beta geneline kickoff | DEFERRED | Triggers `units/<geneline>/` subfolder restructure. |

### Active item

**Batch 1 — Balance (matchup pairs).** Batch 0 shipped the passive handler registry (2026-05-30, `tsc` clean + 632 tests green), unblocking balance. Open: decide the fate of the uncommitted balance scratch in the working tree (centurion aura range 80→100; normal.ts Domeback/Skitterling/Longeye/Wardling/Bashguard stat tweaks) before the first matchup-pair batch — fold them into Batch 1 or revert to a clean baseline.

---

## 4. Methodology

### Playtest (balance batches)

- **Manual sandbox first.** User drives the sandbox (1.5× zoom, drag-scroll, 18-unit roster, geneline tabs), feeds observations to orchestrator. Orchestrator translates observations to tuning batches. Executor applies number changes.
- **Sim harness investment is deferred.** Reassess after Batch 2–3 — if manual loop becomes painful, build automated N-vs-N matchup harness. Until then, sandbox is sufficient.

### Batch shape (balance)

- **Matchup-pair batches.** Each batch tunes ONE matchup (both sides), per the combat rewrite "reconcile both or neither" rule. Pair-shaped diffs are reviewable; whole-tier sweeps would conflate which change caused which matchup shift.
- **Lever order:**
  1. **Primary:** cost, hp (lowest feel-impact, easiest to revert)
  2. **Secondary:** atkRate, range
  3. **Last resort:** spd (changes how a unit *feels* to play, not just how it stats)
  4. **Special case:** cap — touched only when capacity system lands. Forward-looking metadata; no runtime effect until capacity ships.

### Tier philosophy (per [TIER_CONTRACT.md](../reference/TIER_CONTRACT.md))

- **~9/10 higher-tier wins** is the baseline. Do NOT balance against it.
- **Within a tier:** roughly even. Soft counters welcome, hard counters not required.
- **Lower-tier upset paths** are PROTECTED design space (specialization, terrain, mutation stacks, clever play). Don't balance them away.

### Review cadence (orchestrator)

- Every batch review reads at least 2–3 critical files (load-bearing 20%).
- "Approved based on report" vs "approved based on code review" — vocabulary discipline.
- Every review ends with a copy-pasteable executor handoff section wrapped in `========== COPY TO EXECUTOR — START/END ==========` markers.

---

## 5. Cross-references

- **Combat primitives in use:** `AbilityDef`, `EffectDef`, `ModifierDef`, pipeline phases (queueAbility, applyDeathTriggerPhase, applyAoeRiderPhase, etc.) — see [MECHANICS_ROADMAP.md](MECHANICS_ROADMAP.md) for combat closure status.
- **Passives refactor target:** `PassiveDef` discriminated union — see Batch 0 decision in [UNIT_LIFECYCLE_DECISIONS.md](UNIT_LIFECYCLE_DECISIONS.md).
- **Sandbox harness:** [SANDBOX_OVERHAUL_DESIGN.md](../archive/SANDBOX_OVERHAUL_DESIGN.md) (closed) — describes the playtest tool used by every balance batch.
- **Tier contract:** [TIER_CONTRACT.md](../reference/TIER_CONTRACT.md) — authoring discipline for new units.
