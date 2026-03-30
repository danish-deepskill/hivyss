// Central registry — imports all units, exports UNIT_DEFS, TIER_DEFS, COMBAT_MAP, drawUnit
import type {
  UnitDef,
  UnitModule,
  CombatHooks,
  DrawFunction,
  TierKey,
  TierDef,
  GeneLineDef,
  GeneLine,
  RenderUnit,
} from "../types";
import { drawBasicBody } from "./renderUtils";
import {
  drawBoss,
  drawShield,
  drawPoison,
  bossCombat,
  bossSummonCombat,
  bossRegenCombat,
  shieldCombat,
  poisonCombat,
} from "./enemyTraits";

import * as grub from "./grub";
import * as grunt from "./alpha/grunt";
import * as mandible from "./alpha/mandible";
import * as bombardier from "./alpha/bombardier";
import * as zephyr from "./zephyr";
import * as needler from "./alpha/needler";
import * as aphid from "./aphid";
import * as digger from "./digger";
import * as ember from "./ember";
import * as guardian from "./guardian";
import * as mantis from "./mantis";
import * as legionnaire from "./alpha/legionnaire";
import * as ravager from "./alpha/ravager";
import * as centurion from "./alpha/centurion";
import * as beetle from "./beetle";
import * as rhino from "./rhino";
import * as voltfly from "./voltfly";

// All unit modules keyed by unit ID
const UNITS: Record<string, UnitModule> = {
  grub,
  grunt,
  mandible,
  bombardier,
  zephyr,
  needler,
  aphid,
  digger,
  ember,
  guardian,
  mantis,
  legionnaire,
  ravager,
  centurion,
  beetle,
  rhino,
  voltfly,
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

// Enemy-only trait draw functions
DRAW_MAP.boss = drawBoss;
DRAW_MAP.boss_summon = drawBoss;
DRAW_MAP.boss_regen = drawBoss;
DRAW_MAP.shield = drawShield;
DRAW_MAP.poison = drawPoison;

// Build combat map: trait -> combat hooks
export const COMBAT_MAP: Record<string, CombatHooks> = {};
for (const [_key, mod] of Object.entries(UNITS)) {
  if (mod.combat) COMBAT_MAP[mod.def.trait] = mod.combat;
}

// Enemy-only trait combat hooks
COMBAT_MAP.boss = bossCombat;
COMBAT_MAP.boss_summon = bossSummonCombat;
COMBAT_MAP.boss_regen = bossRegenCombat;
COMBAT_MAP.shield = shieldCombat;
COMBAT_MAP.poison = poisonCombat;

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
