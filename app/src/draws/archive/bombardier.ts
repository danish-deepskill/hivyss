import Phaser from 'phaser';
import type { DrawFunction, RenderUnit } from '../../types';
import { hexToInt, makeRot, fillRotEllipse as fillRotEllipseShared } from '../../units/renderUtils';

const draw: DrawFunction = (g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = u.palette!.shadow;
  const bone = u.palette!.accent;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Body tilt — front rises, back dips (head up, fuse-end drags)
  const rot = makeRot(cx, uy + h * 0.55, -f * 0.28);
  const fillRotEllipse = (ecx: number, ecy: number, ew: number, eh: number) =>
    fillRotEllipseShared(g, rot, ecx, ecy, ew, eh);

  // --- Legs (2 pairs, attached to front body, short wide splay) ---
  const lp = u.state === 'march' ? u.bob : 0;
  g.lineStyle(w * 0.04, deep);
  const groundY = uy + h + h * 0.03;
  const legAttachX = [f * w * 0.14, f * w * 0.28];
  const legAttachY = [h * 0.54, h * 0.46];
  for (let l = 0; l < 2; l++) {
    const [lx, ly] = rot(cx + legAttachX[l], uy + legAttachY[l]);
    const sw = Math.sin(lp + l * 1.2) * w * 0.05;
    g.lineBetween(lx, ly, lx - w * 0.2 - sw, groundY);
    g.lineBetween(lx, ly, lx + w * 0.2 + sw, groundY);
  }

  // --- Body (one big round blob — tick has no waist/segments) ---
  g.fillStyle(deep);
  fillRotEllipse(cx, uy + h * 0.52, w * 0.82, h * 0.78);
  g.fillStyle(secondary);
  fillRotEllipse(cx, uy + h * 0.5, w * 0.76, h * 0.72);
  g.fillStyle(primary);
  fillRotEllipse(cx, uy + h * 0.46, w * 0.64, h * 0.54);
  // Scutum (dorsal shield plate — darker patch on front-top)
  g.fillStyle(secondary, 0.5);
  fillRotEllipse(cx + f * w * 0.08, uy + h * 0.32, w * 0.3, h * 0.22);

  // --- Fuse (wick sticking out of the back) ---
  const [fuseBaseX, fuseBaseY] = rot(cx - f * w * 0.36, uy + h * 0.38);
  const [fuseTipX, fuseTipY] = rot(cx - f * w * 0.48, uy + h * 0.18);
  g.lineStyle(w * 0.03, bone);
  g.lineBetween(fuseBaseX, fuseBaseY, fuseTipX, fuseTipY);
  // Spark
  const sparkAlpha = 0.5 + Math.sin(u.bob * 4) * 0.4;
  g.fillStyle(0xffcc20, sparkAlpha);
  g.fillCircle(fuseTipX, fuseTipY, w * 0.05);
  g.fillStyle(0xff4020, sparkAlpha * 0.7);
  g.fillCircle(fuseTipX, fuseTipY, w * 0.025);

  // --- Head (tiny, tucked into front of body — tick capitulum) ---
  g.fillStyle(deep);
  fillRotEllipse(cx + f * w * 0.36, uy + h * 0.46, w * 0.18, h * 0.22);
  g.fillStyle(secondary);
  fillRotEllipse(cx + f * w * 0.36, uy + h * 0.44, w * 0.14, h * 0.18);

  // --- Eye (solid compound eye) ---
  const [ex, ey] = rot(cx + f * w * 0.38, uy + h * 0.42);
  g.fillStyle(0xffffff);
  g.fillCircle(ex, ey, w * 0.035);

  // --- Mouthparts (short, straight — tick chelicerae) ---
  const [mx, my] = rot(cx + f * w * 0.42, uy + h * 0.46);
  const [mtx, mty] = rot(cx + f * w * 0.52, uy + h * 0.46);
  const [mtxA, mtyA] = rot(cx + f * w * 0.58, uy + h * 0.46);
  if (u.state === 'attack') {
    g.lineStyle(w * 0.06, deep);
    g.lineBetween(mx, my, mtxA, mtyA);
    g.lineStyle(w * 0.035, bone);
    g.lineBetween(mx, my, mtxA, mtyA);
    // Explosion flash
    g.fillStyle(0xffcc20, 0.7);
    g.fillCircle(mtxA + f * w * 0.04, mtyA, w * 0.08);
    g.fillStyle(0xff6020, 0.5);
    g.fillCircle(mtxA + f * w * 0.04, mtyA, w * 0.04);
  } else {
    g.lineStyle(w * 0.06, deep);
    g.lineBetween(mx, my, mtx, mty);
    g.lineStyle(w * 0.035, bone);
    g.lineBetween(mx, my, mtx, mty);
  }
};

export default draw;
