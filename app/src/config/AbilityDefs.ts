import type { PlayerAbilityDef, PlayerAbilityKey } from '../types';

// Hive ability definitions. `cost` is in VYSS (the battle's tactical
// currency \u2014 see VyssDefs): the command layer is fueled by the fight, not
// the nectar wallet, so abilities flow with battle intensity.
export const ABILITY_DEFS: Record<PlayerAbilityKey, PlayerAbilityDef> = {
  nuke: {
    name: 'Acid Nuke', icon: '\u2622',
    cost: 25, cooldown: 25,
    damage: 80, baseDmg: 30,
    desc: 'Dmg all enemies',
  },
  wall: {
    name: 'Steel Wall', icon: '\u{1F9F1}',
    cost: 18, cooldown: 20,
    duration: 4,
    desc: 'Invincible 4s',
  },
  slow: {
    name: 'Pheromone', icon: '\u{1F33F}',
    cost: 15, cooldown: 18,
    duration: 5, speedMult: 0.45,
    desc: 'Slow enemies 5s',
  },
  repair: {
    name: 'Repair', icon: '\u{1F527}',
    cost: 12, cooldown: 15,
    healAmount: 80,
    desc: 'Restore 80 HP',
  },
};
