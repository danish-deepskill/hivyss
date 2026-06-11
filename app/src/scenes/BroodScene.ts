import Phaser from 'phaser';
import { UNIT_DEFS, TIER_DEFS, GENELINE_DEFS } from '../units/registry';
import { SaveManager } from '../systems/SaveManager';
import { createRunState } from '../systems/RunState';
import type { RunMode } from '../systems/RunState';
import { createUnitCard } from '../ui/UnitCard';
import { previewDataURL } from '../ui/UnitPreviews';
import { TRAIT_DESC } from '../config/TraitDesc';

const MAX_DECK_SIZE = 10;
const RUN_DECK_SIZE = 3;

// Thin-first MVP: every run is the α geneline (VISION §10-11 — α-first). The
// Royal is the keystone — always rostered, never a pickable slot. When the
// geneline picker lands, these become the player's CHOSEN geneline + its Royal.
const RUN_GENELINE = 'alpha';
const RUN_ROYAL = 'matriarch';
// Starting brood is capped to low tiers — you begin with fodder/soldiers and
// ACQUIRE the higher-tier Elites over the run (VISION: start thin, roster grows).
const RUN_MAX_TIER = 3;

interface BroodSceneData {
  mode?: 'run';
  seed?: string;
  runMode?: RunMode;
}

function getDefaultDeck(max: number): string[] {
  const keys = Object.keys(UNIT_DEFS).filter(k => !UNIT_DEFS[k].unlock);
  return keys.slice(0, max);
}

export class BroodScene extends Phaser.Scene {
  private save!: SaveManager;
  private pool!: string[];
  private deckSize!: number;
  private selected!: Set<string>;
  private previews!: Record<string, string>;
  private cardEls!: Record<string, HTMLDivElement>;
  private deckLabel!: HTMLElement;
  private deckSlotsEl!: HTMLElement;
  private tooltip!: HTMLElement;
  private isRunMode = false;
  private runSeed = '';
  private runMode: RunMode = 'permadeath';

  constructor() {
    super('BroodScene');
  }

  create(data?: BroodSceneData): void {
    this.save = new SaveManager();
    this.isRunMode = data?.mode === 'run';
    this.runSeed = data?.seed || '';
    this.runMode = data?.runMode || 'permadeath';

    if (this.isRunMode) {
      // Run mode: pick from the geneline's low-tier (≤ RUN_MAX_TIER) non-Royal
      // vyssids. The Royal keystone is auto-prepended at START RUN below; Elites
      // and higher tiers are acquired over the run, not picked at the start.
      this.pool = Object.keys(UNIT_DEFS).filter(k => {
        const def = UNIT_DEFS[k];
        return def.geneline === RUN_GENELINE
          && def.caste !== 'royal'
          && (def.tier as number) <= RUN_MAX_TIER;
      });
      this.deckSize = Math.min(RUN_DECK_SIZE, this.pool.length);
    } else {
      this.pool = Object.keys(UNIT_DEFS);
      this.deckSize = Math.min(MAX_DECK_SIZE, this.pool.length);
    }

    let savedDeck = this.save.getDeck().filter(k => this.pool.includes(k));
    if (savedDeck.length === 0) savedDeck = getDefaultDeck(this.deckSize).filter(k => this.pool.includes(k));
    this.selected = new Set(savedDeck.slice(0, this.deckSize));

    this.previews = this.generatePreviews();

    const outer = document.createElement('div');
    outer.style.cssText = 'width:1280px; height:720px; position:relative; pointer-events:none; font-family:"Courier New",monospace; color:#ddd; overflow:hidden;';

    // Tooltip (absolutely positioned, updated on mousemove)
    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = 'position:absolute; display:none; background:#0a0a18; border:1px solid #444466; border-radius:6px; padding:10px 14px; z-index:200; pointer-events:none; width:280px;';
    outer.appendChild(this.tooltip);

    // Main panel
    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute; inset:0; display:flex; flex-direction:column;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'flex-shrink:0; display:flex; align-items:center; padding:8px 14px; background:#09090e; border-bottom:1px solid #1a1a28; pointer-events:auto;';

    const title = document.createElement('span');
    title.style.cssText = 'font-family:"Press Start 2P",monospace; font-size:13px; color:#f0c040; letter-spacing:2px;';
    title.textContent = this.isRunMode ? 'PICK 3 STARTING VYSSIDS' : 'SELECT VYSSIDS';

    const spacer = document.createElement('div');
    spacer.style.cssText = 'flex:1;';

    const backBtn = document.createElement('button');
    backBtn.style.cssText = 'font-family:"Press Start 2P",monospace; font-size:10px; color:#888; background:#0a0a14; border:1px solid #333; border-radius:3px; padding:6px 14px; cursor:pointer;';
    backBtn.textContent = this.isRunMode ? 'START RUN' : 'BACK';
    backBtn.style.color = this.isRunMode ? '#f0c040' : '#888';
    backBtn.onmouseenter = () => { backBtn.style.color = this.isRunMode ? '#ffe080' : '#ccc'; };
    backBtn.onmouseleave = () => { backBtn.style.color = this.isRunMode ? '#f0c040' : '#888'; };
    backBtn.onclick = () => {
      if (this.isRunMode) {
        if (this.selected.size < this.deckSize) return; // must pick all slots
        // Royal is the keystone (VISION §2) — always rostered, not a picked slot.
        const state = createRunState(this.runSeed, [RUN_ROYAL, ...this.selected], this.runMode);
        this.scene.start('NodeMapScene', { runState: state });
      } else {
        this.save.setDeck([...this.selected]);
        this.scene.start('MainMenuScene');
      }
    };

    header.append(title, spacer, backBtn);
    panel.appendChild(header);

    // Selected strip
    const stripArea = document.createElement('div');
    stripArea.style.cssText = 'flex-shrink:0; background:#09090e; padding:0 10px 6px; pointer-events:auto;';

    this.deckSlotsEl = document.createElement('div');
    this.deckSlotsEl.style.cssText = 'display:flex; justify-content:center; gap:6px; flex-wrap:wrap; padding:10px;';

    this.deckLabel = document.createElement('div');
    this.deckLabel.style.cssText = 'font-family:"Press Start 2P",monospace; font-size:9px; color:#f0c040; letter-spacing:1px; text-align:center;';

    stripArea.append(this.deckSlotsEl, this.deckLabel);
    panel.appendChild(stripArea);

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'flex-shrink:0; height:1px; background:#1a1a28; margin:8px 0;';
    panel.appendChild(sep);

    // Pool area (scrollable grid)
    const poolArea = document.createElement('div');
    poolArea.style.cssText = 'flex:1; overflow-y:auto; padding:8px; pointer-events:auto;';

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(90px, 1fr)); gap:6px;';

    this.cardEls = {};
    this.pool.forEach(key => {
      const card = createUnitCard(key, {
        preview: this.previews[key],
        onClick: () => this.toggleUnit(key),
      });
      card.onmouseenter = (e: MouseEvent) => this.showTooltip(key, e);
      card.onmousemove = (e: MouseEvent) => this.positionTooltip(e);
      card.onmouseleave = () => this.hideTooltip();
      grid.appendChild(card);
      this.cardEls[key] = card;
    });

    poolArea.appendChild(grid);
    panel.appendChild(poolArea);

    outer.appendChild(panel);
    this.add.dom(640, 360, outer);

    this.input.keyboard!.on('keydown-ESC', () => {
      if (!this.isRunMode) this.save.setDeck([...this.selected]);
      this.scene.start('MainMenuScene');
    });

    this.events.once('shutdown', () => {
      this.input.keyboard!.removeAllListeners();
    });

    this.updateDeck();
  }

  private generatePreviews(): Record<string, string> {
    // Shared preview renderer — 2× upscale + symmetric padding for the
    // larger card thumbnails (same procedural draw as the battle HUD).
    const previews: Record<string, string> = {};
    const TEX_SCALE = 2;
    const pad = Math.round(11 * TEX_SCALE);
    this.pool.forEach(key => {
      const def = UNIT_DEFS[key];
      previews[key] = previewDataURL(this, key, def, { scale: TEX_SCALE, padTop: pad, padBottom: pad });
    });
    return previews;
  }

  private toggleUnit(key: string): void {
    if (this.selected.has(key)) {
      this.selected.delete(key);
    } else {
      if (this.selected.size >= this.deckSize) return;
      this.selected.add(key);
    }
    this.updateDeck();
  }

  private updateDeck(): void {
    const full = this.selected.size >= this.deckSize;

    // Rebuild selected strip
    this.deckSlotsEl.innerHTML = '';
    [...this.selected].forEach(key => {
      const card = createUnitCard(key, {
        preview: this.previews[key],
        onClick: () => { this.selected.delete(key); this.updateDeck(); },
      });
      card.classList.add('selected');
      this.deckSlotsEl.appendChild(card);
    });
    for (let i = this.selected.size; i < this.deckSize; i++) {
      const empty = document.createElement('div');
      empty.style.cssText = 'width:90px; height:80px; border:1px dashed #333; border-radius:4px; background:#0e0e14; flex-shrink:0;';
      this.deckSlotsEl.appendChild(empty);
    }

    this.deckLabel.textContent = this.isRunMode
      ? `STARTING BROOD (${this.selected.size}/${this.deckSize})`
      : `VYSSIDS (${this.selected.size}/${this.deckSize})`;
    this.deckLabel.style.color = full ? '#60c040' : '#f0c040';

    // Update pool card states
    this.pool.forEach(key => {
      const card = this.cardEls[key];
      if (!card) return;
      card.classList.toggle('selected', this.selected.has(key));
      card.classList.toggle('disabled', !this.selected.has(key) && full);
    });
  }

  private showTooltip(key: string, e: MouseEvent): void {
    const def = UNIT_DEFS[key];
    const dps = (def.atk * def.atkRate).toFixed(1);
    const tierLbl = (TIER_DEFS[def.tier] || TIER_DEFS[0]).label;
    const glTag = def.geneline !== 'normal' ? ` ${GENELINE_DEFS[def.geneline]?.symbol ?? ''}` : '';

    let traitText = TRAIT_DESC[def.trait] || def.desc;
    if (def.trait === 'ranged') traitText = `Attacks from ${def.range}px range`;
    else if (def.trait === 'sniper') traitText = `Extreme ${def.range}px range, pierces 2 enemies`;

    this.tooltip.innerHTML = `
      <div style="font-size:13px;font-weight:bold;color:#ffe080;margin-bottom:4px">${def.name}&nbsp;&nbsp;[${tierLbl}]${glTag}</div>
      <div style="font-size:12px;color:#ccc;margin-bottom:2px">HP: ${def.hp} &nbsp; ATK: ${def.atk} &nbsp; DPS: ${dps}</div>
      <div style="font-size:11px;color:#999;margin-bottom:2px">Spd: ${def.spd} &nbsp; Range: ${def.range} &nbsp; Rate: ${def.atkRate}/s</div>
      <div style="font-size:11px;color:#f0c040;margin-bottom:4px">Cost: &#x2B21;${def.cost} &nbsp; Incubation: ${def.incubation}s</div>
      <div style="font-size:11px;color:#80c0ff">${traitText}</div>
    `;
    this.tooltip.style.display = 'block';
    this.positionTooltip(e);
  }

  private positionTooltip(e: MouseEvent): void {
    const rect = (this.tooltip.parentElement as HTMLElement).getBoundingClientRect();
    const scale = rect.width / 1280;
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;

    const tw = 280;
    const th = 130;
    let tx = mx + 14;
    let ty = my - 20;
    if (tx + tw > 1276) tx = mx - tw - 14;
    if (tx < 4) tx = 4;
    if (ty + th > 716) ty = my - th - 4;
    if (ty < 4) ty = 4;

    this.tooltip.style.left = tx + 'px';
    this.tooltip.style.top = ty + 'px';
  }

  private hideTooltip(): void {
    this.tooltip.style.display = 'none';
  }
}
