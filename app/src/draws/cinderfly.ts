import type { DrawFunction } from '../types';
import { hexToInt, lerpColor, shadedBlob, getStrike, drawImpactSpark } from '../units/renderUtils';

// Cinderfly — RESKIN from reference (2026-06-11): a horned ember-beetle. A
// tall curved head-CREST, big RED eyes, twin long CURVED TUSKS hooking down-
// forward, a segmented rust CARAPACE with spots, pale-blue WING TIPS peeking
// out the back, and sturdy HOOFED legs in a planted stance. Keeps a cinder-
// ember undertone seeping between the shell plates (the `burn` trait reads).
// Demonstrates the curve tier: the crest + tusks are drawn as tapered
// Phaser.Curves shapes (`taperedCurve`), not ellipse-stacks.

/**
 * A tapered curved limb/horn/tusk: a quadratic-bezier centerline (base →
 * control → tip) fleshed out to a filled polygon whose half-width shrinks
 * from `baseHalf` to `tipHalf`. Bezier sampled by hand (no Phaser runtime
 * dep — only `g.fillPoints` is a Graphics method). The first reusable
 * curve-brush; promote to renderUtils if more units want it.
 */
function taperedCurve(
  g: Phaser.GameObjects.Graphics,
  x0: number, y0: number, xc: number, yc: number, x1: number, y1: number,
  baseHalf: number, tipHalf: number, color: number,
): void {
  const N = 12;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, mt = 1 - t;                          // quadratic bezier sample
    pts.push({ x: mt * mt * x0 + 2 * mt * t * xc + t * t * x1, y: mt * mt * y0 + 2 * mt * t * yc + t * t * y1 });
  }
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const t = i / (pts.length - 1);
    const half = baseHalf * (1 - t) + tipHalf * t;        // taper base→tip
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next.x - prev.x, dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * half, ny = (dx / len) * half; // perpendicular offset
    left.push({ x: pts[i].x + nx, y: pts[i].y + ny });
    right.push({ x: pts[i].x - nx, y: pts[i].y - ny });
  }
  g.fillStyle(color);
  g.fillPoints([...left, ...right.reverse()], true);
}

const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const primary = hexToInt(u.primary), dark = hexToInt(u.secondary);
  const rust = lerpColor(primary, 0x000000, 0.12);     // carapace base
  const shellDark = lerpColor(primary, 0x000000, 0.42); // segment ridges
  const legCol = lerpColor(primary, dark, 0.5);
  const footCol = lerpColor(dark, 0x000000, 0.38);
  const tuskCol = lerpColor(dark, 0x000000, 0.28);
  const hornCol = lerpColor(primary, 0x000000, 0.2);
  const wingBlue = 0xbcdce8;
  const ember = 0xff5512;

  const s = getStrike(u);
  const reach = s.reach * w * 0.26;                     // head/tusks lead the lunge
  const walk = u.state === 'march' ? 1 : 0;
  const breathe = Math.sin(u.bob * 1.2);

  // Ground shadow — broad, planted.
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, uy + h * 1.0, w * 0.84, h * 0.13);

  // A sturdy hoofed leg — femur out, tibia down to a dark hoof.
  const drawLeg = (ox: number, shade: number, phase: number) => {
    const col = lerpColor(legCol, 0x000000, shade);
    const lx = cx + f * w * ox;
    const sw = walk * Math.sin(u.bob * 2 + phase) * w * 0.03;
    const ky = uy + h * 0.72;
    const fx = lx - f * w * 0.03 + sw;
    g.lineStyle(Math.max(1.5, w * 0.06), col);
    g.lineBetween(lx, uy + h * 0.54, lx - f * w * 0.02, ky);   // femur
    g.lineBetween(lx - f * w * 0.02, ky, fx, uy + h * 0.95);   // tibia
    g.fillStyle(footCol);                                       // hoof
    g.fillEllipse(fx, uy + h * 0.97, w * 0.06, h * 0.05);
  };

  // Pale-blue wing tips peeking out the back (behind the shell).
  const wsh = breathe * 0.5;
  g.fillStyle(wingBlue, 0.5);
  g.fillEllipse(cx - f * w * 0.42, uy + h * 0.3 + wsh, w * 0.28, h * 0.16);
  g.fillStyle(wingBlue, 0.32);
  g.fillEllipse(cx - f * w * 0.5, uy + h * 0.38 + wsh, w * 0.22, h * 0.13);
  g.lineStyle(1, lerpColor(wingBlue, 0xffffff, 0.3), 0.6);
  g.strokeEllipse(cx - f * w * 0.42, uy + h * 0.3 + wsh, w * 0.28, h * 0.16);

  // Far legs (dim, behind the body).
  [0.2, -0.02, -0.24].forEach((ox, i) => drawLeg(ox + 0.04, 0.3, i + 0.6));

  // The CARAPACE — big domed rust shell.
  const shX = cx - f * w * 0.06, shY = uy + h * 0.44;
  shadedBlob(g, shX, shY, w * 0.74, h * 0.64, rust);
  // Lower-edge segment ridges.
  g.lineStyle(1, shellDark, 0.7);
  for (let i = 0; i < 3; i++) {
    const yy = shY + h * (0.1 + i * 0.1);
    g.lineBetween(shX - f * w * 0.3, yy, shX + f * w * 0.22, yy + h * 0.03);
  }
  // Lighter shell spots/bumps.
  g.fillStyle(lerpColor(rust, 0xffffff, 0.26), 0.7);
  g.fillCircle(shX - f * w * 0.04, shY - h * 0.16, w * 0.04);
  g.fillCircle(shX + f * w * 0.13, shY - h * 0.05, w * 0.03);
  g.fillCircle(shX - f * w * 0.18, shY - h * 0.0, w * 0.028);
  // Cinder-ember seeping between the plates (the burn undertone).
  const emberA = 0.1 + (u.state === 'attack' ? 0.2 : 0) + breathe * 0.05;
  g.fillStyle(ember, Math.max(0, emberA));
  g.fillCircle(shX - f * w * 0.04, shY + h * 0.16, w * 0.1);

  // Lighter segmented belly.
  g.fillStyle(lerpColor(primary, 0xffffff, 0.16));
  g.fillEllipse(cx + f * w * 0.05, uy + h * 0.66, w * 0.5, h * 0.32);
  g.lineStyle(1, lerpColor(primary, 0x000000, 0.3), 0.5);
  for (let i = 0; i < 3; i++) {
    const bx = cx + f * w * (0.16 - i * 0.14);
    g.lineBetween(bx, uy + h * 0.56, bx - f * w * 0.02, uy + h * 0.78);
  }

  // Near legs (bright, in front).
  [0.18, -0.04, -0.26].forEach((ox, i) => drawLeg(ox, 0, i));

  // HEAD (front, leads the lunge).
  const hx = cx + f * w * 0.34 + reach;
  const hy = uy + h * 0.42 + (s.lunge * h * 0.05 - s.coil * h * 0.03);
  shadedBlob(g, hx, hy, w * 0.32, h * 0.4, primary);
  shadedBlob(g, hx + f * w * 0.02, hy + h * 0.12, w * 0.2, h * 0.2, primary); // lower face

  // The CREST — tall curved horn rising up-forward from the head (curve tier).
  taperedCurve(g,
    hx + f * w * 0.06, hy - h * 0.12,
    hx + f * w * 0.16, hy - h * 0.4,
    hx + f * w * 0.1, hy - h * 0.62,
    w * 0.06, w * 0.012, hornCol);
  g.lineStyle(1, lerpColor(hornCol, 0xffffff, 0.25), 0.5); // crest highlight edge
  g.lineBetween(hx + f * w * 0.04, hy - h * 0.12, hx + f * w * 0.13, hy - h * 0.42);

  // Big RED eyes (the signature).
  const ex = hx + f * w * 0.12, ey = hy - h * 0.02;
  g.fillStyle(0x801008); g.fillCircle(ex, ey, w * 0.11);
  g.fillStyle(0xe0281c); g.fillCircle(ex, ey, w * 0.085);
  g.fillStyle(0xffffff, 0.9); g.fillCircle(ex - f * w * 0.025, ey - h * 0.03, w * 0.026);
  g.fillStyle(lerpColor(0xe0281c, 0x000000, 0.25)); g.fillCircle(hx + f * w * 0.02, ey, w * 0.05); // hint of far eye

  // Twin curved TUSKS hooking down-forward (curve tier); thrust on the strike.
  const tbx = hx + f * w * 0.1, tby = hy + h * 0.16;
  const thrust = s.lunge * w * 0.12;
  taperedCurve(g,
    tbx, tby,
    tbx + f * (w * 0.2 + thrust), tby + h * 0.18,
    tbx + f * (w * 0.22 + thrust), tby + h * 0.46,
    w * 0.042, w * 0.008, tuskCol);
  taperedCurve(g,
    tbx - f * w * 0.02, tby + h * 0.05,
    tbx + f * (w * 0.13 + thrust), tby + h * 0.24,
    tbx + f * (w * 0.16 + thrust), tby + h * 0.5,
    w * 0.034, w * 0.006, lerpColor(tuskCol, 0x000000, 0.15));

  // Attack ember flash at the maw + impact spark.
  if (u.state === 'attack' || s.impact > 0.01) {
    const mx = tbx + f * w * 0.12, my = tby + h * 0.12;
    const a = s.impact > 0.01 ? s.impact : 0.5;
    g.fillStyle(0xffcc30, 0.55 * a); g.fillCircle(mx, my, w * 0.08);
    g.fillStyle(ember, 0.45 * a); g.fillCircle(mx + f * w * 0.05, my, w * 0.06);
  }
  if (s.impact > 0.01) drawImpactSpark(g, hx + f * w * 0.3, hy + h * 0.16, w, s.impact);
};

export default draw;
