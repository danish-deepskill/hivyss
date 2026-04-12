// Data-driven layer definitions — one entry per layer variant
// Adding a new layer = adding data here, no code changes

import type { AIPersonality } from '../types';

export interface NodeDef {
  type: 'battle' | 'vhyst';
  geneline: string;           // enemy geneline ('normal', 'alpha', etc.)
  difficulty: number;         // controls waves, enemy tier, composition, speed
  next: number[];             // indices into nodes array (branching)
  nextLayer?: string;         // terminal nodes: which layer variant follows
  preview: string;            // player-facing label
  aiPersonality?: AIPersonality; // override seed-picked personality for specific nodes
}

export interface LayerDef {
  layer: number;
  nodes: NodeDef[];           // index 0 = start node
}

export const LAYER_DEFS: Record<string, LayerDef> = {
  '1': {
    layer: 1,
    nodes: [
      // Node 0: first battle, normal enemies, easy
      { type: 'battle', geneline: 'normal', difficulty: 1, next: [1, 2], preview: 'Normal Hive' },
      // Node 1: harder normal battle (branch A)
      { type: 'battle', geneline: 'normal', difficulty: 2, next: [3], preview: 'Normal Hive' },
      // Node 2: vhyst — free reward, no battle (branch B)
      { type: 'vhyst',  geneline: 'normal', difficulty: 0, next: [3], preview: 'Vhyst' },
      // Node 3: alpha enemies appear
      { type: 'battle', geneline: 'alpha',  difficulty: 3, next: [4, 5], preview: 'Alpha Hive' },
      // Node 4: alpha harder (branch A → Layer 2A)
      { type: 'battle', geneline: 'alpha',  difficulty: 4, next: [], nextLayer: '2A', preview: 'Alpha Hive' },
      // Node 5: alpha harder (branch B → Layer 2B)
      { type: 'battle', geneline: 'alpha',  difficulty: 4, next: [], nextLayer: '2B', preview: 'Alpha Hive' },
    ],
  },
};
