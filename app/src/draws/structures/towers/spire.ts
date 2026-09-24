import type { TowerDrawFunction } from '../../../types';
import { TOWER_HEIGHT, TOWER_HALF_W } from './dims';

// Spire — the first Tower variant (γ's flavour). A bio-turret: a tapered chitin
// stalk with a glowing crystal eye that flares when it fires. Draws its STANDING
// body, a wear/crack state, the muzzle flare, a hit-flash overlay, and — when
// dead — a snapped BROKEN stump + rubble. Everything is keyed off state.groundY
// so the body sits correctly on the ground line.
const drawSpire: TowerDrawFunction = (g, s) => {
  const { side, frac, dead, fire, hitFlash, groundY: GND, crystal } = s;
  const isBlue = side === 'player';
  const topY = GND - TOWER_HEIGHT;
  const base = TOWER_HALF_W;
  const tip = TOWER_HALF_W * 0.5;
  const dark = isBlue ? 0x1a3450 : 0x4a1414;
  const body = isBlue ? 0x2f5a86 : 0x7a2424;

  // Ground shadow
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(0, GND + 2, TOWER_HALF_W * 2.6, 10);

  // ── BROKEN — a snapped stump + rubble + a dead crystal shard.
  if (dead) {
    const stumpH = TOWER_HEIGHT * 0.32;
    g.fillStyle(dark);
    g.fillPoints([
      { x: -base, y: GND }, { x: -tip * 1.3, y: GND - stumpH * 0.7 },
      { x: tip * 0.4, y: GND - stumpH }, { x: tip * 1.2, y: GND - stumpH * 0.5 }, { x: base, y: GND },
    ], true);
    g.fillStyle(body, 0.7); // jagged snap face
    g.fillPoints([
      { x: -base + 3, y: GND }, { x: -tip, y: GND - stumpH * 0.6 },
      { x: 0, y: GND - stumpH * 0.85 }, { x: tip * 0.8, y: GND - stumpH * 0.4 }, { x: base - 3, y: GND },
    ], true);
    g.fillStyle(dark); // rubble chunks
    g.fillCircle(-base * 0.7, GND - 2, 3);
    g.fillCircle(base * 0.9, GND - 1, 2.4);
    g.fillCircle(base * 0.3, GND - 3, 2);
    g.fillStyle(crystal, 0.22); // fallen, dimmed crystal shard
    g.fillCircle(base * 1.25, GND - 3, 3);
    return;
  }

  // ── STANDING — tapered chitin stalk (dark outline behind a lighter body)
  const outline = [
    { x: -base, y: GND }, { x: -tip, y: topY + 8 }, { x: tip, y: topY + 8 }, { x: base, y: GND },
  ];
  g.fillStyle(dark);
  g.fillPoints(outline, true);
  g.fillStyle(body);
  g.fillPoints([
    { x: -base + 3, y: GND }, { x: -tip + 2, y: topY + 10 }, { x: tip - 2, y: topY + 10 }, { x: base - 3, y: GND },
  ], true);

  // Chitin ribs
  g.lineStyle(1.5, dark, 0.6);
  for (let i = 0; i < 4; i++) {
    const ry = GND - 12 - i * 15;
    const w = base * (1 - i * 0.18);
    g.lineBetween(-w, ry, w, ry);
  }

  // Crystal eye (firing pod) — brightens + swells on a shot, dims when wounded
  g.fillStyle(crystal, 0.45 + 0.5 * fire * frac);
  g.fillCircle(0, topY, 7 + 3 * fire);
  g.fillStyle(0xffffff, 0.35 + 0.5 * fire);
  g.fillCircle(0, topY, 3 + 2 * fire);

  // Wear — cracks once below half
  if (frac < 0.5) {
    g.lineStyle(1.5, 0x000000, 0.5 * (1 - frac));
    g.lineBetween(-tip, topY + 22, tip * 0.5, GND - 16);
    g.lineBetween(tip * 0.6, topY + 34, -tip * 0.3, GND - 10);
  }

  // Hit-flash overlay (body-shaped)
  if (hitFlash > 0) {
    g.fillStyle(0xffffff, hitFlash * 1.4);
    g.fillPoints(outline, true);
  }
};

export default drawSpire;
