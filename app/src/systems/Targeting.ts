// Named selector library. Abilities name their target-picking strategy
// by string reference; the pipeline resolves it here against a pre-
// spatially-filtered candidate list.
//
// Selector contract:
//   caster       — the unit/entity invoking the ability
//   params       — per-ability runtime params (count, filter override)
//   candidates   — already-spatial-filtered WorldEntity[]
//
// Spatial filtering (range, route, side) happens BEFORE selector call.
// Selectors are pure over plain arrays — no index access, no Phaser.
//
// Every "acquire target" selector applies DEFAULT_COMBATANT_FILTER
// (`['HasAI']`) by default. HasAI is carried by units and nothing
// else, so a nearest-enemy selector can't accidentally target a
// projectile or zone once those become real entities. Specialized
// selectors (base-inclusive ranged) override to DEFAULT_TARGETABLE_FILTER.
// Future selectors MUST apply a filter — an unfiltered selector is a
// latent bug waiting for projectiles to land.

import type { WorldEntity, Side, ComponentTag, AbilityDef, IUnit } from '../types';
import { hasAllComponents } from './EntityComponents';
import { lookupAbility } from '../config/combat/abilities';

/** Structural contract every selector needs from an entity. */
export interface SelectorEntity extends WorldEntity {
  side?: Side;
  hp?: number;
  maxHp?: number;
}

export interface SelectorParams {
  count?: number;
  /** Override the default component filter. Pass `[]` to disable entirely. */
  componentFilter?: readonly ComponentTag[];
}

export type TargetSelector = (
  caster: SelectorEntity,
  params: SelectorParams,
  candidates: readonly SelectorEntity[],
) => SelectorEntity[];

export const DEFAULT_COMBATANT_FILTER: readonly ComponentTag[] = ['HasAI'];

/** Base-inclusive variant — `IsTargetable` catches BaseEntity (no HasAI). */
export const DEFAULT_TARGETABLE_FILTER: readonly ComponentTag[] = ['IsTargetable'];

/** Lane distance — X only. Matches SpatialIndex's sweep-and-prune axis. */
export function laneDistance(a: SelectorEntity, b: SelectorEntity): number {
  return Math.abs(a.x - b.x);
}

function filterCombatants(
  caster: SelectorEntity,
  candidates: readonly SelectorEntity[],
  allegiance: 'ally' | 'enemy' | 'any',
  componentFilter: readonly ComponentTag[],
): SelectorEntity[] {
  const out: SelectorEntity[] = [];
  for (const e of candidates) {
    if (e === caster) continue;
    if (e.dead) continue;
    if (allegiance !== 'any') {
      if (e.side === undefined) continue;
      if (allegiance === 'ally' && e.side !== caster.side) continue;
      if (allegiance === 'enemy' && e.side === caster.side) continue;
    }
    if (!hasAllComponents(e, componentFilter)) continue;
    out.push(e);
  }
  return out;
}

function sortByDistance(
  caster: SelectorEntity,
  list: readonly SelectorEntity[],
): SelectorEntity[] {
  return list.slice().sort((a, b) => laneDistance(caster, a) - laneDistance(caster, b));
}

const nearestEnemyInRange: TargetSelector = (caster, params, candidates) => {
  const filter = params.componentFilter ?? DEFAULT_COMBATANT_FILTER;
  const enemies = filterCombatants(caster, candidates, 'enemy', filter);
  if (enemies.length === 0) return [];
  const sorted = sortByDistance(caster, enemies);
  const count = params.count ?? 1;
  return sorted.slice(0, count);
};

const nearestEnemiesInRange: TargetSelector = (caster, params, candidates) => {
  const filter = params.componentFilter ?? DEFAULT_COMBATANT_FILTER;
  const enemies = filterCombatants(caster, candidates, 'enemy', filter);
  if (enemies.length === 0) return [];
  const sorted = sortByDistance(caster, enemies);
  const count = params.count ?? 3;
  return sorted.slice(0, count);
};

const allEnemiesInRange: TargetSelector = (caster, params, candidates) => {
  const filter = params.componentFilter ?? DEFAULT_COMBATANT_FILTER;
  return filterCombatants(caster, candidates, 'enemy', filter);
};

const nearestAllyInRange: TargetSelector = (caster, params, candidates) => {
  const filter = params.componentFilter ?? DEFAULT_COMBATANT_FILTER;
  const allies = filterCombatants(caster, candidates, 'ally', filter);
  if (allies.length === 0) return [];
  const sorted = sortByDistance(caster, allies);
  const count = params.count ?? 1;
  return sorted.slice(0, count);
};

const allAlliesInRange: TargetSelector = (caster, params, candidates) => {
  const filter = params.componentFilter ?? DEFAULT_COMBATANT_FILTER;
  return filterCombatants(caster, candidates, 'ally', filter);
};

const lowestHpAllyInRange: TargetSelector = (caster, params, candidates) => {
  const filter = params.componentFilter ?? DEFAULT_COMBATANT_FILTER;
  const allies = filterCombatants(caster, candidates, 'ally', filter);
  const wounded = allies.filter(a =>
    a.hp !== undefined && a.maxHp !== undefined && a.hp < a.maxHp,
  );
  if (wounded.length === 0) return [];
  const sorted = wounded.slice().sort((a, b) => {
    const fa = (a.hp as number) / (a.maxHp as number);
    const fb = (b.hp as number) / (b.maxHp as number);
    return fa - fb;
  });
  const count = params.count ?? 1;
  return sorted.slice(0, count);
};

/** Base-inclusive nearest-enemy variant — opts into targeting bases. */
const nearestTargetInRange: TargetSelector = (caster, params, candidates) => {
  const filter = params.componentFilter ?? DEFAULT_TARGETABLE_FILTER;
  const enemies = filterCombatants(caster, candidates, 'enemy', filter);
  if (enemies.length === 0) return [];
  const sorted = sortByDistance(caster, enemies);
  const count = params.count ?? 1;
  return sorted.slice(0, count);
};

const nearestTargetsInRange: TargetSelector = (caster, params, candidates) => {
  const filter = params.componentFilter ?? DEFAULT_TARGETABLE_FILTER;
  const enemies = filterCombatants(caster, candidates, 'enemy', filter);
  if (enemies.length === 0) return [];
  const sorted = sortByDistance(caster, enemies);
  const count = params.count ?? 3;
  return sorted.slice(0, count);
};

const self: TargetSelector = (caster, _params, _candidates) => {
  if (caster.dead) return [];
  return [caster];
};

/** "Target already known" sentinel for override-damage events. */
const noTargeting: TargetSelector = (_caster, _params, _candidates) => [];

export const SELECTORS: Record<string, TargetSelector> = {
  'self': self,
  'no_targeting': noTargeting,
  'nearest_enemy_in_range': nearestEnemyInRange,
  'nearest_enemies_in_range': nearestEnemiesInRange,
  'all_enemies_in_range': allEnemiesInRange,
  'nearest_ally_in_range': nearestAllyInRange,
  'all_allies_in_range': allAlliesInRange,
  'lowest_hp_ally_in_range': lowestHpAllyInRange,
  'nearest_target_in_range': nearestTargetInRange,
  'nearest_targets_in_range': nearestTargetsInRange,
};

/** Throws on missing — selector keys are static data. */
export function lookupSelector(name: string): TargetSelector {
  const sel = SELECTORS[name];
  if (!sel) throw new Error(`Unknown target selector: ${name}`);
  return sel;
}

/**
 * Production entry point — runs the named selector with the standard
 * pre-filter pipeline. Range filter uses lane distance (`Math.abs(x
 * - caster.x)`) with strict-less-than semantics (`< range` in-range,
 * `>= range` out). Universal post-selector cap enforces
 * `ability.targetCount` across every selector so `all_*` variants
 * don't return more targets than the ability asks for.
 */
export function runSelectorInRange(
  selectorName: string,
  caster: SelectorEntity,
  ability: AbilityDef,
  allAlive: readonly SelectorEntity[],
): SelectorEntity[] {
  const range = ability.range ?? Infinity;
  const cx = caster.x;
  const candidates: SelectorEntity[] = [];
  for (const e of allAlive) {
    if (Math.abs(e.x - cx) >= range) continue;
    candidates.push(e);
  }
  const selector = lookupSelector(selectorName);
  const count = ability.targetCount ?? 1;
  const params: SelectorParams = { count };
  return selector(caster, params, candidates).slice(0, count);
}

// ------------------------------------------------------------------
// Attack-resolution queries — "which foe does this swing/signature act
// on?". Pure, so they unit-test without Phaser; CombatSystem calls them.
// ------------------------------------------------------------------

/**
 * Windup-drift resolution — which foe a completed swing actually hits. Prefers
 * the target LOCKED at swing-start (so the hit commits to the lunge animation),
 * falling back to the current nearest when the locked foe died / burrowed / left
 * the lane / changed sides.
 */
export function resolveImpactTarget(locked: IUnit | null | undefined, nearest: IUnit, attacker: IUnit): IUnit {
  if (locked && !locked.dead && !locked.burrowed && locked.side !== attacker.side && locked.lane === attacker.lane) {
    return locked;
  }
  return nearest;
}

/**
 * Whiff guard — true when a DAMAGE signature has no foe in range, so firing it
 * should NOT consume the cooldown (it stays ready instead of misfiring into
 * empty air). Utility/buff signatures aren't enemy-gated → never reported here.
 */
export function signatureWouldWhiff(ability: AbilityDef, caster: IUnit, alive: IUnit[]): boolean {
  return ability.category === 'damage'
    && runSelectorInRange(ability.targeting, caster, ability, alive).length === 0;
}

/**
 * HUD "would connect" check — an enemy sits within the unit's signature range,
 * same lane, center-to-center. Drives the lit state of Elite signature slots.
 * Distinct from signatureWouldWhiff (which is lane-blind + category-gated and
 * decides whether a CAST consumes cooldown) — this is the stricter visual cue.
 */
export function signatureHasTarget(u: IUnit, units: readonly IUnit[]): boolean {
  if (!u.signatureAbility) return false;
  const ability = lookupAbility(u.signatureAbility);
  // Utility/buff signatures (Tide, Spawn-Wave, Primal Roar) aren't enemy-gated
  // — they always "have a target" (self/allies), so their slots stay firable.
  if (ability.category !== 'damage') return true;
  const range = ability.range ?? 0;
  if (range <= 0) return false;
  const ux = u.x + u.unitW / 2;
  for (const e of units) {
    if (e.side === u.side || e.dead || e.lane !== u.lane) continue;
    if (Math.abs((e.x + e.unitW / 2) - ux) < range) return true;
  }
  return false;
}
