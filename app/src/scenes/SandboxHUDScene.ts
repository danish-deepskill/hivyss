import Phaser from 'phaser';
import { W, H } from '../config/Constants';
import { LANE } from '../config/Layout';
const GND = LANE.land.groundY;
import { UNIT_DEFS, GENELINES } from '../units/registry';
import { EventBus } from '../systems/EventBus';
import type { GeneLine } from '../types';

// Panel geometry — kept in sync with SandboxScene's screen-space
// pointer filter. Panel grew from 180 → 210 to fit the geneline tab
// row above the roster.
const CONTROL_PANEL_H = 210;
const CONTROL_PANEL_TOP_Y = H - CONTROL_PANEL_H;

/**
 * HUD sibling for SandboxScene. All UI lives here at 1.0× zoom so it
 * stays fixed on screen while SandboxScene zooms and scrolls under it.
 * Communicates with SandboxScene via EventBus stored on the scene
 * registry under `sandbox.eventBus`.
 */
export class SandboxHUDScene extends Phaser.Scene {
  private eventBus!: EventBus;

  // Locally-tracked UI state. HUD owns "what's selected" and "which
  // geneline tab is active"; SandboxScene mirrors selection via the
  // event stream. Side is derived from pointer position in SandboxScene.
  private selectedKey: string | null = null;
  private activeGeneline: GeneLine = 'alpha';
  private running = false;

  // UI refs
  private clearBtn!: Phaser.GameObjects.Text;
  private selectedLabel!: Phaser.GameObjects.Text;
  private rosterIcons!: Phaser.GameObjects.Image[];
  private rosterLabels!: Phaser.GameObjects.Text[];
  private rosterY = 0;
  private genelineTabs!: Map<GeneLine, Phaser.GameObjects.Text>;
  private resultText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;

  constructor() {
    super('SandboxHUDScene');
  }

  create(): void {
    this.eventBus = this.registry.get('sandbox.eventBus');
    this.rosterIcons = [];
    this.rosterLabels = [];
    this.genelineTabs = new Map();

    this.buildTopBar();
    this.buildResultText();
    this.buildControlPanel();
    this.updateSelectedLabel();

    // ESC deselects.
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.selectedKey === null) return;
      this.selectedKey = null;
      this.updateSelectedLabel();
      this.eventBus.emit('sandboxSelectUnit', { unitKey: null });
    });

    const onSelect = (evt: { unitKey: string | null }) => {
      this.selectedKey = evt.unitKey;
      this.updateSelectedLabel();
    };
    const onRunning = (evt: { running: boolean }) => {
      this.running = evt.running;
      this.setRunningLock(evt.running);
    };
    const onResult = (evt: { result: string; message: string; color: string; timeStr: string }) => {
      this.resultText.setText(evt.message);
      this.resultText.setColor(evt.color);
      this.statsText.setText(evt.timeStr);
    };

    this.eventBus.on('sandboxSelectUnit', onSelect);
    this.eventBus.on('sandboxRunningState', onRunning);
    this.eventBus.on('sandboxFightResult', onResult);

    this.events.once('shutdown', () => {
      this.eventBus.off('sandboxSelectUnit', onSelect);
      this.eventBus.off('sandboxRunningState', onRunning);
      this.eventBus.off('sandboxFightResult', onResult);
    });
  }

  // ---------------------------------------------------------------
  // UI construction
  // ---------------------------------------------------------------

  private buildTopBar(): void {
    const topY = 12;

    this.makeBtn(60, topY, '\u25C0 BACK', () => {
      this.scene.stop('SandboxScene');
      this.scene.start('MainMenuScene');
    }, '#888', '13px');

    this.add.text(W * 0.45, topY - 2, 'SANDBOX \u2014 CLICK UNIT TO PLACE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px', color: '#f0c040',
    }).setOrigin(0.5, 0);

    this.clearBtn = this.makeBtn(W - 240, topY, '\u2716 CLEAR',
      () => this.eventBus.emit('sandboxClear', {}), '#aaa', '13px');
    this.makeBtn(W - 140, topY - 2, '\u2694 FIGHT',
      () => this.eventBus.emit('sandboxFight', {}), '#f0c040', '16px');
    this.makeBtn(W - 50, topY, '\u21BB RESET',
      () => this.eventBus.emit('sandboxReset', {}), '#888', '13px');
  }

  private buildResultText(): void {
    this.resultText = this.add.text(W / 2, GND + 20, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '17px', color: '#f0c040',
    }).setOrigin(0.5, 0);

    this.statsText = this.add.text(W / 2, GND + 42, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '13px', color: '#666',
    }).setOrigin(0.5, 0);
  }

  private buildControlPanel(): void {
    const panelY = CONTROL_PANEL_TOP_Y;

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0a0a14, 0.85);
    panelBg.fillRect(0, panelY, W, H - panelY);
    panelBg.lineStyle(1, 0xffffff, 0.1);
    panelBg.lineBetween(0, panelY, W, panelY);

    // Selected indicator at the top of the panel.
    this.selectedLabel = this.add.text(20, panelY + 14, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '11px', color: '#ccc',
    }).setOrigin(0, 0);

    // Geneline tabs in the middle band.
    this.buildGenelineTabs(panelY + 44);

    // Roster at the bottom. Y cached so setActiveGeneline can rebuild
    // with the same origin without recomputing.
    this.rosterY = panelY + 120;
    this.buildRoster();
  }

  private buildGenelineTabs(tabY: number): void {
    const populated = Object.keys(GENELINES).sort() as GeneLine[];
    const tabW = 140;
    const gap = 8;
    const totalW = populated.length * tabW + (populated.length - 1) * gap;
    let x = (W - totalW) / 2 + tabW / 2;

    for (const g of populated) {
      const tab = this.add.text(x, tabY, this.genelineLabel(g), {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '11px', color: '#ccc',
        backgroundColor: '#0a0a14',
        padding: { x: 11, y: 6 },
        fixedWidth: tabW,
        align: 'center',
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      tab.on('pointerover', () => tab.setAlpha(0.7));
      tab.on('pointerout', () => tab.setAlpha(this.running ? 0.4 : 1));
      tab.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (!pointer.leftButtonDown()) return;
        if (this.running) return;
        this.setActiveGeneline(g);
      });
      this.genelineTabs.set(g, tab);
      x += tabW + gap;
    }
    this.refreshGenelineTabs();
  }

  private genelineLabel(g: GeneLine): string {
    if (g === 'normal') return 'UNCLASSIFIED';
    return g.toUpperCase();
  }

  private buildRoster(): void {
    const keys = GENELINES[this.activeGeneline] ?? [];
    const slotW = 65;
    const totalW = keys.length * slotW;
    const startX = (W - totalW) / 2 + slotW / 2;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const x = startX + i * slotW;
      const icon = this.add.image(x, this.rosterY, '_sb_preview_' + key);
      icon.setScale(1.5);
      icon.setInteractive({ useHandCursor: true });
      icon.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (!pointer.leftButtonDown()) return;
        if (this.running) return;
        this.onRosterClick(key);
      });
      this.rosterIcons.push(icon);

      const def = UNIT_DEFS[key];
      const lbl = this.add.text(x, this.rosterY + 38, def.name, {
        fontFamily: '"Courier New", monospace',
        fontSize: '10px', color: '#888',
      }).setOrigin(0.5, 0);
      this.rosterLabels.push(lbl);
    }

    // Re-apply lock styling if rebuilt mid-fight.
    if (this.running) {
      this.rosterIcons.forEach((ic) => ic.setAlpha(0.4));
      this.rosterLabels.forEach((lbl) => lbl.setAlpha(0.4));
    }
  }

  private makeBtn(
    x: number, y: number, label: string, cb: () => void,
    color: string = '#ccc', size: string = '14px',
  ): Phaser.GameObjects.Text {
    const btn = this.add.text(x, y, label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: size, color: color,
      backgroundColor: '#0a0a14',
      padding: { x: 11, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setAlpha(0.7));
    btn.on('pointerout', () => btn.setAlpha(1));
    btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      cb();
    });
    return btn;
  }

  // ---------------------------------------------------------------
  // User input handlers
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
    this.refreshGenelineTabs();
    // Rebuild the roster with the new geneline's keys.
    this.rosterIcons.forEach((ic) => ic.destroy());
    this.rosterIcons = [];
    this.rosterLabels.forEach((lbl) => lbl.destroy());
    this.rosterLabels = [];
    this.buildRoster();
    // Switching tabs should NOT deselect — keep whatever the user had.
    // If the previously-selected key is no longer in the visible tab,
    // that's fine; the ghost in SandboxScene stays; user can re-select
    // from the new tab or switch back.
  }

  // ---------------------------------------------------------------
  // Visual state
  // ---------------------------------------------------------------

  private refreshGenelineTabs(): void {
    this.genelineTabs.forEach((tab, g) => {
      const active = g === this.activeGeneline;
      tab.setBackgroundColor(active ? '#1a2c40' : '#0a0a14');
      tab.setColor(active ? '#f0c040' : '#888');
    });
  }

  private updateSelectedLabel(): void {
    if (!this.selectedKey) {
      this.selectedLabel.setText('Selected: \u2014');
    } else {
      const def = UNIT_DEFS[this.selectedKey];
      this.selectedLabel.setText(`Selected: ${def.name}`);
    }
  }

  /**
   * Running-state lock. Dim mutator controls + tabs to alpha 0.4
   * during a fight; restore on reset / win. Click handlers all
   * early-return on `this.running` so the dimming is purely visual.
   * Auto-deselects on lock so the ghost in SandboxScene clears.
   */
  private setRunningLock(locked: boolean): void {
    const a = locked ? 0.4 : 1;
    this.rosterIcons.forEach((ic) => ic.setAlpha(a));
    this.rosterLabels.forEach((lbl) => lbl.setAlpha(a));
    this.genelineTabs.forEach((tab) => tab.setAlpha(a));
    this.selectedLabel.setAlpha(a);
    this.clearBtn.setAlpha(a);
    if (locked && this.selectedKey !== null) {
      this.selectedKey = null;
      this.updateSelectedLabel();
      this.eventBus.emit('sandboxSelectUnit', { unitKey: null });
    }
  }
}
