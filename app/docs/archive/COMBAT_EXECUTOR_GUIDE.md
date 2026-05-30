# Combat System Executor Guide

A lookup for executors working on the combat system. Goal: prevent reimplementation of existing primitives and keep extensions clean.

**Not** a tutorial. **Not** a design-rationale doc. For the WHY behind the patterns, read [DESIGN_PATTERNS.md](../reference/DESIGN_PATTERNS.md) (especially section 12 "Combat System Architecture — 5 Layers"). This file is the HOW: what exists, what to call, when to stop and report.

---

## Before writing new code — the checklist

Run through this before adding any combat-related code:

1. **Does a primitive already do this?** Scan the [Primitives index](#primitives-index). If one fits, use it.
2. **Does an existing ability demonstrate the pattern?** Grep `app/src/config/combat/abilities/` for the nearest analog. Copy its shape, don't invent.
3. **Does it need a new phase or new event field?** See [When primitives aren't enough](#when-the-primitives-arent-enough). STOP AND REPORT — do not patch forward.
4. **Is there an existing helper you'd be inlining?** If you'd duplicate `shiftTier`, `applyModifiers`, `runSelectorInRange`, or any other export, STOP AND REPORT.

The failure mode to avoid: accumulated patches. Unit behavior is data, the pipeline is event-driven, effects own their lifecycle. Breaking any of those invariants without orchestrator approval is a patch, not a feature.

---

## Primitives index

Every entry below is grep-verified at the cited path. Check the source for current signatures — this table lists purpose + location only.

### Pipeline — [CombatPipeline.ts](../src/systems/CombatPipeline.ts)

| Name | Where | Purpose |
|---|---|---|
| `CombatPipeline` class | [:128](../src/systems/CombatPipeline.ts#L128) | Owns the event queue, 7-phase drain, and subscriber registration. One instance per game, created by `CombatSystem`. |
| `queueAbility(attacker, target, name, opts?)` | [:188](../src/systems/CombatPipeline.ts#L188) | Enqueue a DamageEvent. Does **not** drain — caller owns `resolveFrame`. Resolves `ability.appliesEffects` → default effects for dmgType automatically. |
| `resolveFrame()` | [:234](../src/systems/CombatPipeline.ts#L234) | Drain the queue through all 7 phases. Soft cap: 200 events per drain (`SAFETY_CAP`). Skips dead targets. |
| `on(phase, handler)` / `off(phase, handler)` | [:149](../src/systems/CombatPipeline.ts#L149) | Subscribe/unsubscribe a phase handler. Phase handlers receive the `DamageEvent` and may mutate it or set `event.cancelled = true`. |
| `clear()` | [:331](../src/systems/CombatPipeline.ts#L331) | Reset queue state. For tests. |
| `PIPELINE_PHASES` | [:38](../src/systems/CombatPipeline.ts#L38) | The 7 phase names in fire order. Importable constant. |
| `calculatePhase(event)` | [:76](../src/systems/CombatPipeline.ts#L76) | Default calculate-phase handler. Computes `effectiveTier` via `shiftTier` + writes `baseDamage`, `finalDamage`. Already registered. |
| `resistPhase` / `modifyPhase` | [:120](../src/systems/CombatPipeline.ts#L120), [:124](../src/systems/CombatPipeline.ts#L124) | Default handlers for `resist` and `modify` phases. Modify phase is where `CombatSystem` registers variance/crit, aura damage, etc. |

### Effects — [EffectSystem.ts](../src/systems/EffectSystem.ts) and [config/combat/effects/](../src/config/combat/effects/)

| Name | Where | Purpose |
|---|---|---|
| `applyEffect(target, defOrName, opts)` | [EffectSystem.ts:40](../src/systems/EffectSystem.ts#L40) | Single entry point for applying a status effect. Handles `prevents`, non-stackable refresh, stackable append, `onApply` fire. Skips dead targets. `opts` takes `source`, `remaining`, `appliedTier`. |
| `removeEffect(target, name)` | [EffectSystem.ts:104](../src/systems/EffectSystem.ts#L104) | Remove all instances of a named effect, firing `onExpire` on each. |
| `updateEffects(units, dt)` | [EffectSystem.ts:124](../src/systems/EffectSystem.ts#L124) | Per-frame tick loop. Runs `onTick`, decrements `remaining`, fires `onExpire` when expired, handles `onHostDeath`. |
| `findActiveEffect(target, name)` | [EffectSystem.ts:148](../src/systems/EffectSystem.ts#L148) | Returns first matching `ActiveEffect`, or null. |
| `hasActiveEffect(target, name)` | [EffectSystem.ts:160](../src/systems/EffectSystem.ts#L160) | Boolean existence check. Used for gating (e.g. `stun` in `Unit.canAttack`). |
| `countActiveEffect(target, name)` | [EffectSystem.ts:164](../src/systems/EffectSystem.ts#L164) | Stack count. For stackable effects. |
| `lookupEffect(name)` | [effects/index.ts:19](../src/config/combat/effects/index.ts#L19) | Effect def registry lookup. Throws on missing. |
| `dispatchDotDamage(attacker, target, amount, flavor)` | Module-level, set by `makeDotDispatcher` ([CombatSystem.ts:131](../src/systems/CombatSystem.ts#L131)) | DOT ticks call this to route damage back through the pipeline as `override_damage_event`. Don't call directly — DOT onTick bodies use it via effect dispatcher wiring. |

### Modifiers — [ModifierSystem.ts](../src/systems/ModifierSystem.ts)

| Name | Where | Purpose |
|---|---|---|
| `applyModifiers(entity, base, stat)` | [:106](../src/systems/ModifierSystem.ts#L106) | Compute effective stat value: base + flats, then additive percent, then override. Applies `STAT_CAPS`. **This is the right way to read a modifier-backed stat.** |
| `addModifier(entity, mod)` | [:126](../src/systems/ModifierSystem.ts#L126) | Attach a modifier with a `source` string. Source tags are critical — that's how auras/buffs clean up when their owner dies. |
| `removeModifiersBySource(entity, source)` | [:135](../src/systems/ModifierSystem.ts#L135) | Batch-remove all modifiers by source. Aura cleanup uses `aura:${ownerId}:${stat}`. |
| `tickModifiers(entity, dt)` | [:156](../src/systems/ModifierSystem.ts#L156) | Decrement `duration` on timed modifiers, remove when expired. |
| `stackModifiers(mods, base)` | [:61](../src/systems/ModifierSystem.ts#L61) | Pure stacking function. `applyModifiers` wraps it — use that unless you're writing tests. |
| `Modifier` / `ModifierType` / `ModifierBearer` | [:25](../src/systems/ModifierSystem.ts#L25), [:9](../src/systems/ModifierSystem.ts#L9), [:45](../src/systems/ModifierSystem.ts#L45) | Types. `ModifierType = 'flat' \| 'percent' \| 'override'`. |
| `STAT_CAPS` | [:37](../src/systems/ModifierSystem.ts#L37) | Min/max bounds per stat. Enforced inside `applyModifiers`. |

### Targeting — [Targeting.ts](../src/systems/Targeting.ts)

| Name | Where | Purpose |
|---|---|---|
| `runSelectorInRange(selectorName, caster, ability, allAlive)` | [:189](../src/systems/Targeting.ts#L189) | Production entry point. Range-filters candidates (lane distance, strict `<`), runs named selector, caps to `ability.targetCount`. |
| `SELECTORS` | [:161](../src/systems/Targeting.ts#L161) | Registry of all named selectors. Add a selector by adding an entry here, not by writing inline targeting logic. |
| `lookupSelector(name)` | [:175](../src/systems/Targeting.ts#L175) | Registry lookup. Throws on missing. |
| `laneDistance(a, b)` | [:49](../src/systems/Targeting.ts#L49) | `Math.abs(a.x - b.x)`. The canonical distance metric in combat. |
| `DEFAULT_COMBATANT_FILTER` / `DEFAULT_TARGETABLE_FILTER` | [:43](../src/systems/Targeting.ts#L43), [:46](../src/systems/Targeting.ts#L46) | Component-tag filters used by selectors. |

### Resistance — [config/combat/resistances.ts](../src/config/combat/resistances.ts)

| Name | Where | Purpose |
|---|---|---|
| `ResistanceTier` | [:26](../src/config/combat/resistances.ts#L26) | Type: `'weakest' \| 'weaker' \| ... \| 'strongest'`. 7 tiers. |
| `RESISTANCE_TIERS` | [:16](../src/config/combat/resistances.ts#L16) | Tier array in ladder order. |
| `DEFAULT_RESISTANCE` | [:29](../src/config/combat/resistances.ts#L29) | `'normal'`. Use this when defaulting a missing resistance lookup. |
| `shiftTier(tier, delta)` | [:45](../src/config/combat/resistances.ts#L45) | Move a tier up (positive) or down (negative) on the ladder, clamped to ends. Used for penetration. **Reuse — do not inline the shift math.** |

### Ability registry — [config/combat/abilities/index.ts](../src/config/combat/abilities/index.ts)

| Name | Where | Purpose |
|---|---|---|
| `ABILITIES` | [:17](../src/config/combat/abilities/index.ts#L17) | Merged record of all ability defs across dmgType files. |
| `lookupAbility(name)` | [:32](../src/config/combat/abilities/index.ts#L32) | Registry lookup. Throws on missing. |
| `hasAbility(name)` | [:38](../src/config/combat/abilities/index.ts#L38) | Boolean existence. |
| `linearDamageTiers(scale)` | [_tierTables.ts:10](../src/config/combat/abilities/_tierTables.ts#L10) | Helper that builds a standard linear tier table. Use this in ability defs instead of hand-writing the 7-row object. |
| `linearDamageTiersWithEffect(...)` | [_tierTables.ts:23](../src/config/combat/abilities/_tierTables.ts#L23) | Variant that also sets `effectChance` per tier. |

Per-dmgType ability files: `sharp.ts`, `blunt.ts`, `heat.ts`, `cold.ts`, `toxic.ts`, `electric.ts`, `psychic.ts`, `void.ts`, `holy.ts`, `utility.ts`, `override.ts`. Add new abilities to the appropriate file — don't create new dmgType files.

### FX dispatchers — [CombatSystem.ts](../src/systems/CombatSystem.ts)

Module-level singletons the `CombatSystem` constructor wires at startup. Tests stub them. Gameplay code reads the dispatcher; UI/FX code provides it.

| Setter | Where | For |
|---|---|---|
| `setHealFxDispatcher` | [:102](../src/systems/CombatSystem.ts#L102) | Heal `+N` float + heal sound. |
| `setDeathTriggerDispatcher` | [:179](../src/systems/CombatSystem.ts#L179) | Death explosion FX + selector + `queueAbility` loop. |
| `setAoeRiderAliveAccessor` | [:192](../src/systems/CombatSystem.ts#L192) | Alive-list provider for `applyAoeRiderPhase`. |
| `setDotDispatcher` (via `makeDotDispatcher`) | [:131](../src/systems/CombatSystem.ts#L131) | DOT damage routed through pipeline with `baseDamageOverride`. |
| `setStunFxDispatcher` | (grep `setStunFxDispatcher` in CombatSystem.ts) | "STUNNED!" float. |

**Do not** import UI/Phaser modules inside `systems/`. Use a dispatcher setter.

### Unit lifecycle — [UnitPool.ts](../src/systems/UnitPool.ts) and [entities/Unit.ts](../src/entities/Unit.ts)

| Name | Purpose |
|---|---|
| `unitPool.spawn(def, side, x)` | Acquire a Unit from the pool. Initializes it. |
| `unitPool.despawn(unit)` / `unit.kill()` | Release back to pool. Marks inactive, hides. |

**Never** `new Unit()` outside `SandboxScene`. **Never** `unit.destroy()` in gameplay code.

---

## Data shapes — quick reference

Read the actual type declarations for field detail. This is a pointer map.

| Type | Where | What it drives |
|---|---|---|
| `UnitDef` | [types.ts](../src/types.ts) — grep `interface UnitDef` | Stats, visuals, `defaultAbility`, `deathAbility`, `auraModifier`, `selfModifier`, `passiveHeal`, `resistance`, `penetration`. **All unit behavior.** See [units/CLAUDE.md](../../src/units/CLAUDE.md). |
| `AbilityDef` | [types.ts:455](../src/types.ts#L455) | `category`, `dmgType`, `targeting`, `range`, `targetCount`, `tiers`, `appliesEffects`, `aoeRider`, `chainRange`, `overchargeEvery`, `targetFalloff`, `trigger`, `healAmount`, `auraMods`, `skipsResistance`. |
| `EffectDef` | [effects/types.ts:63](../src/config/combat/effects/types.ts#L63) | `duration`, `stackable`, `maxStacks`, `prevents`, `onHostDeath`, `tiers` (per-tier stat bag), lifecycle hooks `onApply`/`onTick`/`onExpire`/`onStack`. |
| `ActiveEffect` | [effects/types.ts:84](../src/config/combat/effects/types.ts#L84) | Runtime instance on a unit: `def`, `remaining`, `stacks`, `source`, `accumulator`, `appliedTier`. |
| `DamageEvent` | [types.ts:500+](../src/types.ts#L500) | Envelope flowing through the 7 phases: `attacker`, `target`, `ability`, `dmgType`, `baseDamage`, `finalDamage`, `effectiveTier`, `effects`, `cancelled`, `isReflected`, `isRedirected`, `damageMultiplier`. |
| `Modifier` | [ModifierSystem.ts:25](../src/systems/ModifierSystem.ts#L25) | `stat`, `type`, `value`, `source`, optional `duration`. |

**Field semantics** (common confusion):

- `AbilityDef.tiers` is keyed by **target's resolved resistance tier**, not caster's tier. A strong-tier target takes the `strong` row from the table.
- `EffectDef.tiers` is the same shape but the stats inside are effect-specific (chunk/interval for burn, duration for stun, etc.).
- `ActiveEffect.appliedTier` is the tier that was live at application time — `onTick` uses it for stat lookup so DOTs scale with the tier they landed at, not always `normal`.
- `DamageEvent.effectiveTier` is the post-penetration resolved tier the calculate phase writes. Read this when applying effects or in post-phase handlers.

---

## The 7-phase pipeline — cheatsheet

### The phases (fire order)

1. **`pre_damage`** — first chance to set `event.cancelled = true`. Invulnerability, dodge, block.
2. **`calculate`** — base damage from ability tiers. `calculatePhase` is registered by default.
3. **`resist`** — reserved for adaptive resistance / adaptive carapace. `resistPhase` is the no-op default.
4. **`modify`** — variance, crit, aura damage, caps. `modifyPhase` is the no-op default; `CombatSystem` registers the real subscribers here.
5. **`pre_apply`** — last chance to cancel or redirect. Heal dispatch, damage redirect.
6. **`apply`** — HP changes, effects applied via `applyEffectsPhase`, AOE rider via `applyAoeRiderPhase`. Damage floored to ≥1.
7. **`post_apply`** — death checks, reflect, lifesteal, death-triggered abilities via `applyDeathTriggerPhase`.

A phase handler that sets `event.cancelled = true` short-circuits all **subsequent** phases for that event. Phases already executed before the cancel still ran.

### Subscription rules

- Register default handlers inline on construction (see [CombatPipeline.ts:138-146](../src/systems/CombatPipeline.ts#L138-L146)).
- Register the rest via `pipeline.on(phase, handler)` during `CombatSystem` construction.
- **Never** call `pipeline.resolveFrame()` from inside a phase handler. The outer drain loop handles it. Queue more events via `queueAbility` — they'll drain next iteration of the drain's while loop.
- **Selector-in-subscriber rule**: phase handlers MAY call `runSelectorInRange` to find secondary targets, but they must NOT call `resolveFrame`. Death-trigger dispatcher is a canonical example — it selects + queues, the outer loop drains.

### Rules that bite if you forget them

- **Snapshot before iterating mutable lists.** `[...event.effects]`, `[...unit.activeEffects]`, `[...nearbyTargets]`. A handler can add/remove during iteration.
- **`dead = true` is final.** Death handlers run once. `_deathTriggerFired` latch is asymmetric: `_applyDeathEffectsPhase` checks it, `applyDeathTriggerPhase` sets it. Don't move the set.
- **AOE rider runs on every damage event with `ability.aoeRider`**, not every ability. If your ability shouldn't spread, omit the field.
- **Heal and utility don't go through calculate.** `queueAbility` still queues them; `applyHealPhase` (pre_apply) handles heals by amount. Utility skips damage entirely. See [CombatPipeline.ts queueAbility](../src/systems/CombatPipeline.ts#L188).
- **Override damage events** (`override_damage_event`, used by DOT ticks) carry `baseDamageOverride` and set `effectiveTier = 'normal'` in the override fast path ([CombatPipeline.ts:82](../src/systems/CombatPipeline.ts#L82)). They bypass tier lookup.

---

## When the primitives aren't enough

Prefer existing primitives. But don't force-fit — if the ability's requirements genuinely exceed what the architecture supports, the fix is to **extend cleanly**, not patch around.

The failure modes are symmetric: reimplementing a primitive is waste; jamming a complex ability through ill-fitting primitives is a patch. Both decay the codebase.

### Signals that extension is warranted

- The ability needs a phase that doesn't exist (pre-selection filtering, post-resolve cleanup outside the 7 phases).
- The ability needs cross-phase state that doesn't fit on `DamageEvent`'s typed fields.
- The ability needs a selector the registry doesn't have and can't express via composition of existing selectors.
- An effect needs a lifecycle hook beyond `onApply`/`onTick`/`onExpire`/`onStack`.
- Two primitives interact in a way neither supports (e.g. chain + aoeRider coupling) and the composition isn't clean.

### The rule: STOP AND REPORT, don't patch forward

When primitives don't fit, the orchestrator decides:
- **Extend architecture cleanly** — new primitive, new phase, new typed field
- **Accept a documented workaround** — with the constraint named
- **Re-scope the ability** — the design asked for more than the architecture earns

Never inline the workaround without surfacing the decision. The rewrite dies from accumulated patches.

### Clean extension vs patch — one worked contrast

**Clean**: Adding `appliedTier: ResistanceTier` as a typed field on `ActiveEffect` so DOTs tick at the tier they landed at. The field is typed, serializable, carried by the single `applyEffect` helper. Every effect onTick that reads it gets the right value uniformly.

**Patch**: Adding `_someScratchField` with an underscore prefix, casting through `unknown` to access it, passing it only sometimes. The `_crit` field on `DamageEvent` is exactly this — it works, but the type system lies about it, and the next dev writing a post_apply handler has no way to discover it. Keep the patch out.

If you find yourself reaching for an underscore-prefix field, a cast-through-unknown, or a "just this once" inline copy of an existing helper's logic — stop and report.

---

## Anti-patterns — evidence-based

Each entry below is tied to a specific invariant in the codebase. Don't add to this list speculatively; orchestrator adds entries when a real corrective review happens.

| Don't | Do | Why |
|---|---|---|
| `new Unit()` in gameplay code | `unitPool.spawn(def, side, x)` | Pool recycling. `new Unit` leaks and bypasses lifecycle. `SandboxScene` is the only exception. |
| `unit.destroy()` in gameplay code | `unit.kill()` or `unitPool.despawn(unit)` | Same reason. `kill()` calls `deactivate()` which returns to pool. |
| `scene.events.emit('gameEvent', ...)` | Typed `EventBus` ([systems/EventBus.ts](../src/systems/EventBus.ts)) | Phaser's `scene.events` is untyped. Game-logic events must be typed through `GameEvents` interface. Phaser scene events are for scene transitions / input only. |
| Class inheritance or `CombatHooks` on a new unit | Data fields on `UnitDef` — `defaultAbility`, `deathAbility`, `auraModifier`, `selfModifier`, `passiveHeal` | `CombatHooks` is RETIRED (2026-04-17, Phase 9 Batch 3). All behavior is data-driven. See [DESIGN_PATTERNS.md section 3](../reference/DESIGN_PATTERNS.md). |
| Inlining tier-shift math | `shiftTier(tier, delta)` from [resistances.ts:45](../src/config/combat/resistances.ts#L45) | One source of truth for the ladder, including the clamp at both ends. |
| Inlining selector logic | Add a named selector to `SELECTORS` in [Targeting.ts:161](../src/systems/Targeting.ts#L161); reference by string from `AbilityDef.targeting` | Selectors are data-addressable so ability defs stay pure data. |
| Pushing directly to `unit.activeEffects[]` | `applyEffect(target, name, opts)` | The helper handles `prevents`, non-stackable refresh, stack cap, `onApply` fire, dead-target guard. Direct push skips all of that. |
| `_underscore`-prefixed scratch fields on `DamageEvent` | Add a properly typed field | The existing `_crit`, `_baseDamageOverride`, `_targetIndex` are known debt. Don't add more. If you need cross-phase scratch, propose a typed field. |
| Game logic inside `Scene` subclasses | Put it in a manager under `systems/` | Scenes are thin UI wrappers. `GameManager` orchestrates. |
| Hardcoded `if (effect === 'burn')` branches | Define `onApply`/`onTick`/`onExpire`/`onStack` on the EffectDef; the system calls them | Effects own their lifecycle. The combat loop iterates and delegates. |
| Reading `unit.atk` directly when it might be modified | `applyModifiers(unit, unit.atk, 'atk')` | Auras, buffs, and debuffs are invisible otherwise. |
| Importing UI/Phaser inside `systems/*` | Module-level dispatcher setters (`setHealFxDispatcher`, etc.) | Keeps the combat system Phaser-free and testable. |
| Calling `resolveFrame()` from inside a phase handler | Queue more events via `queueAbility`; the outer drain handles them | Recursive drains break the safety cap and queue ordering. |

---

## Recipes — cross-references

Rather than duplicating existing content, point at it:

- **Add a new unit** → [units/CLAUDE.md](../../src/units/CLAUDE.md) "Unit File Template" + "Registry" sections.
- **Add a new damage ability** → [units/CLAUDE.md](../../src/units/CLAUDE.md) "Unit Behavior — Data-Driven" + existing ability files in [config/combat/abilities/](../src/config/combat/abilities/) for the dmgType.
- **Add a new status effect** → [DESIGN_PATTERNS.md section 12, Layer 4](../reference/DESIGN_PATTERNS.md) for the shape; [config/combat/effects/dot.ts](../src/config/combat/effects/dot.ts) for a worked onTick example.
- **Add a passive behavior** → [units/CLAUDE.md](../../src/units/CLAUDE.md) "Passive behaviors" bullet; `auraModifier`/`selfModifier`/`passiveHeal` fields on `UnitDef`.
- **Add a complex ability feature** — chain (`chainRange`), AOE spread (`aoeRider`), overcharge (`overchargeEvery`), per-target falloff (`targetFalloff`), death trigger (`deathAbility`): look at the existing ability that uses each. Stormfly for chains, Cinderfly for aoeRider, Bombardier for death_bomb. Grep for the field name and read the def.
- **Event-driven decoupling** → [DESIGN_PATTERNS.md section 4](../reference/DESIGN_PATTERNS.md) "Event Bus" (current events table).

If a recipe doesn't exist where you'd expect, STOP AND REPORT — don't draft one inline in a feature batch.

---

## Quick-reference decision table

| "I want to…" | Primitive |
|---|---|
| Deal damage from an ability | `pipeline.queueAbility`, then caller drains with `resolveFrame` |
| Apply a status effect from inside a phase handler | `applyEffect(target, name, { source, appliedTier })` |
| Compute a stat that may be buffed/debuffed | `applyModifiers(unit, base, statName)` |
| Find N nearest enemies within a range | `runSelectorInRange('nearest_enemies_in_range', caster, ability, allAlive)` |
| Resolve a target's effective tier vs. a damage type (with penetration) | `shiftTier(target.resistance[dmgType] ?? 'normal', -attacker.penetration[dmgType] ?? 0)` |
| Look up an ability by name | `lookupAbility(name)` — throws on missing |
| Look up an effect by name | `lookupEffect(name)` — throws on missing |
| Schedule secondary damage after a kill | In a `post_apply` handler, select targets via `runSelectorInRange` + call `queueAbility`. Don't call `resolveFrame`. |
| Add persistent buff when a unit enters range | Aura pattern: `addModifier` with source `aura:${ownerId}:${stat}`. On leave or owner death, `removeModifiersBySource(target, source)`. |
| Tick a DOT | Define `onTick` on the EffectDef. Read `ctx.instance.def.tiers?.[ctx.instance.appliedTier]` for tier-scaled stats. Use the dispatched DOT damage path, not direct HP subtraction. |

---

## What to do when this doc is wrong

File paths and line numbers rot. If a link is stale or a primitive no longer matches its description, the doc is out of date — not the code. Grep the symbol, read the source, and ask the orchestrator to update this file. Don't work around a stale doc; fix it.
