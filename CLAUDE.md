# Hivyss — Claude Code Context

## Required Reading
- `app/src/DESIGN_PATTERNS.md` — All implemented and planned design patterns. Read before modifying architecture.
- `app/src/GAME_DESIGN.md` — Future game mechanics (castes, routes, evolution, mutation, roguelike structure). Read before designing new features.
- `app/src/UI_ARCHITECTURE.md` — Scene management, 4-layer rendering, canvas UI layout. Read before modifying scenes or UI.
- `app/src/units/CLAUDE.md` — Unit file structure, combat hooks, draw function conventions.

## Tech Stack
- Phaser 3.90, Canvas renderer (not WebGL)
- TypeScript, Vite 5.4
- Procedural Graphics API drawing (no sprites/textures)
- DOM-based UI alongside canvas visuals

## Key Architecture Decisions
- Units are data-driven (`UnitDef`) with procedural draw functions, not sprites
- No class inheritance for unit behavior — use `CombatHooks` (component-like pattern)
- Cross-system events go through typed `EventBus`, not Phaser `scene.events`
- Units are pooled via `UnitPool` — never `new Unit()` or `destroy()` in gameplay code
- Game logic lives in `systems/` managers, not in Scene classes
- Gold is called "nectar" in UI
- Units are called "vyssids" in lore, "units" in code

## Phaser Graphics API
- Valid: `fillEllipse()`, `strokeEllipse()`, `fillCircle()`, `arc()`, `fillRect()`, `lineBetween()`
- NOT valid: `ellipse()`, `quadraticCurveTo()` — these do not exist on Phaser.GameObjects.Graphics

## Future Plans
- 24 genelines (Greek letters: alpha through omega), each with multiple vyssids (100+ total units)
- Mutation mechanic — will need Comp System pattern
- When second geneline starts, restructure `units/` into `units/<geneline>/` subfolders
