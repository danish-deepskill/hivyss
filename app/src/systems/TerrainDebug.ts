// Terrain debug overlay — a tiny no-Phaser module: the overlay flag, a live-grid
// reference (set by the TerrainSystem on BOTH drivers — sandbox + run), and the
// GLOBAL `terrain` console command, registered at load. Global (not battle-
// scoped like win/ai) so it works in the Sandbox too, which has no GameManager.

import { registerDebugCommand } from './DebugConsole';
import { TERRAIN_SEGMENT_WIDTH } from '../config/TerrainDefs';
import type { TerrainGrid } from './TerrainGrid';

let _on = false;
/** Is the terrain grid overlay currently shown? (read by TerrainRenderer each frame). */
export function isTerrainDebug(): boolean {
  return _on;
}

// Live grid ref — set by TerrainSystem so the command can dump cells in any driver.
let _grid: TerrainGrid | null = null;
/** Point the `terrain` command at the active battle's grid (null on teardown). */
export function setTerrainGridRef(grid: TerrainGrid | null): void {
  _grid = grid;
}

registerDebugCommand('terrain', 'Toggle terrain grid overlay + dump active cells', () => {
  _on = !_on;
  if (!_grid) return `Terrain overlay ${_on ? 'ON' : 'OFF'} (no live battle grid).`;
  const active: string[] = [];
  _grid.forEach((route, index, cell) => {
    if (cell.state === 'empty') return;
    const ttl = cell.ttl === Infinity ? '∞' : `${Math.ceil(cell.ttl)}s`;
    active.push(`${route}[${index}] ${cell.state}/${cell.element ?? '-'} hp=${cell.hp} ttl=${ttl}`);
  });
  return `Terrain overlay ${_on ? 'ON' : 'OFF'} — segments=${_grid.segments} segWidth=${TERRAIN_SEGMENT_WIDTH}\n`
    + (active.length ? active.join('\n') : '(no active cells)');
});
