import Phaser from 'phaser';
import type { RenderUnit } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike, drawImpactSpark } from '../../units/renderUtils';

/** [dx, dy, ew, eh] — segment center + size as fractions of w/h. */
type Seg = [number, number, number, number];

export interface HerdCfg {
  /** Body segments, back→front; the LAST one is the head (gets the eye). */
  segments: Seg[];
  /** Leg pairs spread along the body. */
  legPairs: number;
  /** Leg attach height (fraction of h). Default 0.6. */
  legY?: number;
  /** Bioluminescent joint glow (T3+). Omit for none. */
  glow?: number;
  /** Signature feature drawn at the head front (horn/tusk/crest).
   *  `bone` = a palette-matched dark chitin color for horns/tusks. */
  signature?: (
    g: Phaser.GameObjects.Graphics, u: RenderUnit,
    hx: number, hy: number, f: number, bone: number,
  ) => void;
}

/**
 * Shared α-Primal herd-beast body — shaded segments (light top-left),
 * legs (walk cycle + lunge brace), eye with glint, the `getStrike`
 * strike lunge (front segments lead, rear drags), optional bioluminescent
 * joint, a per-unit signature feature, and an impact spark on contact.
 * Authored to DRAW_STYLE.md so every α unit clears the art bar.
 */
export function drawHerd(
  g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number, cfg: HerdCfg,
): void {
  const f = u.facing, w = u.w, h = u.h;
  const primary = hexToInt(u.primary), secondary = hexToInt(u.secondary);
  const s = getStrike(u);
  const reach = s.reach * w * 0.30;     // strike lunge magnitude
  const n = cfg.segments.length;

  // Ground shadow.
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, uy + h * 1.03, w * 0.72, h * 0.14);

  // Legs — walk cycle while marching; rear-brace push on the lunge.
  const lp = u.state === 'march' ? u.bob : 0;
  const legY = cfg.legY ?? 0.6;
  g.lineStyle(Math.max(1, w * 0.04), secondary);
  for (let i = 0; i < cfg.legPairs; i++) {
    const t = cfg.legPairs === 1 ? 0.5 : i / (cfg.legPairs - 1);
    const lx = cx + (t - 0.5) * w * 0.5 * f;
    const ly = uy + h * legY;
    const sw = Math.sin(lp + i * 1.1) * w * 0.05;
    const brace = s.lunge * f * w * 0.05;
    g.lineBetween(lx, ly, lx - w * 0.08 - sw - brace, uy + h * 1.0);
    g.lineBetween(lx, ly, lx + w * 0.08 + sw - brace, uy + h * 1.0);
  }

  // Body segments back→front; front segments lead the lunge, rear drags.
  let hx = cx, hy = uy + h * 0.5;
  for (let i = 0; i < n; i++) {
    const [dx, dy, ew, eh] = cfg.segments[i];
    const lean = n === 1 ? 1 : i / (n - 1);
    const sx = cx + f * (dx * w) + f * reach * lean;
    const sy = uy + dy * h + (s.lunge * h * 0.06 - s.coil * h * 0.025) * lean;
    shadedBlob(g, sx, sy, ew * w, eh * h, primary);
    if (i === n - 1) { hx = sx; hy = sy; }
  }

  // Bioluminescent joint glow (between the last two segments).
  if (cfg.glow !== undefined && n >= 2) {
    const prev = cfg.segments[n - 2];
    const gx = (hx + cx + f * prev[0] * w) / 2;
    const gy = hy + h * 0.03;
    g.fillStyle(cfg.glow, 0.12); g.fillCircle(gx, gy, w * 0.17);
    g.fillStyle(cfg.glow, 0.22); g.fillCircle(gx, gy, w * 0.09);
    g.fillStyle(cfg.glow, 0.9);  g.fillCircle(gx, gy, w * 0.035);
  }

  // Eye + glint.
  const ex = hx + f * w * 0.1, ey = hy - h * 0.04;
  g.fillStyle(lerpColor(secondary, 0x000000, 0.35)); g.fillCircle(ex, ey, w * 0.06);
  g.fillStyle(0xffe070); g.fillCircle(ex, ey, w * 0.034);
  g.fillStyle(0xffffff); g.fillCircle(ex - w * 0.013, ey - h * 0.014, w * 0.013);

  // Signature feature (horn/tusk/crest) at the head front.
  cfg.signature?.(g, u, hx, hy, f, lerpColor(secondary, 0x000000, 0.25));

  // Impact spark on contact.
  if (s.impact > 0.01) drawImpactSpark(g, hx + f * w * 0.22, hy, w, s.impact);
}
