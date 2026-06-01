import type { Side } from '../types';

/**
 * A single unit placement in the sandbox. Rendered pre-fight as a
 * ghost sprite; spawned as a live Unit on FIGHT. Side is derived
 * from click X at placement time (auto-side, Session C-2).
 */
export interface Placement {
  unitKey: string;
  side: Side;
  x: number;
  /**
   * Battle lane (0 = upper, 1 = lower), derived from the click Y at
   * placement time. Optional so old presets (saved before lanes) load
   * cleanly — callers default to 0 when absent.
   */
  lane?: number;
}

/**
 * A named set of placements. Stored in localStorage under
 * `sandbox_presets` as a JSON array; loaded via loadUserPresets.
 */
export interface SandboxPreset {
  name: string;
  placements: Placement[];
}

const STORAGE_KEY = 'sandbox_presets';

/**
 * Read user-saved presets from localStorage. Returns `[]` on any
 * error path (private browsing throwing on access, malformed JSON,
 * absent storage, non-array payload). Never throws.
 */
export function loadUserPresets(): SandboxPreset[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Light shape check — drop entries that don't match the
    // SandboxPreset interface. Keeps one corrupt entry from
    // breaking the rest.
    return parsed.filter((p: unknown): p is SandboxPreset =>
      typeof p === 'object' && p !== null
      && typeof (p as SandboxPreset).name === 'string'
      && Array.isArray((p as SandboxPreset).placements),
    );
  } catch {
    return [];
  }
}

/**
 * Save a named preset. Same-name entries overwrite silently per the
 * orchestrator-approved collision policy. Swallows storage errors
 * (quota exceeded, private browsing) with a console.warn.
 */
export function saveUserPreset(name: string, placements: Placement[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const existing = loadUserPresets();
    const filtered = existing.filter(p => p.name !== name);
    filtered.push({
      name,
      placements: placements.map(p => ({ ...p })),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[SandboxPresets] save failed:', e);
  }
}

/**
 * Remove a user-saved preset by name. Implemented for completeness;
 * no UI trigger in this phase.
 */
export function deleteUserPreset(name: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const existing = loadUserPresets();
    const filtered = existing.filter(p => p.name !== name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[SandboxPresets] delete failed:', e);
  }
}
