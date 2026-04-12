// Generates a deterministic HiveProfile from seed + NodeDef
// Pure function — no Phaser dependency

import { SeededRNG } from './SeededRNG';
import { UNIT_DEFS } from '../units/registry';
import type { HiveProfile, AIPersonality } from '../types';
import type { NodeDef } from '../config/LayerDefs';

interface DifficultyParams {
  maxTier: number;
  rosterSize: number;
  startNectar: number;
  baseIncome: number;
  maxIncome: number;
  incomeRampTime: number;
}

function getDifficultyParams(difficulty: number): DifficultyParams {
  switch (difficulty) {
    case 1: return { maxTier: 1, rosterSize: 3, startNectar: 60, baseIncome: 6, maxIncome: 18, incomeRampTime: 40 };
    case 2: return { maxTier: 2, rosterSize: 4, startNectar: 80, baseIncome: 8, maxIncome: 24, incomeRampTime: 35 };
    case 3: return { maxTier: 3, rosterSize: 6, startNectar: 100, baseIncome: 10, maxIncome: 28, incomeRampTime: 30 };
    case 4: return { maxTier: 4, rosterSize: 8, startNectar: 120, baseIncome: 12, maxIncome: 30, incomeRampTime: 25 };
    default: return { maxTier: 1, rosterSize: 3, startNectar: 60, baseIncome: 6, maxIncome: 18, incomeRampTime: 40 };
  }
}

export function generateHiveProfile(seedNum: number, nodeIndex: number, nodeDef: NodeDef): HiveProfile {
  const rng = new SeededRNG(seedNum + nodeIndex * 1000);
  const params = getDifficultyParams(nodeDef.difficulty);

  // Build enemy pool by geneline and tier
  const pool: string[] = [];
  Object.entries(UNIT_DEFS).forEach(([key, def]) => {
    const isMatch = nodeDef.geneline === 'normal' ? !def.geneline : def.geneline === nodeDef.geneline;
    if (!isMatch) return;
    if ((def.tier as number) > params.maxTier) return;
    pool.push('e' + key);
  });

  // Pick roster from pool
  const shuffled = rng.shuffle([...pool]);
  const roster = shuffled.slice(0, Math.min(params.rosterSize, shuffled.length));

  // Pick personality (or use override from NodeDef)
  const personality: AIPersonality = (nodeDef as any).aiPersonality
    || rng.pick(['aggressive', 'defensive', 'swarm'] as AIPersonality[]);

  return {
    roster,
    personality,
    startNectar: params.startNectar,
    baseIncome: params.baseIncome,
    maxIncome: params.maxIncome,
    incomeRampTime: params.incomeRampTime,
  };
}
