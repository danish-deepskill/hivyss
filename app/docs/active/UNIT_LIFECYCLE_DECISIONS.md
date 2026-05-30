# Unit Lifecycle — Locked Decisions

> **Purpose:** Dated log of decisions made during the Unit Lifecycle program. Once locked, a decision is not re-derived — it's referenced. If a decision needs to change, add a new dated entry that supersedes the old one (don't edit history).
>
> **Pairs with:** [UNIT_LIFECYCLE_ROADMAP.md](UNIT_LIFECYCLE_ROADMAP.md) (live status) and [TIER_CONTRACT.md](../reference/TIER_CONTRACT.md) (authoring contract).

---

## 2026-04-20 — Program shape

**Decision:** Balance-first, then addition. Two motions, sequenced.

**Reasoning:**
- Balance calibrates DPS/nectar, TTK, and HP/cost ratios via real playtest. Those ratios become design targets for new units instead of guesses.
- Pure-data balance batches are lower-risk orchestration practice — review cadence calibrates before architectural batches land.
- Cannon (first scheduled addition) needs a projectile primitive that doesn't exist; doing it first means shipping a primitive validated by exactly one consumer. That's how primitives rot.

---

## 2026-04-20 — Batch 0: Passives union refactor

**Decision:** Refactor `selfModifier` + `auraModifier` + `passiveHeal` into a single `passives?: PassiveDef[]` field on UnitDef, where `PassiveDef` is a discriminated union by `kind`. Land BEFORE any balance or addition work.

**Reasoning:**
- Three flat behavior-passive fields on UnitDef is the same shape failure mode that AbilityDef already avoided via discriminated union. The pattern is proven.
- Adding more passive shapes (reflect, lifesteal, shield pulse, thorn, regen, etc.) without the refactor would compound technical debt linearly with roster size.
- Blast radius is small: 5 source files (`types.ts`, `entities/Unit.ts`, `systems/CombatSystem.ts`, `units/alpha.ts`, `units/normal.ts`) and 4 unit data sites. Half-day executor batch.
- Doing it now (18 units) is cheaper than later (30+, 100+ units). Cost scales with units touched.
- The "wait for the 4th passive shape" delay heuristic was wrong — three shapes is already enough to validate the union pattern (minimum sample size for discriminator-based polymorphism).

**Final shape (illustrative — executor matches existing config types):**

```ts
// UnitDef
passives?: PassiveDef[];
resistance?: Partial<Record<DamageType, ResistanceTier>>;  // unchanged
penetration?: Partial<Record<DamageType, number>>;         // unchanged

// New union — variant payloads reuse existing config types
type PassiveDef =
  | { kind: 'self_modifier'; ...SelfModifierConfig }
  | { kind: 'aura_modifier'; ...AuraModifierConfig }
  | { kind: 'heal_cast';     ...PassiveHealConfig };
```

---

## 2026-04-20 — Resistance / penetration scope fence (sub-decision under Batch 0)

**Decision:** `resistance` and `penetration` STAY as their own UnitDef fields. They are NOT folded into `PassiveDef`.

**Reasoning:**
- They are damage-pipeline metadata indexed by damage type (`Partial<Record<DamageType, …>>`), not runtime behavior subscribers. They are read in the damage resolve path, not by the passive tick loop.
- Folding them into `PassiveDef[]` would force either (a) one entry per damage type — bloated — or (b) a single `kind: 'resistance_map'` entry that's just the current field renamed — buying nothing.
- The union is strictly for **behavior subscribers** — things read by the passive tick loop (heal cast, aura application, self-modifier toggle). New behaviors land here additively (reflect, lifesteal, shield pulse, etc.).

---

## 2026-04-20 — Matchup philosophy

**Decision:** Tier contract drives matchup balance.
- ~9/10 higher-tier wins. Do NOT balance against this.
- Within a tier: roughly even. Soft counters welcome; hard counters not required.
- Lower-tier upset paths are PROTECTED design space (specialization, terrain, clever play, mutation stacks).

**Reasoning:** Locked in [TIER_CONTRACT.md](../reference/TIER_CONTRACT.md) (2026-04-19). Carrying the rule forward into the balance program rather than re-deriving it.

---

## 2026-04-20 — Balance levers

**Decision:** All seven stat levers are in scope (hp, atk, atkRate, spd, range, cost, cap). Tuning order:

1. **Primary:** cost, hp (lowest feel-impact, easiest to reverse)
2. **Secondary:** atkRate, range
3. **Last resort:** spd (changes a unit's *feel*, not just its numbers)
4. **Special case:** cap — touched only as forward-looking metadata; no runtime effect until capacity system ships (separate program)

**Reasoning:** No artificial restriction — match the tool to the actual problem. The ordering reflects revertibility: primary levers are easier to undo if a tune is wrong.

---

## 2026-04-20 — Playtest methodology

**Decision:** Manual sandbox playtest. User drives, orchestrator translates observations into batches, executor applies. Defer sim harness investment until Batch 2–3.

**Reasoning:** Sandbox harness is shipped, proven, and matches run framing (1.5× zoom, 18-unit roster, geneline tabs). Sim harness is an unbuilt tool — investing in it before knowing if manual playtest is sufficient is premature. Reassess after 2–3 batches based on real friction.

---

## 2026-04-20 — Batch shape (balance)

**Decision:** Matchup-pair batches. Each balance batch tunes ONE matchup (both sides), per the combat rewrite **"reconcile both or neither"** rule (refined 2026-04-13).

**Reasoning:** Pair-shaped diffs are reviewable. Whole-tier sweeps would conflate which change caused which matchup shift. Per the parity-reconciliation refinement: when fields interact to produce observables, they must be tuned together. Matchup pairs are the natural unit.

---

## 2026-04-20 — Cannon (scheduled addition, parked)

**Decision (partial):** Cannon will be the **8th alpha unit, tier 2 (Megavyss)**.

**Open questions (resolved later, informed by balance playtest):**
- Arc time (controls dodge window vs. cluster damage)
- AOE radius at landing (single-picker vs. crowd-clear)
- Dodge model — landing-point vs. target-tracking (orchestrator lean: landing-point, matches "catapult" framing)
- Mid-air collision with air-lane units (orchestrator lean: no, simpler)
- Ground-shadow telegraph design
- Projectile primitive shape

**Architectural prerequisite:** Projectile primitive does not exist. Cannon batch will require a sub-batch architectural batch FIRST to add the projectile system, then a data batch for the cannon itself.

**Status:** DEFERRED until balance pass produces tuning intuition.

---

## 2026-05-30 — Batch 0 A/B resolution: Option B (flatten at init)

**Decision:** The `PassiveDef` discriminated union lives on `UnitDef` (authoring shape) **only**. `Unit.init()` unpacks `def.passives` by `kind` into the existing flat runtime fields (`selfModifier`, `auraModifier`, `passiveHeal`). `IUnit` **keeps** the three flat fields. `CombatSystem.updatePassives()` is **NOT** modified.

**Supersedes:** the illustrative "Final shape" in the 2026-04-20 Batch 0 entry, which leaned toward the union reaching the runtime tick loop. Code verification flipped it.

**Reasoning (grounded in `CombatSystem.ts:838-965`):**
- `updatePassives` is **not** a generic per-unit passives tick. It is three structurally different passes: self-mod over `alive`; aura over `units` (dead included, for the byte-parity dead-owner cleanup latch `_auraCleanedUp`); passive-heal over `alive` with a `healTimer` accumulator. There is no generic array to iterate.
- Each future passive kind (reflect, lifesteal, thorn, shield_pulse, regen) needs its own bespoke branch over its own list **regardless of A or B**. The union saves zero runtime branches; it saves authoring fields on `UnitDef`.
- The debt the original decision targets ("more passive shapes compound flat fields") lives **entirely on the authoring surface**. B removes it: `UnitDef` gets one `passives?: PassiveDef[]`.
- The aura dead-cleanup logic is byte-parity-locked from the closed combat rewrite (634 tests). B never touches `updatePassives`, so the parity baseline is untouched. A would require restructuring it — higher risk, no benefit.

**Bound:** B stores one flat runtime field per kind → **≤1 passive of each kind per unit**. All 4 current data sites are single-passive, so it holds. If a future unit needs e.g. two auras, promote that one runtime field to an array then (localized change). Not a reason to take A now.

**Shape (executor matches exact config interfaces in `types.ts`):**
```ts
export type PassiveDef =
  | ({ kind: 'self_modifier' } & SelfModifierConfig)
  | ({ kind: 'aura_modifier' } & AuraModifierConfig)
  | ({ kind: 'heal_cast' }     & PassiveHealConfig);
```

---

## 2026-05-30 — Batch 0 BUILT as a passive handler registry (supersedes Option B above)

**Decision:** After reviewing the active-ability engine and the `ABILITY_TEST_CASES.md` complexity surface, escalated Batch 0 from Option B (flatten-at-init) to the **A-family handler registry** — the more extensible shape, since the roster ahead is aura/passive-heavy and the registry is the debt-free target. **Built and shipped this session.**

**Supersedes:** the "Option B (flatten at init)" entry directly above. Authoring shape (`UnitDef.passives: PassiveDef[]`) is identical to B; the difference is the runtime carries the array and a `kind → handler` registry dispatches it, instead of flattening to flat fields.

**Why the escalation:** the 20 ABILITY_TEST_CASES probe the **already-built** active engine (pipeline/effects/WorldEntity), not passives — so they don't force a passive rebuild, but they confirmed the right model is the **execution-model split**: per-frame tick → registry; event-driven (reflect/thorns/lifesteal) → pipeline phases; terrain → WorldEntity; T6+ → bespoke. The registry is the debt-free target for the tick band, and going to it now (vs B-then-registry) avoids a second runtime refactor.

**What landed:**
- `PassiveDef` union + `PassiveKind` on `types.ts`; `UnitDef.passives` and `IUnit.passives` replace the three flat fields.
- New `systems/PassiveHandlers.ts`: `PassiveHandler` interface (`sweep: 'alive' | 'all'`, `PassiveTickEnv`) + `PASSIVE_HANDLERS` registry with three handlers — verbatim ports of the former branches.
- `CombatSystem.updatePassives` reduced to a registry driver (sweep per handler, dispatch matching entries, `resolveFrame` once). Parity preserved: sweep order self→aura→heal, source-tag scheme, strict-`<` aura range, dead-cleanup latch, `healTimer` carry-over.
- 4 unit data sites migrated to `passives: [{ kind, ... }]`. `CombatSystem.test.ts` re-plumbed via a typed `findPassive` helper (behavioral assertions unchanged).
- **Gate: `tsc --noEmit` clean + 632/632 tests green.**

**Known single-instance bound:** modifier passives (self/aura) support multiple entries via distinct source tags, but timer/latch state (`healTimer`, `_auraCleanedUp`) is per-unit → one `heal_cast` and one dead-cleanup-bearing aura per unit. All current units are single-passive. Promote to per-entry state if a multi-same-kind unit is ever authored.

**Follow-ups (logged, not blocking):**
1. `CombatSystem.test.ts` still has local sim copies (`runSelfModifierDispatch` / `runAuraDispatch` / `runHealDispatch`) that now duplicate the real handlers (the old Phase-9 backlog item #9). Deletable in favor of importing `PASSIVE_HANDLERS`. Deferred to keep this batch's parity gate clean.
2. 2 centurion aura tests track the uncommitted `range 80→100` balance scratch — revert them if that balance change is reverted.
