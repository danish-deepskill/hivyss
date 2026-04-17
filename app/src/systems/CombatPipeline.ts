// The 7-phase event-driven damage queue.
//
//   caller → pipeline.queueAbility(attacker, target, 'name', opts)
//          → pipeline.resolveFrame()
//          → for each DamageEvent in FIFO order:
//                pre_damage → calculate → resist → modify → pre_apply
//                → apply → post_apply
//          Any subscriber can set event.cancelled = true to short-
//          circuit the rest of the chain.
//
// The pipeline itself is pure plumbing — phase subscribers hold the
// combat logic. Safety cap: 200 events per resolveFrame prevents
// runaway chains from hanging the game; dropped events log once.

import type {
  DamageEvent,
  AbilityDef,
  WorldEntity,
  HitFlavor,
} from '../types';
import type { DamageType } from '../config/combat/damageTypes';
import type { ResistanceTier } from '../config/combat/resistances';
import { lookupAbility } from '../config/combat/abilities';
import { DEFAULT_EFFECTS } from '../config/combat/defaultEffects';
import { shiftTier } from '../config/combat/resistances';
import { hitFlavorToDamageType } from './HitFlavorBridge';
import { applyModifiers } from './ModifierSystem';

export type PipelinePhase =
  | 'pre_damage'
  | 'calculate'
  | 'resist'
  | 'modify'
  | 'pre_apply'
  | 'apply'
  | 'post_apply';

export const PIPELINE_PHASES: readonly PipelinePhase[] = [
  'pre_damage',
  'calculate',
  'resist',
  'modify',
  'pre_apply',
  'apply',
  'post_apply',
] as const;

export type PhaseHandler = (event: DamageEvent) => void;

export interface QueueAbilityOpts {
  /** Pre-computed damage; bypasses the tier lookup via the fast path. */
  baseDamageOverride?: number;
  /** HitFlavor for particle / sound / apply-phase routing. */
  legacyHitFlavor?: HitFlavor;
}

/** Shape the calculate phase needs from an attacker. */
export interface CalcAttacker extends WorldEntity {
  atk?: number;
  penetration?: Partial<Record<DamageType, number>>;
}

/** Shape the calculate phase needs from a target. */
export interface CalcTarget extends WorldEntity {
  resistance?: Partial<Record<DamageType, ResistanceTier>>;
}

/**
 * Calculate phase — two paths:
 *   1. override fast path — `_baseDamageOverride` set or
 *      `ability.skipsResistance`. Uses override as baseDamage +
 *      finalDamage; effectiveTier locked to 'normal'.
 *   2. real path — `applyModifiers(attacker.atk, 'atk') × dmgMult ×
 *      targetFalloff × damageMultiplier`.
 */
export function calculatePhase(event: DamageEvent): void {
  const ability = event.ability;

  if (ability.skipsResistance || event._baseDamageOverride !== undefined) {
    const override = event._baseDamageOverride ?? 0;
    event.baseDamage = override;
    event.effectiveTier = 'normal';
    event.finalDamage = override;
    return;
  }

  if (ability.category !== 'damage') {
    event.baseDamage = 0;
    event.finalDamage = 0;
    return;
  }

  const attacker = event.attacker as CalcAttacker;
  const target = event.target as CalcTarget;
  const dmgType = ability.dmgType ?? event.dmgType;

  const baseResTier = target.resistance?.[dmgType] ?? 'normal';
  const pen = attacker.penetration?.[dmgType] ?? 0;
  const effectiveTier = shiftTier(baseResTier, -pen);

  const stats = ability.tiers?.[effectiveTier] ?? ability.tiers?.normal;
  const mult = stats?.dmgMult ?? 1;

  // `caster.atk` flows through applyModifiers so source-tagged atk
  // modifiers (Centurion rally, future atk buffs) fold into the damage
  // roll. Transparent when the attacker carries no atk modifiers.
  const rawAtk = attacker.atk ?? 0;
  const casterBase = applyModifiers(attacker, rawAtk, 'atk');
  const base = casterBase * mult;

  // Per-target falloff for multi-target abilities. Consumers:
  // Stormfly chain_lightning, Longeye piercing_shot.
  const falloff = ability.targetFalloff?.[event._targetIndex ?? 0] ?? 1.0;

  event.baseDamage = base;
  event.effectiveTier = effectiveTier;
  event.finalDamage = base * falloff * event.damageMultiplier;
}

export function resistPhase(_event: DamageEvent): void {
  // Reserved for future adaptive-resistance hooks.
}

export function modifyPhase(_event: DamageEvent): void {
  // Subscribers (variance/crit, aura, floor) are registered externally.
}

export class CombatPipeline {
  private queue: DamageEvent[] = [];
  private handlers: Record<PipelinePhase, PhaseHandler[]>;
  private _nextId: number = 0;
  private _droppedLastDrain: number = 0;

  /** Soft per-drain cap. Prevents runaway chains from hanging the game. */
  static readonly SAFETY_CAP = 200;

  constructor() {
    this.handlers = {
      pre_damage: [],
      calculate: [calculatePhase],
      resist: [resistPhase],
      modify: [modifyPhase],
      pre_apply: [],
      apply: [],
      post_apply: [],
    };
  }

  on(phase: PipelinePhase, handler: PhaseHandler): void {
    this.handlers[phase].push(handler);
  }

  off(phase: PipelinePhase, handler: PhaseHandler): boolean {
    const arr = this.handlers[phase];
    const idx = arr.indexOf(handler);
    if (idx < 0) return false;
    arr.splice(idx, 1);
    return true;
  }

  /**
   * Three-state effect resolution:
   *
   *   appliesEffects: undefined  →  DEFAULT_EFFECTS[ability.dmgType] ?? []
   *   appliesEffects: []         →  [] (explicit opt-out)
   *   appliesEffects: [...]      →  verbatim (explicit override)
   *
   * `effectChance` on the normal tier gates both explicit and default
   * paths uniformly.
   */
  private resolveEventEffects(ability: AbilityDef): string[] {
    let effects: readonly string[];
    if (ability.appliesEffects !== undefined) {
      effects = ability.appliesEffects;
    } else {
      const defaultName = ability.dmgType ? DEFAULT_EFFECTS[ability.dmgType] : undefined;
      effects = defaultName !== undefined ? [defaultName] : [];
    }
    if (effects.length === 0) return [];
    const stats = ability.tiers?.normal;
    const chance = stats?.effectChance ?? 1;
    if (chance >= 1) return effects.slice();
    if (Math.random() < chance) return effects.slice();
    return [];
  }

  /** Enqueue a DamageEvent. Does NOT drain — caller owns resolveFrame. */
  queueAbility(
    attacker: WorldEntity,
    target: WorldEntity,
    abilityName: string,
    opts: QueueAbilityOpts = {},
  ): DamageEvent {
    const ability: AbilityDef = lookupAbility(abilityName);

    // Canonical dmgType selection:
    //   1. ability.dmgType if declared
    //   2. hitFlavorToDamageType(legacyHitFlavor) for override events
    //   3. 'blunt' fallback for untyped abilities (heal/passive)
    let dmgType: DamageType = 'blunt';
    if (ability.dmgType) {
      dmgType = ability.dmgType;
    } else if (opts.legacyHitFlavor !== undefined) {
      dmgType = hitFlavorToDamageType(opts.legacyHitFlavor);
    }

    const event: DamageEvent = {
      id: ++this._nextId,
      attacker,
      target,
      ability,
      dmgType,
      baseDamage: 0,
      finalDamage: 0,
      effectiveTier: 'normal',
      effects: this.resolveEventEffects(ability),
      cancelled: false,
      isReflected: false,
      isRedirected: false,
      damageMultiplier: 1,
      _baseDamageOverride: opts.baseDamageOverride,
      _legacyHitFlavor: opts.legacyHitFlavor,
    };
    this.queue.push(event);
    return event;
  }

  /**
   * Drain the queue, running every event through all seven phases in
   * order. Pending events are shifted out, held aside, and re-prepended
   * at the end so FIFO is preserved across frames; they do NOT count
   * against the safety cap.
   */
  resolveFrame(): void {
    this._droppedLastDrain = 0;
    const held: DamageEvent[] = [];

    let drained = 0;
    while (this.queue.length > 0) {
      if (drained >= CombatPipeline.SAFETY_CAP) {
        const remaining = this.queue.length;
        this._droppedLastDrain = remaining;
        this.queue.length = 0;
        if (typeof console !== 'undefined') {
          console.warn(
            `CombatPipeline: safety cap ${CombatPipeline.SAFETY_CAP} hit, dropped ${remaining} queued events`,
          );
        }
        break;
      }
      const event = this.queue.shift()!;
      if (event.cancelled) continue;
      if (event.pending) {
        held.push(event);
        continue;
      }
      drained++;
      if (event.target.dead) continue;
      this.runPhases(event);
    }

    if (held.length > 0) {
      this.queue.unshift(...held);
    }
  }

  /** Run one event through every phase; stops on cancel. */
  private runPhases(event: DamageEvent): void {
    for (const phase of PIPELINE_PHASES) {
      if (event.cancelled) return;
      const list = this.handlers[phase];
      for (const handler of list) {
        handler(event);
        if (event.cancelled) return;
      }
    }
  }

  /** Scan queued events for Silence / Quantum-Strike style predicates. */
  findEvents(predicate: (e: DamageEvent) => boolean): DamageEvent[] {
    const out: DamageEvent[] = [];
    for (const e of this.queue) {
      if (predicate(e)) out.push(e);
    }
    return out;
  }

  /**
   * Advance pending-event countdown triggers by `dt`. Handles
   * pendingCollapseAt (time-based demotion) and onTargetMove (distance-
   * based). onTargetDamage fires from a post_apply subscriber, not here.
   */
  updatePendingEvents(dt: number): void {
    for (const e of this.queue) {
      if (e.cancelled) continue;
      if (!e.pending) continue;

      if (e.pendingCollapseAt !== undefined) {
        e.pendingCollapseAt -= dt;
        if (e.pendingCollapseAt <= 0) {
          e.pending = false;
          continue;
        }
      }

      const mv = e.pendingTriggers?.onTargetMove;
      if (mv) {
        const tx = (e.target as { x?: number }).x ?? 0;
        const ty = (e.target as { y?: number }).y ?? 0;
        const dx = tx - mv.from.x;
        const dy = ty - mv.from.y;
        const distSq = dx * dx + dy * dy;
        const thr = mv.threshold;
        if (distSq >= thr * thr) {
          e.pending = false;
        }
      }
    }
  }

  cancelEvent(id: number): boolean {
    for (const e of this.queue) {
      if (e.id === id) {
        e.cancelled = true;
        return true;
      }
    }
    return false;
  }

  clear(): void {
    this.queue.length = 0;
  }

  get size(): number {
    return this.queue.length;
  }

  get droppedLastDrain(): number {
    return this._droppedLastDrain;
  }
}
