// Terrain Engine — THE DATA TABLES (config, no logic).
//
// Everything the terrain engine does is a row here: which base terrain an
// element lays, the passive effect a unit suffers standing in it, and the
// reactions that fire when an element meets an existing cell. Adding a state /
// element / reaction is a DATA edit — never new code (the OCP escape hatch in
// ReactionRegistry covers the rare logic-not-expressible-as-data case).
//
// Pure data: imports only type-level symbols, no runtime side effects, safe to
// consume from tests without pulling Phaser.

import type { DamageType } from './combat/damageTypes';
import type { HitFlavor, TerrainState, Element, TerrainCell } from '../types';

// --- Geometry ---------------------------------------------------------------

// Fixed segment width (delta #1) — terrain reads the SAME coarse size on a short
// or a long map (the grid sizes to map length, not a fixed segment count).
// ~3 unit-widths wide: units are def.w (≈16 world-units, UNSCALED — Unit.unitW =
// def.w), so 48 ≈ 3 bodies — a real chokepoint that reads as a block, not a bar.
// (Was 128 ≈ 8 bodies; one shaper's wall covered most of a screen.)
export const TERRAIN_SEGMENT_WIDTH = 48;

// --- Per-element terrain type (delta #2: ONE table) -------------------------
// Replaces the original ELEMENT_TERRAIN + TERRAIN_UNIT_EFFECTS split. The
// passive + render live with the element, so a chitin WALL and a (future) loam
// BERM differ even though both are state 'raised'.

/** What a unit suffers while standing in a cell (queried by movement + the terrain tick). */
export interface TerrainEffect {
  /** Impassable while present (a wall). Movement piles up at the edge. */
  block?: boolean;
  /** Movement speed cut, 0..100 (%). Positional — applied while standing in the cell. */
  slowPct?: number;
  /** Fully halts movement (web root) without blocking the cell. */
  root?: boolean;
  /** Damage-over-time while standing in the cell. Routed through the existing
   *  DoT seam (resistance + death economy reused) — see TerrainSystem. */
  dot?: { type: DamageType; dps: number };
  /** One-shot damage on touch (e.g. chitin spikes). DECLARED for v1 — applied
   *  on cell-entry; blocking terrain never lets a unit stand on it, so the
   *  starter chitin wall never triggers it (a future crossable berm would). */
  contact?: { type: DamageType; dmg: number };
}

export type TerrainShape = 'wall' | 'pool' | 'web';

/** Render description for a terrain element (decoupled — consumed by TerrainRenderer). */
export interface TerrainPalette {
  /** Blob fill. */
  fill: number;
  /** Dark edge rim (silhouette clarity). */
  rim: number;
  /** Optional inner highlight. */
  glow?: number;
}

export interface TerrainTypeDef {
  state: TerrainState;
  /** Seconds of life; Infinity = permanent (cleared only by a reaction). */
  ttl: number;
  /** Destructible-wall hp; omit = not a wall (0). */
  hp?: number;
  passive: TerrainEffect;
  render: { palette: TerrainPalette; shape: TerrainShape };
}

/**
 * element → the terrain it lays on an EMPTY cell. `null` = the element lays NO
 * persistent terrain (it's a trigger/pulse only: fever ignites, nerve electrifies).
 */
export const TERRAIN_TYPES: Record<Element, TerrainTypeDef | null> = {
  chitin: {
    state: 'raised',
    ttl: Infinity,
    hp: 100,
    passive: { block: true, contact: { type: 'sharp', dmg: 4 } },
    render: { palette: { fill: 0x6b5a3a, rim: 0x2e2618, glow: 0x9a8350 }, shape: 'wall' },
  },
  acid: {
    state: 'flooded',
    ttl: 8,
    passive: { slowPct: 30, dot: { type: 'toxic', dps: 6 } },
    render: { palette: { fill: 0x6fae3a, rim: 0x274d12, glow: 0xb6f04a }, shape: 'pool' },
  },
  silk: {
    state: 'covered',
    ttl: Infinity,
    passive: { slowPct: 50 }, // web — heavy slow; the ignite-web reaction makes it flammable
    render: { palette: { fill: 0xe8eef2, rim: 0x9aa6ad, glow: 0xffffff }, shape: 'web' },
  },
  fever: null, // ignites webs / steams floods — lays nothing itself
  nerve: null, // electrifies floods — lays nothing itself
};

// --- Reactions (delta #4: stable resolve; delta #8: first-match-by-array-order) ---

/** A discrete consequence applied to units in/around the reacting cell. */
export interface Pulse {
  /** Damage type (drives resistance + FX flavor). `'none'` = pure crowd-control. */
  type: DamageType | 'none';
  /** Burst damage (routed through the DoT seam, so kills feed the death economy). */
  dmg?: number;
  /** Stun duration (seconds) — applies the existing `stun` effect. */
  stun?: number;
  /** Slow duration (seconds) — applies the existing `slow` effect. */
  slow?: number;
  /** `'cell'` = units in the reacting cell; `'route-segment'` = same (per-route, one segment). */
  area: 'cell' | 'route-segment';
}

export interface ReactionDef {
  id: string;
  /** Match: incoming `element` × (optionally) the target cell's state / element. */
  on: { element: Element; targetState?: TerrainState; targetElement?: Element };
  result: {
    /** Transform the cell (merged over the existing cell; state 'empty' fully clears it). */
    become?: Partial<TerrainCell>;
    hpDelta?: number;
    ttlDelta?: number;
    pulse?: Pulse;
    /** The ONE CA-borrow — future fire-creep / flood-flow (an added pass in the decay tick). */
    spread?: boolean;
    /** The incoming element is consumed (does not also lay its own base terrain). */
    consume?: boolean;
    /** OCP escape hatch (delta #6): run REACTION_HANDLERS[handler] for logic not expressible as data. */
    handler?: string;
  };
}

/**
 * REACTIONS — matched on (incoming element) × (target cell). FIRST match wins
 * (array order = priority). Same-frame applies resolve in event-queue order.
 */
export const REACTIONS: ReactionDef[] = [
  // fever on a silk web → ignite: a fire burst, web burns away.
  {
    id: 'ignite-web',
    on: { element: 'fever', targetState: 'covered', targetElement: 'silk' },
    result: { pulse: { type: 'heat', dmg: 40, area: 'cell' }, become: { state: 'empty' }, consume: true },
  },
  // nerve on an acid flood → electrify the whole segment: shock + brief stun.
  {
    id: 'electrify-flood',
    on: { element: 'nerve', targetState: 'flooded' },
    result: { pulse: { type: 'electric', dmg: 30, stun: 0.5, area: 'route-segment' }, ttlDelta: -2, consume: true },
  },
  // acid on a chitin wall → corrode: melts hp fast (acid is consumed doing it).
  {
    id: 'corrode-wall',
    on: { element: 'acid', targetState: 'raised', targetElement: 'chitin' },
    result: { hpDelta: -60, consume: true },
  },
  // fever on an acid flood → steam: the pool flashes off, blinding-slows what stands in it.
  {
    id: 'steam',
    on: { element: 'fever', targetState: 'flooded' },
    result: { pulse: { type: 'none', slow: 2, area: 'cell' }, become: { state: 'empty' }, consume: true },
  },
];

// --- Damage flavor (presentation) -------------------------------------------
// Maps a terrain damage type to the HitFlavor that colors its float text / picks
// its hit sound channel. Reuses the existing HitFlavor axis — no terrain palette.
export const TERRAIN_DAMAGE_FLAVOR: Record<DamageType, HitFlavor> = {
  blunt: 'melee',
  sharp: 'melee',
  heat: 'burn',
  cold: 'aoe',
  toxic: 'poison',
  electric: 'aoe',
  psychic: 'aoe',
  void: 'aoe',
  holy: 'aoe',
};
