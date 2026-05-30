// Shared rendering utilities for bug drawing functions
import type { RenderUnit } from '../types';

/* ── Color utilities ─────────────────────────────────── */

export function hexToInt(hex: number | string): number {
  return typeof hex === 'number' ? hex : parseInt((hex as string).replace('#', ''), 16);
}

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const rr = (ar + t * (br - ar)) | 0;
  const rg = (ag + t * (bg - ag)) | 0;
  const rb = (ab + t * (bb - ab)) | 0;
  return (rr << 16) | (rg << 8) | rb;
}


/* ── Attack swing animation ──────────────────────────── */

/**
 * Visual easing of a unit's attack swing. Consumes the simulation's
 * normalized progress signal (`u.windup` / `u.recover` — see
 * `Unit.swingProgress`) and shapes it into render-ready values. This
 * helper owns ONLY the look (the easing curves); the sim owns the timing.
 *
 * - `coil`   0 (relaxed) → 1 (fully wound back), during wind-up.
 * - `lunge`  1 (peak forward thrust at impact) → 0 (recovered), during recovery.
 * - `reach`  signed body offset: −0.45·coil while winding up, +lunge while striking.
 * - `impact` sharp 1→0 spike at the contact frame (for hit flashes/sparks).
 *
 * Only one of coil/lunge is ever non-zero, so a draw can blend them freely.
 */
export interface Strike {
  coil: number;
  lunge: number;
  reach: number;
  impact: number;
}

export function getStrike(u: RenderUnit): Strike {
  // Recovery — the strike + follow-through (fires the moment damage lands).
  if (u.recover > 0) {
    const lunge = u.recover * u.recover;       // fast snap-out, eased settle
    return { coil: 0, lunge, reach: lunge, impact: u.recover * u.recover * u.recover };
  }
  // Wind-up.
  if (u.windup > 0) {
    const coil = u.windup * u.windup;          // accelerating coil
    return { coil, lunge: 0, reach: -0.45 * coil, impact: 0 };
  }
  return { coil: 0, lunge: 0, reach: 0, impact: 0 };
}

/* ── Rotation helpers (for tilted body poses) ────────── */

export type RotFn = (px: number, py: number) => [number, number];

/** Create a rotation function around a pivot point. */
export function makeRot(pivotX: number, pivotY: number, angle: number): RotFn {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  return (px, py) => {
    const dx = px - pivotX;
    const dy = py - pivotY;
    return [pivotX + dx * cosA - dy * sinA, pivotY + dx * sinA + dy * cosA];
  };
}

/** Draw a filled ellipse rotated via a rotation function. */
export function fillRotEllipse(
  g: Phaser.GameObjects.Graphics,
  rot: RotFn,
  ecx: number, ecy: number, ew: number, eh: number,
  steps = 16,
): void {
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const px = ecx + Math.cos(t) * ew * 0.5;
    const py = ecy + Math.sin(t) * eh * 0.5;
    const [rx, ry] = rot(px, py);
    if (i === 0) g.moveTo(rx, ry);
    else g.lineTo(rx, ry);
  }
  g.closePath();
  g.fillPath();
}

/* ── Generic draw helpers (starter units) ────────────── */

// Draw common bug parts: mandibles, antennae, legs (original style — used by starter units)
export function drawCommonParts(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const secondary = hexToInt(u.secondary);

  // Mandibles
  g.lineStyle(1.5, secondary);
  const mhx = cx + u.facing * (u.w * 0.42);
  const mhy = uy + u.h * 0.15;
  if (u.state === 'attack') {
    g.lineBetween(mhx, mhy, mhx + u.facing * 5, mhy - 5);
    g.lineBetween(mhx, mhy, mhx + u.facing * 5, mhy + 4);
  } else {
    g.lineBetween(mhx, mhy, mhx + u.facing * 4, mhy - 2);
    g.lineBetween(mhx, mhy, mhx + u.facing * 4, mhy + 2);
  }

  // Antennae
  g.lineStyle(1, secondary);
  const ax = cx + u.facing * u.w * 0.25;
  const ay = uy + u.h * 0.1;
  const wave = Math.sin(u.bob) * 3;
  g.lineBetween(ax, ay, ax + u.facing * 8 + wave, ay - 7);
  g.lineBetween(ax, ay, ax + u.facing * 3 - wave, ay - 7);

  // Legs
  g.lineStyle(1, secondary);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 3; l++) {
    const lx = cx + (l - 1) * u.w * 0.2;
    const ly = uy + u.h * 0.55;
    const sw = Math.sin(lp + l * 1.1) * 5;
    g.lineBetween(lx, ly, lx + u.facing * 6 + sw, ly + 8);
    g.lineBetween(lx, ly, lx - u.facing * 6 - sw, ly + 8);
  }
}

// Fallback draw for unmapped traits
export function drawBasicBody(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const primary = hexToInt(u.primary);
  g.fillStyle(primary);
  g.fillEllipse(cx - u.facing * 2, uy + u.h * 0.62, u.w * 0.74, u.h * 0.84);
  g.fillEllipse(cx + u.facing * 1, uy + u.h * 0.34, u.w * 0.54, u.h * 0.54);
  g.fillEllipse(cx + u.facing * u.w * 0.28, uy + u.h * 0.18, u.w * 0.42, u.h * 0.38);
  drawCommonParts(g, u, cx, uy);
}
