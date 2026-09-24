import type { HiveDrawFunction } from '../../../types';
import { PALETTES } from '../../../config/Palettes';

// α Primal — the BONE WARREN (the original "beginning" body, restored). A
// squat mound of blood-red flesh over bone: ribbed with an exposed cage,
// crowned with a beast's horns, fronted by a FANGED MAW, ringed with a few
// trophy-spikes. Distinct from the wax dome by being a creature-mound, not a
// smooth shell. Color-locked to the α roster palette. (Kept deliberately as
// the first pass per direction — not the over-worked later iterations.)

const P = PALETTES.alpha;
const FLESH = P.primary;   // blood-red body
const BONE = P.secondary;  // pale bone — horns, ribs, fangs, spikes
const BLOOD = P.accent;    // dark blood — undershading
const DARK = P.shadow;     // near-black clotted blood — deepest shadow

// A tapered tusk/horn — hand-sampled quadratic bezier with a base→tip taper,
// drawn as a filled outline (no Phaser.Curves; runs only at draw time).
function tusk(
  g: Phaser.GameObjects.Graphics,
  x0: number, y0: number, xc: number, yc: number, x1: number, y1: number,
  baseHalf: number, tipHalf: number, color: number,
): void {
  const N = 10;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, mt = 1 - t;
    pts.push({ x: mt * mt * x0 + 2 * mt * t * xc + t * t * x1, y: mt * mt * y0 + 2 * mt * t * yc + t * t * y1 });
  }
  const left: { x: number; y: number }[] = [], right: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1);
    const half = baseHalf * (1 - t) + tipHalf * t;
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next.x - prev.x, dy = next.y - prev.y, len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * half, ny = (dx / len) * half;
    left.push({ x: pts[i].x + nx, y: pts[i].y + ny });
    right.push({ x: pts[i].x - nx, y: pts[i].y - ny });
  }
  g.fillStyle(color);
  g.fillPoints([...left, ...right.reverse()], true);
}

const drawAlphaHive: HiveDrawFunction = (g, s) => {
  const { side, frac, bw, groundY: GND } = s;
  const cx = bw / 2;
  const face = side === 'player' ? 1 : -1; // the maw + crown horns lean toward the field

  // Trophy-spike palisade ringing the base — bone stakes jutting from the dirt.
  for (let i = 0; i < 5; i++) {
    const sx = cx + (i - 2) * (bw * 0.19) + (i % 2 ? 4 : -3);
    const h = 14 + (i % 3) * 6;
    const lean = ((i % 2) ? 1 : -1) * 2;
    tusk(g, sx, GND + 2, sx + lean, GND - h * 0.6, sx + lean * 2, GND - h, 3.2, 0.6, BONE);
    g.fillStyle(DARK, 0.5);
    g.fillCircle(sx + lean * 2, GND - h, 1.4);
  }

  // Squat flesh mound — dark-blood underbelly, blood-red body over it, lumpy.
  g.fillStyle(DARK);
  g.fillEllipse(cx, GND - 4, bw * 0.98, 36);
  g.fillStyle(BLOOD);
  g.beginPath();
  g.moveTo(cx - bw * 0.46, GND);
  g.lineTo(cx - bw * 0.42, GND - 30);
  g.arc(cx, GND - 30, bw * 0.42, Math.PI, Math.PI * 0.05, false);
  g.lineTo(cx + bw * 0.46, GND);
  g.closePath();
  g.fillPath();
  g.fillStyle(FLESH);
  g.beginPath();
  g.moveTo(cx - bw * 0.4, GND);
  g.lineTo(cx - bw * 0.34, GND - 34);
  g.lineTo(cx - bw * 0.1, GND - 46);
  g.lineTo(cx + bw * 0.06 * face, GND - 40);
  g.lineTo(cx + bw * 0.3 * face, GND - 44);
  g.lineTo(cx + bw * 0.4, GND);
  g.closePath();
  g.fillPath();

  // Exposed ribcage — pale bone arcs over the flesh + a sternum spine.
  g.lineStyle(2.4, BONE, 0.85);
  for (let i = 0; i < 4; i++) {
    const ry = GND - 8 - i * 9;
    const spread = bw * 0.36 * (1 - i * 0.13);
    g.beginPath();
    g.arc(cx, ry + 12, spread, Math.PI * 1.15, Math.PI * 1.85, false);
    g.strokePath();
  }
  g.lineStyle(2.6, BONE, 0.9);
  g.beginPath();
  g.moveTo(cx, GND - 42);
  g.lineTo(cx, GND - 6);
  g.strokePath();

  // The FANGED MAW — a dark gullet at the base, biased toward the field,
  // framed by a row of bone fangs.
  const mawCx = cx + bw * 0.16 * face;
  const mawW = 17, mawH = 12;
  g.fillStyle(0x080302);
  g.beginPath();
  g.arc(mawCx, GND - 2, mawW / 2, Math.PI, 0, false);
  g.lineTo(mawCx + mawW / 2, GND - 2);
  g.lineTo(mawCx - mawW / 2, GND - 2);
  g.closePath();
  g.fillPath();
  for (let i = 0; i < 5; i++) {
    const fx = mawCx - mawW / 2 + 2 + i * ((mawW - 4) / 4);
    g.fillStyle(BONE);
    g.fillTriangle(fx - 1.6, GND - mawH, fx + 1.6, GND - mawH, fx, GND - mawH + 5);
  }

  // Crown horns — two asymmetric tusks sweeping up + back, plus a small inner one.
  tusk(g, cx + 4 * face, GND - 40, cx + 16 * face, GND - 60, cx + 30 * face, GND - 66, 5, 1, BONE);
  tusk(g, cx - 6 * face, GND - 42, cx - 12 * face, GND - 66, cx - 14 * face, GND - 80, 5.5, 1, BONE);
  tusk(g, cx - 1 * face, GND - 40, cx + 2 * face, GND - 54, cx + 6 * face, GND - 60, 3, 0.6, BLOOD);

  // Damage — the flesh splits and weeps dark blood; bone shows raw in the cracks.
  if (frac < 0.5) {
    const a = 0.7 * (1 - frac);
    g.fillStyle(DARK, a);
    g.beginPath();
    g.moveTo(cx - 10, GND - 38);
    g.lineTo(cx - 6, GND - 14);
    g.lineTo(cx - 13, GND - 12);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, BONE, a);
    g.beginPath();
    g.moveTo(cx + 10, GND - 40);
    g.lineTo(cx + 6, GND - 26);
    g.lineTo(cx + 13, GND - 18);
    g.strokePath();
  }
};

export default drawAlphaHive;
