# Sandbox Overhaul — Design Doc

> **Status:** CLOSED 2026-04-19. Phase 0 + Phase 1 + Phase 1.5 (A, B, C-1, C-2) all shipped with live smoke passes (sandbox + production). Phase 2 (presets) deferred pending playtest feedback. Phase 3 polish backlog filed (DOM migration for SandboxHUDScene, tab symbols `α` / `n`, stat tooltips, keyboard shortcuts, tier picker, shift-click lane override, scenario-engine replacements if ever needed).
> **Purpose:** Lock scope + UI + data model for a TABS-inspired sandbox rebuild.
> **Replaces:** current 2-unit-type cycle-and-count sandbox in `app/src/scenes/SandboxScene.ts`.

---

## Problem statement

Current sandbox is too limited for meaningful combat testing:

- **Only ONE unit type per side.** Can't test mixed compositions (e.g., "2 Grub + 1 Cinderfly" vs "Bashguard + Mendwing").
- **Only integer counts 1-10.** No position control — units always cluster at lane edges.
- **No save/load.** Re-creating a specific test setup requires manual cycling every session.
- **Scenario engine hidden.** Rich phase8 scenarios exist but live in `/scenarios` dev command, invisible from UI.
- **Mirrors production UI mismatch.** Sandbox is 1.0× while runs are 1.5× — tactical framing differs.

Result: sandbox is fast for mirror-matchup tests but unusable for actual composition / tactical scenario testing. Combat work that needs richer setups goes straight to playtest (slow) or phase8 scenarios (dev-console-only).

## Reference

**Totally Accurate Battle Simulator (TABS)** sandbox is the genre gold standard. Key patterns adopted:

- Unit roster panel with thumbnails
- Click-to-place with ghost cursor
- Mixed compositions per side
- Right-click delete
- Save/load custom placements

Not adopted (3D features irrelevant to 2D lane TD):
- Free-orbit camera (Hivyss stays side-view)
- 3D placement (Hivyss stays 2D + lane-constrained)
- Slow-motion scrubber (defer — lane combat is observable at normal speed)

---

## UI layout

```
┌──────────────────────────────────────────────────────────────┐
│ [◀ BACK]   SANDBOX — CLICK UNIT TO PLACE   [FIGHT] [RESET]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                  BATTLEFIELD                                 │
│  [player hive]  [placed units on lanes]  [enemy hive]        │
│                                                              │
│  Click in battlefield to place selected unit                 │
│  Right-click placed unit to remove                           │
│  Lanes: air (y=240) / land (y=380) / tunnel (y=410)          │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ SIDE: [●PLAYER] [○ENEMY]        PRESETS: [Mirror 3v3 ▾]     │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ ROSTER                                                │    │
│ │ [Grub] [Hardshell] [Pricker] [Skitterling] [Mendwing] │    │
│ │ [Domeback] [Cinderfly] [Longeye] [Wardling] [Bashguard]│   │
│ │ [Stormfly] [Grunt] [Mandible] [Needler] [Bombardier]  │    │
│ │ [Legionnaire] [Ravager] [Centurion]                   │    │
│ └──────────────────────────────────────────────────────┘    │
│ Selected: Grub              — Escape to deselect             │
└──────────────────────────────────────────────────────────────┘
```

Sections:
- **Top bar**: Back button, title, FIGHT + RESET (primary action buttons stay top-right where they are today)
- **Battlefield** (middle ~70% of screen): existing side-view with hives. Placement happens here.
- **Control panel** (bottom): side toggle, preset dropdown, roster grid, selected-unit indicator

---

## Core interactions

### Placement flow

1. Click a unit thumbnail in ROSTER → unit becomes **selected**, cursor enters **place mode**
2. Mouse over battlefield → cursor shows ghost preview of selected unit at pointer position
3. Click in battlefield (on your side) → unit spawns at that x, on lane Y auto-resolved from unit's `route` field
4. Cursor remains in place mode — click again to place another of same unit
5. Click a different thumbnail → selected unit changes, ghost updates
6. Press **Escape** OR click selected thumbnail again → deselect, cursor returns to default

### Side control

- **Explicit toggle button** at top of control panel: `[●PLAYER] [○ENEMY]`
- Placements always go to the active side
- Enemy-side placements auto-color-shift via existing `toEnemyColor`/`toEnemyDark`
- Ghost preview also color-shifts to indicate side

### Deletion

- **Right-click** on a placed unit → removes it
- Left-click on a placed unit → if in place mode, places a new unit on top (ignore overlap); if not, no-op
- Rationale: right-click is unambiguous, avoids conflict with placement

### Placement constraints

- Must be within current side's half of the battlefield (X constraint by active side)
- Y is auto-resolved from unit's `route` — player cannot choose lane
- Units without a route field default to `'land'`
- Cannot place on top of the hive structures (X-bounded exclusion zone)

### Fight controls

- **FIGHT** — starts simulation. Placements become live Units. Combat proceeds.
- **RESET** — kills all units, restores bases to full HP. **Placements are NOT cleared** — returns to pre-fight state. User can press FIGHT again with same setup.
- **CLEAR** (new button, secondary) — removes all placements. Returns to empty battlefield.
- **During fight (`running === true`)**: roster thumbnails, side toggle, CLEAR button, and preset dropdown are all disabled. Only RESET remains active (it implicitly stops the fight). Prevents mid-fight state mutation that would desync placements from live units.

### Presets

Dropdown shows:
- Hardcoded presets (Mirror 3v3 Grub, Tank Duel, Full Roster, etc.) — curated list
- User-saved presets (from localStorage)
- `[Save Current As...]` option at bottom

Selecting a preset:
1. Clears current placements
2. Applies preset's placements
3. Leaves scene in pre-fight state (user must click FIGHT)

Saving a preset:
1. Prompts for name (inline text input or simple prompt())
2. Serializes current `placements[]` to localStorage under key `sandbox_presets`
3. Adds to dropdown

Preset format:
```ts
interface SandboxPreset {
  name: string;
  placements: Placement[];
}
```

---

## Data model

```ts
interface Placement {
  unitKey: string;         // e.g., 'grub', 'bashguard'
  side: 'player' | 'enemy';
  x: number;               // pixel position in logical W×H
  // y derived from UNIT_DEFS[unitKey].route at spawn time
}

// Scene state:
placements: Placement[];              // pre-fight placed units
selectedUnitKey: string | null;       // currently in place mode
activeSide: 'player' | 'enemy';       // toggle state
ghostSprite: Phaser.GameObjects.Image | null;  // cursor preview
running: boolean;                     // fight in progress
savedPresets: SandboxPreset[];        // loaded from localStorage
```

Placement ghost rendering:
- Pre-fight: render placed units as slightly-transparent sprites at their positions. Visual hint that they're placed, not yet live.
- Fight: spawn real Unit instances at each placement's `(x, y)` and side. Ghost visuals destroyed.

---

## Component inventory

### New components

- **`RosterPanel`** — horizontal unit grid, clickable thumbnails, uses existing `_sb_preview_<key>` textures
- **`PlacementGhost`** — Phaser.Image that follows mouse when selected unit is active, color-tinted by active side
- **`SideToggle`** — two-button UI, active side highlighted
- **`PresetDropdown`** — HTML select or Phaser-rendered dropdown with preset list + Save option
- **`PlacementRenderer`** — draws placed units pre-fight as ghost sprites; destroyed on FIGHT

### Refactored / removed

- `cycleUnit()`, `adjustCount()` — **removed** (replaced by click-to-place)
- `buildUI()` — **rewritten** for new layout
- `resetArena()` — **rewritten** to spawn from `placements[]` instead of fixed `leftCount`/`rightCount`
- `leftKey`/`rightKey`/`leftCount`/`rightCount` fields — **removed** (replaced by `placements[]`)
- `leftIcon`/`leftLabel`/etc. UI elements — **removed**
- `toEnemyColor()`, `toEnemyDark()` — **removed** (replaced by production's `ENEMY_DEFS` / `darken()` approach — see Legacy Cleanup below)
- `registerPhase8Scenarios()` import + call — **removed** (phase8Scenarios.ts deleted in pre-batch — see Legacy Cleanup below)

### Preserved

- Base structures (`playerBaseStructure`/`enemyBaseStructure`) + base entities — unchanged
- HP bars above bases — unchanged
- Combat system integration — unchanged
- Preview texture generation (`generatePreviews`) — unchanged, still needed for thumbnails + ghost
- Result text / stats text — unchanged
- Scenario engine hooks (`scenarioSpawn`, `scenarioClear`, `scenarioStartFight`) — unchanged, preserved for `/scenarios` dev command

**Load-bearing details that must survive the rewrite** (easy to miss when deleting "old UI junk"):
- `resetUid()` call in `create()` and on any spawn-reset path — prevents cross-run unit-ID leakage.
- `CombatSystem` constructed with `W` as worldW (not default 2560) — aligns in-system wall checks to the visible sandbox arena. Without it, player units chase an invisible wall past the right edge and the `BaseEntity` is never reached.
- `resetBases()` must wipe `activeEffects = []` on both base entities, not just reset HP — bases accumulate DOT (e.g., Cinderfly burn) across runs otherwise. Both RESET and CLEAR must call it.
- `this.elapsed` timer increments in `update()` while `running` — drives result-text fight duration and scenario-engine timing.
- `HpHud.attachSource` / `ScenarioEngine.attachSandbox` paired with `events.once('shutdown', ...)` detach — breaks debug tooling if the shutdown unsubscribe is dropped.

---

## Implementation phases

### Phase 0 — Legacy cleanup (micro-batch, pre-overhaul)

**Separate from the main overhaul.** Ship this first — small, standalone, reduces scope for Phase 1. Risk upgraded from Trivial → **Low-Medium** on review: three test files reference `phase8Scenarios` and not all of them are scenario-only glue. Executor must triage per-file, not blanket-delete.

Deliverables:
- Delete `app/src/debug/phase8Scenarios.ts` (self-documented as dead code per Phase 8/9+ lifecycle rule).
- Remove `registerPhase8Scenarios` import and call from `SandboxScene.ts` (import at line 16, call at line 126 of current impl).
- Triage the three test files that reference `phase8Scenarios`:
  - `app/test/debug/phase8Scenarios.test.ts` — scenario-only, delete.
  - `app/test/systems/CombatSystem.phase8.test.ts` — phase-NAMED, not necessarily phase-scoped. Read first. If it tests still-relevant `CombatSystem` behavior (predicates, hit ordering, selector resolution) that merely uses phase8 fixtures, **retain and rename** to drop the `phase8` suffix. If pure scenario glue, delete.
  - `app/test/systems/PassivePredicates.test.ts` — name suggests load-bearing predicate tests. **Default: retain.** Only delete if every test case exclusively references phase8 scenario fixtures with no standalone assertions.
- Stop-and-report trigger: if any production (non-debug, non-test) code imports `phase8Scenarios` beyond `SandboxScene.ts`, or if the test suite fails after deletions for reasons unrelated to the deleted scenarios — stop, escalate.

Exit criteria:
- `phase8Scenarios.ts` no longer exists.
- Grep for `phase8Scenarios` in `app/src/` and `app/test/` returns zero hits. Doc-only references in `COMBAT_REWRITE_PHASE8_DECISIONS.md` / `COMBAT_REWRITE_PHASE9_CLEANUP.md` are historical and acceptable.
- Full test suite passes.
- `tsc` clean.
- Sandbox scene loads; typing `/scenarios list` in the dev console returns empty-list without throwing.

Rationale: the file's own header documentation says it should have been deleted when Phase 8 closed (2026-04-17). Shipping this as a pre-batch removes dead code and stops the sandbox overhaul from having to work around its registration.

### Phase 1 — Core placement + enemy color unification (medium batch, ~1-2 executor sessions)

Deliverables:
- Delete old cycle-count UI
- Build roster panel with clickable thumbnails
- Implement click-to-place with ghost cursor
- Implement side toggle
- Implement right-click delete
- Rewire FIGHT to spawn from placements
- RESET preserves placements
- Add CLEAR button for wiping placements
- **Unify enemy coloring** — drop `toEnemyColor`/`toEnemyDark`, use `ENEMY_DEFS['e' + key]` directly when spawning enemy-side units (or import `darken` from `config/EnemyDefs.ts` if a lookup-based approach is awkward for click-to-place timing)

Exit criteria:
- Place any mix of units on either side
- Place ≥2 different unit types on same side
- Right-click removes individual placements
- FIGHT/RESET/CLEAR behave per spec
- Back button returns to main menu
- Enemy-side units render with the same colors they have in actual runs (darkened, not red-shifted)

### Phase 1.5 — Framing refactor + shared architecture (reopening Phase 1, ~3 executor sessions)

**Triggered by Phase 1 live smoke (2026-04-19).** Units unreadable at 1.0×; user confirmed match-run-framing is the fix. Architecture-first pushback also identified DRY violation risk (copying drag/zoom from WorldScene) and premature-flat-roster risk (24-geneline taxonomy committed but not reflected in UI). Bundle all three as one architectural refactor rather than three patches.

Deliverables:
- Extract `ViewportController` (zoom + bounds + drag-scroll + keyboard pan). WorldScene refactors to use it. SandboxScene consumes it.
- Launch `SandboxHUDScene` as sibling. Move top bar + control panel + roster + selectedLabel out of SandboxScene. Cross-scene via `EventBus` (`sandbox.fight`, `sandbox.reset`, `sandbox.clear`, `sandbox.select-unit`, `sandbox.set-side`).
- SandboxScene: `worldW = DEFAULT_WORLD_W = 2560`, camera zoom 1.5×. Placement bounds rescale: player `[HIVE_PAD, worldW/2]`, enemy `[worldW/2, worldW - HIVE_PAD]`. Enemy hive structure moves to `x = worldW - SBW`. HP bars follow their hives.
- Add `geneline: Geneline` field to `UnitDef`. Populate existing defs (alpha.ts → `'alpha'`, normal.ts → `'normal'`). Registry derives `GENELINES` map. Roster UI renders tabs; default active = alpha.
- Enemy preview facing fix: `generateOnePreview` accepts a `facing` param; enemy previews use `facing: -1` so pre-fight ghost matches live-spawn direction.
- Preserve all Phase 1 preservation-checklist items EXCEPT the `CombatSystem` worldW=W override, which is explicitly dropped (decision #18).

Exit criteria:
- `ViewportController` lives at `app/src/systems/ViewportController.ts`. WorldScene uses it. Full test suite passes. Manual real-run smoke shows identical pan/zoom feel to pre-refactor.
- Sandbox battlefield renders at 1.5× zoom, drag-scroll works horizontally. Arena = 2560 world; user can pan across full arena.
- `SandboxHUDScene` launches alongside `SandboxScene`. UI buttons fire EventBus messages; SandboxScene responds. No UI elements left in SandboxScene.
- Roster shows geneline tabs; default = alpha (7 units). "Unclassified" tab shows 11 normal units. Clicking a tab re-renders the roster to that geneline's units.
- Pre-fight enemy placement ghost faces left (toward player), matching live-spawn direction. No flicker on FIGHT.
- `tsc` clean, full test suite green.
- Live smoke: real-run (WorldScene) unchanged in feel + behavior; sandbox feels like a real run with added placement controls.

### Phase 2 — Presets (small batch, ~1 session, optional)

Deliverables:
- Hardcoded preset list (Mirror 3v3, Tank Duel, Full Roster)
- Preset dropdown UI
- Save/load custom presets via localStorage
- "Save Current As..." flow

Exit criteria:
- Dropdown populates from hardcoded + saved
- Selecting preset applies placements
- Saving a current setup persists across page refresh

### Phase 3 — Polish (small, optional, future)

- Stat inspector tooltip on thumbnail hover (HP/atk/range/ability preview)
- Placement count indicator per side ("PLAYER: 3 units / ENEMY: 5 units")
- Keyboard shortcuts (1-9 to select from roster, Del to clear, Enter to FIGHT)
- Expose `phase8Scenarios` as UI-selectable presets

Phase 3 is opportunistic — not tied to any scoped batch. Tackle if time permits after a future sandbox session.

---

## Orchestrator-locked decisions (with rationale)

These are calls I'm making. User can override during review.

1. **Full overhaul, not incremental.** Rationale: click-to-place layered on cycle-count creates two parallel UIs that confuse the user. Clean replacement is clearer.

2. **Old "Quick Mirror" mode preserved AS A PRESET**, not as a separate UI. "Mirror 3v3" is one entry in the preset dropdown. Clicking it populates placements for a quick mirror test. Takes ~2 clicks vs. 4 clicks in old UI — minor speed cost for massive flexibility gain.

3. **~~Explicit side toggle button~~** **SUPERSEDED by decision #25 (auto-side) 2026-04-19.** Original rationale valued visible toggle over hidden shift-click. Live smoke showed the toggle is redundant when side can be derived unambiguously from pointer-X half (TABS-style). Auto-side is DRYer (no redundant activeSide state) and KISSer (one fewer UI control) without losing clarity — battlefield ghost color still signals which side the click will spawn to.

4. **Right-click delete only.** Rationale: left-click always places (consistent). Right-click for remove is standard. No delete-mode toggle needed.

5. **Lane Y auto-resolved from unit's `route` field. No override in Phase 1.** Rationale: players shouldn't have to remember which lane each unit belongs on. Skitterling always land, Longeye always land, air units always air lane. Simplifies placement UX. A shift-click lane-override was considered and **deferred without commitment** — it's not just a Y-position tweak. Hivyss lane semantics are coupled to movement, targeting, and route-matrix filtering, so forcing a land unit onto the air lane opens the question of non-native-lane behavior (walk through the sky? fly at ground level?). `scenarioSpawn(key, side, x)` already covers unusual-placement debug needs. Revisit only if playtest or a specific combat test demands UI-level override. Not locked as Phase 3 scope.

6. **RESET preserves placements, new CLEAR button wipes them.** Rationale: common workflow is "fight, reset to same setup, fight again." RESET should not lose setup. CLEAR is the explicit "wipe and start over."

7. **~~Active side constraint on placement X.~~** **COLLAPSED INTO decision #25 (auto-side) 2026-04-19.** Under auto-side, the pointer-X half IS the side — there's no separate "active side" to constrain against. Placement invalidity reduces to hive exclusion only (inside `[0, HIVE_PAD]` or `[worldW - HIVE_PAD, worldW]`). The red-tint + outline ghost feedback from decision #13 is all that's needed.

8. **Mouse/keyboard only.** Controller/touch support is out of scope. Hivyss is desktop-first.

9. **~~1.0× zoom stays (do not apply 1.5×).~~** **OVERRIDDEN 2026-04-19 — see decision #18.** Original rationale held that whole-arena visibility beat cinematic framing for debug. Live smoke on Phase 1 showed sprites too small to read at 1.0× — observability was worse, not better. Reopened.

10. **Placements spawn at the unit's default `tier` only — no tier picker in Phase 1.** Rationale: 18 units × 11 tiers = 198 thumbnails would explode the roster UI with no visual distinction between tiers of the same unit (tier affects numbers only, not sprite or behavior). The utility-to-UX ratio is bad at the roster layer. Tier testing stays code-only via the scenario engine where tiered spawn parameters belong. A per-placement tier picker is **filed as a Phase 3 stretch** — revisit only if tier mixing becomes a recurring sandbox workflow in practice.

---

## Out of scope (committed)

- Mobile touch / controller support
- Multi-select / drag-rect for placed units
- Slow-motion or time scrubbing
- 3D camera or perspective modes
- AI-driven enemy side (both sides remain human-placed)
- Per-unit stat overrides in UI (hp, atk adjustment — keep as code-only for debug)
- Scenario engine full UI integration (Phase 3 stretch, not Phase 1 or 2)
- Saving named battles beyond the localStorage preset system
- Real-time battle replay / history

---

## Additional locked decisions (from review, 2026-04-19)

11. **Preset dropdown: HTML `<select>`, not Phaser-native.** Rationale: less engineering work, platform-native keyboard/a11y, fits existing DOM usage in MenuUIScene / ModalScene. If future styling demands Phaser-native, revisit.

12. **Place-mode cursor feedback: ghost sprite alone for v1.** No cross-hair, no lane-highlight, no tint. Rationale: simpler implementation, validate UX before adding chrome. If playtest shows user confusion about "where will this land," add richer feedback as polish.

13. **Hive overlap: reject with visual feedback.** Placing inside the hive exclusion zone shows a red-tinted ghost and no placement fires. Rationale: clearer UX than silent reject or allow-and-hide. Exclusion zone defined as `x < SBW` (player) or `x > W - SBW` (enemy).

14. **~~Sandbox zoom: 1.0× locked.~~** **OVERRIDDEN 2026-04-19 — see decision #18.** Same reason as #9 override: live smoke showed 1.0× reads as "tiny units, can't see combat clearly." The intentional-divergence framing was wrong; debug needs to match run framing to transfer tuning decisions cleanly.

15. **Placement cap: unlimited.** No per-side count limit. If a user crashes the game at 500 units, that's a separate perf issue to address then. Sandbox should let the user stress-test freely.

16. **Persistence across scene restart: no.** Placements reset on scene restart (returning via main menu). Saved presets via localStorage cover explicit save/load. Rationale: fresh sandbox each session matches "it's a debug tool" mental model.

17. **Phase 1 + Phase 2 sequenced, not bundled.** Ship Phase 1 standalone, evaluate actual usage, then decide on Phase 2 scope. Keeps batches reviewable and avoids over-scoping speculatively.

18. **Sandbox matches run framing (overrides #9 + #14).** Zoom 1.5×, horizontal drag-scroll, worldW expanded to `DEFAULT_WORLD_W = 2560`. CombatSystem constructed with worldW=2560 — the previous "worldW=W sandbox arena" preservation item is explicitly dropped. Rationale: debug observability demands sprites big enough to read; tuning decisions should transfer 1:1 from sandbox to playtest. Drag-scroll mirrors WorldScene's pattern exactly (pointer-down records startX, pointer-move scrolls, 5px deadzone disambiguates click vs. drag).

19. **SandboxHUDScene sibling scene.** Top bar (BACK / CLEAR / FIGHT / RESET / title), control panel (side toggle, roster, selected indicator, geneline tabs) all live in a separate `SandboxHUDScene` launched alongside `SandboxScene`. Matches WorldScene + HUDScene pattern. SandboxScene becomes game-world-only (background, bases, HP bars, units, placement/ghost sprites, result text). Cross-scene communication via `EventBus` with `sandbox.*` events. Rationale: DRY with production, UI stays 1.0× while game world zooms 1.5×, no in-scene dual-camera fiddliness.

20. **Geneline-tabbed roster with `UnitDef.geneline` field.** Add `geneline: Geneline` to `UnitDef` (type `Geneline = 'alpha' | 'normal' | 'beta' | ... | 'omega'`). Registry auto-derives `GENELINES: Record<Geneline, string[]>` from `UNIT_DEFS` — no manual roster-tab list to maintain. Roster UI renders one tab per populated geneline; tabs for unpopulated genelines don't appear. Default active tab: alpha. "Normal" ships as a temporary geneline tab labeled "UNCLASSIFIED" until units migrate to their proper genelines. Rationale: architecture-first for the already-committed 24-geneline taxonomy (per CLAUDE.md + project memory); zero retrofit cost when geneline count grows.

21. **ViewportController extracted as shared primitive.** New `app/src/systems/ViewportController.ts` class owns camera zoom + bounds + drag-scroll state + keyboard pan. Scene calls `new ViewportController(scene).attach({ zoom, worldW, panSpeed })` + `update(dt)`. WorldScene refactors to use it (production is touched in this batch — risk mitigated by pre/post test pass + manual smoke on a real run). SandboxScene consumes the same primitive. Rationale: DRY/SOLID/KISS — one implementation of pan/zoom instead of two, future pan features (edge-scroll, minimap, zoom toggle) extend both scenes by editing one file.

22. **Remove scenarioEngine entirely.** Delete `app/src/debug/scenarioEngine.ts`, `ScenarioEngine.attachSandbox/detachSandbox` calls, and `scenarioSpawn / scenarioClear / scenarioStartFight` methods from SandboxScene. Rationale: zero live scenarios registered post-Phase-0, and the new sandbox covers the use case (click-to-place + FIGHT gives the same scripted-setup workflow with better UX). KISS — dead code accumulates if left. Presets (Phase 2) cover future scripting needs.

23. **Result text shows elapsed time only (no survivors or HP stats).** Drop "X survived | Y/Z HP" from the post-fight display. Keep the main result message ("PLAYER WINS!") and a minimal gray time line ("12.4s"). Rationale: survivors + HP are visible in the real-time render; time is the only stat the user can't visually count themselves and is useful for comparing matchup durations.

24. **Edge-pan disabled in sandbox (`edgeZone: 0`).** Mouse hover near the right edge triggered edge-pan when the user tried to click the RESET button — annoying. WorldScene keeps default edgeZone=200 (no UI at the viewport edges there). ViewportController's existing `edgeZone` option covers this without API change.

25. **Auto-side placement (TABS-style).** Side derives from `pointer.worldX < DEFAULT_WORLD_W / 2 ? 'player' : 'enemy'` at ghost-render-time and at placement-click-time. Remove the explicit PLAYER/ENEMY toggle button + the `activeSide` state field + the `sandboxSetSide` event. Ghost tint updates per-frame based on pointer half; placement uses the derived side. Roster thumbnails always show player-tint (inventory-style, no "active side" to mirror). Supersedes decisions #3 and #7. Rationale: DRY/KISS — one fewer UI control, one fewer state variable, side is implicit from where you click.

26. **Geneline tabs placed ABOVE the roster in the control panel.** Adds ~25px to the panel height. Tabs only appear for populated genelines (currently `alpha` + `normal`); tab ordering follows `Geneline` type declaration order. Clicking a tab filters the roster grid to that geneline's units. Rationale: vertical space is cheaper than horizontal for the long-term goal of 24 populated genelines with 100+ total units; matches standard inventory-tab UX.

---

## Risk / cost summary

| Category | Phase 0 | Phase 1 | Phase 1.5 (A+B+C1+C2) | Phase 2 | Total |
|---|---|---|---|---|---|
| Scope | ~20 LOC deletion + test triage | ~700-1000 LOC | ~800-1200 LOC + WorldScene refactor + scenarioEngine removal | ~200 LOC | ~1700-2400 LOC |
| Executor sessions | 0.1-0.3 (micro) | 2 (shipped) | 4 (A+B shipped; C1+C2 pending) | 1 | ~7 |
| Risk | Low-Medium (test-file fallout) | Medium (UX overhaul, new patterns) | **Medium-High** for A+B (WorldScene refactor, worldW change); **Low** for C1 (reductions); **Medium** for C2 (HUD restructure + geneline data model) | Low (localStorage + dropdown) | — |
| Reversibility | High (git revert) | High (sandbox is debug tool) | Medium (WorldScene diff needs manual smoke to approve) | High | — |
| Blockers | None | Phase 0 complete | Phase 1 shipped | Phase 1.5 complete | — |

---

## Related docs

- `app/src/scenes/SandboxScene.ts` — current implementation
- `app/docs/DESIGN_PATTERNS.md` §5 — Unit Pool exception for sandbox (preserved)
- `app/docs/MECHANICS_ROADMAP.md` — not affected; sandbox overhaul is infrastructure, not roadmap work
- `app/src/debug/phase8Scenarios.ts` — existing scenario engine, preserved as-is
- `app/src/debug/scenarioEngine.ts` — scenario engine hooks, preserved as-is

---

## Next steps (if locked)

1. User reviews this doc, overrides any decisions in "Orchestrator-locked" or "Open questions"
2. Orchestrator drafts Phase 1 executor handoff based on locked decisions
3. Executor ships Phase 1
4. Orchestrator reviews, smoke tests, approves
5. Decide on Phase 2 based on Phase 1 experience

Until user confirms, nothing is committed. This is review material only.
