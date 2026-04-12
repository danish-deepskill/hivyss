# Combat Reference

> **Scope:** This document describes the *actual* behavior of the combat system as it exists in code, not the aspirational behavior from `units/CLAUDE.md` or individual hook docs. Every claim has a `file:line` reference. If the code and this doc disagree, the code is right and this doc is stale — open an issue.
>
> **Audience:** Anyone designing a feature that sits on top of the damage pipeline (Item 2 counter matrix, future status effects, new combat hooks). Read the damage pipeline section first.
>
> **Produced:** 2026-04-12 during Item 3 combat audit (commit `ea29e1f` landed the rally fix; this doc captures what the audit verified).

## Damage pipeline — 9 steps, exact order

When a unit's attack lands on another unit, damage flows through the following pipeline. All references are to `app/src/systems/CombatSystem.ts` unless noted.

```
1. baseAtk = handler.getAtk(u) if defined, else u.atk         [CombatSystem.ts:112]
2. dmg = max(1, baseAtk + ((Math.random()*6)|0) - 3)          [CombatSystem.ts:113]
   → variance is ASYMMETRIC: [−3, +2] not ±3
3. handler.onAttack(u, target, foes, dmg, ctx) if defined     [CombatSystem.ts:116-117]
   → REPLACES default attack; hook is responsible for calling
     ctx.hitUnit zero or more times with whatever dmg it wants
4. Otherwise: ctx.hitUnit(target, dmg, 'ranged'|'melee')      [CombatSystem.ts:119-121]
   → type chosen by range: >= 50 → ranged, else melee
5. Inside hitUnit, for each alive ally of target's side:      [CombatSystem.ts:249-259]
   → ally.modifyAllyDamage(auraUnit, target, dmg, ctx)
   → applied FIRST, stacked in iteration order (which is spawn order)
6. Target's modifyDamage(u, dmg, ctx) if defined              [CombatSystem.ts:261-265]
   → applied AFTER auras
7. target.takeDamage(finalDmg) → HP -= dmg                    [CombatSystem.ts:267]
   → sets target.dead = true if HP <= 0   [Unit.ts:329-331]
8. Poise accumulation — only for 'melee'|'ranged'|'aoe'       [CombatSystem.ts:269-288]
   → force = (attacker.knockForce ?? dmg) - target.knockResist
   → poiseAccum += force; if >= 100 → stagger + knockback
9. If target.dead:                                             [CombatSystem.ts:295-314]
   → particle burst + death sound
   → handler.onDeath(target, ctx)
   → if target.side === 'enemy': emit 'enemyKilled' event
10. handler.afterHit(u, target, dmg, ctx) if target alive      [CombatSystem.ts:129-131]
    → fires UNCONDITIONALLY after the default-attack path,
      see "afterHit contract note" below
```

**Key observation for Item 2 (counter matrix):** steps 5 and 6 are where damage modifiers apply. Counter matrix should slot in **between step 2 and step 3** (base damage with variance → counter multiplier → onAttack or default hit path) so the counter applies uniformly to both default attacks and `onAttack`-replaced attacks. Applying it later (inside step 5 or 6) would miss the `onAttack` path if the hook bypasses `modifyDamage`.

## Base attacks (unit hits a Base, not another unit)

Base damage flows through a **different** path — it does NOT go through `hitUnit`:

- Player unit at enemy base: [CombatSystem.ts:144-164]
- Enemy unit at player base: [CombatSystem.ts:167-193]

Behavior differences from the 9-step pipeline:

| Behavior | Unit target (hitUnit) | Base target (direct) |
|---|---|---|
| `getAtk` hook | ✓ fires [112] | ✓ fires [152, 176] |
| Variance | [−3, +2] [113] | [0, +3] [153, 177] (asymmetric up!) |
| `onAttack` hook | ✓ replaces attack | ✗ ignored |
| `modifyAllyDamage` auras | ✓ apply | ✗ do not apply |
| `modifyDamage` (target) | ✓ applies | ✗ (base has no trait) |
| `afterHit` hook | ✓ fires (see note) | ✗ does not fire |
| `onDeath` hook | ✓ fires on death | ✗ bases don't trigger hooks |
| `enemyKilled` event | ✓ for enemy units | ✗ base destruction doesn't emit |
| Wall ability block | N/A | ✓ `wallActive > 0` → dmg = 0 [178] |

**Item 2 consequence:** if the counter matrix is implemented inside `hitUnit`, it won't affect base damage. To apply uniformly, the counter logic needs to live in `resolve()` before branching into unit-vs-unit or unit-vs-base paths.

## Hook firing order per frame per unit

Per-frame inside `resolve()` [CombatSystem.ts:61-202], for each alive unit:

```
1. u.update(dt)                                               [CombatSystem.ts:63]
   → ticks atkCd, foreswingTimer, backswingTimer, poiseAccum (10/s recovery),
     effects Map durations                                    [Unit.ts:281-293]
2. handler.onSpawn once on first frame                        [CombatSystem.ts:67-70]
   → gated by u._spawned flag
3. Knockback slide (if u.knockback != 0)                      [CombatSystem.ts:73-81]
   → SKIPS rest of frame; cancels foreswing
4. Stun check (if stunTimer > 0)                              [CombatSystem.ts:84-88]
   → SKIPS rest of frame; cancels foreswing
5. _processStatusEffects (poison/burn DOT ticks)              [CombatSystem.ts:91, 206-221]
6. handler.onUpdate(u, dt, ctx)                               [CombatSystem.ts:94-97]
   → if returns true → SKIPS rest of frame (passive AI override)
7. Target finding via _findTarget                             [CombatSystem.ts:100-101]
8. If target in range: attack cycle (foreswing → damage → backswing)
   a. Start foreswing if canAttack && !backswing               [CombatSystem.ts:132-135]
   b. Wait during foreswingTimer > 0                           [CombatSystem.ts:106-107]
   c. On foreswing complete: run step 1-10 of damage pipeline  [CombatSystem.ts:108-131]
9. If no target: march forward                                [CombatSystem.ts:138-141]
   → if reached opposing base: base attack path (separate damage flow)
   → else: cancel any in-progress foreswing                   [CombatSystem.ts:195-200]
```

**Hook semantics** (from `types.ts:89-98` and verified against CombatSystem):

| Hook | When | Return | Notes |
|---|---|---|---|
| `onSpawn` | First frame alive | void | Gated by `_spawned` flag, fires exactly once |
| `onUpdate` | Every frame, after stun/knockback filter | `true` to skip normal AI | Runs BEFORE target finding |
| `onAttack` | Foreswing completes, target alive | void | REPLACES default attack, must call `ctx.hitUnit` if damage desired |
| `afterHit` | After default attack applies damage | void | See contract note below |
| `onDeath` | Inside `hitUnit` when `u.dead === true` | void | Fires once per death; attacker's hooks do NOT fire here |
| `modifyDamage` | Inside `hitUnit` after auras | modified dmg | For incoming damage to self (shield, etc.) |
| `modifyAllyDamage` | Inside `hitUnit` before `modifyDamage` | modified dmg | Iterated for every alive same-side ally; range check is up to the hook |
| `getAtk` | Each time damage is computed | atk value | Called from unit attacks AND base attacks [112, 152, 176] |

### `afterHit` contract note (Finding 2 — latent)

`afterHit` currently fires unconditionally after every default-attack damage call [CombatSystem.ts:129-131]. It does **not** fire for `onAttack`-defined units — the `afterHit` call is outside the `else` branch of the `handler.onAttack` check. Wait — re-reading lines 116-131:

```ts
if (handler && handler.onAttack) {
  handler.onAttack(u, target, foes, dmg, ctx);
} else {
  const hitType: DamageType = u.range >= 50 ? 'ranged' : 'melee';
  this.hitUnit(target, dmg, hitType, ctx);
  this._playHitSound(audio, hitType);
}
this._lastAttacker = null;

u.atkCd = (1 / u.atkRate) - u.foreswing;
u.backswingTimer = u.backswing;

if (handler && handler.afterHit && target && !target.dead) {
  handler.afterHit(u, target, dmg, ctx);
}
```

`afterHit` fires regardless of which branch ran. So a unit defining **both** `onAttack` and `afterHit` will see `afterHit` fire once per attack cycle, after `onAttack` returned, even though the `onAttack` handler is responsible for all damage calls. Whatever `ctx.hitUnit` calls `onAttack` made are already done by the time `afterHit` runs.

**Current state:** no unit defines both hooks. Longeye and Stormfly define `onAttack`; none of the 8 current combat hooks define both. The contract is effectively undefined.

**For future implementers:** assume `afterHit` fires once after default damage is applied. If you need `afterHit` semantics for an `onAttack` unit, call the logic yourself at the end of the `onAttack` hook. Do not rely on `afterHit` being suppressed when `onAttack` is defined — the code does not enforce that, despite what `units/CLAUDE.md` implies.

## Status effects

Backward-compat getters/setters in [Unit.ts:229-271] read and write a `Map<string, StatusEffect>`. A `StatusEffect` is `{ duration: number; accumulator?: number }`. Duration decays each frame in `Unit.update()` [Unit.ts:292-296].

| Effect | Applied by | Duration decay | Accumulator / DOT tick | Stacking rule |
|---|---|---|---|---|
| `poison` | Direct set on target (no current combat hook applies it) | [Unit.ts:292] | Ticks 5 dmg every 1.0s [CombatSystem.ts:207-213] | Refresh (overwrite) |
| `burn` | `cinderflyCombat.afterHit` [normal.ts:350-352] | [Unit.ts:292] | Ticks 5 dmg every 0.5s [CombatSystem.ts:214-220] | Refresh (overwrite) |
| `stun` | `stormflyCombat.onAttack` (25% chance per chained hit) [normal.ts:417] | [Unit.ts:292] | No tick; blocks AI [CombatSystem.ts:84-88] | Refresh |
| `slow` | `AbilityManager.castSlow` | [Unit.ts:292] | No tick; 0.45× speed multiplier [Unit.ts:301-303] | Refresh |
| `shield` / `shieldAbsorb` | None currently | [Unit.ts:292] | — | Refresh |
| `burrow` / `summon` / `regen` / `heal` | None currently apply; `mendwingCombat` reads `healTimer` as a cooldown [normal.ts:320] | [Unit.ts:292] | — | Refresh |

### DOT quirk worth knowing

Poison and burn DOT ticks go through `ctx.hitUnit` [CombatSystem.ts:211, 218], which means **DOTs pass through `modifyAllyDamage` and `modifyDamage` hooks** before landing. A burn tick on an ally near a Wardling will have the Wardling aura applied. DOTs do NOT accumulate poise [CombatSystem.ts:270, the `'melee'|'ranged'|'aoe'` filter].

**Item 2 note:** if counter matrix applies inside `hitUnit`, it will also affect DOT ticks, not just direct attacks. Probably intended (a fire-resistant unit should take less burn damage) but needs explicit design.

## Route attack matrix

Source: [RouteMatrix.ts:4-8]. Validated at two places in the combat flow: target finding [CombatSystem.ts:229] and damage-time re-validation inside `hitUnit` [CombatSystem.ts:246].

| Attacker → Target | air | land | tunnel |
|---|---|---|---|
| **air** | always | always | never |
| **land** | ranged only | always | never |
| **tunnel** | never | never | always |

"Ranged only" means the attacker must have `attackRange === 'ranged'` [RouteMatrix.ts:13]. `always` ignores range. `never` blocks attack regardless.

**Edge case:** `burrowed` units are excluded from targeting [CombatSystem.ts:228] AND from being hit by `hitUnit` [CombatSystem.ts:244]. A burrowed unit is effectively immune until it surfaces.

## Poise and knockback

Source: [CombatSystem.ts:269-288], [Unit.ts:288] (recovery).

- Poise accumulator (`u.poiseAccum`) starts at 0.
- Recovery: 10 per second, every frame, in `Unit.update()` [Unit.ts:288].
- Accumulated per hit only for types `'melee'`, `'ranged'`, or `'aoe'` [CombatSystem.ts:270]. DOTs (`poison`, `burn`), `heal`, and `blocked` do NOT accumulate poise.
- Formula: `force = (attacker.knockForce ?? dmg) - target.knockResist` [CombatSystem.ts:272].
  - If `attacker.knockForce` is undefined (the common case), the damage amount is used as the force.
  - If `knockForce === 100` (Bashguard), every hit fills the poise bar to 100 minus target resistance — near-instant stagger.
- Stagger trigger: `poiseAccum >= 100` → reset to 0, compute knockback distance [CombatSystem.ts:275-286].
  - Knockback distance = `142 + overflow * 0.71` where `overflow = poiseAccum - 100` at the moment of stagger.
  - Applied as `u.knockback = -u.facing * knockDist`.
- Once knocked back, the unit is propelled horizontally. Velocity decays via `knockback *= pow(0.04, dt)` per frame [CombatSystem.ts:75]. While moving, the unit SKIPS all AI and cancels any in-progress foreswing [CombatSystem.ts:77-80].
- Deactivation threshold: `Math.abs(knockback) < 5` → set to 0 [CombatSystem.ts:76].

**Gotcha:** knockback stacking is prevented by the `if (Math.abs(u.knockback) < 10)` guard at [CombatSystem.ts:280]. A unit already mid-slide can't be re-knocked, which prevents infinite stagger loops but also means a Bashguard hitting an already-staggered target has its poise wasted.

## Death order and rewards

Source: [CombatSystem.ts:295-314].

1. `takeDamage` sets `dead = true` when `hp <= 0` [Unit.ts:329-331].
2. `hitUnit` detects `u.dead` after damage applied.
3. Particle burst and death sound fire first.
4. `handler.onDeath` fires — the dying unit's hook only. The attacker's hooks are NOT invoked on kill.
5. If `u.side === 'enemy'`, `enemyKilled` event emits → `GameManager` listener awards nectar [GameManager.ts:171-175].
6. The dead unit stays in `GameManager.units` until the next tick's cleanup pass filters it and returns it to the pool [GameManager.ts:237-243].

**Cascading deaths:** if `onDeath` calls `ctx.hitUnit` on other units (e.g. `bombardierCombat.onDeath` explosion [alpha.ts:189-197]), those hits go through the same pipeline synchronously. Each killed enemy emits its own `enemyKilled` event. Ordering is depth-first per the call stack, not per-frame.

**Double-death protection:** `hitUnit` early-returns if `u.dead || u.burrowed` [CombatSystem.ts:244]. Second damage call on an already-dead unit silently no-ops. This guards against double-`onDeath` firing, but the guard is ordering-dependent — if damage paths move, the guard has to move with them. Flagged as tech debt (Finding 1).

## Sound throttling

`_playHitSound` throttles at 80ms global and 500ms for heal [CombatSystem.ts:317-332]. Type mapping:
- `heal` → `audio.heal()` (separate throttle)
- `aoe` → `audio.aoeHit()`
- `ranged` → `audio.rangedShot()`
- everything else → `audio.meleeHit()`

## What this doc intentionally does NOT cover

- Unit balance numbers (stats, costs, caps) — see `units/normal.ts`, `units/alpha.ts`
- Trait descriptions — see `units/CLAUDE.md`
- Counter matrix design — see Item 2 in `MECHANICS_ROADMAP.md` (not designed yet)
- Refactoring recommendations — out of scope; this is a reference, not a review

## Tech debt surfaced during Item 3 audit

Full list with file:line refs in `MECHANICS_ROADMAP.md` tech debt section. Summary:
- **Finding 1:** Double-death fragility, ordering-dependent [`CombatSystem.ts:244, 295`]
- **Finding 2:** `afterHit` fires for `onAttack` units (contract violation, see note above)
- **Finding 4:** Ravager `atkRate` mutated every frame [`alpha.ts:240-247`] — intended behavior, inefficient
- **Finding 6:** `unitDied` event declared but never emitted [`EventBus.ts`]
- **Finding 7:** Mendwing `healTimer` accumulation style inconsistent [`normal.ts:320`]
- **Finding 8:** `doAttack()` on Unit is dead code [`Unit.ts:322-325`]
- **Finding 9:** Aura loops don't filter `burrowed` allies [`CombatSystem.ts:249-259`]
