# Combat Rewrite Phase 9 — Legacy Combat Removal

> **Status:** NOT STARTED. Phase 8 closed 2026-04-17 (688 tests, 9 units migrated across 5 stages). This doc formalizes the Phase 9 cleanup backlog accumulated during Phase 8.
>
> **Scope:** Delete legacy combat code paths, resolve half-migrations, clean up tech debt surfaced during Phase 8. Phase 9 does NOT add new gameplay features, new abilities, or balance changes — those are Phase 10.
>
> **Executor effort:** Normal or High. Phase 9 is cleanup, not judgment-density. A fresh session is recommended but not mandatory.

## Backlog items

### 1. Delete the legacy hitUnit wrapper

`CombatSystem.hitUnit` wraps `queueAbility('legacy_basic_attack', { baseDamageOverride })`. With all units migrated, the wrapper has zero production callers (DOT ticks via `_processStatusEffects` are the last remaining caller — verify). Delete the wrapper, inline any surviving callers.

**Depends on:** item 2 (DOT tick routing) and item 3 (Cinderfly afterHit spread).

### 2. DOT tick routing — remove hitUnit dependency

`burn.onTick` routes damage via `this.hitUnit(target, dmg, 'burn', ctx)` (Phase 7a sub-decision 5). This was intentional: preserves aura-hook parity (Wardling dmg_taken modifier applies to burn ticks). Phase 9 replaces this with a direct `queueAbility` call from the DOT dispatcher so the wrapper can be deleted.

### 3. Cinderfly afterHit spread — delete or replace

The LAST legacy combat hook: `cinderflyCombat.afterHit` at normal.ts. Applies `burnTimer` to up to 3 adjacent enemies on hit. Phase 8 deferred this per F12 Option D.

**Phase 9 decision (2026-04-17): KEEP the spread.** User confirmed Cinderfly's 3-neighbor burn spread is important to gameplay identity. Build `aoeRider` primitive to replace the legacy `afterHit` hook. The single-consumer rule is overridden by gameplay intent — Cinderfly IS an AOE unit.

### 4. Delete `handler.onAttack` else-branch

CombatSystem attack cycle has `else if (handler && handler.onAttack)` fallback at ~line 928. With Stormfly and Longeye migrated, no unit carries `onAttack`. Delete the branch. The `canMigrate` check simplifies to just `!!u.defaultAbility && !(handler && handler.getAtk)`.

### 5. Rename `_legacyPostApplyPhase` + delete dead `handler.onDeath` dispatch

**Correction 2026-04-17 post-Batch-2:** this method is NOT pure legacy — it's the production death handler (particle burst, audio, nectar reward emission). Only the `handler.onDeath` dispatch inside it is dead (zero production hooks after Batch 1). Rename to something semantic (`_applyDeathEffects` or similar). Delete the `handler.onDeath` call + the `COMBAT_MAP` lookup inside it. Keep FX, audio, nectar reward.

Poise accumulation for Bashguard knockback lives elsewhere (verify via grep `poise` — likely in `_legacyApplyPhase` at the apply-phase level, not post_apply). Poise stays until Phase 10.

### 6. Delete `_processStatusEffects` legacy DOT loop

Legacy burn/poison tick loop in CombatSystem. Phase 7a wired `updateEffects` into `resolve()` for the new EffectSystem. Once item 2 (DOT routing) is done, the legacy DOT loop is dead code. Delete.

### 7. Centralize `targetCount` cap in `runSelectorInRange`

`allEnemiesInRange` selector doesn't respect `params.count`. Bombardier's call site and the multi-target attack cycle both `.slice(0, targetCount)` at the call site. Move the cap into `runSelectorInRange` as a universal post-filter so callers don't duplicate. DRY fix.

### 8. Remove `baseDamageOverride` from multi-target abilities

Stormfly and Longeye use `baseDamageOverride` per target for Phase 8 parity (variance × falloff ordering). Phase 10 variance redesign replaces `[-3, +2]` with per-ability `variancePct`. After Phase 10, remove overrides and route through real tier tables + calculate-phase falloff. The F4 dead-code infrastructure (calculate-phase `targetFalloff` wiring) becomes live.

**Depends on:** Phase 10 variance redesign landing first.

### 9. Remove `baseDamageOverride: 65` from Bombardier death_bomb

Same pattern as item 8. `death_bomb.tiers: linearDamageTiers()` is dead data while the override is active. Phase 10 removes override, wires through tier table. Add comment on `death_bomb.tiers` noting it's dead data until then.

**Depends on:** Phase 10 variance redesign.

### 10. Longeye forward-arc targeting divergence

Legacy `longeyeCombat.onAttack` used a facing-aware forward-arc filter (edge-to-edge distance). New system uses `nearest_enemies_in_range` (omnidirectional, left-edge distance). In a 1D lane enemies are always ahead, so no practical difference. If future 2D content makes this matter, add a `forward_arc_enemies_in_range` selector.

### 11. `regenTimer` dead field (Finding 10)

Declared as getter/setter pair on Unit + field on IUnit interface. Zero write sites in production. Delete the field, getter, setter, and interface declaration.

### 12. Knockback — Phase 10 coordinated delivery

Bashguard half-migration: damage goes through pipeline, knockback stays in legacy poise accumulation at `_legacyApplyPhase`. Phase 10 ships three coordinated changes:
- Real knockback `onApply` body in cc.ts (replacing the placeholder EffectDef)
- F10 DEFAULT_EFFECTS lookup table (damage-type → default effect)
- Delete poise accumulation from `_legacyApplyPhase`

NOT Phase 9 scope — listed here for completeness. Phase 10 kickoff consumes this.

### 13. `stage4AllPassives` helpText stale observation

Observation #8 says "Longeye fires via legacy longeyeCombat.onAttack hook." Post-migration, Longeye routes through `canMigrate` multi-target path. Update helpText or replace `phase8Scenarios.ts` with `phase9Scenarios.ts` per the scenario lifecycle.

### 14. Stun duration — single-consumer tuning

Stun EffectDef `duration: 0.6` was set for Stormfly parity. If future stun consumers need different durations, add per-ability stun duration override (e.g., `effectDuration?: Record<string, number>` on AbilityDef). Currently single-consumer — defer until second consumer surfaces.

### 15. Grub `defaultAbility` migration

Grub is the last unit without `defaultAbility`. Pure-stat migration — add `defaultAbility: 'jaw_strike'` (or appropriate basic ability). Simplest migration in the program.

### 16. Bombardier `defaultAbility` for basic attack

Bombardier has `deathAbility: 'death_bomb'` but NO `defaultAbility` — its basic melee attack still routes via the legacy `hitUnit` wrapper. Add `defaultAbility: 'jaw_strike'` so the basic attack routes through the pipeline. `deathAbility` is independent and stays unchanged.

### 17. Per-call drain cadence → once-per-tick

`resolveFrame` drains per-`hitUnit` call (legacy depth-first semantics preserved since Phase 4). With the legacy wrapper retiring, switch to once-per-tick drain. This changes combat resolution ordering — test thoroughly.

### 18. Dead code cleanup

- `Unit.doAttack()` at Unit.ts — dead method, never called (Finding 8).
- `hitCount` field on Unit — legacy Stormfly counter, replaced by ResourceSystem `castCount`. Verify zero callers, then delete.
- `_ralliedByUid` / `_baseAtk` / `_rallied` scratch fields — deleted during Stage 4 Centurion migration. Verify no residual references.
- `CombatHooks` import in normal.ts — remove after Cinderfly `afterHit` retires (item 3).

## Phase 9 vs Phase 10 boundary

| Item | Phase 9 | Phase 10 | Notes |
|------|---------|----------|-------|
| 1-6 | ✓ | | Legacy code deletion |
| 7 | ✓ | | DRY fix, no gameplay change |
| 8-9 | | ✓ | Depends on variance redesign |
| 10 | ✓ (if needed) | | Targeting divergence |
| 11 | ✓ | | Dead field cleanup |
| 12 | | ✓ | Coordinated knockback delivery |
| 13 | ✓ | | Scenario maintenance |
| 14 | | Defer | Only if second consumer surfaces |
| 15 | ✓ | | Grub last unmigrated unit |
| 16 | ✓ | | Bombardier basic attack still legacy |
| 17 | | ✓ | Drain cadence — behavior change, defer to Phase 10 |
| 18 | ✓ | | Dead code / field cleanup |
| 19 | ✓ | | Comment cleanup |
| 20 | ✓ | | CombatHooks interface deletion |

### 21. Base-attack variance — either unify with pipeline or delete

Surfaced in Phase 10 Batch 1 review (2026-04-17). Ranged units hitting the enemy base, and all units at the wall attacking bases, still use `(Math.random() * 4) | 0` for +0..+3 variance at [CombatSystem.ts:889](../src/systems/CombatSystem.ts#L889), [:1082](../src/systems/CombatSystem.ts#L1082), [:1108](../src/systems/CombatSystem.ts#L1108). These paths bypass the pipeline via direct `target.takeDamage` calls, so the Phase 10 Batch 1 variance redesign doesn't reach them. Three options: (a) migrate base attacks to go through the pipeline so they pick up the new variance/crit mechanism, (b) delete the legacy +0..+3 variance and make base attacks deterministic, (c) accept the divergence and document. Phase 10 decision.

### 20. Delete `CombatHooks` interface + `COMBAT_MAP`

Surfaced post-Batch-2 (2026-04-17). The `CombatHooks` interface at types.ts is fully dead type surface — zero production hooks exist across both genelines after Batch 1. The `combat?: CombatHooks` field on UnitModule is unused. `COMBAT_MAP` at `units/registry.ts` is populated as empty. Delete all three. Update `app/src/units/CLAUDE.md` and `DESIGN_PATTERNS.md` to remove the hook pattern documentation — the architecture is now ability-data + effect-system, not combat-hooks.

### 19. Comment cleanup — strip phase provenance + trim JSDoc bloat

Two problems, one pass:

**Default stance: DELETE. Justify keeping.** Most comments in this codebase are implementation history that no longer helps a reader. If you have to think "is this useful?" — it probably isn't. Delete and move on.

**Delete reflexively:**
- Phase/stage/item provenance tags ("Phase 5 —", "Phase 8 Stage 5 item 16", "Phase 7a amendment")
- Comments that restate the function signature ("Build a context snapshot for a hook call" — function is named `buildContext`)
- Comments that list one example derivable from grep ("used by burn.onTick, etc.")
- Comments describing what future phases will do ("Phase 4 will wire this up") — those phases are done
- Comments narrating why a field was added ("Phase 7b added this because ...") — git blame says it
- Multi-paragraph JSDoc blocks describing mechanics visible in the code below ("Longeye hits up to 2 enemies, second at 50%" when the data literally says `targetCount: 2, targetFalloff: [1.0, 0.5]`)

**Keep only if it documents:**
- A non-obvious invariant (e.g., "registration order is load-bearing — Finding 12 requires legacy-first / effects-second / death-trigger-third")
- A foot-gun warning (e.g., "Do NOT set `u._deathTriggerFired = true` here — asymmetric latch ownership")
- A surprising design choice where the WHY isn't visible from the code (e.g., "live reference, not a copy — mutations must persist across ticks")
- An active Finding/lock reference that attaches to real behavior (e.g., "F5 IP-3 atkRate gate" — names the subsystem)
- Trim kept comments to one line when possible.

**Expected impact:** ~30-50% of comment volume across combat files. If a file's comment count doesn't drop noticeably, you're under-trimming. Err aggressive.

Files with heavy tagging/bloat: `EffectSystem.ts`, `CombatPipeline.ts`, `CombatSystem.ts`, `cc.ts`, `dot.ts`, `Targeting.ts`, `ModifierSystem.ts`, unit files (`normal.ts`, `alpha.ts`), ability data files, test files.

## Sequencing recommendation

Phase 9 items 1-6 have dependencies. Recommended order:
1. Item 3 (Cinderfly spread decision) — this unblocks deletion of `afterHit`
2. Item 2 (DOT routing) — remove `hitUnit` dependency from burn ticks
3. Item 6 (delete legacy DOT loop) — unblocked by item 2
4. Item 1 (delete hitUnit wrapper) — unblocked by items 2, 3
5. Item 4 (delete onAttack branch) — independent
6. Item 5 (delete _legacyPostApplyPhase) — LAST, after verifying poise/knockback is preserved for Phase 10
7. Items 7, 10, 11, 13 — independent, any order
8. Items 15, 16 (Grub + Bombardier defaultAbility) — before item 1 (wrapper deletion needs zero legacy callers)
9. Item 17 (drain cadence) — after item 1 (wrapper deletion simplifies drain reasoning)
10. Item 18 (dead code) — any time, independent
11. Item 19 (stale comments) — LAST, after all code changes land (avoids merge conflicts with other items)
