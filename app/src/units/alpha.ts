import type { UnitDef, UnitModule } from "../types";
import { PALETTES } from "../config/Palettes";
import drawGrunt from "../draws/alpha/grunt";
import drawMandible from "../draws/alpha/mandible";
import drawBombardier from "../draws/alpha/bombardier";
import drawNeedler from "../draws/alpha/needler";
import drawLegionnaire from "../draws/alpha/legionnaire";
import drawRavager from "../draws/alpha/ravager";
import drawCenturion from "../draws/alpha/centurion";

const alphaDef = (def: Omit<UnitDef, "palette" | "geneline">): UnitDef => ({
  ...def,
  palette: PALETTES.alpha,
  geneline: "alpha",
});

const gruntDef = alphaDef({
  name: "Grunt",
  ico: "\u{1F6E1}\uFE0F",
  hp: 90,
  atk: 20,
  spd: 1.4,
  range: 20,
  atkRate: 1.0,
  cost: 25,
  cap: 1,
  reward: 12,
  w: 20,
  h: 18,
  trait: "grunt",
  role: "dps",
  desc: "Basic Soldier",
  route: "land",
  attackRange: "melee",
  tier: 0,
  incubation: 3,
  caste: "soldier",
  defaultAbility: "jaw_strike",
});

const mandibleDef = alphaDef({
  name: "Mandible",
  ico: "\u{1F41C}",
  hp: 140,
  atk: 32,
  spd: 1.2,
  range: 22,
  atkRate: 0.9,
  cost: 40,
  cap: 2,
  reward: 18,
  w: 18,
  h: 16,
  trait: "basic",
  role: "dps",
  desc: "Balanced",
  route: "land",
  attackRange: "melee",
  tier: 1,
  incubation: 4,
  caste: "soldier",
  defaultAbility: "jaw_strike",
});

// Bombardier explodes on death via `deathAbility` — applyDeathTriggerPhase
// queues `death_bomb` per target within range of the dying unit.
const bombardierDef = alphaDef({
  name: "Bombardier",
  ico: "\u{1F4A5}",
  hp: 100,
  atk: 28,
  spd: 1.6,
  range: 22,
  atkRate: 0.85,
  cost: 60,
  cap: 3,
  reward: 28,
  w: 24,
  h: 20,
  trait: "area",
  role: "dps",
  desc: "Area ATK",
  route: "land",
  attackRange: "melee",
  tier: 2,
  incubation: 5,
  caste: "soldier",
  deathAbility: 'death_bomb',
  defaultAbility: 'jaw_strike',
});

const needlerDef = alphaDef({
  name: "Needler",
  ico: "\u{1F3AF}",
  hp: 75,
  atk: 42,
  spd: 0.9,
  range: 90,
  atkRate: 0.75,
  cost: 50,
  cap: 2,
  reward: 22,
  w: 22,
  h: 18,
  trait: "ranged",
  role: "ranged",
  desc: "Ranged",
  route: "land",
  attackRange: "ranged",
  tier: 1,
  incubation: 5,
  caste: "soldier",
  defaultAbility: "needle_shot",
});

// Legionnaire uses bash_strike (blunt) — bash_strike carries the
// homogenized knockForce 100 via ability tier data.
// resistance: heavy plate soaks physical, armor cooks under fire.
const legionnaireDef = alphaDef({
  name: "Legionnaire",
  ico: "\u{1FAB2}",
  hp: 800,
  atk: 18,
  spd: 0.6,
  range: 10,
  atkRate: 0.5,
  cost: 85,
  cap: 4,
  reward: 40,
  w: 30,
  h: 22,
  trait: "massive",
  role: "tank",
  desc: "Massive HP",
  route: "land",
  attackRange: "melee",
  tier: 2,
  incubation: 7,
  caste: "soldier",
  defaultAbility: "bash_strike",
  resistance: { blunt: 'strong', sharp: 'strong', heat: 'weak' },
});

// Ravager's `selfModifier` adds +50% atkRate when HP ≤ 50% via the
// updatePassives self-modifier branch. Step-function; flips both ways
// if Mendwing heal brings HP back above the threshold.
const ravagerDef = alphaDef({
  name: "Ravager",
  ico: "\u{1F41D}",
  hp: 160,
  atk: 60,
  spd: 2.2,
  range: 20,
  atkRate: 1.25,
  cost: 70,
  cap: 3,
  reward: 32,
  w: 22,
  h: 18,
  trait: "berserk",
  role: "dps",
  desc: "Rage SPD",
  route: "air",
  attackRange: "melee",
  tier: 2,
  incubation: 6,
  caste: "soldier",
  defaultAbility: "jaw_strike",
  selfModifier: {
    stat: "atkRate",
    type: "percent",
    value: 50,
    condition: "hp_below_half",
  },
});

// Centurion's rally aura adds +20% atk to in-range same-side allies
// via the updatePassives aura branch. Multi-source stacking is
// additive: two overlapping Centurions = +40%. Source-tagged
// `aura:${id}:atk` so one dying only removes its own tag.
const centurionDef = alphaDef({
  name: "Centurion",
  ico: "\u{2694}\uFE0F",
  hp: 250,
  atk: 26,
  spd: 0.9,
  range: 24,
  atkRate: 0.8,
  cost: 100,
  cap: 5,
  reward: 48,
  w: 26,
  h: 22,
  trait: "rally",
  role: "support",
  desc: "+20% Ally ATK",
  route: "land",
  attackRange: "melee",
  tier: 3,
  incubation: 8,
  caste: "soldier",
  defaultAbility: "jaw_strike",
  auraModifier: {
    stat: "atk",
    type: "percent",
    value: 20,
    range: 80,
  },
});

export const units: Record<string, UnitModule> = {
  grunt: { def: gruntDef, draw: drawGrunt },
  mandible: { def: mandibleDef, draw: drawMandible },
  bombardier: { def: bombardierDef, draw: drawBombardier },
  needler: { def: needlerDef, draw: drawNeedler },
  legionnaire: { def: legionnaireDef, draw: drawLegionnaire },
  ravager: { def: ravagerDef, draw: drawRavager },
  centurion: { def: centurionDef, draw: drawCenturion },
};
