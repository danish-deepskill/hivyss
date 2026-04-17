# UI & Scene Architecture — Hivyss

Rendering, scene management, and UI layout. Read before modifying scenes or UI.

---

## Canvas Configuration

Fixed 1280×720 resolution with Scale.FIT. Canvas scales to fit any screen while maintaining aspect ratio.

```ts
const config = {
  type: Phaser.CANVAS,
  width: 1280,
  height: 720,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  dom: { createContainer: true },
};
```

**Key rules:**
- All game code uses **logical coordinates** (1280×720)
- No `window.innerWidth` calculations, no manual scaling
- Scale.FIT handles display adaptation — looks identical on every screen
- DPR-aware rendering not implemented (Scale.FIT handles display scaling adequately)

---

## Hybrid Rendering (Canvas + DOM Overlay)

Game world in canvas, text-heavy UI in DOM overlay. Phaser's DOM Container sits on top of the canvas and scales with it.

| Element | Technology | Why |
|---------|-----------|-----|
| **Game world** (units, effects, terrain) | Canvas | Procedural drawing |
| **Floating HP bars** | Canvas Graphics | Part of game world |
| **Unit slots, abilities, resource bar** | DOM overlay | Text — always crisp |
| **Game-over overlay** | DOM overlay | Text + buttons |

**DOM Container setup:** `dom: { createContainer: true }` in GameConfig. Phaser creates an invisible `<div>` overlay. Scenes add DOM elements via `this.add.dom(x, y, element)`.

**Pointer events:** DOM container has `pointer-events: none`. Individual UI panels set `pointer-events: auto`. Canvas clicks pass through transparent areas.

**Mouse tracking caveat:** The DOM container intercepts browser mouse events before they reach the canvas. Phaser's `this.input.activePointer` won't track hover without a click. Fix: use native `canvas.parentElement.addEventListener('mousemove', ...)` and convert coordinates manually.

---

## 4-Layer Rendering Pattern

Each layer is a separate Phaser Scene running simultaneously.

```
Layer 4 (top):   MODAL        — game-over overlay                        [DOM overlay]
Layer 3:         MENU UI      — unit slots, abilities, resource strip     [DOM overlay]
Layer 2:         HUD          — floating HP bars                          [Canvas]
Layer 1 (base):  GAME WORLD   — lanes, units, effects, hives             [Canvas]
```

---

## Parallel Scene Architecture

```
MainMenuScene → DeckScene → BattleScene (thin orchestrator)
                               ↓
                    launches simultaneously:
                    ├── WorldScene    (Layer 1: game world + GameManager)
                    ├── HUDScene     (Layer 2: floating HP bars)
                    └── MenuUIScene  (Layer 3: bottom panel DOM UI)

                    launches on demand:
                    └── ModalScene   (Layer 4: game-over overlay)
```

### BattleScene (Orchestrator)
Thin — launches/stops other scenes, passes config. No game logic.

### WorldScene (Layer 1 — Canvas)
Owns: GameManager, all game systems, camera, background rendering.
Writes state to `scene.registry` every frame for other scenes to read.
Subscribes to UI action events via EventBus.

### HUDScene (Layer 2 — Canvas)
Reads HP/camera data from registry. Syncs camera scrollX to WorldScene.
Draws HP bars at base positions in world coordinates.

### MenuUIScene (Layer 3 — DOM Overlay)
Builds DOM UI inside Phaser DOM Container: resource bar, larva mound, unit slots, abilities, log.
Reads economy/incubation/ability state from registry. Emits `deployUnit`/`useAbility`/`cancelIncubation` via EventBus.

### ModalScene (Layer 4 — DOM Overlay)
Game-over overlay. Launched with data (waves cleared, kills, points). Emits `restart` event.

---

## Scene Communication

Two channels, each for its natural use case:

- **Registry** (continuous state): WorldScene writes economy, incubation, abilities, HP, camera data every frame. HUDScene and MenuUIScene read.
- **EventBus** (discrete actions): MenuUIScene emits player commands. WorldScene subscribes and calls GameManager. GameManager emits log messages back.

**Rule:** Events for discrete changes. Registry for continuous state. Both coexist.

### Lifecycle
1. BattleScene.create() → launches WorldScene + HUDScene
2. WorldScene.create() fires → BattleScene launches MenuUIScene (ensures registry data available)
3. Game runs — WorldScene ticks + writes registry, others read
4. Game over → BattleScene launches ModalScene
5. Restart → ModalScene emits `restart`, BattleScene stops all scenes + restarts

### Cleanup
All scenes clean up EventBus listeners in `this.events.once('shutdown', ...)` to prevent leaks across restarts.

---

## Screen Layout (1280×720)

```
┌─────────────────────────────────────────────────────┐
│                                                      │ y=0
│              SKY (background)                        │
│                                                      │
│  ─ ─ ─ ─ ─ ─  AIR LANE  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     │ y=300
│ ▲▲▲▲▲▲▲▲▲▲▲▲ mountains ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲        │
│ [HIVE] ═══════ LAND LANE ═══════════ [ENEMY HIVE]   │ y=380
│ ┄┄┄┄┄┄┄┄┄┄┄┄ TUNNEL LANE ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │ y=410
├─────────────────────────────────────────────────────┤ ~y=414
│ STAGE 1  NECTAR [████] 80 +8/s  |  LARVAE 3/10     │ resource strip
│ [chamber] [chamber] [chamber] ...                    │ larva mound
│ [Slot][Slot][Slot][Slot][Slot][Slot][Slot][Slot]    │ unit slots (1 row)
│ [Acid Nuke] [Steel Wall] [Pheromone] [Repair]       │ abilities
│ Deploy units to push to the enemy base!              │ log
└─────────────────────────────────────────────────────┘ y=720
```

### Lane Y Levels (config/Layout.ts)
```ts
export const LANE: Record<Route, { groundY: number }> = {
  air:    { groundY: 300 },   // just above mountains
  land:   { groundY: 380 },   // ground level
  tunnel: { groundY: 410 },   // just below ground, above UI panel
};
```

---

## Background Themes

WorldScene.drawBackground() supports day/sunset/night themes. Theme is selectable from MainMenuScene and passed through BattleScene → WorldScene via scene data. Default: random.

---

## Do Not

- Access `worldScene.gm` from MenuUIScene — use registry + EventBus
- Put game logic in scene classes — use systems/managers
- Emit game events on Phaser `scene.events` — use typed EventBus
- Use `scene.pause()` for modals — it freezes tweens/timers. Block input instead.
- Assume DOM mouse events reach the canvas — use native listeners on `canvas.parentElement`

---

## Future

| Feature | Approach |
|---------|----------|
| Tooltips (unit stats on hover) | DeckScene bestiary, not in-battle |
| Shift+click deploy | Needs modifier system for off-route debuff |
| Lane labels (AIR/LAND/TUNNEL) | HUDScene text, low opacity |
| Incubation popup (click hive) | ModalScene, keeps current LarvaMound mechanic |
| DPR-aware rendering | Needs approach that doesn't inflate coordinate space |
| Detailed lane backgrounds | Clouds, dirt layers, roots — visual polish |
