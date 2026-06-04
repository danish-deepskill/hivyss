// Shared battlefield background — the 2.5D BIOME cross-section (sky/backdrop →
// surface → underground tunnel galleries). Used by BOTH the sandbox and the real
// battle (WorldScene) so they share one landscape instead of diverging. Returns
// every created GameObject so the caller can track/destroy them on a redraw
// (the sandbox switches biomes live; WorldScene draws once).
//
// Geometry is config-fixed (lanes via getGroundY, height via H); only the
// horizontal extent (worldW) varies per battle. Depths: the main bg sits at
// -100 (behind bases/units), the South-tunnel overlay at 60.5 and the dirt veil
// at 62 so they bury the tunnel-lane units.

import Phaser from 'phaser';
import { getGroundY } from '../config/RouteMatrix';
import { H } from '../config/Constants';
import { lerpColor } from '../units/renderUtils';

export type BiomeKey = 'wild' | 'sunCarapace';

export function drawBiomeBackground(
  scene: Phaser.Scene,
  biomeKey: BiomeKey,
  worldW: number,
): Phaser.GameObjects.GameObject[] {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const ww = worldW;
  const bg = scene.add.graphics();
  bg.setDepth(-100);
  objs.push(bg);

  const lS = getGroundY('land', 1);
  const tN = getGroundY('tunnel', 0), tS = getGroundY('tunnel', 1);
  const grassTop = Math.round(getGroundY('land', 0)); // grass tip = North land's feet
  const dirtTop = Math.round(lS + 8);                  // underground begins just below the surface

  if (biomeKey === 'sunCarapace') drawCarapaceSurface(bg, ww, grassTop, dirtTop);
  else drawWildSurface(bg, ww, grassTop, dirtTop);

  objs.push(...drawUnderground(scene, bg, biomeKey, ww, dirtTop, tN, tS));
  return objs;
}

// ---- WILD biome (Normal / neutral) — untamed woodland: misty forest sky,
// layered tree silhouettes, green grass surface. ----
function drawWildSurface(bg: Phaser.GameObjects.Graphics, ww: number, grassTop: number, dirtTop: number): void {
  const steps = 14, stepH = Math.ceil(grassTop / steps);
  for (let i = 0; i < steps; i++) {
    bg.fillStyle(lerpColor(0x162a28, 0x40604a, i / (steps - 1)));
    bg.fillRect(0, i * stepH, ww, stepH + 1);
  }
  bg.fillStyle(0x294a38, 0.7);                                 // far misty hills
  for (let x = -40; x < ww; x += 220) bg.fillEllipse(x, grassTop, 320, 150);
  bg.fillStyle(0x305238, 0.8);
  for (let x = 80; x < ww; x += 260) bg.fillEllipse(x, grassTop + 6, 280, 120);
  const tree = (cx: number, h: number, w: number, trunk: number, leaf: number): void => {
    bg.fillStyle(trunk); bg.fillRect(cx - w * 0.12, grassTop - h * 0.55, w * 0.24, h * 0.55);
    bg.fillStyle(leaf);
    bg.fillEllipse(cx, grassTop - h * 0.72, w, h * 0.5);
    bg.fillEllipse(cx - w * 0.5, grassTop - h * 0.55, w * 0.7, h * 0.38);
    bg.fillEllipse(cx + w * 0.5, grassTop - h * 0.55, w * 0.7, h * 0.38);
    bg.fillEllipse(cx, grassTop - h * 0.5, w * 0.9, h * 0.4);
  };
  for (let i = 0; i < 26; i++) tree((i * 197 + 30) % ww, 120 + (i * 31) % 70, 70 + (i % 3) * 16, 0x223a28, 0x315a3a);
  for (let i = 0; i < 18; i++) tree((i * 233 + 110) % ww, 150 + (i * 41) % 90, 90 + (i % 3) * 22, 0x2a4630, 0x3e6e44);
  bg.fillStyle(0x46763a);                                     // grass fill (harmonised with the trees)
  bg.fillRect(0, grassTop, ww, dirtTop - grassTop + 6);
  bg.fillStyle(0x5e9048);                                     // sunlit grass top
  for (let x = 0; x < ww; x += 4) bg.fillRect(x, grassTop - ((x * 7) % 4), 4, 6 + ((x * 7) % 4));
  bg.fillStyle(0x508040);                                     // tufts
  for (let i = 0; i < 90; i++) {
    const gx = (i * 67) % ww, th = 6 + (i % 4) * 4;
    bg.fillRect(gx, grassTop - th, 2, th);
    bg.fillRect(gx + 3, grassTop - Math.round(th * 0.7), 2, Math.round(th * 0.7));
    bg.fillRect(gx - 3, grassTop - Math.round(th * 0.6), 2, Math.round(th * 0.6));
  }
}

// ---- SUN CARAPACE biome (α Primal) — open sunlit chitin plain: warm golden
// sky + a sun, distant low ridges (NO trees — open for the herd to mass),
// amber exoskeleton surface with segmented plate-seams. ----
function drawCarapaceSurface(bg: Phaser.GameObjects.Graphics, ww: number, grassTop: number, dirtTop: number): void {
  const steps = 14, stepH = Math.ceil(grassTop / steps);
  for (let i = 0; i < steps; i++) {
    bg.fillStyle(lerpColor(0x6a8290, 0xe8c474, i / (steps - 1)));   // warm sky → golden heat horizon
    bg.fillRect(0, i * stepH, ww, stepH + 1);
  }
  bg.fillStyle(0xfff0c8, 0.16); bg.fillCircle(ww * 0.3, grassTop * 0.42, 60);   // sun halo
  bg.fillStyle(0xfff4d4, 0.55); bg.fillCircle(ww * 0.3, grassTop * 0.42, 34);   // sun disc
  bg.fillStyle(0x9c7438, 0.45);                                 // distant low chitin ridges (open)
  for (let x = -30; x < ww; x += 210) bg.fillEllipse(x, grassTop + 6, 280, 64);
  bg.fillStyle(0xb0863e, 0.55);
  for (let x = 110; x < ww; x += 250) bg.fillEllipse(x, grassTop + 10, 230, 50);
  bg.fillStyle(0xcaa86a);                                       // sandstone surface (sun-baked, sandy)
  bg.fillRect(0, grassTop, ww, dirtTop - grassTop + 6);
  bg.fillStyle(0xe4c888);                                       // sunlit sand top edge
  bg.fillRect(0, grassTop, ww, 4);
  bg.fillStyle(0xb88c52, 0.5);                                  // horizontal sandstone striations (sedimentary layers)
  for (let y = grassTop + 8; y < dirtTop; y += 6) {
    for (let x = 0; x < ww; x += 18) bg.fillRect(x + ((y * 5) % 10), y, 14, 2);
  }
  bg.fillStyle(0x8a6638, 0.4);                                  // sparse vertical cracks (carapace-shell hint)
  for (let x = 0; x < ww; x += 96) bg.fillRect(x + ((x * 7) % 18), grassTop + 4, 2, dirtTop - grassTop - 6);
  bg.fillStyle(0x7c7a38);                                       // sparse dry tufts in the seams
  for (let i = 0; i < 46; i++) {
    const gx = (i * 97) % ww, th = 4 + (i % 3) * 3;
    bg.fillRect(gx, grassTop - th, 2, th);
    bg.fillRect(gx + 3, grassTop - Math.round(th * 0.6), 2, Math.round(th * 0.6));
  }
}

// ---- Underground (shared across biomes) — ant-nest galleries. North unit sits
// BEHIND the South tunnel's opacity (sGal@60.5); both buried by tVeil@62. Soil
// is warmed slightly for Sun Carapace. Returns the extra overlay graphics. ----
function drawUnderground(
  scene: Phaser.Scene,
  bg: Phaser.GameObjects.Graphics,
  biomeKey: BiomeKey,
  ww: number,
  dirtTop: number,
  tN: number,
  tS: number,
): Phaser.GameObjects.GameObject[] {
  const dirtH = H - dirtTop, ds = Math.max(1, Math.ceil(dirtH / 4));
  // Per-biome underground palette. Wild = dark, loamy forest soil (fades to
  // near-black). Sun Carapace = warm, lighter SANDSTONE strata (drier desert
  // subsoil — stays warm rather than going black).
  const sand = biomeKey === 'sunCarapace';
  const pal = sand
    ? { top: 0xba9c5c, bot: 0x46331a, speck: 0x3a2812, crack: 0x4a3620, tunN: 0x5e4626, tunS: 0x301f0e, veil: 0x3a2812, veilSpeck: 0x241808 }
    : { top: 0x7a5029, bot: 0x1a1107, speck: 0x2c1c0e, crack: 0x201305, tunN: 0x4a3620, tunS: 0x1c1308, veil: 0x281a0c, veilSpeck: 0x140d06 };

  for (let i = 0; i < ds; i++) {                        // soil body → deep earth
    bg.fillStyle(lerpColor(pal.top, pal.bot, Math.min(1, (i / Math.max(1, ds - 1)) * 1.3)));
    bg.fillRect(0, dirtTop + Math.floor((i * dirtH) / ds), ww, Math.ceil(dirtH / ds) + 1);
  }
  // Sandstone biomes get horizontal sedimentary striations (vs loamy specks).
  if (sand) {
    bg.fillStyle(0x8a6630, 0.3);
    for (let y = dirtTop + 6; y < H; y += 14) for (let x = 0; x < ww; x += 22) bg.fillRect(x + ((y * 5) % 12), y, 16, 2);
  }
  bg.fillStyle(pal.speck, 0.4);                         // grain speckle
  for (let i = 0; i < 200; i++) bg.fillRect((i * 89) % ww, dirtTop + 4 + (i * 47) % Math.max(1, dirtH - 8), 2, 2);
  bg.lineStyle(2, pal.crack, 0.4);                      // branching cracks
  for (let i = 0; i < 20; i++) {
    let cx = (i * 211) % ww, cy = dirtTop + 16 + (i * 53) % Math.max(1, dirtH - 48);
    bg.beginPath(); bg.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) { cx += ((i + s) % 5) * 6 - 12; cy += 8 + (s % 3) * 4; bg.lineTo(cx, cy); }
    bg.strokePath();
  }
  const galleryH = 38;
  const galTop = (y: number): number => Math.round(y - 12 - galleryH / 2);
  bg.fillStyle(pal.tunN, 1);                            // North tunnel — solid, behind the North unit
  bg.fillRect(0, galTop(tN), ww, galleryH);
  const sGal = scene.add.graphics();                    // South tunnel — over the North unit (60.5)
  sGal.setDepth(60.5);
  sGal.fillStyle(pal.tunS, 0.55);
  sGal.fillRect(0, galTop(tS), ww, galleryH);
  const tVeil = scene.add.graphics();                   // dirt veil over both tunnel units (62)
  tVeil.setDepth(62);
  tVeil.fillStyle(pal.veil, 0.5);
  tVeil.fillRect(0, dirtTop, ww, H - dirtTop);
  tVeil.fillStyle(pal.veilSpeck, 0.35);
  for (let i = 0; i < 180; i++) tVeil.fillRect((i * 83) % ww, dirtTop + 2 + (i * 59) % Math.max(1, H - dirtTop - 6), 3, 2);
  return [sGal, tVeil];
}
