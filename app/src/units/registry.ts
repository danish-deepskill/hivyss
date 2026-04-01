// Central registry — imports all units, exports UNIT_DEFS, TIER_DEFS, COMBAT_MAP, drawUnit
import type {
  UnitDef,
  UnitModule,
  CombatHooks,
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
  F: { label: "F", color: "#888888" },
  E: { label: "E", color: "#60a060" },
  D: { label: "D", color: "#50a0e0" },
  C: { label: "C", color: "#c080f0" },
  B: { label: "B", color: "#f0c040" },
  A: { label: "A", color: "#f06040" },
  S: { label: "S", color: "#ff4060" },
  SS: { label: "SS", color: "#ff2080" },
  SSS: { label: "SSS", color: "#ff10f0" },
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



// Build combat map: trait -> combat hooks
export const COMBAT_MAP: Record<string, CombatHooks> = {};
for (const [_key, mod] of Object.entries(UNITS)) {
  if (mod.combat) COMBAT_MAP[mod.def.trait] = mod.combat;
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
