import type { DrawFunction } from '../types';
import { hexToInt } from '../units/renderUtils';

// Domeback — armored beetle with prominent domed shell, plate divisions
const draw: DrawFunction = (g, u, cx, uy) => {
  const primary = hexToInt(u.primary);
  const secondary = hexToInt(u.secondary);
  const deep = 0x18200a;
  const f = u.facing;
  const w = u.w;
  const h = u.h;

  // Body shadow
  g.fillStyle(0x000000, 0.32);
  g.fillEllipse(cx, uy + h * 0.96, w * 0.86, h * 0.14);

  // Underbody (visible from sides, darker)
  g.fillStyle(deep);
  g.fillEllipse(cx, uy + h * 0.72, w * 0.78, h * 0.5);

  // BIG DOMED SHELL — the signature feature (3-tone)
  g.fillStyle(deep);
  g.fillEllipse(cx, uy + h * 0.44, w * 0.94, h * 0.78);
  g.fillStyle(secondary);
  g.fillEllipse(cx, uy + h * 0.42, w * 0.88, h * 0.7);
  g.fillStyle(primary);
  g.fillEllipse(cx, uy + h * 0.38, w * 0.78, h * 0.58);

  // Shell ridge (highlight along the dome center)
  g.lineStyle(2, deep, 0.7);
  g.beginPath();
  g.moveTo(cx - w * 0.38, uy + h * 0.42);
  g.lineTo(cx + w * 0.38, uy + h * 0.42);
  g.strokePath();

  // Shell plate divisions (vertical lines on the dome)
  g.lineStyle(1, deep, 0.55);
  for (let i = -1; i <= 1; i++) {
    const px = cx + i * w * 0.22;
    g.lineBetween(px, uy + h * 0.18, px, uy + h * 0.62);
  }
  // Inner highlight on plates
  g.lineStyle(0.5, primary, 0.4);
  for (let i = -1; i <= 1; i++) {
    const px = cx + i * w * 0.22 + 0.5;
    g.lineBetween(px, uy + h * 0.2, px, uy + h * 0.6);
  }

  // Head poking out the front (3-tone)
  g.fillStyle(deep);
  g.fillEllipse(cx + f * w * 0.44, uy + h * 0.56, w * 0.3, h * 0.38);
  g.fillStyle(secondary);
  g.fillEllipse(cx + f * w * 0.44, uy + h * 0.54, w * 0.26, h * 0.32);
  g.fillStyle(primary);
  g.fillEllipse(cx + f * w * 0.44, uy + h * 0.51, w * 0.2, h * 0.24);

  // Eye on head
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(cx + f * w * 0.5, uy + h * 0.52, 1.8);
  g.fillStyle(0x000000);
  g.fillCircle(cx + f * w * 0.51, uy + h * 0.52, 1);

  // Heavy mandibles
  g.lineStyle(2, deep);
  const mhx = cx + f * w * 0.55;
  const mhy = uy + h * 0.58;
  if (u.state === 'attack') {
    g.lineBetween(mhx, mhy - 4, mhx + f * 6, mhy - 6);
    g.lineBetween(mhx, mhy + 4, mhx + f * 6, mhy + 6);
  } else {
    g.lineBetween(mhx, mhy - 3, mhx + f * 4, mhy - 4);
    g.lineBetween(mhx, mhy + 3, mhx + f * 4, mhy + 4);
  }

  // Stubby antennae
  g.lineStyle(1, deep);
  const ax = cx + f * w * 0.42;
  const ay = uy + h * 0.42;
  const wave = Math.sin(u.bob) * 1.5;
  g.lineBetween(ax, ay, ax + f * 5 + wave, ay - 5);
  g.lineBetween(ax, ay, ax + f * 3 - wave, ay - 6);

  // Six thick legs poking out from under shell
  g.lineStyle(2, deep);
  const lp = u.state === 'march' ? u.bob : 0;
  for (let l = 0; l < 3; l++) {
    const lx = cx + (l - 1) * w * 0.24;
    const ly = uy + h * 0.78;
    const sw = Math.sin(lp + l * 1.1) * 3;
    g.lineBetween(lx, ly, lx + f * 6 + sw, ly + 6);
    g.lineBetween(lx, ly, lx - f * 6 - sw, ly + 6);
  }
};

export default draw;
