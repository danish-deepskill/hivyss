// Typed event bus — decouples systems from each other.
// Any system can emit or listen without knowing about other systems.

export interface GameEvents {
  enemyKilled: { unit: { key: string; reward: number; x: number; y: number } };
  unitSpawned: { key: string; side: 'player' | 'enemy' };
  unitDied: { key: string; side: 'player' | 'enemy'; x: number; y: number };
  waveStart: { wave: number };
  waveCleared: { wave: number };
  incubationStart: { key: string; chamberIndex: number };
  incubationHatched: { key: string };
  incubationCancelled: { key: string; refund: number };
  larvaConsumed: { count: number };
  larvaSpawned: { count: number };
  baseHit: { side: 'player' | 'enemy'; damage: number };
  gameOver: { winner: 'player' | 'enemy' };
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
