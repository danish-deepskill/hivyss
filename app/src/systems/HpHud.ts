// Debug HP HUD — toggleable overlay listing every alive unit's HP.
//
// Built as a Phase 4→5 follow-up to make manual smoke tests on stacked
// unit scenarios actually verifiable. Reused by Phase 6/7/8 unit
// migration smoke tests, where each migration needs HP-parity checks.
//
// Singleton design: one DOM overlay, one source-of-truth getter that
// each scene attaches on entry and detaches on exit. The debug command
// is registered once at module load — any consumer of HpHud just
// imports it and the command becomes available.
//
// Toggle from the debug console: type `hphud` and press Enter.

import type { IUnit } from '../types';
import { registerDebugCommand } from './DebugConsole';

type UnitSource = () => readonly IUnit[];

let _source: UnitSource | null = null;
let _overlay: HTMLDivElement | null = null;
let _rafHandle: number = 0;

function buildOverlay(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = 'hp-hud-overlay';
  el.style.cssText =
    'position:fixed; top:4px; left:4px; max-height:90vh; overflow-y:auto;' +
    ' background:rgba(0,0,0,0.85); color:#0f0;' +
    ' font-family:"Courier New",monospace; font-size:10px;' +
    ' padding:6px 10px; z-index:9999; white-space:pre;' +
    ' pointer-events:none; border:1px solid #333; border-radius:3px;';
  document.body.appendChild(el);
  return el;
}

function formatLine(u: IUnit): string {
  const tag = u.side === 'player' ? 'P' : 'E';
  const flag = u.burrowed ? '~' : ' ';
  const name = (u.unitName || u.key || '?').padEnd(12).slice(0, 12);
  const hp = String(Math.max(0, Math.round(u.hp))).padStart(5);
  const max = String(u.maxHp).padStart(5);
  const x = String(Math.round(u.x)).padStart(5);
  const y = String(Math.round(u.y)).padStart(4);
  return `${tag}${flag} ${name} ${hp}/${max}  (${x},${y})`;
}

function renderTick(): void {
  if (!_overlay) return;
  const units = _source ? _source() : [];
  const alive: IUnit[] = [];
  for (const u of units) if (!u.dead) alive.push(u);

  let body = `HP HUD — ${alive.length} alive (${units.length} total)\n`;
  for (const u of alive) body += formatLine(u) + '\n';
  _overlay.textContent = body;

  _rafHandle = requestAnimationFrame(renderTick);
}

export const HpHud = {
  /** Scenes call this on entry to point the HUD at their unit list. */
  attachSource(source: UnitSource): void {
    _source = source;
  },

  /** Scenes call this on shutdown so the HUD doesn't read stale data. */
  detachSource(): void {
    _source = null;
    HpHud.hide();
  },

  show(): void {
    if (_overlay) return;
    _overlay = buildOverlay();
    renderTick();
  },

  hide(): void {
    if (_rafHandle) cancelAnimationFrame(_rafHandle);
    _rafHandle = 0;
    if (_overlay) {
      _overlay.remove();
      _overlay = null;
    }
  },

  /** Returns true if the HUD is now visible after the toggle. */
  toggle(): boolean {
    if (_overlay) {
      HpHud.hide();
      return false;
    }
    HpHud.show();
    return true;
  },
};

// Register the command once at module load. Any module that imports
// HpHud (GameManager, SandboxScene) makes the command available.
registerDebugCommand('hphud', 'Toggle HP HUD overlay (lists every alive unit)', () => {
  if (!_source) return 'No active battle. Start one first.';
  const on = HpHud.toggle();
  return on ? 'HP HUD shown.' : 'HP HUD hidden.';
});
