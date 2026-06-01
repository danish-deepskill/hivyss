// α Primal — MVP Phase-0 showcase roster (GENELINE_ALPHA.md).
// Pyramid (8 units): T0 Chitling·Goreling · T1 Hornshell·Goretusk·Quillback(ranged) ·
// T2 = 2 Elites (Goliath, Maulhorn) · T3 = the Royal (Matriarch).
// Built: Pack Cohesion (hook) + both Elite signatures (Goliath Stampede, Maulhorn
// Ram, each w/ FX + body animation) + Quillback (α's ranged anti-air) + Goretusk
// tight-wedge cohesion (sharper payoff, tighter radius) + Goliath's cohesion-
// amplifier aura. To build: the Matriarch's Royal ultimate (needs Royal system).
import type { UnitDef, UnitModule, PassiveDef, CohesionConfig } from "../types";
import { PALETTES } from "../config/Palettes";
import { charge, ram } from "./motions";
import drawChitling from "../draws/alpha/chitling";
import drawGoreling from "../draws/alpha/goreling";
import drawHornshell from "../draws/alpha/hornshell";
import drawQuillback from "../draws/alpha/quillback";
import drawGoretusk from "../draws/alpha/goretusk";
import drawMaulhorn from "../draws/alpha/maulhorn";
import drawGoliath from "../draws/alpha/goliath";
import drawMatriarch from "../draws/alpha/matriarch";

// Pack Cohesion — α's geneline-wide hook: +6% atk per same-geneline ally
// within 60px, capped at 5 (so up to +30% in a tight herd). The DEFAULTS
// live here; each unit opts in per-roster via `cohesion()` so specific
// vyssids can cohere differently — a wide-radius anchor, a low-cap lone
// charger, a non-coherent outlier — by passing field overrides. Cohesion
// is no longer auto-stamped by the factory; it's a deliberate per-unit
// choice. Placeholder numbers, tuned at the playtest gates.
// Default cap 4 (not 5) per the MVP re-frame: α rewards committing a tight
// strike force together, NOT spamming bodies (that's β's NUMBERS lane).
const COHESION_DEFAULTS: CohesionConfig = {
  stat: "atk",
  type: "percent",
  perAlly: 10,
  radius: 60,
  maxAllies: 4,
};
const cohesion = (over: Partial<CohesionConfig> = {}): PassiveDef => ({
  kind: "cohesion",
  ...COHESION_DEFAULTS,
  ...over,
});

const aDef = (def: Omit<UnitDef, "palette" | "geneline">): UnitDef => ({
  ...def,
  palette: PALETTES.alpha,
  geneline: "alpha",
});

const chitlingDef = aDef({
  name: "Chitling",
  ico: "\u{1F41B}",
  hp: 70,
  atk: 12,
  spd: 1.5,
  range: 18,
  atkRate: 1.1,
  cost: 20,
  cap: 1,
  reward: 10,
  w: 16,
  h: 14,
  trait: "chitling",
  role: "dps",
  desc: "Herd Fodder",
  route: "land",
  attackRange: "melee",
  tier: 0,
  incubation: 3,
  caste: "soldier",
  defaultAbility: "jaw_strike",
  passives: [cohesion()],
});

const gorelingDef = aDef({
  name: "Goreling",
  ico: "\u{1F997}",
  hp: 50,
  atk: 20,
  spd: 2.0,
  range: 20,
  atkRate: 1.0,
  cost: 35,
  cap: 1,
  reward: 16,
  w: 18,
  h: 14,
  trait: "goreling",
  role: "dps",
  desc: "Charger",
  route: "land",
  attackRange: "melee",
  tier: 0,
  incubation: 4,
  caste: "soldier",
  defaultAbility: "jaw_strike",
  passives: [cohesion()],
});

const hornshellDef = aDef({
  name: "Hornshell",
  ico: "\u{1FAB2}",
  hp: 240,
  atk: 12,
  spd: 0.9,
  range: 22,
  atkRate: 0.7,
  cost: 45,
  cap: 2,
  reward: 20,
  w: 26,
  h: 20,
  trait: "hornshell",
  role: "tank",
  desc: "Wall",
  route: "land",
  attackRange: "melee",
  tier: 1,
  incubation: 5,
  caste: "soldier",
  defaultAbility: "jaw_strike",
  passives: [cohesion()],
});

// Quillback — α's only RANGED unit (was Carapex). A fragile spitter that hurls
// spines; land route + ranged reach lets it hit the AIR lane → α's anti-air.
// (The cohesion-amplifier mechanic Carapex was slated for moves to Goliath.)
const quillbackDef = aDef({
  name: "Quillback",
  ico: "\u{1F41E}",
  hp: 90,
  atk: 22,
  spd: 1.1,
  range: 90, // ranged reach — and `attackRange:'ranged'` → hits air
  atkRate: 0.9,
  cost: 50,
  cap: 2,
  reward: 26,
  w: 22,
  h: 20,
  trait: "quillback",
  role: "ranged",
  desc: "Spine Spitter",
  route: "land",
  attackRange: "ranged",
  tier: 1,
  incubation: 6,
  caste: "soldier",
  defaultAbility: "needle_shot",
  passives: [cohesion()],
});

const goretuskDef = aDef({
  name: "Goretusk",
  ico: "\u{1FAB3}",
  hp: 150,
  atk: 36,
  spd: 1.6,
  range: 22,
  atkRate: 0.9,
  cost: 80,
  cap: 3,
  reward: 36,
  w: 24,
  h: 18,
  trait: "goretusk",
  role: "dps",
  desc: "Wedge",
  route: "land",
  attackRange: "melee",
  tier: 1,
  incubation: 9,
  caste: "soldier",
  defaultAbility: "jaw_strike",
  // T1 "attack with a twist" (TIER_CONTRACT §2): the geneline cohesion hook,
  // SHARPENED into a tight advancing wedge. Narrow radius (45 vs the default
  // 60) but higher payoff per ally (+15% vs +10%, up to +60% atk in a full
  // clump). A concentrated knot hits disproportionately hard — and is the
  // juiciest AOE target. The tight-vs-spread tension, dialed up. Pure data,
  // no custom logic — exactly the T1 budget.
  passives: [cohesion({ radius: 45, perAlly: 15 })],
});

const maulhornDef = aDef({
  name: "Maulhorn",
  ico: "\u{1F982}",
  hp: 190,
  atk: 42,
  spd: 1.3,
  range: 24,
  atkRate: 0.7,
  cost: 60,
  cap: 2,
  reward: 28,
  w: 26,
  h: 22,
  trait: "maulhorn",
  role: "dps",
  desc: "Ram Bruiser",
  route: "land",
  attackRange: "melee",
  tier: 2,
  incubation: 7,
  caste: "elite",
  defaultAbility: "jaw_strike",
  // Elite signature — a hard ram-charge with the roster's biggest knockback
  // (see blunt.ts). Uses the `ram` motion (crouch → flat thrust → recoil
  // bounce), distinct from Goliath's forward-settling `charge`.
  signatureAbility: "ram_charge",
  signatureCooldown: 6,
  signatureAnim: ram({ thrust: 0.55, recoil: 0.25 }),
  signatureAnimPhases: { windup: 0.15, active: 0.1, recover: 0.3 },
  passives: [cohesion()],
});

// Goliath — α's apex ELITE (T2): the herd-anchor with the player-triggered
// Stampede signature (shockwave FX + charge animation). Sits below the Royal
// (Matriarch) which is the T3 capstone.
const goliathDef = aDef({
  name: "Goliath",
  ico: "\u{1F41C}",
  hp: 340,
  atk: 50,
  spd: 1.0,
  range: 28,
  atkRate: 0.7,
  cost: 120,
  cap: 5,
  reward: 58,
  w: 32,
  h: 28,
  trait: "goliath",
  role: "tank",
  desc: "Herd Anchor",
  route: "land",
  attackRange: "melee",
  tier: 2,
  incubation: 12,
  caste: "elite",
  defaultAbility: "jaw_strike",
  // α's Elite signature — player-triggered AOE charge (see blunt.ts).
  signatureAbility: "stampede",
  // Body animation: rear back, then a heavy lunge forward; the shockwave +
  // damage land at the lunge peak (windup→active boundary). The whole
  // authoring cost of the stampede animation — one composed primitive.
  signatureAnim: charge({ rear: 0.3, lunge: 0.6 }),
  signatureAnimPhases: { windup: 0.25, active: 0.12, recover: 0.28 },
  // The anchor binds a WIDE pack — a big radius reliably maxes cohesion,
  // so the herd is strongest when it forms up around the Goliath. On top of
  // that it AMPLIFIES the pack: an aura that adds +cohesion_perAlly to nearby
  // allies (the cohesion handler reads perAlly through modifiers), so the
  // anchor doesn't just gather the herd — it makes the herd hit harder.
  passives: [
    cohesion({ radius: 90 }),
    {
      kind: "aura_modifier",
      stat: "cohesion_perAlly",
      type: "flat",
      value: 5,
      range: 100,
    },
  ],
});

// Matriarch — α's ROYAL (T3 capstone): the herd queen. Vast, slow, regal; the
// ultimate cohesion anchor (widest radius + highest cap — the herd is strongest
// massed around her). Her Royal ULTIMATE + the direct-control paradigm are
// future work (Royal system not built); for now she's a powerful anchor with a
// basic attack. NOT a re-tag of Goliath — a distinct, grander unit + draw.
const matriarchDef = aDef({
  name: "Matriarch",
  ico: "\u{1F41C}",
  hp: 520,
  atk: 60,
  spd: 0.85,
  range: 30,
  atkRate: 0.6,
  cost: 180,
  cap: 7,
  reward: 80,
  w: 40,
  h: 36,
  trait: "matriarch",
  role: "tank",
  desc: "Herd Queen",
  route: "land",
  attackRange: "melee",
  tier: 3,
  incubation: 16,
  caste: "royal",
  defaultAbility: "jaw_strike",
  passives: [cohesion({ radius: 110, maxAllies: 6 })],
});

export const units: Record<string, UnitModule> = {
  chitling: { def: chitlingDef, draw: drawChitling },
  goreling: { def: gorelingDef, draw: drawGoreling },
  hornshell: { def: hornshellDef, draw: drawHornshell },
  quillback: { def: quillbackDef, draw: drawQuillback },
  goretusk: { def: goretuskDef, draw: drawGoretusk },
  maulhorn: { def: maulhornDef, draw: drawMaulhorn },
  goliath: { def: goliathDef, draw: drawGoliath },
  matriarch: { def: matriarchDef, draw: drawMatriarch },
};
