import type { BuildingDrawFunction } from '../../../types';
import { BUILDING_HEIGHT, BUILDING_HALF_W } from './dims';

// Totem — the first Building variant (the example "prop"). Three states, all
// keyed off `groundY` so it sits on the land line:
//   - under construction → a chitin SCAFFOLD with the stone mass rising from the
//     ground by `progress` + a side progress pip.
//   - complete → a stacked stone totem with carved glowing eyes (side-tinted).
//   - dead → a low rubble mound.
const drawTotem: BuildingDrawFunction = (g, s) => {
  const { side, frac, dead, hitFlash, groundY: GND, progress, complete } = s;
  const isBlue = side === 'player';
  const W = BUILDING_HALF_W;
  const H = BUILDING_HEIGHT;
  const topY = GND - H;
  const dark = 0x2a2418;
  const stone = isBlue ? 0x6f6a58 : 0x7a5a4a;
  const accent = isBlue ? 0x70d8ff : 0xff7048;

  // Ground shadow.
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(0, GND + 2, W * 2.4, 8);

  // ── DEAD — a low broken mound.
  if (dead) {
    g.fillStyle(dark, 1);
    g.fillEllipse(0, GND - 3, W * 1.6, 11);
    g.fillStyle(stone, 0.85);
    g.fillCircle(-W * 0.5, GND - 4, 4);
    g.fillCircle(W * 0.4, GND - 3, 3.5);
    g.fillCircle(0, GND - 6, 3);
    return;
  }

  // ── UNDER CONSTRUCTION — scaffold + a rising filled mass.
  if (!complete) {
    const fillH = H * Math.max(0, Math.min(1, progress));
    g.fillStyle(stone, 0.9);
    g.fillRect(-W * 0.7, GND - fillH, W * 1.4, fillH);
    // scaffold frame (chitin struts).
    g.lineStyle(2, dark, 0.85);
    g.strokeRect(-W * 0.85, topY, W * 1.7, H);
    g.lineBetween(-W * 0.85, topY + H * 0.5, W * 0.85, topY + H * 0.5);
    g.lineBetween(-W * 0.85, GND, W * 0.85, topY); // diagonal brace
    // a glowing progress pip climbing the side.
    g.fillStyle(accent, 0.9);
    g.fillRect(-W * 1.0, GND - fillH - 1, 3, 3);
    return;
  }

  // ── COMPLETE — a stacked stone totem with a carved face.
  g.fillStyle(dark, 1);
  g.fillRect(-W * 0.82, topY - 2, W * 1.64, H + 2); // dark outline block
  g.fillStyle(stone, 1);
  g.fillRect(-W * 0.7, topY, W * 1.4, H);
  g.lineStyle(1.5, dark, 0.6);
  for (let i = 1; i < 3; i++) g.lineBetween(-W * 0.7, topY + (H / 3) * i, W * 0.7, topY + (H / 3) * i);

  // Carved face — glowing eyes near the top (side-tinted, dims when wounded).
  g.fillStyle(accent, 0.5 + 0.4 * frac);
  g.fillCircle(-W * 0.28, topY + H * 0.28, 3);
  g.fillCircle(W * 0.28, topY + H * 0.28, 3);
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(-W * 0.28, topY + H * 0.28, 1.2);
  g.fillCircle(W * 0.28, topY + H * 0.28, 1.2);

  // Wear — a crack once below half HP.
  if (frac < 0.5) {
    g.lineStyle(1.4, 0x000000, 0.5 * (1 - frac));
    g.lineBetween(-W * 0.3, topY + H * 0.4, W * 0.2, GND - 6);
  }

  // Hit-flash overlay (body-shaped).
  if (hitFlash > 0) {
    g.fillStyle(0xffffff, hitFlash * 1.4);
    g.fillRect(-W * 0.7, topY, W * 1.4, H);
  }
};

export default drawTotem;
