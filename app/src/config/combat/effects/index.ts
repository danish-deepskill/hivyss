// Effect registry barrel.

import type { EffectDef } from './types';
import { dotEffects } from './dot';
import { ccEffects } from './cc';
import { buffEffects } from './buff';
import { debuffEffects } from './debuff';
import { specialEffects } from './special';

export const EFFECTS: Record<string, EffectDef> = {
  ...dotEffects,
  ...ccEffects,
  ...buffEffects,
  ...debuffEffects,
  ...specialEffects,
};

/** Throws on unknown keys — missing keys are caller typos. */
export function lookupEffect(name: string): EffectDef {
  const def = EFFECTS[name];
  if (!def) throw new Error(`Unknown effect: ${name}`);
  return def;
}

export function hasEffect(name: string): boolean {
  return name in EFFECTS;
}

export type { EffectDef, EffectBearer, ActiveEffect, EffectContext } from './types';
