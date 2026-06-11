import Phaser from 'phaser';
import { UNIT_DEFS, GENELINES, TIER_DEFS, GENELINE_DEFS } from '../units/registry';
import { EventBus } from '../systems/EventBus';
import { deleteUserPreset, loadUserPresets } from '../systems/SandboxPresets';
import { createUnitCard } from '../ui/UnitCard';
import { TRAIT_DESC } from '../config/TraitDesc';
import { PHEROMONE_DEFS, PHEROMONE_ORDER } from '../config/PheromoneDefs';
import type { GeneLine, PheromoneKind } from '../types';

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
  private rosterArrowL!: HTMLButtonElement;
  private rosterArrowR!: HTMLButtonElement;
  private tooltip!: HTMLDivElement;
  private tabRefs: Map<GeneLine, HTMLButtonElement> = new Map();
  private cardRefs: Map<string, HTMLDivElement> = new Map();
  private pheromoneBtns: Map<PheromoneKind, HTMLButtonElement> = new Map();

  // Elite-signature slots — one per player Elite, built lazily to match the
  // pushed slot array (= MAX_ELITES_PER_SIDE). `eliteSlots` mirrors the last
  // pushed state so a click knows which unit id (if any) to fire.
  private eliteSlotContainer!: HTMLElement;
  private eliteSlotBtns: HTMLButtonElement[] = [];
  private eliteSlots: Array<{ id: number; name: string; ready: boolean; cdFrac: number; firable: boolean; inRange: boolean } | null> = [];
  private activePheromone: PheromoneKind | null = null;

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
    header.append(headerLeft, this.buildPheromoneRow(), this.buildBiomeDropdown(), this.buildPresetDropdown());

    // Tabs row.
    const tabs = document.createElement('div');
    tabs.className = 'sb-hud__tabs';
    this.buildTabs(tabs);

    // Roster strip — a single horizontal row that scrolls (the roster grows
    // well past one screen as genelines are added). Three ways to scroll it:
    // the ‹ › arrow buttons, the mouse wheel (vertical → horizontal, since few
    // users have a horizontal wheel), and click-drag / the native thin bar.
    this.rosterRow = document.createElement('div');
    this.rosterRow.className = 'sb-hud__roster';
    this.rosterRow.addEventListener(
      'wheel',
      (e) => {
        if (e.deltaY === 0) return;
        e.preventDefault();
        this.rosterRow.scrollLeft += e.deltaY;
      },
      { passive: false },
    );
    this.rosterRow.addEventListener('scroll', () => this.updateRosterArrows());

    this.rosterArrowL = this.makeRosterArrow('‹', -1); // ‹
    this.rosterArrowR = this.makeRosterArrow('›', 1); //  ›

    const rosterWrap = document.createElement('div');
    rosterWrap.className = 'sb-hud__roster-wrap';
    rosterWrap.append(this.rosterArrowL, this.rosterRow, this.rosterArrowR);

    this.buildRoster();

    panel.append(header, tabs, rosterWrap);
    this.updateSelectedLabel();

    // Tooltip lives at panel level so it renders on top of cards;
    // hidden by default, shown on card hover.
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'sb-hud__tooltip';
    panel.appendChild(this.tooltip);

    return panel;
  }

  private buildBiomeDropdown(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'sb-hud__presets sb-hud__mutator';

    const lbl = document.createElement('span');
    lbl.className = 'sb-hud__presets-label';
    lbl.textContent = 'BIOME:';

    const select = document.createElement('select');
    select.className = 'sb-hud__preset-select';
    ([['wild', 'Wild'], ['sunCarapace', 'Sun Carapace'], ['fetidPool', 'Fetid Pool']] as const).forEach(([val, text]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      this.eventBus.emit('sandboxSelectBiome', { biome: select.value as 'wild' | 'sunCarapace' | 'fetidPool' });
    });

    wrap.append(lbl, select);
    return wrap;
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

  /**
   * Pheromone command button row — Rally / Charge / Retreat. Clicking
   * toggles the active kind (mirrors keyboard 1/2/3 in SandboxScene).
   * Buttons stay live during a fight (zones are painted mid-battle).
   * Active state is reflected via the `sandboxSelectPheromoneActive`
   * echo so keyboard + button selection stay in sync.
   */
  private buildPheromoneRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sb-hud__pheromones';
    row.style.cssText =
      'display:flex;gap:6px;align-items:center;pointer-events:auto;';

    const lbl = document.createElement('span');
    lbl.textContent = 'CMD:';
    lbl.style.cssText = 'font-size:10px;color:#aaa;margin-right:2px;';
    row.appendChild(lbl);

    PHEROMONE_ORDER.forEach((kind, i) => {
      const def = PHEROMONE_DEFS[kind];
      const hex = '#' + def.color.toString(16).padStart(6, '0');
      const btn = document.createElement('button');
      btn.className = 'sb-hud__phero-btn';
      btn.textContent = `${i + 1} ${def.name}`;
      btn.style.cssText =
        `font-size:10px;padding:3px 7px;cursor:pointer;border:1px solid ${hex};` +
        `border-radius:3px;background:#16161e;color:${hex};pointer-events:auto;`;
      btn.addEventListener('click', () => this.onPheromoneClick(kind));
      this.pheromoneBtns.set(kind, btn);
      row.appendChild(btn);
    });

    // Elite-signature SLOTS — one per player Elite (built lazily to match
    // the pushed array = MAX_ELITES_PER_SIDE). Each slot fires THAT Elite's
    // own signature; greyed while on cooldown, dim when empty/preview. The E
    // hotkey still fires all ready. Amber accent marks the Elite-active row.
    const sigLbl = document.createElement('span');
    sigLbl.textContent = 'ELITE:';
    sigLbl.style.cssText = 'font-size:10px;color:#e0a020;margin:0 2px 0 10px;';
    this.eliteSlotContainer = document.createElement('span');
    this.eliteSlotContainer.style.cssText = 'display:flex;gap:4px;align-items:center;';
    row.append(sigLbl, this.eliteSlotContainer);
    // Seed the empty-slot display (= MAX_ELITES_PER_SIDE) so the row is
    // visible from the start; state pushes correct it.
    this.updateEliteSlots([null, null, null]);

    return row;
  }

  private onEliteSlotClick(i: number): void {
    const s = this.eliteSlots[i];
    // empty / preview / on-cooldown / no enemy in range → not firable
    if (!s || !s.firable || !s.ready || !s.inRange) return;
    this.eventBus.emit('sandboxTriggerSignature', { unitId: s.id });
  }

  /** Render the pushed Elite-slot state into the slot buttons. */
  private updateEliteSlots(
    slots: Array<{ id: number; name: string; ready: boolean; cdFrac: number; firable: boolean; inRange: boolean } | null>,
  ): void {
    this.eliteSlots = slots;
    if (this.eliteSlotBtns.length !== slots.length) {
      this.eliteSlotContainer.replaceChildren();
      this.eliteSlotBtns = slots.map((_, i) => {
        const b = document.createElement('button');
        b.className = 'sb-hud__elite-slot';
        b.addEventListener('click', () => this.onEliteSlotClick(i));
        this.eliteSlotContainer.appendChild(b);
        return b;
      });
    }
    const base = 'font-size:10px;padding:3px 7px;border-radius:3px;pointer-events:auto;min-width:50px;text-align:center;';
    slots.forEach((s, i) => {
      const b = this.eliteSlotBtns[i];
      if (!s) {
        b.textContent = '—';
        b.style.cssText = base + 'border:1px dashed #444;background:#101015;color:#555;cursor:default;';
      } else if (!s.firable) {
        // Pre-fight preview — named but not yet firable.
        b.textContent = s.name;
        b.style.cssText = base + 'border:1px solid #6a5a30;background:#16161e;color:#9a8a55;cursor:default;';
      } else if (s.ready && s.inRange) {
        // Ready AND an enemy is in range — lit, clickable.
        b.textContent = '⚡ ' + s.name;
        b.style.cssText = base + 'border:1px solid #e0a020;background:#2a2010;color:#ffcf50;cursor:pointer;font-weight:bold;';
      } else if (s.ready) {
        // Off cooldown but NO enemy in range — disabled ("can't reach").
        b.textContent = s.name;
        b.style.cssText = base + 'border:1px solid #44443a;background:#16161e;color:#666;cursor:not-allowed;';
      } else {
        // On cooldown — a left-to-right fill shows recovery progress.
        const pct = Math.round((1 - s.cdFrac) * 100);
        b.textContent = s.name;
        b.style.cssText = base + 'border:1px solid #6a5a30;color:#888;cursor:default;' +
          `background:linear-gradient(90deg,#2a2316 ${pct}%,#16161e ${pct}%);`;
      }
    });
  }

  private onPheromoneClick(kind: PheromoneKind): void {
    const next = this.activePheromone === kind ? null : kind;
    // SandboxScene owns the real selection; it echoes back via
    // sandboxSelectPheromoneActive, which refreshes the button styles.
    this.eventBus.emit('sandboxSelectPheromone', { kind: next });
  }

  private refreshPheromoneButtons(): void {
    this.pheromoneBtns.forEach((btn, kind) => {
      const def = PHEROMONE_DEFS[kind];
      const hex = '#' + def.color.toString(16).padStart(6, '0');
      const active = this.activePheromone === kind;
      btn.style.background = active ? hex : '#16161e';
      btn.style.color = active ? '#000' : hex;
      btn.style.fontWeight = active ? 'bold' : 'normal';
    });
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

  /** A ‹ / › roster-scroll button that nudges the strip ~3 cards per click. */
  private makeRosterArrow(glyph: string, dir: -1 | 1): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'sb-hud__roster-arrow';
    btn.textContent = glyph;
    btn.addEventListener('click', () => {
      this.rosterRow.scrollBy({ left: dir * 288, behavior: 'smooth' });
    });
    return btn;
  }

  /**
   * Hide the arrow at whichever end the strip is already against (and hide
   * both when there's nothing to scroll). Layout-dependent, so callers defer
   * to a frame after a rebuild via requestAnimationFrame.
   */
  private updateRosterArrows(): void {
    const el = this.rosterRow;
    if (!el || !this.rosterArrowL) return;
    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    this.rosterArrowL.classList.toggle('is-hidden', atStart);
    this.rosterArrowR.classList.toggle('is-hidden', atEnd);
  }

  private buildRoster(): void {
    this.rosterRow.innerHTML = '';
    this.cardRefs.clear();
    const keys = GENELINES[this.activeGeneline] ?? [];
    for (const key of keys) {
      // Workers (Scouts) aren't roster units — they deploy via the command
      // buttons (pick Rally/Charge/Retreat → click). Keep them out of the grid.
      if (UNIT_DEFS[key]?.caste === 'worker') continue;
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
    // Arrow visibility depends on the laid-out scroll width — defer a frame.
    requestAnimationFrame(() => this.updateRosterArrows());
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
    const onPheromoneActive = (evt: { kind: PheromoneKind | null }) => {
      this.activePheromone = evt.kind;
      this.refreshPheromoneButtons();
    };
    const onEliteSlots = (evt: {
      slots: Array<{ id: number; name: string; ready: boolean; cdFrac: number; firable: boolean; inRange: boolean } | null>;
    }) => {
      this.updateEliteSlots(evt.slots);
    };

    this.eventBus.on('sandboxEliteSlots', onEliteSlots);
    this.eventBus.on('sandboxSelectUnit', onSelect);
    this.eventBus.on('sandboxRunningState', onRunning);
    this.eventBus.on('sandboxFightResult', onResult);
    this.eventBus.on('sandboxPresetsChanged', onPresetsChanged);
    this.eventBus.on('sandboxPlacementCount', onCount);
    this.eventBus.on('sandboxSelectPheromoneActive', onPheromoneActive);

    this.events.once('shutdown', () => {
      this.eventBus.off('sandboxSelectUnit', onSelect);
      this.eventBus.off('sandboxRunningState', onRunning);
      this.eventBus.off('sandboxFightResult', onResult);
      this.eventBus.off('sandboxPresetsChanged', onPresetsChanged);
      this.eventBus.off('sandboxPlacementCount', onCount);
      this.eventBus.off('sandboxSelectPheromoneActive', onPheromoneActive);
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
