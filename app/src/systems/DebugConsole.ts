// Debug command console — dev mode only
// Open with backtick (`), type command, press Enter
// Commands registered via register() from any system

type CommandFn = (args: string[]) => string;

const commands: Record<string, { fn: CommandFn; help: string }> = {};

export function registerDebugCommand(name: string, help: string, fn: CommandFn): void {
  commands[name] = { fn, help };
}

export function unregisterDebugCommand(name: string): void {
  delete commands[name];
}

// Built-in commands
registerDebugCommand('help', 'List all commands', () => {
  return Object.entries(commands)
    .map(([name, cmd]) => `${name} — ${cmd.help}`)
    .join('\n');
});

export function executeCommand(input: string): string {
  const parts = input.trim().split(/\s+/);
  const name = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  if (!name) return '';
  const cmd = commands[name];
  if (!cmd) return `Unknown command: ${name}. Type "help" for list.`;

  try {
    return cmd.fn(args);
  } catch (e) {
    return `Error: ${e}`;
  }
}

// Create the DOM overlay — call once from a scene
export function createDebugOverlay(parent: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.id = 'debug-console';
  overlay.style.cssText = 'display:none; position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.85); font-family:"Courier New",monospace; font-size:11px; color:#0f0; padding:6px; z-index:9999; pointer-events:auto;';

  const log = document.createElement('div');
  log.style.cssText = 'max-height:120px; overflow-y:auto; white-space:pre-wrap; margin-bottom:4px;';

  const input = document.createElement('input');
  input.type = 'text';
  input.style.cssText = 'width:100%; background:#111; border:1px solid #333; color:#0f0; font-family:inherit; font-size:inherit; padding:3px 6px; outline:none; box-sizing:border-box;';
  input.placeholder = 'type command...';

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cmd = input.value;
      if (cmd) {
        const result = executeCommand(cmd);
        log.textContent += `> ${cmd}\n${result}\n`;
        log.scrollTop = log.scrollHeight;
        input.value = '';
      }
    } else if (e.key === '`' || e.key === 'Escape') {
      e.preventDefault();
      overlay.style.display = 'none';
    }
    e.stopPropagation(); // prevent game input while typing
  });

  overlay.append(log, input);
  parent.appendChild(overlay);

  // Toggle with backtick
  document.addEventListener('keydown', (e) => {
    if (e.key === '`') {
      e.preventDefault();
      const visible = overlay.style.display !== 'none';
      overlay.style.display = visible ? 'none' : 'block';
      if (!visible) input.focus();
    }
  });
}
