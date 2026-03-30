import type { UnitDef, CombatHooks, RenderUnit, IUnit, CombatContext } from '../../types';
import { hexToInt } from '../renderUtils';

export const def: UnitDef = {
  name: 'Bombardier', ico: '\u{1F4A5}', hp: 100, atk: 28, spd: 1.6, range: 22, atkRate: 0.85,
  cost: 60, reward: 28, w: 24, h: 20, col: 0xc03030, dk: 0x6b1a1a,
  trait: 'area', desc: 'Area ATK', tier: 'D', incubation: 5, knockForce: 15,
  caste: 'soldier', geneline: 'alpha',
};

export const combat: CombatHooks = {
  onDeath(u: IUnit, ctx: CombatContext) {
    // Explode on death, hitting up to 5 nearby foes for 65 damage
    const foes = ctx.allAlive.filter(e => e.side !== u.side && !e.dead);
    foes.filter(e =>
      Math.abs((e.x + e.unitW / 2) - (u.x + u.unitW / 2)) < 50 * ctx.S
    ).slice(0, 5).forEach(e => ctx.hitUnit(e, 65, 'aoe'));
    if (ctx.particles) {
      const bx = u.x + u.unitW / 2;
      const by = u.y + u.unitH / 2;
      const pm = ctx.particles as any;
      // Big explosion — fast wide particles + slow lingering embers
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 3 + Math.random() * 5;
        pm.particles.push({
          x: bx, y: by,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
          life: 0.8 + Math.random() * 0.5,
          col: [0xffcc20, 0xff8020, 0xff4010][Math.floor(Math.random() * 3)],
          r: 2.5 + Math.random() * 3,
        });
      }
      // Slow rising embers
      for (let i = 0; i < 12; i++) {
        pm.particles.push({
          x: bx + (Math.random() - 0.5) * 20, y: by,
          vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random() * 2,
          life: 1.0 + Math.random() * 0.6,
          col: 0xffaa30,
          r: 1 + Math.random() * 1.5,
        });
      }
      ctx.particles.float(bx, u.y - 14, 'BOOM!', 0xffcc20, true);
    }
  },
};

export function draw(g: Phaser.GameObjects.Graphics, u: RenderUnit, cx: number, uy: number): void {
  const col = hexToInt(u.col);
  const dk = hexToInt(u.dk);
  const deep = 0x3d0e0e;
  const bone = 0xd4c4b0;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Body tilt — front rises, back dips (head up, fuse-end drags)
  const angle = -f * 0.28;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const pivotX = cx;
  const pivotY = uy + h * 0.55;

  function rot(px: number, py: number): [number, number] {
    const dx = px - pivotX;
    const dy = py - pivotY;
    return [pivotX + dx * cosA - dy * sinA, pivotY + dx * sinA + dy * cosA];
  }

  function fillRotEllipse(ecx: number, ecy: number, ew: number, eh: number): void {
    const steps = 16;
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
  g.fillStyle(dk);
  fillRotEllipse(cx, uy + h * 0.5, w * 0.76, h * 0.72);
  g.fillStyle(col);
  fillRotEllipse(cx, uy + h * 0.46, w * 0.64, h * 0.54);
  // Scutum (dorsal shield plate — darker patch on front-top)
  g.fillStyle(dk, 0.5);
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
  g.fillStyle(dk);
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
}
