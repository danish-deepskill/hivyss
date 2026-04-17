// Damage-over-time effect definitions.
//
// burn uses a time-accumulator: each tier declares a fixed `chunk` of
// damage dispatched every `interval` seconds, with the remainder of dt
// carried across frames. This matches the legacy
// fixed-chunk-at-cadence model exactly. poison and bleed ship
// declaratively — their onTick bodies are future balance work.

import type { EffectDef } from './types';
import { dispatchDotDamage } from './dispatch';

export const dotEffects: Record<string, EffectDef> = {
  burn: {
    name: 'burn',
    duration: 8,
    stackable: false,
    onHostDeath: 'cancel',
    tiers: {
      weakest:   { chunk: 10, interval: 0.5 },
      weaker:    { chunk: 8,  interval: 0.5 },
      weak:      { chunk: 6,  interval: 0.5 },
      normal:    { chunk: 5,  interval: 0.5 },
      strong:    { chunk: 3,  interval: 0.5 },
      stronger:  { chunk: 2,  interval: 0.5 },
      strongest: { chunk: 1,  interval: 0.5 },
    },
    // Time-accumulator: add dt per frame; when the accumulator reaches
    // `interval`, dispatch `chunk` damage and carry the remainder
    // forward so sub-interval frames don't lose fractional time.
    onTick(target, dt, ctx) {
      const stats = ctx.instance.def.tiers?.normal;
      const chunk = stats?.chunk ?? 0;
      const interval = stats?.interval ?? 0;
      if (chunk <= 0 || interval <= 0) return;

      const accum = (ctx.instance.accumulator ?? 0) + dt;
      if (accum < interval) {
        ctx.instance.accumulator = accum;
        return;
      }

      ctx.instance.accumulator = accum - interval;
      dispatchDotDamage(ctx.instance.source, target, chunk, 'burn');
    },
  },

  poison: {
    name: 'poison',
    duration: 5,
    stackable: true,
    maxStacks: 3,
    onHostDeath: 'cancel',
    tiers: {
      normal: { dps: 3 },
      weak: { dps: 5 },
      strong: { dps: 2 },
    },
  },

  bleed: {
    name: 'bleed',
    duration: 4,
    stackable: true,
    maxStacks: 5,
    onHostDeath: 'cancel',
    tiers: {
      normal: { dps: 4 },
      weak: { dps: 6 },
    },
  },
};
