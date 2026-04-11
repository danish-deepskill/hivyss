# Design Patterns — Hivyss

Documented list of design patterns implemented in the codebase.
Future Claude Code sessions: read this before modifying architecture. Do not reimplement or duplicate these patterns.

---

## 1. Data-Driven Defs (Def Registry)

**Status:** Implemented
**Files:** `units/registry.ts`, `types.ts` (UnitDef), `config/EnemyDefs.ts`, `config/WaveDefs.ts`, `config/AbilityDefs.ts`

All content (units, enemies, waves, abilities) is defined as pure data objects conforming to typed interfaces. The registry builds lookup maps (`UNIT_DEFS`, `DRAW_MAP`, `COMBAT_MAP`) from these definitions. Adding new content means adding data — no system code changes needed.

**Key types:**
- `UnitDef` — stats, visuals, cost, tier, incubation
- `UnitModule` — bundles def + draw + optional combat hooks
- `WaveDef` — enemy composition per wave
- `AbilityDef` — ability stats and costs

**How to add a new unit:**
Units are consolidated per geneline (`units/alpha.ts`, `units/normal.ts`). Each file exports a `units` record of `UnitModule` objects.

1. Add the def to the appropriate geneline file (use `alphaDef()` helper for geneline units)
2. Create a draw function in `draws/<geneline>/<unit>.ts`
3. Add combat hooks (optional) in the same geneline file
4. Add to the `units` export record
5. That's it — registry auto-builds UNIT_DEFS, DRAW_MAP, COMBAT_MAP from all geneline files

---

## 2. Flyweight / Type Object

**Status:** Implemented
**Files:** `entities/Unit.ts`, `units/registry.ts`

Unit instances (`Unit` class) hold only per-instance state (hp, position, cooldowns). Shared data (base stats, colors, draw functions) lives in `UnitDef` objects referenced by key. Hundreds of units of the same type share one def.

---

## 3. Component-like Hooks (Combat Hooks)

**Status:** Implemented
**Files:** `types.ts` (CombatHooks), `systems/CombatSystem.ts`, individual unit files

Instead of inheritance (`MeleeUnit extends Unit`), unit-specific behavior is defined as detachable hook objects (`CombatHooks`). Each unit optionally exports a `combat` object with hooks like `onAttack`, `afterHit`, `onDeath`, `modifyDamage`. CombatSystem calls these via trait lookup — no switch/case, no subclasses.

**Available hooks:** `onSpawn`, `onUpdate`, `onAttack`, `afterHit`, `onDeath`, `modifyDamage`, `modifyAllyDamage`, `getAtk`

**Do not:**
- Create Unit subclasses for special behavior — use combat hooks instead
- Add switch/case on unit type in CombatSystem — add a hook to the unit file

---

## 4. Event Bus

**Status:** Implemented
**Files:** `systems/EventBus.ts`

Typed event bus that decouples systems. Any system can emit or subscribe to events without importing other systems. Replaces Phaser's untyped `scene.events` for game logic.

**Do not** use `scene.events.emit()` for game logic. Use `EventBus` instead. Phaser scene events are only for Phaser-specific things (scene transitions, input).

**Usage:**
```ts
// Subscribe
this.events.on('enemyKilled', (data) => { ... });

// Emit
this.events.emit('enemyKilled', { unit: { key, reward, x, y } });
```

**Current events:**
| Event | Data | Emitted by | Consumed by |
|---|---|---|---|
| `enemyKilled` | `{ unit: { key, reward, x, y } }` | CombatSystem, AbilityManager | GameManager (nectar + kills) |
| `unitSpawned` | `{ key, side }` | WaveManager | GameManager (spawn enemy) |
| `waveStart` | `{ wave }` | WaveManager | GameManager (audio + log), MenuUIScene (stage label) |
| `deployUnit` | `{ key }` | MenuUIScene | WorldScene → GameManager.playerSpawn() |
| `useAbility` | `{ key }` | MenuUIScene | WorldScene → GameManager.castAbility() |
| `cancelIncubation` | `{ index }` | MenuUIScene | WorldScene → GameManager.cancelIncubation() |
| `logMessage` | `{ message }` | WorldScene, GameManager | MenuUIScene (log display) |

**Adding new events:** Define in `GameEvents` interface in `EventBus.ts`. All events are typed — compiler catches wrong data shapes.

### Future: Expanded Event Bus (all systems decoupled)
**When:** Combat system architecture implementation

Currently, systems call each other directly (`ctx.particles.burst()`, `ctx.audio.meleeHit()`). The combat pipeline should instead emit events that other systems subscribe to independently. No system imports another system.

**Principle:** Combat emits what happened. Visual, audio, spawn systems react independently.

**Combat pipeline emits:**
| Event | Data | When |
|-------|------|------|
| `DAMAGE_DEALT` | `{ attacker, target, damage, dmgType, ability }` | After damage applied |
| `EFFECT_APPLIED` | `{ unit, effect, stats }` | Effect starts on unit |
| `EFFECT_EXPIRED` | `{ unit, effect }` | Effect ends (natural or cleansed) |
| `EFFECT_TICKED` | `{ unit, effect, tickDamage }` | DOT tick deals damage |
| `UNIT_DIED` | `{ unit, killer, ability }` | Unit HP reaches 0 |
| `ABILITY_USED` | `{ attacker, target, ability }` | Any ability resolves |
| `MODIFIER_APPLIED` | `{ unit, modifier }` | Buff/debuff added |
| `MODIFIER_REMOVED` | `{ unit, modifier }` | Buff/debuff removed |

**Systems subscribe independently:**
| System | Listens to | Reacts with |
|--------|-----------|-------------|
| EffectVisualSystem | `EFFECT_APPLIED`, `EFFECT_EXPIRED`, `MODIFIER_APPLIED`, `MODIFIER_REMOVED` | Show/hide overlays, buff indicators |
| AudioSystem | `DAMAGE_DEALT`, `UNIT_DIED`, `ABILITY_USED` | Play hit sounds, death sounds, ability SFX |
| ParticleSystem | `DAMAGE_DEALT`, `UNIT_DIED`, `EFFECT_TICKED` | Burst particles, death explosions, DOT particles |
| SpawnSystem | `EFFECT_EXPIRED` (egg hatch), `UNIT_DIED` (egg sac burst) | Spawn units from effects/death abilities |
| EconomySystem | `UNIT_DIED` | Grant nectar reward |

**Why this is better than direct calls:**
- Combat system doesn't import ParticleManager, AudioManager, etc.
- Adding a new visual effect = subscribe to event, no combat code changes
- Disabling audio = unsubscribe, no combat code changes
- Testing combat = no mocking of visual/audio systems
- Same event triggers multiple reactions automatically

**Migration path from current direct calls:**
```ts
// Current (coupled):
ctx.particles.burst(x, y, color, count);
ctx.audio.meleeHit();

// Future (decoupled):
emit('DAMAGE_DEALT', { attacker, target, damage, dmgType });
// ParticleSystem subscribes → creates burst
// AudioSystem subscribes → plays hit sound
```

---

## 5. Object Pool (Unit Pool)

**Status:** Implemented
**Files:** `systems/UnitPool.ts`, `entities/Unit.ts`

Pre-allocates 40 `Unit` instances at game start. Spawning reuses an inactive unit via `init()` instead of `new Unit()`. Death calls `deactivate()` (hide + mark inactive) instead of `destroy()`. Pool auto-grows by 10 if exhausted.

**Do not:**
- Call `new Unit()` in GameManager — use `unitPool.spawn(def, side, x)`
- Call `unit.destroy()` during gameplay — use `unitPool.despawn(unit)` or `unit.kill()`
- `unit.kill()` calls `deactivate()` internally, which hides the unit and returns it to pool

**Unit lifecycle:**
```
Pool creates Unit (once) → spawn(def, side, x) → init() → active gameplay →
dead=true → despawn() → deactivate() → sits inactive → spawn() again → ...
```

**Exception:** `SandboxScene` creates units directly with `new Unit()` — this is fine for a debug scene.

---

## 6. Manager Pattern (System Decomposition)

**Status:** Implemented
**Files:** `systems/GameManager.ts` and all `systems/*.ts`

Each game system is a standalone class with its own state and update loop. GameManager orchestrates them. Systems communicate via EventBus or explicit method calls.

**Systems:**
| Manager | Responsibility |
|---|---|
| `GameManager` | Orchestrator — owns all systems, runs game loop |
| `CombatSystem` | Unit targeting, damage, death, combat hooks |
| `WaveManager` | Wave scheduling, enemy queue, stage progression |
| `EconomyManager` | Nectar income, spending, balance |
| `AbilityManager` | Player abilities, cooldowns, effects |
| `IncubationManager` | Larva resource, chamber queue, hatch timers |
| `AudioManager` | Web Audio API, sound effects |
| `ParticleManager` | Floating text, particle bursts |
| `UnitPool` | Unit object recycling |
| `EventBus` | Cross-system event communication |
| `SaveManager` | LocalStorage persistence |

**Do not** add game logic directly to Scene classes. Scenes are thin — they create managers and wire UI.

---

## 7. Scene Architecture (4 Parallel Scenes)

**Status:** Implemented
**Files:** `scenes/BattleScene.ts`, `scenes/WorldScene.ts`, `scenes/HUDScene.ts`, `scenes/MenuUIScene.ts`, `scenes/ModalScene.ts`

During battle, 4 parallel Phaser scenes run simultaneously. BattleScene is a thin orchestrator that launches and stops them.

```
BattleScene (orchestrator)
  ├── WorldScene     — game world, GameManager, camera, canvas rendering
  ├── HUDScene       — floating HP bars (canvas), synced to WorldScene camera + zoom
  ├── MenuUIScene    — bottom panel DOM UI (resource bar, unit slots, abilities, log)
  ├── PauseScene     — ESC pause overlay with resume/quit (launched on demand)
  └── ModalScene     — game-over overlay (launched on demand)
```

**Communication between scenes:**
- **Registry** (continuous state): WorldScene writes economy/incubation/ability/game state to `this.registry` every frame. HUDScene and MenuUIScene read from it.
- **EventBus** (discrete actions): MenuUIScene emits `deployUnit`/`useAbility`/`cancelIncubation`. WorldScene subscribes and calls GameManager methods, emits `logMessage` back.
- **Phaser scene events**: BattleScene waits for WorldScene `'create'` event before launching MenuUIScene (ensures registry data is available).

**Lifecycle:**
1. BattleScene.create() → launches WorldScene + HUDScene
2. WorldScene.create() fires → BattleScene launches MenuUIScene
3. Game runs — WorldScene ticks logic + writes registry, other scenes read
4. Game over → BattleScene launches ModalScene with data
5. Restart → ModalScene emits `'restart'`, BattleScene stops all scenes + restarts

**Cleanup:** All scenes clean up EventBus listeners in `this.events.once('shutdown', ...)` to prevent leaks across restarts.

**Do not:**
- Access `worldScene.gm` from MenuUIScene — use registry + EventBus
- Put game logic in scene classes — use systems/managers
- Emit game events on Phaser `scene.events` — use the typed EventBus

---

## 8. DOM Container Pattern (Hybrid Rendering)

**Status:** Implemented
**Files:** `config/GameConfig.ts` (`dom: { createContainer: true }`), `scenes/MenuUIScene.ts`, `scenes/ModalScene.ts`

Phaser's DOM container overlays an invisible `<div>` on top of the canvas. Scenes create DOM elements via `this.add.dom(x, y, element)` for text-heavy UI that would be expensive to render on canvas.

**DOM-based scenes:** MenuUIScene (battle HUD), ModalScene (game over), BroodScene (vyssid selection), PauseScene (pause overlay).

**Pointer events:** The DOM container has `pointer-events: none` by default. Individual UI panels set `pointer-events: auto`. Clicks on transparent areas pass through to the canvas below.

**Mouse tracking caveat:** The DOM container intercepts browser mouse events before they reach the canvas. Phaser's `this.input.activePointer` won't track hover without a click. Fix: use native `canvas.parentElement.addEventListener('mousemove', ...)` and convert coordinates manually.

```ts
// Edge-pan uses native listener, not Phaser input
canvas.parentElement!.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  this.mouseX = ((e.clientX - rect.left) / rect.width) * W;
});
```

---

## 9. Route System (Multi-Lane Combat)

**Status:** Implemented
**Files:** `config/RouteMatrix.ts`, `config/Layout.ts`, `types.ts` (Route, AttackRange), `systems/CombatSystem.ts`, `entities/Unit.ts`

Three combat lanes (air/land/tunnel) with data-driven targeting rules. Routes are a **targeting filter + damage validation** — not a separate system.

**Lane Y levels** (`config/Layout.ts`):
```
Air:    y=240  (sky, above mountains)
Land:   y=380  (ground level)
Tunnel: y=410  (just below ground, above UI panel)
```

**Targeting matrix** (`config/RouteMatrix.ts`):
```ts
const ROUTE_MATRIX: Record<Route, Record<Route, 'always' | 'ranged' | 'never'>> = {
  air:    { air: 'always', land: 'always', tunnel: 'never' },
  land:   { air: 'ranged', land: 'always', tunnel: 'never' },
  tunnel: { air: 'never',  land: 'never',  tunnel: 'always' },
};
```

Add new route = add row/column. Change interaction = change one cell.

**Enforcement at TWO levels** (Unreal GAS pattern):
1. **Targeting** (`_findTarget`): route filter prevents selecting invalid targets for auto-attacks
2. **Damage application** (`hitUnit`): `ctx.sourceUnit` tracks who is dealing damage. `hitUnit()` validates routes before applying — catches combat hooks and AOE that bypass targeting. No source (null) = ability-level damage, bypasses check.

```ts
// CombatSystem.resolve() — tracks source
ctx.sourceUnit = u;

// CombatSystem.hitUnit() — validates before damage
if (ctx.sourceUnit && !canAttack(source.route, source.attackRange, target.route)) return;
```

**`canAttack()` is a pure function** — takes primitives (route, attackRange, targetRoute), not objects. Testable, no circular dependencies.

**Do not:**
- Add route checks inside individual combat hooks — `hitUnit()` handles enforcement
- Create separate combat systems per route — one CombatSystem, one matrix
- Hardcode route interactions in if/else — use the data matrix

---

## 10. GenePalette System

**Status:** Implemented
**Files:** `config/Palettes.ts`, `types.ts` (GenePalette), `entities/Unit.ts`

Each geneline has a shared color palette defined once in `config/Palettes.ts`. Unit defs reference the palette instead of hardcoding colors. Draw functions read colors from `u.palette`.

```ts
// config/Palettes.ts — single source of truth for geneline colors
export const PALETTES: Record<string, GenePalette> = {
  alpha: { primary: 0xc03030, secondary: 0xd4c4b0, accent: 0x6b1a1a, shadow: 0x3d0e0e },
};
```

**Data flow:**
```
config/Palettes.ts → UnitDef.palette → Unit.init() resolves colors → RenderUnit.palette → draw function
```

- **Geneline units:** Use `palette: PALETTES.alpha` on def (no per-unit primary/secondary)
- **Starter units:** Use per-unit `primary`/`secondary` directly on def (no palette)
- **`resolveColors(def)`:** Single utility that resolves `primary`/`secondary` from either source

**Adding a new geneline:** Add one entry to `PALETTES`. All units in that geneline reference it.

---

## 11. Shared UI Components

**Status:** Implemented
**Files:** `ui/UnitCard.ts`, `index.html` (`.ucard` CSS)

Reusable DOM components used across multiple scenes. Each component owns its HTML structure, and CSS is defined in `index.html`.

**UnitCard** (`createUnitCard(key, opts)`):
- Used by: BroodScene (selection grid), MenuUIScene (battle deploy slots)
- Renders: tier badge, geneline badge, route icon, unit preview image, name, cost
- Fixed size: 90×80px via `.ucard` CSS
- States via CSS classes: `.selected`, `.disabled`

**Do not:**
- Build card HTML inline in scenes — use `createUnitCard()`
- Add card-specific styles as inline styles — use `.ucard` CSS classes

---

## 12. Numeric Tier System

**Status:** Implemented
**Files:** `types.ts` (TierKey), `units/registry.ts` (TIER_DEFS)

Tiers are numeric (1-11) internally, with display labels looked up from `TIER_DEFS`. This enables sorting, comparison, and tier-gated mechanics without string mapping.

```ts
type TierKey = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

TIER_DEFS[3] // → { label: 'M', name: 'Megavyss', color: '#50a0e0' }
```

Unit defs use `tier: 3`, UI reads `TIER_DEFS[def.tier].label` for display.

---

## 13. Camera Zoom Sync

**Status:** Implemented
**Files:** `scenes/WorldScene.ts`, `scenes/HUDScene.ts`

WorldScene publishes camera state to the Phaser registry every frame. HUDScene reads and syncs both scroll and zoom so HP bars match the world camera.

```ts
// WorldScene publishes
this.registry.set('cam.scrollX', cam.scrollX);
this.registry.set('cam.zoom', cam.zoom);

// HUDScene syncs
this.cameras.main.scrollX = this.registry.get('cam.scrollX');
this.cameras.main.zoom = this.registry.get('cam.zoom');
```

Default zoom: 1.5x. Player controls: +/- keys (range 1.0–3.0).

---

## Planned (Not Yet Implemented)

### Sprite Animation System
**When:** First sprite sheet delivered by artist
**Status:** Type foundations in place (`types.ts`, `registry.ts`). No runtime code yet.

Migrates unit rendering from procedural Graphics API to sprite-based animation. Supports both renderers simultaneously — per-unit choice, not global switch.

**Core types** (already in `types.ts`):
- `SpriteAnimDef` — per-unit anim config (atlas, prefix, clips, transitions, anchor)
- `AnimClip` — per-state animation (key, frameRate, repeat, yoyo)
- `AnimTransition` — state machine edge (from, to, trigger, priority)
- `AnimState` — idle, walk, attack_windup, attack_strike, attack_recovery, death, + custom

**Render mode selection:**
```ts
// UnitModule already has optional spriteAnim field
interface UnitModule {
  def: UnitDef;
  combat?: CombatHooks;
  draw: DrawFunction;            // procedural (always present as fallback)
  spriteAnim?: SpriteAnimDef;    // sprite (when atlas available)
}

// Registry already builds SPRITE_ANIM_MAP from UNITS
// If spriteAnim present + atlas loaded → sprite mode. Otherwise → procedural.
```

**Animation state machine (data-driven):**
```
idle → walk → attack_windup → attack_strike → attack_recovery → walk
any state → death (priority 100)
custom states: burrow, surface, rally (unit-specific)
```

Triggers fire from unit properties each frame: `state:march`, `foreswing_start`, `foreswing_end`, `backswing_end`, `death`, `burrowed:true/false`, `anim_complete`.

**Standard factory** eliminates boilerplate:
```ts
// Most units use this — only custom units define full transitions
export const spriteAnim = makeStandardAnim('atlas_alpha', 'grunt_');
```

**Asset structure:**
```
app/public/assets/sprites/
  alpha/atlas_alpha.{png,json}    ← per-geneline texture atlas
  beta/atlas_beta.{png,json}
  misc/atlas_misc.{png,json}      ← non-geneline units
```

**Frame naming in atlas:** `{trait}_{state}_{frame:2d}` — e.g. `grunt_walk_00`, `grunt_attack_windup_01`

**Per-geneline atlas** (~10 units × ~6 states × ~4-12 frames = ~400-700 frames, fits 2048×2048). Canvas renderer has no batching benefit — atlas grouping optimizes load time and memory.

**Unit class changes (when implemented):**
- `Unit` Container gains optional `sprite: Sprite` child alongside `gfx: Graphics`
- `redraw()` branches: sprite mode calls `updateSpriteAnim()`, procedural mode calls current logic
- Facing via `sprite.setFlipX(facing === -1)` — all sprites authored facing right

**Unit-specific animations:** Custom `AnimState` strings + overlay sprites for effects (rally chevrons, burrow dust). Combat hooks set boolean properties; overlays check `visibleWhen` conditions.

**Migration path:** Per-unit, incremental. Add `spriteAnim` export → sprite renders. Remove export → procedural fallback. No system changes needed. When full geneline has sprites, consolidate unit files (def + spriteAnim + combat = ~30-50 lines per unit, possible per-geneline grouping).

---

### Comp System
**When:** Mutation mechanic development
Modular components attached to units (e.g., `CompFireBreath`, `CompArmorPlating`). A mutated unit = normal unit + comps. Extends the CombatHooks pattern into a general-purpose component system.

### Tick Bucketing
**When:** 50+ entities on screen or heavy per-unit systems
Split update into `tickFast` (every frame), `tickSlow` (every 10 frames), `tickRare` (every 60 frames). Prevents slow systems from burning CPU every frame.

### StatDef + Modifiers
**When:** Stacking buffs/upgrades/mutations
Base stats from def, modifiers stack on top: `getEffectiveStat(unit, 'atk')`. Replaces direct stat mutation.

### State Machine
**When:** Units gain more behavioral states (stunned, enraged, fleeing)
Replace string `state` with proper FSM. Each state defines its own update logic and valid transitions.

### Spatial Partitioning
**When:** 100+ units on screen
Grid or bucket system for O(1) range/collision queries instead of O(n^2) full scan.

### Combat System Architecture (5 Layers)
**When:** Damage types, resistance, abilities, effects implementation
**Reference:** Unreal GAS (Gameplay Ability System), Path of Exile damage pipeline

The combat system has 5 independent data layers. Each layer has its own config files and concerns.

#### Layer 1: Attributes (what a unit IS)
Stats on the unit — HP, ATK, speed, resistance, penetration.

```ts
interface UnitDef {
  // ... existing stats (hp, atk, spd, range, atkRate, etc.)
  resistance?: Record<DamageType, ResistanceTier>;  // defaults to 'normal'
  penetration?: Record<DamageType, number>;          // tier shifts, defaults to 0

  // Abilities — what the unit DOES
  // NOTE: There is NO separate basicAttack field. Basic attack IS defaultAbility.
  // It runs through resolveAbility() → full pipeline (resistance, effects, modifiers).
  defaultAbility: string;              // e.g. 'jaw_strike' — the unit's auto-attack ability
  passiveAbilities?: string[];         // checked every frame (rage, aura, etc.)
  deathAbility?: string;               // triggers on death (explosions, spawns)

  // Hooks — complex behavior that can't be expressed as data
  combat?: CombatHooks;                // existing system, kept for complex logic
}
```

Units have base resistance (from def, immutable) and current resistance (runtime, mutable):
```ts
unit.baseResistance = { ...def.resistance };  // never changes
unit.resistance = { ...def.resistance };       // modified by effects/armor degradation
```

#### Layer 2: Damage Types (how damage is categorized)
9 types, each with a default effect. Defined once globally.

```ts
// config/combat/damageTypes.ts
export const DAMAGE_TYPES = {
  blunt:    { category: 'physical',  defaultEffect: 'knockback' },
  sharp:    { category: 'physical',  defaultEffect: 'pierce' },
  heat:     { category: 'elemental', defaultEffect: 'burn' },
  cold:     { category: 'elemental', defaultEffect: 'slow' },
  toxic:    { category: 'elemental', defaultEffect: 'poison' },
  electric: { category: 'elemental', defaultEffect: 'stun' },
  psychic:  { category: 'dark',      defaultEffect: 'fear' },
  void:     { category: 'dark',      defaultEffect: 'armor_bypass' },
  holy:     { category: 'dark',      defaultEffect: 'cleanse' },
};
```

Resistance tiers (7 levels, defined once):
```ts
// config/combat/resistances.ts
export const RESISTANCE_TIERS = [
  'weakest', 'weaker', 'weak', 'normal', 'strong', 'stronger', 'strongest'
];
```

#### Layer 3: Abilities (what a unit DOES)
Every action is an ability — including "basic attack." No separate basic attack system.

Each ability has ONE damage type and defines its own stats per resistance tier:

```ts
// config/combat/abilities/sharp.ts
export const SHARP_ABILITIES = {
  'jaw_strike': {
    category: 'damage',
    dmgType: 'sharp',
    appliesEffects: [],
    tiers: {
      weakest:  { damage: 55 },
      weaker:   { damage: 45 },
      weak:     { damage: 38 },
      normal:   { damage: 32 },
      strong:   { damage: 22 },
      stronger: { damage: 15 },
      strongest:{ damage: 8 },
    }
  },
};

// config/combat/abilities/heat.ts
export const HEAT_ABILITIES = {
  'fire_bite': {
    category: 'damage',
    dmgType: 'heat',
    appliesEffects: ['burn'],
    tiers: {
      weakest:  { damage: 70 },
      normal:   { damage: 40 },
      strongest:{ damage: 15 },
    }
  },
  'death_bomb': {
    category: 'damage',
    dmgType: 'heat',
    appliesEffects: ['burn'],
    maxTargets: 5,
    aoe: true,
    tiers: {
      weakest:  { damage: 120 },
      normal:   { damage: 65 },
      strongest:{ damage: 20 },
    }
  },
};

// config/combat/abilities/utility.ts
export const UTILITY_ABILITIES = {
  'rally_aura': {
    category: 'utility',
    targetType: 'ally',
    range: 80,
    maxTargets: 5,
    appliesModifier: { stat: 'atk', type: 'percent', value: 20 },
  },
  'heal_pulse': {
    category: 'heal',
    targetType: 'ally',
    // Heal tier lookup: uses healer's QUALITY as tier key (not target resistance).
    // Quality maps directly: weak→'weak', normal→'normal', strong→'strong'.
    // Only 3 of 7 tiers needed. No resistance involved.
    tiers: {
      weak:     { heal: 25 },
      normal:   { heal: 40 },
      strong:   { heal: 55 },
    }
  },
};
```

**Ability categories determine pipeline behavior:**
- `damage` — full damage pipeline (resistance lookup, effects, modifiers)
- `heal` — heals target, tiers based on healer quality, skips resistance
- `utility` — applies modifiers to targets, skips damage pipeline
- `passive` — auto-checks condition every frame, applies modifier/effect

**Units reference abilities by name:**
```ts
// mandible.ts — clean, no balance numbers in unit file
export const def: UnitDef = {
  name: 'Mandible',
  defaultAbility: 'jaw_strike',     // shared with Grunt, defined once
};

// bombardier.ts
export const def: UnitDef = {
  name: 'Bombardier',
  defaultAbility: 'jaw_strike',     // shared basic attack
  deathAbility: 'death_bomb',       // unique death ability
};
```

**Hooks vs ability data — clear rule:**
- Ability data = WHAT happens (damage, effects, tiers, targets)
- Hooks = WHEN/HOW it triggers (targeting logic, conditions, complex chains)
- Hooks never contain balance numbers. Abilities never contain logic.

#### Layer 4: Effects (what happens TO a unit)
Effects are status conditions applied by abilities. Grouped by behavior type:

```ts
// config/combat/effects/dot.ts — damage over time
export const DOT_EFFECTS = {
  'burn': {
    type: 'dot',
    tiers: {
      weakest:  { perTick: 15, duration: 5, tickRate: 1, spread: true },
      normal:   { perTick: 8,  duration: 2, tickRate: 1, spread: false },
      strongest:{ perTick: 1,  duration: 0.5, tickRate: 1, spread: false },
    }
  },
  'poison': {
    type: 'dot',
    stackable: true,
    tiers: {
      weakest:  { percentHP: 3, duration: 8 },
      normal:   { percentHP: 1.5, duration: 5 },
      strongest:{ percentHP: 0.3, duration: 2 },
    }
  },
};

// config/combat/effects/cc.ts — crowd control
export const CC_EFFECTS = {
  'stun':   { type: 'cc', tiers: { weakest: { duration: 2.0 }, normal: { duration: 1.0 }, strongest: { duration: 0.2 } } },
  'slow':   { type: 'cc', tiers: { weakest: { percent: 50, duration: 3 }, normal: { percent: 30, duration: 2 }, strongest: { percent: 10, duration: 1 } } },
  'fear':   { type: 'cc', tiers: { weakest: { duration: 3.0 }, normal: { duration: 1.5 }, strongest: { duration: 0.3 } } },
  'freeze': { type: 'cc', prevents: ['burn'], tiers: { weakest: { duration: 2.5 }, normal: { duration: 1.2 }, strongest: { duration: 0 } } },
};
```

Effect tier is determined by **defender's resistance** to the ability's damage type. Same lookup as damage.

**Effect Lifecycle Hooks:**
Each effect defines what happens at each stage of its life. The combat system calls these hooks — no hardcoded `if (effect === 'burn')` branches.

```ts
interface EffectDef {
  type: EffectType;
  tiers: Record<ResistanceTier, any>;
  stackable?: boolean;
  maxStacks?: number;
  onHostDeath?: 'cancel' | 'spread' | 'trigger';
  prevents?: string[];

  // Lifecycle hooks — effect owns its behavior
  onApply?:  (unit, stats) => void;     // first applied to unit
  onTick?:   (unit, stats, dt) => void; // each tick (DOTs, auras)
  onExpire?: (unit, stats) => void;     // effect ends naturally
  onStack?:  (unit, stats, stacks) => void; // same effect applied again
}
```

Example — burn effect with lifecycle:
```ts
'burn': {
  type: 'dot',
  spreadOnApply: true,
  spreadInheritsSpread: false,
  tiers: {
    weakest:  { perTick: 15, duration: 5, tickRate: 1 },
    normal:   { perTick: 8,  duration: 2, tickRate: 1 },
    strongest:{ perTick: 1,  duration: 0.5, tickRate: 1 },
  },
  onApply: (unit, stats) => {
    emit('EFFECT_APPLIED', { unit, effect: 'burn', stats });
  },
  onTick: (unit, stats, dt) => {
    unit.hp -= stats.perTick * dt;
    emit('DAMAGE_DEALT', { target: unit, damage: stats.perTick * dt, type: 'burn' });
  },
  onExpire: (unit) => {
    emit('EFFECT_EXPIRED', { unit, effect: 'burn' });
  },
  onStack: (unit, stats) => {
    // Refresh duration, don't increase damage
    unit.getEffect('burn').remainingDuration = stats.duration;
  },
}
```

The combat system loop just iterates active effects and calls hooks:
```ts
// Effect update loop (runs every frame)
for (const effect of unit.activeEffects) {
  effect.def.onTick?.(unit, effect.stats, dt);
  effect.remainingDuration -= dt;
  if (effect.remainingDuration <= 0) {
    effect.def.onExpire?.(unit, effect.stats);
    removeEffect(unit, effect);
  }
}
```

#### Layer 5: Modifiers (temporary stat changes)
Buffs/debuffs from any source. Stacking rules: flat first, then percent (additive within same priority), then override.

```ts
interface Modifier {
  stat: string;           // 'atk', 'speed', 'hp', 'damage', 'all'
  type: 'flat' | 'percent' | 'override';
  value: number;
  source: string;         // ID for removal (e.g., 'centurion_42', 'quality', 'off_route')
  duration?: number;      // seconds, undefined = permanent for battle
}

// Stacking example:
// Base ATK: 32
// +10 flat (armory)           → 42
// +20% (centurion) + +15% (pheromone) = +35% → 42 × 1.35 = 57
// Two percent modifiers are ADDITIVE, not multiplicative (prevents exponential scaling)
// Modifiers are stored as an array, NEVER deduplicated by stat+type.
// Identity is source string only. Two Centurions = two separate modifiers in the array.
// When one dies, only its source is removed. The other stays.
```

**What produces modifiers:**
| Source | Example modifier |
|--------|-----------------|
| Quality | `{ stat: 'all', type: 'percent', value: ±20, source: 'quality' }` |
| Centurion aura | `{ stat: 'atk', type: 'percent', value: 20, source: 'centurion_5' }` |
| Pheromone buff | `{ stat: 'speed', type: 'percent', value: 30, source: 'pheromone_charge' }` |
| Off-route debuff | `{ stat: 'all', type: 'percent', value: -20, source: 'off_route' }` |
| Terrain (hill) | `{ stat: 'damage', type: 'percent', value: 15, source: 'terrain_hill' }` |
| Mutation | `{ type: 'override', ... }` — replaces ability entirely |

Quality modifier applies to ALL numeric values (damage AND effect stats).
Source-tracked for clean removal (Centurion dies → remove all modifiers with that source).

#### File Structure
```
app/src/config/combat/
  damageTypes.ts        ← 9 damage types + properties (~30 lines)
  resistances.ts        ← tier table + shiftTier helper (~20 lines)
  abilities/
    sharp.ts            ← all sharp abilities
    blunt.ts            ← all blunt abilities
    heat.ts             ← all heat abilities
    cold.ts             ← all cold abilities
    toxic.ts            ← all toxic abilities
    electric.ts         ← all electric abilities
    psychic.ts          ← all psychic abilities
    void.ts             ← all void abilities
    holy.ts             ← all holy abilities
    utility.ts          ← non-damage (buffs, heals, movement)
  effects/
    dot.ts              ← burn, poison, bleed
    cc.ts               ← stun, slow, freeze, fear
    buff.ts             ← ATK up, speed up, armor up
    debuff.ts           ← ATK down, armor crack
    special.ts          ← lifesteal, reflect, absorb, shield
  modifiers/
    quality.ts          ← larva quality modifiers
    mutation.ts         ← mutation stat overrides
    geneline.ts         ← set bonus modifiers
    pheromone.ts        ← pheromone buff modifiers
```

#### Future Production Hardening (add when needed)
- **`pre_execute` phase** — cooldown/resource check. Add when Elite/Royal active abilities are implemented (auto-attacks already use atkCd)
- **Phase subscriber priority** — explicit ordering within phases. Add when two subscribers compete in the same phase. API: `on('modify', handler, { priority: 10 })` where higher priority runs first. Without priority, subscription order determines execution order — which depends on import order and is fragile
- **Config validation** — assert required fields per ability category. Add when config files exist (needs category-aware rules)
- **Debug pipeline logger** — log damage flow per-phase for balancing. Add with unit-specific filtering to avoid console flood

#### Damage Pipeline (Event-Driven)
Instead of a hardcoded sequence of steps, the pipeline uses **combat phases** that any system can subscribe to. New mechanics never require adding pipeline steps — they subscribe to existing phases.

**7 combat phases:**

| Phase | When | Examples |
|-------|------|---------|
| `pre_damage` | Before anything, can cancel | Invulnerability, dodge, block |
| `calculate` | Base damage from ability tiers | Core system only |
| `resist` | Resistance lookup + modifications | Core system, adaptive carapace, penetration |
| `modify` | All stat modifications | Quality, buffs, terrain, pheromone marks |
| `pre_apply` | Last chance before HP changes | Damage redirect, shields, absorb |
| `apply` | HP changes, effects applied | Core system, DOTs, CCs, delayed triggers |
| `post_apply` | After damage dealt | Reflect, lifesteal, death check, chain, hooks |

**DamageEvent flows through all phases:**
```ts
interface DamageEvent {
  attacker: IUnit;
  target: IUnit;
  ability: AbilityDef;
  dmgType: DamageType;
  baseDamage: number;
  finalDamage: number;
  effectiveTier: ResistanceTier;
  effects: string[];
  cancelled: boolean;         // set by pre_damage to skip
  isReflected: boolean;       // prevent reflect loop
  isRedirected: boolean;      // prevent redirect loop
  damageMultiplier: number;   // chain falloff etc
}
```

**Queue-based resolution:**
All damage events are queued, not immediately resolved. This prevents recursive stack overflow (death chains), ensures dead units can't be targeted, and makes resolution deterministic.

```ts
interface DamageEvent {
  attacker: IUnit;
  target: IUnit;
  ability: AbilityDef;
  dmgType: DamageType;
  baseDamage: number;
  finalDamage: number;
  effectiveTier: ResistanceTier;
  effects: (string | { effect: string, usesResistance?: DamageType })[];
  cancelled: boolean;
  isReflected: boolean;
  isRedirected: boolean;
  damageMultiplier: number;
}

const eventQueue: DamageEvent[] = [];

// Queue an ability — does NOT resolve immediately
function queueAbility(attacker, target, abilityName, opts?) {
  const ability = lookupAbility(abilityName);

  // Category routing (heal/utility resolve immediately — no queue needed)
  if (ability.category === 'heal') return resolveHeal(attacker, target, ability);
  if (ability.category === 'utility') return resolveUtility(attacker, target, ability);

  // Route targeting filter
  if (!canAttack(attacker.currentRoute, target.currentRoute)) return;

  eventQueue.push({
    attacker, target, ability,
    dmgType: ability.dmgType,
    baseDamage: 0, finalDamage: 0,
    effectiveTier: 'normal',
    effects: ability.appliesEffects ?? [],
    cancelled: false,
    isReflected: opts?.isReflected ?? false,
    isRedirected: opts?.isRedirected ?? false,
    damageMultiplier: opts?.damageMultiplier ?? 1.0,
  });
}

// Resolve all queued events — called once per frame
function resolveFrame() {
  let safety = 0;
  while (eventQueue.length > 0 && safety < 200) {
    safety++;
    const event = eventQueue.shift()!;

    // Skip dead targets — prevents effects on corpses
    if (event.target.dead) continue;

    // Run 7-phase pipeline on this single event
    emit('pre_damage', event);
    if (event.cancelled) continue;

    emit('calculate', event);
    emit('resist', event);
    emit('modify', event);
    emit('pre_apply', event);
    if (event.cancelled) continue;

    emit('apply', event);
    emit('post_apply', event);
    // post_apply may queue MORE events (death chains, reflects)
    // They'll be processed next iteration of this while loop — no recursion
  }
}
```

**Core system subscribes to phases (always present):**
```ts
// Core: calculate base damage from ability tiers
on('calculate', (event) => {
  const resTier = event.target.resistance?.[event.dmgType] ?? 'normal';
  const pen = event.attacker.penetration?.[event.dmgType] ?? 0;
  event.effectiveTier = shiftTier(resTier, -pen);
  const stats = event.ability.tiers[event.effectiveTier];
  event.baseDamage = stats.damage;
  event.finalDamage = stats.damage;
});

// Core: apply modifiers (quality, buffs)
on('modify', (event) => {
  event.finalDamage = applyModifiers(event.attacker, event.finalDamage);
  event.finalDamage = Math.round(event.finalDamage * event.damageMultiplier);
});

// Core: deal damage + apply effects
on('apply', (event) => {
  event.target.hp -= event.finalDamage;
  for (const fx of [...event.effects]) {  // snapshot effects array
    const fxName = typeof fx === 'string' ? fx : fx.effect;
    const effect = lookupEffect(fxName);
    // Effect tier: defaults to ability's dmgType resistance.
    // Override per-effect with usesResistance if type differs.
    const fxTier = (typeof fx === 'object' && fx.usesResistance)
      ? (event.target.resistance?.[fx.usesResistance] ?? 'normal')
      : event.effectiveTier;
    const effectStats = effect.tiers[fxTier];
    const scaled = applyModifiersToEffectStats(event.attacker, effectStats);

    // Non-stackable: strongest wins
    const existing = event.target.getEffect(fxName);
    if (existing && !effect.stackable) {
      // Refresh duration (longest wins)
      existing.remainingDuration = Math.max(existing.remainingDuration, scaled.duration ?? 0);
      // Keep strongest numeric values
      for (const [key, val] of Object.entries(scaled)) {
        if (typeof val === 'number' && typeof existing.stats[key] === 'number') {
          existing.stats[key] = Math.max(existing.stats[key], val);
        }
      }
    } else {
      applyEffect(event.target, fxName, scaled);
    }
  }
});

// applyModifiersToEffectStats spec:
// Iterates all fields in effectStats. For numeric fields (damage, duration, perTick, etc.),
// applies the attacker's 'quality' percent modifier (e.g., strong = +20%).
// Non-numeric fields (strings, booleans like 'spread') are passed through unchanged.
// Override modifiers do NOT apply to effect stats — only quality percent modifier.
// Example: burn { perTick: 8, duration: 2, spread: false } with strong quality (+20%)
//   → { perTick: 9.6→10, duration: 2.4, spread: false }

// Core: death check
on('post_apply', (event) => {
  if (event.target.hp <= 0 && !event.target.dead) {
    event.target.dead = true;  // FINAL — set before hooks, cannot be revived
    triggerHooks('onDeath', event.target);
    // Death abilities QUEUE new events — no recursion
    if (event.target.def.deathAbility) {
      const nearby = [...findNearby(event.target)];  // snapshot targets
      for (const t of nearby) {
        queueAbility(event.target, t, event.target.def.deathAbility);
      }
    }
  }
});
```

**Effect update loop (runs every frame before resolveFrame):**
```ts
function updateEffects(units: IUnit[], dt: number) {
  for (const unit of units) {
    if (unit.dead) continue;
    const effects = [...unit.activeEffects];  // snapshot before iterating
    for (const effect of effects) {
      if (unit.dead) break;  // stop if unit died from a DOT tick
      effect.def.onTick?.(unit, effect.stats, dt);

      // Check if DOT killed the unit
      if (unit.hp <= 0 && !unit.dead) {
        unit.dead = true;
        triggerHooks('onDeath', unit);
        break;
      }

      effect.remainingDuration -= dt;
      if (effect.remainingDuration <= 0) {
        effect.def.onExpire?.(unit, effect.stats);
        removeEffect(unit, effect);
      }
    }
  }
}
```

**Complex mechanics — all use queueAbility instead of resolveAbility:**
```ts
// Invulnerability (Metamorphosis cocoon)
on('pre_damage', (event) => {
  if (event.target.invulnerable) event.cancelled = true;
});

// Adaptive Carapace
on('resist', (event) => {
  const stacks = event.target.adaptationStacks?.[event.dmgType] ?? 0;
  const mult = [1.0, 0.6, 0.2][Math.min(stacks, 2)];
  event.finalDamage = Math.round(event.finalDamage * mult);
  event.target.adaptationStacks[event.dmgType] = stacks + 1;
  event.target.adaptationTimers[event.dmgType] = 5;
});

// Pheromone Mark (target debuff modifies attacker)
on('modify', (event) => {
  if (event.target.hasEffect('marked')) {
    const mark = event.target.getEffect('marked');
    event.attacker.tempAtkRate *= (1 + mark.atkSpeedBonus / 100);
  }
});

// Damage Redirect — queues redirect damage instead of recursive resolve
on('pre_apply', (event) => {
  if (event.isRedirected) return;
  const redirector = findNearbyAllyWithAura(event.target, 'redirect');
  if (redirector && redirector.hp / redirector.maxHp > 0.25) {
    const redirected = Math.round(event.finalDamage * 0.3);
    event.finalDamage -= redirected;
    queueAbility(event.attacker, redirector, 'redirect_damage', { isRedirected: true });
  }
});

// Reflect (thorns) — queues reflect instead of recursive resolve
on('post_apply', (event) => {
  if (!event.isReflected && event.target.hasEffect('thorns')) {
    queueAbility(event.target, event.attacker, 'thorn_reflect', { isReflected: true });
  }
});

// Lifesteal
on('post_apply', (event) => {
  if (event.attacker.hasEffect('lifesteal')) {
    event.attacker.hp += Math.round(event.finalDamage * 0.3);
  }
});
```

**Why event-driven over hardcoded steps:**
- New mechanics SUBSCRIBE, never modify the pipeline
- No step 5.5 or step 6.5 — just subscribe to the right phase
- Order within a phase is subscription order (predictable)
- Easy to enable/disable mechanics (unsubscribe)
- Testable — mock events, check results
- Uses the existing EventBus pattern already in the codebase

#### Effect Types

```ts
type EffectType =
  | 'dot'               // burn, poison, bleed
  | 'cc'                // stun, slow, freeze, fear
  | 'buff'              // ATK up, speed up
  | 'debuff'            // ATK down, armor crack, pheromone mark
  | 'delayed_trigger'   // parasitic eggs, time bombs
  | 'aura'              // damage redirect, rally
  | 'adaptation'        // adaptive carapace

interface EffectDef {
  type: EffectType;
  stackable?: boolean;
  maxStacks?: number;
  onHostDeath?: 'cancel' | 'spread' | 'trigger';
  spreadRadius?: number;
  spreadOnApply?: boolean;       // burn spreads on application
  spreadInheritsSpread?: boolean; // spread copies can't re-spread
  prevents?: string[];           // freeze prevents burn
  tiers: Record<ResistanceTier, any>;

  // Lifecycle hooks
  onApply?:  (unit, stats) => void;
  onTick?:   (unit, stats, dt) => void;
  onExpire?: (unit, stats) => void;
  onStack?:  (unit, stats, stacks) => void;
}

// delayed_trigger: onExpire OWNS the spawn/trigger action. No separate system needed.
// Example:
// 'parasitic_eggs': {
//   type: 'delayed_trigger',
//   onHostDeath: 'cancel',
//   tiers: { normal: { spawnCount: 2, spawnUnit: 'larva' } },
//   onTick: (unit, stats, dt) => { /* countdown handled by effect loop */ },
//   onExpire: (unit, stats) => {
//     for (let i = 0; i < stats.spawnCount; i++)
//       emit('UNIT_SPAWNED', { key: stats.spawnUnit, side: unit.side, x: unit.x });
//   },
// }
```

#### Edge Cases Solved

| Edge case | Solution | Phase |
|-----------|---------|-------|
| Invulnerability | `event.cancelled = true` | `pre_damage` |
| Mixed damage (sharp + heat) | One ability = one dmgType | — |
| Multiple effects per ability | `appliesEffects` array | `apply` |
| Modifier stacking | Flat → percent (additive) → override | `modify` |
| Utility/heal abilities | Category routing, skip damage phases | Before pipeline |
| Runtime resistance change | Mutable `unit.resistance` vs immutable `baseResistance` | `resist` |
| Quality scaling | Modifier on attacker, applies to damage + effects | `modify` |
| Mutation | Swap ability reference + clear quality modifier | — |
| Routes | Targeting filter before pipeline + off-route modifier | Before pipeline + `modify` |
| Terrain | Modifier added/removed by terrain system | `modify` |
| Armor degradation (Gamma) | Hook modifies `unit.resistance` on HP threshold | External |
| Reflect loop | `isReflected` flag | `post_apply` |
| Redirect loop | `isRedirected` flag + single redirector cap | `pre_apply` |
| Adaptive carapace | Per-type stacks with decay timers | `resist` |
| Pheromone mark | Target debuff modifies attacker | `modify` |
| Damage redirect | Reroutes damage portion to redirector | `pre_apply` |
| Parasitic eggs | `delayed_trigger` effect with `onHostDeath: 'cancel'` | `apply` |
| Metamorphosis | `invulnerable` flag + stat/ability swap via hook | `pre_damage` |
| Chain lightning | Hook calls `queueAbility` per target with falloff | `post_apply` |
| Lifesteal | Heal based on `event.finalDamage` | `post_apply` |
| Burn spread | `spreadOnApply` + `spreadInheritsSpread: false` | `apply` |
| Kill attribution | `event.attacker` always available | All phases |
| Source-tracked modifiers | Modifier has `source` string, removed when source dies | `modify` |
| Infinite death chain | Queue-based — death abilities queue events, no recursion. Safety cap at 200 events per frame | `post_apply` |
| Effect on dead unit | Queue skips `event.target.dead`. Effect loop breaks on death | `resolveFrame` + `updateEffects` |
| Zero HP revival | `dead = true` set BEFORE onDeath hooks fire. Final, cannot be revived | `post_apply` |
| Weaker burn overwrites stronger | Non-stackable effects use "strongest wins" — `Math.max` per numeric field | `apply` |
| Non-stackable duration | "Longest wins" — `Math.max` on remaining duration | `apply` |

### Visual Effect System (Effect Overlay Architecture)
> For scene management, 4-layer rendering, and canvas UI layout, see `UI_ARCHITECTURE.md`.
**When:** Combat effects need visual feedback
**Principle:** Combat logic → Event Bus → Visual system. Three separate concerns. Unit draw functions never know about effects.

**Architecture:**
- `EffectVisualSystem` subscribes to event bus: `EFFECT_APPLIED`, `EFFECT_EXPIRED`, `MODIFIER_APPLIED`, `MODIFIER_REMOVED`
- Each frame, reads unit's `activeEffects` and `modifiers` arrays
- Draws overlays ON TOP of units — separate render pass after unit draw functions
- Visual definitions stored in a registry (`config/combat/effectVisuals.ts`) — maps effect name to visual type/color/animation
- Adding new effect visual = one registry entry, zero unit file changes, zero combat code changes

```ts
// config/combat/effectVisuals.ts — pure data, maps effects to visuals
export const EFFECT_VISUALS: Record<string, EffectVisual> = {
  'burn':    { type: 'overlay', color: 0xff6020, animation: 'flicker', opacity: 0.3 },
  'poison':  { type: 'overlay', color: 0x40ff40, animation: 'pulse', opacity: 0.25 },
  'stun':    { type: 'overlay', color: 0xffff00, animation: 'stars', position: 'above' },
  'atk_buff':{ type: 'icon', shape: 'arrow_up', color: 0xff4444, position: 'above' },
  'marked':  { type: 'icon', shape: 'crosshair', color: 0xff4444, position: 'above' },
  'linked':  { type: 'line', color: 0x4488ff, targetType: 'linked_units' },
};
```

**Render order:**
```
1. Background → 2. Shadows → 3. Unit bodies → 4. Effect overlays → 5. Particles → 6. UI
```

### Route System — IMPLEMENTED (see Section 9)

Core route system is implemented. Remaining planned features:

**Off-route debuff** (needs StatDef + Modifiers system):
```ts
// On deploy with shift+click (land↔tunnel only, air can't shift)
if (deployRoute !== unit.route) {
  unit.currentRoute = deployRoute;
  addModifier(unit, { stat: 'all', type: 'percent', value: -20, source: 'off_route' });
}
```

**Per-unit route overrides** (not yet on UnitDef):
```ts
routeOverrides?: Partial<Record<Route, 'always' | 'ranged' | 'never'>>;
// Example: tunnel anti-air unit: routeOverrides: { air: 'ranged' }
```

**Route switching via hooks:**
```ts
// Example: air unit crash-lands at low HP
onUpdate(u, dt, ctx) {
  if (u.currentRoute === 'air' && u.hp / u.maxHp < 0.5) {
    u.currentRoute = 'land';
  }
}
```

### Terrain System
**When:** Dynamic terrain on land route (water, hill)

Terrain is **data overlaid on routes** — sections of a route that are modified. Not a separate system — uses route data + modifiers.

**Terrain data per battle:**
```ts
interface TerrainSection {
  route: Route;
  type: 'water' | 'hill_up' | 'hill_down';
  xStart: number;  // logical x position start
  xEnd: number;    // logical x position end
}

interface BattleConfig {
  terrain: TerrainSection[];  // empty = no terrain features
}
```

**Water — blocks land route at that section:**
```ts
// Movement system checks terrain before moving
function canMoveTo(unit: IUnit, targetX: number, terrain: TerrainSection[]): boolean {
  if (unit.currentRoute !== 'land') return true;  // only blocks land
  return !terrain.some(t =>
    t.type === 'water' && t.route === 'land' &&
    targetX >= t.xStart && targetX <= t.xEnd
  );
}
// Blocked land units must shift to tunnel (with off_route debuff) or use air
```

**Hill — modifier applied when unit is in hill section:**
```ts
// Terrain system checks unit position each frame
function updateTerrainModifiers(unit: IUnit, terrain: TerrainSection[]) {
  const onHill = terrain.find(t =>
    t.type === 'hill_up' && t.route === unit.currentRoute &&
    unit.x >= t.xStart && unit.x <= t.xEnd
  );
  if (onHill && !unit.hasModifier('terrain_hill')) {
    addModifier(unit, { stat: 'damage', type: 'percent', value: 15, source: 'terrain_hill' });
  } else if (!onHill && unit.hasModifier('terrain_hill')) {
    removeModifier(unit, 'terrain_hill');
  }
}
```

Terrain is per-battle config — different battles have different terrain layouts. No terrain features = flat lanes (current game).

### Particle Shapes
**When:** More visual variety needed for effects
Extend ParticleManager with shape types (rings, squares/debris, lines/sparks, trails) beyond current circles-only. Would allow distinct visuals for explosions, lightning, fire, projectiles, etc. Currently all effects use the same small circle particles with different color/count/speed.

---

## Architecture Rules

1. **No inheritance for unit behavior** — use CombatHooks (component-like pattern)
2. **No Phaser scene.events for game logic** — use EventBus
3. **No `new Unit()` in gameplay code** — use UnitPool
4. **No game logic in Scene classes** — Scenes are thin UI wrappers around Managers
5. **Content is data, not code** — UnitDef, WaveDef, AbilityDef are pure data objects
6. **One file per unit** — each unit exports `def`, `draw`, optional `combat`
7. **Future: geneline folders** — when second geneline starts, restructure `units/` into `units/<geneline>/`
8. **Snapshot before iterating mutable lists** — applies to AOE targets AND active effects. Copy the array first (`[...targets]`, `[...unit.activeEffects]`), then iterate. An onExpire/onDeath during iteration can add/remove entries mid-loop, causing skipped or double-processed items
9. **Hooks never contain balance numbers, abilities never contain logic** — hooks define WHEN/HOW, ability data defines WHAT (damage, effects, tiers)
