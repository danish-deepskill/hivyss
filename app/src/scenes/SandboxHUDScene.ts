import Phaser from 'phaser';
import { UNIT_DEFS, GENELINES, TIER_DEFS, GENELINE_DEFS } from '../units/registry';
import { EventBus } from '../systems/EventBus';
import { deleteUserPreset, loadUserPresets } from '../systems/SandboxPresets';
import { createUnitCard } from '../ui/UnitCard';
import { TRAIT_DESC } from '../config/TraitDesc';
import type { GeneLine } from '../types';

/**
 * HUD sibling for SandboxScene. All UI is DOM — mirrors MenuUIScene's
 * pattern: raw `document.createElement`, inline cssText for root
 * shell, class names defined in index.html `<style>`, wrapped once
 * via `scene.add.dom(640, 360, outer)` so Phaser owns the lifecycle
 * + Scale.FIT.
 *
 * Communicates with SandboxScene via EventBus stored on the scene
 * registry under `sandbox.eventBus`.
 */
export class SandboxHUDScene extends Phaser.Scene {
  private eventBus!: EventBus;

  private selectedKey: string | null = null;
  private activeGeneline: GeneLine = 'alpha';
  private running = false;

  // DOM refs — only the elements we mutate imperatively need refs.
  private root!: HTMLDivElement;
  private selectedLabel!: HTMLDivElement;
  private countLabel!: HTMLDivElement;
  private presetSelect!: HTMLSelectElement;
  private resultLabel!: HTMLDivElement;
  private statsLabel!: HTMLDivElement;
  private rosterRow!: HTMLDivElement;
  private tooltip!: HTMLDivElement;
  private tabRefs: Map<GeneLine, HTMLButtonElement> = new Map();
  private cardRefs: Map<string, HTMLDivElement> = new Map();

  // Data-URL cache for preview textures — built once at scene create,
  // reused across tab rebuilds. Matches MenuUIScene's `previews`
  // registry pattern.
  private previewCache: Map<string, string> = new Map();

  constructor() {
    super('SandboxHUDScene');
  }

  create(): void {
    this.eventBus = this.registry.get('sandbox.eventBus');
    this.buildPreviewCache();
    this.buildDOM();
    this.wireEvents();
  }

  // ---------------------------------------------------------------
  // DOM construction
  // ---------------------------------------------------------------

  private buildPreviewCache(): void {
    for (const key of Object.keys(UNIT_DEFS)) {
      const texKey = `_sb_preview_${key}`;
      if (!this.textures.exists(texKey)) continue;
      const src = this.textures.get(texKey).getSourceImage() as HTMLCanvasElement;
      this.previewCache.set(key, src.toDataURL('image/png'));
    }
  }

  private buildDOM(): void {
    this.root = document.createElement('div');
    this.root.className = 'sb-hud';
    this.root.style.cssText = 'width:1280px;height:720px;position:relative;pointer-events:none;';

    this.root.appendChild(this.buildTopBar());
    this.root.appendChild(this.buildResultArea());
    this.root.appendChild(this.buildControlPanel());

    // Phaser's DOMElement renderer injects `pointer-events: auto`
    // onto the wrapped element every render frame. Force it to
    // 'none' here so sb-hud root doesn't capture canvas clicks.
    const wrapper = this.add.dom(640, 360, this.root);
    wrapper.pointerEvents = 'none';
  }

  private buildTopBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'sb-hud__topbar';

    const back = this.makeBtn('\u25C0 BACK', 'sb-hud__back-btn', () => {
      this.scene.stop('SandboxScene');
      this.scene.start('MainMenuScene');
    });

    const title = document.createElement('div');
    title.className = 'sb-hud__title';
    title.textContent = 'SANDBOX \u2014 CLICK UNIT TO PLACE';

    const actions = document.createElement('div');
    actions.className = 'sb-hud__actions';
    const clearBtn = this.makeBtn('\u2716 CLEAR',
      'sb-hud__action-btn sb-hud__clear-btn sb-hud__mutator',
      () => this.eventBus.emit('sandboxClear', {}));
    const fightBtn = this.makeBtn('\u2694 FIGHT',
      'sb-hud__action-btn sb-hud__fight-btn',
      () => this.eventBus.emit('sandboxFight', {}));
    const resetBtn = this.makeBtn('\u21BB RESET',
      'sb-hud__action-btn',
      () => this.eventBus.emit('sandboxReset', {}));
    actions.append(clearBtn, fightBtn, resetBtn);

    // Order: BACK (left), actions (center), title (right). Top bar
    // uses `justify-content: space-between` so the three children
    // spread cleanly across the row.
    bar.append(back, actions, title);
    return bar;
  }

  private buildResultArea(): HTMLElement {
    const area = document.createElement('div');
    area.className = 'sb-hud__result-area';
    this.resultLabel = document.createElement('div');
    this.resultLabel.className = 'sb-hud__result';
    this.statsLabel = document.createElement('div');
    this.statsLabel.className = 'sb-hud__stats';
    area.append(this.resultLabel, this.statsLabel);
    return area;
  }

  private buildControlPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'sb-hud__panel';

    // Header row: selected label + placement count (left cluster)
    // and preset dropdown (right).
    const header = document.createElement('div');
    header.className = 'sb-hud__panel-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'sb-hud__header-left';

    this.selectedLabel = document.createElement('div');
    this.selectedLabel.className = 'sb-hud__selected sb-hud__mutator';

    this.countLabel = document.createElement('div');
    this.countLabel.className = 'sb-hud__count';
    this.updateCountLabel(0, 0);

    headerLeft.append(this.selectedLabel, this.countLabel);
    header.append(headerLeft, this.buildPresetDropdown());

    // Tabs row.
    const tabs = document.createElement('div');
    tabs.className = 'sb-hud__tabs';
    this.buildTabs(tabs);

    // Roster row.
    this.rosterRow = document.createElement('div');
    this.rosterRow.className = 'sb-hud__roster';
    this.buildRoster();

    panel.append(header, tabs, this.rosterRow);
    this.updateSelectedLabel();

    // Tooltip lives at panel level so it renders on top of cards;
    // hidden by default, shown on card hover.
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'sb-hud__tooltip';
    panel.appendChild(this.tooltip);

    return panel;
  }

  private buildPresetDropdown(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'sb-hud__presets sb-hud__mutator';

    const lbl = document.createElement('span');
    lbl.className = 'sb-hud__presets-label';
    lbl.textContent = 'PRESETS:';

    this.presetSelect = document.createElement('select');
    this.presetSelect.className = 'sb-hud__preset-select';
    this.rebuildPresetOptions();

    this.presetSelect.addEventListener('change', () => {
      const val = this.presetSelect.value;
      if (!val) return;
      if (val === '__save_as__') {
        const raw = window.prompt('Save preset as:');
        const name = raw?.trim() ?? '';
        if (name) {
          this.eventBus.emit('sandboxSaveCurrentAs', { name });
        }
      } else if (val === '__delete__') {
        const saved = loadUserPresets();
        const names = saved.map((p) => p.name);
        const raw = window.prompt(
          `Delete which saved preset?\nAvailable: ${names.join(', ')}`,
        );
        const name = raw?.trim() ?? '';
        if (name && names.includes(name)) {
          deleteUserPreset(name);
          this.eventBus.emit('sandboxPresetsChanged', {});
        } else if (name) {
          console.warn(`[SandboxHUD] No saved preset named "${name}".`);
        }
      } else if (val.startsWith('saved:')) {
        const name = val.slice('saved:'.length);
        const saved = loadUserPresets().find((p) => p.name === name);
        if (saved) {
          this.eventBus.emit('sandboxLoadPreset', {
            placements: saved.placements.map((p) => ({ ...p })),
          });
        }
      }
      // Reset to placeholder so re-selecting the same preset fires
      // change again.
      this.presetSelect.value = '';
    });

    wrap.append(lbl, this.presetSelect);
    return wrap;
  }

  private rebuildPresetOptions(): void {
    this.presetSelect.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = 'Select preset\u2026';
    this.presetSelect.appendChild(placeholder);

    const saved = loadUserPresets();
    if (saved.length > 0) {
      const savedGroup = document.createElement('optgroup');
      savedGroup.label = 'Saved';
      saved.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = `saved:${p.name}`;
        opt.textContent = p.name;
        savedGroup.appendChild(opt);
      });
      this.presetSelect.appendChild(savedGroup);
    }

    const saveAsOpt = document.createElement('option');
    saveAsOpt.value = '__save_as__';
    saveAsOpt.textContent = '\u2014 Save Current As\u2026 \u2014';
    this.presetSelect.appendChild(saveAsOpt);

    // Delete action only surfaces when there's something to delete.
    if (saved.length > 0) {
      const deleteOpt = document.createElement('option');
      deleteOpt.value = '__delete__';
      deleteOpt.textContent = '\u2014 Delete saved preset\u2026 \u2014';
      this.presetSelect.appendChild(deleteOpt);
    }
  }

  private buildTabs(container: HTMLElement): void {
    const genelines = Object.keys(GENELINES).sort() as GeneLine[];
    for (const g of genelines) {
      const tab = document.createElement('button');
      tab.className = 'sb-hud__tab sb-hud__mutator';
      tab.textContent = this.genelineLabel(g);
      tab.addEventListener('click', () => {
        if (this.running) return;
        this.setActiveGeneline(g);
      });
      container.appendChild(tab);
      this.tabRefs.set(g, tab);
    }
    this.refreshTabs();
  }

  private genelineLabel(g: GeneLine): string {
    return GENELINE_DEFS[g]?.symbol ?? g;
  }

  private buildRoster(): void {
    this.rosterRow.innerHTML = '';
    this.cardRefs.clear();
    const keys = GENELINES[this.activeGeneline] ?? [];
    for (const key of keys) {
      const card = createUnitCard(key, {
        preview: this.previewCache.get(key),
        onClick: () => {
          if (this.running) return;
          this.onRosterClick(key);
        },
      });
      card.classList.add('sb-hud__mutator');
      card.onmouseenter = (e) => { if (!this.running) this.showTooltip(key, e); };
      card.onmousemove = (e) => this.positionTooltip(e);
      card.onmouseleave = () => this.hideTooltip();
      this.rosterRow.appendChild(card);
      this.cardRefs.set(key, card);
    }
  }

  // ---------------------------------------------------------------
  // Stat tooltip on roster-card hover
  // ---------------------------------------------------------------

  private showTooltip(key: string, e: MouseEvent): void {
    const def = UNIT_DEFS[key];
    const dps = (def.atk * def.atkRate).toFixed(1);
    const tierLbl = (TIER_DEFS[def.tier] || TIER_DEFS[0]).label;
    const glTag = def.geneline !== 'normal'
      ? ` ${GENELINE_DEFS[def.geneline]?.symbol ?? ''}` : '';
    let traitText = TRAIT_DESC[def.trait] || def.desc;
    if (def.trait === 'ranged') traitText = `Attacks from ${def.range}px range`;
    else if (def.trait === 'sniper') traitText = `Extreme ${def.range}px range, pierces 2 enemies`;

    this.tooltip.innerHTML = `
      <div style="font-size:13px;font-weight:bold;color:#ffe080;margin-bottom:4px">${def.name}&nbsp;&nbsp;[${tierLbl}]${glTag}</div>
      <div style="font-size:12px;color:#ccc;margin-bottom:2px">HP: ${def.hp} &nbsp; ATK: ${def.atk} &nbsp; DPS: ${dps}</div>
      <div style="font-size:11px;color:#999;margin-bottom:4px">Spd: ${def.spd} &nbsp; Range: ${def.range} &nbsp; Rate: ${def.atkRate}/s</div>
      <div style="font-size:11px;color:#80c0ff">${traitText}</div>
    `;
    this.tooltip.style.display = 'block';
    this.positionTooltip(e);
  }

  private positionTooltip(e: MouseEvent): void {
    if (this.tooltip.style.display === 'none') return;
    // Tooltip is parented to .sb-hud__panel; position relative to
    // the panel's bounding box, accounting for Scale.FIT scaling.
    const panel = this.tooltip.parentElement as HTMLElement;
    const rect = panel.getBoundingClientRect();
    const scale = rect.width / 1280;
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    const tw = 260;
    const th = 100;
    let tx = mx + 14;
    let ty = my - th - 14;
    if (tx + tw > 1276) tx = mx - tw - 14;
    if (tx < 4) tx = 4;
    if (ty < 4) ty = my + 14;
    this.tooltip.style.left = tx + 'px';
    this.tooltip.style.top = ty + 'px';
  }

  private hideTooltip(): void {
    this.tooltip.style.display = 'none';
  }

  private makeBtn(label: string, cls: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = cls;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // ---------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------

  private wireEvents(): void {
    const escHandler = () => {
      if (this.selectedKey === null) return;
      this.selectedKey = null;
      this.updateSelectedLabel();
      this.eventBus.emit('sandboxSelectUnit', { unitKey: null });
    };
    this.input.keyboard?.on('keydown-ESC', escHandler);

    const onSelect = (evt: { unitKey: string | null }) => {
      this.selectedKey = evt.unitKey;
      this.updateSelectedLabel();
    };
    const onRunning = (evt: { running: boolean }) => {
      this.running = evt.running;
      this.root.classList.toggle('sb-hud--running', evt.running);
      this.presetSelect.disabled = evt.running;
      if (evt.running && this.selectedKey !== null) {
        this.selectedKey = null;
        this.updateSelectedLabel();
        this.eventBus.emit('sandboxSelectUnit', { unitKey: null });
      }
    };
    const onResult = (evt: { result: string; message: string; color: string; timeStr: string }) => {
      this.resultLabel.textContent = evt.message;
      this.resultLabel.style.color = evt.color;
      this.statsLabel.textContent = evt.timeStr;
    };
    const onPresetsChanged = () => {
      this.rebuildPresetOptions();
    };
    const onCount = (evt: { player: number; enemy: number }) => {
      this.updateCountLabel(evt.player, evt.enemy);
    };

    this.eventBus.on('sandboxSelectUnit', onSelect);
    this.eventBus.on('sandboxRunningState', onRunning);
    this.eventBus.on('sandboxFightResult', onResult);
    this.eventBus.on('sandboxPresetsChanged', onPresetsChanged);
    this.eventBus.on('sandboxPlacementCount', onCount);

    this.events.once('shutdown', () => {
      this.eventBus.off('sandboxSelectUnit', onSelect);
      this.eventBus.off('sandboxRunningState', onRunning);
      this.eventBus.off('sandboxFightResult', onResult);
      this.eventBus.off('sandboxPresetsChanged', onPresetsChanged);
      this.eventBus.off('sandboxPlacementCount', onCount);
      this.input.keyboard?.off('keydown-ESC', escHandler);
    });
  }

  // ---------------------------------------------------------------
  // Handlers / state
  // ---------------------------------------------------------------

  private onRosterClick(key: string): void {
    const newKey = this.selectedKey === key ? null : key;
    this.selectedKey = newKey;
    this.updateSelectedLabel();
    this.eventBus.emit('sandboxSelectUnit', { unitKey: newKey });
  }

  private setActiveGeneline(g: GeneLine): void {
    if (this.activeGeneline === g) return;
    this.activeGeneline = g;
    this.refreshTabs();
    this.buildRoster();
    // Selection persists across tab flips (Session C-2 Item 3).
  }

  // ---------------------------------------------------------------
  // Visual state
  // ---------------------------------------------------------------

  private refreshTabs(): void {
    this.tabRefs.forEach((tab, g) => {
      tab.classList.toggle('sb-hud__tab--active', g === this.activeGeneline);
    });
  }

  private updateSelectedLabel(): void {
    if (!this.selectedKey) {
      this.selectedLabel.textContent = 'Selected: \u2014';
    } else {
      this.selectedLabel.textContent = `Selected: ${UNIT_DEFS[this.selectedKey].name}`;
    }
  }

  private updateCountLabel(player: number, enemy: number): void {
    this.countLabel.innerHTML =
      `<span class="sb-hud__count-p">PLAYER: ${player}</span>` +
      `&nbsp;&nbsp;` +
      `<span class="sb-hud__count-e">ENEMY: ${enemy}</span>`;
  }
}
