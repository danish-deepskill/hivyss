// γ Fortress — WALLS / never-die / HOLD (docs/mvp/GENELINES.md §γ). The wall:
// few, slow, heavily-armoured bodies that hold ground and make the enemy break
// on them. Hook: armour = high PHYSICAL resistance (sharp/blunt) — γ shrugs the
// swords and bites. THE INVARIANT: γ NEVER resists ELEMENTAL (toxic/heat/electric);
// fire, acid and lightning are how a wall comes down (keeps γ from being immune
// to the sharp-heavy roster). Identity: few durable walls · incubation ·
// never-die · hold/degrade. Counter-triangle: β → α → γ → β.
//
// THIS FILE — the armoured SOLDIER core, COMPLETE T0–T3, built to the α/β bar
// (individually drawn, distinct silhouettes, wear-on-body): Pebbling (brick),
// Burrower (planted wall), Shieldbug (mobile wall), Thornback (spite/reflect),
// Calcifier (T3 tomb-wall — re-calcify + shatter). Soldiers are SELF-affecting
// (they BECOME walls). Built mechanics: physical-resistance armour, armour-
// DEGRADE (post_apply soak), reflect (Thornback), re-calcify + shatter
// (Calcifier). Still to come: the Elites that CREATE walls (Rampart/Aegis),
// the Royal (Regina), and wall-deploy / burrow-TOGGLE / repair — deferred
// while the structure system settles. Skin geneline: T0–3, Elites T2, Royal T3.
import type { UnitDef, UnitModule } from "../types";
import { PALETTES } from "../config/Palettes";
import drawPebbling from "../draws/gamma/pebbling";
import drawBurrower from "../draws/gamma/burrower";
import drawShieldbug from "../draws/gamma/shieldbug";
import drawThornback from "../draws/gamma/thornback";
import drawCalcifier from "../draws/gamma/calcifier";

/** γ def helper — shared geneline palette + tag. */
const gDef = (def: Omit<UnitDef, "palette" | "geneline">): UnitDef => ({
  ...def,
  palette: PALETTES.gamma,
  geneline: "gamma",
});

// Pebbling — T0: the brick. Cheap, over-plated crawler; γ's durable PARTICLE —
// the opposite of β's expendable Swarmling (meant to survive, not die). Shrugs
// physical (strong ×0.6); takes elemental in full.
const pebblingDef = gDef({
  name: "Pebbling",
  ico: "\u{1FAA8}", // rock
  hp: 90,
  atk: 8,
  spd: 0.6,
  range: 18,
  atkRate: 0.9,
  cost: 25,
  cap: 1,
  reward: 11,
  w: 15,
  h: 13,
  trait: "pebbling",
  degradeArmor: { per: 30 },
  role: "tank",
  desc: "The Brick",
  route: "land",
  attackRange: "melee",
  tier: 0,
  incubation: 3,
  caste: "soldier",
  defaultAbility: "jaw_strike",
  resistance: { sharp: "strong", blunt: "strong" },
});

// Burrower — T1: the planted wall. Digs in and barely moves (spd ~0); the
// roster's heaviest physical armour (stronger ×0.3). A position, not a creature.
// (True burrow-TOGGLE stance is a follow-up; v1 is the dug-in stats.)
const burrowerDef = gDef({
  name: "Burrower",
  ico: "\u{26CF}", // pick (digger)
  hp: 280,
  atk: 8,
  spd: 0.22,
  range: 20,
  atkRate: 0.6,
  cost: 50,
  cap: 2,
  reward: 22,
  w: 24,
  h: 18,
  trait: "burrower",
  degradeArmor: { per: 60 },
  role: "tank",
  desc: "Planted Wall",
  route: "land",
  attackRange: "melee",
  tier: 1,
  incubation: 5,
  caste: "soldier",
  defaultAbility: "jaw_strike",
  resistance: { sharp: "stronger", blunt: "stronger" },
});

// Shieldbug — T2: the mobile wall. A big soak that carries a frontal plate into
// the line; stronger physical armour, modest pace. Holds the line as a body.
const shieldbugDef = gDef({
  name: "Shieldbug",
  ico: "\u{1F6E1}", // shield
  hp: 220,
  atk: 14,
  spd: 0.4,
  range: 22,
  atkRate: 0.7,
  cost: 65,
  cap: 2,
  reward: 28,
  w: 26,
  h: 20,
  trait: "shieldbug",
  degradeArmor: { per: 50 },
  role: "tank",
  desc: "Mobile Wall",
  route: "land",
  attackRange: "melee",
  tier: 2,
  incubation: 6,
  caste: "soldier",
  defaultAbility: "jaw_strike",
  resistance: { sharp: "stronger", blunt: "stronger" },
});

// Thornback — T2: the spite-wall. It barely attacks; STRIKING it returns a
// share of the blow (reflect 30%) — enemy offense breaks on it. Modest physical
// armour (strong); the reflect, not bulk, is its teeth. Reflect is type-agnostic
// (post_apply), so even resistant attackers feel the thorns.
const thornbackDef = gDef({
  name: "Thornback",
  ico: "\u{1F994}", // hedgehog (spined)
  hp: 160,
  atk: 16,
  spd: 0.5,
  range: 20,
  atkRate: 0.8,
  cost: 60,
  cap: 2,
  reward: 26,
  w: 24,
  h: 19,
  trait: "thornback",
  degradeArmor: { per: 40 },
  role: "tank",
  desc: "Thorned Wall",
  route: "land",
  attackRange: "melee",
  tier: 2,
  incubation: 6,
  caste: "soldier",
  defaultAbility: "jaw_strike",
  resistance: { sharp: "strong", blunt: "strong" },
  reflect: { pct: 0.3 },
});

// Calcifier — T3: the soldier-core CAPSTONE. The tomb-wall. The biggest, slowest
// γ body, and the only one that beats its own geneline's weakness: every few
// seconds it RE-CALCIFIES (recalcify passive), stepping the physical armour the
// degrade system strips back UP toward full — so sustained pressure that cracks
// the lesser walls only dents this one. And when it finally falls it SHATTERS:
// the collapsing stone throws a wide blunt burst (deathAbility) that punts and
// crushes whatever broke it. Calcify in life, shatter in death. Re-calcify is
// PHYSICAL only — fire/acid/lightning still bring the tomb down (γ invariant).
const calcifierDef = gDef({
  name: "Calcifier",
  ico: "\u{1F5FF}", // moai (carved stone)
  hp: 340,
  atk: 18,
  spd: 0.35,
  range: 22,
  atkRate: 0.6,
  cost: 82,
  cap: 3,
  reward: 38,
  w: 32,
  h: 24, // the biggest footprint in the geneline — a hunched, crystal-crusted bulk
  trait: "calcifier",
  degradeArmor: { per: 70 },
  role: "tank",
  desc: "Tomb Wall",
  route: "land",
  attackRange: "melee",
  tier: 3,
  incubation: 9,
  caste: "soldier",
  defaultAbility: "jaw_strike",
  deathAbility: "shatter",
  resistance: { sharp: "stronger", blunt: "stronger" },
  passives: [{ kind: "recalcify", interval: 6 }],
});

export const units: Record<string, UnitModule> = {
  pebbling: { def: pebblingDef, draw: drawPebbling },
  burrower: { def: burrowerDef, draw: drawBurrower },
  shieldbug: { def: shieldbugDef, draw: drawShieldbug },
  thornback: { def: thornbackDef, draw: drawThornback },
  calcifier: { def: calcifierDef, draw: drawCalcifier },
};
