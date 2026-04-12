import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Mendwing — winged healer with prominent flapping wings + healing aura
const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = 0x40082a;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Soft healing aura behind body
  const auraPulse = 0.15 + Math.sin(u.bob * 2) * 0.08;
  g.fillStyle(0xff80e0, auraPulse);
  g.fillCircle(cx, uy + h * 0.5, w * 0.65);

  // Large feathered wings (behind body) — flap on bob cycle
  const flap = Math.sin(u.bob * 5) * 0.3;
  // Upper wing pair
  g.fillStyle(0xffffff, 0.5);
  g.fillEllipse(cx - f * w * 0.22, uy + h * 0.3 - flap * 4, w * 0.38, h * 0.55 + flap * 4);
  g.fillEllipse(cx + f * w * 0.05, uy + h * 0.28 - flap * 4, w * 0.38, h * 0.55 + flap * 4);
  // Wing veins
  g.lineStyle(0.5, secondary, 0.4);
  g.lineBetween(cx - f * w * 0.22, uy + h * 0.45 - flap * 2, cx - f * w * 0.36, uy + h * 0.1 - flap * 4);
  g.lineBetween(cx + f * w * 0.05, uy + h * 0.45 - flap * 2, cx + f * w * 0.18, uy + h * 0.1 - flap * 4);
  // Wing edges (pink tint)
  g.lineStyle(1, 0xff80c0, 0.5);
  g.strokeEllipse(cx - f * w * 0.22, uy + h * 0.3 - flap * 4, w * 0.38, h * 0.55 + flap * 4);
  g.strokeEllipse(cx + f * w * 0.05, uy + h * 0.28 - flap * 4, w * 0.38, h * 0.55 + flap * 4);

  // Body — 3-tone, plump rounded
  g.fillStyle(deep);
  g.fillEllipse(cx - f * w * 0.05, uy + h * 0.66, w * 0.6, h * 0.7);
  g.fillStyle(secondary);
  g.fillEllipse(cx - f * w * 0.05, uy + h * 0.64, w * 0.54, h * 0.62);
  g.fillStyle(primary);
  g.fillEllipse(cx - f * w * 0.05, uy + h * 0.6, w * 0.46, h * 0.5);

  // Head
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.26, uy + h * 0.48, w * 0.36, h * 0.4);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.26, uy + h * 0.46, w * 0.32, h * 0.34);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.26, uy + h * 0.43, w * 0.26, h * 0.26);

  // Gentle eyes
  g.fillStyle(0xffffff);
  g.fillCircle(cx + f * w * 0.34, uy + h * 0.42, 1.5);

  // White healing cross on body
  g.fillStyle(0xffffff, 0.85);
  g.fillRect(cx - f * w * 0.1 - 1, uy + h * 0.55 - 4, 2, 9);
  g.fillRect(cx - f * w * 0.1 - 4, uy + h * 0.55 - 1, 9, 2);

  // Heal pulse particles when actively healing (state==attack covers active hooks indirectly via bob)
  const sp1x = cx + Math.sin(u.bob * 1.5) * 8;
  const sp1y = uy + h * 0.3 + Math.cos(u.bob * 1.2) * 4;
  g.fillStyle(0x60f880, 0.6);
  g.fillCircle(sp1x, sp1y, 1.2);
  g.fillStyle(0xa0ffc0, 0.5);
  const sp2x = cx + Math.cos(u.bob * 2) * 7;
  const sp2y = uy + h * 0.2 + Math.sin(u.bob * 1.8) * 3;
  g.fillCircle(sp2x, sp2y, 0.9);

  // Short legs (2 pairs, hidden under body)
  g.lineStyle(1, deep);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 2; l++) {
    const lx = cx + (l - 0.5) * w * 0.3;
    const ly = uy + h * 0.78;
    const sw = Math.sin(lp + l * 1.3) * 2;
    g.lineBetween(lx, ly, lx + sw, uy + h);
  }
};

export default draw;
