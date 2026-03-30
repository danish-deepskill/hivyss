import { BASE_HP } from '../config/Constants';
import { EconomyManager } from '../systems/EconomyManager';
import { IncubationManager, MAX_LARVAE, LARVA_SPAWN_RATE } from '../systems/IncubationManager';

// Manages DOM-based HUD elements (header, resource bar, log)
export class HUD {
  bhpFill: HTMLElement | null;
  bhpLbl: HTMLElement | null;
  nectarFill: HTMLElement | null;
  nectarNum: HTMLElement | null;
  incomeLbl: HTMLElement | null;
  stageLbl: HTMLElement | null;
  logTxt: HTMLElement | null;
  larvaeNum: HTMLElement | null;
  larvaeTimer: HTMLElement | null;

  constructor() {
    this.bhpFill = document.getElementById('bhp-fill');
    this.bhpLbl = document.getElementById('bhp-lbl');
    this.nectarFill = document.getElementById('nectar-fill');
    this.nectarNum = document.getElementById('nectar-num');
    this.incomeLbl = document.getElementById('income-lbl');
    this.stageLbl = document.getElementById('stage-lbl');
    this.logTxt = document.getElementById('log-txt');
    this.larvaeNum = document.getElementById('larvae-num');
    this.larvaeTimer = document.getElementById('larvae-timer');

    // Hide enemy HP bar elements
    const rhpFill = document.getElementById('rhp-fill');
    const rhpLbl = document.getElementById('rhp-lbl');
    if (rhpFill) rhpFill.parentElement!.style.display = 'none';
    if (rhpLbl) rhpLbl.style.display = 'none';
  }

  update(playerBaseHp: number, enemyBaseHp: number, economy: EconomyManager, stage: number, incubation: IncubationManager): void {
    const ph = Math.max(0, playerBaseHp / BASE_HP * 100);
    this.bhpFill!.style.width = ph + '%';
    this.bhpLbl!.textContent = String(Math.ceil(playerBaseHp));

    this.nectarFill!.style.width = economy.getGoldPercent() + '%';
    this.nectarNum!.textContent = String(Math.floor(economy.gold));
    this.incomeLbl!.textContent = '+' + economy.income + '/s';

    this.stageLbl!.textContent = 'STAGE ' + stage;

    // Larvae count
    this.larvaeNum!.textContent = incubation.larvaCount + '/' + MAX_LARVAE;
    if (incubation.larvaCount < MAX_LARVAE) {
      const remaining = Math.ceil(LARVA_SPAWN_RATE - incubation.larvaTimer);
      this.larvaeTimer!.textContent = remaining + 's';
    } else {
      this.larvaeTimer!.textContent = 'MAX';
    }
  }

  setLog(msg: string): void {
    this.logTxt!.textContent = msg;
  }
}
