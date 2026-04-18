// Crowd-control effect definitions.

import type { EffectDef, EffectBearer, EffectContext } from './types';
import type { IUnit } from '../../../types';

type StunFxDispatcher = (target: IUnit) => void;
let _stunFxDispatcher: StunFxDispatcher = () => {};
export function setStunFxDispatcher(fn: StunFxDispatcher): void {
  _stunFxDispatcher = fn;
}

type StaggerFxDispatcher = (target: IUnit) => void;
let _staggerFxDispatcher: StaggerFxDispatcher = () => {};
export function setStaggerFxDispatcher(fn: StaggerFxDispatcher): void {
  _staggerFxDispatcher = fn;
}

export const ccEffects: Record<string, EffectDef> = {
  stun: {
    name: 'stun',
    duration: 0.6,
    stackable: false,
    onHostDeath: 'cancel',
    onApply(target: EffectBearer, _ctx: EffectContext) {
      _stunFxDispatcher(target as IUnit);
    },
    tiers: {
      normal: { severity: 1 },
      weak: { severity: 1 },
      strong: { severity: 1 },
    },
  },

  slow: {
    name: 'slow',
    duration: 3,
    stackable: false,
    onHostDeath: 'cancel',
    tiers: {
      weakest: { amount: 60 },
      weaker: { amount: 50 },
      weak: { amount: 40 },
      normal: { amount: 30 },
      strong: { amount: 20 },
      stronger: { amount: 15 },
      strongest: { amount: 10 },
    },
  },

  freeze: {
    name: 'freeze',
    duration: 2,
    stackable: false,
    // Freezes clear burns on apply and block burn from landing on a frozen target.
    prevents: ['burn'],
    onHostDeath: 'cancel',
    tiers: {
      normal: { severity: 1 },
    },
  },

  fear: {
    name: 'fear',
    duration: 2,
    stackable: false,
    onHostDeath: 'cancel',
    tiers: {
      normal: { severity: 1 },
    },
  },

  // Knockback — poise accumulation + stagger. Default effect for blunt
  // damage via DEFAULT_EFFECTS; can be declared explicitly in
  // appliesEffects. Force is carried on the ActiveEffect instance from
  // the ability's tier table (ability.tiers[effectiveTier].knockForce),
  // plumbed by applyEffectsPhase. Target resistance to knockback = target
  // resistance to the ability's damage type — the tier lookup at the
  // apply site already accounts for it.
  //
  // WHY stackable: applyEffect's non-stackable dedupe would skip
  // onApply on a target already carrying the one-frame transient
  // entry, dropping poise for two-attackers-same-target-same-frame
  // hits. stackable=true forces onApply to fire per application;
  // duration=0 entries sweep at frame end via updateEffects.
  knockback: {
    name: 'knockback',
    duration: 0,
    stackable: true,
    onHostDeath: 'cancel',
    onApply(target: EffectBearer, ctx: EffectContext) {
      const u = target as IUnit;
      const force = ctx.instance.knockForce ?? 0;
      if (force <= 0) return;
      u.poiseAccum += force;
      if (u.poiseAccum >= 100) {
        const overflow = u.poiseAccum - 100;
        u.poiseAccum = 0;
        const knockDist = 142 + overflow * 0.71;
        // In-motion guard: don't restart knockback mid-slide.
        if (Math.abs(u.knockback) < 10) {
          u.knockback = -u.facing * knockDist;
          _staggerFxDispatcher(u);
        }
      }
    },
  },
};
