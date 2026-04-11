// Centralized run flow controller — all scene routing decisions live here
// Scenes call these functions and navigate to the returned scene
// No Phaser dependency — pure logic

import type { RunState, RunBuff } from './RunState';
import { advanceNode, advanceLayer, markNodeWon, markNodeLost, addToRoster, addBuff } from './RunState';
import { LAYER_DEFS } from '../config/LayerDefs';
import type { RewardOption } from '../config/RewardDefs';
import { generateNodeWaves } from './WaveGenerator';
import type { WaveDef } from '../types';

// Check if a node is available for the player to enter
export function isNodeAvailable(state: RunState, nodeIdx: number): boolean {
  const layer = LAYER_DEFS[state.layerKey];
  if (!layer) return false;
  const nodes = layer.nodes;

  if (state.nodeResults[nodeIdx] !== 'pending') return false;
  if (nodeIdx === 0) return true;

  for (let i = 0; i < nodes.length; i++) {
    if (!nodes[i].next.includes(nodeIdx)) continue;
    if (state.nodeResults[i] !== 'won') continue;

    // Parent is won — check if a sibling branch was already taken
    const siblingTaken = nodes[i].next.some(s => s !== nodeIdx && state.nodeResults[s] !== 'pending');
    if (siblingTaken) return false;

    return true;
  }
  return false;
}

export interface SceneTransition {
  scene: string;
  data: Record<string, unknown>;
}

// Player selects a node on the map
export function onNodeSelected(state: RunState, nodeIdx: number): SceneTransition {
  const layer = LAYER_DEFS[state.layerKey];
  const node = layer.nodes[nodeIdx];
  const updated = advanceNode(state, nodeIdx);

  if (node.type === 'vhyst') {
    const won = markNodeWon(updated);
    return { scene: 'RewardScene', data: { runState: won, geneline: node.geneline } };
  }

  const waves = generateNodeWaves(updated.seedNum, nodeIdx, node);
  return {
    scene: 'BattleScene',
    data: {
      runState: updated,
      customWaves: waves,
      runBuffs: updated.buffs,
      deck: updated.roster,
    },
  };
}

// Battle ended — player won or lost
export function onBattleResult(state: RunState, won: boolean): SceneTransition {
  if (won) {
    const updated = markNodeWon(state);
    const layer = LAYER_DEFS[updated.layerKey];
    const node = layer.nodes[updated.currentNode];
    // Go to reward screen (battle nodes give rewards)
    return { scene: 'RewardScene', data: { runState: updated, geneline: node.geneline } };
  }

  // Defeat
  if (state.mode === 'persistent') {
    return { scene: 'NodeMapScene', data: { runState: state } };
  }
  // Permadeath — run over
  return { scene: 'MainMenuScene', data: {} };
}

// Player picked a reward (or skipped)
export function onRewardPicked(state: RunState, reward?: RewardOption): SceneTransition {
  let updated = state;

  if (reward) {
    if (reward.kind === 'vyssid') {
      updated = addToRoster(updated, reward.key);
    } else {
      updated = addBuff(updated, {
        type: reward.building.type,
        name: reward.building.name,
        value: reward.building.value,
      });
    }
  }

  return proceedAfterNode(updated);
}

// Internal: determine where to go after a node is complete (reward picked or skipped)
function proceedAfterNode(state: RunState): SceneTransition {
  const layer = LAYER_DEFS[state.layerKey];
  const currentNode = layer.nodes[state.currentNode];

  // Terminal node — check for next layer
  if (currentNode.next.length === 0) {
    if (currentNode.nextLayer) {
      const nextLayerDef = LAYER_DEFS[currentNode.nextLayer];
      if (nextLayerDef) {
        const advanced = advanceLayer(state, currentNode.nextLayer, nextLayerDef.nodes.length);
        return { scene: 'NodeMapScene', data: { runState: advanced } };
      }
    }
    // No more layers — run complete
    return { scene: 'MainMenuScene', data: { runComplete: true } };
  }

  // More nodes in this layer
  return { scene: 'NodeMapScene', data: { runState: state } };
}
