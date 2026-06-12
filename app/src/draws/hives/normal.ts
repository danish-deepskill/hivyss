import type { HiveDrawFunction } from '../../types';

// The untagged wax dome — the baseline hive + the registry's fallback for any
// geneline without a bespoke body. Layered organic honeycomb: base mound,
// inner dome, waxy ridges, glowing cells, an entrance tunnel facing the field,
// a crown spire, and damage ooze. Side only TINTS it (cool/player vs warm/
// enemy); the silhouette is identical both sides — the "normal" read.

function hexagon(g: Phaser.GameObjects.Graphics, hx: number, hy: number, r: number): void {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = hx + r * Math.cos(a);
    const py = hy + r * Math.sin(a);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

const drawNormalHive: HiveDrawFunction = (g, s) => {
  const isBlue = s.side === 'player';
  const { frac, bw, groundY: GND } = s;
  const cx = bw / 2;

  // Base mound (wider, sits on the ground)
  g.fillStyle(isBlue ? 0x2a1e08 : 0x3a1008);
  g.beginPath();
  g.moveTo(0, GND + 2);
  g.lineTo(2, GND - 50);
  g.arc(cx, GND - 50, bw / 2 - 2, Math.PI, 0, false);
  g.lineTo(bw, GND + 2);
  g.closePath();
  g.fillPath();

  // Inner dome (taller, narrower)
  g.fillStyle(isBlue ? 0x3a2c10 : 0x4a1810);
  g.beginPath();
  g.moveTo(6, GND - 4);
  g.arc(cx, GND - 24, bw / 2 - 6, Math.PI * 0.85, Math.PI * 0.15, false);
  g.lineTo(bw - 8, GND + 2);
  g.lineTo(8, GND + 2);
  g.closePath();
  g.fillPath();

  // Waxy ridges (horizontal bands)
  g.lineStyle(1.5, isBlue ? 0x4a3c18 : 0x5a2818, 0.5);
  for (let i = 0; i < 4; i++) {
    const ry = GND - 20 - i * 16;
    const spread = (bw * 0.44) * (1 - i * 0.15);
    g.beginPath();
    g.moveTo(cx - spread, ry);
    g.lineTo(cx - spread * 0.3, ry - 3);
    g.lineTo(cx + spread * 0.3, ry - 3);
    g.lineTo(cx + spread, ry);
    g.strokePath();
  }

  // Honeycomb cells — amber when healthy, red when wounded
  const cells = [
    { x: cx - 12, y: GND - 60 },
    { x: cx + 8, y: GND - 62 },
    { x: cx - 2, y: GND - 48 },
    { x: cx - 16, y: GND - 42 },
    { x: cx + 14, y: GND - 44 },
    { x: cx + 2, y: GND - 72 },
  ];
  const cellR = 7;
  cells.forEach(c => {
    const cellColor = frac > 0.4 ? (isBlue ? 0xc89020 : 0xa06818) : 0xff3232;
    const cellAlpha = frac > 0.4 ? 0.35 : 0.45;
    g.fillStyle(cellColor, cellAlpha);
    hexagon(g, c.x, c.y, cellR);
    g.fillPath();
    g.lineStyle(0.8, isBlue ? 0x5a4820 : 0x6a3020, 0.4);
    hexagon(g, c.x, c.y, cellR);
    g.strokePath();
  });

  // Entrance tunnel (facing the battlefield)
  const tunnelW = 14;
  const tx = isBlue ? bw - tunnelW - 2 : 2;
  g.fillStyle(0x0a0806);
  g.beginPath();
  g.arc(tx + tunnelW / 2, GND - 4, tunnelW / 2, Math.PI, 0, false);
  g.fillPath();
  g.lineStyle(2, isBlue ? 0x4a3c18 : 0x5a2818, 0.7);
  g.beginPath();
  g.arc(tx + tunnelW / 2, GND - 4, tunnelW / 2 + 1, Math.PI, 0, false);
  g.strokePath();

  // Damage — oozing resin + cracked cells
  if (frac < 0.5) {
    const dmgAlpha = 0.6 * (1 - frac);
    g.fillStyle(0x806020, dmgAlpha);
    g.beginPath();
    g.moveTo(cx - 8, GND - 55);
    g.lineTo(cx - 6, GND - 35);
    g.lineTo(cx - 10, GND - 30);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(cx + 12, GND - 50);
    g.lineTo(cx + 14, GND - 28);
    g.lineTo(cx + 10, GND - 25);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0x000000, dmgAlpha);
    g.beginPath();
    g.moveTo(cx - 14, GND - 58);
    g.lineTo(cx - 8, GND - 48);
    g.lineTo(cx - 16, GND - 38);
    g.strokePath();
  }

  // Crown spire (organic antenna/spike)
  g.fillStyle(isBlue ? 0x4a3c18 : 0x5a2818);
  g.beginPath();
  g.moveTo(cx - 3, GND - 86);
  g.lineTo(cx - 1, GND - 104);
  g.lineTo(cx + 1, GND - 104);
  g.lineTo(cx + 3, GND - 86);
  g.closePath();
  g.fillPath();
  g.fillStyle(isBlue ? 0x70d8ff : 0xff8060, 0.6);
  g.fillCircle(cx, GND - 104, 3);
};

export default drawNormalHive;
