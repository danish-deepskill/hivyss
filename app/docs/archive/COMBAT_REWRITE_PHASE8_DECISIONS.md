# Combat Rewrite — Phase 8 Architectural Sub-Decisions

**Status:** LOCKED 2026-04-14 (pre-kickoff design session, re-locked 2026-04-14 after Max-budget review pass)
**Applies to:** Phase 8 unit migration tier 3 (Bashguard, Ravager, Legionnaire, Wardling, Centurion, Bombardier, Stormfly + Mendwing + Longeye)
**Supersedes:** Phase 8 handoff inputs F1–F14 from the Phase 7b closure entry in [MECHANICS_ROADMAP.md](../active/MECHANICS_ROADMAP.md). F3–F13 are resolved here. F14 is an audit log, not a decision.
**Read first:** [COMBAT_REWRITE_DECISIONS.md](COMBAT_REWRITE_DECISIONS.md) (6 structural decisions), [COMBAT_REWRITE_PLAN.md](COMBAT_REWRITE_PLAN.md) Phase 8 section (deliverables + exit criteria), [COMBAT_REFERENCE.md](../reference/COMBAT_REFERENCE.md) (legacy baseline).

## Re-lock history (2026-04-14)

First pass locked F3–F14. Max-budget review pass caught:
1. **F11 double-knockback parity violation** — re-locked as Option 1 (defer knockback Effect to Phase 10) with a placeholder EffectDef to avoid `lookupEffect` throw.
2. **F5 under-specified integration points** — Wardling / Centurion / Ravager cross-cutting reads and Bombardier selector-in-subscriber were buried as stop-and-report triggers. Re-locked as explicit orchestrator decisions.
3. **F5 Bombardier double-fire race** — added `u._deathTriggerFired` scratch-field guard per refined scope discipline. Recorded as Finding 12 (2026-04-14) for tech debt.
4. **New architectural decision — selector-in-subscriber** — allowed for multi-target triggered events (onDeath, future aoeRider). Named explicitly as a Phase 8 architectural addition.
5. **New pre-migration audit rule — hook-keyed vs dmgType-keyed coexistence check** — any effect-based migration must verify `_legacyApplyPhase` doesn't run a duplicate mechanism for the migrated attacker.

F3, F4, F6, F10, F12, F13, F14 locks unchanged from first pass. CC1 (Ravager code-vs-prompt mismatch) resolved: code is canonical (step-function atkRate), my original F5 category 4 lock stands modulo the cross-cutting read naming below.

## How to use this doc

Each decision below has: **Context** (what the problem is + code citations), **Options** (what was considered), **Lock** (what Phase 8 implements), **Reasoning** (why), **Exit criteria** (what a migrated unit must prove), **Not-decided** (deferred to executor judgment with stop-and-report authority).

**Locked means locked.** The executor does not re-derive these. If a locked decision surfaces as wrong under implementation, executor stops and reports; orchestrator re-opens.

---

## F3 — Handler-precedence fork fix

### Context

The legacy attack cycle in [CombatSystem.ts:393-443](../src/systems/CombatSystem.ts#L393-L443) has a fork:

```
if (handler && handler.onAttack) {
  handler.onAttack(u, target, foes, dmg, ctx);      // line 398 — legacy path
} else {
  const canMigrate = !!u.defaultAbility && !(handler && handler.getAtk);
  if (canMigrate) { pipeline.queueAbility(...) }    // line 428 — migrated path
  else            { this.hitUnit(...) }             // line 440 — wrapper
}
```

**Problem:** `handler.onAttack` short-circuits `canMigrate` unconditionally. Any Phase 8 unit whose legacy combat has `onAttack` — **Longeye** ([normal.ts:419](../src/units/normal.ts#L419)), **Stormfly** ([normal.ts:455](../src/units/normal.ts#L455)) — cannot migrate via the `defaultAbility` mechanism as currently wired. Setting `defaultAbility: 'piercing_shot'` on Longeye is a silent no-op because `longeyeCombat.onAttack` fires first and never calls into the pipeline.

**Bombardier + Cinderfly are NOT blocked** by this fork — their legacy hooks are `onDeath` / `afterHit`, not `onAttack`. `afterHit` fires AFTER the canMigrate path at [CombatSystem.ts:450](../src/systems/CombatSystem.ts#L450), which is how Phase 7b Cinderfly migrated cleanly.

### Options considered

**A. Delete the `onAttack` fork entirely.** Migrated units use pipeline; non-migrated units use wrapper (via the existing `canMigrate` false branch). Legacy `handler.onAttack` is never called — Longeye and Stormfly MUST migrate in Phase 8 because they have no fallback path.

**B. Reverse the precedence.** `canMigrate` wins; `handler.onAttack` only runs for non-migrated units (`!u.defaultAbility`). Keeps Longeye / Stormfly legacy path alive as a "not migrated yet" fallback.

**C. Narrow per-unit flag.** Add a `forceLegacyAttack?: boolean` on UnitDef. Per-unit opt-out for edge cases. Over-engineering for a rewrite program whose goal is Phase 9 legacy removal.

### Lock: Option B — reverse the precedence

The fork becomes:

```
const canMigrate = !!u.defaultAbility && !(handler && handler.getAtk);
if (canMigrate) {
  // Migrated path — queueAbility + pipeline
} else if (handler && handler.onAttack) {
  handler.onAttack(u, target, foes, dmg, ctx);
} else {
  this.hitUnit(target, dmg, hitType, ctx);
}
```

### Reasoning

Option A is architecturally cleaner but forces Longeye + Stormfly to migrate in the same session they're decoupled from legacy — "must migrate to not break" creates time pressure that contradicts Phase 8's "migrate carefully, stop-and-report freely" posture. Option B preserves the legacy fallback throughout migration and deletes the `else if (handler.onAttack)` branch as part of Phase 9 cleanup (when no unit has `onAttack` anymore).

Option C violates the "one mechanism for migration state" principle — `defaultAbility` presence is already the canonical signal; adding a second flag invites drift.

**B unblocks Longeye + Stormfly migration without forcing them.** They can still migrate cleanly in Phase 8; if migration hits a snag, the legacy path is reachable via `defaultAbility = undefined`.

### Exit criteria

- [CombatSystem.ts:393-443](../src/systems/CombatSystem.ts#L393-L443) fork rewritten as specified.
- Regression: the 6 Phase 6 units + 2 Phase 7b units still route correctly after the fork change (Grunt / Mandible / Needler / Pricker / Hardshell / Domeback / Skitterling / Cinderfly all migrate via `canMigrate`, legacy `onAttack` units bounce to their hook).
- Added test: pre-existing legacy unit (Longeye, before migration) still routes through `longeyeCombat.onAttack` via the new `else if` branch.
- Added test: migrated Longeye (after Phase 8 migration) routes through pipeline and `longeyeCombat.onAttack` is never called.

### Not decided

- Phase 9 cleanup details (full deletion of `handler.onAttack` path) — deferred to Phase 9.

---

## F4 — Per-target damage falloff primitive

### Context

Longeye `piercing_shot` hits up to 2 targets: first at 100%, second at 50% ([normal.ts:434](../src/units/normal.ts#L434)). Stormfly `chain_lightning` hits up to 3 targets with falloff `[1.0, 0.7, 0.4]` ([normal.ts:476](../src/units/normal.ts#L476)) plus overcharge doubling on every 4th cast ([normal.ts:459](../src/units/normal.ts#L459)).

**The selector already returns multiple targets.** `piercing_shot.targetCount = 2`, `chain_lightning.targetCount = 3`. What's missing: the `calculate` / `modify` phase has no notion of "this is the Nth target in a multi-target hit; apply a per-index multiplier."

### Options considered

**A. Per-ability `targetFalloff: number[]` on AbilityDef.** `piercing_shot.targetFalloff = [1.0, 0.5]`. The calculate phase reads `event.targetIndex` + `ability.targetFalloff` and multiplies base damage accordingly.

**B. Per-ability falloff function.** `targetFalloff: (index, count) => multiplier`. Maximum flexibility. Data becomes code.

**C. Emit N separate events, modify phase subscriber adjusts based on a `_chainIndex` field.** Keeps the calculate phase pure; falloff is a modify-phase concern.

**D. Keep falloff in the onAttack hook, accept that Longeye + Stormfly aren't fully migrated.** Rejected — this is the whole point of F3.

### Lock: Option A — per-ability `targetFalloff: number[]`

AbilityDef gains:
```ts
/**
 * Per-target damage multiplier for multi-target abilities. Indexed by
 * selector output order (0 = primary, 1 = secondary, ...). Length
 * should match targetCount; missing entries default to 1.0. Absent
 * field means no falloff (all targets take full damage).
 */
targetFalloff?: number[];
```

Calculate phase reads `event._targetIndex` (new pipeline field set by `queueAbility` when the selector returns multiple targets) and multiplies the tier-based damage by `ability.targetFalloff?.[event._targetIndex] ?? 1.0`.

For `chain_lightning.overcharge` (every 4th cast doubles damage), use a Resource (Phase 5 primitive) on Stormfly: a `hitCount` resource that increments per cast; when it reaches 4, reset to 0 and apply a modifier. This is a Resource use case, not a new AbilityDef field. See the stop-and-report below if Resources turn out to be too heavy.

### Reasoning

Data-driven beats function-driven (Option B) because per-ability data is more readable, more AI-analyzable for Phase 10 balance, and composes with Phase 10's variance redesign (`variancePct` + `critChance`) without arithmetic coupling. Option C (separate events + modify subscriber) is elegant but requires plumbing `_chainIndex` through every event — more surface area than a direct `targetFalloff` lookup.

Overcharge via Resource (not a new falloff field) because overcharge is a temporal state (every Nth cast), not a spatial/targeting property. Resources are the right primitive for counting casts.

### Exit criteria

- Longeye migrated with `piercing_shot.targetFalloff = [1.0, 0.5]`, hitting 2 targets with the second at ceil(dmg × 0.5).
- Stormfly migrated with `chain_lightning.targetFalloff = [1.0, 0.7, 0.4]`, hitting 3 targets with documented parity.
- Stormfly overcharge: resource-based every-4th-cast doubling, verified with a 10-cast integration test (casts 4, 8 double; casts 1-3, 5-7, 9 normal).
- Stormfly stun: 25% chance per target, via `chain_lightning.appliesEffects = ['stun']` and the existing apply-effects subscriber. `tiers.*.effectChance = 0.25` (existing Phase 3 field, see [_tierTables.ts](../src/config/combat/abilities/_tierTables.ts) `linearDamageTiersWithEffect`).
- Regression: no Phase 6/7 unit's damage changes (all single-target, `targetFalloff` absent, no path change).

### Stop-and-report triggers

- If `event._targetIndex` plumbing requires touching every selector return in [Targeting.ts](../src/systems/Targeting.ts) — stop. Selector contract changes are architectural and need orchestrator sign-off.
- If the Resource primitive for overcharge is ambiguous (no clear "increment + reset" idiom in Phase 5's ResourceSystem) — stop. Don't invent.

---

## F5 — Passive-ability migration pattern

### Context

Five Phase 8 units have behaviors that run OUTSIDE the attack cycle:

| Unit | Legacy hook | Behavior |
|---|---|---|
| Mendwing | `onUpdate` ticks `healTimer` every 2s, heals nearest wounded ally | Periodic heal cast |
| Centurion | `onUpdate` applies +20% atk to up to 5 nearest allies, cleans up on exit/death via `_ralliedByUid` | Source-tracked aura |
| Wardling | `modifyAllyDamage` computes -20% for in-range allies on every damage event | Damage-time query |
| Bombardier | `onDeath` explodes, AOE damage + effects on up to 5 foes | Death trigger |
| Ravager | `onUpdate` mutates `u.atkRate` based on HP% | Self-stat modifier |

These are NOT all the same mechanism. They split into four categories:

1. **Periodic heal cast** (Mendwing) — a cast that runs on a cooldown, selects a target, heals. Effectively a `passive` ability that triggers `heal_pulse`.
2. **Source-tracked aura** (Centurion, Wardling) — ticks every frame, adds/removes modifiers on in-range allies by source.
3. **Death trigger** (Bombardier) — fires on unit death, queues an AOE ability.
4. **Self-modifier** (Ravager) — reads own HP, applies a modifier to self.

### Options considered

**A. One unified "passive tick loop"** subscribing to `CombatSystem.resolve()` that walks all units with `defaultAbility?.category === 'passive'` or special fields and dispatches per category. Single registration point, many branches.

**B. Separate subscribers per category:**
- `PassiveHealTicker` — walks units with `category: 'heal', trigger: 'passive'`, decrements cooldown, queueAbility on ready
- `AuraManager` — walks units with `category: 'passive', auraMods`, adds/removes source-tracked modifiers
- `DeathTriggerRouter` — hooks into unit death, queueAbility for `category: 'damage', trigger: 'onDeath'` abilities
- `SelfModifierTicker` — walks units with a Phase 8-new `selfModifier?: (u) => Modifier[]` field

**C. Each complex unit gets its own phase subscriber or onUpdate hook.** No reuse. Maximum freedom, maximum inconsistency.

**D. Hybrid — unified passive tick loop for categories 1+2+4, dedicated death trigger router for category 3.** Death is structurally different (fires once, not every frame) so it doesn't fit the "tick loop" model.

### Lock: Option D — hybrid

**Category 1 (Periodic heal cast) + Category 2 (Source-tracked aura) + Category 4 (Self-modifier) go through a unified passive tick loop** called from `CombatSystem.resolve()` once per frame, BEFORE the per-unit attack loop. The loop:

1. Walks `alive.filter(u => u.defaultAbility && (ability.trigger === 'passive' || ability.category === 'passive'))`.
2. For each, looks up the ability by name.
3. Dispatches based on `ability.category`:
   - `'heal'` with `trigger: 'passive'` → decrement a per-unit cooldown accumulator; when ≥ cooldown, reset and `pipeline.queueAbility(u, selector(u, ability), ability.name, { })`. The existing Phase 7a heal subscriber on pre_apply handles the rest.
   - `'passive'` with `auraMods` → run a source-tracked update: select in-range allies, add modifiers `{ source: 'aura:${u.id}:${stat}' }`, remove modifiers whose source matches but whose target is no longer in range.
   - `'passive'` with a NEW `selfModifier?: { stat, type, value, condition }` field → evaluate condition; if true, ensure modifier present with `source: 'self:${u.id}:${stat}'`; else remove.

**Category 3 (Death trigger) is handled separately.** `CombatSystem._legacyApplyPhase` already sets `target.dead = true` when HP ≤ 0. A new phase subscriber on `post_apply` (registered THIRD, after `_legacyPostApplyPhase` and `applyEffectsPhase`) checks `if (event.target.dead)` and — if the target has a `deathAbility` (new UnitDef field) or `ability.trigger === 'onDeath'` — queues the death ability via `queueAbility(dyingUnit, selector(u, deathAbility), deathAbility.name, {})`.

Registration order within post_apply becomes:
```
1. _legacyPostApplyPhase   (sets dead, cleans up attacker state)
2. applyEffectsPhase       (applies effects to non-dead targets)
3. applyDeathTriggerPhase  (fires death abilities — NEW in Phase 8)
```

Death triggers are queued, NOT resolved inline — they enter the pipeline as new events and get drained per-call alongside other events. The safety cap on `resolveFrame` (≤200 events/frame — verify against [CombatPipeline.ts](../src/systems/CombatPipeline.ts)) protects against infinite cascades (5 Bombardiers die simultaneously → 5 death_bombs queued → each kills 5 more → ... → cap engages, later events dropped with a warn).

### Reasoning

Option A is too fat (one function dispatching on category is harder to test than separate functions). Option C is the anti-pattern the rewrite is meant to replace. Option B is appealing but splitting the tick loop across four subscribers creates four walks of the unit list per frame — measurably worse than one walk with a dispatch, and the four subscribers would share 80% of their machinery (cooldown accumulators, source-tracked modifier add/remove, in-range selectors).

Option D packages the three tick-based categories into one loop and the fundamentally-different death trigger into its own phase subscriber. Two registration points instead of four; one walk per frame.

**Why death triggers are NOT a tick-loop category:** the tick loop fires every frame for every passive unit. Death triggers fire ONCE per death, driven by the damage pipeline's `target.dead = true` state change. Wrong cadence, wrong driver.

### Named integration points (locked, NOT stop-and-report)

Five integration points are load-bearing for F5 and were under-specified in the first lock. These are explicit orchestrator decisions — executor implements them as-specified and only stops-and-reports if the IMPLEMENTATION reveals a problem, not if the decision itself feels ambiguous.

#### IP-1: Wardling — new `applyAuraDamageModify` subscriber on modify phase

**Lock:** Register a new modify-phase subscriber in `CombatSystem` constructor AFTER [`applyVarianceModify` at CombatSystem.ts:223](../src/systems/CombatSystem.ts#L223). Name it `applyAuraDamageModify`. Body reads `applyModifiers(event.target, event.finalDamage, 'dmg_taken')` and writes the result back to `event.finalDamage`.

**Why AFTER variance:** legacy Wardling runs inside [`_legacyApplyPhase` at CombatSystem.ts:690-702](../src/systems/CombatSystem.ts#L690-L702), AFTER variance is baked into `event.finalDamage`. Byte-for-byte parity requires the new aura-read to apply to the post-variance value, not the pre-variance base. Registering AFTER `applyVarianceModify` in the modify phase preserves ordering.

**Parity check for the executor:** `round((base + variance) × 0.8)` = `round(base × 0.8 + variance × 0.8)` — these are NOT the same integer in all cases. Legacy computes the first form. New path must compute the first form. That means `applyAuraDamageModify` reads `event.finalDamage` AFTER variance has written to it, NOT `event.baseDamage`. Implementation: `const modified = applyModifiers(event.target, event.finalDamage, 'dmg_taken'); event.finalDamage = Math.round(modified);`

**Wardling migration:** `guardian_ward` passive tick uses the IP-5 walked-list aura approach with `mySourceTag = 'aura:${u.id}:dmg_taken'`. Walk 1 adds `{ stat: 'dmg_taken', type: 'percent', value: -20, source: mySourceTag, duration: undefined }` to any in-range ally not already carrying the modifier. Walk 2 removes the modifier from allies no longer in range. Death cleanup via the `_auraCleanedUp` latch pattern.

**Deletion:** `wardlingCombat.modifyAllyDamage` hook at [normal.ts:441-453](../src/units/normal.ts#L441-L453) is DELETED. The legacy aura loop at [CombatSystem.ts:693-702](../src/systems/CombatSystem.ts#L693-L702) iterates `allyHandler.modifyAllyDamage`; after deletion, the hook is absent, the loop is a no-op for Wardling. CC3 audit rule says this is the clean case — the legacy mechanism is hook-keyed, not dmgType-keyed.

**Intentional divergence — `Math.round` vs legacy `Math.ceil` (surfaced at Item 12 checkpoint 2026-04-15):** Legacy `wardlingCombat.modifyAllyDamage` used `Math.ceil(dmg * 0.8)` — pro-attacker 1-unit bias on non-integer results. Migrated `applyAuraDamageModify` uses `Math.round(modified)` per the universal IP-1 subscriber body. Drift observed on `dmg ∈ {23, 24}`: migrated path produces 1 point lower (23→18 vs legacy 23→19; 24→19 vs legacy 24→20). All other integer inputs in the normal production range produce identical results. Accepted as intentional — changing IP-1 to `ceil` would lock the entire modify subscriber to Wardling's specific legacy math and constrain future consumers (Stage 4+ auras, Phase 10 balance primitives). Phase 10 balance lever: if Wardling feels too weak at drift damage during playtest, bump `auraModifier.value` from `-20` to `-25` to compensate. Alternative: add per-aura `roundingMode` field (not locked, overkill for one consumer).

#### IP-2: Centurion — `applyModifiers` read in calculate phase for `atk`

**Lock:** The calculate phase of the pipeline — wherever `event.baseDamage = caster.atk × tierMult` or equivalent happens — reads through `applyModifiers(caster, caster.atk, 'atk')` instead of raw `caster.atk`. **Cross-cutting change.** Affects every migrated unit (Phase 6/7/8), not just Centurion.

**Why cross-cutting is safe (per user call):** `applyModifiers` with no active modifiers on the `atk` stat returns `baseValue` unchanged per [ModifierSystem.ts:161-179](../src/systems/ModifierSystem.ts#L161-L179). Phase 6/7 migrated units have no `atk`-stat modifiers in their normal runtime, so their calculate output is unchanged byte-for-byte. **Phase 6/7 parity tests will catch any regression the moment the touch lands.** If tests still pass after the calculate-phase edit and before Centurion migration, the gate is transparent.

**Pre-lock verification checkpoint (mandatory):** The executor lands the calculate-phase change as an isolated working-tree edit BEFORE touching Centurion's unit file. Runs `npm test` and verifies 457+ tests still pass byte-for-byte. Only then proceeds to Centurion migration. If Phase 6/7 tests fail, **stop and report** — the Phase 5 `applyModifiers` implementation has a regression and that's a bigger problem than Phase 8. (See the "Pre-lock verification checkpoint" section below for the full sequence. **Note: "isolated" means isolated in the working tree; no git commits are implied. The user manages git, the orchestrator does not direct commits.**)

**Centurion migration:** `rally_aura` passive tick uses the IP-5 walked-list aura approach with `mySourceTag = 'aura:${u.id}:atk'`. Walk 1 adds `{ stat: 'atk', type: 'percent', value: 20, source: mySourceTag, duration: undefined }` to any in-range ally not already carrying the modifier. Walk 2 removes the modifier from allies no longer in range. On Centurion death, the `_auraCleanedUp` latch pattern runs one final Walk 2 with `inRange = ∅` to clean up surviving allies — same *behavior* as legacy `_ralliedByUid` cleanup at [alpha.ts:310-325](../src/units/alpha.ts#L310-L325), but now the bookkeeping lives entirely in `ally.modifiers[].source` instead of the ad-hoc `_ralliedByUid` field. Delete `_ralliedByUid`, `_baseAtk`, `_rallied` scratch fields from Unit (or at minimum from Centurion's usage — grep for residuals).

**Deletion:** `centurionCombat` at [alpha.ts:262-326](../src/units/alpha.ts#L262-L326) is DELETED in its entirety. Both the `onUpdate` aura loop and the `onDeath` cleanup become redundant (aura loop is replaced by passive tick subscriber; `onDeath` cleanup happens in a new `onDeath`-category handler the passive tick loop watches for, OR we accept that ModifierSystem's source-based cleanup can be driven from a unified death subscriber — see IP-4 below).

#### IP-3: Ravager — `applyModifiers` read in attack-cycle timing for `atkRate`

**Lock:** `u.atkRate` read at [CombatSystem.ts:447](../src/systems/CombatSystem.ts#L447) (`u.atkCd = (1 / u.atkRate) - u.foreswing`) becomes `const effectiveAtkRate = applyModifiers(u, u.atkRate, 'atkRate'); u.atkCd = (1 / effectiveAtkRate) - u.foreswing;`. Also at the equivalent base-attack paths where `u.atkRate` is read for cycle timing ([CombatSystem.ts:~447 and ~480 for base-strike](../src/systems/CombatSystem.ts) — grep and touch all sites).

**Cross-cutting change.** Same "transparent when no modifiers active" property as IP-2 — identical pre-lock verification checkpoint applies. Run Phase 6/7 tests after landing the `atkRate` read change, before migrating Ravager.

**Ravager migration:** A new per-frame self-modifier check runs in the unified passive tick loop for units with `selfModifier?: { stat, type, value, condition: (u) => boolean }` on the UnitDef. Ravager's entry: `{ stat: 'atkRate', type: 'percent', value: 50, condition: (u) => u.hp / u.maxHp <= 0.5 }`. Tick loop: if condition true and modifier not present (via `removeModifiersBySource('ravager:${u.id}:rage')`-style gate) → `addModifier`; if condition false and modifier present → `removeModifiersBySource`.

**Step function preserved:** legacy [alpha.ts:251-260](../src/units/alpha.ts#L251-L260) is a step function at 50% HP, NOT a continuous formula. The `condition` predicate preserves the step. CC1 resolved: code is canonical.

**Deletion:** `ravagerCombat` at [alpha.ts:251-260](../src/units/alpha.ts#L251-L260) is DELETED. The `onUpdate` mutation of `u.atkRate` is replaced by the passive tick loop adding/removing the modifier.

#### IP-4: Bombardier — `applyDeathTriggerPhase` subscriber with re-entry guard

**Lock:** New `post_apply` subscriber `applyDeathTriggerPhase`, registered THIRD (after `_legacyPostApplyPhase` at [CombatSystem.ts:244](../src/systems/CombatSystem.ts#L244) and `applyEffectsPhase` at [CombatSystem.ts:245](../src/systems/CombatSystem.ts#L245)). Subscriber body:

```ts
function applyDeathTriggerPhase(event: DamageEvent): void {
  if (event.cancelled) return;
  const target = event.target as IUnit;
  if (!target.dead) return;
  if (target._deathTriggerFired) return;          // Re-entry guard
  target._deathTriggerFired = true;                // Latch
  const deathAbilityName = target.deathAbility;    // New UnitDef field
  if (!deathAbilityName) return;
  const ability = lookupAbility(deathAbilityName);
  const targets = runSelector(ability.targeting, target, ability);
  for (const t of targets) {
    this.pipeline.queueAbility(target, t, deathAbilityName, {});
  }
}
```

**Re-entry guard via `u._deathTriggerFired` scratch field (Finding 12).** Follows the `u._spawned` pattern at [CombatSystem.ts:301-304](../src/systems/CombatSystem.ts#L301-L304). Boolean flag on Unit, set once on first death-trigger fire, prevents double-firing in the theoretical race where two damage events land on an already-dead target in the same drain cycle.

**Latch-ordering rule (re-locked 2026-04-14 after executor Stage 1 kickoff stop-and-report):** `applyDeathTriggerPhase` OWNS the latch set (above, at line `target._deathTriggerFired = true;` before the `!deathAbilityName` early-return). `_legacyPostApplyPhase` is CHECK-ONLY — it does NOT set the latch. This asymmetric ownership is load-bearing because the post_apply registration order runs `_legacyPostApplyPhase` FIRST and `applyDeathTriggerPhase` THIRD; if both set the latch, `_legacyPostApplyPhase` would set it during event 1 and `applyDeathTriggerPhase` would bail on its own check during the same event, leaving `death_bomb` unqueued. See the Finding 12 section below for the full case trace and the literal `_legacyPostApplyPhase` backport (check-only variant).

**Setting the latch BEFORE the `!deathAbilityName` early-return is itself load-bearing.** Non-Bombardier units hit that early-return path; if the set happened AFTER the check, those units would never set the latch, and Finding 12 protection would break for every Phase 6/7/8 unit that isn't Bombardier. The current ordering (check latch → set latch → check deathAbility → queue) preserves Finding 12 protection for ALL unit types, migrated or not, deathAbility or not. Do not reorder.

**UnitDef gets a new optional field:** `deathAbility?: string`. Bombardier: `deathAbility: 'death_bomb'`. Other Phase 8 units do NOT set it. Backward-compatible.

**Selector invocation in phase subscriber** is a NEW architectural pattern — see the "Selector invocation from phase subscribers" architectural decision below.

**Deletion:** `bombardierCombat` at [alpha.ts:206-249](../src/units/alpha.ts#L206-L249) is DELETED. The new subscriber + `death_bomb` ability via queueAbility handles the AOE. Particles are replayed by the `death_bomb` ability's own hit-FX (through the pipeline's `post_apply`), or — if legacy explosion visuals need preservation — the subscriber can call `ctx.particles.burst(...)` inline before `queueAbility`. **Visual parity is a smoke-test check**, not a lock.

#### IP-5: Unified passive tick loop + walked-list aura application

**Lock:** Add a new function `updatePassives(alive: IUnit[], dt: number)` called from `CombatSystem.resolve()` BEFORE the per-unit attack loop (approximately [CombatSystem.ts:295](../src/systems/CombatSystem.ts#L295), before `alive.forEach(u => { ... })`). The function:

1. Iterates units with `u.defaultAbility` where `lookupAbility(u.defaultAbility)` returns `category === 'heal'` AND `trigger === 'passive'` (Mendwing), `category === 'passive'` with `auraMods` (Centurion, Wardling), or UnitDef has `selfModifier?` (Ravager).
2. Dispatches based on category:
   - **Heal (Mendwing):** decrement `u.healTimer` accumulator; when ≤ 0, reset to `ability.cooldown ?? 2`, run selector, queueAbility `heal_pulse` → event flows through pipeline → `applyHealPhase` (Phase 7a pre_apply subscriber) heals target.
   - **Aura (Centurion, Wardling) — WALKED-LIST approach (re-locked 2026-04-14 after executor Q4):** no owner-side scratch set. Each frame, run the selector to compute `inRange` (set of allies the aura currently applies to), then do two walks driven by the ALLY's modifier list as the source of truth:
     - **Walk 1 — enter detection.** For each ally in `inRange`: if `!ally.modifiers?.some(m => m.source === mySourceTag)`, `addModifier(ally, {..., source: mySourceTag})`. Where `mySourceTag = 'aura:${auraOwnerUnit.id}:${stat}'`.
     - **Walk 2 — exit detection.** For each alive ally in `ctx.allAlive` where `ally.side === auraOwnerUnit.side` AND `ally.modifiers?.some(m => m.source === mySourceTag)`: if the ally is NOT in `inRange`, `removeModifiersBySource(ally, mySourceTag)`.
   - **Self-modifier (Ravager):** evaluate `condition(u)`; if true and `u._selfModifierActive` is false, `addModifier` + set scratch bool; if false and scratch bool is true, `removeModifiersBySource` + clear scratch bool.

**Cooldown storage (Mendwing):** REUSE the existing `u.healTimer` field. The Phase 7b fix at [Unit.ts:372-385](../src/entities/Unit.ts#L372-L385) flipped it to use the `accumulator` field (immune to Unit.update's tick loop decrement). That fix is the reference implementation — migrated Mendwing keeps `healTimer`, just invoked from the passive tick loop instead of the legacy `mendwingCombat.onUpdate`. Tick direction: legacy incremented (`healTimer += dt` until ≥ 2); new passive loop can decrement for cleaner "time-until-next-cast" semantics. Choose decrement to match the heal `cooldown` field naming. **Delete the legacy accumulation pattern, keep the accumulator storage.**

**Aura diff scratch state (re-locked 2026-04-14):** NONE. No `_auraSourceTargets` scratch field. The ally's own `modifiers` list IS the source of truth for which auras currently apply to it. This is pool-recycle-safe by construction: a recycled ally has an empty (or reset) modifier list, so Walk 1 adds the modifier fresh on the next frame; Walk 2 finds no stale entry to remove because the recycled ally carries no modifiers from the old occupant. **Mirrors the legacy `_rallied` flag pattern** at [alpha.ts:281-288](../src/units/alpha.ts#L281-L288) which stores state on the ally (pool-recycle-resettable) instead of on the aura owner (not pool-recycle-aware).

**Why not `u._auraSourceTargets: Set<IUnit>` (first-pass lock, REJECTED):** the executor caught it during Phase 8 kickoff orientation Q4 (2026-04-14). If Centurion's Set held a reference to grubA, and grubA died and was pool-recycled into grubZ (a new unit reusing the same JS object and the same `Set` membership via reference identity), the next aura diff would see grubZ as "still in set, still in range" (if grubZ happened to spawn in range), SKIP the addModifier call, and leave grubZ unbuffed. Silent failure mode. The walked-list approach makes this impossible because the ally's modifier list is the ground truth — no owner-side state can get out of sync.

**Death-driven aura cleanup (re-locked 2026-04-14 for walked-list):** when a Centurion or Wardling dies, its aura modifiers on any ally that previously-received them must be cleaned up. The walked-list approach gives us this for free via the same Walk 2 pattern, but we need to run Walk 2 ONE more time at the frame of the aura owner's death, with an empty `inRange` set:

- **Lock:** `updatePassives` iterates ALL units (including dead ones whose aura cleanup hasn't happened yet). For aura-category units that died this frame but haven't had their cleanup pass yet, run Walk 2 with `inRange = ∅`. Every ally carrying `aura:${deadOwner.id}:${stat}` as a modifier source gets the modifier removed. The "hasn't happened yet" gate uses a new single-bit latch — `u._auraCleanedUp?: boolean`, set `true` after cleanup runs, reset on spawn/recycle.
- **Alternative considered:** put cleanup in `applyDeathTriggerPhase`. Rejected because aura owners may not have a `deathAbility` (Centurion and Wardling don't); that subscriber is scoped to death triggers, not aura cleanup. Keep the cleanup inside `updatePassives` where the aura logic already lives.

**This is the ONLY scratch field on aura owners — `_auraCleanedUp: boolean`.** One bit. Pool recycle resets it. If the aura owner is alive, the bit is false and Walk 2 runs normally. If the aura owner is dead and the bit is false, Walk 2 runs with empty `inRange` (cleanup pass), then the bit is set. If the aura owner is dead and the bit is true, the unit is skipped entirely.

**Centurion multi-source edge case:** if two Centurions rally the same ally, ally has TWO modifiers with different sources (`aura:${c1.id}:atk` and `aura:${c2.id}:atk`). When `c1` dies, `removeModifiersBySource(ally, 'aura:${c1.id}:atk')` removes only `c1`'s modifier; `c2`'s modifier stays. Ally's effective atk still has +20% from `c2`. ModifierSystem's percent-stacking semantics at [ModifierSystem.ts:114-150](../src/systems/ModifierSystem.ts#L114-L150) handles the multi-source case correctly (percent stacking is additive). Legacy `_ralliedByUid` only allowed one source per ally (later writer wins); Phase 8 allows multiple sources stacking. **Minor behavior improvement**, not a parity break — the legacy path was a bug-hiding limitation.

**Live smoke scenarios added to `phase8Scenarios.ts`:**
- `rally_multi_centurion`: 2 centurions + 5 allies with overlap; verify allies in both ranges have +40% (additive stack), allies in one range have +20%, one centurion dies, allies in dead-centurion-only range drop to baseline, allies still in the surviving centurion's range stay at +20%.

### Overall Exit criteria (unchanged from first pass, re-anchored to IPs)

- Mendwing migrated: `heal_pulse` runs every 2s via IP-5 passive tick (heal category). Heals 20 HP on nearest wounded ally via Phase 7a `applyHealPhase` subscriber. Legacy `mendwingCombat` deleted. F13 range lock (90px) applies.
- Centurion migrated: IP-2 calculate-phase read + IP-5 aura diffing. Multi-centurion scenario verified.
- Wardling migrated: IP-1 modify-phase subscriber + IP-5 aura diffing. Deletion of `wardlingCombat.modifyAllyDamage` clean per CC3.
- Ravager migrated: IP-3 atkRate read + IP-5 self-modifier path. Step function preserved.
- Bombardier migrated: IP-4 death trigger subscriber + `deathAbility: 'death_bomb'` + re-entry guard. Finding 12 backport to `_legacyPostApplyPhase` ships in same commit.
- Registration order pin: `phase8.test.ts` adds a test pinning post_apply handler order `[_legacyPostApplyPhase, applyEffectsPhase, applyDeathTriggerPhase]`. Second pin for modify phase order `[applyVarianceModify, applyAuraDamageModify]`.
- **Pre-lock verification checkpoints for IP-2 and IP-3:** apply calculate-phase `atk` read as an isolated working-tree change, run tests, proceed. Apply atkRate read sites as an isolated working-tree change, run tests, proceed. Only after both pass do Centurion + Ravager migrations commence. See "Pre-lock verification checkpoint (mandatory)" section below for the precise sequence. **No git commits implied at any step.**
- **Live smoke test per unit** per the refined audit methodology (see memory): Mendwing heals in play, Centurion rally visible (draw hook reads modifier stack), 2-Centurion multi-source cleanup, Wardling aura reduces observed damage, Ravager speedup visible at exactly 50% HP crossing, Bombardier explosion matches legacy feel, Stormfly chain visuals match, Longeye pierce through 2 targets.

### Stop-and-report triggers (narrowed after re-lock)

The integration points above are LOCKED, not stop-and-report. The remaining genuine stop-and-report cases:

- **Pre-lock verification FAILS** for IP-2 (calculate phase `atk` read) or IP-3 (atkRate reads): Phase 6/7 tests regress after the cross-cutting touch lands. This means `applyModifiers` is NOT transparent with no active modifiers, which contradicts the ModifierSystem contract. That's a Phase 5 bug, not a Phase 8 design problem. **Stop immediately**, do NOT try to patch around it in Phase 8.
- **Ravager's modifier doesn't apply to the cycle timer** after the IP-3 touch lands and tests pass: means the `atkRate` read path isn't actually reaching `applyModifiers` from every site. Grep for all `u.atkRate` reads in CombatSystem.ts and unit code; if a site was missed, add the read. If the naive grep reveals the atkRate field is read from Unit.update or elsewhere outside CombatSystem, stop and report — scope is wider than IP-3 assumed.
- **Aura performance at scale.** Every frame, each aura unit runs a selector + diff. 200 units × 3 auras × ~50-unit selector = ~30k operations/frame. Probably fine on Phaser, flag if observable perf drop in smoke.
- **Source-tracked modifier churn from stable aura sets.** With the walked-list approach, stable in-range allies trigger Walk 1's `some(m => m.source === mySourceTag)` check returning TRUE, so `addModifier` does NOT fire on steady state. Verify in the integration test: Centurion rallies an ally for 60 frames; the ally's modifier list should have exactly one `aura:${cent.id}:atk` entry at the end, not 60.
- **Multi-source aura death ordering.** Covered by IP-5 Option A lock, but if live smoke shows unexpected aura-cleanup behavior when Centurions die in a specific order, stop and investigate.
- **Visual regression** on Bombardier explosion, Centurion rally chevrons, or Wardling aura particles that isn't cosmetic-only. Cosmetic = "looks slightly different." Regression = "player can no longer see X information that was visible before." Cosmetic is OK, regression is stop-and-report.

---

## F6 — `getAtk` override integration

### Context

Ravager's legacy rage is `ravagerCombat.onUpdate` mutating `u.atkRate` based on HP. **Ravager does NOT have `getAtk`.** The `canMigrate` guard at [CombatSystem.ts:418](../src/systems/CombatSystem.ts#L418) is `!!u.defaultAbility && !(handler && handler.getAtk)` — protects against units whose ATK is computed rather than stored.

The Combat Reference audit lists `getAtk` as a hook, but **no current Phase 8 unit actually uses `getAtk`.** All of Bashguard / Ravager / Legionnaire / Wardling / Centurion / Bombardier / Stormfly / Mendwing / Longeye read `u.atk` directly. Searching the normal.ts + alpha.ts units for `getAtk` returns zero hits.

So F6 is **not blocking any Phase 8 unit.** The handoff input F6 framed it as "Ravager's berserk scaling," but Ravager's berserk scaling is atkRate-based (F5 category 4 — self modifier), not atk-based. F6 is a ghost blocker from the handoff.

### Options considered

**A. Lock the guard as-is. Leave `getAtk` unresolved for Phase 8. Ravager migrates via F5 self-modifier path.**

**B. Remove the `getAtk` guard and add a calculate-phase subscriber that calls `handler.getAtk(u)` when present.** Pre-emptive fix for a future unit.

**C. Delete `getAtk` as a combat hook entirely.** No current unit uses it. Legacy cleanup.

### Lock: Option A — leave the guard in place, no Phase 8 action on `getAtk`

### Reasoning

No Phase 8 unit uses `getAtk`. Touching CombatSystem's calculate phase to pre-emptively support it is scope creep. The guard protects future unit definitions from silent wrongness; keep it.

Option C is tempting but cleanup belongs in Phase 9, not mid-migration. Option B adds a subscriber for zero real callers.

**Ravager's rage migrates as F5 IP-3 atkRate self-modifier** — see F5 IP-3 for the full lock (cross-cutting `applyModifiers(u, u.atkRate, 'atkRate')` read at [CombatSystem.ts:447](../src/systems/CombatSystem.ts#L447) and equivalent sites, passive tick loop adds/removes the modifier based on HP step function threshold, pre-lock verification checkpoint mandatory). CC1 resolved 2026-04-14: code at [alpha.ts:251-260](../src/units/alpha.ts#L251-L260) is canonical — step function on atkRate with 1.5× multiplier below 50% HP, NOT the continuous atk formula the user's Max-budget review prompt described. Phase 8 preserves the step function exactly.

### Exit criteria

- `getAtk` guard at [CombatSystem.ts:418](../src/systems/CombatSystem.ts#L418) unchanged.
- Handoff input F6 closed as "not a Phase 8 blocker — Ravager migrates via F5 self-modifier."
- **Validated:** grep `handler\.getAtk|combat\.getAtk|getAtk:` across `src/units/` returns zero hits in Phase 8 unit defs. If Phase 8 adds any new Phase 8 unit with `getAtk`, stop and report.

### Not decided

- Future `getAtk` support (Phase 9 / 10 / future geneline) — deferred.

---

## F10 — Damage-type default effects lookup table

### Context

Previous orchestrator's starting point: `DEFAULT_EFFECTS: Record<DamageType, string | null>` lookup populating `event.effects` at `queueAbility` time when the ability is silent on `appliesEffects`. Per-ability override via explicit `appliesEffects: []` opt-out. User was receptive.

The conversation surfaced these pairings:
- blunt → knockback
- heat → burn
- cold → slow
- electric → stun
- sharp → bleed
- toxic → poison
- psychic → confuse
- void → ? (undecided)
- holy → ? (undecided)

Current ability data:
- `fire_bite` explicitly sets `appliesEffects: ['burn']` ([heat.ts:20](../src/config/combat/abilities/heat.ts#L20))
- `bash_strike` explicitly sets `appliesEffects: ['knockback']` ([blunt.ts:20](../src/config/combat/abilities/blunt.ts#L20))
- `chain_lightning` explicitly sets `appliesEffects: ['stun']` ([electric.ts:21](../src/config/combat/abilities/electric.ts#L21))
- `piercing_shot`, `jaw_strike`, `needle_shot`, `pricker_jab` have NO `appliesEffects` — they're silent
- `death_bomb` has NO `appliesEffects` — heat but no burn

The decision: **should silent abilities get the default effect applied automatically, or does silence mean "no effect"?**

### Options considered

**A. Silent = default effect (previous orchestrator's lean).** Lookup table drives; abilities explicitly opt out with `appliesEffects: []`.

**B. Silent = no effect. Abilities must explicitly name every effect they apply.** No lookup table. Keeps data explicit; more boilerplate.

**C. Hybrid: lookup table drives BUT only for abilities with an `inheritsDefaultEffects?: true` flag.** Opt-in to the default, not opt-out. Lookup table still defines the canonical pairing; abilities choose whether to inherit.

### Lock: Option B — silent means no effect, NO lookup table in Phase 8

**Defer the lookup table to Phase 10 balance work.** The Phase 8 scope is unit migration, not default-effects policy.

### Reasoning

The previous orchestrator's lookup table idea is sound, but landing it in Phase 8 couples unit migration to a policy question that should be validated by playing the game. The lookup table's pairings — especially sharp → bleed, psychic → confuse, void → ?, holy → ? — are speculative. Bleed isn't a shipped effect. Confuse isn't a shipped effect. Void and holy have no pairing at all.

Locking a lookup table in Phase 8 means:
1. Phase 8 ships bleed + confuse (or punts them to speculation).
2. Every current ability must either opt-in or have its current behavior verified against the new default.
3. `jaw_strike` on Grunt / Mandible / Skitterling silently gains bleed — this is a behavior change to ALREADY-MIGRATED units, breaking the "Phase 8 doesn't touch Phase 6-7 migrated units" invariant.

**Phase 10 is the right home.** Phase 10 is Balance v1; the damage-type default effects table is a balance decision disguised as a data structure. Phase 8 migrates current behavior byte-for-byte (explicit `appliesEffects`); Phase 10 introduces the lookup and retunes ability data to match.

### Exit criteria

- Phase 8 adds NO `DEFAULT_EFFECTS` lookup.
- Phase 8 units keep their current `appliesEffects` fields: `bash_strike` = knockback, `chain_lightning` = stun, `death_bomb` = (none, to preserve parity with legacy "explode, no secondary effect"), `piercing_shot` = (none).
- **Forward reference:** Phase 10 deliverable list adds "design + implement the damage-type default effects lookup table, migrate all abilities to opt-in or explicit-effect model." Update COMBAT_REWRITE_PLAN.md Phase 10 section at Phase 8 landing.

### Not decided

- Whether Phase 10's lookup is opt-in (Option C) or opt-out (Option A). Decided at Phase 10 kickoff with playtest data in hand.
- Bleed + confuse effects — not shipped, not scoped for Phase 8. Deferred to Phase 10 or later.
- Void + holy pairings — same.

---

## F11 — Knockback layered model

### Context

Previous orchestrator's starting point: three axes — baseline poise (existing legacy mechanic) + damage-type default effect (blunt → knockback) + per-unit `knockForce` (existing). User was receptive.

Current state:
- `UnitDef.knockForce?: number` exists ([types.ts:100](types.ts#L100)) and drives legacy stagger via poise accumulation
- `UnitDef.knockResist?: number` exists ([types.ts:101](types.ts#L101)) — subtracted from incoming knockForce
- Bashguard has `knockForce: 100` (instant stagger vs 0 resist)
- `bash_strike.appliesEffects = ['knockback']` is already declared but the knockback EFFECT has no implementation in Phase 5's effect registry

### Options considered

**A. Knockback as a shipped effect in Phase 8.** `knockback` becomes an `EffectDef` with `onApply` that mutates `target.knockback` velocity. Unit-level `knockForce` becomes the effect's magnitude data. Layered model: poise + effect + knockForce = combine.

**B. Knockback stays legacy-wired.** `bash_strike.appliesEffects = ['knockback']` is a no-op until Phase 10; Bashguard's stagger runs via the existing `u.knockback` velocity field. Legacy parity only.

**C. Knockback becomes a pipeline modify-phase subscriber.** Reads `event.effects` for 'knockback', applies velocity mutation directly, no EffectDef.

### Lock (re-locked 2026-04-14): Option 1 — defer knockback onApply to Phase 10, ship a placeholder EffectDef in Phase 8

**Why re-locked:** the first pass locked Option A (ship the `knockback` Effect with a working `onApply` body). Max-budget review caught a double-knockback parity violation: legacy poise accumulation in [`_legacyApplyPhase` at CombatSystem.ts:723-742](../src/systems/CombatSystem.ts#L723-L742) runs unconditionally for every melee/ranged/aoe event, including events from migrated attackers. Bashguard migrating to `defaultAbility: 'bash_strike'` would fire poise (legacy) AND the new knockback Effect (via `applyEffectsPhase`) on the same hit — double knockback.

Three re-lock options considered (defer Effect / no-op Effect body / strip legacy poise). **Option 1 (defer to Phase 10)** is the cleanest: matches the Cinderfly half-migration precedent, avoids touching `_legacyApplyPhase`, keeps Phase 6/7 regression surface at zero, and aligns Phase 10's knockback Effect ship with Phase 10's F10 DEFAULT_EFFECTS table work (natural grouping — the table points at effect definitions, shipping one without the other creates dangling references).

### What Phase 8 ships for knockback

**Layer 1 — Poise accumulation (legacy, UNCHANGED).** `_legacyApplyPhase` continues to accumulate poise from `event.attacker.knockForce - event.target.knockResist` for all melee/ranged/aoe events, including migrated Bashguard events. Stagger still fires from poise threshold crossing. Zero change to [CombatSystem.ts:723-742](../src/systems/CombatSystem.ts#L723-L742). This is Phase 8's knockback mechanism — Phase 6/7 migrated units continue to work through it too.

**Layer 2 — Per-unit `knockForce` on UnitDef, UNCHANGED.** Bashguard keeps `knockForce: 100`. Every attacker's knockForce continues to drive poise accumulation through `event.attacker.knockForce` in `_legacyApplyPhase`.

**Layer 3 — Per-ability `appliesEffects: ['knockback']`, DATA UNCHANGED.** [blunt.ts:20](../src/config/combat/abilities/blunt.ts#L20) keeps `appliesEffects: ['knockback']` on `bash_strike`. The data declaration is forward-looking; Phase 10 builds the effect body that matches.

### The placeholder EffectDef — load-bearing technical lock

**The problem:** `lookupEffect(name)` at [effects/index.ts:31-35](../src/config/combat/effects/index.ts#L31-L35) THROWS on unknown names. `applyEffectsPhase` at [CombatSystem.ts:144-152](../src/systems/CombatSystem.ts#L144-L152) iterates `event.effects` and calls `applyEffect(target, name)` which calls `lookupEffect(name)`. If Bashguard migrates with `defaultAbility: 'bash_strike'` and `['knockback']` stays in data but no `knockback` EffectDef is registered, **the first Bashguard hit throws `Error: Unknown effect: knockback`** and crashes the combat tick.

Verified: `cc.ts` (effects file) currently registers `stun` and `slow` but NOT `knockback`.

**Phase 8 ships a placeholder `knockback` EffectDef in [config/combat/effects/cc.ts](../src/config/combat/effects/cc.ts)** with:
- `name: 'knockback'`
- `stackable: false`
- `duration: 0` (instantaneous)
- **NO `onApply` body.** No `onTick`, no `onExpire`.
- A load-bearing comment explaining the coexistence:

```ts
// Phase 8 placeholder — ships unwired so lookupEffect('knockback')
// resolves without throwing when Bashguard's bash_strike event flows
// through applyEffectsPhase. The actual knockback behavior LIVES IN
// LEGACY POISE at _legacyApplyPhase's accumulation loop
// (CombatSystem.ts:723-742) for the duration of Phase 8. Phase 10
// replaces this definition with a real onApply body once the
// DEFAULT_EFFECTS lookup (F10) lands and the effect dispatcher
// pattern (mirroring Phase 7a's makeDotDispatcher) is wired.
//
// Coexistence rule: Phase 8 NEVER touches _legacyApplyPhase's poise
// path. That path owns knockback for every migrated and unmigrated
// unit. This placeholder exists ONLY to prevent lookupEffect throw
// for migrated units whose ability data declares
// appliesEffects: ['knockback'].
```

**This placeholder is a Phase 9/10 cleanup target.** Phase 10 replaces it with a real `onApply` body alongside the F10 DEFAULT_EFFECTS table ship AND the Phase 9 legacy poise removal (since removing `_legacyApplyPhase`'s poise accumulation is part of Phase 9's legacy combat removal). Phase 10 is the earliest point where the three coordinated changes can land together without creating parity gaps mid-migration.

### Why this shape matches the precedent

**Cinderfly** (Phase 7b): migrated via `defaultAbility: 'fire_bite'`. `fire_bite.appliesEffects: ['burn']` lands the burn on the primary target via the new path. Legacy `cinderflyCombat.afterHit` spread stays running for the 3-adjacent-enemies spread (legacy mechanism, deferred to Phase 9 cleanup). **Half-migration: primary goes new, spread stays legacy.**

**Bashguard** (Phase 8): migrates via `defaultAbility: 'bash_strike'`. `bash_strike.appliesEffects: ['knockback']` lands a no-op placeholder via the new path. Legacy poise accumulation in `_legacyApplyPhase` stays running for actual stagger behavior (legacy mechanism, deferred to Phase 10 cleanup). **Half-migration: damage goes new, knockback stays legacy.**

Same shape. The difference: Cinderfly's legacy mechanism is hook-keyed (`cinderflyCombat.afterHit`), so it's scoped to Cinderfly; Bashguard's legacy mechanism is dmgType-keyed (runs on every melee/ranged/aoe), so it's global. This is the CC3 audit rule in action — see the "Hook-keyed vs dmgType-keyed coexistence audit rule" section below.

### Exit criteria

- Placeholder `knockback` EffectDef shipped in [config/combat/effects/cc.ts](../src/config/combat/effects/cc.ts) with the load-bearing comment above. No `onApply` body.
- `bash_strike.appliesEffects: ['knockback']` data at [blunt.ts:20](../src/config/combat/abilities/blunt.ts#L20) UNCHANGED.
- Bashguard migrated with `defaultAbility: 'bash_strike'`. First migrated hit does NOT throw — `lookupEffect` resolves, `applyEffect` runs, the absent `onApply` is a no-op, legacy poise fires stagger.
- Parity test `phase8.test.ts`: Bashguard vs Hardshell, measure knock distance over N hits, assert matches legacy within parity tolerance. If parity holds, legacy poise path is still driving knockback correctly for the migrated attacker.
- Regression: Phase 6/7 migrated units still stagger via poise (their knockForce values drive `_legacyApplyPhase` accumulation unchanged). No Phase 6/7 parity tests regress.
- **No change to [CombatSystem.ts:723-742](../src/systems/CombatSystem.ts#L723-L742) (poise accumulation) or [CombatSystem.ts:306-314](../src/systems/CombatSystem.ts#L306-L314) (knockback velocity decay) in Phase 8.** If either file range is touched by Phase 8 work, stop and report — it's outside lock scope.

### Forward reference (Phase 10)

When Phase 10 ships the F10 DEFAULT_EFFECTS lookup table, it ALSO:
1. Replaces the placeholder `knockback` EffectDef with a real `onApply` body using the dispatcher pattern.
2. Deletes the poise accumulation in `_legacyApplyPhase` (Phase 9 or 10 — whenever legacy removal lands).
3. Tunes the effect vs. the legacy poise equivalent via smoke tests.
4. Ships all three in one coordinated commit to avoid parity gaps.

Recorded as a Phase 10 deliverable in the "Not in Phase 8 scope" section of this doc AND should be added to [COMBAT_REWRITE_PLAN.md](COMBAT_REWRITE_PLAN.md) Phase 10 section when Phase 8 lands.

### Not decided

- Whether the real `knockback` Effect dispatches via a closure (like `makeDotDispatcher`) or via a different mechanism. Phase 10 decides.
- Whether poise accumulation moves out of `_legacyApplyPhase` into a dedicated modify or apply subscriber in Phase 9 vs. stays until Phase 10. Phase 9 kickoff decides.

---

## F12 — AOE-effect-rider primitive

### Context

Previous orchestrator's starting point: `aoeRider?: { radius, targetCount, effect, excludePrimary?, selector? }` on AbilityDef, with a new `applyAoeRiderPhase` subscriber on post_apply registered AFTER `applyEffectsPhase`. Consumers:
1. **Bombardier** `death_bomb` (Phase 8) — currently legacy `onDeath` + `ctx.hitUnit` on up to 5 nearby foes
2. **Cinderfly** `fire_bite` spread (Phase 9 cleanup) — currently legacy `afterHit` + `burnTimer` on up to 3 adjacent enemies, excluding primary

### Options considered

**A. New `aoeRider` field on AbilityDef + new `applyAoeRiderPhase` subscriber** on post_apply (previous orchestrator's lean).

**B. Bombardier's death_bomb IS an AOE ability natively (`targetCount: 5`, `targeting: 'all_enemies_in_range'`) and doesn't need a rider.** The AOE rider pattern is for a SECONDARY AOE — e.g., "primary target takes damage + nearby targets take a separate effect." Bombardier's death_bomb fires ONCE on death, targeting multiple foes equally — that's multi-target, not a rider.

**C. Cinderfly's spread is a true rider case** — primary takes the hit, nearby targets take burn only (in legacy they take both hit and burn). That's the rider pattern.

**D. Defer both to Phase 9.** Bombardier uses death trigger (F5 category 3) + multi-target natively. Cinderfly keeps its legacy `afterHit` spread until Phase 9 cleanup.

### Lock: Option B + D — Bombardier uses multi-target natively, Cinderfly stays legacy until Phase 9

**Bombardier death_bomb migration path:**
- `deathAbility: 'death_bomb'` on UnitDef (new field)
- `death_bomb` already has `targeting: 'all_enemies_in_range'`, `targetCount: 5`, `range: 50` — no change needed
- The `applyDeathTriggerPhase` subscriber (F5 category 3) queues `death_bomb` on unit death; the existing queueAbility path handles multi-target via the selector
- **No `aoeRider` field is added in Phase 8**

**Cinderfly stays half-migrated as of Phase 7b.** The legacy `cinderflyCombat.afterHit` spread continues to run. Phase 9 cleanup replaces the spread with an `aoeRider` primitive if and only if a second use case justifies the field; otherwise Phase 9 deletes the spread entirely and accepts "Cinderfly's AOE is the primary target's burn effect, not a spread."

### Reasoning

The previous orchestrator's `aoeRider` primitive is a sound design but has exactly one Phase 8 consumer (Cinderfly, legacy-path), and that consumer can ship in Phase 9 instead. Adding a new AbilityDef field + a new phase subscriber for one Phase 9 consumer violates the "primitives emerge from two or more real use cases" rule.

**Bombardier is not an aoeRider case.** death_bomb is a natively multi-target ability — `death_bomb.targetCount = 5, targeting = 'all_enemies_in_range'`. The existing pipeline machinery handles that when queueAbility is called from the death trigger subscriber. No new primitive.

**If Phase 9 surfaces a second rider use case** (e.g., a future Alpha unit with "primary takes damage, nearby allies get buffed" mechanics), then `aoeRider` is the right primitive and Phase 9 lands it. Until then, don't build for one consumer.

### Exit criteria

- Bombardier migrated via F5 category 3 (death trigger subscriber + `deathAbility: 'death_bomb'`). NO `aoeRider` field.
- Parity test: Bombardier death vs 5-grub cluster, all 5 take 65 damage (matching legacy), explosion FX matches.
- Cinderfly's `cinderflyCombat.afterHit` spread path unchanged from Phase 7b. Continues to run on legacy side.
- Phase 9 deliverables list gains a new item: "Evaluate whether `aoeRider` primitive is needed; if ≥2 consumers, implement; else delete Cinderfly afterHit spread." Update COMBAT_REWRITE_PLAN.md Phase 9 section at Phase 8 landing.

### Not decided

- `aoeRider` primitive — deferred to Phase 9 evaluation.
- Whether Cinderfly's spread is preserved as a gameplay feature at all — Phase 9 / 10 decision.

---

## F13 — Mendwing heal range decision

### Context

Legacy `mendwingCombat.onUpdate` at [normal.ts:357-383](../src/units/normal.ts#L357-L383) filters wounded allies with:
```ts
ctx.allAlive.filter(a => a.side === u.side && a !== u && a.hp < a.maxHp)
```
**No distance check.** Mendwing heals the nearest wounded ally **anywhere on the field.** Effective range = infinity.

`heal_pulse` at [utility.ts:11-19](../src/config/combat/abilities/utility.ts#L11-L19) declares:
```ts
heal_pulse: {
  targeting: 'lowest_hp_ally_in_range',
  range: 90,
  targetCount: 1,
}
```
**Declared range: 90 px.** Matches `mendwingDef.range = 90`.

Migrated Mendwing would cap heal range at 90 px — a behavior change from legacy infinite range.

Combat Audit Finding 11 (added 2026-04-13 during Phase 7b smoke) flagged this as a decision point. **Phase 7b also fixed the pre-existing Mendwing healTimer bug** — the bug meant Mendwing never actually healed anyone in production, so no player has ever observed the legacy infinite range in real gameplay. The "legacy behavior" is technically broken; nobody knows what it feels like.

### Options considered

**A. Preserve legacy infinite range.** New selector `lowest_hp_ally_anywhere` (no range filter). `heal_pulse.range` field ignored or removed.

**B. Lock 90px.** Use existing `lowest_hp_ally_in_range` selector. Mendwing must stay near wounded allies to heal them. Tactical positioning becomes relevant.

**C. Lock a different number** (e.g., 200px — "long but not infinite"). Arbitrary.

**D. Make it per-ability, user-tunable.** Leave heal_pulse.range = 90 but add a comment explaining it can be tuned in Phase 10 balance.

### Lock: Option B — 90px, `lowest_hp_ally_in_range`

**Orchestrator lean. User has final say at Phase 8 kickoff — if user prefers A or C, overrule.**

### Reasoning

1. **Legacy infinite range was never observed in real gameplay** (healTimer bug, Phase 1 through Phase 7b). The "legacy behavior" is a ghost — there's no user muscle memory to preserve.
2. **Tactical positioning is a Hivyss design value.** Units at range X have deterministic behavior within X. Infinite-range heal is a weird escape hatch for one support unit.
3. **The declared range field already says 90.** The migration is aligning behavior with declared data — which is the whole point of data-driven design.
4. **90px is Mendwing's own attackRange.** Mendwing is a ranged support; heal range matching attack range is a natural symmetry.
5. **Reversible in Phase 10.** If 90px feels too tight in balance testing, Phase 10 can bump to 120 / 180 / etc. OR add a new `lowest_hp_ally_anywhere` selector if true infinite range is desirable. Locking 90px doesn't foreclose those options.

**Risk:** 90px might be too short for Mendwing to effectively heal front-line allies while staying alive. If smoke-testing Mendwing reveals it can't reach anyone who needs healing (Mendwing sits at the back, wounded units are up front, 90px is too short to bridge) — stop-and-report, orchestrator re-opens F13 with live data.

### Exit criteria

- Mendwing migrated with `defaultAbility: 'heal_pulse'` + F5 category 1 passive heal loop.
- `heal_pulse.range = 90` unchanged. `targeting: 'lowest_hp_ally_in_range'` unchanged.
- Live smoke: Mendwing + 2 wounded allies within 90px of Mendwing → nearest wounded is healed every 2s.
- Live smoke: Mendwing + 1 wounded ally at 120px (outside range) → no heal fires, healTimer keeps counting (no cast).
- Live smoke: Mendwing + 2 wounded allies, one at 50px and one at 150px → 50px ally healed.
- **Stop-and-report if Mendwing can't heal anyone in a normal battle composition.** Orchestrator may re-open F13 in favor of A (infinite range) or C (180px).

### Not decided

- Phase 10 tuning of the 90px number.
- Whether `lowest_hp_ally_anywhere` selector should be added at all.

### USER DECISION REQUESTED AT KICKOFF

At Phase 8 kickoff, ask the user: "F13 is locked at 90px heal range per orchestrator lean. Overrule?" Options:
- **A** — legacy infinite range (ship `lowest_hp_ally_anywhere` selector)
- **B** — locked 90px (ship as-locked)
- **C** — other range (specify)

Default is B. If user says "do what you think is right," go with B and note the decision in the Phase 8 kickoff report.

### F13 LOCKED 2026-04-15 — Option B (90px)

User answered "of course B" at Stage 4 Task 2 close relay. Final lock:
- `heal_pulse.targeting: 'lowest_hp_ally_in_range'` at [utility.ts:14](../src/config/combat/abilities/utility.ts#L14) — UNCHANGED.
- `heal_pulse.range: 90` at [utility.ts:15](../src/config/combat/abilities/utility.ts#L15) — UNCHANGED.
- No new selector shipped. `lowest_hp_ally_anywhere` does NOT land in Phase 8.
- Stage 4 item 14 Mendwing migration consumes the existing selector directly.
- Stage 4 close scenario `stage4AllPassives` is laid out for this constraint (Mendwing at x=170, Ravager at x=100, distance 70 < 90).

**Production-pinned 2026-04-15 at Stage 4 item 14 checkpoint.** Mendwing migration shipped with `heal_pulse.range = 90` enforced via the new `runSelectorInRange` helper in [Targeting.ts](../src/systems/Targeting.ts) (strict `<` range check, matches the Wardling/Centurion aura dispatch `>=` out-of-range semantics). `phase8.test.ts` Stage 4 item 14 "F13=B range enforcement" describe block carries 4 boundary tests pinning the 89px IN / 90px OUT behavior. F13 is now a production-validated lock, not a pending user decision.

**Reversibility:** Phase 10 balance pass can overrule the 90px lock with a 1-line edit to `heal_pulse.targeting` (swap the selector name) or `heal_pulse.range` (bump the number). The constraint is pure data, no code changes needed downstream.

---

## F14 — Phase 5 amendment audit log

### Context

F14 is NOT a design decision — it's a verification task. Phase 7a authorized TWO Phase 5 amendments:
1. `ActiveEffect.accumulator?: number` added to [systems/EffectSystem.ts](../src/systems/EffectSystem.ts) (or effect types)
2. `EffectContext.instance: ActiveEffect` added to the same

No other Phase 5 amendments have been authorized. Phase 8 kickoff should verify this and catch any silent drift.

### Audit task (first Phase 8 task)

Executor, as task #1 of the Phase 8 session, BEFORE any migration work:

1. `grep -rn 'ActiveEffect\|EffectContext\|EffectDef' app/src/systems/EffectSystem.ts app/src/config/combat/effects/types.ts`
2. Compare the current shape of `ActiveEffect`, `EffectContext`, `EffectDef`, `EffectBearer`, and the EffectSystem public API against what Phase 5 shipped (see [MECHANICS_ROADMAP.md decision log entry for Phase 5, 2026-04-13](../active/MECHANICS_ROADMAP.md)).
3. The only authorized additions post-Phase 5 are:
   - `ActiveEffect.accumulator?: number` (Phase 7a)
   - `EffectContext.instance: ActiveEffect` (Phase 7a)
4. **If anything else has drifted** — new fields, removed fields, renamed fields, changed signatures — stop and report to orchestrator BEFORE starting Phase 8 unit migration work.
5. **Report shape:** "F14 audit — N Phase 5 types checked, 2 authorized amendments verified, [0 drifts found | drifts: ...]."

### Expected outcome

Clean audit: "0 drifts." The Phase 7b executor was disciplined about not silently amending Phase 5, and phase reviews have been code-grounded. This audit is cheap insurance — budget ~5 minutes of executor time.

### What to do if drift is found

STOP Phase 8. The drift is either:
1. **Valid** — another authorized amendment lost from memory → document, add to this file, continue.
2. **Invalid** — silent drift by an executor or code change → revert or regularize before migration work starts.

Orchestrator decides which after reviewing the drift report.

---

---

## Architectural decision — Selector invocation from phase subscribers (NEW, Phase 8)

**Locked 2026-04-14 as a consequence of F5 IP-4 (Bombardier death trigger).**

### Context

Before Phase 8, Phase 3's targeting selectors ([Targeting.ts](../src/systems/Targeting.ts)) were only run from one site: `CombatSystem._findTarget` inside the per-unit attack loop at approximately [CombatSystem.ts:335](../src/systems/CombatSystem.ts#L335). That call picks a single primary target from the attacker's forward arc, and the result is passed directly to `queueAbility` as the sole target.

Phase 8's Bombardier migration needs a DIFFERENT pattern: when a unit dies, a `post_apply` phase subscriber must generate MULTIPLE events (one per selected target for the AOE). The subscriber needs to run a selector from inside the pipeline drain, not from the attack loop.

### Lock

**Phase 8 allows phase subscribers to invoke Phase 3 selectors when they need to generate multi-target events from a trigger.** Current Phase 8 consumers:

1. **`applyDeathTriggerPhase`** (F5 IP-4, Bombardier `death_bomb` trigger) — runs `runSelector(ability.targeting, dyingUnit, ability)` and loops `queueAbility(dyingUnit, target, 'death_bomb', {})` per returned target.

Future Phase 9/10 consumers that this pattern unblocks:
2. **`applyAoeRiderPhase`** (F12 deferred to Phase 9) — similar shape for Cinderfly spread replacement.
3. **Periodic AOE abilities** (future Phase 10+ content) — e.g., a pulse tower that fires a selector + queueAbility from a passive-tick subscriber.
4. **Aura-based triggered damage** — a future unit whose aura tick triggers a damage event on in-range foes.

### Safety conditions

The decision is SAFE because [Targeting.ts](../src/systems/Targeting.ts) is a pure module with zero dependencies on `CombatSystem`, `CombatPipeline`, or `Unit` class internals. It reads structural properties from its inputs and returns a plain array. No circular dependency risk.

Required discipline:

- **Selector results must not be cached across drain cycles.** The unit set mutates during drain (deaths, spawns). Each subscriber call re-runs the selector.
- **Subscribers must NOT call `pipeline.resolveFrame()` internally.** They call `queueAbility` to ENQUEUE events, which the outer drain loop picks up via FIFO iteration. Calling `resolveFrame` from inside a subscriber would re-enter the drain — the pipeline's `_draining` reentrancy guard catches this, but it's fragile. Pattern: ENQUEUE ONLY from subscribers.
- **Subscribers must respect the safety cap.** Multi-target events increase drain load; if a Bombardier's death_bomb queues 5 events and each kills another Bombardier, cascades can explode. The existing `CombatPipeline.SAFETY_CAP` (≤200 events/drain, verify the exact number against [CombatPipeline.ts](../src/systems/CombatPipeline.ts)) catches this. Test: 5 Bombardiers die in one frame, verify cap engages if the cascade is deep enough.
- **Subscribers must NOT mutate selector-returned units directly.** Mutations go through the event → queueAbility → pipeline, not through `target.takeDamage(...)` calls from inside the subscriber. The whole point of the pipeline is to route all damage through one pathway.

### What this decision does NOT permit

- Subscribers running `_findTarget` (the attack-loop variant). `_findTarget` has attack-cycle-specific logic (route validation, in-range check against attacker position) that isn't what death triggers want. Use the Phase 3 selector registry directly via `runSelector(ability.targeting, ...)`.
- Subscribers adding or removing Phase 5 effects outside of the existing `applyEffectsPhase` + `applyHealPhase` + `applyDeathTriggerPhase` boundary. New subscribers with new effect-application semantics are architectural additions requiring stop-and-report.
- Subscribers running selectors to READ game state for cosmetic purposes (particles, audio). If a subscriber needs to know "how many enemies are nearby," route through the event payload, not through a spatial query.

### Forward rule for future orchestrators

When a Phase 9 or Phase 10 design surfaces a new multi-target triggered mechanic, the right question is "does this fit the selector-in-subscriber pattern?" If yes, it's a data/ability-side decision (new `AbilityDef` with an existing or new selector name). If no — e.g., it needs cross-frame state, or it has a different cadence than the pipeline's per-call drain — it's a new system, not a selector extension. Stop and report.

---

## Pre-migration audit rule — Hook-keyed vs dmgType-keyed coexistence check (NEW, Phase 8)

**Locked 2026-04-14 as a consequence of the F5 Wardling / F11 Bashguard asymmetry surfaced during the Max-budget review pass.**

### The rule

**Before migrating any Phase 8 (or later) unit whose legacy combat hook duplicates a mechanism in `_legacyApplyPhase`, classify the legacy mechanism as HOOK-KEYED or dmgType-KEYED and choose coexistence strategy accordingly.**

### Why this rule exists

`_legacyApplyPhase` at [CombatSystem.ts:668-748](../src/systems/CombatSystem.ts#L668-L748) contains multiple mechanisms that run for EVERY DamageEvent passing through the `apply` phase, including events from migrated attackers:

| Mechanism | Location | Keyed on |
|---|---|---|
| Aura-type ally damage reduction loop | [:693-702](../src/systems/CombatSystem.ts#L693-L702) | **Hook-keyed** — iterates `allyHandler.modifyAllyDamage` presence |
| Self damage modifier | [:704-708](../src/systems/CombatSystem.ts#L704-L708) | **Hook-keyed** — reads `selfHandler.modifyDamage` presence |
| `Math.round` defensive guard | [:710-715](../src/systems/CombatSystem.ts#L710-L715) | **Unconditional** — runs on every event's finalDamage |
| `takeDamage` call | [:721](../src/systems/CombatSystem.ts#L721) | **Unconditional** |
| Poise accumulation + stagger | [:723-742](../src/systems/CombatSystem.ts#L723-L742) | **dmgType-keyed** — runs if `dmgType === 'melee' \|\| 'ranged' \|\| 'aoe'` |
| Damage particle float | [:744-747](../src/systems/CombatSystem.ts#L744-L747) | **Unconditional** |

**Hook-keyed mechanisms clean up automatically when the unit's combat hook is deleted.** `wardlingCombat.modifyAllyDamage` is hook-keyed → the aura loop at :693-702 checks `if (allyHandler && allyHandler.modifyAllyDamage)` → once `wardlingCombat` is deleted during migration, the hook is absent, the loop is a no-op for Wardling. Clean migration.

**dmgType-keyed or unconditional mechanisms DO NOT clean up when a unit migrates**, because they're not bound to any unit's hook. Poise accumulation runs for every melee/ranged/aoe event regardless of attacker identity. Math.round runs for every event. Damage particles run for every event. **These mechanisms continue to fire for migrated attackers, and any new Phase 5 effect-based replacement creates a coexistence hazard.**

### The check, applied to every Phase 8 unit

For each Phase 8 unit, before writing migration code, the executor produces a one-line answer for each of:
1. **Does the unit's legacy combat hook duplicate a mechanism in `_legacyApplyPhase`?** If no, skip the rest — this check doesn't apply.
2. **Is the duplicating mechanism HOOK-keyed or dmgType-keyed/unconditional?**
3. **If hook-keyed:** deleting the hook during migration cleans up automatically. Document in the migration commit.
4. **If dmgType-keyed or unconditional:** migration is a HALF-MIGRATION. The new mechanism must coexist with the legacy mechanism for Phase 8, with explicit decision on how they don't collide. Examples: Bashguard knockback (F11 Option 1 defer with placeholder), future `Math.round`-dependent ability (refer to COMBAT_REFERENCE.md Finding 1 — the `Math.round` guard IS the coexistence; new variance path threads through it, not around it).

### Applied to Phase 8 units

| Unit | Legacy mechanism | Duplicates `_legacyApplyPhase`? | Keying | Migration strategy |
|---|---|---|---|---|
| Bashguard | knockback via knockForce → poise | YES, poise accumulation | **dmgType-keyed** | Half-migration (F11 Option 1 placeholder, poise stays legacy) |
| Ravager | atkRate mutation | NO (onUpdate loop, not apply phase) | — | Full migration via IP-3 |
| Legionnaire | none | NO | — | Pure stat migration |
| Wardling | modifyAllyDamage aura | YES, aura-type loop at :693-702 | **Hook-keyed** | Clean — delete hook, loop becomes no-op, add new subscriber (F5 IP-1) |
| Centurion | onUpdate rally + onDeath cleanup | NO (onUpdate + onDeath paths, not apply phase) | — | Full migration via IP-2 + IP-5 |
| Bombardier | onDeath explosion | NO (onDeath path, not apply phase) | — | Full migration via IP-4 |
| Stormfly | onAttack chain | NO (onAttack path) | — | Full migration via F3 + F4 |
| Mendwing | onUpdate heal | NO (onUpdate path) | — | Full migration via IP-5 |
| Longeye | onAttack pierce | NO (onAttack path) | — | Full migration via F3 + F4 |

**Only Bashguard hits the dmgType-keyed case in Phase 8.** Bashguard is the test of the F11 half-migration pattern.

### Forward rule

When Phase 9 or 10 adds a new unit with a combat hook duplicating a `_legacyApplyPhase` mechanism, run this check before migrating. If dmgType-keyed, stop and report — orchestrator decides between (a) half-migration via placeholder, (b) moving the mechanism out of `_legacyApplyPhase` into a scoped subscriber, or (c) deferring the migration.

---

## Pre-lock verification checkpoint (mandatory for cross-cutting touches)

**Locked 2026-04-14. Applies to F5 IP-2 (calculate-phase `atk` read) and F5 IP-3 (atkRate read path).**

### The checkpoint sequence

Phase 8's cross-cutting touches to the calculate phase (`applyModifiers(caster, caster.atk, 'atk')`) and attack-cycle timing (`applyModifiers(u, u.atkRate, 'atkRate')`) are SAFE because `applyModifiers` is transparent when no modifiers are active — it returns `baseValue` unchanged per [ModifierSystem.ts:166](../src/systems/ModifierSystem.ts#L166) (`if (!entity.components.has('HasModifiers')) return baseValue;`) or [:170-172](../src/systems/ModifierSystem.ts#L170-L172) (`if (!mods || mods.length === 0)`).

**But "safe because transparent" is a claim, not a proof.** The pre-lock verification checkpoint proves it BEFORE Phase 8 consumes the touch.

### Mandatory sequence

For each cross-cutting touch (IP-2 calculate phase, IP-3 attack-cycle timing):

1. **Land the cross-cutting touch as an isolated working-tree change.** The change touches ONLY the read sites — no unit migration, no new modifier sources, no subscriber registration. (The user manages git — do not run `git add` or `git commit`. Phase 8 executes in the working tree throughout.)
2. **Run `npm test`.** All 457+ Phase 7b tests must pass byte-for-byte. No new failures, no skips, no flakes.
3. **Run `npm run build`** (or the project's tsc check) to verify no type regressions.
4. **Run live smoke test** on a Phase 7b parity battle: 6 units per side, mixed migrated + unmigrated, battle to completion. Verify no visible behavior change.
5. **IF any of 2/3/4 fail:** revert the change in the working tree (checkout the touched files from whatever baseline the user's working tree was on) and **stop and report**. The Phase 5 `applyModifiers` gate is NOT transparent with no active modifiers — which contradicts the ModifierSystem contract — and that's a Phase 5 bug, not a Phase 8 design problem. The orchestrator re-opens F5 IP-2 or IP-3 accordingly.
6. **IF all of 2/3/4 pass:** proceed to the dependent unit migration. Centurion migrates after IP-2 passes. Ravager migrates after IP-3 passes.

### Why this is load-bearing

Phase 6 established the pattern of per-unit migration with byte-for-byte parity tests. Phase 7b's burn cadence bug taught us that automated tests miss observable axes unless explicitly designed. **The calculate-phase touch is the ONE Phase 8 change that affects every migrated unit simultaneously.** If it's wrong, every Phase 6/7 parity test regresses, and the Phase 8 migration commits won't be cleanly revertible — they'll be interleaved with the bad cross-cutting touch.

**Isolating the cross-cutting touch as its own commit makes it cleanly revertible.** If IP-2 fails verification, revert that one commit; Phase 6/7 parity is restored; Phase 8 Centurion migration doesn't exist yet so there's nothing to unwind.

### Not applicable to

- F5 IP-1 (Wardling) — the modify-phase subscriber is ADDITIVE (new subscriber, no change to existing reads). No cross-cutting surface.
- F5 IP-4 (Bombardier) — the death-trigger subscriber is ADDITIVE. No cross-cutting surface.
- F5 IP-5 (passive tick loop) — new function, new call site. No cross-cutting surface.
- F11 placeholder EffectDef — new file, no cross-cutting surface.

Only IP-2 and IP-3 hit cross-cutting reads and require the checkpoint.

---

## Finding 12 — Bombardier double-fire race in legacy post_apply (new, 2026-04-14)

**Classification:** Combat Audit tech debt follow-up, surfaced during Phase 8 design review.
**Severity:** low in current Phase 8 workloads, but the fix is load-bearing for Bombardier's new `applyDeathTriggerPhase` subscriber regardless.
**Fix criteria per refined scope discipline** (2026-04-13 Mendwing fix precedent): ≤10 LOC, single file, isolated behavior, caught during phase design, pre-existing bug → **fix in the same commit as Bombardier migration.**

### The finding

[`_legacyPostApplyPhase` at CombatSystem.ts:760-785](../src/systems/CombatSystem.ts#L760-L785) checks `if (!u.dead) return;` at :765 but does NOT check `event.cancelled`. If two damage events land on the same target in one drain cycle:

1. Event 1: `_legacyApplyPhase` reduces HP to 0, `takeDamage` sets `u.dead = true`. `_legacyPostApplyPhase` fires: death particles, audio, `handler.onDeath` → Bombardier's explosion hook runs, 5 AOE hitUnits queued.
2. Event 2: `_legacyApplyPhase` at :672-673 checks `if (u.dead || u.burrowed) { event.cancelled = true; return; }` → event 2 cancels. BUT `_legacyPostApplyPhase` does NOT check `event.cancelled`; only `!u.dead`. Event 2 reaches :765, `u.dead` is still true, the function proceeds: **particles fire again, audio fires again, `handler.onDeath` fires again → Bombardier explodes a second time, 5 more AOE hitUnits queued.**

**Double explosion.** In practice this is very low probability because the drain cadence is per-call and same-frame multi-hits on the same Bombardier are rare, but the race is real in code.

### The fix (applies to Phase 8 `applyDeathTriggerPhase` AND legacy `_legacyPostApplyPhase`)

Add a `u._deathTriggerFired: boolean` scratch field, mirroring the `u._spawned` pattern at [CombatSystem.ts:301-304](../src/systems/CombatSystem.ts#L301-L304). **One latch, two subscribers, asymmetric ownership: `_legacyPostApplyPhase` is CHECK-ONLY; `applyDeathTriggerPhase` is CHECK-AND-SET.**

```ts
// In _legacyPostApplyPhase — CHECK ONLY, does NOT set the latch.
// Replace:
if (!u.dead) return;
// with:
if (!u.dead || u._deathTriggerFired) return;
// (the latch is set later in the same drain by applyDeathTriggerPhase)
```

The latch SET lives in `applyDeathTriggerPhase` (F5 IP-4 body), which runs third in the locked post_apply registration order `[_legacyPostApplyPhase, applyEffectsPhase, applyDeathTriggerPhase]`. See the IP-4 lock for the exact body; the relevant ordering is that the set happens BEFORE the `!deathAbilityName` early-return, so non-Bombardier units still get Finding 12 protection.

### Why asymmetric ownership is load-bearing (re-locked 2026-04-14 after executor kickoff stop-and-report)

The first-pass lock had both subscribers do check-and-set. Executor trace during Stage 1 kickoff orientation caught the ordering bug: `_legacyPostApplyPhase` runs first in the drain, sets the latch, and `applyDeathTriggerPhase` then bails on its check — **`death_bomb` never queues, migrated Bombardier never explodes.** The first-pass lock made `applyDeathTriggerPhase` unreachable for every target `_legacyPostApplyPhase` had already processed in the same drain cycle, which is every dying target.

Re-lock: **the LATER subscriber in registration order is the one that sets the latch.** Earlier subscribers only check. This preserves Finding 12 protection for event 2+ (the later subscriber set the latch during event 1) without blocking the later subscriber's own path during event 1.

**Case-by-case correctness trace (from executor, verified by orchestrator):**

| Case | Sub1 `_legacyPostApplyPhase` | Sub3 `applyDeathTriggerPhase` | Correct? |
|---|---|---|---|
| Migrated Bombardier, E1 lethal | latch=false → runs legacy | latch=false → sets latch → queues death_bomb | ✅ both fire once |
| Migrated Bombardier, E2 on corpse | latch=true → bails | latch=true → bails (or cancelled early-return) | ✅ no double-fire |
| Non-deathAbility unit, E1 lethal | latch=false → runs legacy | latch=false → sets latch → bails on `!deathAbility` | ✅ Finding 12 armed |
| Non-deathAbility unit, E2 on corpse | latch=true → bails | latch=true → bails | ✅ no double particles |
| Legacy unit with `handler.onDeath` (pre-Stage-5) | latch=false → runs legacy + onDeath | latch=false → sets latch → bails on `!deathAbility` | ✅ Finding 12 armed |
| Scaffold window (Stage 1–4 before any unit has `deathAbility`) | latch=false → runs legacy | latch=false → sets latch → bails on `!deathAbility` | ✅ scaffold protects event 2+ from Stage 1 onward |

**Setting the latch BEFORE the `!deathAbilityName` early-return is load-bearing.** If the set happened AFTER the `!deathAbility` check, non-Bombardier units (which bail at that check) would never set the latch, and Finding 12 protection would break for every Phase 6/7/8 unit that isn't Bombardier. Do not reorder.

**Resets on pool recycle.** Add `_deathTriggerFired = false` to the Unit reset path in `Unit.init()` or wherever `_spawned` is reset — grep for `_spawned = false` to find the right site.

### Why this is "fix in same commit," not "follow-up"

Per the refined scope discipline (see memory `feedback_behavior_patches` — Mendwing healTimer precedent from 2026-04-13):

1. ≤10 LOC — YES (3-5 lines of field addition + 2 guard changes + 1 reset line).
2. Single file — NO, touches [Unit.ts](../src/entities/Unit.ts) (field declaration + reset) AND [CombatSystem.ts](../src/systems/CombatSystem.ts) (guard). Two files. **Borderline.**
3. Isolated behavior — YES (scratch field, no cross-module ripple).
4. No risky interaction with current phase work — YES (F5 IP-4 actively needs this guard).
5. Pre-existing bug — YES (lives in Phase 4 wrapper from 2026-04-12).
6. Caught during phase design (not smoke, but design review) — **EDGE CASE.** The scope discipline rule specifies "caught during phase smoke" as the trigger; this is "caught during phase design review." The spirit of the rule is "caught as a side effect of phase work, not a scope-expansion request." Design review is a side effect of phase work. Fix-in-session applies.

**Two-file touch is the only borderline criterion.** Orchestrator judgment call: fix in same commit. The two files are tightly coupled (scratch field + its consumer); splitting them into a follow-up PR would require the consumer to temporarily use a type-assertion workaround, which is worse than the coupling.

### Action items

1. Phase 8 Bombardier migration commit includes:
   - `_deathTriggerFired` field declaration in [Unit.ts](../src/entities/Unit.ts) (near `_spawned`)
   - `_deathTriggerFired` reset in `Unit.init()`
   - `_legacyPostApplyPhase` guard updated
   - `applyDeathTriggerPhase` guard inline (per F5 IP-4)
2. Finding 12 entry added to Combat Audit tech debt section of [MECHANICS_ROADMAP.md](../active/MECHANICS_ROADMAP.md) in the Phase 8 closure commit. Entry shape mirrors Findings 10 and 11 from Phase 7b closure.
3. Test coverage: `phase8.test.ts` adds a re-entry test — "Bombardier hit twice in one drain cycle triggers death_bomb exactly once" — verifies the guard works.

---

## Not in Phase 8 scope (deferred explicitly)

These came up during Phase 8 design and are NOT Phase 8 work:

1. **Legacy removal (Phase 9).** Once all 9 Phase 8 units are migrated, Phase 9 deletes the wrapper, the legacy hitUnit path, the `handler.onAttack` else-branch, and the Cinderfly legacy spread.
2. **Damage-type default effects lookup table (F10 deferred to Phase 10).**
3. **`aoeRider` primitive (F12 deferred to Phase 9).**
4. **Variance redesign (Phase 10).** `variancePct` / `critChance` / `critMult` fields on AbilityTierStats.
5. **Bleed / confuse / void / holy effects.** Not shipped. Phase 10+.
6. **Option C ability lab scene.** Queued for post-Phase-8, pre-Phase-10. Do not spec in Phase 8.
7. **Scenarios engine evolution.** `src/debug/scenarioEngine.ts` is permanent infra. `src/debug/phase7bScenarios.ts` is phase-scoped — DELETE as first step of Phase 8 work and REPLACE with `phase8Scenarios.ts` (Centurion rally, Bombardier death cascade, Stormfly chain, Ravager berserk, Mendwing heal, Wardling aura, Longeye pierce, Bashguard knockback).
8. **Phase 10 balance retune.** Phase 8 preserves byte-for-byte parity where possible.

---

## Decision log

| Decision | Lock | Date | Notes |
|---|---|---|---|
| F3 — handler-precedence fork | Option B (reverse precedence) | 2026-04-14 | First-pass lock, unchanged |
| F4 — per-target damage falloff | Option A (`targetFalloff: number[]`) + Resource-based Stormfly overcharge | 2026-04-14 | First-pass lock, unchanged |
| F5 — passive-ability migration | Option D (unified passive tick loop + separate death trigger subscriber) + explicit integration points IP-1..IP-5 | 2026-04-14, **re-locked 2026-04-14** | Re-locked after Max-budget review — named integration points that the first pass buried as stop-and-report triggers. CC1 resolved (Ravager step-function canonical). |
| F6 — getAtk override integration | Option A (no-op, ghost blocker) | 2026-04-14 | First-pass lock, **CC1-verified.** User prompt described continuous formula but code is canonical step function; F6 lock holds unchanged. |
| F10 — damage-type default effects | Option B (deferred to Phase 10) | 2026-04-14 | First-pass lock, unchanged. Verified queueAbility:243 has a clean Phase 10 landing site. |
| F11 — knockback layered model | **Option 1 (defer Effect to Phase 10) + placeholder EffectDef sub-lock** | 2026-04-14, **re-locked 2026-04-14** | First pass locked Option A (ship full Effect). Max-budget review caught double-knockback parity violation (legacy poise in `_legacyApplyPhase` + new Effect → double-stagger). Re-locked to Option 1 (defer Effect body to Phase 10, matches Cinderfly half-migration precedent) + placeholder EffectDef to prevent `lookupEffect` throw. |
| F12 — AOE-effect-rider primitive | Option B + D (Bombardier uses native multi-target, Cinderfly stays legacy until Phase 9) | 2026-04-14 | First-pass lock, refined to name "native multi-target = selector + for-loop + queueAbility from the death trigger subscriber" explicitly per Max-budget finding #4. |
| F13 — Mendwing heal range | Option B (90px) — **LOCKED 2026-04-15 by user** | 2026-04-14, **locked 2026-04-15** | First-pass lock + user confirmation at Stage 4 Task 2 close. User answered "of course B" after seeing the observation-tradeoff discussion. `heal_pulse.range = 90` + `targeting: 'lowest_hp_ally_in_range'` ship unchanged. No new `lowest_hp_ally_anywhere` selector. Phase 10 balance can overrule via 1-line data edit. |
| F14 — Phase 5 amendment audit log | Audit task (not a design decision) | 2026-04-14 | First-pass lock, unchanged |
| **NEW — Selector invocation from phase subscribers** | Allowed for multi-target triggered events (onDeath, future aoeRider) | 2026-04-14 | New architectural decision from re-lock turn. Phase 8 precedent: `applyDeathTriggerPhase` runs Phase 3 selectors directly. |
| **NEW — Hook-keyed vs dmgType-keyed coexistence audit rule** | Pre-migration audit step for every Phase 8 (and later) unit | 2026-04-14 | New pre-migration audit rule from re-lock turn. Surfaced by F5 Wardling / F11 Bashguard asymmetry. |
| **NEW — Pre-lock verification checkpoint for cross-cutting touches** | Mandatory for F5 IP-2 and IP-3 | 2026-04-14 | New execution rule from re-lock turn. Cross-cutting touches land as isolated working-tree changes, run Phase 6/7 tests, proceed only if green. No git commits — user manages git. |
| **NEW — Finding 12 (Bombardier double-fire race)** | Fix in same commit as Bombardier migration, backport guard to `_legacyPostApplyPhase` | 2026-04-14 | Surfaced during Phase 8 design review. Refined scope discipline case: 2-file touch, borderline, orchestrator judgment to fix in-session. Added to MECHANICS_ROADMAP.md Combat Audit tech debt. |
| **NEW — Mid-phase smoke discipline revision** | Stage-boundary smoke, not per-migration (Option 2) | 2026-04-15 | User fatigue + 5 clean smokes precedent (Stage 1 phase7bParity, IP-2, IP-3, Item 9 Legionnaire, Item 10 Bashguard) → per-migration smoke is diminishing returns. Policy change applies from Stage 4 onward (Ravager/Wardling/Centurion/Mendwing + Stage 5 complex migrations). Stage 3 items retained original per-item smoke. See "Stage 4 + Stage 5 smoke cadence" subsection in Migration Order below for the full cadence spec. |

---

## For the executor (reference while implementing)

When you hit a sub-decision that reads ambiguous, look it up here first. If the lock doesn't cover your case, stop and report — do NOT re-derive the decision. The whole point of this doc is that Phase 8 doesn't re-derive F3-F13.

**Stop-and-report triggers, in priority order:**

1. **Any architectural gap** the existing primitives can't express — highest priority, default to stop.
2. **Parity violations caught during smoke** where the fix changes a lock above — stop, orchestrator may re-open.
3. **Cross-cutting changes** to CombatSystem's attack cycle, modify phase, or pipeline registration order — stop, these are structural.
4. **Unit-specific behavior that doesn't fit the locked F5 category** for that unit — stop.
5. **Effect / modifier primitives** that the unit needs but Phase 5 doesn't ship — stop, these need a sub-phase like 7a.
6. **Smoke-caught pre-existing bugs** meeting the refined scope discipline (≤10 LOC, single file, isolated, pre-existing, caught in smoke) — FIX in-session, report in phase summary.
7. **Scope creep temptations** ("while I'm here" refactors) — don't do it, defer as tech debt.

**Effort level:** Max. Fresh session. 5-7 executor sessions expected across the 9 units.

**Migration order (re-ordered 2026-04-14 after re-lock — cross-cutting touches land BEFORE their dependent migrations):**

Phase 8 executes in 5 stages. Stages are sequential; within a stage, items are sequential too.

**Git policy (added 2026-04-14 after executor Stage 1 git-state discovery):** **The user manages git. The orchestrator does NOT direct commits.** Phase 8 — like Phases 1–7b — executes in the working tree. Stage boundaries, checkpoint steps, and "isolated change" language below refer to working-tree states verified by `npm test` + `npm run build` + smoke, NOT to git commits. The executor does not run `git add`, `git commit`, or any index-modifying command as part of Phase 8 work. The user decides when (or whether) to commit based on their own git strategy. If the executor encounters existing commit scaffolding from a prior orchestrator mistake or from habit, strip it and continue code-only. This rule holds for all 5 stages.

**Stage 4 + Stage 5 smoke cadence (added 2026-04-15 after Stage 3 close):** Stages 4 and 5 use **stage-boundary smoke**, not per-migration smoke. Per-item cadence is replaced by automated gates only — each item in Stage 4/5 lands as a working-tree state verified by `npm test` + `npm run build` + grep verification + checkpoint report, with **no live smoke between items**. At stage close, the executor requests ONE consolidated live smoke via a new scenario that exercises every migration landed in the stage:

- **Stage 4 close smoke → `stage4AllPassives` scenario.** Player roster: 1 Ravager (placed so it crosses the 50% HP step function mid-battle), 1 Wardling + 1 ally in its 90px coverage range, 2 Centurions overlapping a shared ally pool (multi-source aura stacking + death cleanup), 1 Mendwing with a pre-wounded ally nearby. Enemy roster: mixed Phase 6/7 migrated units that can deal predictable damage to exercise the Wardling aura and wound the Mendwing target. Scenario ships as Stage 4 task 2 (after the 3 pre-migration pipeline tests in task 1) before any unit file touches in item 11.
- **Stage 5 close smoke → `stage5AllComplex` scenario.** 5 Bombardiers stacked for the death cascade stress test + `CombatPipeline.SAFETY_CAP` engagement, 1 Stormfly vs 3-grub chain target line for `targetFalloff [1.0, 0.7, 0.4]` + every-4th-cast overcharge, 1 Longeye vs 2-grub in-line pierce for `targetFalloff [1.0, 0.5]`. Scenario ships as Stage 5 task 1 before any unit file touches in item 15.
- **Phase 8 exit sweep.** Final Phase 8 exit smoke runs the pre-existing `phase7bParity` + mixed-battle scenario. Unchanged from original Stage 5 plan.

**Bisection protocol if consolidated smoke fails:** do NOT patch forward. Stop-and-report the observation with scenario output details. Bisect by reverting the most recent migration first (Mendwing for Stage 4, Longeye for Stage 5), re-run automated suite + consolidated smoke. If the regression persists, undo the next-newest, and so on. Once smoke clears on a revert, the last-undone migration is the culprit — investigate it in isolation.

**Revertability requirement:** each migration in Stages 4/5 MUST land as a cleanly-separable working-tree state — distinct unit-file comment block, distinct `phase8.test.ts` describe block, distinct `phase8Plus` sentinel removal line, distinct unit-file touch, distinct `COVERAGE` map annotation. No "while I'm here" batched edits across items. Per-item revertability is the bisection protocol's armor.

**What stays per-migration (unchanged by this revision):**
- Checkpoint reports after every item with touch summary + test counts + surprises.
- Stop-and-report discipline on any architectural gap.
- Refined scope discipline for pre-existing bug fixes (≤10 LOC, single file, isolated, pre-existing, caught in smoke or design review).
- Grep-based verification for any cross-cutting touch.
- Pre-migration pipeline tests ship FIRST in Stage 4 before any unit file touches (decisions doc item 13 / F5 IP-1/2/3 non-short-circuit coverage).

### Stage 1 — Infrastructure (no unit migrations, each an isolated checkpoint step)

1. **F14 audit.** Verify Phase 5 clean. Grep `ActiveEffect`, `EffectContext`, `EffectDef`, `EffectBearer`; compare against authorized amendments. Expected: 0 drifts. If drifts, stop-and-report. Otherwise proceed.
2. **F3 fork fix.** Reverse precedence in the attack cycle — `canMigrate` wins, `handler.onAttack` becomes fallback. Regression test: Phase 6/7 migrated units still route via pipeline; pre-migration Longeye + Stormfly still route via their legacy onAttack hooks. Checkpoint: `npm test` green before advancing.
3. **F5 IP-5 passive tick loop scaffolding.** Add `updatePassives(alive, dt)` function, call from `resolve()` before the attack forEach. Body does NOTHING yet (no units carry passive-tick entries). Checkpoint: `npm test` green before advancing.
4. **F5 IP-4 `applyDeathTriggerPhase` scaffolding + Finding 12 backport.** Register new post_apply subscriber (third in order), body includes the `u._deathTriggerFired` guard but does NOTHING downstream yet (no units carry `deathAbility`). Add `_deathTriggerFired` field to Unit, reset in `Unit.init()`. Update `_legacyPostApplyPhase` to check the same guard (Finding 12 backport — CHECK-ONLY per the asymmetric-ownership re-lock). Add post_apply registration-order pin test. Checkpoint: `npm test` green before advancing.
5. **F11 placeholder `knockback` EffectDef.** Ship the no-body EffectDef with the load-bearing comment in cc.ts. Checkpoint: `npm test` green before advancing.

**Checkpoint after Stage 1:** run `npm test` and `npm run build`. All tests green. If not, revert the offending change in the working tree and stop-and-report.

### Stage 2 — Cross-cutting touches (with pre-lock verification checkpoints, mandatory)

6. **F5 IP-2: calculate phase `atk` read via `applyModifiers`.** Apply as an isolated working-tree change. **Verify:** run full test suite, verify Phase 6/7 parity tests pass byte-for-byte, live smoke on a Phase 7b parity battle. If ANY test regresses, revert the change and stop-and-report (Phase 5 `applyModifiers` bug, not a Phase 8 problem).
7. **F5 IP-3: atkRate read sites via `applyModifiers`.** Same sequence as IP-2. Grep all `u.atkRate` reads in CombatSystem.ts + any other production site; convert each to `applyModifiers(u, u.atkRate, 'atkRate')`. Run verification checkpoint.
8. **F5 IP-1: `applyAuraDamageModify` subscriber on modify phase.** Register AFTER `applyVarianceModify`. Body reads `applyModifiers(target, event.finalDamage, 'dmg_taken')` and writes back. Verify Phase 6/7 parity tests still pass (transparent when no `dmg_taken` modifiers exist).

### Stage 3 — Simple migrations (smallest risk, build momentum)

9. **Legionnaire.** No combat hooks, pure stat migration. Add `defaultAbility: 'jaw_strike'` (or `bash_strike` if Legionnaire should use blunt — verify intended dmgType against the legacy attack flavor). Parity test.
10. **Bashguard** per F11 Option 1 half-migration. `defaultAbility: 'bash_strike'`. First migrated hit flows through the pipeline, `applyEffect('knockback')` no-ops via placeholder, poise in `_legacyApplyPhase` fires stagger. Parity test: Bashguard vs Hardshell knock distance matches legacy.

### Stage 4 — Passive-system migrations (consumes Stage 2 integrations)

11. **Ravager.** Delete `ravagerCombat`. Add `selfModifier` field on `ravagerDef`. IP-5 passive tick loop gains the self-modifier dispatch branch; `updatePassives` now does something. Parity test: Ravager at 100% HP has base atkRate; at 50% HP crosses threshold and observes 1.5× atkRate via `applyModifiers`; above 50% HP returns to base.
12. **Wardling.** Delete `wardlingCombat.modifyAllyDamage`. Add `defaultAbility: 'guardian_ward'` (passive category). IP-5 passive tick loop gains the aura dispatch branch. Wardling adds `{ stat: 'dmg_taken', ... }` modifiers on in-range allies via IP-5's walked-list approach; IP-1's modify-phase subscriber reads them. Parity test: Wardling-protected ally takes `ceil(dmg * 0.8)` damage. Steady-state test: 60-frame Wardling coverage of a stationary ally results in exactly one `aura:${w.id}:dmg_taken` modifier on the ally, not 60 (verifies the walked-list no-churn property).
13. **Centurion.** Delete `centurionCombat`. Add `defaultAbility: 'rally_aura'`. Multi-Centurion smoke scenario: two centurions overlapping, one dies, other's buff persists on shared allies. Validates source-tracked modifier cleanup. **Pre-migration requirement (added 2026-04-15 from executor IP-2 report):** before migrating Centurion, add a `CombatPipeline.test.ts` case that exercises the calculate phase with a `HasModifiers`-carrying attacker that has a `{ stat: 'atk', type: 'percent', value: 20 }` modifier in its `modifiers[]` list, and asserts `event.baseDamage === floor(attacker.atk * 1.2 * tierMult)`. The existing Phase 6/7 pipeline tests exercise the transparent-by-default path (empty-mods-list short-circuit at [ModifierSystem.ts:170-172](../src/systems/ModifierSystem.ts#L170-L172)); they do NOT exercise the non-short-circuit path that Centurion's rally aura is the first production consumer of. Without this test, Centurion's migration is the first code to ever hit the full `stackModifiers` math in a pipeline context. Ship the test as an isolated pre-Centurion checkpoint, verify green, THEN write Centurion migration.
14. **Mendwing.** Delete `mendwingCombat`. Add `defaultAbility: 'heal_pulse'`. IP-5 passive tick loop gains the heal dispatch branch. Reuses existing `healTimer` field (the Phase 7b fixed accumulator). F13 90px range lock applies. Live smoke: Mendwing heals wounded allies within 90px.

### Stage 5 — Complex migrations (highest judgment density, landing last)

15. **Bombardier.** Add `deathAbility: 'death_bomb'` field on UnitDef. `applyDeathTriggerPhase` (scaffolded in Stage 1) now runs the selector + queueAbility loop — scaffolding becomes live. Delete `bombardierCombat`. Parity test: Bombardier death vs 5-grub cluster deals 65 damage to each, matches legacy. Stress test: 5 Bombardiers die same frame, resolveFrame safety cap engages if cascade is deep.
16. **Stormfly.** `defaultAbility: 'chain_lightning'`. F4 `targetFalloff: [1.0, 0.7, 0.4]` added to ability data. Resource-based overcharge (every 4th cast doubles) via Phase 5 Resources. F3 fork fix from Stage 1 lets Stormfly migrate (it has `onAttack`). Delete `stormflyCombat`. Parity test: chain hits 3 targets with correct falloff; overcharge visible every 4th cast; 25% stun chance applies via `appliesEffects: ['stun']`.
17. **Longeye.** `defaultAbility: 'piercing_shot'`. F4 `targetFalloff: [1.0, 0.5]`. F3 fork fix lets Longeye migrate (it has `onAttack`). Delete `longeyeCombat`. Parity test: Longeye hits 2 targets, second at ceil(dmg × 0.5).

### Post-migration sweep

18. **Registration order pins.** `phase8.test.ts` includes pins for both `modify` phase order (`[applyVarianceModify, applyAuraDamageModify]`) and `post_apply` phase order (`[_legacyPostApplyPhase, applyEffectsPhase, applyDeathTriggerPhase]`). These fail if a future change inserts an out-of-order subscriber.
19. **Live smoke sweep.** Run `phase8Scenarios.ts` with ALL Phase 8 units in a mixed battle. Verify no regressions, no crashes, all abilities fire as expected.
20. **Final `npm test` + build.** Expected: ~500+ tests passing, tsc + vite clean.
21. **Phase 8 exit report** per the Phase 7b template.

### Stage rules

- **Never skip a stage.** Stage 2 MUST land before Stage 4 (the passive migrations consume the cross-cutting reads). Stage 1 MUST land before Stage 2 (the F3 fork fix is needed so migrated units can actually route through the pipeline).
- **Never interleave stages.** Finish a stage's commits before starting the next. Stage 4 Centurion lands only after Stage 2 IP-2 passes verification.
- **Stop-and-report at stage boundaries.** If anything in a stage fails verification, stop at the boundary and report. Don't patch forward.

Execute in this order unless a stop-and-report forces a re-sequence. **Fresh executor session + Max effort** per the role-orchestrator rule.
