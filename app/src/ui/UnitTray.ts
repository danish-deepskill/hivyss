import type { UnitDef, TierDef } from '../types';
import { UNIT_DEFS, TIER_DEFS, GENELINE_DEFS } from '../units/registry';
import { EconomyManager } from '../systems/EconomyManager';
import { IncubationManager } from '../systems/IncubationManager';

interface CardEntry {
  div: HTMLDivElement;
}

// DOM-based unit card tray with cooldown bars
export class UnitTray {
  tray: HTMLElement | null;
  onSpawn: (key: string) => void;
  previews: Record<string, string>;
  deckKeys: string[];
  cards: Record<string, CardEntry>;

  constructor(onSpawn: (key: string) => void, previews: Record<string, string>, deckKeys?: string[]) {
    this.tray = document.getElementById('tray');
    this.onSpawn = onSpawn;
    this.previews = previews || {};
    this.deckKeys = deckKeys || Object.keys(UNIT_DEFS);
    this.cards = {};
    this.build();
  }

  build(): void {
    this.tray!.innerHTML = '';
    // Update grid columns based on deck size
    const cols = Math.min(this.deckKeys.length, 5);
    this.tray!.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    this.deckKeys.forEach(key => {
      const d = UNIT_DEFS[key];
      if (!d) return;
      const div = document.createElement('div');
      div.className = 'ucard';
      div.id = 'card-' + key;

      const iconHtml = this.previews[key]
        ? `<img class="uico-img" src="${this.previews[key]}" alt="${d.name}">`
        : `<div class="uico">${d.ico}</div>`;

      const tier = TIER_DEFS[d.tier] || TIER_DEFS.F;
      const gl = d.geneline ? GENELINE_DEFS[d.geneline] : null;
      const glHtml = gl
        ? ` <span style="display:inline-block;width:10px;height:10px;line-height:10px;text-align:center;border-radius:50%;background:${gl.color};color:#d4c4b0;font-size:7px;font-weight:bold;vertical-align:baseline">${gl.symbol}</span>`
        : '';
      div.innerHTML = `
        <div class="utier" style="color:${tier.color}">${tier.label}${glHtml}</div>
        ${iconHtml}
        <div class="uname">${d.name}</div>
        <div class="ucost">\u2B21${d.cost}</div>
        <div class="utag">${d.desc}</div>
      `;
      div.onclick = () => this.onSpawn(key);
      this.tray!.appendChild(div);
      this.cards[key] = { div };
    });
  }

  update(economy: EconomyManager, incubation: IncubationManager): void {
    this.deckKeys.forEach(key => {
      const d = UNIT_DEFS[key];
      if (!d) return;
      const card = this.cards[key];
      if (!card) return;
      const disabled = !economy.canAfford(d.cost) || !incubation.canQueue();
      card.div.classList.toggle('disabled', disabled);
    });
  }
}
