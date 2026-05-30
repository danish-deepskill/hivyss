# Hivyss — Claude Code Context

## Required Reading
- `app/docs/reference/DESIGN_PATTERNS.md` — All implemented and planned design patterns. Read before modifying architecture.
- `app/docs/reference/GAME_DESIGN.md` — Future game mechanics (castes, routes, evolution, mutation, roguelike structure). Read before designing new features.
- `app/docs/reference/UI_ARCHITECTURE.md` — Scene management, 4-layer rendering, canvas UI layout. Read before modifying scenes or UI.
- `app/src/units/CLAUDE.md` — Unit file structure, data-driven unit behavior fields, draw function conventions.

## Docs Layout (`app/docs/`)
- `reference/` — stable contracts read while working (DESIGN_PATTERNS, COMBAT_REFERENCE, TIER_CONTRACT, UI_ARCHITECTURE, SPRITE_STYLE, ABILITY_TEST_CASES, GAME_DESIGN)
- `active/` — live program tracking (MECHANICS_ROADMAP, UNIT_LIFECYCLE_*, AI_PLAN, CAPACITY_DESIGN)
- `process/` — orchestrator meta (ORCHESTRATOR_RESUME, ORCHESTRATOR_TEMPLATE)
- `archive/` — completed programs, content historically accurate (COMBAT_REWRITE_*, SANDBOX_OVERHAUL_DESIGN, COMBAT_EXECUTOR_GUIDE)

## Tech Stack
- Phaser 3.90, Canvas renderer (not WebGL)
- TypeScript, Vite 5.4
- Procedural Graphics API drawing (no sprites/textures)
- DOM-based UI alongside canvas visuals

## Key Architecture Decisions
- Units are data-driven (`UnitDef`) with procedural draw functions, not sprites
- Unit behavior is data-driven via `UnitDef` fields (`defaultAbility`, `deathAbility`, `auraModifier`, `selfModifier`, `passiveHeal`) — no class inheritance, no hook interfaces. See `app/src/units/CLAUDE.md` for the full field list.
- Cross-system events go through typed `EventBus`, not Phaser `scene.events`
- Units are pooled via `UnitPool` — never `new Unit()` or `destroy()` in gameplay code
- Game logic lives in `systems/` managers, not in Scene classes
- Currency is "nectar" everywhere (code and UI)
- Units are called "vyssids" in lore, "units" in code

## Phaser Graphics API
- Valid: `fillEllipse()`, `strokeEllipse()`, `fillCircle()`, `arc()`, `fillRect()`, `lineBetween()`
- NOT valid: `ellipse()`, `quadraticCurveTo()` — these do not exist on Phaser.GameObjects.Graphics

## Future Plans
- 24 genelines (Greek letters: alpha through omega), each with multiple vyssids (100+ total units)
- Mutation mechanic — will need Comp System pattern
- When second geneline starts, restructure `units/` into `units/<geneline>/` subfolders
