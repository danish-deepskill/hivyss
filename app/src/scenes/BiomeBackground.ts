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

export type BiomeKey = 'wild' | 'sunCarapace' | 'fetidPool';

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

  if (biomeKey === 'fetidPool') {
    // β's biome paints its own world end-to-end (incl. the flooded warrens).
    drawFetidSurface(bg, ww, grassTop, dirtTop);
    objs.push(...drawFetidUnderground(scene, bg, ww, dirtTop, tN, tS));
    return objs;
  }

  if (biomeKey === 'sunCarapace') drawCarapaceSurface(bg, ww, grassTop, dirtTop);
  else drawWildSurface(bg, ww, grassTop, dirtTop);

  objs.push(...drawUnderground(scene, bg, biomeKey, ww, dirtTop, tN, tS));
  return objs;
}

// ---- FETID POOL biome (β Swarm) — the rotting breeding-pool. The land IS a
// womb: a low miasma sky with a smothered sun, colossal dead bone-stalks
// draped in moss, glowing egg-clutches at the waterline (the same egg/embryo
// motif the β rosters carry — field and creatures read as ONE ecosystem), a
// half-sunken colossal ribcage, and a peat causeway broken by stagnant pools.
// Enclosed + humid + fecund — the opposite of α's open sunlit plain. ----
function drawFetidSurface(bg: Phaser.GameObjects.Graphics, ww: number, grassTop: number, dirtTop: number): void {
  // — Sky: heavy green-grey overcast pressing DOWN (densest at the horizon).
  const steps = 16, stepH = Math.ceil(grassTop / steps);
  for (let i = 0; i < steps; i++) {
    bg.fillStyle(lerpColor(0x39432e, 0x222d1c, i / (steps - 1)));
    bg.fillRect(0, i * stepH, ww, stepH + 1);
  }
  // The smothered sun — a pale smear behind the haze, never a disc.
  bg.fillStyle(0xd8dca8, 0.05); bg.fillEllipse(ww * 0.62, grassTop * 0.3, 220, 90);
  bg.fillStyle(0xe8e8c0, 0.08); bg.fillEllipse(ww * 0.62, grassTop * 0.3, 130, 54);
  bg.fillStyle(0xf0eecd, 0.1);  bg.fillEllipse(ww * 0.62, grassTop * 0.3, 64, 30);

  // — Miasma banks: long horizontal fog shelves, brighter putrid green low.
  for (let i = 0; i < 9; i++) {
    const fy = grassTop * (0.45 + 0.065 * i);
    bg.fillStyle(lerpColor(0x55613a, 0x86a832, i / 8), 0.05 + i * 0.012);
    for (let x = -120 + ((i * 173) % 240); x < ww + 120; x += 380) {
      bg.fillEllipse(x + ((i * 97) % 160), fy, 420, 26 + i * 3);
    }
  }

  // — Colossal DEAD BONE-STALKS: leafless trees of pale chitin rising out of
  // the fog, gnarled, with drooping moss veils and egg-pods hung like fruit.
  // Far rank = hazy + light; near rank = darker, harder.
  const stalk = (cx: number, sh: number, lean: number, col: number, alpha: number, moss: boolean): void => {
    const baseY = grassTop + 4;
    const topX = cx + lean * sh;
    bg.lineStyle(7, col, alpha);
    bg.lineBetween(cx, baseY, cx + lean * sh * 0.45, baseY - sh * 0.5);
    bg.lineStyle(5, col, alpha);
    bg.lineBetween(cx + lean * sh * 0.45, baseY - sh * 0.5, topX, baseY - sh);
    // Broken-finger branches.
    bg.lineStyle(3, col, alpha);
    const bx = cx + lean * sh * 0.5, by = baseY - sh * 0.55;
    bg.lineBetween(bx, by, bx - sh * 0.22, by - sh * 0.2);
    bg.lineBetween(topX, baseY - sh, topX + sh * 0.16, baseY - sh * 0.86);
    bg.lineBetween(topX, baseY - sh, topX - sh * 0.12, baseY - sh * 1.04);
    if (moss) {
      // Hanging moss veils — limp drapes off the branch tips.
      bg.lineStyle(1.5, 0x5e7038, alpha * 0.9);
      for (let m = 0; m < 3; m++) {
        const mx = bx - sh * 0.22 + m * 6;
        bg.lineBetween(mx, by - sh * 0.2 + m * 2, mx + 2, by - sh * 0.2 + sh * (0.16 + (m % 2) * 0.06));
      }
      // An egg-pod hung like fruit.
      bg.fillStyle(0xdcd8ac, alpha * 0.7);
      bg.fillCircle(topX + sh * 0.16, baseY - sh * 0.84, 5);
      bg.fillStyle(0xd8e860, alpha * 0.5);
      bg.fillCircle(topX + sh * 0.16, baseY - sh * 0.84, 2.4);
    }
  };
  for (let i = 0; i < 7; i++) {  // far rank — ghosts in the haze
    stalk((i * 419 + 140) % ww, 120 + (i * 37) % 60, (i % 2 ? 0.16 : -0.12), 0x6a7452, 0.35, false);
  }
  for (let i = 0; i < 5; i++) {  // near rank — hard silhouettes
    stalk((i * 587 + 320) % ww, 170 + (i * 53) % 80, (i % 2 ? -0.2 : 0.14), 0x3c4628, 0.85, true);
  }

  // — The COLOSSAL RIBCAGE: something vast died in this pool long ago; the
  // swarm has been breeding in it ever since. Bone arcs breaking the mist.
  const rcx = ww * 0.34, rcy = grassTop + 2;
  for (let r = 0; r < 5; r++) {
    bg.lineStyle(4 - r * 0.4, 0xc9c49a, 0.55 - r * 0.06);
    const rr = 58 - r * 9;
    bg.beginPath();
    bg.arc(rcx + r * 26, rcy, rr, Math.PI * 1.05, Math.PI * 1.78);
    bg.strokePath();
  }

  // — EGG CLUTCHES at the waterline: pale translucent orbs in mounds, each
  // with a faint embryo fleck — the map's signature, rhyming with the
  // Broodlord/Broodmother sacs.
  const clutch = (cx: number, cy: number, big: number): void => {
    bg.fillStyle(0xd8e860, 0.1);
    bg.fillCircle(cx, cy - big * 0.3, big * 2.4); // bio-glow pooled around the clutch
    const eggs: Array<[number, number, number]> = [
      [-big * 0.7, 0, big * 0.7], [big * 0.6, big * 0.1, big * 0.62], [0, -big * 0.55, big * 0.8], [big * 1.3, big * 0.18, big * 0.45],
    ];
    for (const [ox, oy, r] of eggs) {
      bg.fillStyle(0xd4d0a4, 0.85);
      bg.fillCircle(cx + ox, cy + oy, r);
      bg.fillStyle(0xeeeccd, 0.6);
      bg.fillCircle(cx + ox - r * 0.3, cy + oy - r * 0.35, r * 0.35);
      bg.fillStyle(0x5a6e28, 0.5); // the embryo fleck
      bg.fillCircle(cx + ox + r * 0.15, cy + oy + r * 0.15, r * 0.22);
    }
  };
  for (let i = 0; i < 6; i++) {
    clutch((i * 449 + 230) % ww, grassTop - 3, 5 + (i % 3) * 2);
  }

  // — The bog causeway (the walkable band): black peat, wet.
  bg.fillStyle(0x33401e);
  bg.fillRect(0, grassTop, ww, dirtTop - grassTop + 6);
  bg.fillStyle(0x46562a); // a thin wet sheen along the top edge
  bg.fillRect(0, grassTop, ww, 3);

  // — Standing POOLS: flat murky water with sky-glints, scum rims, bubbles.
  for (let i = 0; i < 8; i++) {
    const px = (i * 359 + 90) % ww;
    const py = grassTop + (dirtTop - grassTop) * (0.45 + (i % 3) * 0.14);
    const pw = 90 + (i * 61) % 110, ph = 9 + (i % 3) * 3;
    bg.fillStyle(0x4d5e30, 0.95);
    bg.fillEllipse(px, py, pw, ph);
    bg.fillStyle(0x6c7e46, 0.8);              // sky reflection band
    bg.fillEllipse(px - pw * 0.12, py - ph * 0.12, pw * 0.55, ph * 0.4);
    bg.fillStyle(0xdcd8ac, 0.25);             // pale glint
    bg.fillEllipse(px + pw * 0.2, py, pw * 0.2, ph * 0.2);
    bg.lineStyle(1, 0x86a832, 0.35);          // scum rim
    bg.strokeEllipse(px, py, pw, ph);
    // Bubbles rising at the edge.
    bg.lineStyle(1, 0xc9d47c, 0.5);
    bg.strokeCircle(px - pw * 0.28, py - 3 - (i % 3), 1.6);
    bg.strokeCircle(px - pw * 0.2, py - 6 - (i % 2) * 2, 1);
  }

  // — Reeds: drooping clusters with cattail heads, leaning over the pools.
  for (let i = 0; i < 34; i++) {
    const rx = (i * 151 + 40) % ww;
    const rh = 10 + (i % 4) * 5;
    const leanR = ((i % 5) - 2) * 0.18;
    bg.lineStyle(1.4, 0x556830, 0.95);
    bg.lineBetween(rx, grassTop + 2, rx + leanR * rh, grassTop - rh);
    bg.lineBetween(rx + 3, grassTop + 2, rx + 3 + leanR * rh * 0.7, grassTop - rh * 0.66);
    if (i % 3 === 0) { // cattail head
      bg.fillStyle(0x6a5a30, 0.95);
      bg.fillEllipse(rx + leanR * rh, grassTop - rh - 2, 3, 7);
    }
  }

  // — Drifting spore-motes in the air band — the haze is ALIVE.
  for (let i = 0; i < 26; i++) {
    const mx = (i * 197 + 60) % ww;
    const my = grassTop * (0.3 + ((i * 71) % 60) / 100);
    bg.fillStyle(0xd8e860, 0.1);
    bg.fillCircle(mx, my, 2.6);
    bg.fillStyle(0xe8f080, 0.22);
    bg.fillCircle(mx, my, 1);
  }
}

// ---- FETID POOL underground — waterlogged peat warrens: a saturated black
// soil column with a glistening water table, root tendrils reaching down,
// buried bones, and FLOODED tunnel galleries (each holds standing water).
// Keeps the functional overlays (S-gallery @60.5, veil @62) that bury the
// tunnel-lane units. ----
function drawFetidUnderground(
  scene: Phaser.Scene,
  bg: Phaser.GameObjects.Graphics,
  ww: number,
  dirtTop: number,
  tN: number,
  tS: number,
): Phaser.GameObjects.GameObject[] {
  const dirtH = H - dirtTop, ds = Math.max(1, Math.ceil(dirtH / 4));
  // Peat column — wet black-green, not brown.
  for (let i = 0; i < ds; i++) {
    bg.fillStyle(lerpColor(0x2c3416, 0x0c1006, Math.min(1, (i / Math.max(1, ds - 1)) * 1.25)));
    bg.fillRect(0, dirtTop + Math.floor((i * dirtH) / ds), ww, Math.ceil(dirtH / ds) + 1);
  }
  // The WATER TABLE — seep lines glistening through the peat.
  for (let i = 0; i < 7; i++) {
    const wy = dirtTop + 10 + i * Math.max(8, Math.floor(dirtH / 8));
    bg.lineStyle(1, 0x5a7038, 0.22 + (i % 2) * 0.08);
    for (let x = ((i * 127) % 60) - 30; x < ww; x += 90) {
      bg.lineBetween(x, wy, x + 46, wy + 1);
    }
  }
  // Root tendrils reaching down from the bog above.
  bg.lineStyle(1.4, 0x3c4a20, 0.6);
  for (let i = 0; i < 16; i++) {
    let rx = (i * 311 + 70) % ww, ry = dirtTop;
    bg.beginPath(); bg.moveTo(rx, ry);
    for (let s2 = 0; s2 < 4; s2++) { rx += ((i + s2) % 5) * 5 - 10; ry += 9 + (s2 % 3) * 5; bg.lineTo(rx, ry); }
    bg.strokePath();
  }
  // Buried bones — pale arcs swallowed by the peat.
  for (let i = 0; i < 6; i++) {
    const bx2 = (i * 433 + 180) % ww;
    const by2 = dirtTop + 18 + (i * 67) % Math.max(1, dirtH - 40);
    bg.lineStyle(2.5, 0x9a9678, 0.3);
    bg.beginPath();
    bg.arc(bx2, by2, 9 + (i % 3) * 4, Math.PI * (0.1 + (i % 2) * 0.5), Math.PI * (0.85 + (i % 2) * 0.5));
    bg.strokePath();
  }

  // FLOODED galleries — each warren holds standing water (dark gloss bottom,
  // a pale waterline). North gallery solid behind its unit; South overlays.
  const galleryH = 38;
  const galTop = (y: number): number => Math.round(y - 12 - galleryH / 2);
  const flooded = (g: Phaser.GameObjects.Graphics, y: number, alpha: number): void => {
    const top = galTop(y);
    g.fillStyle(0x1a2410, alpha);                          // air pocket
    g.fillRect(0, top, ww, galleryH * 0.55);
    g.fillStyle(0x141e0c, alpha);                          // standing water
    g.fillRect(0, top + galleryH * 0.55, ww, galleryH * 0.45);
    g.lineStyle(1, 0x6c8040, alpha * 0.7);                 // the waterline
    g.lineBetween(0, top + galleryH * 0.55, ww, top + galleryH * 0.55);
  };
  flooded(bg, tN, 1);
  const sGal = scene.add.graphics();                       // South gallery — over the North unit
  sGal.setDepth(60.5);
  flooded(sGal, tS, 0.55);
  const tVeil = scene.add.graphics();                      // peat veil over both tunnel units
  tVeil.setDepth(62);
  tVeil.fillStyle(0x1c2410, 0.5);
  tVeil.fillRect(0, dirtTop, ww, H - dirtTop);
  tVeil.fillStyle(0x0e1408, 0.35);
  for (let i = 0; i < 180; i++) tVeil.fillRect((i * 83) % ww, dirtTop + 2 + (i * 59) % Math.max(1, H - dirtTop - 6), 3, 2);
  return [sGal, tVeil];
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
