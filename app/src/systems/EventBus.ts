// Typed event bus — decouples systems from each other.
// Any system can emit or listen without knowing about other systems.

import type { PheromoneKind, EliteSlot, Route, Element, TerrainCell } from '../types';

export interface GameEvents {
  enemyKilled: { unit: { key: string; reward: number; x: number; y: number } };
  unitSpawned: { key: string; side: 'player' | 'enemy' };
  // `route` + `element` (both optional for back-compat) feed the terrain
  // corpse-footprint: a dead unit with a terrain affinity lays/ignites its
  // element where it fell. Older emitters that omit them are unaffected.
  unitDied: { key: string; side: 'player' | 'enemy'; x: number; y: number; route?: Route; element?: Element };
  waveStart: { wave: number };
  waveCleared: { wave: number };
  incubationStart: { key: string; chamberIndex: number };
  incubationHatched: { key: string };
  incubationCancelled: { key: string; refund: number };
  larvaConsumed: { count: number };
  larvaSpawned: { count: number };
  baseHit: { side: 'player' | 'enemy'; damage: number };
  gameOver: { winner: 'player' | 'enemy' };
  // UI action events (MenuUIScene → WorldScene). `route` chooses the deploy
  // stratum: Shift+deploy → 'tunnel', normal → 'land' (Phase 2a control).
  deployUnit: { key: string; route: Route };
  useAbility: { key: string };
  cancelIncubation: { index: number };
  triggerSignature: { unitId: number };
  toggleRoyalSelect: {};
  deployGatherer: {};
  // Enter build-placement mode — the next field click places `variant` (snapped).
  enterBuildMode: { variant: string };
  matureHive: {};
  castPheromone: { kind: PheromoneKind };
  logMessage: { message: string };
  // --- Terrain Engine ---
  // A unit/effect lays or triggers `element` at world-x on `route`. The
  // TerrainSystem resolves it against the cell there (lay base terrain, or fire
  // a reaction). `intensity`/`hp` override the element's defaults when set.
  terrainApply: { route: Route; x: number; element: Element; intensity?: number; hp?: number };
  // A cell changed (transform / decay / destruction) — the renderer + any
  // listeners re-read it. `index` is the segment index on `route`.
  terrainChanged: { route: Route; index: number; cell: TerrainCell };
  // Sandbox events (SandboxHUDScene ↔ SandboxScene)
  sandboxSelectUnit: { unitKey: string | null };
  sandboxFight: {};
  sandboxReset: {};
  sandboxClear: {};
  sandboxRunningState: { running: boolean };
  sandboxFightResult: {
    result: 'player' | 'enemy' | 'draw';
    message: string;
    color: string;
    timeStr: string;
  };
  sandboxLoadPreset: { placements: Array<{ unitKey: string; side: 'player' | 'enemy'; x: number }> };
  sandboxSaveCurrentAs: { name: string };
  sandboxPresetsChanged: {};
  sandboxPlacementCount: { player: number; enemy: number };
  // Pheromone command selection (SandboxHUDScene → SandboxScene).
  sandboxSelectPheromone: { kind: PheromoneKind | null };
  // Echo of the active pheromone kind (SandboxScene → SandboxHUDScene),
  // so the HUD button row can reflect keyboard-driven selection.
  sandboxSelectPheromoneActive: { kind: PheromoneKind | null };
  // Biome (environment) selection (SandboxHUDScene → SandboxScene).
  sandboxSelectBiome: { biome: 'wild' | 'sunCarapace' | 'fetidPool' };
  // Elite-signature trigger (SandboxHUDScene → SandboxScene). With
  // `unitId` → fires that one Elite's signature (a slot click); without →
  // fires every ready player Elite (the E hotkey "fire all").
  sandboxTriggerSignature: { unitId?: number };
  // Elite-slot state push (SandboxScene → SandboxHUDScene). Fixed-length
  // array (= MAX_ELITES_PER_SIDE); null = an empty slot. Drives the HUD's
  // per-Elite active-ability slots (name + cooldown + firable).
  sandboxEliteSlots: { slots: Array<EliteSlot | null> };
}

type EventKey = keyof GameEvents;
type Listener<K extends EventKey> = (data: GameEvents[K]) => void;

export class EventBus {
  private listeners: { [K in EventKey]?: Listener<K>[] } = {};

  on<K extends EventKey>(event: K, fn: Listener<K>): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    (this.listeners[event] as Listener<K>[]).push(fn);
  }

  off<K extends EventKey>(event: K, fn: Listener<K>): void {
    const list = this.listeners[event] as Listener<K>[] | undefined;
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  }

  emit<K extends EventKey>(event: K, data: GameEvents[K]): void {
    const list = this.listeners[event] as Listener<K>[] | undefined;
    if (!list) return;
    for (const fn of list) fn(data);
  }

  clear(): void {
    this.listeners = {};
  }
}
