// Hivyss scenarios engine — PERMANENT infrastructure.
//
// LIFECYCLE: this file is NOT phase-scoped. It is built once and
// reused across every phase of the combat rewrite program. Do NOT
// delete or rewrite this file when a phase closes — delete the
// phase-scoped scenario DEFINITIONS file (phase<N>Scenarios.ts)
// instead.
//
// If you're reading this during a phase transition, your cleanup
// target is phase<current>Scenarios.ts, NOT this file.
//
// Extensions to this file (new scenario features like pause-on-
// spawn, variadic positioning helpers, scene-reset hooks, etc.) are
// welcome — they benefit every phase's scenarios automatically.
// Just don't put phase-specific scenario definitions in here.
//
// How this wires up:
//   - Sandbox attaches a ScenarioContext provider on scene enter
//     via ScenarioEngine.attachSandbox and detaches on shutdown.
//   - The /scenarios debug command routes subcommands (list / run /
//     reset / help) through the pure API below.
//   - Scenario definitions live in separate per-phase files and
//     call registerScenario() to publish themselves into the engine.

import type { Side } from '../types';
import { registerDebugCommand } from '../systems/DebugConsole';

// --- Public types ---------------------------------------------------

export interface ScenarioContext {
  /** Spawn a unit by registry key at the given x (y is route-derived). */
  spawn(key: string, side: Side, x: number): unknown;
  /** Remove every unit currently in the sandbox. */
  clear(): void;
  /** Kick off the combat loop so the scenario runs without a manual click. */
  startFight(): void;
}

export interface Scenario {
  name: string;
  description: string;
  setup: (ctx: ScenarioContext) => void;
  helpText?: string;
}

// --- Registry -------------------------------------------------------

const scenarios = new Map<string, Scenario>();

/**
 * Register a scenario. Re-registering the same name overwrites the
 * existing entry — this is intentional so a scene re-enter (or a
 * dev hot-reload of the definitions module) doesn't error.
 */
export function registerScenario(def: Scenario): void {
  scenarios.set(def.name, def);
}

/** Clear the registry. Primarily for test teardown. */
export function unregisterAllScenarios(): void {
  scenarios.clear();
}

/** Snapshot of currently registered scenarios, in insertion order. */
export function listScenarios(): Scenario[] {
  return Array.from(scenarios.values());
}

/**
 * Pure API: clear the sandbox and invoke a scenario's setup. Throws
 * if the name isn't registered. The command dispatcher wraps this in
 * a try/catch so the dev console stays usable on bad input.
 */
export function runScenario(name: string, ctx: ScenarioContext): void {
  const scenario = scenarios.get(name);
  if (!scenario) throw new Error(`Unknown scenario: ${name}`);
  ctx.clear();
  scenario.setup(ctx);
}

/** Pure API: clear the sandbox without running anything. */
export function resetScenario(ctx: ScenarioContext): void {
  ctx.clear();
}

// --- Live sandbox attachment ---------------------------------------

let _contextProvider: (() => ScenarioContext) | null = null;

export const ScenarioEngine = {
  /**
   * A scene attaches itself on entry so the /scenarios command can
   * find the live sandbox API. Mirrors HpHud.attachSource.
   */
  attachSandbox(provider: () => ScenarioContext): void {
    _contextProvider = provider;
  },

  /** Detach on shutdown so stale scene references don't leak. */
  detachSandbox(): void {
    _contextProvider = null;
  },
};

// --- Dev command dispatch ------------------------------------------

function formatList(): string {
  const list = listScenarios();
  if (list.length === 0) return 'No scenarios registered.';
  return list.map((s) => `${s.name} — ${s.description}`).join('\n');
}

function validNamesHint(): string {
  const names = listScenarios().map((s) => s.name);
  return names.length > 0 ? names.join(', ') : '(none registered)';
}

/**
 * The /scenarios dispatch handler. Exported so tests can exercise
 * subcommand routing without touching DebugConsole internals.
 */
export function runScenariosCommand(args: string[]): string {
  const sub = (args[0] ?? '').toLowerCase();

  if (!sub || sub === 'list') {
    return formatList();
  }

  if (sub === 'reset') {
    if (!_contextProvider) return 'No active sandbox.';
    try {
      resetScenario(_contextProvider());
      return 'Sandbox cleared.';
    } catch (e) {
      return `Error resetting scenario: ${e}`;
    }
  }

  if (sub === 'help') {
    const target = args[1];
    if (!target) return 'Usage: scenarios help <name>';
    const scenario = scenarios.get(target);
    if (!scenario) {
      return `Unknown scenario: ${target}. Valid: ${validNamesHint()}`;
    }
    return scenario.helpText ?? scenario.description;
  }

  const name = args[0];
  if (!scenarios.has(name)) {
    return `Unknown scenario: ${name}. Valid: ${validNamesHint()}`;
  }

  if (!_contextProvider) return 'No active sandbox. Open SandboxScene first.';

  try {
    runScenario(name, _contextProvider());
    return `Scenario "${name}" loaded.`;
  } catch (e) {
    return `Error running scenario "${name}": ${e}`;
  }
}

// Register once at module load — any consumer that imports this
// module makes /scenarios available. SandboxScene is the only
// importer; in prod builds the DEV-guarded import is tree-shaken.
registerDebugCommand(
  'scenarios',
  'Run smoke scenarios (list | <name> | reset | help <name>)',
  runScenariosCommand,
);
