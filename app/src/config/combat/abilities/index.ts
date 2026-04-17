// Ability registry barrel.

import type { AbilityDef } from '../../../types';

import { sharpAbilities } from './sharp';
import { bluntAbilities } from './blunt';
import { heatAbilities } from './heat';
import { coldAbilities } from './cold';
import { toxicAbilities } from './toxic';
import { electricAbilities } from './electric';
import { psychicAbilities } from './psychic';
import { voidAbilities } from './void';
import { holyAbilities } from './holy';
import { utilityAbilities } from './utility';
import { overrideAbilities } from './override';

export const ABILITIES: Record<string, AbilityDef> = {
  ...sharpAbilities,
  ...bluntAbilities,
  ...heatAbilities,
  ...coldAbilities,
  ...toxicAbilities,
  ...electricAbilities,
  ...psychicAbilities,
  ...voidAbilities,
  ...holyAbilities,
  ...utilityAbilities,
  ...overrideAbilities,
};

/** Throws on unknown keys — missing keys are caller typos. */
export function lookupAbility(name: string): AbilityDef {
  const ability = ABILITIES[name];
  if (!ability) throw new Error(`Unknown ability: ${name}`);
  return ability;
}

export function hasAbility(name: string): boolean {
  return name in ABILITIES;
}
