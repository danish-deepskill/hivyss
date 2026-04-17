// Phase 5 — effect registry static validation.
//
// Pure data tests: every shipping effect must be registered under
// its own name, must have a positive duration, and must honor its
// declared stackable / maxStacks consistency.

import { describe, it, expect } from 'vitest';
import { EFFECTS, lookupEffect, hasEffect } from '../../../../src/config/combat/effects/index';
import type { EffectDef } from '../../../../src/config/combat/effects/types';

const EXPECTED_EFFECTS = [
  // dot.ts
  'burn', 'poison', 'bleed',
  // cc.ts
  'stun', 'slow', 'freeze', 'fear',
  // buff.ts
  'atk_buff', 'speed_buff', 'shield', 'bloodlust',
  // debuff.ts
  'atk_debuff', 'armor_crack', 'marked',
  // special.ts
  'lifesteal', 'reflect', 'soul_linked', 'rally_target',
] as const;

describe('effect registry', () => {
  it('contains every expected effect name', () => {
    for (const name of EXPECTED_EFFECTS) {
      expect(hasEffect(name), `missing effect: ${name}`).toBe(true);
    }
  });

  it('every registered effect has its name field matching its key', () => {
    for (const [key, def] of Object.entries(EFFECTS)) {
      expect(def.name, `key/name mismatch: ${key}`).toBe(key);
    }
  });

  // Phase 8 F11 — `knockback` is a load-bearing placeholder with
  // `duration: 0` that ships unwired. It exists only so
  // `lookupEffect('knockback')` resolves without throwing when
  // migrated units (Bashguard, future blunt attackers) flow
  // `appliesEffects: ['knockback']` through `applyEffectsPhase`.
  // Legacy poise at `_applyDamagePhase` owns the actual stagger until
  // Phase 10 replaces the placeholder with a real onApply body.
  // See config/combat/effects/cc.ts for the full load-bearing comment.
  const PLACEHOLDER_EFFECTS_EXEMPT_FROM_DURATION = new Set(['knockback']);

  it('every registered effect has duration > 0 (placeholder effects exempt)', () => {
    for (const [key, def] of Object.entries(EFFECTS)) {
      if (PLACEHOLDER_EFFECTS_EXEMPT_FROM_DURATION.has(key)) {
        // Placeholder — verify the zero-duration contract instead.
        expect(def.duration, `${key} placeholder duration`).toBe(0);
        continue;
      }
      expect(def.duration, `${key} duration`).toBeGreaterThan(0);
    }
  });

  it('maxStacks is only set on stackable effects', () => {
    for (const [key, def] of Object.entries(EFFECTS)) {
      if (def.maxStacks !== undefined) {
        expect(def.stackable, `${key} has maxStacks but not stackable`).toBe(true);
        expect(def.maxStacks, `${key} maxStacks`).toBeGreaterThan(0);
      }
    }
  });

  it('prevents arrays reference effects that actually exist', () => {
    for (const [key, def] of Object.entries(EFFECTS)) {
      if (def.prevents) {
        for (const target of def.prevents) {
          expect(hasEffect(target), `${key} prevents nonexistent ${target}`).toBe(true);
        }
      }
    }
  });

  it('freeze prevents burn (canonical stop-rule test)', () => {
    expect(EFFECTS.freeze.prevents).toEqual(['burn']);
  });

  it('lookupEffect throws on unknown names', () => {
    expect(() => lookupEffect('__definitely_not_a_real_effect')).toThrow();
  });

  it('lookupEffect returns the registered def for known names', () => {
    const def: EffectDef = lookupEffect('burn');
    expect(def.name).toBe('burn');
    // Phase 7b Preflight 2: burn is now stackable:false (legacy
    // single-instance parity). Test asserts the post-7b shape.
    expect(def.stackable).toBe(false);
  });

  it('hasEffect is false for unknown names', () => {
    expect(hasEffect('__nope__')).toBe(false);
  });

  it('poison and bleed are stackable; burn is single-instance post-7b', () => {
    // Phase 5 shipped all three DoTs as stackable. Phase 7b
    // Preflight 2 flipped burn to stackable:false for legacy parity
    // (legacy burn is single-instance-with-timer-reset). Poison and
    // bleed remain stackable pending their own reconciliation in
    // Phase 8+ if needed.
    expect(EFFECTS.burn.stackable).toBe(false);
    expect(EFFECTS.poison.stackable).toBe(true);
    expect(EFFECTS.bleed.stackable).toBe(true);
  });

  it('every CC is non-stackable (design invariant)', () => {
    expect(EFFECTS.stun.stackable).toBe(false);
    expect(EFFECTS.slow.stackable).toBe(false);
    expect(EFFECTS.freeze.stackable).toBe(false);
    expect(EFFECTS.fear.stackable).toBe(false);
  });

  it('soul_linked has onHostDeath: trigger', () => {
    expect(EFFECTS.soul_linked.onHostDeath).toBe('trigger');
  });
});
