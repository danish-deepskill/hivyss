import type { BuildingDrawFunction } from '../../../types';
import { BUILDING_HEIGHT, BUILDING_HALF_W } from './dims';

// Nectar Font — the economy building. A tiered stone basin with golden nectar
// welling up. Scaffold while building, full font when complete, rubble when dead.
const drawNectarFont: BuildingDrawFunction = (g, s) => {
  const { side, frac, dead, hitFlash, groundY: GND, progress, complete } = s;
  const W = BUILDING_HALF_W;
  const H = BUILDING_HEIGHT;
  const topY = GND - H;
  const dark = 0x2a2418;
  const stone = side === 'player' ? 0x6f6a58 : 0x7a5a4a;
  const gold = 0xf0c040;
  const glint = 0xffe890;

  // Ground shadow.
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(0, GND + 2, W * 2.4, 8);

  // ── DEAD — rubble + a last gold puddle.
  if (dead) {
    g.fillStyle(dark, 1);
    g.fillEllipse(0, GND - 3, W * 1.6, 11);
    g.fillStyle(stone, 0.85);
    g.fillCircle(-W * 0.5, GND - 4, 4);
    g.fillCircle(W * 0.4, GND - 3, 3.5);
    g.fillStyle(gold, 0.5);
    g.fillEllipse(0, GND - 2, W * 0.8, 4);
    return;
  }

  // ── UNDER CONSTRUCTION — scaffold + rising fill.
  if (!complete) {
    const fillH = H * Math.max(0, Math.min(1, progress));
    g.fillStyle(stone, 0.9);
    g.fillRect(-W * 0.7, GND - fillH, W * 1.4, fillH);
    g.lineStyle(2, dark, 0.85);
    g.strokeRect(-W * 0.85, topY, W * 1.7, H);
    g.lineBetween(-W * 0.85, topY + H * 0.5, W * 0.85, topY + H * 0.5);
    g.fillStyle(gold, 0.9);
    g.fillRect(-W * 1.0, GND - fillH - 1, 3, 3);
    return;
  }

  // ── COMPLETE — tiered basin (wide base · stem · top bowl) brimming with nectar.
  g.fillStyle(dark, 1);
  g.fillEllipse(0, GND - 4, W * 1.7, 12);
  g.fillStyle(stone, 1);
  g.fillEllipse(0, GND - 5, W * 1.5, 9);
  g.fillStyle(gold, 0.85);
  g.fillEllipse(0, GND - 6, W * 1.1, 5);

  g.fillStyle(stone, 1);
  g.fillRect(-W * 0.32, topY + H * 0.32, W * 0.64, H * 0.5);
  g.fillStyle(dark, 0.5);
  g.fillRect(-W * 0.32, topY + H * 0.32, W * 0.12, H * 0.5);

  g.fillStyle(dark, 1);
  g.fillEllipse(0, topY + H * 0.3, W * 1.0, 8);
  g.fillStyle(stone, 1);
  g.fillEllipse(0, topY + H * 0.28, W * 0.85, 6);
  g.fillStyle(gold, 0.9);
  g.fillEllipse(0, topY + H * 0.27, W * 0.6, 4);

  // Welling droplets (deterministic — no per-frame anim state here).
  g.fillStyle(glint, 0.9);
  g.fillCircle(0, topY + H * 0.16, 2.4);
  g.fillCircle(-W * 0.18, topY + H * 0.22, 1.5);
  g.fillCircle(W * 0.2, topY + H * 0.2, 1.6);

  // Wear crack below half HP.
  if (frac < 0.5) {
    g.lineStyle(1.4, 0x000000, 0.5 * (1 - frac));
    g.lineBetween(-W * 0.2, topY + H * 0.45, W * 0.15, GND - 8);
  }

  // Hit-flash overlay.
  if (hitFlash > 0) {
    g.fillStyle(0xffffff, hitFlash * 1.4);
    g.fillEllipse(0, GND - 5, W * 1.5, 9);
    g.fillRect(-W * 0.32, topY + H * 0.32, W * 0.64, H * 0.5);
  }
};

export default drawNectarFont;
