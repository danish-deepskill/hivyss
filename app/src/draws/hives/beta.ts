import type { HiveDrawFunction } from '../../types';
import { PALETTES } from '../../config/Palettes';

// β Swarm — the BROOD-NEST. Not a hard shell: a swollen, sagging mound of
// bog-green lobes, studded with translucent egg-sacs glowing with latent
// larvae (the "many" gestating), venting spore-mist from spiracle chimneys,
// and pouring the tide out of a wet birthing-orifice. The ground around it is
// part of the nest — a fetid puddle (the Fetid Pool motif; the HEALTHY version
// of Beth's septic twin). Name-true to the roster (Broodmother/Broodlord/the
// egg motif). Color-locked to the β palette.

const P = PALETTES.beta;
const GREEN = P.primary;    // bog-green flesh
const FLESH = P.secondary;  // pale maggot-flesh — egg-sacs
const VIOLET = P.accent;    // bruised violet — the rot in the creases
const BOG = P.shadow;       // deep bog shadow — underbelly + recesses

// A translucent egg-sac bulging from the surface: bog-shadow socket, pale
// membrane, an inner larva-glow that intensifies as the nest is healthy.
function eggSac(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, glow: number): void {
  g.fillStyle(BOG, 0.6);
  g.fillEllipse(x, y + r * 0.3, r * 2.1, r * 2.4); // socket shadow
  g.fillStyle(FLESH, 0.85);
  g.fillEllipse(x, y, r * 1.8, r * 2.2);            // membrane
  g.fillStyle(0xe8f0a0, 0.35 + 0.35 * glow);
  g.fillEllipse(x - r * 0.25, y - r * 0.2, r * 0.9, r * 1.2); // larva glow
  g.fillStyle(VIOLET, 0.4);
  g.fillCircle(x + r * 0.3, y + r * 0.5, r * 0.4);  // a bruise of rot
};

const drawBetaHive: HiveDrawFunction = (g, s) => {
  const { side, frac, bw, groundY: GND } = s;
  const cx = bw / 2;
  const face = side === 'player' ? 1 : -1; // the birthing orifice faces the field
  const glow = Math.max(0, frac);          // sacs dim as the nest is wounded

  // Fetid puddle — the wet ground that is part of the nest. Violet-green,
  // wider than the body, with a darker core.
  g.fillStyle(VIOLET, 0.3);
  g.fillEllipse(cx, GND + 4, bw * 1.12, 18);
  g.fillStyle(BOG, 0.5);
  g.fillEllipse(cx, GND + 3, bw * 0.86, 12);

  // Swollen lobed mound — three overlapping bog-green sacs, bog-shadow under-
  // belly first. Soft, bulbous, sagging — never a clean dome.
  g.fillStyle(BOG);
  g.fillEllipse(cx, GND - 6, bw * 0.92, 44);
  const lobes = [
    { x: cx - bw * 0.22, y: GND - 22, w: bw * 0.5, h: 46 },
    { x: cx + bw * 0.2, y: GND - 18, w: bw * 0.52, h: 40 },
    { x: cx - bw * 0.02, y: GND - 34, w: bw * 0.58, h: 54 }, // tallest, central
  ];
  lobes.forEach(l => {
    g.fillStyle(BOG);
    g.fillEllipse(l.x + 2, l.y + 3, l.w, l.h);
    g.fillStyle(GREEN);
    g.fillEllipse(l.x, l.y, l.w, l.h);
  });
  // violet rot pooling in the creases between lobes
  g.fillStyle(VIOLET, 0.45);
  g.fillEllipse(cx - bw * 0.1, GND - 14, 10, 16);
  g.fillEllipse(cx + bw * 0.1, GND - 12, 9, 14);

  // Egg-sac clusters bulging from the lobes — the gestating swarm.
  eggSac(g, cx - bw * 0.2, GND - 28, 6, glow);
  eggSac(g, cx + bw * 0.16, GND - 24, 5.5, glow);
  eggSac(g, cx + bw * 0.02, GND - 44, 7, glow); // crown sac, near-bursting
  eggSac(g, cx - bw * 0.28, GND - 14, 4.5, glow);
  eggSac(g, cx + bw * 0.3, GND - 12, 4, glow);

  // Spiracle vent-chimneys — a cluster of short tubes up top venting spore-mist
  // (the β crown; replaces the dome's antenna spire).
  for (let i = 0; i < 3; i++) {
    const vx = cx + (i - 1) * 7;
    const vh = 12 - Math.abs(i - 1) * 3;
    g.fillStyle(BOG);
    g.fillRect(vx - 2, GND - 52 - vh, 4, vh);
    g.fillStyle(GREEN);
    g.fillRect(vx - 1.4, GND - 52 - vh, 2.8, vh);
    g.fillStyle(0xb0c060, 0.25 * glow); // mist
    g.fillCircle(vx, GND - 54 - vh, 3.5);
  }

  // The wet birthing-orifice — a soft iris facing the field, dripping ichor.
  const ox = cx + bw * 0.18 * face;
  g.fillStyle(VIOLET, 0.85);
  g.fillEllipse(ox, GND - 8, 18, 16);
  g.fillStyle(0x0a1206);
  g.fillEllipse(ox, GND - 8, 11, 11); // the dark passage
  g.fillStyle(FLESH, 0.5);
  g.fillEllipse(ox, GND - 11, 13, 5); // upper lip highlight

  // Drips — rot-strings hanging off the lower lobes (the nest weeps).
  g.fillStyle(VIOLET, 0.6);
  const drips = [cx - bw * 0.3, cx + bw * 0.05, cx + bw * 0.34];
  drips.forEach((dx, i) => {
    const dl = 6 + (i % 2) * 5;
    g.fillRect(dx - 1, GND - 6, 2, dl);
    g.fillCircle(dx, GND - 6 + dl, 1.8);
  });

  // Damage — sacs rupture and the violet rot wells up through the green.
  if (frac < 0.5) {
    const a = 0.7 * (1 - frac);
    g.fillStyle(VIOLET, a);
    g.fillEllipse(cx - 8, GND - 26, 12, 14);
    g.fillStyle(0x6a8020, a * 0.8); // weeping pus
    g.fillCircle(cx - 8, GND - 20, 3);
    g.fillCircle(cx + 10, GND - 16, 2.5);
  }
};

export default drawBetaHive;
