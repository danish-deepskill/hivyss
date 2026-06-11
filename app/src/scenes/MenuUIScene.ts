import Phaser from 'phaser';
import { UNIT_DEFS, TIER_DEFS } from '../units/registry';
import { createUnitCard } from '../ui/UnitCard';
import { ABILITY_DEFS } from '../config/AbilityDefs';
import { MAX_CHAMBERS, MAX_LARVAE, LARVA_SPAWN_RATE } from '../systems/IncubationManager';
import type { Chamber } from '../systems/IncubationManager';
import { MAX_CAPACITY, canDeploy } from '../systems/Capacity';
import type { EventBus } from '../systems/EventBus';
import type { EliteSlot, RoyalStatus, PheromoneKind } from '../types';
import { PHEROMONE_DEFS, PHEROMONE_ORDER } from '../config/PheromoneDefs';
import { FORAGE_ENABLED } from '../config/ForageDefs';
import { PHEROMONE_VYSS_COST } from '../config/VyssDefs';

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
  private vyssNum!: HTMLElement;
  private phaseLbl!: HTMLElement;
  private matureBtn!: HTMLButtonElement;

  // WORKERS deploy cards (end of the roster bar): the Scout card carries a
  // pheromone SELECTOR (mini-dots pick the command it couriers), the Gatherer
  // deploys the forage worker, the Builder slot is the caste's future job.
  private selectedPheromone: PheromoneKind = 'rally';
  private scoutCard!: HTMLDivElement;
  private scoutCost!: HTMLElement;
  private pherDots: Array<{ dot: HTMLButtonElement; kind: PheromoneKind }> = [];
  private gathererCard!: HTMLDivElement;

  // Larva mound
  private larvaCounter!: HTMLElement;
  private moundSlots: { div: HTMLDivElement; ico: HTMLElement; bar: HTMLElement; timer: HTMLElement }[] = [];

  // Unit slots
  private cardEls: Record<string, HTMLDivElement> = {};

  // Abilities
  private abilityBtns: Record<string, { btn: HTMLButtonElement; cdBar: HTMLElement }> = {};

  // Elite signature slots — silver mini-portraits beside the Royal, one per live
  // player Elite (click to fire its signature). Lives inside the Royal panel.
  private eliteGroup!: HTMLElement;          // divider + ELITE label + portraits (hidden when none)
  private eliteSlotContainer!: HTMLElement;
  private eliteSlotEls: HTMLElement[] = [];
  private eliteSlots: EliteSlot[] = [];

  // Royal profile (the keystone hero panel) — Dota-style 1:1 portrait of the
  // actual procedural render, name + tier, HP bar with number, and the ult.
  private royalProfile!: {
    wrap: HTMLElement; hero: HTMLElement; portrait: HTMLElement; portraitImg: HTMLImageElement;
    name: HTMLElement; tier: HTMLElement; hpFill: HTMLElement; hpNum: HTMLElement;
    status: HTMLElement; roarBtn: HTMLButtonElement; roarLbl: HTMLElement; roarCd: HTMLElement;
  };

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
    panel.appendChild(this.buildRoyalProfile());
    panel.appendChild(this.buildAbilities());
    panel.appendChild(this.buildLog());

    outer.appendChild(this.buildLaneIndicator());
    outer.appendChild(panel);
    // Phaser's DOMElement re-applies pointerEvents:auto onto the wrapped node
    // every render frame — overriding outer's authored pointer-events:none and
    // silently swallowing every battlefield click (Royal control, any future
    // canvas input). Force it off on the WRAPPER, exactly like SandboxHUDScene;
    // the HUD panels keep their own pointer-events:auto so buttons still work.
    const wrapper = this.add.dom(640, 360, outer);
    wrapper.pointerEvents = 'none';
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

    // Resource bar — income shows the HONEST rate: passive floor + the actual
    // forage deposits (rolling window) + the worker count, not just the floor.
    const forageRate: number = this.registry.get('forage.rate') ?? 0;
    const forageWorkers: number = this.registry.get('forage.workers') ?? 0;
    const vyssCount: number = this.registry.get('vyss.count') ?? 0;
    this.nectarFill.style.width = nectarPct + '%';
    this.nectarNum.textContent = String(Math.floor(nectar));
    this.incomeLbl.textContent = FORAGE_ENABLED
      ? `+${(income + forageRate).toFixed(1)}/s 🌼${forageWorkers}`
      : '+' + income + '/s';
    this.vyssNum.textContent = String(vyssCount);

    // Hive maturation readout + MATURE button — phases read as a STORY
    // (EARLY/MID/LATE PHASE), not numbers.
    const phaseName: string = this.registry.get('hive.phaseName') ?? 'Early';
    const matureCost: { nectar: number; larvae: number; vyss: number } | null = this.registry.get('hive.matureCost') ?? null;
    const canMature: boolean = this.registry.get('hive.canMature') ?? false;
    if (matureCost) {
      this.phaseLbl.textContent = `${phaseName.toUpperCase()} PHASE`;
      this.matureBtn.style.display = '';
      this.matureBtn.textContent = `▲ MATURE ${matureCost.nectar}⬡${matureCost.larvae > 0 ? ` +${matureCost.larvae}🐛` : ""}${matureCost.vyss > 0 ? ` +${matureCost.vyss}✦` : ""}`;
      this.matureBtn.title = `Unlocks: ${this.registry.get('hive.nextPerks') ?? ''}`;
      const off = !canMature || !running;
      this.matureBtn.disabled = off;
      this.matureBtn.style.opacity = off ? '0.45' : '1';
    } else {
      this.matureBtn.style.display = 'none'; // fully mature
      this.phaseLbl.textContent = `${phaseName.toUpperCase()} PHASE ★`;
    }

    // WORKER cards — scout gated by the SELECTED command's vyss price,
    // gatherer by nectar + a larva. Same .disabled read as the deck cards.
    this.scoutCard.classList.toggle(
      'disabled',
      vyssCount < PHEROMONE_VYSS_COST[this.selectedPheromone] || !running,
    );
    const gathererCost = UNIT_DEFS['gatherer']?.cost ?? 30;
    this.gathererCard.classList.toggle(
      'disabled',
      nectar < gathererCost || larvaCount <= 0 || !running,
    );
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
    const deployTierCap: number = this.registry.get('hive.tierCap') ?? 99;
    this.deckKeys.forEach(key => {
      const d = UNIT_DEFS[key];
      if (!d) return;
      const card = this.cardEls[key];
      if (!card) return;
      // Maturation lock outranks the other states — the card is phase-gated.
      const tierLocked = d.tier > deployTierCap;
      const wouldExceedCap = !canDeploy(d, capUsedNow, capMax);
      const cantAfford = nectar < d.cost || !canQueue;
      card.classList.toggle('disabled', tierLocked || (cantAfford && !wouldExceedCap));
      card.classList.toggle('cap-blocked', !tierLocked && wouldExceedCap);
      card.title = tierLocked ? `Tier ${d.tier} is phase-locked — MATURE the hive` : '';
    });

    // Abilities
    Object.keys(ABILITY_DEFS).forEach(key => {
      const b = this.abilityBtns[key];
      if (!b) return;
      b.btn.disabled = !(ablCanCast[key] ?? false) || !running;
      b.cdBar.style.width = (ablCdPct[key] ?? 100) + '%';
    });

    // Elite signature slots + the Royal profile
    this.renderEliteSlots(this.registry.get('elite.slots') ?? []);
    this.renderRoyalProfile();
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

    // Corpses — the tactical currency (commands). Fed by deaths on the field.
    const sep2 = document.createElement('div');
    sep2.style.cssText = 'width:1px; height:14px; background:#222; margin:0 4px;';
    const vyssLbl = this.el('span', 'font-size:9px; color:#667; letter-spacing:0.5px;', 'VYSS');
    this.vyssNum = this.el('span', 'font-size:13px; color:#c8c8d8; min-width:24px; text-align:right;', '0');

    const spacer = document.createElement('div');
    spacer.style.cssText = 'flex:1;';
    const escHint = this.el('span', 'font-size:9px; color:#444; letter-spacing:1px;', 'ESC PAUSE');

    row1.append(this.stageLbl, nectarLbl, nectarTrack, this.nectarNum, this.incomeLbl, sep, larvaeLbl, this.larvaeNum, this.larvaeTimer, sep2, vyssLbl, this.vyssNum, spacer, escHint);

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

    // Hive maturation — the tech-up arc: the phase readout + the MATURE
    // button (spend to unlock the next tier band / the Royal's ultimate).
    this.phaseLbl = this.el('span', 'font-size:10px; color:#c8a030; letter-spacing:1px; margin-left:16px;', 'PHASE 1/3');
    this.matureBtn = document.createElement('button');
    this.matureBtn.style.cssText = 'font-size:10px; padding:2px 10px; margin-left:6px; border-radius:3px; border:1px solid #c8a030; background:#1a1404; color:#f0c040; cursor:pointer; pointer-events:auto; font-weight:bold;';
    this.matureBtn.onclick = () => this.eventBus.emit('matureHive', {});
    row2.append(this.phaseLbl, this.matureBtn);

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

    // WORKERS — the worker caste's own deploy portraits at the end of the
    // roster: Scout (couriers the SELECTED pheromone — the mini-dots are the
    // command picker), Gatherer (the forage worker), Builder (future job slot).
    const div = this.el('div', 'width:1px; height:64px; background:#222; margin:0 6px; align-self:center;');
    slots.appendChild(div);
    slots.appendChild(this.buildWorkerCards(previews));

    return slots;
  }

  /** The WORKERS card cluster (scout + gatherer + builder placeholder). */
  private buildWorkerCards(previews: Record<string, string>): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; gap:3px; align-items:flex-start;';

    // --- Scout: deploys a courier carrying the SELECTED pheromone into the
    // active lane. The dots row under the card picks the command (sticky);
    // the card's cost line shows that command's vyss price.
    const scoutCol = document.createElement('div');
    scoutCol.style.cssText = 'display:flex; flex-direction:column; gap:2px; align-items:center;';
    const scout = document.createElement('div');
    scout.className = 'ucard';
    const scoutPv = previews['scout'];
    scout.innerHTML = `
      <div class="utier" style="color:#40a0d0">W</div>
      ${scoutPv ? `<img class="uico-img" src="${scoutPv}" alt="Scout">` : '<div class="uico">🐜</div>'}
      <div class="uname">Scout</div>
      <div class="ucost-row"><span class="ucost"></span></div>
    `;
    this.scoutCost = scout.querySelector('.ucost') as HTMLElement;
    scout.addEventListener('click', () => {
      this.eventBus.emit('castPheromone', { kind: this.selectedPheromone, lane: this.activeLane });
    });
    const dots = document.createElement('div');
    dots.style.cssText = 'display:flex; gap:3px;';
    this.pherDots = PHEROMONE_ORDER.map(kind => {
      const def = PHEROMONE_DEFS[kind];
      const hex = '#' + def.color.toString(16).padStart(6, '0');
      const dot = document.createElement('button');
      dot.title = `${def.name} — ${PHEROMONE_VYSS_COST[kind]}✦`;
      dot.textContent = def.name[0];
      dot.style.cssText = `width:20px; height:16px; font-size:9px; line-height:1; border-radius:3px; border:1px solid ${hex}; color:${hex}; background:#10141a; cursor:pointer; pointer-events:auto; padding:0;`;
      dot.addEventListener('click', () => this.selectPheromone(kind));
      return { dot, kind };
    });
    this.pherDots.forEach(p => dots.appendChild(p.dot));
    scoutCol.append(scout, dots);
    this.scoutCard = scout;

    // --- Gatherer: the forage worker (nectar + a larva, instant). Only
    // meaningful while the forage economy is on.
    const gatherer = document.createElement('div');
    gatherer.className = 'ucard';
    if (!FORAGE_ENABLED) gatherer.style.display = 'none';
    const gPv = previews['gatherer'];
    const gCost = UNIT_DEFS['gatherer']?.cost ?? 30;
    gatherer.innerHTML = `
      <div class="utier" style="color:#40a0d0">W</div>
      ${gPv ? `<img class="uico-img" src="${gPv}" alt="Gatherer">` : '<div class="uico">🍯</div>'}
      <div class="uname">Gatherer</div>
      <div class="ucost-row"><span class="ucost">${gCost}n +🐛</span></div>
    `;
    gatherer.addEventListener('click', () => this.eventBus.emit('deployGatherer', {}));
    this.gathererCard = gatherer;

    // --- Builder: the caste's third job — visible, locked until built.
    const builder = document.createElement('div');
    builder.className = 'ucard disabled';
    builder.innerHTML = `
      <div class="utier" style="color:#40a0d0">W</div>
      <div class="uico">🔨</div>
      <div class="uname">Builder</div>
      <div class="ucost-row"><span class="utag">SOON</span></div>
    `;

    wrap.append(scoutCol, gatherer, builder);
    this.selectPheromone(this.selectedPheromone); // initial highlight + cost
    return wrap;
  }

  /** Pick the command the next Scout couriers (sticky until changed). */
  private selectPheromone(kind: PheromoneKind): void {
    this.selectedPheromone = kind;
    this.scoutCost.textContent = `${PHEROMONE_VYSS_COST[kind]}✦ ${PHEROMONE_DEFS[kind].name}`;
    for (const p of this.pherDots) {
      const def = PHEROMONE_DEFS[p.kind];
      const hex = '#' + def.color.toString(16).padStart(6, '0');
      const on = p.kind === kind;
      p.dot.style.background = on ? hex : '#10141a';
      p.dot.style.color = on ? '#0a0a12' : hex;
      p.dot.style.fontWeight = on ? 'bold' : 'normal';
    }
  }

  private buildAbilities(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex; gap:4px; padding:4px 6px; background:#090910; border-bottom:1px solid #1a1a28; width:100%; pointer-events:auto;';

    this.abilityBtns = {};
    Object.entries(ABILITY_DEFS).forEach(([key, def]) => {
      const btn = document.createElement('button');
      btn.className = 'abl-btn';
      btn.innerHTML = `${def.icon} ${def.name}<br><small style="font-size:9px;color:#888">${def.desc} (${def.cost}\u2620)</small><div class="abl-cd" style="width:0"></div>`;
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

  // Render the live Elites as SILVER 1:1 portraits (smaller siblings of the gold
  // Royal) into the Royal panel's cluster. Same procedural-render source as the
  // deck cards + Royal portrait; a dark sweep recedes as the signature charges,
  // a bright frame means "ready + a target in range" (click to fire).
  private renderEliteSlots(slots: EliteSlot[]): void {
    const previews: Record<string, string> = this.registry.get('previews') || {};
    this.eliteGroup.style.display = slots.length ? 'flex' : 'none'; // hide label+divider when no Elites
    // Rebuild portraits only when the count changes (Elites deploy / die).
    if (this.eliteSlotEls.length !== slots.length) {
      this.eliteSlotContainer.replaceChildren();
      this.eliteSlotEls = slots.map((_, i) => {
        const d = document.createElement('div');
        // Warm, lit backdrop so the bug render reads clearly (the silver FRAME
        // carries the rank, not the backdrop). Brighter than the Royal's since
        // the portrait is smaller — small art needs more contrast, not less.
        d.style.cssText = 'position:relative; width:42px; height:42px; border:2px solid #6a7178; border-radius:4px; background:radial-gradient(circle at 50% 34%, #4a4034, #16120c); box-shadow:inset 0 0 6px #000; overflow:hidden; flex:0 0 auto; transition:border-color .1s, box-shadow .1s;';
        const img = document.createElement('img');
        img.style.cssText = 'position:absolute; left:50%; top:54%; transform:translate(-50%,-50%); width:36px; height:36px; object-fit:contain; image-rendering:pixelated;';
        const lbl = document.createElement('span'); // name fallback when no preview
        lbl.style.cssText = 'position:absolute; inset:0; display:none; align-items:center; justify-content:center; text-align:center; font-size:8px; color:#aeb6bd; padding:2px; line-height:1.1;';
        const cd = document.createElement('div');    // cooldown overlay — recedes from the bottom
        cd.style.cssText = 'position:absolute; left:0; right:0; bottom:0; height:0; background:rgba(0,0,0,0.6);';
        d.append(img, lbl, cd);
        d.addEventListener('click', () => this.onEliteSlotClick(i));
        this.eliteSlotContainer.appendChild(d);
        return d;
      });
    }
    slots.forEach((s, i) => {
      const d = this.eliteSlotEls[i];
      const img = d.children[0] as HTMLImageElement;
      const lbl = d.children[1] as HTMLElement;
      const cd = d.children[2] as HTMLElement;
      const pv = previews[s.key];
      if (pv) {
        if (img.getAttribute('src') !== pv) img.src = pv;
        img.style.display = 'block'; lbl.style.display = 'none';
      } else {
        img.style.display = 'none'; lbl.style.display = 'flex'; lbl.textContent = s.name;
      }
      d.title = s.name + (s.ready ? (s.inRange ? ' — signature READY' : ' — no target in range') : ' — charging');
      cd.style.height = (s.ready ? 0 : s.cdFrac * 100) + '%';
      if (s.ready && s.inRange) {
        d.style.borderColor = '#d2dae0'; d.style.cursor = 'pointer'; d.style.boxShadow = 'inset 0 0 6px #000, 0 0 7px #d2dae088';
      } else if (s.ready) {
        d.style.borderColor = '#7c848b'; d.style.cursor = 'default'; d.style.boxShadow = 'inset 0 0 6px #000';
      } else {
        d.style.borderColor = '#484d53'; d.style.cursor = 'default'; d.style.boxShadow = 'inset 0 0 6px #000';
      }
    });
    this.eliteSlots = slots;
  }

  private onEliteSlotClick(i: number): void {
    const s = this.eliteSlots[i];
    if (!s || !s.ready || !s.inRange) return; // only a lit (ready + in-range) portrait fires
    this.eventBus.emit('triggerSignature', { unitId: s.id });
  }

  // Royal profile — the keystone hero panel (VISION §3), Dota-style: a 1:1
  // framed PORTRAIT of the Matriarch's actual procedural render (same preview
  // source as the deck cards, not an emoji), her name + tier, a green HP bar with
  // number, and the Primal Roar ult. Click the portrait (or press R) to enter
  // command mode, then click the field to move/focus her. One-of-a-kind — it's
  // her own panel, not an ELITE signature slot.
  private buildRoyalProfile(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:none; align-items:center; gap:10px; padding:5px 10px; background:linear-gradient(180deg,#16110a,#0b0906); border-top:1px solid #2e2410; border-bottom:1px solid #2e2410; width:100%; pointer-events:auto;';
    wrap.appendChild(this.el('span', 'font-size:10px; color:#c8a030; letter-spacing:2px; margin-right:2px;', 'ROYAL'));

    // Hero block — 1:1 portrait + name/HP/status. Click it to command.
    const hero = document.createElement('div');
    hero.style.cssText = 'display:flex; align-items:center; gap:9px; cursor:pointer;';

    const portrait = document.createElement('div');
    portrait.style.cssText = 'position:relative; width:54px; height:54px; border:2px solid #6b531c; border-radius:4px; background:radial-gradient(circle at 50% 32%, #2c2414, #0b0906); box-shadow:inset 0 0 8px #000; overflow:hidden; flex:0 0 auto; transition:border-color .1s, box-shadow .1s;';
    const portraitImg = document.createElement('img');
    portraitImg.style.cssText = 'position:absolute; left:50%; top:54%; transform:translate(-50%,-50%); width:48px; height:48px; object-fit:contain; image-rendering:pixelated;';
    portrait.appendChild(portraitImg);

    const info = document.createElement('div');
    info.style.cssText = 'display:flex; flex-direction:column; gap:3px; min-width:150px;';
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex; align-items:center; gap:6px;';
    const name = this.el('span', 'font-size:12px; color:#ffcf50; font-weight:bold; letter-spacing:0.5px;', 'Royal');
    const tier = this.el('span', 'font-size:8px; color:#888; border:1px solid #444; border-radius:2px; padding:0 3px; line-height:12px;');
    nameRow.append(name, tier);

    const hpTrack = document.createElement('div');
    hpTrack.style.cssText = 'position:relative; width:150px; height:11px; background:#080808; border:1px solid #000; border-radius:2px; overflow:hidden;';
    const hpFill = this.el('div', 'height:100%; width:100%; background:linear-gradient(180deg,#5ad24a,#2f9a28); transition:width .1s;');
    const hpNum = this.el('span', 'position:absolute; inset:0; text-align:center; font-size:9px; line-height:11px; color:#eaffea; text-shadow:0 1px 1px #000;');
    hpTrack.append(hpFill, hpNum);

    const status = this.el('span', 'font-size:9px; color:#9a8a55;');
    info.append(nameRow, hpTrack, status);

    hero.append(portrait, info);
    hero.addEventListener('click', () => this.eventBus.emit('toggleRoyalSelect', {}));
    wrap.appendChild(hero);

    // Primal Roar — the Royal's OWN ultimate, kept right beside her (it's her
    // ability, not a far-edge toolbar button).
    const roarBtn = document.createElement('button');
    roarBtn.style.cssText = 'position:relative; overflow:hidden; font-size:11px; padding:8px 16px; border-radius:4px; min-width:140px; text-align:center; pointer-events:auto; margin-left:12px; letter-spacing:0.5px;';
    const roarLbl = document.createElement('span');
    roarBtn.appendChild(roarLbl);
    const roarCd = this.el('div', 'position:absolute; left:0; bottom:0; height:3px; background:#f0c040;');
    roarBtn.appendChild(roarCd);
    roarBtn.addEventListener('click', () => this.onRoyalRoar());
    wrap.appendChild(roarBtn);

    // Elite signature portraits — smaller SILVER 1:1 frames; one per live Elite,
    // click to fire its signature. A silver ELITE label (parallel to the gold
    // ROYAL one) + divider precede them. The whole group hides when none are out.
    this.eliteGroup = document.createElement('div');
    this.eliteGroup.style.cssText = 'display:none; align-items:center; gap:7px; margin-left:8px;';
    this.eliteGroup.appendChild(this.el('div', 'width:1px; height:38px; background:#2e2410;'));
    this.eliteGroup.appendChild(this.el('span', 'font-size:10px; color:#9aa3ab; letter-spacing:2px;', 'ELITE'));
    this.eliteSlotContainer = document.createElement('div');
    this.eliteSlotContainer.style.cssText = 'display:flex; gap:5px; align-items:center;';
    this.eliteGroup.appendChild(this.eliteSlotContainer);
    wrap.appendChild(this.eliteGroup);

    this.royalProfile = { wrap, hero, portrait, portraitImg, name, tier, hpFill, hpNum, status, roarBtn, roarLbl, roarCd };
    return wrap;
  }

  private renderRoyalProfile(): void {
    const st = this.registry.get('royal.status') as RoyalStatus | undefined;
    const selected: boolean = this.registry.get('royal.selected') ?? false;
    const p = this.royalProfile;
    if (!st || !st.present) { p.wrap.style.display = 'none'; return; }
    p.wrap.style.display = 'flex';

    // Portrait — the actual procedural render (same preview data URL the deck
    // cards use). Set src only on change so it doesn't reload every frame.
    const previews: Record<string, string> = this.registry.get('previews') || {};
    const img = previews[st.key];
    if (img && p.portraitImg.getAttribute('src') !== img) p.portraitImg.src = img;
    p.portraitImg.style.display = img ? 'block' : 'none';

    p.name.textContent = st.name;
    const def = UNIT_DEFS[st.key];
    const tdef = def ? TIER_DEFS[def.tier] : null;
    p.tier.textContent = tdef ? tdef.label : '';
    if (tdef) { p.tier.style.color = tdef.color; p.tier.style.borderColor = tdef.color; }

    if (st.alive) {
      p.hpFill.style.width = (st.hpFrac * 100) + '%';
      p.hpNum.textContent = `${Math.ceil(st.hp)} / ${st.maxHp}`;
      p.status.textContent = selected ? '● COMMANDING — click the field' : 'click her / portrait / R to command';
      p.status.style.color = selected ? '#a0e070' : '#9a8a55';
      p.portrait.style.borderColor = selected ? '#8fe060' : '#6b531c';
      p.portrait.style.boxShadow = selected ? 'inset 0 0 8px #000, 0 0 8px #8fe06088' : 'inset 0 0 8px #000';
      p.portraitImg.style.filter = 'none';
    } else {
      p.hpFill.style.width = '0%';
      p.hpNum.textContent = st.respawnIn > 0 ? `RESPAWN ${st.respawnIn}s` : 'DOWN';
      p.status.textContent = 'the herd is leaderless';
      p.status.style.color = '#f06040';
      p.portrait.style.borderColor = '#7a2418';
      p.portrait.style.boxShadow = 'inset 0 0 8px #000';
      p.portraitImg.style.filter = 'grayscale(1) brightness(0.55)';
    }

    const sig = st.sigName || 'Ultimate';
    if (!st.alive) {
      p.roarLbl.textContent = sig;
      p.roarBtn.style.border = '1px solid #3a2c14'; p.roarBtn.style.background = '#120e08'; p.roarBtn.style.color = '#5a4c30'; p.roarBtn.style.cursor = 'default'; p.roarBtn.style.fontWeight = 'normal';
      p.roarCd.style.width = '0';
    } else if (st.sigReady) {
      p.roarLbl.textContent = '⚡ ' + sig;
      p.roarBtn.style.border = '1px solid #f0c040'; p.roarBtn.style.background = '#2a2010'; p.roarBtn.style.color = '#ffe080'; p.roarBtn.style.cursor = 'pointer'; p.roarBtn.style.fontWeight = 'bold';
      p.roarCd.style.width = '0';
    } else {
      p.roarLbl.textContent = sig;
      p.roarBtn.style.border = '1px solid #6a5a30'; p.roarBtn.style.background = '#16120a'; p.roarBtn.style.color = '#9a8a55'; p.roarBtn.style.cursor = 'default'; p.roarBtn.style.fontWeight = 'normal';
      p.roarCd.style.width = ((1 - st.sigCdFrac) * 100) + '%';
    }
  }

  private onRoyalRoar(): void {
    const st = this.registry.get('royal.status') as RoyalStatus | undefined;
    if (!st || !st.alive || !st.sigReady) return;
    this.eventBus.emit('triggerSignature', { unitId: st.id });
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
