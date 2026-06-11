// α Primal — MVP Phase-0 showcase roster (docs/mvp/ALPHA.md).
// Pyramid (7 = the base skeleton): T0 Chitling·Goreling · T1 Hornshell·Quillback(ranged)
// · T2 = 2 Elites (Goliath, Maulhorn) · T3 = the Royal (Matriarch). 4 soldiers + 2
// Elites + 1 Royal. (Goretusk's tight-wedge cohesion was cut — its role overlapped
// the baseline cohesion + Goliath's amplifier; α trimmed to 4 soldiers per the budget.)
// Built: Pack Cohesion (hook) + both Elite signatures (Goliath Stampede, Maulhorn Ram,
// each w/ FX + body animation) + Quillback (α's ranged anti-air) + Goliath's cohesion-
// amplifier aura + the Matriarch's full Royal kit (click-control via RoyalLifecycle,
// Primal Roar ultimate, death stakes, lane-switch). α is roster-complete.
import type { UnitDef, UnitModule, PassiveDef, CohesionConfig } from "../types";
import { PALETTES } from "../config/Palettes";
import { charge, ram } from "./motions";
import drawChitling from "../draws/alpha/chitling";
import drawGoreling from "../draws/alpha/goreling";
import drawHornshell from "../draws/alpha/hornshell";
import drawQuillback from "../draws/alpha/quillback";
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
  spd: 0.75,
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
  spd: 1.0,
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
  sfx: "gore", // a charger's rough, wet chomp — distinct from Chitling's snip
  passives: [cohesion()],
});

const hornshellDef = aDef({
  name: "Hornshell",
  ico: "\u{1FAB2}",
  hp: 240,
  atk: 12,
  spd: 0.45,
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
  sfx: "clack", // a heavy shell-tank's hard chitin tok
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
  spd: 0.55,
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

const maulhornDef = aDef({
  name: "Maulhorn",
  ico: "\u{1F982}",
  hp: 190,
  atk: 42,
  spd: 0.65,
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
  sfx: "gore", // bruiser's basic bite is a heavy gore (Ram Charge is its own sound)
  // Elite signature — a hard ram-charge with the roster's biggest knockback
  // (see blunt.ts). Uses the `ram` motion (crouch → flat thrust → recoil
  // bounce), distinct from Goliath's forward-settling `charge`.
  signatureAbility: "ram_charge",
  signatureCooldown: 6,
  signatureAnim: ram({ thrust: 0.55, recoil: 0.25 }),
  signatureAnimPhases: { windup: 0.15, active: 0.1, recover: 0.3 },
  // Phase-2: a cornered bruiser goes berserk near death (enrage modifiers below).
  phaseThreshold: 0.4,
  passives: [
    cohesion(),
    { kind: "self_modifier", stat: "atk", type: "percent", value: 50, condition: "in_phase_2" },
    { kind: "self_modifier", stat: "atkRate", type: "percent", value: 40, condition: "in_phase_2" },
  ],
});

// Goliath — α's apex ELITE (T2): the herd-anchor with the player-triggered
// Stampede signature (shockwave FX + charge animation). Sits below the Royal
// (Matriarch) which is the T3 capstone.
const goliathDef = aDef({
  name: "Goliath",
  ico: "\u{1F41C}",
  hp: 340,
  atk: 50,
  spd: 0.5,
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
  // Phase-2: the wounded anchor digs in near death (enrage modifiers below).
  phaseThreshold: 0.5,
  passives: [
    cohesion({ radius: 90 }),
    {
      kind: "aura_modifier",
      stat: "cohesion_perAlly",
      type: "flat",
      value: 5,
      range: 100,
    },
    { kind: "self_modifier", stat: "atk", type: "percent", value: 40, condition: "in_phase_2" },
    { kind: "self_modifier", stat: "atkRate", type: "percent", value: 30, condition: "in_phase_2" },
  ],
});

// Matriarch — α's ROYAL (T3 capstone): the herd queen. Vast, slow, regal; the
// ultimate cohesion anchor (widest radius + highest cap — the herd is strongest
// massed around her). The CONTROLLABLE hero (RoyalLifecycle: click-select →
// move/focus, lane-switch, death → leaderless → respawn) with the Primal Roar
// ultimate below. NOT a re-tag of Goliath — a distinct queen silhouette
// (banded egg-gaster, coronet, vestigial wings).
const matriarchDef = aDef({
  name: "Matriarch",
  ico: "\u{1F41C}",
  hp: 520,
  atk: 60,
  spd: 0.43,
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
  // Royal ULTIMATE — Primal Roar: same-lane herd surges to peak cohesion +
  // charges forward for the buff window. Fired from her HUD slot (signature
  // system); long cooldown — it's a hero beat, not a spam.
  signatureAbility: "primal_roar",
  signatureCooldown: 20,
  passives: [
    cohesion({ radius: 110, maxAllies: 6 }),
    // Royal cohesion AMPLIFIER (VISION §3) — additively boosts nearby herd-mates'
    // per-ally cohesion (like Goliath's, wider). Absent by default → baseline; her
    // death runs the aura cleanup → the amp vanishes and the herd's cohesion sags.
    // This IS the "hook drops to baseline" half — zero extra code, pure data.
    { kind: "aura_modifier", stat: "cohesion_perAlly", type: "flat", value: 5, range: 130 },
  ],
});

export const units: Record<string, UnitModule> = {
  chitling: { def: chitlingDef, draw: drawChitling },
  goreling: { def: gorelingDef, draw: drawGoreling },
  hornshell: { def: hornshellDef, draw: drawHornshell },
  quillback: { def: quillbackDef, draw: drawQuillback },
  maulhorn: { def: maulhornDef, draw: drawMaulhorn },
  goliath: { def: goliathDef, draw: drawGoliath },
  matriarch: { def: matriarchDef, draw: drawMatriarch },
};
