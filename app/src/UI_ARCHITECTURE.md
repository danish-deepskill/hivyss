# UI & Scene Architecture — Hivyss

Rendering, scene management, and UI layout. Read before modifying scenes or UI.

---

## Canvas Configuration

DPR-aware fixed resolution. Canvas renders at physical pixel density for crisp graphics on retina/HiDPI screens.

```ts
const MAX_DPR = 2;  // cap at 2x — 3x is barely perceptible but costs 2.25x more
const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

const config = {
  type: Phaser.CANVAS,
  width: 1280 * dpr,      // internal: 2560 on retina
  height: 720 * dpr,       // internal: 1440 on retina
  zoom: 1 / dpr,           // CSS displays at logical 1280×720
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  banner: false,
};
```

**Key rules:**
- All game code uses **logical coordinates** (1280×720) — DPR is transparent
- Draw functions don't need to know about DPR — Phaser handles it via zoom
- No `window.innerWidth` calculations, no manual `S = W / 900` scaling
- Canvas text objects must set `resolution: dpr` for crisp text rendering
- Looks identical on every screen — big monitor, small laptop, Steam window

**Performance impact:**
| DPR | Canvas pixels | Cost |
|-----|-------------|------|
| 1x (standard) | 1280×720 | Normal |
| 2x (retina, capped) | 2560×1440 | 4x GPU/memory |

---

## Hybrid Rendering (Canvas + DOM Overlay)

**Problem:** Canvas text blurs on high-DPI screens even with DPR zoom. Browser-rendered DOM text is always crisp at any DPI — zero configuration needed.

**Solution:** Game world in canvas, text-heavy UI in DOM overlay. Phaser supports this via its built-in DOM Container that sits on top of the canvas and scales with it.

| Element | Technology | Why |
|---------|-----------|-----|
| **Game world** (units, effects, terrain) | Canvas | Must be canvas — procedural drawing |
| **Floating damage numbers** | Canvas Text + `resolution: dpr` | Part of game world |
| **HP bars, effect overlays** | Canvas Graphics | Simple shapes, DPR zoom handles it |
| **Unit tray cards** | DOM overlay | Text-heavy — always crisp |
| **Ability buttons** | DOM overlay | Text + icons — crisp |
| **Resource bar** | DOM overlay | Text labels — crisp |
| **Tooltips** | DOM overlay | Detailed text — crisp |
| **Incubation popup** | DOM overlay | Text + progress bars — crisp |

**Why hybrid (not all-canvas):**
- DOM text is ALWAYS crisp — no DPR tricks needed
- CSS styling is faster to iterate than canvas drawing
- Less GPU work — only game world uses DPR canvas, not UI text
- Steam compatible — Pocket City shipped on Steam with Phaser + DOM overlay
- Current DOM UI already works — restructure, don't rebuild

**DOM overlay setup:**
```ts
// Phaser automatically creates a DOM Container div
// positioned over the canvas, sized and scaled to match
// DOM elements inside it scale with the canvas via Scale.FIT
dom: {
  createContainer: true,  // enables DOM overlay
}
```

---

## 4-Layer Rendering Pattern

Industry standard (Unity/Unreal/Phaser). Each layer renders on top of the previous. Each layer is independent. Layers use canvas or DOM based on their content.

```
Layer 4 (top):   MODAL        — popups, overlays, pause screen          [DOM overlay]
Layer 3:         MENU UI      — deploy panel, ability bar, resource strip [DOM overlay]
Layer 2:         HUD          — floating HP bars, wave info, route labels [Canvas]
Layer 1 (base):  GAME WORLD   — lanes, units, effects, hives, terrain    [Canvas]
```

---

## Parallel Scene Architecture

Each layer is a separate Phaser Scene running simultaneously. No giant monolithic BattleScene.

### Scene Map

```
MainMenuScene → DeckScene → BattleScene (thin orchestrator)
                               ↓
                    launches simultaneously:
                    ├── WorldScene    (Layer 1: game world)
                    ├── HUDScene     (Layer 2: floating indicators)
                    └── MenuUIScene  (Layer 3: bottom panel)

                    launches on demand:
                    └── ModalScene   (Layer 4: popups)
```

### BattleScene (Orchestrator)
Thin — only launches/stops other scenes and passes config:

```ts
class BattleScene extends Phaser.Scene {
  create(data: BattleConfig) {
    this.scene.launch('WorldScene', data);
    this.scene.launch('HUDScene', data);
    this.scene.launch('MenuUIScene', data);
  }
}
```

### WorldScene (Layer 1 — Canvas)
Renders: 3-lane background (sky/ground/underground), units, effects, hives, terrain, larva visuals.
Owns: GameManager, CombatSystem, UnitPool, ParticleManager, EffectVisualSystem.
Technology: Canvas (procedural Graphics drawing). DPR zoom keeps it crisp.
Depth: 0-99.

### HUDScene (Layer 2 — Canvas)
Renders: HP bars floating above hives, wave/stage label, route labels, floating damage numbers.
Technology: Canvas (Graphics + Text with `resolution: dpr` for crisp text).
Depth: 100-199.

**Data access pattern:** HUDScene needs continuous state (hive positions, HP) every frame — events don't fit for this. Uses Phaser's `scene.registry` as shared read-only data store:
```ts
// WorldScene writes to registry every frame
this.registry.set('playerHive', { x: 60, y: 380, hp: 800, maxHp: 1000 });
this.registry.set('enemyHive', { x: 1220, y: 380, hp: 650, maxHp: 1000 });

// HUDScene reads from registry in its update()
const hive = this.registry.get('playerHive');
drawHiveHP(g, hive.x, hive.y - 20, hive.hp, hive.maxHp);
```
Rule: **Events for discrete changes** (UNIT_DIED, WAVE_START). **Registry for continuous state** (positions, HP, resource counts). Both coexist.

### MenuUIScene (Layer 3 — DOM Overlay)
Renders: resource strip, unit tray (5×2 cards), ability buttons.
Always visible during battle. Sends commands to WorldScene via events.
Technology: DOM overlay inside Phaser DOM Container. CSS-styled. Always crisp text at any DPI.

### ModalScene (Layer 4 — DOM Overlay)
Renders: incubation popup, pause menu, game over overlay.
Launched on demand. Technology: DOM overlay. Modal panels with CSS transitions.

**When ModalScene opens, WorldScene keeps running** — game doesn't pause. Only input is blocked:
```ts
// Launch modal — block world input, but game loop continues
this.scene.launch('ModalScene', { type: 'incubation' });
worldScene.input.enabled = false;  // can't click game world

// Close modal — restore input
worldScene.input.enabled = true;
this.scene.stop('ModalScene');
```
This means: incubation timers keep ticking, combat continues behind the popup, player sees the action. Only clicking the game world is blocked. Do NOT use `scene.pause()` — it freezes tweens, timers, and the update loop.

### Why Parallel Scenes

| Benefit | How |
|---------|-----|
| Each scene is small (<200 lines) | Instead of one 500+ line BattleScene |
| Independent update loops | Pause game without pausing UI |
| Show/hide independently | Hide HUD without hiding units |
| Testable in isolation | Test MenuUIScene without game running |
| Clear ownership | Each system has one home |

---

## Scene Communication

All via Event Bus. No scene imports another scene. No direct references.

### WorldScene Emits (game events)
| Event | Data | When |
|-------|------|------|
| `UNIT_DIED` | `{ unit, killer }` | Unit HP reaches 0 |
| `WAVE_START` | `{ wave }` | New wave begins |
| `NECTAR_CHANGED` | `{ current, max, income }` | Nectar amount changes |
| `HIVE_HP_CHANGED` | `{ side, current, max }` | Hive takes damage or heals |
| `HIVE_CLICKED` | `{ side }` | Player clicks their hive |
| `GAME_OVER` | `{ result }` | Win or lose |
| `BATTLE_START` | `{ config }` | Battle begins |

### MenuUIScene Emits (player commands)
| Event | Data | When |
|-------|------|------|
| `DEPLOY_UNIT` | `{ key, route, shift }` | Player clicks unit card |
| `USE_ABILITY` | `{ key }` | Player clicks ability button |
| `CANCEL_INCUBATION` | `{ index }` | Player cancels a chamber |

### WorldScene Subscribes to Commands
```ts
on('DEPLOY_UNIT', (data) => gameManager.spawnUnit(data.key, data.route));
on('USE_ABILITY', (data) => gameManager.useAbility(data.key));
```

### ModalScene Launched by Events
```ts
on('HIVE_CLICKED', () => scene.launch('ModalScene', { type: 'incubation' }));
on('GAME_OVER', (data) => scene.launch('ModalScene', { type: 'gameover', result: data.result }));
```

---

## Screen Layout (1280×720)

```
┌─────────────────────────────────────────────────────┐
│ 🪲 Hivyss         LAYER 3         WAVE 5/8         │ y=0-25 (HUD top strip)
│                                                      │
│ ☁  ☁         AIR LANE              ☁  ☁           │ y=25-200
│                   [air units fly here]               │
│                                                      │
│ 🌿🌿══════════ LAND LANE ═══════════════🌿🌿     │ y=200-420
│ [HIVE]          [units fighting]        [ENEMY HIVE] │
│  ♥HP              larva crawl              ♥HP       │
│                                                      │
│ 🪨🪨┄┄┄┄┄┄┄┄ TUNNEL LANE ┄┄┄┄┄┄┄┄┄┄🪨🪨        │ y=420-600
│                [tunnel units here]                    │
│                                                      │
├─────────────────────────────────────────────────────┤ y=600
│ [⊕120 nectar ████░░] [🐛×3 larvae] [Wave 5]        │ y=600-620 (resource strip)
│                                                      │
│ [Card][Card][Card][Card][Card] │ [Ability][Ability] │ y=620-720
│ [Card][Card][Card][Card][Card] │ [Ability][Ability] │ (deploy + abilities)
└─────────────────────────────────────────────────────┘
```

### Layout Constants

```ts
// All values in logical coordinates — DPR is transparent
const DESIGN_W = 1280;
const DESIGN_H = 720;

// World takes top 83%, UI panel takes bottom 17%
const WORLD_H = 600;   // DESIGN_H * 0.833
const PANEL_H = 120;   // DESIGN_H * 0.167

const LAYOUT = {
  // WorldScene — game world (top portion)
  world: { x: 0, y: 0, w: DESIGN_W, h: WORLD_H },

  // 3 lanes within world — proportional to WORLD_H
  air:    { yStart: 25,  yEnd: 200, groundY: 170 },   // top third
  land:   { yStart: 200, yEnd: 420, groundY: 380 },   // middle third (tallest)
  tunnel: { yStart: 420, yEnd: WORLD_H, groundY: 560 }, // bottom third

  // Hive positions (on land lane)
  playerHive: { x: 60 },
  enemyHive:  { x: DESIGN_W - 60 },

  // MenuUIScene — bottom panel (DOM overlay)
  resourceStrip: { y: WORLD_H, h: 20 },

  deployPanel: {
    // Unit tray: left 68%
    tray: { x: 10, y: WORLD_H + 22, w: 870, h: 94 },
    columns: 5,
    rows: 2,
    cardW: 170,
    cardH: 44,
    cardGap: 4,

    // Abilities: right 32%
    abilities: { x: 890, y: WORLD_H + 22, w: 380, h: 94 },
  },
};
```

---

## 3-Lane Background Rendering

Natural transitions, no hard divider lines. The biome tells the player which lane is which.

### Air Lane (y=25 to y=200)
- Sky gradient (dark blue → lighter at horizon)
- Subtle clouds drifting slowly
- Stars if night-themed level
- Open, bright feel

### Land Lane (y=200 to y=420)
- Ground texture (grass, dirt)
- Hive structures visible
- Larva visuals crawling near player hive
- Spires/turrets on the ground
- Main action area — most visually detailed

### Tunnel Lane (y=420 to y=600)
- Dirt layers, cross-section view
- Rocks, roots, mineral deposits
- Darker, earthy tones
- Slightly muted — feels underground

### Transitions
- Air→Land: sky gradient fades into ground/grass line
- Land→Tunnel: ground/grass fades into dirt cross-section

No hard lines. Player naturally reads "sky = air, ground = land, dirt = tunnel."

---

## UI Elements (Canvas + DOM Hybrid)

### HP Bars (HUDScene)
Floating above each hive in the game world. Not in a top bar.
```ts
// Drawn at hive position in world coordinates
drawHiveHP(g, playerHive.x, land.groundY - hiveHeight - 15);
drawHiveHP(g, enemyHive.x, land.groundY - hiveHeight - 15);
```

### Resource Strip (MenuUIScene)
Thin bar at y=600. Shows: nectar bar + count, larvae count, wave/stage info.

### Unit Tray (MenuUIScene)
5 columns × 2 rows = 10 unit cards. Left side of bottom panel.
- Click = deploy to native route
- Shift+click = deploy to opposite route (land↔tunnel)
- Shift held = route indicator overlay on cards
- Disabled state when can't afford or cap full

### Ability Buttons (MenuUIScene)
Right side of bottom panel. 4 ability buttons with cooldown overlay.

### Incubation Popup (ModalScene)
Opened by clicking player hive. Shows:
- Chamber slots with progress bars
- Countdown timers
- Cancel button per chamber
- Larvae count
- Click outside or ESC to close

### Game Over Overlay (ModalScene)
Full-screen overlay with results, stats, restart button.

### Tooltips (MenuUIScene)
Hover over unit card → shows tooltip with stats, ability description, tier info.
Owned by MenuUIScene — tooltips appear on hover over unit cards which live in MenuUIScene. Not ModalScene — launching a scene per hover is too expensive.

---

## Route Indicators

### Shift-Deploy Visual
When shift is held, unit cards show which route they'll deploy to:
- Land unit: shows ↓ tunnel indicator
- Tunnel unit: shows ↑ land indicator
- Air unit: no indicator (can't shift-deploy)

### Lane Labels (HUDScene)
Subtle labels on the left edge:
```
AIR ─────
LAND ════
TUNNEL ┄┄
```
Small, low opacity. Visible but not distracting.

---

## Migration From Current Code

| Current file | Becomes | Layer | Technology |
|-------------|---------|-------|-----------|
| `BattleScene.ts` (monolithic) | Thin orchestrator — launches scenes | — | — |
| Background drawing | `WorldScene` — 3-lane background | World | Canvas |
| `GameManager.ts` | Owned by `WorldScene` | World | Canvas |
| `CombatSystem.ts` | Owned by `WorldScene` | World | Canvas |
| `UnitPool.ts` | Owned by `WorldScene` | World | Canvas |
| `LarvaVisuals.ts` | Owned by `WorldScene` | World | Canvas |
| `ParticleManager.ts` | Owned by `WorldScene` | World | Canvas |
| `HUD.ts` (DOM) | `HUDScene` (floating HP bars, labels) | HUD | Canvas |
| `UnitTray.ts` (DOM) | `MenuUIScene` — restructure into DOM Container | Menu UI | DOM overlay (keep DOM, restructure) |
| `AbilityBar.ts` (DOM) | `MenuUIScene` — restructure into DOM Container | Menu UI | DOM overlay (keep DOM, restructure) |
| `LarvaMound.ts` (DOM) | `ModalScene` popup — restructure into DOM Container | Modal | DOM overlay (keep DOM, restructure) |
| Game over overlay (DOM) | `ModalScene` popup — restructure into DOM Container | Modal | DOM overlay (keep DOM, restructure) |
| `index.html` DOM elements | Move into Phaser DOM Container managed by scenes | — | DOM overlay |

**Key migration insight:** DOM UI elements (UnitTray, AbilityBar, LarvaMound) don't need to be rebuilt in canvas. They get restructured into Phaser's DOM Container overlay — same HTML/CSS, but managed by scenes and scaled with the canvas automatically.

---

## Future Scene Types

| Scene | When | Purpose |
|-------|------|---------|
| `MapScene` | Territory system | Territory map between battles, hive management |
| `HiveBuildScene` | Hive building | Room management popup or separate scene |
| `PreDraftScene` | Clash battle mode | Army drafting before Clash battles |
| `DarkRealmScene` | Dark realms | Different background/atmosphere for dark realm battles |
