import type { AbilityDef } from '../types';
import { ABILITY_DEFS } from '../config/AbilityDefs';
import { AbilityManager } from '../systems/AbilityManager';
import { EconomyManager } from '../systems/EconomyManager';

interface ButtonEntry {
  btn: HTMLButtonElement;
  cdBar: HTMLElement | null;
}

// DOM-based ability buttons with cooldown overlays
export class AbilityBar {
  container: HTMLElement | null;
  onCast: (key: string) => void;
  buttons: Record<string, ButtonEntry>;

  constructor(onCast: (key: string) => void) {
    this.container = document.getElementById('abilities');
    this.onCast = onCast;
    this.buttons = {};
    this.build();
  }

  build(): void {
    this.container!.innerHTML = '';
    Object.entries(ABILITY_DEFS).forEach(([key, def]) => {
      const btn = document.createElement('button');
      btn.className = 'abl-btn';
      btn.id = 'abl-' + key;
      btn.innerHTML = `${def.icon} ${def.name}<br><small style="font-size:9px;color:#888">${def.desc} (\u2B21${def.cost})</small><div class="abl-cd" id="cd-${key}" style="width:0"></div>`;
      btn.onclick = () => this.onCast(key);
      this.container!.appendChild(btn);
      this.buttons[key] = {
        btn,
        cdBar: null,
      };
    });
    // Store refs
    Object.keys(this.buttons).forEach(key => {
      this.buttons[key].cdBar = document.getElementById('cd-' + key);
    });
  }

  update(abilityManager: AbilityManager, economy: EconomyManager, running: boolean): void {
    Object.entries(ABILITY_DEFS).forEach(([key, def]) => {
      const b = this.buttons[key];
      if (!b) return;
      b.btn.disabled = !abilityManager.canCast(key, economy) || !running;
      const pct = abilityManager.getCooldownPercent(key);
      b.cdBar!.style.width = pct + '%';
    });
  }
}
