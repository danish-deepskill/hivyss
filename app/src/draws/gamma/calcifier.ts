import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike } from '../../units/renderUtils';

// Calcifier — γ's T3 tomb-wall: a beetle that has CALCIFIED into a walking slab
// of crystal-crusted stone. The biggest, heaviest γ body — a low hunched
// carapace of overlapping stone plates, with a cluster of angular MINERAL
// crystals erupting from the rear of its shell (the calcified armour the
// recalcify passive keeps re-growing; it shimmers, brighter when worn). A blunt
// stone head with heavy mandibles bites at the front. Built to its siblings'
// shape (dome + signature-behind + front head + legs) so it reads as one of the
// roster — distinct via the crystal growth + stone plating, not a new body plan.
const MINERAL = 0x6f8aa6;    // crystalline accent (γ palette accent)
const MINERAL_LT = 0xb2cce0; // crystal highlight

const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const shell = hexToInt(u.primary), dark = hexToInt(u.secondary);
  const stone = lerpColor(shell, 0x8f8d86, 0.32); // shell shifted toward grey rock
  const s = getStrike(u);
  const cy = uy + h * 0.6;
  const wear = 1 - u.hp / u.maxHp;
  // Re-hardening shimmer over the crystals — slow pulse, stronger when worn.
  const shimmer = (0.5 + 0.5 * Math.sin(u.bob * 2.0)) * (0.4 + 0.5 * wear);

  // Ground shadow — broad and heavy.
  g.fillStyle(0x000000, 0.26);
  g.fillEllipse(cx, uy + h * 1.0, w * 0.84, h * 0.12);

  // Short thick stone legs, planted.
  g.lineStyle(2.8, dark, 1);
  for (let i = -1; i <= 1; i++) {
    const lx = cx + i * w * 0.24;
    g.lineBetween(lx, cy + h * 0.22, lx, uy + h);
  }

  // CRYSTAL CLUSTER — mineral spires growing OUT of the rear of the shell
  // (drawn behind the carapace, rooted into it — not a floating crown).
  const rx = cx - f * w * 0.22;
  const spires: [number, number, number][] = [
    [-0.16, 0.4], [-0.04, 0.62], [0.08, 0.5], [0.2, 0.34], [0.0, 0.32],
  ].map(([dx, ln]) => [dx, dx * 0.5, ln]);
  for (const [dx, skew, ln] of spires) {
    const bx = rx + dx * w;
    const by = cy - h * 0.16;
    const tipx = bx + skew * w * 0.4 - f * w * 0.04;
    const tipy = by - h * ln;
    g.fillStyle(lerpColor(MINERAL, dark, 0.28), 1);
    g.fillTriangle(bx - w * 0.055, by + h * 0.04, bx + w * 0.055, by + h * 0.04, tipx, tipy);
    g.fillStyle(lerpColor(MINERAL_LT, 0xffffff, shimmer * 0.5), 0.4 + 0.45 * shimmer);
    g.fillTriangle(bx - w * 0.012, by + h * 0.03, bx + w * 0.03, by + h * 0.03, tipx, tipy);
  }

  // CARAPACE — a low broad stone dome (wider than tall: a bug shell).
  shadedBlob(g, cx, cy, w * 0.9, h * 0.76, stone);

  // Plate seams — gentle curved bands across the shell (segmented carapace).
  g.lineStyle(1.6, lerpColor(stone, dark, 0.55), 0.7);
  for (let i = 0; i < 3; i++) {
    const px = cx + f * (-0.16 + i * 0.18) * w;
    g.beginPath();
    g.arc(px, cy + h * 0.62, h * 0.72, Math.PI * 1.18, Math.PI * 1.82);
    g.strokePath();
  }

  // Chiselled highlight on the crown of the shell.
  g.fillStyle(lerpColor(stone, 0xffffff, 0.28), 0.32);
  g.fillEllipse(cx - f * w * 0.08, cy - h * 0.2, w * 0.34, h * 0.2);

  // HEAD — a blunt stone head at the front with heavy mandibles.
  const hx = cx + f * (w * 0.4 + s.reach * w * 0.12);
  shadedBlob(g, hx, cy + h * 0.08, w * 0.24, h * 0.36, lerpColor(stone, dark, 0.2));
  // Small recessed eye — a dim amber gleam, deliberately small (no glow-bar).
  g.fillStyle(0xffcf66, 0.85);
  g.fillCircle(hx + f * w * 0.05, cy - h * 0.02, w * 0.028);
  // Mandibles — two short stone tusks that spread on the bite.
  const open = (s.coil * 0.35 + s.lunge) * h * 0.14;
  g.lineStyle(2.6, lerpColor(dark, 0x000000, 0.25), 1);
  g.lineBetween(hx + f * w * 0.1, cy + h * 0.12, hx + f * w * 0.24, cy + h * 0.04 - open);
  g.lineBetween(hx + f * w * 0.1, cy + h * 0.18, hx + f * w * 0.24, cy + h * 0.26 + open);

  // Wear — fissures crack across the shell as it takes real damage.
  if (wear > 0.2) {
    g.lineStyle(1.6, lerpColor(stone, 0x000000, 0.7), 0.5 + 0.4 * wear);
    g.lineBetween(cx - w * 0.18, cy - h * 0.16, cx + w * 0.02, cy + h * 0.26);
    if (wear > 0.55) g.lineBetween(cx + w * 0.08, cy - h * 0.14, cx - w * 0.06, cy + h * 0.28);
  }

  // Attack — a grind of pale mineral dust at the jaws.
  if (s.coil > 0.1 || s.lunge > 0.1) {
    const m = Math.max(s.coil, s.lunge);
    g.fillStyle(lerpColor(MINERAL_LT, 0xffffff, 0.4), 0.26 * m);
    g.fillEllipse(hx + f * w * 0.2, cy + h * 0.08, w * 0.16, h * 0.28);
  }
};

export default draw;
