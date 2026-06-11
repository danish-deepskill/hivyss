# Hivyss — Claude Code Context

## Required Reading
- `app/docs/reference/DESIGN_PATTERNS.md` — All implemented and planned design patterns. Read before modifying architecture.
- `app/docs/reference/GAME_DESIGN.md` — Future game mechanics (castes, routes, evolution, mutation, roguelike structure). Read before designing new features.
- `app/docs/reference/UI_ARCHITECTURE.md` — Scene management, 4-layer rendering, canvas UI layout. Read before modifying scenes or UI.
- `app/src/units/CLAUDE.md` — Unit file structure, data-driven unit behavior fields, draw function conventions.

## Docs Layout (`app/docs/`)
- `mvp/` — **all MVP design + scope in one folder; start at `README.md`.** `VISION.md` is authoritative (vision · scope · loop · build order); then GENELINES, REQUIREMENTS, ALPHA, MECHANICS_INVENTORY, PHASE0_BUILD. Read this for any MVP work.
- `reference/` — stable contracts read while working (DESIGN_PATTERNS, COMBAT_REFERENCE, TIER_CONTRACT, UI_ARCHITECTURE, SPRITE_STYLE, ABILITY_TEST_CASES, GAME_DESIGN)
- `active/` — live program tracking (MECHANICS_ROADMAP, UNIT_LIFECYCLE_*, AI_PLAN, CAPACITY_DESIGN, FX_SYSTEM, UNIT_ANIMATION_SYSTEM, SESSION_HANDOFF)
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
- Two currencies (amended 2026-06-11): **nectar** = the macro currency (units, workers, tech), earned by forage gatherers + a +1/s floor (`Forage`/`ForageDefs`); **vyss** = the battle-scoped tactical currency (pheromones + hive abilities) — the essence of fallen vyssids: deaths drop corpse pickups, gatherers scavenge them home into vyss (`VyssEconomy`/`VyssDefs`). Vyss never buys UNITS; the one tech exception is hive MATURATION (a bounded twice-per-battle sink — the hive grows by consuming the fallen), so teching requires engaging the war.
- Units are called "vyssids" in lore, "units" in code

## Phaser Graphics API
- Valid: `fillEllipse()`, `strokeEllipse()`, `fillCircle()`, `arc()`, `fillRect()`, `lineBetween()`
- NOT valid: `ellipse()`, `quadraticCurveTo()` — these do not exist on Phaser.GameObjects.Graphics

## Future Plans
- 24 genelines (Greek letters: alpha through omega), each with multiple vyssids (100+ total units)
- Mutation mechanic — will need Comp System pattern
- When second geneline starts, restructure `units/` into `units/<geneline>/` subfolders
