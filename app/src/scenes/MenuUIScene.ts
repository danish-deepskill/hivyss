import Phaser from 'phaser';
import { UNIT_DEFS } from '../units/registry';
import { createUnitCard } from '../ui/UnitCard';
import { ABILITY_DEFS } from '../config/AbilityDefs';
import { MAX_CHAMBERS, MAX_LARVAE, LARVA_SPAWN_RATE } from '../systems/IncubationManager';
import type { Chamber } from '../systems/IncubationManager';
import type { EventBus } from '../systems/EventBus';

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

  // Larva mound
  private larvaCounter!: HTMLElement;
  private moundSlots: { div: HTMLDivElement; ico: HTMLElement; bar: HTMLElement; timer: HTMLElement }[] = [];

  // Unit slots
  private cardEls: Record<string, HTMLDivElement> = {};

  // Abilities
  private abilityBtns: Record<string, { btn: HTMLButtonElement; cdBar: HTMLElement }> = {};

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
    panel.appendChild(this.buildLarvaMound());
    panel.appendChild(this.buildUnitSlots(previews));
    panel.appendChild(this.buildAbilities());
    panel.appendChild(this.buildLog());

    outer.appendChild(panel);
    this.add.dom(640, 360, outer);

    // Keyboard shortcuts: 1-9, 0 = slots 1-10
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      const k = e.key;
      let idx = -1;
      if (k >= '1' && k <= '9') idx = parseInt(k) - 1;
      else if (k === '0') idx = 9;
      if (idx >= 0 && idx < this.deckKeys.length) {
        this.eventBus.emit('deployUnit', { key: this.deckKeys[idx] });
      }
    });

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

    // Unit cards
    this.deckKeys.forEach(key => {
      const d = UNIT_DEFS[key];
      if (!d) return;
      const card = this.cardEls[key];
      if (!card) return;
      card.classList.toggle('disabled', nectar < d.cost || !canQueue);
    });

    // Abilities
    Object.keys(ABILITY_DEFS).forEach(key => {
      const b = this.abilityBtns[key];
      if (!b) return;
      b.btn.disabled = !(ablCanCast[key] ?? false) || !running;
      b.cdBar.style.width = (ablCdPct[key] ?? 100) + '%';
    });
  }

  // --- DOM builders ---

  private buildResourceBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex; align-items:center; gap:8px; padding:4px 10px; background:#0e0e16; border-bottom:1px solid #1a1a28; pointer-events:auto;';

    this.stageLbl = this.el('span', 'font-size:10px; color:#666; letter-spacing:2px; margin-right:8px;', 'STAGE 1');
    const nectarLbl = this.el('span', 'font-size:9px; color:#666; letter-spacing:0.5px;', 'NECTAR');

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

    bar.append(this.stageLbl, nectarLbl, nectarTrack, this.nectarNum, this.incomeLbl, sep, larvaeLbl, this.larvaeNum, this.larvaeTimer, spacer, escHint);
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

      const div = createUnitCard(key, {
        preview: previews[key],
        onClick: () => this.eventBus.emit('deployUnit', { key }),
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

  private buildLog(): HTMLElement {
    const log = document.createElement('div');
    log.style.cssText = 'display:flex; gap:4px; padding:3px 8px; background:#080810; border-top:1px solid #111; height:28px; align-items:center; overflow:hidden; pointer-events:auto;';

    this.logTxt = this.el('span', 'font-size:11px; color:#888; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;');
    log.appendChild(this.logTxt);

    return log;
  }

  private el(tag: string, css: string, text?: string): HTMLElement {
    const e = document.createElement(tag);
    e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  }
}
