// β Swarm — NUMBERS / sacrifice (docs/mvp/GENELINES.md §2). The tide: cheap
// expendable bodies whose DEATHS are the payoff (spore/blast/bile death
// triggers), a carrion-feeder that grows on fallen swarm-mates, and the
// generative core — the "many" is SPAWNED, not deployed: Broodmother (passive
// brood) + Broodlord (Spawn-Wave) birth free Swarmlings; the Swarmlord EATS
// the swarm (Tide). Identity: small·many · cheap-and-dying · sacrifice.
// Killed by: AOE clear + sustain. Skin geneline: T0–3, Elites T2, Royal T3.
import type { UnitDef, UnitModule } from "../types";
import { PALETTES } from "../config/Palettes";
import { rear } from "./motions";
import drawSwarmling from "../draws/beta/swarmling";
import drawMaggotling from "../draws/beta/maggotling";
import drawBurster from "../draws/beta/burster";
import drawHivespitter from "../draws/beta/hivespitter";
import drawCarrionling from "../draws/beta/carrionling";
import drawSwarmlord from "../draws/beta/swarmlord";
import drawBroodlord from "../draws/beta/broodlord";
import drawBroodmother from "../draws/beta/broodmother";

/** β def helper — shared geneline palette + tag. */
const bDef = (def: Omit<UnitDef, "palette" | "geneline">): UnitDef => ({
  ...def,
  palette: PALETTES.beta,
  geneline: "beta",
});

// Swarmling — T0, the PARTICLE of the swarm: the cheapest body in the game,
// also the spawn output of the brood units. One alone is nothing; the tide is
// the unit.
const swarmlingDef = bDef({
  name: "Swarmling",
  ico: "\u{1FAB0}",
  hp: 25,
  atk: 6,
  spd: 0.85,
  range: 14,
  atkRate: 1.2,
  cost: 8,
  cap: 0.5, // half a slot — the deployed tide is cap-cheap (β's capacity character)
  reward: 4,
  w: 11,
  h: 9,
  trait: "swarmling",
  role: "dps",
  desc: "The Tide",
  tier: 0,
  incubation: 1.5,
  defaultAbility: "jaw_strike",
});

// Maggotling — T1: a soft pale maggot whose death matters more than its life —
// it pops into a spore puff that poisons everyone nearby.
const maggotlingDef = bDef({
  name: "Maggotling",
  ico: "\u{1F41B}",
  hp: 38,
  atk: 8,
  spd: 0.55,
  range: 15,
  atkRate: 0.9,
  cost: 18,
  cap: 1,
  reward: 8,
  w: 14,
  h: 10,
  trait: "maggotling",
  role: "dps",
  desc: "Spore Carrier",
  tier: 1,
  incubation: 3,
  defaultAbility: "jaw_strike",
  deathAbility: "spore_burst",
});

// Burster — T1: the suicide runner. A sprinting bomb — its swollen abdomen IS
// the weapon (concussive death-blast + knockback); its bite is an afterthought.
const bursterDef = bDef({
  name: "Burster",
  ico: "\u{1F4A5}",
  hp: 30,
  atk: 5,
  spd: 1.05,
  range: 14,
  atkRate: 0.8,
  cost: 22,
  cap: 1,
  reward: 10,
  w: 13,
  h: 11,
  trait: "burster",
  role: "dps",
  desc: "Living Bomb",
  tier: 1,
  incubation: 3,
  defaultAbility: "jaw_strike",
  deathAbility: "death_blast",
});

// Hivespitter — T2: squat living artillery. Lobs BILE (chance to poison);
// killing it ruptures the bile gland over everything nearby. Two systems:
// ranged + death-effect. (Bile = digestive swarm-fluid, NOT chemical acid —
// corrosion is the future acid geneline's corner, GENELINES §1.0.)
const hivespitterDef = bDef({
  name: "Hivespitter",
  ico: "\u{1F9EA}",
  hp: 55,
  atk: 15,
  spd: 0.5,
  range: 85,
  atkRate: 0.8,
  cost: 42,
  cap: 2,
  reward: 18,
  w: 16,
  h: 12,
  trait: "hivespitter",
  role: "ranged",
  desc: "Bile Lobber",
  tier: 2,
  incubation: 6,
  attackRange: "ranged",
  defaultAbility: "bile_spit",
  deathAbility: "bile_rupture",
});

// Carrionling — T3: the scavenger that GROWS on the swarm's deaths — every
// fallen swarm-mate nearby permanently feeds it (reads death-context → buffs
// SELF, the tier-3 contract). Visibly gorges as it stacks.
const carrionlingDef = bDef({
  name: "Carrionling",
  ico: "\u{1F9B4}",
  hp: 95,
  atk: 16,
  spd: 0.62,
  range: 18,
  atkRate: 0.85,
  cost: 62,
  cap: 2,
  reward: 26,
  w: 17,
  h: 13,
  trait: "carrionling",
  role: "dps",
  desc: "Carrion Feeder",
  tier: 3,
  incubation: 8,
  defaultAbility: "jaw_strike",
  deathFeed: { perDeath: 4, radius: 85, max: 10 },
});

// Swarmlord — β ELITE (T2): the tyrant that EATS its own tide. Signature
// TIDE consumes nearby Swarm soldiers (they vanish — no corpses, no death
// triggers) and permanently grows atk per body. Enrages below half.
const swarmlordDef = bDef({
  name: "Swarmlord",
  ico: "\u{1F451}",
  hp: 210,
  atk: 30,
  spd: 0.55,
  range: 24,
  atkRate: 0.7,
  cost: 95,
  cap: 4,
  reward: 46,
  w: 26,
  h: 22,
  trait: "swarmlord",
  role: "dps",
  desc: "Eats the Swarm",
  tier: 2,
  incubation: 11,
  caste: "elite",
  defaultAbility: "jaw_strike",
  signatureAbility: "tide",
  signatureCooldown: 14,
  signatureAnim: rear({}),
  signatureAnimPhases: { windup: 0.3, active: 0.15, recover: 0.25 },
  phaseThreshold: 0.5,
  passives: [
    { kind: "self_modifier", stat: "atk", type: "percent", value: 35, condition: "in_phase_2" },
  ],
});

// Broodlord — β ELITE (T2): the walking nursery. Signature SPAWN-WAVE births
// a clutch of Swarmlings on demand (generative power = Elite-tier, never a
// soldier). Enrages below half — the eggs come faster.
const broodlordDef = bDef({
  name: "Broodlord",
  ico: "\u{1F95A}",
  hp: 230,
  atk: 22,
  spd: 0.45,
  range: 22,
  atkRate: 0.6,
  cost: 105,
  cap: 4,
  reward: 50,
  w: 28,
  h: 22,
  trait: "broodlord",
  role: "support",
  desc: "Walking Nursery",
  tier: 2,
  incubation: 12,
  caste: "elite",
  defaultAbility: "jaw_strike",
  signatureAbility: "spawn_wave",
  signatureCooldown: 16,
  signatureAnim: rear({}),
  signatureAnimPhases: { windup: 0.3, active: 0.15, recover: 0.3 },
  phaseThreshold: 0.5,
  passives: [
    { kind: "self_modifier", stat: "atkRate", type: "percent", value: 30, condition: "in_phase_2" },
  ],
});

// Broodmother — β ROYAL (T3): the birthing queen. Passively broods free
// Swarmlings (the tide never stops while she stands); her ultimate BROOD
// SURGE is a violent mass birthing. The swarm IS her power.
const broodmotherDef = bDef({
  name: "Broodmother",
  ico: "\u{1F41A}",
  hp: 430,
  atk: 32,
  spd: 0.4,
  range: 26,
  atkRate: 0.55,
  cost: 200,
  cap: 6,
  reward: 90,
  w: 38,
  h: 30,
  trait: "broodmother",
  role: "support",
  desc: "Birthing Queen",
  tier: 3,
  incubation: 16,
  caste: "royal",
  defaultAbility: "jaw_strike",
  signatureAbility: "brood_surge",
  signatureCooldown: 22,
  signatureAnim: rear({}),
  signatureAnimPhases: { windup: 0.35, active: 0.15, recover: 0.3 },
  passives: [
    { kind: "spawner", unitKey: "swarmling", interval: 7, count: 1 },
    // The swarm buff (GENELINES spec): the tide fights harder around its
    // queen — a gravitational center for β the way cohesion centers α.
    { kind: "aura_modifier", stat: "atk", type: "percent", value: 12, range: 130 },
  ],
});

export const units: Record<string, UnitModule> = {
  swarmling: { def: swarmlingDef, draw: drawSwarmling },
  maggotling: { def: maggotlingDef, draw: drawMaggotling },
  burster: { def: bursterDef, draw: drawBurster },
  hivespitter: { def: hivespitterDef, draw: drawHivespitter },
  carrionling: { def: carrionlingDef, draw: drawCarrionling },
  swarmlord: { def: swarmlordDef, draw: drawSwarmlord },
  broodlord: { def: broodlordDef, draw: drawBroodlord },
  broodmother: { def: broodmotherDef, draw: drawBroodmother },
};
