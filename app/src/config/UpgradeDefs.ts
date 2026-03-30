import type { UpgradeDef } from '../types';

// Persistent upgrade tree definitions
export const UPGRADE_DEFS: Record<string, UpgradeDef> = {
  baseHp: {
    name: 'Fortify Base', desc: '+50 Base HP per level',
    maxLevel: 5, costPerLevel: [100, 200, 400, 800, 1500],
    effect: { baseHp: 50 },
  },
  incomeRate: {
    name: 'Nectar Flow', desc: '+2 Income per level',
    maxLevel: 5, costPerLevel: [80, 160, 300, 600, 1200],
    effect: { income: 2 },
  },
  unitHpAll: {
    name: 'Tough Carapace', desc: '+10% Unit HP per level',
    maxLevel: 3, costPerLevel: [150, 400, 900],
    effect: { unitHpPct: 0.1 },
  },
  unitAtkAll: {
    name: 'Sharp Mandibles', desc: '+10% Unit ATK per level',
    maxLevel: 3, costPerLevel: [150, 400, 900],
    effect: { unitAtkPct: 0.1 },
  },
  unlockRavager: {
    name: 'Unlock Ravager', desc: 'Rage-fueled berserker',
    maxLevel: 1, costPerLevel: [500],
    effect: { unlock: 'ravager' },
  },
  unlockBeetle: {
    name: 'Unlock Beetle', desc: 'Frontline shield bearer',
    maxLevel: 1, costPerLevel: [600],
    effect: { unlock: 'beetle' },
  },
  unlockDigger: {
    name: 'Unlock Digger', desc: 'Burrows past enemy lines',
    maxLevel: 1, costPerLevel: [400],
    effect: { unlock: 'digger' },
  },
  unlockGuardian: {
    name: 'Unlock Guardian', desc: 'Aura reduces ally damage',
    maxLevel: 1, costPerLevel: [500],
    effect: { unlock: 'guardian' },
  },
  unlockEmber: {
    name: 'Unlock Ember', desc: 'Sets enemies on fire',
    maxLevel: 1, costPerLevel: [450],
    effect: { unlock: 'ember' },
  },
  unlockRhino: {
    name: 'Unlock Rhino', desc: 'Rams enemies backward on hit',
    maxLevel: 1, costPerLevel: [550],
    effect: { unlock: 'rhino' },
  },
  unlockVoltfly: {
    name: 'Unlock Voltfly', desc: 'Chain lightning with stun',
    maxLevel: 1, costPerLevel: [700],
    effect: { unlock: 'voltfly' },
  },
  abilityCdr: {
    name: 'Quick Glands', desc: '-10% Ability cooldowns per level',
    maxLevel: 3, costPerLevel: [200, 500, 1000],
    effect: { abilityCdrPct: 0.1 },
  },
};
