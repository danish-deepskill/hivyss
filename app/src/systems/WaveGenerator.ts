// Generates deterministic wave compositions from seed + node config
// All randomness flows through SeededRNG — same seed = same waves

import { SeededRNG } from './SeededRNG';
import { UNIT_DEFS } from '../units/registry';
import type { WaveDef } from '../types';
import type { NodeDef } from '../config/LayerDefs';

// Enemy pools per geneline, grouped by tier
interface EnemyPool {
  byTier: Record<number, string[]>;  // tier → enemy keys
}

// Build enemy pool for a geneline by scanning UNIT_DEFS
function buildEnemyPool(geneline: string): EnemyPool {
  const byTier: Record<number, string[]> = {};

  Object.entries(UNIT_DEFS).forEach(([key, def]) => {
    const isMatch = def.geneline === geneline;
    if (!isMatch) return;

    const eKey = 'e' + key;
    const tier = def.tier as number;
    if (!byTier[tier]) byTier[tier] = [];
    byTier[tier].push(eKey);
  });

  return { byTier };
}

// Get all enemy keys up to a max tier
function getEnemiesUpToTier(pool: EnemyPool, maxTier: number): string[] {
  const keys: string[] = [];
  for (let t = 0; t <= maxTier; t++) {
    if (pool.byTier[t]) keys.push(...pool.byTier[t]);
  }
  return keys;
}

// Difficulty parameters
interface DifficultyParams {
  waveCount: number;
  maxTier: number;
  intervalMin: number;
  intervalMax: number;
  enemiesMin: number;
  enemiesMax: number;
}

function getDifficultyParams(difficulty: number): DifficultyParams {
  switch (difficulty) {
    case 1: return { waveCount: 3, maxTier: 0, intervalMin: 2.5, intervalMax: 3.0, enemiesMin: 3, enemiesMax: 4 };
    case 2: return { waveCount: 4, maxTier: 1, intervalMin: 2.0, intervalMax: 2.5, enemiesMin: 4, enemiesMax: 5 };
    case 3: return { waveCount: 5, maxTier: 2, intervalMin: 1.5, intervalMax: 2.0, enemiesMin: 5, enemiesMax: 7 };
    case 4: return { waveCount: 6, maxTier: 3, intervalMin: 1.0, intervalMax: 1.5, enemiesMin: 6, enemiesMax: 8 };
    default: return { waveCount: 3, maxTier: 0, intervalMin: 2.5, intervalMax: 3.0, enemiesMin: 3, enemiesMax: 4 };
  }
}

// Generate deterministic waves for a battle node
export function generateNodeWaves(seedNum: number, nodeIndex: number, nodeDef: NodeDef): WaveDef[] {
  // Each node gets a unique but deterministic RNG by combining seed + node index
  const rng = new SeededRNG(seedNum + nodeIndex * 1000);
  const params = getDifficultyParams(nodeDef.difficulty);
  const pool = buildEnemyPool(nodeDef.geneline);
  const available = getEnemiesUpToTier(pool, params.maxTier);

  if (available.length === 0) return [];

  const waves: WaveDef[] = [];

  for (let w = 0; w < params.waveCount; w++) {
    const isLastWave = w === params.waveCount - 1;

    // Last wave is larger
    const count = isLastWave
      ? rng.nextInt(params.enemiesMax, params.enemiesMax + 2)
      : rng.nextInt(params.enemiesMin, params.enemiesMax);

    // Pick enemies from available pool
    const units: string[] = [];
    for (let i = 0; i < count; i++) {
      units.push(rng.pick(available));
    }

    // Later waves spawn faster
    const waveFrac = w / Math.max(1, params.waveCount - 1);
    const interval = params.intervalMax - waveFrac * (params.intervalMax - params.intervalMin);
    const jitter = rng.nextFloat(-0.1, 0.1);

    waves.push({
      units,
      interval: Math.max(0.5, parseFloat((interval + jitter).toFixed(2))),
    });
  }

  return waves;
}
