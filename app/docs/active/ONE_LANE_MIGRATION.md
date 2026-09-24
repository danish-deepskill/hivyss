# 2-lane → 1-lane migration — exhaustive dependency map (2026-06-15)

> **Status:** AUDIT COMPLETE (3 cross-validated read-only passes). No code changed yet.
> Built for a clean migration that leaves **zero orphaned code** (user's explicit bar).
> **Policy:** remove battle-lane fields/params **entirely** — never leave them defaulted-but-unused.

---

## The one thing to never get wrong: two systems share the "lane" name

- **ROUTE system — KEEP (untouched).** `LANE` in `config/Layout.ts` is `Record<Route,{groundY}>`
  keyed by **route** (air/land/tunnel) — `LANE.land.groundY` (=300, imported as `GND` in ~9 files)
  is just the ground line. Plus `ROUTE_MATRIX` + `canAttack`. This is the air/land/tunnel **strata**
  foundation — it *survives*, and it's what the future Shift=tunnel deploy builds on.
- **BATTLE-LANE 0/1 system — REMOVE.** Everything below. The bilateral north/south split.

`getGroundY(route, lane)` is the bridge: **KEEP the function, SIMPLIFY the signature** →
`getGroundY(route)` returning `LANE[route].groundY` (drop the `(lane-0.5)*LANE_VERTICAL_SPAN` offset).

---

## REMOVE — battle-lane (delete entirely)

### config
- `config/Layout.ts` — `LANE_VERTICAL_SPAN`, `LANE_DEPTH` (+ the 2-lane doc comments)
- `config/RouteMatrix.ts` — `laneFromY()`, `laneDepth()`, `laneDepthLerp()`; the `lane` param + offset in `getGroundY`
- `config/Constants.ts` — `LANE_CROSS_REACH`

### types (`types.ts`)
- `IUnit.lane`, `IUnit._laneVisual`, `IUnit._laneTarget`
- `PheromoneZone.lane` · `OrderResolution.crossing` · `Bloom.lane` · `CorpsePickup.lane`
- `Chamber.lane` · `HatchedUnit.lane` · `Placement.lane` (SandboxPresets) · `GameEvents.unitDied.lane`
- Tower `lane` (see Tower decision)

### entities
- `entities/Unit.ts` — `lane`/`_laneVisual`/`_laneTarget` fields; ctor + `init()` `lane` param;
  **the lane-switch slide block in `update()` (~L404–419)**; `laneDepth`/`laneDepthLerp` calls (L358, 415);
  simplify the `getGroundY` shadow calls (L361, 593)
- `entities/structures/Tower.ts` — `lane` field, `coversLane()` (L42–44), lane-from-`placement` (L34–36)
- `entities/structures/StructureEntity.ts` — `lane` field + ctor param (L43, 46, 54)

### systems
- `CombatSystem.ts` — every same-lane filter: death-bomb (L200), buff (L281), sacrifice (L309),
  targeting (L475), multi-hit (L578, 598), zone membership (L802), deathfeed (L999), cohesion;
  tower lane-gate (L868); pheromone-trail `lane` (L769); `unitDied` emit `lane` (L1011)
- `Targeting.ts` — lane-equality filters (L221, 253); rename/clarify `laneDistance` (it's already X-only)
- `CombatPhases.ts` — AOE-rider same-lane filter (L137)
- `CombatDispatch.ts` — `dispatchSpawn(...lane)` (L109–110)
- `BattleCore.ts` — spawn-dispatcher `lane`; `createUnit(...lane)` + `setDepth(UNIT_DEPTH_BASE + lane)` → drop `+lane`;
  `spawnCourier(...lane)`; **⚠ `scout.lane = kind` (L93) — looks like the field is abused to carry the
  pheromone kind; untangle, don't just delete**
- `GameManager.ts` — `_enemyLaneCursor` round-robin (L89, 382–384); `playerSpawn(...lane)` (L333);
  `castPheromone(...lane)` (L409); hatch lane (L248); forage bloom lane-penalty (L468, 472);
  `commandFieldClick(worldX, lane)` (L458)
- `RoyalControl.ts` — `crossing` detection + the `crossing` return field (L48–69)
- `RoyalLifecycle.ts` — `commandClick(worldX, lane)` lane-select; `r._laneTarget = lane` (L141)
- `Towers.ts` — `coversLane(u.lane)` gate (L77); StructureEntity lane (L41)
- `Forage.ts` — `Bloom.lane`/`CorpsePickup.lane` fields; `rollLane()`; `spawnBloom(...lane)`;
  gatherer `_laneTarget = c.lane/bloom.lane` (L186, 205)
- `PassiveHandlers.ts` — cohesion same-lane filter (L213); spawner-passive `u.lane` (L255)
- `EventBus.ts` — `unitDied.lane` (L9)
- `IncubationManager.ts` — `Chamber.lane`, `HatchedUnit.lane`, `queue(...lane)` (L8, 14, 40, 44, 91)
- `UnitPool.ts` — `spawn(...lane)` → `init` (L37)
- `SandboxPresets.ts` — `Placement.lane?` (L16)

### scenes / UI
- `SandboxScene.ts` — `LANE_MIDLINE_Y` (L9), `laneForY()` (L408–411), lane-depth ghost (L455),
  placement lane (L533), lane-depth visuals (L720–729); simplify `getGroundY` calls (L650, 705)
- `WorldScene.ts` — `laneFromY` import + use (L8, 187); deploy/pheromone events carry `lane` (L99, 122);
  simplify `getGroundY('land', r.lane)` ×5 (L310–350)
- `MenuUIScene.ts` — **the big UI artifact:** `activeLane` (L65–68), Tab toggle (L132), Shift-other-lane
  (L137), ▲/▼ indicators (L582–590), deploy/pheromone events `lane` (L434, 473), `setActiveLane` (L558)
  → **repurpose per the Shift=tunnel decision (see below), Tab removed**
- `BiomeBackground.ts` — underground 2-strata render (tunnel lane 0/1 → single) (L30–45)
- `PheromoneTrail.ts` — zone `lane` (L17)
- `draws/towers/spire.ts` — far/near/middle comment (cosmetic; reword)

### tests
- `test/systems/Targeting.test.ts`, `test/systems/CombatSystem.test.ts` — no hard 2-lane *assertions*
  found, but `createUnit`/spawn signatures change → fix any `lane` args. Verify on the gate.

---

## SIMPLIFY — `getGroundY(route, lane)` → `getGroundY(route)`
Drop the param + offset in `RouteMatrix.ts`, then fix every callsite (Unit, WorldScene ×5, SandboxScene,
PheromoneTrail, BiomeBackground, Forage). `BattleCore.createUnit` depth `+lane` → constant.

## KEEP — route system (do NOT touch)
`LANE` (route→groundY) · `ROUTE_MATRIX` · `canAttack` · `LANE.land.groundY`/`GND` in
BaseStructure, LarvaVisuals, AbilityManager, WaveManager, AIHiveController, CombatSystem,
SandboxScene, HUDScene, MainMenuScene · `getGroundY(route)` (post-simplify).

---

## DECISIONS — ALL RESOLVED (2026-06-15)

1. **Freed controls:** **no Tab.** Repurpose **Shift = deploy onto the TUNNEL stratum** (Shift+deploy →
   tunnel route; normal deploy → land). Deploy/pheromone UI events stop carrying `lane: number` and (in
   Phase 2) carry `route: Route` (`shiftKey ? 'tunnel' : 'land'`). *First seed of the 1-lane × strata model.*
2. **Scope → SPLIT.** **Phase 1 = pure battle-lane *deletion*** (drive to tsc-clean + tests-green;
   deploy/pheromone go to **land only**, `lane` removed, NO `route` param yet). **Phase 2 = wire the
   Shift=tunnel strata-deploy** as its own feature pass (adds `route`). Deletion stays a deletion.
3. **Towers → COLLAPSE.** Delete `placement`, `lane`, `coversLane()`, `crossLaneFire`. Towers sit at their
   X and fire at any enemy in range. Keep hp/range/damage/fireInterval + variant/draw. Strata coverage, if
   ever needed, is added purpose-built later (route/stratum), NOT a repurposed lane-coverage placeholder.
4. **Royal → MOVE-ONLY.** Delete the cross-lane switch (`_laneTarget`/`_laneVisual`/`crossing`); she moves
   left/right along the single line. Strata-movement (surface/tunnel) is Phase-2+.
5. **`scout.lane` → NORMAL REMOVAL (agent misread).** Verified: real code is `spawnCourier(...lane)` (a
   standard spawn param) + a properly-named `scout.pheromoneKind = kind`. Drop `lane` like every other
   removal; `pheromoneKind` is untouched. No untangling.

**Global policy:** remove every battle-lane field/param/event-key **entirely** at the source — no
defaulted-but-unused leftovers anywhere.

---

## Edit order (deletion phase)
1. `Layout.ts` (drop `LANE_VERTICAL_SPAN`, `LANE_DEPTH`) → `RouteMatrix.ts` (simplify `getGroundY`, drop
   `laneFromY/laneDepth/laneDepthLerp`) → `Constants.ts` (drop `LANE_CROSS_REACH`).
2. `types.ts` — drop all battle-lane fields. **+ `EventBus.ts`** (drop `unitDied.lane` event key).
3. `Unit.ts` — fields + `update()` slide block + ctor/init; fix `getGroundY` calls.
   → **NOW run `tsc --noEmit` — NOT to pass, but to get the COMPLETE error list of every broken
   consumer. That list drives steps 4–9; the audit (REMOVE inventory above) is the map, tsc is the
   verifier. When tsc goes clean, no typed reference was missed. (tsc catches `(x as IUnit).lane` casts;
   it does NOT catch `any`-typed access — the inventory covers those, so don't skip it.)**
4. Combat: `CombatSystem`, `Targeting`, `CombatPhases`, `PassiveHandlers` — drop same-lane filters.
5. Spawn chain: `BattleCore`, `CombatDispatch`, `GameManager`, `UnitPool`, `IncubationManager`,
   `RoyalLifecycle` — drop `lane` threading (`scout.lane` = normal removal, leave `pheromoneKind`).
6. Royal: `RoyalControl` (crossing), `RoyalLifecycle` (lane-select). *(RoyalLifecycle spans 5+6 — both.)*
7. Forage, Towers/Tower/StructureEntity.
8. Scenes/UI: `SandboxScene`, **`SandboxPresets.ts`** (drop `Placement.lane?`), `WorldScene`,
   `MenuUIScene` (Tab out, no `route` yet — land only), `BiomeBackground`, `PheromoneTrail`, `spire.ts` comment.
9. Tests — fix signatures; DELETE any 2-lane-specific tests (don't skip them).
10. **Gate:** `tsc --noEmit` clean + `vitest run` green (expect ≤654; some 2-lane tests may drop).

> Build stays RED from step 1 until ~step 9 — atomic deletion, no green checkpoint mid-way; gate only at the end.

> Completeness check: 46 src files + 2 test files swept, three independent passes agreed. The only
> non-mechanical items are the 5 decisions above.
