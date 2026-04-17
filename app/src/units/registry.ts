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
import { units as alphaUnits } from "./alpha";

// All unit modules keyed by unit ID
const UNITS: Record<string, UnitModule> = {
  ...starterUnits,
  ...alphaUnits,
};

// Tier display definitions
export const TIER_DEFS: Record<TierKey, TierDef> = {
  1:  { label: 'V', name: 'Vyss',       color: '#888888' },
  2:  { label: 'K', name: 'Kilovyss',   color: '#60a060' },
  3:  { label: 'M', name: 'Megavyss',   color: '#50a0e0' },
  4:  { label: 'G', name: 'Gigavyss',   color: '#c080f0' },
  5:  { label: 'T', name: 'Teravyss',   color: '#f0c040' },
  6:  { label: 'P', name: 'Petavyss',   color: '#f06040' },
  7:  { label: 'E', name: 'Exavyss',    color: '#ff4060' },
  8:  { label: 'Z', name: 'Zettavyss',  color: '#ff2080' },
  9:  { label: 'Y', name: 'Yottavyss',  color: '#ff10f0' },
  10: { label: 'R', name: 'Ronnavyss',  color: '#ff00ff' },
  11: { label: 'Q', name: 'Quettavyss', color: '#ffffff' },
};

// Geneline display definitions
export const GENELINE_DEFS: Record<GeneLine, GeneLineDef> = {
  alpha: { symbol: 'α', name: 'Alpha', color: '#c03030' },
};

// Build UNIT_DEFS from all unit modules
export const UNIT_DEFS: Record<string, UnitDef> = {};
for (const [key, mod] of Object.entries(UNITS)) {
  UNIT_DEFS[key] = mod.def;
}

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
