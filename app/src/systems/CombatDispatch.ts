// Combat dispatch seam — the module-level hooks by which the DETERMINISTIC,
// Phaser-free simulation hands off to installable side-effect handlers. Each is
// a singleton + setter with a NO-OP default, so tests stay deterministic (FX
// off, no triggers) while the scene / CombatSystem installs the real handlers at
// startup. Covers both PRESENTATION (heal/impact/cast FX) and GAMEPLAY routing
// (death-trigger ability queueing, DOT damage) — unified by the same
// determinism-preserving singleton+setter pattern. Pulled out of CombatSystem so
// the orchestrator stays an orchestrator (see FX_SYSTEM.md / DESIGN_PATTERNS.md).
//
// Callers go through the exported `dispatch*` functions, never the private
// singletons, so the seam's internals can't leak.

import type { IUnit, AbilityDef, CombatContext, HitFlavor } from '../types';

// --- Heal FX ---------------------------------------------------------------
// Heal-cast presentation. Pass the ACTUAL `healed` amount capped by maxHp, not
// the requested amount — a target at 95/100 healing for 20 shows "+5".
export type HealFxDispatcher = (target: IUnit, amount: number) => void;
let _healFxDispatcher: HealFxDispatcher = () => {};

export function setHealFxDispatcher(fn: HealFxDispatcher): void {
  _healFxDispatcher = fn;
}

export function dispatchHealFx(target: IUnit, amount: number): void {
  _healFxDispatcher(target, amount);
}

// --- Impact FX (per-hit) ---------------------------------------------------
/**
 * Ability impact FX seam (the FX_SYSTEM.md toehold). Fired once per damage
 * event at the impact phase with the ability's `fx` descriptor + hit center +
 * a `magnitude` scalar (e.g. damage; later cohesion for signatures). Default
 * NO-OP keeps the sim deterministic (FX off in tests) — the scene installs the
 * real FxDirector. This is the integration point, NOT the renderer.
 */
export interface ImpactFxSignal {
  ability: AbilityDef;
  x: number;
  y: number;
  magnitude: number;
}
export type ImpactFxDispatcher = (signal: ImpactFxSignal) => void;
let _impactFxDispatcher: ImpactFxDispatcher = () => {};

export function setImpactFxDispatcher(fn: ImpactFxDispatcher): void {
  _impactFxDispatcher = fn;
}

export function dispatchImpactFx(signal: ImpactFxSignal): void {
  _impactFxDispatcher(signal);
}

// --- Cast FX (per-cast, caster-anchored) -----------------------------------
/**
 * CAST FX seam — fired ONCE per ability cast at the caster (vs the per-hit
 * impact dispatcher). This is where caster-anchored signatures live: Goliath's
 * Stampede shockwave, etc. `magnitude` carries cohesion (0..1) so the visual
 * scales with the herd. No-op default → presentation-only, deterministic.
 */
export interface CastFxSignal {
  ability: AbilityDef;
  x: number;
  y: number;
  magnitude: number;
}
export type CastFxDispatcher = (signal: CastFxSignal) => void;
let _castFxDispatcher: CastFxDispatcher = () => {};

export function setCastFxDispatcher(fn: CastFxDispatcher): void {
  _castFxDispatcher = fn;
}

export function dispatchCastFx(signal: CastFxSignal): void {
  _castFxDispatcher(signal);
}

// --- Death-trigger (gameplay) ----------------------------------------------
// Death-trigger downstream dispatcher. Closure captures pipeline + alive-roster
// access; CombatSystem constructor installs it. The closure does NOT call
// resolveFrame — the outer drain loop handles it (selector-in-subscriber safety
// rule).
export type DeathTriggerDispatcher = (dyingUnit: IUnit, deathAbilityName: string) => void;
let _deathTriggerDispatcher: DeathTriggerDispatcher = () => {};

export function setDeathTriggerDispatcher(fn: DeathTriggerDispatcher): void {
  _deathTriggerDispatcher = fn;
}

export function dispatchDeathTrigger(dyingUnit: IUnit, deathAbilityName: string): void {
  _deathTriggerDispatcher(dyingUnit, deathAbilityName);
}

// --- DOT dispatcher factory (gameplay) -------------------------------------
/**
 * DOT dispatcher factory. Builds the closure CombatSystem registers
 * with `setDotDispatcher` — reads _currentCtx, save-restores
 * `_lastAttacker` around queueAbility + resolveFrame. Save-restore (not
 * set-clear) is mandatory: if a future refactor nests updateEffects
 * inside a resolve frame, set-clear would clobber the outer attacker.
 * Factored so tests can exercise the shape without CombatSystem.
 */
export interface DotDispatcherHooks {
  getCurrentCtx(): CombatContext | null;
  getLastAttacker(): IUnit | null;
  setLastAttacker(u: IUnit | null): void;
  queueAbility(
    attacker: IUnit,
    target: IUnit,
    abilityName: string,
    opts: { baseDamageOverride: number; legacyHitFlavor: HitFlavor },
  ): void;
  resolveFrame(): void;
}

export function makeDotDispatcher(
  hooks: DotDispatcherHooks,
): (attacker: unknown, target: unknown, dmg: number, flavor: HitFlavor) => void {
  return (attacker, target, dmg, flavor) => {
    const ctx = hooks.getCurrentCtx();
    if (!ctx) return; // defensive: DOT tick outside a resolve window
    const prev = hooks.getLastAttacker();
    const src = (attacker as IUnit | null) ?? (target as IUnit);
    hooks.setLastAttacker(src);
    try {
      hooks.queueAbility(src, target as IUnit, 'override_damage_event', {
        baseDamageOverride: dmg,
        legacyHitFlavor: flavor,
      });
      hooks.resolveFrame();
    } finally {
      hooks.setLastAttacker(prev);
    }
  };
}
