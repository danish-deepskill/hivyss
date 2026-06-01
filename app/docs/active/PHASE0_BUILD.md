# Phase 0 Build — Make α's Fight Fun

> **Status:** 2026-05-31. The **build half** of MVP Phase 0. **Goal: prove the #1 risk — is α's combat fun.**
>
> **Read first:** `GENELINE_ALPHA.md` (α design), `MECHANICS_INVENTORY.md` (locked mechanic frame), `MVP_REQUIREMENTS.md` (scope/budget).
>
> **Roles:** fresh build sessions implement one step at a time; orchestrator reviews at each 🎮 gate. Stats are placeholders until the gate playtests tune them.

---

## The principle
Build incrementally with **playtest gates** so "is it fun" is de-risked *cheaply and early* — the big, risky build (pheromones, Step 4) only happens *after* the cheap signals (Playtests A & B) confirm the direction. Any gate can kill or redirect the plan while it's still cheap.

## Build sequence

| # | Build | Unblocks / tests | Size |
|---|---|---|---|
| **1** | **α's 7 units** — UnitDef + procedural draw (use the `getStrike` Grunt template) + register, with *basic* attacks (reuse existing AbilityDefs) | α units fighting in the sandbox | M |
| **2** | **Feel layer** — per-unit strike-anim tuning + fitted sound + hit-juice (particles/feedback) | a *juicy* α fight | S–M |
| 🎮 | **Playtest A** | *"Is a juicy α melee fight already fun?"* (cheap genre-baseline) | — |
| **3** | **Pack Cohesion** — new `'cohesion'` `PassiveDef` kind + handler in `PASSIVE_HANDLERS` (scales a modifier by nearby α-ally count) | α's identity (massed = stronger); **validates the registry** | S–M |
| 🎮 | **Playtest B** | *"Does the cohesion hook deepen it?"* | — |
| **4a** | **Pheromone command** — Rally/Charge/Retreat zones, **direct sandbox placement**, behavioral unit response (rally=mass/hold, charge=advance, retreat=fall-back) | the **agency layer** (tight-vs-spread) — makes cohesion playable | **L** |
| **4b** | **Worker** (gather economy + as the pheromone-zone source) — *deferred within Step 4* | the delivery mechanism | M |
| **5** | **Elite signature + Goliath** — player-triggered ability system + Stampede (cohesion-scaled burst) | the skill-timing moment | M |
| 🎮 | **Playtest C — THE GATE** | **"Is α's full fight FUN?"** ← #1-risk gate. Tune stats / cohesion curve / pheromone feel until *yes*. | — |

**Post-gate (not Phase 0):** add the 2nd lane → β/γ/4th genelines → gene acquisition.

## Order logic
- Get α **fighting fast** (1) → **feel good cheaply** (2) → first fun-signal before any big build.
- **Cohesion** (3) is α's identity *and* the registry's proof — small, high-value.
- **The L-sized pheromone build (4) comes only after Playtests A & B** say the direction is fun. Don't pour the big effort in on faith.
- **Step 5** completes the loop; **Playtest C is the gate** that decides Phase 0 is done.

---

## Step 1 — α units (current task)

Author α Primal's 7-unit roster (`GENELINE_ALPHA.md` §3) as data + draws, get them spawnable and fighting in the sandbox with **placeholder basic attacks**. The special mechanics (cohesion, knockback, momentum, Stampede) are **later steps** — Step 1 just puts the bodies on the field.

**Structure note:** the existing `units/alpha.ts` roster (Grunt/Centurion/Legionnaire/…) is the *military* set → it becomes **δ**, out of MVP scope. Don't delete it; it doesn't collide (new α-Primal unit keys are different). Author α-Primal as new units. If a `units/<geneline>/` restructure feels needed, **stop and report** — don't do it mid-Step-1.

========== COPY TO EXECUTOR — START ==========

**Task: Build α Primal's roster (Phase 0, Step 1) — data + draws only, basic attacks.**

Read `app/docs/active/GENELINE_ALPHA.md` (the design) and `app/src/units/CLAUDE.md` (file structure + draw conventions) first.

Author these **7 new units** (UnitDef + draw function + register in `registry.ts`):

| key | name | tier | role | basic attack (placeholder) |
|---|---|---|---|---|
| `chitling` | Chitling | T0 | cheap melee fodder | reuse a basic melee ability (e.g. `jaw_strike`) |
| `goreling` | Goreling | T1 | fast melee charger | basic melee |
| `hornshell` | Hornshell | T1 | frontline tank | basic melee |
| `maulhorn` | Maulhorn | T2 | heavy (knockback comes later) | basic melee for now |
| `carapex` | Carapex | T3 | cohesion amplifier (hook later) | basic melee |
| `goretusk` | Goretusk | T3 | momentum (hook later) | basic melee |
| `goliath` | Goliath | T4 | Elite (signature comes later) | basic melee |

Requirements:
- **UnitDefs:** caste `soldier` (the Alpha = `elite`), geneline `alpha`, route `land`, melee. **Placeholder stats** per TIER_CONTRACT cost bands (T0 cheap/fragile → T4 expensive/strong) — these get tuned at the playtest gates, so rough-but-reasonable is fine. Damage lean: blunt/sharp.
- **Draws:** procedural, distinct insectoid silhouettes. **Author to `app/docs/reference/DRAW_STYLE.md`** — first add the `shadedBlob` helper to `units/renderUtils.ts`, then build every body segment through it (fake top-left light, not flat ellipses), hit the per-tier §5 visual budget, give eyes a glint + each unit a signature feature. **Use the `getStrike` attack seam** — copy the strike pattern from `app/src/draws/alpha/grunt.ts`. The art bar is the DRAW_STYLE checklist, not "stacked ellipses."
- **Register** all 7 so they're spawnable in the sandbox.
- **Do NOT** build cohesion / knockback / momentum / Stampede yet — basic attacks only. Those are Steps 3–5.
- **Gate:** `tsc --noEmit` clean + the 7 units spawn and fight in the sandbox.

**Stop-and-report if:** the units/ folder needs restructuring, or any unit's basic combat needs a primitive that doesn't exist.

========== COPY TO EXECUTOR — END ==========
