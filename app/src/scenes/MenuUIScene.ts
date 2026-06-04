import Phaser from 'phaser';
import { UNIT_DEFS } from '../units/registry';
import { createUnitCard } from '../ui/UnitCard';
import { ABILITY_DEFS } from '../config/AbilityDefs';
import { MAX_CHAMBERS, MAX_LARVAE, LARVA_SPAWN_RATE } from '../systems/IncubationManager';
import type { Chamber } from '../systems/IncubationManager';
import { MAX_CAPACITY, canDeploy } from '../systems/Capacity';
import type { EventBus } from '../systems/EventBus';
import type { EliteSlot } from '../types';
import { PHEROMONE_DEFS, PHEROMONE_ORDER } from '../config/PheromoneDefs';

export class MenuUIScene extends Phaser.Scene {
  private eventBus!: EventBus;
  private deckKeys: string[] = [];

  // Resource bar
  private stageLbl!: HTMLElement;
  private nectarFill!: HTMLElement;
  private nectarNum!: HTMLElement;
  private incomeLbl!: HTMLElement;
  private larvaeNum!: HTMLElement;
  private larvaeTimer!: HTMLElement;
  private capFill!: HTMLElement;
  private capNum!: HTMLElement;

  // Larva mound
  private larvaCounter!: HTMLElement;
  private moundSlots: { div: HTMLDivElement; ico: HTMLElement; bar: HTMLElement; timer: HTMLElement }[] = [];

  // Unit slots
  private cardEls: Record<string, HTMLDivElement> = {};

  // Abilities
  private abilityBtns: Record<string, { btn: HTMLButtonElement; cdBar: HTMLElement }> = {};

  // Elite signature slots (one trigger button per live player Elite)
  private eliteRow!: HTMLElement;
  private eliteSlotContainer!: HTMLElement;
  private eliteSlotBtns: HTMLButtonElement[] = [];
  private eliteSlots: EliteSlot[] = [];

  // Active deploy lane (0 = top, 1 = bottom). Units hatch into this lane;
  // Shift+deploy sends ONE unit to the other lane (a sticky toggle + override —
  // the RTS rally-point model). Tab flips the active lane.
  private activeLane = 0;
  private shiftHeld = false; // Shift held → highlight previews the cross-send lane
  private leftArrows: HTMLElement[] = []; // ▲/▼ active-lane indicator + switch control (left edge)

  // Enemy HUD
  private enemyBar!: HTMLElement | null;
  private enemyNectarLbl!: HTMLElement;
  private enemyIncomeLbl!: HTMLElement;
  private enemyIncubationLbl!: HTMLElement;

  // Log
  private logTxt!: HTMLElement;

  // Event listener refs for cleanup
  private logListener!: (data: { message: string }) => void;
  private waveListener!: (data: { wave: number }) => void;

  constructor() {
    super('MenuUIScene');
  }

  create(): void {
    this.deckKeys = this.registry.get('deckKeys') || [];
    const previews: Record<string, string> = this.registry.get('previews') || {};
    this.eventBus = this.registry.get('eventBus');

    // Build UI DOM inside Phaser container
    const outer = document.createElement('div');
    outer.style.cssText = 'width:1280px; height:720px; position:relative; pointer-events:none;';

    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute; bottom:0; left:0; right:0; display:flex; flex-direction:column; font-family:"Courier New",monospace; color:#ddd; pointer-events:none;';

    panel.appendChild(this.buildResourceBar());
    // Enemy bar only shown in AI hive mode
    this.enemyBar = null;
    if (this.registry.get('ai.personality')) {
      this.enemyBar = this.buildEnemyBar();
      panel.appendChild(this.enemyBar);
    }
    panel.appendChild(this.buildLarvaMound());
    panel.appendChild(this.buildUnitSlots(previews));
    panel.appendChild(this.buildEliteSlots());
    panel.appendChild(this.buildPheromones());
    panel.appendChild(this.buildAbilities());
    panel.appendChild(this.buildLog());

    outer.appendChild(this.buildLaneIndicator());
    outer.appendChild(panel);
    this.add.dom(640, 360, outer);
    this.refreshLaneHighlight(); // light both the HUD toggle + the left arrows

    // Keyboard: Tab flips the active lane; 1-9/0 deploy slots 1-10 into the
    // active lane (Shift+digit → the other lane, a one-off cross-send). Uses
    // e.code so Shift+1 still reads as digit 1 (not '!'). Holding Shift previews
    // the cross-send lane on the highlight via _trackShift.
    this.input.keyboard!.addCapture('TAB');
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      this._trackShift(e.shiftKey);
      if (e.code === 'Tab') { e.preventDefault(); this.setActiveLane(1 - this.activeLane); return; }
      let idx = -1;
      if (e.code >= 'Digit1' && e.code <= 'Digit9') idx = parseInt(e.code.slice(5)) - 1;
      else if (e.code === 'Digit0') idx = 9;
      if (idx >= 0 && idx < this.deckKeys.length) {
        const lane = e.shiftKey ? 1 - this.activeLane : this.activeLane;
        this.eventBus.emit('deployUnit', { key: this.deckKeys[idx], lane });
      }
    });
    this.input.keyboard!.on('keyup', (e: KeyboardEvent) => this._trackShift(e.shiftKey));

    // Listen for events from GameManager
    this.logListener = (data) => { this.logTxt.textContent = data.message; };
    this.waveListener = (data) => { this.stageLbl.textContent = 'STAGE ' + data.wave; };
    this.eventBus.on('logMessage', this.logListener);
    this.eventBus.on('waveStart', this.waveListener);

    this.logTxt.textContent = 'Deploy units to push to the enemy base!';

    // Cleanup on shutdown
    this.events.once('shutdown', () => {
      this.eventBus.off('logMessage', this.logListener);
      this.eventBus.off('waveStart', this.waveListener);
    });
  }

  update(): void {
    const nectar: number = this.registry.get('eco.nectar') ?? 80;
    const income: number = this.registry.get('eco.income') ?? 8;
    const nectarPct: number = this.registry.get('eco.nectarPct') ?? 26;
    const larvaCount: number = this.registry.get('inc.larvaCount') ?? 3;
    const larvaTimer: number = this.registry.get('inc.larvaTimer') ?? 0;
    const canQueue: boolean = this.registry.get('inc.canQueue') ?? true;
    const chambers: (Chamber | null)[] = this.registry.get('inc.chambers') ?? [];
    const numChambers: number = this.registry.get('inc.numChambers') ?? 6;
    const capUsedNow: number = this.registry.get('cap.used') ?? 0;
    const capMax: number = this.registry.get('cap.max') ?? MAX_CAPACITY;
    const running: boolean = this.registry.get('game.running') ?? true;
    const ablCanCast: Record<string, boolean> = this.registry.get('abl.canCast') ?? {};
    const ablCdPct: Record<string, number> = this.registry.get('abl.cooldownPct') ?? {};

    // Resource bar
    this.nectarFill.style.width = nectarPct + '%';
    this.nectarNum.textContent = String(Math.floor(nectar));
    this.incomeLbl.textContent = '+' + income + '/s';
    this.larvaeNum.textContent = larvaCount + '/' + MAX_LARVAE;
    if (larvaCount < MAX_LARVAE) {
      this.larvaeTimer.textContent = Math.ceil(LARVA_SPAWN_RATE - larvaTimer) + 's';
    } else {
      this.larvaeTimer.textContent = 'MAX';
    }

    // Capacity bar — turns amber/red as it approaches max
    const capPct = capMax > 0 ? (capUsedNow / capMax) * 100 : 0;
    this.capFill.style.width = capPct + '%';
    if (capUsedNow >= capMax) {
      this.capFill.style.background = 'linear-gradient(90deg,#a04040,#f06060)';
      this.capNum.style.color = '#f06060';
    } else if (capPct >= 80) {
      this.capFill.style.background = 'linear-gradient(90deg,#806020,#f0a040)';
      this.capNum.style.color = '#f0a040';
    } else {
      this.capFill.style.background = 'linear-gradient(90deg,#106080,#40c0e0)';
      this.capNum.style.color = '#40c0e0';
    }
    this.capNum.textContent = capUsedNow + ' / ' + capMax;

    // Larva mound
    this.larvaCounter.textContent = `Larvae: ${larvaCount}/${MAX_LARVAE}`;
    this.larvaCounter.className = larvaCount === 0 ? 'lc-empty' : '';
    for (let i = 0; i < this.moundSlots.length; i++) {
      const slot = this.moundSlots[i];
      if (i >= numChambers) {
        slot.div.className = 'lm-slot lm-locked';
        slot.ico.innerHTML = '<span class="lm-lock">X</span>';
        slot.bar.style.transform = 'scaleX(0)';
        slot.timer.textContent = '';
        continue;
      }
      const chamber = chambers[i] ?? null;
      if (!chamber) {
        slot.div.className = 'lm-slot lm-empty';
        slot.ico.innerHTML = '<span class="lm-empty-mark">--</span>';
        slot.bar.style.transform = 'scaleX(0)';
        slot.timer.textContent = '';
      } else {
        const progress = 1 - chamber.remaining / chamber.total;
        const isAlmostDone = chamber.remaining <= 1;
        slot.div.className = 'lm-slot lm-active' + (isAlmostDone ? ' lm-hatching' : '');
        const previews: Record<string, string> = this.registry.get('previews') || {};
        slot.ico.innerHTML = previews[chamber.key]
          ? `<img class="lm-preview" src="${previews[chamber.key]}" alt="${chamber.def.name}">`
          : `<span class="lm-unit-name">${chamber.def.name}</span>`;
        slot.bar.style.transform = `scaleX(${progress})`;
        slot.timer.textContent = Math.ceil(chamber.remaining) + 's';
      }
    }

    // Enemy HUD (AI hive mode only)
    if (this.enemyBar) {
      const aiNectar: number = this.registry.get('ai.nectar') ?? 0;
      const aiIncome: number = this.registry.get('ai.income') ?? 0;
      const aiChambers: (Chamber | null)[] = this.registry.get('ai.chambers') ?? [];
      this.enemyNectarLbl.textContent = `${aiNectar}n`;
      this.enemyIncomeLbl.textContent = `+${aiIncome}/s`;
      // Show active chambers
      const active = aiChambers.filter(c => c !== null) as Chamber[];
      if (active.length > 0) {
        this.enemyIncubationLbl.textContent = active
          .map(c => {
            const name = UNIT_DEFS[c.key.replace(/^e/, '')]?.name || c.key;
            return `${name} ${Math.ceil(c.remaining)}s`;
          })
          .join(' | ');
      } else {
        this.enemyIncubationLbl.textContent = 'idle';
      }
    }

    // Unit cards — three failure states, distinct visuals:
    //   .disabled    = can't afford OR no chamber/larva (greyed out)
    //   .cap-blocked = would exceed hive capacity (red — telegraphs the actual blocker)
    // Cap-blocked is the most important warning: the cap bar tells you WHAT,
    // the card tells you WHY a specific pick is unusable.
    this.deckKeys.forEach(key => {
      const d = UNIT_DEFS[key];
      if (!d) return;
      const card = this.cardEls[key];
      if (!card) return;
      const wouldExceedCap = !canDeploy(d, capUsedNow, capMax);
      const cantAfford = nectar < d.cost || !canQueue;
      card.classList.toggle('disabled', cantAfford && !wouldExceedCap);
      card.classList.toggle('cap-blocked', wouldExceedCap);
    });

    // Abilities
    Object.keys(ABILITY_DEFS).forEach(key => {
      const b = this.abilityBtns[key];
      if (!b) return;
      b.btn.disabled = !(ablCanCast[key] ?? false) || !running;
      b.cdBar.style.width = (ablCdPct[key] ?? 100) + '%';
    });

    // Elite signature slots
    this.renderEliteSlots(this.registry.get('elite.slots') ?? []);
  }

  // --- DOM builders ---

  private buildResourceBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex; flex-direction:column; gap:2px; padding:4px 10px; background:#0e0e16; border-bottom:1px solid #1a1a28; pointer-events:auto;';

    // Row 1 — stage label + nectar bar + larvae
    const row1 = document.createElement('div');
    row1.style.cssText = 'display:flex; align-items:center; gap:8px;';

    this.stageLbl = this.el('span', 'font-size:10px; color:#666; letter-spacing:2px; margin-right:8px;', 'STAGE 1');
    const nectarLbl = this.el('span', 'font-size:9px; color:#666; letter-spacing:0.5px; min-width:42px;', 'NECTAR');

    const nectarTrack = document.createElement('div');
    nectarTrack.style.cssText = 'width:200px; height:10px; background:#1a1a22; border-radius:5px; border:1px solid #2a2a3a; overflow:hidden;';
    this.nectarFill = this.el('div', 'height:100%; background:linear-gradient(90deg,#806010,#f0c040); border-radius:5px; transition:width .1s; width:26%;');
    nectarTrack.appendChild(this.nectarFill);

    this.nectarNum = this.el('span', 'font-size:13px; color:#f0c040; min-width:40px; text-align:right;', '80');
    this.incomeLbl = this.el('span', 'font-size:10px; color:#664;', '+8/s');

    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px; height:14px; background:#222; margin:0 4px;';

    const larvaeLbl = this.el('span', 'font-size:9px; color:#666; letter-spacing:0.5px;', 'LARVAE');
    this.larvaeNum = this.el('span', 'font-size:13px; color:#c0b888; min-width:30px; text-align:right;', '3/10');
    this.larvaeTimer = this.el('span', 'font-size:9px; color:#555;');

    const spacer = document.createElement('div');
    spacer.style.cssText = 'flex:1;';
    const escHint = this.el('span', 'font-size:9px; color:#444; letter-spacing:1px;', 'ESC PAUSE');

    row1.append(this.stageLbl, nectarLbl, nectarTrack, this.nectarNum, this.incomeLbl, sep, larvaeLbl, this.larvaeNum, this.larvaeTimer, spacer, escHint);

    // Row 2 — capacity bar (shorter, slim, distinct cyan/teal)
    const row2 = document.createElement('div');
    row2.style.cssText = 'display:flex; align-items:center; gap:8px; padding-left:60px;'; // align under nectar label

    const capLbl = this.el('span', 'font-size:9px; color:#446677; letter-spacing:0.5px; min-width:42px;', 'HIVE');

    const capTrack = document.createElement('div');
    capTrack.style.cssText = 'width:160px; height:6px; background:#0a1418; border-radius:3px; border:1px solid #1a2a32; overflow:hidden;';
    this.capFill = this.el('div', 'height:100%; background:linear-gradient(90deg,#106080,#40c0e0); border-radius:3px; transition:width .1s, background .15s; width:0%;');
    capTrack.appendChild(this.capFill);

    this.capNum = this.el('span', 'font-size:11px; color:#40c0e0; min-width:48px; text-align:right;', '0 / ' + MAX_CAPACITY);

    row2.append(capLbl, capTrack, this.capNum);

    bar.append(row1, row2);
    return bar;
  }

  private buildLarvaMound(): HTMLElement {
    const mound = document.createElement('div');
    mound.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; padding:4px 6px; background:#0b0b14; border-bottom:1px solid #1a1a28; width:100%; justify-content:center; align-items:center; pointer-events:auto;';

    this.larvaCounter = document.createElement('div');
    this.larvaCounter.style.cssText = 'width:100%; text-align:center; font-size:10px; color:#8a8a6a; letter-spacing:0.5px; padding:1px 0;';
    mound.appendChild(this.larvaCounter);

    this.moundSlots = [];
    for (let i = 0; i < MAX_CHAMBERS; i++) {
      const div = document.createElement('div');
      div.className = 'lm-slot lm-empty';

      const ico = document.createElement('span');
      ico.className = 'lm-ico';
      ico.innerHTML = '<span class="lm-empty-mark">--</span>';

      const bar = document.createElement('div');
      bar.className = 'lm-bar';

      const timer = document.createElement('span');
      timer.className = 'lm-timer';

      div.append(ico, bar, timer);
      const idx = i;
      div.onclick = () => this.eventBus.emit('cancelIncubation', { index: idx });

      mound.appendChild(div);
      this.moundSlots.push({ div, ico, bar, timer });
    }

    return mound;
  }

  private buildUnitSlots(previews: Record<string, string>): HTMLElement {
    const cols = this.deckKeys.length;
    const slots = document.createElement('div');
    slots.style.cssText = `display:flex; flex-wrap:wrap; justify-content:center; gap:3px; padding:5px 6px; background:#0a0a12; border-bottom:1px solid #1a1a28; width:100%; pointer-events:auto;`;

    this.cardEls = {};
    this.deckKeys.forEach(key => {
      if (!UNIT_DEFS[key]) return;

      const div = createUnitCard(key, { preview: previews[key] });
      // Read Shift off the click itself → cross-send to the other lane.
      div.addEventListener('click', (ev) => {
        const lane = (ev as MouseEvent).shiftKey ? 1 - this.activeLane : this.activeLane;
        this.eventBus.emit('deployUnit', { key, lane });
      });

      slots.appendChild(div);
      this.cardEls[key] = div;
    });

    return slots;
  }

  private buildAbilities(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex; gap:4px; padding:4px 6px; background:#090910; border-bottom:1px solid #1a1a28; width:100%; pointer-events:auto;';

    this.abilityBtns = {};
    Object.entries(ABILITY_DEFS).forEach(([key, def]) => {
      const btn = document.createElement('button');
      btn.className = 'abl-btn';
      btn.innerHTML = `${def.icon} ${def.name}<br><small style="font-size:9px;color:#888">${def.desc} (\u2B21${def.cost})</small><div class="abl-cd" style="width:0"></div>`;
      btn.onclick = () => this.eventBus.emit('useAbility', { key });

      container.appendChild(btn);
      const cdBar = btn.querySelector('.abl-cd') as HTMLElement;
      this.abilityBtns[key] = { btn, cdBar };
    });

    return container;
  }

  // Elite signature trigger row — one button per live player Elite. Hidden when
  // none are out. Click fires THAT Elite's signature (emits `triggerSignature`).
  private setActiveLane(lane: number): void {
    this.activeLane = lane;
    this.refreshLaneHighlight();
  }

  // Shift held → the highlight previews the cross-send lane (the deploy target).
  private _trackShift(held: boolean): void {
    if (this.shiftHeld === held) return;
    this.shiftHeld = held;
    this.refreshLaneHighlight();
  }

  // Light the lane the NEXT deploy will go to (active lane, or its opposite while
  // Shift is held) on the left-edge arrows.
  private refreshLaneHighlight(): void {
    const shown = this.shiftHeld ? 1 - this.activeLane : this.activeLane;
    this.leftArrows.forEach((a, i) => {
      const on = i === shown;
      a.style.color = on ? '#a0e070' : '#33402f';
      a.style.opacity = on ? '1' : '0.3';
      a.style.transform = on ? 'scale(1.3)' : 'scale(1)';
    });
  }

  // Active-lane indicator AND control, pinned to the LEFT of the screen (where
  // your base + freshly-hatched units are). ▲ = top lane, ▼ = bottom; the active
  // (or Shift-previewed) one lights up and scales. Click an arrow to switch lanes
  // (Tab also flips it). Replaces the old bottom-HUD toggle row.
  private buildLaneIndicator(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute; left:10px; top:30%; display:flex; flex-direction:column; gap:64px; pointer-events:none;';
    this.leftArrows = ['▲', '▼'].map((glyph, lane) => {
      const a = document.createElement('div');
      a.textContent = glyph;
      a.style.cssText = 'font-size:34px; line-height:1; text-shadow:0 0 5px #000; cursor:pointer; pointer-events:auto; transition:opacity .12s, color .12s, transform .12s;';
      a.addEventListener('click', () => this.setActiveLane(lane));
      wrap.appendChild(a);
      return a;
    });
    return wrap;
  }

  // Pheromone command row (Rally / Charge / Retreat). Interim delivery: clicking
  // casts the command onto the player army's front (GameManager.castPheromone);
  // click-to-target + Scout deposit-fade is the deferred upgrade (VISION §5).
  private buildPheromones(): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:4px; align-items:center; padding:3px 8px; background:#080c10; border-bottom:1px solid #0e1a22; width:100%; pointer-events:auto;';
    row.appendChild(this.el('span', 'font-size:10px; color:#40a0d0; letter-spacing:1px; margin-right:4px;', 'CMD'));
    PHEROMONE_ORDER.forEach(kind => {
      const def = PHEROMONE_DEFS[kind];
      const hex = '#' + def.color.toString(16).padStart(6, '0');
      const btn = document.createElement('button');
      btn.textContent = def.name;
      btn.style.cssText = `font-size:10px; padding:3px 9px; border-radius:3px; border:1px solid ${hex}; background:#10141a; color:${hex}; cursor:pointer; pointer-events:auto;`;
      btn.onclick = () => this.eventBus.emit('castPheromone', { kind, lane: this.activeLane });
      row.appendChild(btn);
    });
    return row;
  }

  private buildEliteSlots(): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:none; gap:4px; align-items:center; padding:3px 8px; background:#0c0a06; border-bottom:1px solid #1a1408; width:100%; pointer-events:auto;';
    const lbl = this.el('span', 'font-size:10px; color:#e0a020; letter-spacing:1px; margin-right:4px;', 'ELITE');
    this.eliteSlotContainer = document.createElement('div');
    this.eliteSlotContainer.style.cssText = 'display:flex; gap:4px; align-items:center; flex-wrap:wrap;';
    row.append(lbl, this.eliteSlotContainer);
    this.eliteRow = row;
    return row;
  }

  private renderEliteSlots(slots: EliteSlot[]): void {
    this.eliteRow.style.display = slots.length ? 'flex' : 'none';
    // Rebuild buttons only when the count changes (Elites deploy / die).
    if (this.eliteSlotBtns.length !== slots.length) {
      this.eliteSlotContainer.replaceChildren();
      this.eliteSlotBtns = slots.map((_, i) => {
        const b = document.createElement('button');
        b.style.cssText = 'position:relative; overflow:hidden; font-size:10px; padding:3px 8px; border-radius:3px; min-width:64px; text-align:center; pointer-events:auto;';
        b.appendChild(document.createElement('span'));          // label
        const cd = document.createElement('div');               // charge fill
        cd.style.cssText = 'position:absolute; left:0; bottom:0; height:2px; background:#e0a020;';
        b.appendChild(cd);
        b.addEventListener('click', () => this.onEliteSlotClick(i));
        this.eliteSlotContainer.appendChild(b);
        return b;
      });
    }
    slots.forEach((s, i) => {
      const b = this.eliteSlotBtns[i];
      const label = b.firstChild as HTMLSpanElement;
      const cd = b.lastChild as HTMLElement;
      if (!s.ready) {
        // On cooldown — greyed; the bar charges toward ready.
        label.textContent = s.name;
        b.style.border = '1px solid #44402a'; b.style.background = '#14120c'; b.style.color = '#6a6048'; b.style.cursor = 'default'; b.style.fontWeight = 'normal';
        cd.style.width = ((1 - s.cdFrac) * 100) + '%';
      } else if (s.inRange) {
        // Ready AND an enemy is in range — lit, clickable.
        label.textContent = '⚡ ' + s.name;
        b.style.border = '1px solid #e0a020'; b.style.background = '#2a2010'; b.style.color = '#ffcf50'; b.style.cursor = 'pointer'; b.style.fontWeight = 'bold';
        cd.style.width = '0';
      } else {
        // Ready but no target in range — dim (firing would whiff).
        label.textContent = s.name;
        b.style.border = '1px solid #6a5a30'; b.style.background = '#16140e'; b.style.color = '#9a8a55'; b.style.cursor = 'default'; b.style.fontWeight = 'normal';
        cd.style.width = '0';
      }
    });
    this.eliteSlots = slots;
  }

  private onEliteSlotClick(i: number): void {
    const s = this.eliteSlots[i];
    if (!s || !s.ready || !s.inRange) return; // only a lit slot fires
    this.eventBus.emit('triggerSignature', { unitId: s.id });
  }

  private buildLog(): HTMLElement {
    const log = document.createElement('div');
    log.style.cssText = 'display:flex; gap:4px; padding:3px 8px; background:#080810; border-top:1px solid #111; height:28px; align-items:center; overflow:hidden; pointer-events:auto;';

    this.logTxt = this.el('span', 'font-size:11px; color:#888; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;');
    log.appendChild(this.logTxt);

    return log;
  }

  private buildEnemyBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex; align-items:center; gap:8px; padding:3px 10px; background:#160e0e; border-bottom:1px solid #2a1a1a; pointer-events:auto;';

    const label = this.el('span', 'font-size:9px; color:#c04040; letter-spacing:1px;', 'ENEMY HIVE');
    this.enemyNectarLbl = this.el('span', 'font-size:11px; color:#f05050; min-width:40px;', '0n');
    this.enemyIncomeLbl = this.el('span', 'font-size:9px; color:#804040;', '+0/s');

    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px; height:12px; background:#332; margin:0 4px;';

    this.enemyIncubationLbl = this.el('span', 'font-size:9px; color:#f08040;', '');

    bar.append(label, this.enemyNectarLbl, this.enemyIncomeLbl, sep, this.enemyIncubationLbl);
    return bar;
  }

  private el(tag: string, css: string, text?: string): HTMLElement {
    const e = document.createElement(tag);
    e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  }
}
