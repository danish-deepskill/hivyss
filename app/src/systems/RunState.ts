// Pure data interface + factory functions for roguelike run state
// No Phaser dependency — just data and logic

import { seedFromString } from './SeededRNG';
import { LAYER_DEFS } from '../config/LayerDefs';

export type NodeResult = 'pending' | 'won' | 'lost';
export type RunMode = 'permadeath' | 'persistent';

export interface RunBuff {
  type: string;    // e.g. 'nectar_income'
  name: string;    // e.g. 'Nectar Bloom'
  value: number;   // e.g. 2 (meaning +2/s)
}

export interface RunState {
  seed: string;                // display seed "HVS-XXXX-XXXX"
  seedNum: number;             // numeric seed derived from string
  mode: RunMode;               // permadeath or persistent (retry on defeat)
  layer: number;               // current layer (1 for Layer 1)
  currentNode: number;         // 0-based index into current layer's nodes
  layerKey: string;            // key into LAYER_DEFS (e.g. '1', '2A', '2B')
  roster: string[];            // unique vyssid keys in brood
  nodeResults: NodeResult[];   // per-node outcome for current layer
  buffs: RunBuff[];            // hive building upgrades earned this run
}

export function createRunState(seed: string, roster: string[], mode: RunMode = 'permadeath'): RunState {
  const layerKey = '1';
  const layer = LAYER_DEFS[layerKey];
  const nodeCount = layer ? layer.nodes.length : 4;
  return {
    seed,
    seedNum: seedFromString(seed),
    mode,
    layer: 1,
    currentNode: 0,
    layerKey,
    roster: [...roster],
    nodeResults: Array.from({ length: nodeCount }, () => 'pending' as NodeResult),
    buffs: [],
  };
}

export function markNodeWon(state: RunState): RunState {
  const results = [...state.nodeResults];
  results[state.currentNode] = 'won';
  return { ...state, nodeResults: results };
}

export function markNodeLost(state: RunState): RunState {
  const results = [...state.nodeResults];
  results[state.currentNode] = 'lost';
  return { ...state, nodeResults: results };
}

// Advance to a specific next node (player chose a branch)
export function advanceNode(state: RunState, nextNodeIndex: number): RunState {
  return { ...state, currentNode: nextNodeIndex };
}

// Add a buff to the run
export function addBuff(state: RunState, buff: RunBuff): RunState {
  return { ...state, buffs: [...state.buffs, buff] };
}

// Add a vyssid to the roster (no duplicates)
export function addToRoster(state: RunState, key: string): RunState {
  if (state.roster.includes(key)) return state;
  return { ...state, roster: [...state.roster, key] };
}

// Swap a roster vyssid (when at cap)
export function swapInRoster(state: RunState, removeKey: string, addKey: string): RunState {
  const roster = state.roster.map(k => k === removeKey ? addKey : k);
  return { ...state, roster };
}

// Advance to next layer (after completing terminal node)
export function advanceLayer(state: RunState, nextLayerKey: string, nodeCount: number): RunState {
  return {
    ...state,
    layer: state.layer + 1,
    layerKey: nextLayerKey,
    currentNode: 0,
    nodeResults: Array.from({ length: nodeCount }, () => 'pending' as NodeResult),
  };
}

// Check if current layer is complete (all reachable nodes won, current is terminal)
export function isLayerComplete(state: RunState): boolean {
  // A layer is complete when the current node has been won and has no next nodes
  // This is checked by NodeMapScene using LayerDefs
  return state.nodeResults[state.currentNode] === 'won';
}

export function isRunFailed(state: RunState): boolean {
  return state.mode === 'permadeath' && state.nodeResults.some(r => r === 'lost');
}
