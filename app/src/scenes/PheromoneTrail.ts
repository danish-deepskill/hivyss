import Phaser from 'phaser';
import { PHEROMONE_DEFS } from '../config/PheromoneDefs';
import { getGroundY } from '../config/RouteMatrix';
import type { PheromoneZone } from '../types';

/**
 * Render the pheromone deposit-fade trail. Shared by the sandbox and the
 * real run loop so both show identical scent. Each scent-blob is a
 * translucent ground disc + ring at its lane's ground line; overlapping
 * blobs read as one continuous trail. Pure — no scene state; the caller
 * owns the layer and clears it each frame before calling.
 */
export function drawPheromoneTrail(g: Phaser.GameObjects.Graphics, zones: PheromoneZone[]): void {
  for (const z of zones) {
    const def = PHEROMONE_DEFS[z.kind];
    const zy = getGroundY('land', z.lane);
    g.fillStyle(def.color, 0.18);
    g.fillCircle(z.x, zy, z.radius);
    g.lineStyle(2, def.color, 0.7);
    g.strokeCircle(z.x, zy, z.radius);
  }
}
