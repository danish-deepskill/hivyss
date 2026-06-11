import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike, drawImpactSpark } from '../../units/renderUtils';

// Maggotling — a soft PALE maggot (the palette inverts: maggot-flesh body,
// bog-green pustules). No legs at all — it INCHWORMS, the body squashing and
// stretching as it crawls. Its name-feature: spore pustules along the back
// that visibly swell and vent — they're what bursts when it dies.
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const green = hexToInt(u.primary), flesh = hexToInt(u.secondary);
  const s = getStrike(u);
  const reach = s.reach * w * 0.25;

  // Inchworm locomotion — length oscillates instead of legs swinging.
  const inch = u.state === 'march' ? Math.sin(u.bob * 0.9) : 0;
  const stretch = 1 + inch * 0.12;          // long…short…long
  const hump = Math.max(0, -inch) * h * 0.16; // the body humps when contracted
  const cy = uy + h * 0.62;

  // Ground shadow — full-belly contact (it drags).
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx, uy + h * 1.0, w * 0.7 * stretch, h * 0.13);

  // Soft ringed body — three flesh segments, rear → front, humping mid-crawl.
  shadedBlob(g, cx - f * (w * 0.26 * stretch - reach * 0.2), cy + h * 0.04, w * 0.4, h * 0.42, flesh);
  shadedBlob(g, cx + f * reach * 0.5, cy - hump, w * 0.46, h * 0.48, flesh);
  shadedBlob(g, cx + f * (w * 0.26 * stretch + reach), cy + h * 0.02, w * 0.4, h * 0.44, flesh);
  // Segment creases.
  g.lineStyle(1, lerpColor(flesh, 0x000000, 0.25), 0.6);
  g.lineBetween(cx - f * w * 0.12, cy - h * 0.2 - hump * 0.5, cx - f * w * 0.14, cy + h * 0.22);
  g.lineBetween(cx + f * w * 0.12, cy - h * 0.2 - hump * 0.5, cx + f * w * 0.14, cy + h * 0.22);

  // SPORE PUSTULES — swollen green sacs along the back, breathing. The bomb.
  const swell = 1 + 0.18 * Math.sin(u.bob * 1.6);
  for (let i = 0; i < 3; i++) {
    const px = cx - f * w * (0.22 - i * 0.2);
    const py = cy - h * (0.32 + (i === 1 ? 0.1 : 0.02)) - hump;
    const pr = w * (0.09 + (i === 1 ? 0.035 : 0)) * swell;
    g.fillStyle(green, 0.95);
    g.fillCircle(px, py, pr);
    g.fillStyle(lerpColor(green, 0xffffff, 0.4), 0.8);
    g.fillCircle(px - pr * 0.3, py - pr * 0.35, pr * 0.35);
  }
  // A faint spore haze venting off the pustules.
  g.fillStyle(green, 0.12 + 0.05 * Math.sin(u.bob));
  g.fillCircle(cx - f * w * 0.02, cy - h * 0.55 - hump, w * 0.18);

  // Blind nub face — no eye to speak of, just a puckered feeding ring.
  const hx = cx + f * (w * 0.4 * stretch + reach);
  g.fillStyle(lerpColor(flesh, 0x000000, 0.3));
  g.fillCircle(hx, cy + h * 0.04, w * 0.07);
  const jaw = 0.05 + s.coil * 0.1;
  g.lineStyle(1, lerpColor(flesh, 0x000000, 0.4));
  g.lineBetween(hx, cy + h * (0.04 - jaw), hx + f * w * 0.08, cy + h * 0.04);
  g.lineBetween(hx, cy + h * (0.04 + jaw), hx + f * w * 0.08, cy + h * 0.04);

  if (s.impact > 0.01) drawImpactSpark(g, hx + f * w * 0.1, cy, w, s.impact);
};

export default draw;
