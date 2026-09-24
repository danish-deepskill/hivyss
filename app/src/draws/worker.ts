import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Worker — the plain worker baseline (the Gatherer). Small + light forager body
// with long sensory antennae; non-combatant. While hauling it shows its carried
// load on its back (Forage sets resources.carry: 1 = nectar gold, 2 = corpse
// chitin) — that gold load is the Gatherer's "economy" read. The Scout is a
// distinct courier (see draws/scout.ts).
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const primary = hexToInt(u.primary);
  const dark = hexToInt(u.secondary);
  const bob = Math.sin(u.bob * 1.4) * 0.7; // a quick scurrying bob
  const cy = uy + h / 2 + bob;

  // Ground shadow.
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx, uy + h * 1.02, w * 0.6, h * 0.13);

  // Legs (3 pairs, splayed).
  g.lineStyle(1.3, dark, 1);
  for (let i = -1; i <= 1; i++) {
    const lx = cx + i * w * 0.16;
    g.lineBetween(lx, cy + h * 0.08, lx - f * w * 0.18, cy + h * 0.46);
    g.lineBetween(lx, cy + h * 0.08, lx + f * w * 0.14, cy + h * 0.46);
  }

  // Body — abdomen (dark, rear) · thorax (primary) · head (dark, front).
  g.fillStyle(dark, 1);
  g.fillEllipse(cx - f * w * 0.24, cy, w * 0.4, h * 0.5);
  g.fillStyle(primary, 1);
  g.fillEllipse(cx + f * w * 0.04, cy - h * 0.02, w * 0.34, h * 0.46);
  g.fillStyle(dark, 1);
  g.fillEllipse(cx + f * w * 0.3, cy - h * 0.04, w * 0.26, h * 0.36);

  // A soft dab on the back (body colour).
  g.fillStyle(primary, 0.5);
  g.fillCircle(cx - f * w * 0.24, cy - h * 0.28, w * 0.14);

  // Carried load on the back while hauling home (Forage sets resources.carry:
  // 1 = nectar gold, 2 = corpse chitin). Kill the carrier, lose the load.
  const carry = u.resources?.carry ?? 0;
  if (carry > 0) {
    const main = carry === 2 ? 0x9a9aa8 : 0xf0c040;
    const glint = carry === 2 ? 0xd8d8e4 : 0xffe890;
    g.fillStyle(main, 1);
    g.fillCircle(cx - f * w * 0.2, cy - h * 0.34, w * 0.17);
    g.fillStyle(glint, 0.9);
    g.fillCircle(cx - f * w * 0.24, cy - h * 0.4, w * 0.07);
  }

  // Long sensory antennae.
  g.lineStyle(1.2, primary, 1);
  const hx = cx + f * w * 0.36, hy = cy - h * 0.16;
  const tw = Math.sin(u.bob * 2) * w * 0.06; // antennae twitch
  g.lineBetween(hx, hy, hx + f * w * 0.36 + tw, hy - h * 0.52);
  g.lineBetween(hx, hy, hx + f * w * 0.54 + tw, hy - h * 0.22);

  // Eye glint.
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(cx + f * w * 0.34, cy - h * 0.06, w * 0.05);
};

export default draw;
