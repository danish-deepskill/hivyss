import { registerDebugCommand, unregisterDebugCommand } from './DebugConsole';
import { AIHiveController } from './AIHiveController';
import { capUsed, MAX_CAPACITY } from './Capacity';
import type { GameManager } from './GameManager';

// Battle debug-console commands (DEV only) — extracted from the GameManager
// constructor so the composition root stays readable. Callers pair
// register/unregister around the battle's lifetime; all commands close over
// the live GameManager.

const COMMANDS = ['win', 'nectar', 'wave', 'hp', 'ai'] as const;

export function registerBattleDebugCommands(gm: GameManager): void {
  registerDebugCommand('win', 'Instant victory', () => { gm.debugWin(); return 'Victory triggered.'; });
  registerDebugCommand('nectar', 'Set nectar (e.g. nectar 999)', (args) => {
    const n = parseInt(args[0]); if (isNaN(n)) return 'Usage: nectar <amount>';
    gm.economy.nectar = n; return `Nectar set to ${n}`;
  });
  registerDebugCommand('wave', 'Skip to wave end', () => {
    gm.waves.enemyQueue.length = 0;
    gm.waves.waveTimer = gm.waves.waveInterval - 0.1;
    return 'Wave skipped.';
  });
  registerDebugCommand('hp', 'Set player base HP (e.g. hp 9999)', (args) => {
    const n = parseInt(args[0]); if (isNaN(n)) return 'Usage: hp <amount>';
    gm.playerHive.base.setHp(n); return `Base HP set to ${n}`;
  });
  registerDebugCommand('ai', 'Toggle live AI hive overlay', () => {
    if (!(gm.waves instanceof AIHiveController)) return 'Not an AI battle.';
    const existing = document.getElementById('ai-debug-overlay');
    if (existing) { existing.remove(); return 'AI overlay hidden.'; }
    const overlay = document.createElement('div');
    overlay.id = 'ai-debug-overlay';
    overlay.style.cssText = 'position:fixed; top:4px; right:4px; background:rgba(0,0,0,0.8); color:#0f0; font-family:"Courier New",monospace; font-size:10px; padding:6px 10px; z-index:9999; white-space:pre; pointer-events:none; border:1px solid #333; border-radius:3px;';
    document.body.appendChild(overlay);
    const ai = gm.waves as AIHiveController;
    const updateOverlay = () => {
      if (!document.getElementById('ai-debug-overlay')) return;
      const chambers = ai.incubation.chambers
        .filter(c => c !== null)
        .map(c => `${c!.key} ${Math.ceil(c!.remaining)}s`)
        .join(', ') || 'empty';
      const larvaNext = ai.incubation.larvaCount < 10
        ? `(${Math.ceil(5 - ai.incubation.larvaTimer)}s)`
        : 'MAX';
      const aiCapUsed = capUsed(gm.units, 'enemy', ai.incubation.chambers);
      const capWarn = aiCapUsed >= MAX_CAPACITY ? ' [FULL]' : aiCapUsed >= MAX_CAPACITY * 0.8 ? ' [HIGH]' : '';
      overlay.textContent = [
        `AI: ${(ai as unknown as { profile: { personality: string } }).profile.personality}`,
        `Nectar: ${Math.floor(ai.nectar)} +${ai.income}/s`,
        `Larvae: ${ai.incubation.larvaCount} ${larvaNext}`,
        `Chambers: ${chambers}`,
        `Cap: ${aiCapUsed} / ${MAX_CAPACITY}${capWarn}`,
        `Base HP: ${gm.enemyHive.base.hp}/${gm.enemyHive.base.maxHp}`,
        `Intent: [${ai.intent.action}] ${ai.intent.details}`,
        `---`,
        ...ai.debugLog,
      ].join('\n');
      requestAnimationFrame(updateOverlay);
    };
    updateOverlay();
    return 'AI overlay shown. Type "ai" again to hide.';
  });
}

export function unregisterBattleDebugCommands(): void {
  for (const c of COMMANDS) unregisterDebugCommand(c);
}
