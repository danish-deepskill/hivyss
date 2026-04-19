// Reward definitions — hive buildings + reward pool generation
// Used by RewardScene after completing a node

import { SeededRNG } from '../systems/SeededRNG';
import { UNIT_DEFS } from '../units/registry';

export interface HiveBuildingDef {
  type: string;
  name: string;
  desc: string;
  value: number;
}

export type RewardOption =
  | { kind: 'vyssid'; key: string; name: string }
  | { kind: 'building'; building: HiveBuildingDef };

// Hive building upgrades available as rewards
export const HIVE_BUILDINGS: HiveBuildingDef[] = [
  { type: 'nectar_income', name: 'Nectar Bloom', desc: '+2 nectar/s', value: 2 },
];

// Get available vyssids from a geneline that the player doesn't already own
function getAvailableVyssids(geneline: string, roster: string[]): string[] {
  const rosterSet = new Set(roster);
  return Object.entries(UNIT_DEFS)
    .filter(([key, def]) => {
      if (rosterSet.has(key)) return false;
      return def.geneline === geneline;
    })
    .map(([key]) => key);
}

// Generate 3 reward options — mix of vyssids and hive buildings
export function generateRewards(rng: SeededRNG, geneline: string, roster: string[]): RewardOption[] {
  const available = getAvailableVyssids(geneline, roster);
  const options: RewardOption[] = [];

  // Shuffle available vyssids
  const shuffled = rng.shuffle([...available]);

  // Shuffle available buildings (exclude already-owned types that are at max stacks)
  const buildingPool = [...HIVE_BUILDINGS];
  const shuffledBuildings = rng.shuffle(buildingPool);

  // Fill 3 slots: prefer vyssids, fill rest with buildings
  let vIdx = 0;
  let bIdx = 0;

  for (let i = 0; i < 3; i++) {
    // ~60% chance vyssid if available, otherwise building
    if (vIdx < shuffled.length && (rng.next() < 0.6 || bIdx >= shuffledBuildings.length)) {
      const key = shuffled[vIdx++];
      options.push({ kind: 'vyssid', key, name: UNIT_DEFS[key].name });
    } else if (bIdx < shuffledBuildings.length) {
      options.push({ kind: 'building', building: shuffledBuildings[bIdx++] });
    } else if (vIdx < shuffled.length) {
      const key = shuffled[vIdx++];
      options.push({ kind: 'vyssid', key, name: UNIT_DEFS[key].name });
    }
  }

  // If we still don't have 3 (extremely unlikely — only if no vyssids and few buildings)
  // pad with remaining buildings or vyssids
  while (options.length < 3 && bIdx < shuffledBuildings.length) {
    options.push({ kind: 'building', building: shuffledBuildings[bIdx++] });
  }
  while (options.length < 3 && vIdx < shuffled.length) {
    const key = shuffled[vIdx++];
    options.push({ kind: 'vyssid', key, name: UNIT_DEFS[key].name });
  }

  return options;
}
