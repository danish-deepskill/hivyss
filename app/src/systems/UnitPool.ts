// Object pool for Unit instances — avoids constant new/destroy allocation.
// Pre-allocates a set of Units, reuses them via activate/deactivate cycle.

import Phaser from 'phaser';
import type { UnitDef, Side } from '../types';
import { Unit } from '../entities/Unit';

const INITIAL_SIZE = 40;
const GROW_SIZE = 10;

export class UnitPool {
  private scene: Phaser.Scene;
  private pool: Unit[];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.pool = [];
    this.grow(INITIAL_SIZE);
  }

  private grow(count: number): void {
    for (let i = 0; i < count; i++) {
      const unit = new Unit(this.scene);
      unit.setActive(false);
      unit.setVisible(false);
      this.pool.push(unit);
    }
  }

  /** Get an inactive unit from the pool, initialize it with the given def. */
  spawn(def: UnitDef, side: Side, x: number, lane = 0): Unit {
    let unit = this.pool.find(u => !u.active);
    if (!unit) {
      this.grow(GROW_SIZE);
      unit = this.pool.find(u => !u.active)!;
    }
    unit.init(def, side, x, lane);
    return unit;
  }

  /** Return a unit to the pool instead of destroying it. */
  despawn(unit: Unit): void {
    unit.deactivate();
  }

  destroy(): void {
    this.pool.forEach(u => u.destroy());
    this.pool = [];
  }
}
