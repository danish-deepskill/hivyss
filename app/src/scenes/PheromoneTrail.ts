import Phaser from 'phaser';
import { PHEROMONE_DEFS } from '../config/PheromoneDefs';
import { getGroundY } from '../config/RouteMatrix';
import type { PheromoneZone } from '../types';

/**
 * Render the pheromone deposit-fade trail. Shared by the sandbox and the
 * real run loop so both show identical scent. Each scent-blob is a
 * translucent ground disc at the land ground line; overlapping blobs read as
 * one continuous trail — fill only, no ring, so overlaps blend into smooth
 * scent instead of a mesh of stroked edges. Pure — no scene state; the caller
 * owns the layer and clears it each frame.
 */
export function drawPheromoneTrail(g: Phaser.GameObjects.Graphics, zones: PheromoneZone[]): void {
  const zy = getGroundY('land');
  for (const z of zones) {
    const def = PHEROMONE_DEFS[z.kind];
    g.fillStyle(def.color, 0.18);
    g.fillCircle(z.x, zy, z.radius);
  }
}
