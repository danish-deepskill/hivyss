import type { Chamber } from '../systems/IncubationManager';
import { MAX_CHAMBERS, MAX_LARVAE } from '../systems/IncubationManager';

interface SlotEntry {
  div: HTMLDivElement;
  ico: HTMLElement;
  bar: HTMLElement;
  timer: HTMLElement;
}

/**
 * DOM-based Larva Mound UI — shows incubation chambers above the unit tray.
 * Each chamber displays a unit preview, progress bar, and countdown timer.
 * Clicking an occupied chamber triggers cancel callback.
 */
export class LarvaMound {
  container: HTMLElement;
  larvaCounter: HTMLElement;
  slots: SlotEntry[];
  previews: Record<string, string>;
  onCancel: (index: number) => void;

  constructor(onCancel: (index: number) => void, previews: Record<string, string>) {
    this.onCancel = onCancel;
    this.previews = previews;
    this.slots = [];

    // Create container and insert before tray (remove stale one on restart)
    const old = document.getElementById('larva-mound');
    if (old) old.remove();
    this.container = document.createElement('div');
    this.container.id = 'larva-mound';
    const tray = document.getElementById('tray')!;
    tray.parentNode!.insertBefore(this.container, tray);

    // Larva counter above the slots
    this.larvaCounter = document.createElement('div');
    this.larvaCounter.id = 'larva-counter';
    this.container.appendChild(this.larvaCounter);

    this.build();
  }

  private build(): void {
    this.container.innerHTML = '';
    this.slots = [];

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
      timer.textContent = '';

      div.appendChild(ico);
      div.appendChild(bar);
      div.appendChild(timer);

      const idx = i;
      div.onclick = () => this.onCancel(idx);

      this.container.appendChild(div);
      this.slots.push({ div, ico, bar, timer });
    }
  }

  update(chambers: ReadonlyArray<Chamber | null>, numChambers: number, larvaCount: number): void {
    this.larvaCounter.textContent = `Larvae: ${larvaCount}/${MAX_LARVAE}`;
    this.larvaCounter.className = larvaCount === 0 ? 'lc-empty' : '';

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];

      if (i >= numChambers) {
        // Locked chamber
        slot.div.className = 'lm-slot lm-locked';
        slot.ico.innerHTML = '<span class="lm-lock">X</span>';
        slot.bar.style.transform = 'scaleX(0)';
        slot.timer.textContent = '';
        continue;
      }

      const chamber = chambers[i];

      if (!chamber) {
        // Empty unlocked chamber
        slot.div.className = 'lm-slot lm-empty';
        slot.ico.innerHTML = '<span class="lm-empty-mark">--</span>';
        slot.bar.style.transform = 'scaleX(0)';
        slot.timer.textContent = '';
      } else {
        // Incubating
        const progress = 1 - chamber.remaining / chamber.total;
        const isAlmostDone = chamber.remaining <= 1;
        slot.div.className = 'lm-slot lm-active' + (isAlmostDone ? ' lm-hatching' : '');
        const preview = this.previews[chamber.key];
        slot.ico.innerHTML = preview
          ? `<img class="lm-preview" src="${preview}" alt="${chamber.def.name}">`
          : `<span class="lm-unit-name">${chamber.def.name}</span>`;
        slot.bar.style.transform = `scaleX(${progress})`;
        slot.timer.textContent = Math.ceil(chamber.remaining) + 's';
      }
    }
  }

  destroy(): void {
    this.container.remove();
  }
}
