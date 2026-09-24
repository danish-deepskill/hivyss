import type { UnitDef, UnitModule, DrawFunction } from '../types';
import { hexToInt } from './renderUtils';

// TERRAFORM line — the universal engineers that drive the Terrain Engine. Not a
// geneline's combatants (geneline 'normal', like the worker caste) but real
// units: they march, fight weakly, and SHAPE the field.
//   - Wallwright  (Shaper)   → lays a chitin WALL where deployed (blocks the lane).
//   - Acidwell    (Shaper)   → lays an acid FLOOD where deployed (slows + DoTs).
//   - Sparkcaller (Catalyst) → applies NERVE to each cell it enters (electrifies
//                              any flood it walks into = a route kill).
// See app/docs (Terrain Engine) + config/TerrainDefs.ts for the data tables.

// --- Wallwright -------------------------------------------------------------
const wallwrightDef: UnitDef = {
  name: 'Wallwright',
  ico: '\u{1F9F1}', // brick
  hp: 130,
  atk: 8,
  spd: 0.8,
  range: 18,
  atkRate: 0.6,
  cost: 60,
  cap: 2,
  reward: 20,
  w: 18,
  h: 16,
  primary: 0x8a7a52,   // chitin tan
  secondary: 0x4a3d24, // mud-brown shade
  trait: 'wallwright',
  role: 'tank',
  desc: 'Raises Walls',
  route: 'land',
  attackRange: 'melee',
  tier: 2,
  incubation: 3,
  geneline: 'normal',
  defaultAbility: 'jaw_strike',
  element: 'chitin',
  terrainAbility: { element: 'chitin', trigger: 'onReach' }, // raises the wall when it reaches the front
};

const drawWallwright: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const primary = hexToInt(u.primary);
  const dark = hexToInt(u.secondary);
  const cy = uy + h / 2 + Math.sin(u.bob) * 0.5; // a heavy, slow plod

  // Ground shadow.
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(cx, uy + h * 1.04, w * 0.74, h * 0.15);

  // Stout legs.
  g.lineStyle(2, dark, 1);
  for (let i = -1; i <= 1; i++) {
    const lx = cx + i * w * 0.2;
    g.lineBetween(lx, cy + h * 0.18, lx - f * w * 0.1, cy + h * 0.5);
  }

  // Abdomen (rear) · thorax · head.
  g.fillStyle(dark, 1);
  g.fillEllipse(cx - f * w * 0.22, cy + h * 0.04, w * 0.46, h * 0.52);
  g.fillStyle(primary, 1);
  g.fillEllipse(cx + f * w * 0.06, cy - h * 0.02, w * 0.4, h * 0.5);
  g.fillStyle(dark, 1);
  g.fillEllipse(cx + f * w * 0.34, cy - h * 0.02, w * 0.24, h * 0.34);

  // Signature — a stacked plate "wall" carried on the back (the mason's load).
  g.fillStyle(primary, 1);
  g.lineStyle(1.2, dark, 1);
  for (let r = 0; r < 2; r++) {
    const by = cy - h * (0.34 + r * 0.26);
    g.fillStyle(r === 0 ? primary : 0xb6a06a, 1);
    g.fillRect(cx - f * w * 0.34 - w * 0.18, by, w * 0.36, h * 0.2);
    g.strokeRect(cx - f * w * 0.34 - w * 0.18, by, w * 0.36, h * 0.2);
  }

  // Broad mandible "trowel".
  g.lineStyle(2.2, primary, 1);
  g.lineBetween(cx + f * w * 0.42, cy + h * 0.06, cx + f * w * 0.6, cy + h * 0.16);

  // Eye glint.
  g.fillStyle(0xffe0a0, 0.9);
  g.fillCircle(cx + f * w * 0.36, cy - h * 0.06, w * 0.05);
};

// --- Acidwell ---------------------------------------------------------------
const acidwellDef: UnitDef = {
  name: 'Acidwell',
  ico: '\u{1F9EA}', // test tube
  hp: 75,
  atk: 6,
  spd: 0.9,
  range: 18,
  atkRate: 0.6,
  cost: 55,
  cap: 2,
  reward: 18,
  w: 16,
  h: 15,
  primary: 0x6fae3a,   // acid green
  secondary: 0x274d12, // deep moss
  trait: 'acidwell',
  role: 'support',
  desc: 'Floods Acid',
  route: 'land',
  attackRange: 'melee',
  tier: 2,
  incubation: 3,
  geneline: 'normal',
  defaultAbility: 'jaw_strike',
  element: 'acid',
  terrainAbility: { element: 'acid', trigger: 'onReach' }, // floods the contact line on first engage
  resistance: { toxic: 'strongest' }, // immune-ish to its own brew
};

const drawAcidwell: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const primary = hexToInt(u.primary);
  const dark = hexToInt(u.secondary);
  const cy = uy + h / 2 + Math.sin(u.bob * 1.2) * 0.6;
  const pulse = 0.5 + 0.5 * Math.sin(u.bob * 2.4); // the sac churns

  // Ground shadow.
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx, uy + h * 1.02, w * 0.62, h * 0.13);

  // Legs.
  g.lineStyle(1.4, dark, 1);
  for (let i = -1; i <= 1; i++) {
    const lx = cx + i * w * 0.16;
    g.lineBetween(lx, cy + h * 0.12, lx - f * w * 0.16, cy + h * 0.46);
  }

  // Translucent acid sac (rear abdomen) — bright, glowing, dripping.
  g.fillStyle(0xb6f04a, 0.35 + 0.25 * pulse);
  g.fillEllipse(cx - f * w * 0.26, cy, w * 0.5, h * 0.56);
  g.fillStyle(primary, 0.9);
  g.fillEllipse(cx - f * w * 0.24, cy + h * 0.02, w * 0.4, h * 0.46);

  // Thorax · head.
  g.fillStyle(dark, 1);
  g.fillEllipse(cx + f * w * 0.08, cy - h * 0.02, w * 0.3, h * 0.42);
  g.fillStyle(primary, 1);
  g.fillEllipse(cx + f * w * 0.32, cy - h * 0.02, w * 0.22, h * 0.32);

  // Spout + a falling acid droplet.
  g.lineStyle(2, 0xb6f04a, 0.9);
  g.lineBetween(cx + f * w * 0.42, cy + h * 0.02, cx + f * w * 0.56, cy + h * 0.14);
  g.fillStyle(0xb6f04a, 0.5 + 0.4 * pulse);
  g.fillCircle(cx + f * w * 0.58, cy + h * (0.2 + pulse * 0.18), w * 0.07);

  // Eye glint.
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(cx + f * w * 0.34, cy - h * 0.06, w * 0.05);
};

// --- Sparkcaller ------------------------------------------------------------
const sparkcallerDef: UnitDef = {
  name: 'Sparkcaller',
  ico: '\u{26A1}', // high voltage
  hp: 60,
  atk: 10,
  spd: 1.15, // brisk — it WANTS to reach the floods
  range: 20,
  atkRate: 0.8,
  cost: 65,
  cap: 2,
  reward: 22,
  w: 15,
  h: 14,
  primary: 0x9ab4d8,   // charged steel-blue
  secondary: 0x2e3a52, // storm shade
  trait: 'sparkcaller',
  role: 'dps',
  desc: 'Charges Floods',
  route: 'land',
  attackRange: 'melee',
  tier: 3,
  incubation: 3,
  geneline: 'normal',
  defaultAbility: 'jaw_strike',
  catalyst: 'nerve',
};

const drawSparkcaller: DrawFunction = (g, u, cx, uy) => {
  const f = u.facing, w = u.w, h = u.h;
  const primary = hexToInt(u.primary);
  const dark = hexToInt(u.secondary);
  const cy = uy + h / 2 + Math.sin(u.bob * 1.6) * 0.7;
  const arc = Math.sin(u.bob * 6) > 0.6; // intermittent crackle

  // Ground shadow.
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(cx, uy + h * 1.02, w * 0.56, h * 0.12);

  // Slim legs.
  g.lineStyle(1.2, dark, 1);
  for (let i = -1; i <= 1; i++) {
    const lx = cx + i * w * 0.16;
    g.lineBetween(lx, cy + h * 0.08, lx - f * w * 0.2, cy + h * 0.46);
  }

  // Lean body — abdomen · thorax · head.
  g.fillStyle(dark, 1);
  g.fillEllipse(cx - f * w * 0.22, cy, w * 0.36, h * 0.46);
  g.fillStyle(primary, 1);
  g.fillEllipse(cx + f * w * 0.04, cy - h * 0.02, w * 0.32, h * 0.44);
  g.fillStyle(dark, 1);
  g.fillEllipse(cx + f * w * 0.3, cy - h * 0.04, w * 0.22, h * 0.32);

  // Signature — a charge node on the back that crackles to its antennae.
  g.fillStyle(0x80ffff, arc ? 0.95 : 0.5);
  g.fillCircle(cx - f * w * 0.2, cy - h * 0.3, w * 0.12);
  g.lineStyle(1.4, 0x80ffff, arc ? 1 : 0.4);
  const hx = cx + f * w * 0.38, hy = cy - h * 0.16;
  // Antennae as lightning rods.
  g.lineBetween(hx, hy, hx + f * w * 0.3, hy - h * 0.5);
  g.lineBetween(hx, hy, hx + f * w * 0.46, hy - h * 0.2);
  if (arc) {
    // A jagged bolt from the node to the antennae tip.
    const tx = hx + f * w * 0.3, ty = hy - h * 0.5;
    g.lineBetween(cx - f * w * 0.2, cy - h * 0.3, cx + f * w * 0.06, cy - h * 0.5);
    g.lineBetween(cx + f * w * 0.06, cy - h * 0.5, tx, ty);
  }

  // Eye glint.
  g.fillStyle(0x80ffff, 0.9);
  g.fillCircle(cx + f * w * 0.32, cy - h * 0.06, w * 0.05);
};

export const units: Record<string, UnitModule> = {
  wallwright: { def: wallwrightDef, draw: drawWallwright },
  acidwell: { def: acidwellDef, draw: drawAcidwell },
  sparkcaller: { def: sparkcallerDef, draw: drawSparkcaller },
};
