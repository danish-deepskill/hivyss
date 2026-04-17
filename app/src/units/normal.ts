// Normal geneline — universal baseline units, no special palette.
// Tier curve T1–T4, role coverage at every tier.

import type { UnitDef, UnitModule } from "../types";
import drawHardshell from "../draws/hardshell";
import drawGrub from "../draws/grub";
import drawPricker from "../draws/pricker";
import drawDomeback from "../draws/domeback";
import drawSkitterling from "../draws/skitterling";
import drawMendwing from "../draws/mendwing";
import drawCinderfly from "../draws/cinderfly";
import drawLongeye from "../draws/longeye";
import drawWardling from "../draws/wardling";
import drawBashguard from "../draws/bashguard";
import drawStormfly from "../draws/stormfly";

// --- T1 baseline (15-30n) ---

const hardshellDef: UnitDef = {
  name: "Hardshell",
  ico: "\u{1FAA8}",
  hp: 180,
  atk: 14,
  spd: 0.85,
  range: 22,
  atkRate: 0.7,
  cost: 25,
  cap: 3,
  reward: 12,
  w: 24, h: 18,
  primary: 0xa8a098,
  secondary: 0x504848,
  trait: "wall",
  role: "tank",
  desc: "Slow Wall",
  route: "land",
  attackRange: "melee",
  tier: 1,
  incubation: 5,
  knockResist: 30,
  caste: "soldier",
  resistance: { blunt: 'strong' },
  defaultAbility: "jaw_strike",
};

const grubDef: UnitDef = {
  name: "Grub",
  ico: "\u{1F41B}",
  hp: 50,
  atk: 16,
  spd: 2.2,
  range: 26,
  atkRate: 1.1,
  cost: 15,
  cap: 1,
  reward: 8,
  w: 22, h: 19,
  primary: 0x80d040,
  secondary: 0x3a6010,
  trait: "grub",
  role: "dps",
  desc: "Fodder",
  route: "land",
  attackRange: "melee",
  tier: 1,
  incubation: 3,
  caste: "soldier",
  defaultAbility: "jaw_strike",
};

const prickerDef: UnitDef = {
  name: "Pricker",
  ico: "\u{1F41D}",
  hp: 32,
  atk: 22,
  spd: 1.0,
  range: 95,
  atkRate: 0.8,
  cost: 30,
  cap: 2,
  reward: 14,
  w: 18, h: 16,
  primary: 0xf0c020,
  secondary: 0x402008,
  trait: "poker",
  role: "ranged",
  desc: "Fragile Poker",
  route: "land",
  attackRange: "ranged",
  tier: 1,
  incubation: 5,
  caste: "soldier",
  defaultAbility: "pricker_jab",
};

// --- T2 extended baseline (40-55n) ---

const domebackDef: UnitDef = {
  name: "Domeback",
  ico: "\u{1FAB2}",
  hp: 280,
  atk: 22,
  spd: 1.0,
  range: 24,
  atkRate: 0.65,
  cost: 55,
  cap: 4,
  reward: 26,
  w: 26, h: 22,
  primary: 0x788060,
  secondary: 0x303820,
  trait: "shell",
  role: "tank",
  desc: "Shell Wall",
  route: "land",
  attackRange: "melee",
  tier: 2,
  incubation: 9,
  knockResist: 20,
  caste: "soldier",
  defaultAbility: "jaw_strike",
};

const skitterlingDef: UnitDef = {
  name: "Skitterling",
  ico: "\u{1F4A8}",
  hp: 38,
  atk: 42,
  spd: 4.8,
  range: 24,
  atkRate: 1.3,
  cost: 40,
  cap: 1,
  reward: 18,
  w: 18, h: 17,
  primary: 0x80f8c0,
  secondary: 0x208050,
  trait: "swift",
  role: "dps",
  desc: "Glass Cannon",
  route: "land",
  attackRange: "melee",
  tier: 2,
  incubation: 4,
  caste: "soldier",
  defaultAbility: "jaw_strike",
};

// Mendwing's passiveHeal ticks via updatePassives; when the cooldown
// is ready AND a wounded ally is in range (F13=B locked 90px), queues
// heal_pulse. Heal targets the LOWEST-HP ally in range (triage
// priority), not the nearest. Cooldown does NOT reset on empty-target
// ticks — next-frame target acquisition fires immediately.
const mendwingDef: UnitDef = {
  name: "Mendwing",
  ico: "\u{1F33F}",
  hp: 100,
  atk: 6,
  spd: 1.2,
  range: 90,
  atkRate: 0.5,
  cost: 50,
  cap: 2,
  reward: 22,
  w: 22, h: 20,
  primary: 0xf060c0,
  secondary: 0x801060,
  trait: "healer",
  role: "support",
  desc: "Heals Allies",
  route: "land",
  attackRange: "ranged",
  tier: 2,
  incubation: 8,
  knockResist: 5,
  caste: "soldier",
  defaultAbility: "needle_shot",
  passiveHeal: {
    abilityName: "heal_pulse",
    cooldown: 2,
  },
};

// --- T3 specialists (70-90n) ---

// fire_bite's aoeRider spreads burn to up to 3 enemies within 85px of
// the primary (primary gets burn via the heat default effect).
const cinderflyDef: UnitDef = {
  name: "Cinderfly",
  ico: "\u{1F525}",
  hp: 90,
  atk: 30,
  spd: 1.8,
  range: 30,
  atkRate: 0.85,
  cost: 70,
  cap: 3,
  reward: 30,
  w: 21, h: 20,
  primary: 0xf08020,
  secondary: 0xa04008,
  trait: "burn",
  role: "dps",
  desc: "Burn AOE",
  route: "land",
  attackRange: "melee",
  tier: 3,
  incubation: 8,
  knockForce: 10,
  caste: "soldier",
  resistance: { heat: 'strong', cold: 'weak' },
  defaultAbility: "fire_bite",
};

const longeyeDef: UnitDef = {
  name: "Longeye",
  ico: "\u{1F52D}",
  hp: 100,
  atk: 60,
  spd: 0.85,
  range: 240,
  atkRate: 0.4,
  cost: 85,
  cap: 3,
  reward: 36,
  w: 21, h: 20,
  primary: 0xc0a0f0,
  secondary: 0x503080,
  trait: "sniper",
  role: "ranged",
  desc: "Sniper",
  route: "land",
  attackRange: "ranged",
  tier: 3,
  incubation: 14,
  caste: "soldier",
  defaultAbility: "piercing_shot",
};

// Wardling's dmg_taken -20% aura uses the same dispatch branch as
// Centurion's rally. Multi-Wardling stacks additively: 2 overlapping
// Wardlings give a shared ally -40% dmg_taken. One dying removes only
// its own source tag; surviving Wardlings keep their aura on allies.
const wardlingDef: UnitDef = {
  name: "Wardling",
  ico: "\u{1F6E1}\uFE0F",
  hp: 280,
  atk: 14,
  spd: 1.0,
  range: 30,
  atkRate: 0.5,
  cost: 90,
  cap: 4,
  reward: 38,
  w: 28, h: 26,
  primary: 0xe0c040,
  secondary: 0x806020,
  trait: "aura",
  role: "support",
  desc: "-20% Ally DMG",
  route: "land",
  attackRange: "melee",
  tier: 3,
  incubation: 11,
  knockResist: 20,
  caste: "soldier",
  defaultAbility: "jaw_strike",
  auraModifier: {
    stat: "dmg_taken",
    type: "percent",
    value: -20,
    range: 114,
  },
};

// --- T4 elites (110-130n) ---

// Bashguard's knockForce=100 drives the knockback effect (applied by
// default on blunt damage) — poise accumulation + stagger via
// knockback.onApply. Highest knockForce in the roster.
const bashguardDef: UnitDef = {
  name: "Bashguard",
  ico: "\u{1F98F}",
  hp: 320,
  atk: 50,
  spd: 1.4,
  range: 32,
  atkRate: 0.7,
  cost: 110,
  cap: 5,
  reward: 48,
  w: 50, h: 32,
  primary: 0x908060,
  secondary: 0x504030,
  trait: "knockback",
  role: "dps",
  desc: "Knockback Bruiser",
  route: "land",
  attackRange: "melee",
  tier: 4,
  incubation: 14,
  caste: "soldier",
  knockForce: 100,
  knockResist: 30,
  defaultAbility: "bash_strike",
};

// chain_lightning: 3-target chain with falloff [1.0, 0.7, 0.4], every
// 4th cast doubles damage (overchargeEvery: 4), 25% stun chance via
// the electric default effect.
const stormflyDef: UnitDef = {
  name: "Stormfly",
  ico: "\u{26A1}",
  hp: 220,
  atk: 50,
  spd: 1.5,
  range: 130,
  atkRate: 0.55,
  cost: 130,
  cap: 5,
  reward: 56,
  w: 24, h: 21,
  primary: 0x40c0f0,
  secondary: 0x1060a0,
  trait: "lightning",
  role: "ranged",
  desc: "Chain Lightning",
  route: "land",
  attackRange: "ranged",
  tier: 4,
  incubation: 18,
  knockForce: 20,
  knockResist: 10,
  caste: "elite",
  defaultAbility: "chain_lightning",
};

export const units: Record<string, UnitModule> = {
  // T1
  hardshell: { def: hardshellDef, draw: drawHardshell },
  grub: { def: grubDef, draw: drawGrub },
  pricker: { def: prickerDef, draw: drawPricker },

  // T2
  domeback: { def: domebackDef, draw: drawDomeback },
  skitterling: { def: skitterlingDef, draw: drawSkitterling },
  mendwing: { def: mendwingDef, draw: drawMendwing },

  // T3
  cinderfly: { def: cinderflyDef, draw: drawCinderfly },
  longeye: { def: longeyeDef, draw: drawLongeye },
  wardling: { def: wardlingDef, draw: drawWardling },

  // T4
  bashguard: { def: bashguardDef, draw: drawBashguard },
  stormfly: { def: stormflyDef, draw: drawStormfly },
};
