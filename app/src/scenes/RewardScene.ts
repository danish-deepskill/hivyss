import Phaser from 'phaser';
import { UNIT_DEFS, TIER_DEFS } from '../units/registry';
import { LAYER_DEFS } from '../config/LayerDefs';
import { generateRewards } from '../config/RewardDefs';
import type { RewardOption } from '../config/RewardDefs';
import { SeededRNG } from '../systems/SeededRNG';
import type { RunState } from '../systems/RunState';
import { onRewardPicked } from '../systems/RunController';

interface RewardSceneData {
  runState: RunState;
  geneline?: string;
}

export class RewardScene extends Phaser.Scene {
  private runState!: RunState;

  constructor() {
    super('RewardScene');
  }

  create(data: RewardSceneData): void {
    this.runState = data.runState;

    // Generate rewards using seeded RNG
    const rewardSeed = this.runState.seedNum + this.runState.currentNode * 7777;
    const rng = new SeededRNG(rewardSeed);
    const geneline = data.geneline || this.getNodeGeneline();
    const rewards = generateRewards(rng, geneline, this.runState.roster);

    const outer = document.createElement('div');
    outer.style.cssText = 'width:1280px; height:720px; position:relative; pointer-events:none; font-family:"Courier New",monospace; color:#ddd; overflow:hidden;';

    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; background:rgba(0,0,0,0.85); pointer-events:auto;';

    // Title
    const title = document.createElement('div');
    title.style.cssText = 'font-family:"Press Start 2P",monospace; font-size:16px; color:#f0c040; letter-spacing:2px;';
    title.textContent = 'CHOOSE REWARD';
    panel.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-size:12px; color:#666;';
    subtitle.textContent = 'Pick 1 of 3';
    panel.appendChild(subtitle);

    // Reward cards row
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:20px; justify-content:center;';

    rewards.forEach(reward => {
      const card = this.createRewardCard(reward, () => this.pickReward(reward));
      row.appendChild(card);
    });

    panel.appendChild(row);

    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.style.cssText = 'font-family:"Press Start 2P",monospace; font-size:9px; color:#555; background:transparent; border:1px solid #333; border-radius:3px; padding:6px 16px; cursor:pointer; margin-top:10px;';
    skipBtn.textContent = 'SKIP';
    skipBtn.onmouseenter = () => { skipBtn.style.color = '#888'; };
    skipBtn.onmouseleave = () => { skipBtn.style.color = '#555'; };
    skipBtn.onclick = () => this.skip();
    panel.appendChild(skipBtn);

    outer.appendChild(panel);
    this.add.dom(640, 360, outer);
  }

  private getNodeGeneline(): string {
    const layer = LAYER_DEFS[this.runState.layerKey];
    if (!layer) return 'normal';
    const node = layer.nodes[this.runState.currentNode];
    return node?.geneline || 'normal';
  }

  private createRewardCard(reward: RewardOption, onClick: () => void): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText = 'width:160px; background:#0e0e1a; border:2px solid #333; border-radius:6px; padding:12px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:8px; transition:border-color 0.15s;';
    card.onmouseenter = () => { card.style.borderColor = '#f0c040'; };
    card.onmouseleave = () => { card.style.borderColor = '#333'; };
    card.onclick = onClick;

    if (reward.kind === 'vyssid') {
      const def = UNIT_DEFS[reward.key];
      const tier = TIER_DEFS[def.tier as keyof typeof TIER_DEFS];

      const badge = document.createElement('div');
      badge.style.cssText = `font-family:"Press Start 2P",monospace; font-size:8px; color:${tier?.color || '#888'};`;
      badge.textContent = `${tier?.label || '?'} Tier`;
      card.appendChild(badge);

      const name = document.createElement('div');
      name.style.cssText = 'font-family:"Press Start 2P",monospace; font-size:11px; color:#ffe080; text-align:center;';
      name.textContent = def.name;
      card.appendChild(name);

      const stats = document.createElement('div');
      stats.style.cssText = 'font-size:10px; color:#999; text-align:center;';
      stats.textContent = `HP:${def.hp} ATK:${def.atk}`;
      card.appendChild(stats);

      const cost = document.createElement('div');
      cost.style.cssText = 'font-size:10px; color:#f0c040;';
      cost.textContent = `${def.cost}n`;
      card.appendChild(cost);

      const label = document.createElement('div');
      label.style.cssText = 'font-size:9px; color:#60c040; margin-top:4px;';
      label.textContent = 'New Vyssid';
      card.appendChild(label);
    } else {
      const icon = document.createElement('div');
      icon.style.cssText = 'font-size:24px;';
      icon.textContent = '\u{1F33C}'; // flower for nectar
      card.appendChild(icon);

      const name = document.createElement('div');
      name.style.cssText = 'font-family:"Press Start 2P",monospace; font-size:11px; color:#80c0ff; text-align:center;';
      name.textContent = reward.building.name;
      card.appendChild(name);

      const desc = document.createElement('div');
      desc.style.cssText = 'font-size:10px; color:#999; text-align:center;';
      desc.textContent = reward.building.desc;
      card.appendChild(desc);

      const label = document.createElement('div');
      label.style.cssText = 'font-size:9px; color:#80c0ff; margin-top:4px;';
      label.textContent = 'Hive Building';
      card.appendChild(label);
    }

    return card;
  }

  private pickReward(reward: RewardOption): void {
    const transition = onRewardPicked(this.runState, reward);
    this.scene.start(transition.scene, transition.data);
  }

  private skip(): void {
    const transition = onRewardPicked(this.runState);
    this.scene.start(transition.scene, transition.data);
  }
}
