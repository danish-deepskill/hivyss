import type { DrawFunction } from '../../types';
import { hexToInt, lerpColor, shadedBlob, getStrike } from '../../units/renderUtils';

// Thornback — γ's spite-wall: a low armoured body ringed with a crown of hard
// spines. It barely attacks; the danger is striking it (it returns the blow).
// The spines lengthen and glint as it is worn — the reflect, worn on the body.
const draw: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const shell = hexToInt(u.primary), dark = hexToInt(u.secondary);
  const s = getStrike(u);
  const cy = uy + h * 0.6;
  const wear = 1 - u.hp / u.maxHp;

  // Ground shadow.
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, uy + h * 1.02, w * 0.74, h * 0.13);

  // Braced legs.
  g.lineStyle(1.4, dark, 1);
  for (let i = -1; i <= 1; i++) {
    const lx = cx + i * w * 0.24;
    g.lineBetween(lx, cy + h * 0.18, lx, uy + h);
  }

  // THE SPINE CROWN — a ring of hard thorns fanning around the shell (drawn
  // behind the body). They lengthen and glint as the wall is worn down.
  const spineCol = lerpColor(dark, 0xc8a85a, 0.15 + 0.4 * wear);
  g.lineStyle(2, spineCol, 0.95);
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI * 0.96 + (i / 8) * Math.PI * 0.92;
    const bx = cx + Math.cos(a) * w * 0.42;
    const by = cy - h * 0.06 + Math.sin(a) * h * 0.5;
    const len = w * (0.16 + (i % 2) * 0.07) * (1 + wear * 0.3);
    g.lineBetween(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len);
  }

  // Body — a low armoured dome.
  shadedBlob(g, cx, cy, w * 0.78, h * 0.72, shell);
  g.lineStyle(1.2, lerpColor(shell, dark, 0.5), 0.7);
  g.lineBetween(cx - w * 0.3, cy - h * 0.04, cx + w * 0.3, cy - h * 0.04);

  // Small head + eye.
  const hx = cx + f * (w * 0.34 + s.reach * w * 0.14);
  shadedBlob(g, hx, cy + h * 0.12, w * 0.22, h * 0.24, dark);
  g.fillStyle(0xffe070); g.fillCircle(hx + f * w * 0.04, cy + h * 0.08, w * 0.035);

  // Strike — a brief spite-glow when it bites back.
  if (s.coil > 0.1) {
    g.fillStyle(0xfff0b0, 0.22 * s.coil);
    g.fillEllipse(cx, cy, w * 0.7, h * 0.6);
  }
};

export default draw;
