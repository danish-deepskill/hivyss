import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike, drawImpactSpark } from '../../units/renderUtils';

// α ROYAL — the Matriarch, redesigned as a true QUEEN (not a scaled Goliath).
// Distinct silhouette, not distinct size:
//   - a vast BANDED egg-gaster dragging low at the REAR (physogastric queen
//     mass — every other herd unit carries its mass forward/level),
//   - a small RAISED fore-body (saddle → thorax → head held high — regal
//     posture vs the herd's battering ram-line),
//   - an upright jewel-tipped CORONET (a crown, not Goliath's combat horns),
//   - shimmering VESTIGIAL WINGS on the thorax (no other vyssid has wings),
//   - brood-light seeping between the gaster bands + pale eggs at the tip —
//     she is the source of the herd.
// Same art language as _herd (shadedBlob shading, walk-cycle legs, getStrike
// lunge with the fore-body leading, eye glint, impact spark) so she still
// reads as α — just unmistakably the queen of it.
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const primary = hexToInt(u.primary), secondary = hexToInt(u.secondary);
  const bone = lerpColor(secondary, 0x000000, 0.25);
  const band = lerpColor(primary, 0x000000, 0.38);
  const s = getStrike(u);
  const reach = s.reach * w * 0.26; // strike lunge — fore-body leads, gaster drags

  // Ground shadow — broad (she's the widest body in the roster).
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, uy + h * 1.03, w * 0.9, h * 0.15);

  // Legs — three sturdy pairs tucked under the body (queen legs read small
  // against the gaster; a LOW attach keeps her grounded, not on stilts).
  // Walk cycle while marching; rear-brace on the lunge.
  const lp = u.state === 'march' ? u.bob : 0;
  g.lineStyle(Math.max(1, w * 0.05), lerpColor(secondary, 0x000000, 0.18));
  for (let i = 0; i < 3; i++) {
    // Spread sits under the saddle + gaster-front — the only mass that's low
    // enough to own legs; further forward the raised fore-body has lifted away.
    const lx = cx + f * (w * (0.15 - i * 0.16) + reach * 0.5);
    const ly = uy + h * 0.72;
    const sw = Math.sin(lp + i * 1.1) * w * 0.05;
    const brace = s.lunge * f * w * 0.05;
    g.lineBetween(lx, ly, lx - w * 0.08 - sw - brace, uy + h);
    g.lineBetween(lx, ly, lx + w * 0.08 + sw - brace, uy + h);
  }

  // === The GASTER — the queen's defining mass: huge, low, banded, egg-laden.
  const gx = cx - f * (w * 0.18 - reach * 0.15);
  const gy = uy + h * 0.60;
  shadedBlob(g, gx - f * w * 0.40, gy + h * 0.03, w * 0.24, h * 0.36, primary); // tapering tip
  shadedBlob(g, gx, gy, w * 0.76, h * 0.60, primary);
  // Stretch-bands (physogastric segmentation) across the swollen abdomen.
  g.fillStyle(band, 0.4);
  for (let i = 0; i < 3; i++) {
    const bx = gx - f * w * (0.07 + i * 0.13);
    g.fillEllipse(bx, gy + h * 0.02, w * 0.045, h * (0.5 - i * 0.09));
  }
  // Brood-light — a warm pulse seeping between the bands (life inside).
  const pulse = 0.15 + 0.06 * Math.sin(u.bob * 0.8);
  g.fillStyle(0xffd860, pulse);
  for (let i = 0; i < 3; i++) {
    g.fillCircle(gx - f * w * (0.005 + i * 0.13), gy + h * 0.12, w * 0.05);
  }
  // Eggs at the tip — pale, small, the next brood.
  g.fillStyle(lerpColor(secondary, 0xffffff, 0.25), 0.85);
  g.fillCircle(gx - f * w * 0.51, gy + h * 0.10, w * 0.034);
  g.fillCircle(gx - f * w * 0.44, gy + h * 0.17, w * 0.027);

  // === The raised fore-body — saddle → thorax → head held HIGH.
  shadedBlob(g, cx + f * (w * 0.10 + reach * 0.6), uy + h * 0.46, w * 0.30, h * 0.30, primary);
  const tx = cx + f * (w * 0.24 + reach * 0.8);
  const ty = uy + h * 0.34 + (s.lunge * h * 0.05 - s.coil * h * 0.03);
  shadedBlob(g, tx, ty, w * 0.26, h * 0.26, primary);

  // Vestigial wings — RESTING queen wings: two soft translucent membrane
  // panels folded back from the thorax, lying along the gaster's top (rounded
  // ellipses, not spikes). They read against the red body as pale glass; a
  // single glint line suggests the leading edge. Shimmer with the bob. The
  // queen's mark; no other vyssid has them.
  const wa = 0.24 + 0.06 * Math.sin(u.bob * 1.3);
  g.fillStyle(0xfff0d8, wa * 0.65); // far wing — higher, shorter
  g.fillEllipse(tx - f * w * 0.24, ty - h * 0.05, w * 0.40, h * 0.11);
  g.fillStyle(0xfff0d8, wa);        // near wing — longer, overlapping
  g.fillEllipse(tx - f * w * 0.30, ty + h * 0.01, w * 0.50, h * 0.13);
  g.lineStyle(1, 0xffffff, wa * 0.8);
  g.lineBetween(tx - f * w * 0.07, ty - h * 0.045, tx - f * w * 0.52, ty + h * 0.02);

  // Head — small, high, regal.
  const hx = cx + f * (w * 0.38 + reach);
  const hy = uy + h * 0.22 + (s.lunge * h * 0.07 - s.coil * h * 0.04);
  shadedBlob(g, hx, hy, w * 0.20, h * 0.20, primary);

  // Eye + glint (the herd language, slightly grander).
  const ex = hx + f * w * 0.055, ey = hy - h * 0.02;
  g.fillStyle(lerpColor(secondary, 0x000000, 0.35)); g.fillCircle(ex, ey, w * 0.052);
  g.fillStyle(0xffe070); g.fillCircle(ex, ey, w * 0.03);
  g.fillStyle(0xffffff); g.fillCircle(ex - w * 0.011, ey - h * 0.012, w * 0.012);

  // Mandibles — part on the windup, snap shut on the lunge (her attack read;
  // she carries no battering horns).
  const jaw = 0.08 + s.coil * 0.12 - s.lunge * 0.06;
  g.lineStyle(Math.max(1, w * 0.035), bone);
  g.lineBetween(hx + f * w * 0.08, hy + h * 0.02, hx + f * w * 0.21, hy + h * (0.02 - jaw));
  g.lineBetween(hx + f * w * 0.08, hy + h * 0.05, hx + f * w * 0.21, hy + h * (0.05 + jaw));

  // === The CORONET — a solid CIRCLET banding the head, with three short
  // jewel-tipped tines rising from it. Dense regalia (not spindly antenna
  // prongs), vertical and symmetric where Goliath's horns rake forward.
  g.fillStyle(bone);
  g.fillEllipse(hx, hy - h * 0.085, w * 0.17, h * 0.055); // the circlet band
  g.lineStyle(w * 0.045, bone);
  g.lineBetween(hx, hy - h * 0.09, hx, hy - h * 0.24);                              // center tine
  g.lineBetween(hx - f * w * 0.065, hy - h * 0.08, hx - f * w * 0.09, hy - h * 0.19); // rear tine
  g.lineBetween(hx + f * w * 0.065, hy - h * 0.08, hx + f * w * 0.09, hy - h * 0.19); // fore tine
  g.fillStyle(0xffd860, 0.95);
  g.fillCircle(hx, hy - h * 0.26, w * 0.03);
  g.fillStyle(0xffd860, 0.85);
  g.fillCircle(hx - f * w * 0.09, hy - h * 0.21, w * 0.022);
  g.fillCircle(hx + f * w * 0.09, hy - h * 0.21, w * 0.022);

  // Impact spark on contact.
  if (s.impact > 0.01) drawImpactSpark(g, hx + f * w * 0.24, hy + h * 0.05, w, s.impact);
};

export default draw;
