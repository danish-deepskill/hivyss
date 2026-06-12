// Central registry — imports all units, exports UNIT_DEFS, TIER_DEFS, drawUnit.
import type {
  UnitDef,
  UnitModule,
  DrawFunction,
  SpriteAnimDef,
  TierKey,
  TierDef,
  GeneLineDef,
  GeneLine,
  RenderUnit,
} from "../types";
import { drawBasicBody } from "./renderUtils";

import { units as starterUnits } from "./normal";
import { units as alphaUnits } from "./alpha"; // α Primal — the canonical alpha
import { units as betaUnits } from "./beta"; // β Swarm — numbers / sacrifice
import { units as archiveUnits } from "./archive"; // retired legacy "military alpha"
import { units as workerUnits } from "./worker"; // universal worker caste (Scout)

// All unit modules keyed by unit ID
const UNITS: Record<string, UnitModule> = {
  ...starterUnits,
  ...alphaUnits,
  ...betaUnits,
  ...archiveUnits,
  ...workerUnits,
};

// Tier display definitions
export const TIER_DEFS: Record<TierKey, TierDef> = {
  0:  { label: 'V',  name: 'Vyss',       color: '#888888' },
  1:  { label: 'KV', name: 'Kilovyss',   color: '#60a060' },
  2:  { label: 'MV', name: 'Megavyss',   color: '#50a0e0' },
  3:  { label: 'GV', name: 'Gigavyss',   color: '#c080f0' },
  4:  { label: 'TV', name: 'Teravyss',   color: '#f0c040' },
  5:  { label: 'PV', name: 'Petavyss',   color: '#f06040' },
  6:  { label: 'EV', name: 'Exavyss',    color: '#ff4060' },
  7:  { label: 'ZV', name: 'Zettavyss',  color: '#ff2080' },
  8:  { label: 'YV', name: 'Yottavyss',  color: '#ff10f0' },
  9:  { label: 'RV', name: 'Ronnavyss',  color: '#ff00ff' },
  10: { label: 'QV', name: 'Quettavyss', color: '#ffffff' },
};

// Geneline display definitions. Partial so only populated genelines
// need entries — the GeneLine union itself carries all 25 names so
// future content additions typecheck without touching this map.
//
// 'normal' symbol is intentionally empty: consumer sites that render
// a geneline badge (UnitCard, BroodScene) guard on
// `def.geneline !== 'normal'` to preserve the "untagged" visual.
export const GENELINE_DEFS: Partial<Record<GeneLine, GeneLineDef>> = {
  alpha: { symbol: 'α', name: 'Alpha', color: '#c03030' },
  beta: { symbol: 'β', name: 'Beta', color: '#86a832' },
  normal: { symbol: '\u2014', name: 'Normal', color: '#888888' },
  archive: { symbol: '\u2298', name: 'Archive', color: '#777777' },
};

// Build UNIT_DEFS from all unit modules
export const UNIT_DEFS: Record<string, UnitDef> = {};
for (const [key, mod] of Object.entries(UNITS)) {
  UNIT_DEFS[key] = mod.def;
}

// GENELINES: populated-only map from geneline name → unit keys in
// that geneline. Sandbox HUD iterates this for tab ordering; non-UI
// consumers can use it for roster grouping without scanning all defs.
export const GENELINES: Partial<Record<GeneLine, string[]>> = (() => {
  const out: Partial<Record<GeneLine, string[]>> = {};
  for (const [key, def] of Object.entries(UNIT_DEFS)) {
    (out[def.geneline] ??= []).push(key);
  }
  return out;
})();

// Build draw map: trait -> draw function
const DRAW_MAP: Record<string, DrawFunction> = {};
for (const [_key, mod] of Object.entries(UNITS)) {
  DRAW_MAP[mod.def.trait] = mod.draw;
}

// Build sprite anim map: trait -> sprite animation def (empty until sprites are added)
export const SPRITE_ANIM_MAP: Record<string, SpriteAnimDef> = {};
for (const [_key, mod] of Object.entries(UNITS)) {
  if (mod.spriteAnim) SPRITE_ANIM_MAP[mod.def.trait] = mod.spriteAnim;
}



// Draw a unit onto a Graphics object
export function drawUnit(
  g: Phaser.GameObjects.Graphics,
  u: RenderUnit,
  cx: number,
  uy: number,
): void {
  const fn = DRAW_MAP[u.trait] || drawBasicBody;
  fn(g, u, cx, uy);
}

// Which geneline does a hive belong to, given its deck/roster keys? The hive
// IS the Royal's lineage, so the Royal's geneline wins; failing that (low-tier
// AI rosters carry no Royal), the dominant non-'normal' geneline; else
// 'normal'. Tolerates 'e'-prefixed enemy mirror keys (UNIT_DEFS is keyed by
// the player id). One helper feeds both hives — see GameManager.
export function hiveGenelineOf(keys: readonly string[]): GeneLine {
  const defOf = (k: string): UnitDef | undefined =>
    UNIT_DEFS[k] ?? UNIT_DEFS[k.replace(/^e/, '')];
  const royal = keys.map(defOf).find(d => d?.caste === 'royal');
  if (royal) return royal.geneline;
  const counts = new Map<GeneLine, number>();
  for (const k of keys) {
    const d = defOf(k);
    if (d && d.geneline !== 'normal') counts.set(d.geneline, (counts.get(d.geneline) ?? 0) + 1);
  }
  let best: GeneLine = 'normal', bestN = 0;
  for (const [gl, n] of counts) if (n > bestN) { best = gl; bestN = n; }
  return best;
}
