import type { BattleCore } from '../BattleCore';
import type { Side } from '../../types';
import type { Unit } from '../../entities/Unit';
import { Tower } from '../../entities/structures/Tower';
import { StructureManager, type StructureSlot } from './StructureManager';
import { TOWER_HEIGHT, TOWER_HALF_W } from '../../draws/structures/towers/dims';

// Towers — the defensive buildings a node installs (the node-grade gradient:
// Forage 0 · Warren 1 · Hive 2; STRATEGIC_DESIGN_SKETCH §13). A Tower is a
// stationary bio-turret: each interval it shoots the nearest enemy unit in range.
// Damage rides the canonical Unit.takeDamage. The placement/occupancy/terrain/
// free-on-death lifecycle lives in StructureManager; this adds ONLY firing + the
// click-to-inspect range ring. Stats (hp/range/damage/fireInterval) are
// per-variant in config/TowerDefs — towers are data-driven, not uniform.

interface TowerSlot extends StructureSlot<Tower> {
  cooldown: number;
}

export class Towers extends StructureManager<Tower, TowerSlot> {
  /** The tower whose range is shown (click-to-inspect); null = none. */
  private selectedTower: Tower | null = null;
  private rangeGfx?: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    core: BattleCore,
    /** Dispatch the projectile FX (muzzle → target). Wired to the FxDirector. */
    private onFire?: (sx: number, sy: number, tx: number, ty: number, color: number) => void,
  ) {
    super(scene, core, 'towers');
  }

  protected makeSlot(base: StructureSlot<Tower>): TowerSlot {
    return { ...base, cooldown: 0 };
  }

  protected footprintHalfW(): number {
    return TOWER_HALF_W;
  }

  /**
   * Install a tower for `side` at world-x — placed exactly there (per-pixel);
   * REJECTED → null if its footprint overlaps another structure. Destructible.
   */
  add(side: Side, x: number, variant = 'spire'): Tower | null {
    const slot = this.install(side, x, (placedX) => new Tower(this.scene, placedX, side, variant));
    return slot ? slot.structure : null;
  }

  tick(dt: number): void {
    for (const slot of this.slots) {
      if (!this.tickSlot(slot, dt)) continue; // dead — base freed the cell

      slot.cooldown -= dt;
      if (slot.cooldown > 0) continue;

      const target = this.nearestEnemyInRange(slot.structure);
      if (!target) continue;

      slot.structure.fire();
      const m = slot.structure.muzzle;
      this.onFire?.(m.x, m.y, target.x + target.unitW / 2, target.y + target.unitH / 2, slot.structure.crystalColor);
      target.takeDamage(slot.structure.def.damage);
      slot.cooldown = slot.structure.def.fireInterval;
    }
  }

  // Nearest living enemy unit by x-distance, inside range.
  private nearestEnemyInRange(tower: Tower): Unit | null {
    let best: Unit | null = null;
    let bestD = tower.def.range;
    for (const u of this.core.units) {
      if (u.dead || u.side === tower.side) continue;
      const d = Math.abs((u.x + u.unitW / 2) - tower.x);
      if (d <= bestD) { bestD = d; best = u; }
    }
    return best;
  }

  /** Restore every tower to full HP (sandbox Reset), then re-occupy + clear selection. */
  reset(): void {
    for (const slot of this.slots) {
      slot.structure.setHp(slot.structure.maxHp);
      slot.cooldown = 0;
    }
    super.reset(); // re-occupy cells freed by a prior death
    this.clearSelection();
  }

  // --- Click-to-inspect range ----------------------------------------------

  /** Hit-test a click; if it lands on a tower, show its range + return true. */
  selectAt(worldX: number, worldY: number): boolean {
    this.selectedTower = this.towerAt(worldX, worldY);
    this.drawRangeIndicator();
    return this.selectedTower !== null;
  }

  /** Hide the range indicator. */
  clearSelection(): void {
    if (!this.selectedTower) return;
    this.selectedTower = null;
    this.drawRangeIndicator();
  }

  private towerAt(x: number, y: number): Tower | null {
    for (const slot of this.slots) {
      const s = slot.structure;
      if (s.hp <= 0) continue;
      if (Math.abs(x - s.x) <= TOWER_HALF_W + 8
        && y >= s.groundY - TOWER_HEIGHT - 6 && y <= s.groundY + 8) return s;
    }
    return null;
  }

  // A dashed range ring (flattened for ground perspective) at the selected tower.
  private drawRangeIndicator(): void {
    if (!this.rangeGfx) {
      this.rangeGfx = this.scene.add.graphics();
      this.rangeGfx.setDepth(1);
    }
    const g = this.rangeGfx;
    g.clear();
    const t = this.selectedTower;
    if (!t) return;

    const rx = t.def.range;
    const ry = t.def.range * 0.2; // strong flatten → reads as a ground-plane oval
    g.fillStyle(t.crystalColor, 0.06);
    g.fillEllipse(t.x, t.groundY, rx * 2, ry * 2);
    g.lineStyle(2, t.crystalColor, 0.75);
    const segs = 56;
    for (let i = 0; i < segs; i += 2) { // every-other arc = a dash
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      g.beginPath();
      g.moveTo(t.x + Math.cos(a0) * rx, t.groundY + Math.sin(a0) * ry);
      g.lineTo(t.x + Math.cos(a1) * rx, t.groundY + Math.sin(a1) * ry);
      g.strokePath();
    }
  }

  destroy(): void {
    super.destroy(); // remove from index + free cells + destroy bodies
    this.rangeGfx?.destroy();
    this.rangeGfx = undefined;
    this.selectedTower = null;
  }
}
