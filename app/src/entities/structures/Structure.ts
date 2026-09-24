import Phaser from 'phaser';
import type { Side } from '../../types';

// Structure — shared scaffolding for every procedural BUILDING visual (the hive
// base, spires, and future Warren chambers / Forage mounds / walls). Owns
// the common state (HP, hit-flash, the graphics object) and the constructor
// boilerplate; subclasses set their own fields, call redraw() at the end of
// their constructor, implement redraw(), and own their update() cadence (the
// flash/fire timers differ per building, so update lives on the subclass).
//
// Pairs with StructureEntity (the WorldEntity wrapper). Adding a new building =
// extend Structure (its body) + wrap it in a StructureEntity (its targetability).
export abstract class Structure extends Phaser.GameObjects.Container {
  side: Side;
  hp: number;
  maxHp: number;
  flashTimer: number;
  gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, side: Side, maxHp: number) {
    super(scene, x, 0);
    this.side = side;
    this.hp = maxHp;
    this.maxHp = maxHp;
    this.flashTimer = 0;
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    scene.add.existing(this);
    // Subclasses call redraw() after setting their own fields (the base can't —
    // those fields don't exist yet here).
  }

  setHp(hp: number): void {
    this.hp = Math.max(0, Math.min(this.maxHp, hp));
    this.redraw();
  }

  flash(duration: number = 0.2): void {
    this.flashTimer = duration;
  }

  /** Paint the building from current state into this.gfx (clear it first). */
  abstract redraw(): void;
}
