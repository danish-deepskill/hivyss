import type { UnitDef, UnitModule } from "../types";
import drawScout from "../draws/scout";   // the distinct pheromone-courier look
import drawWorker from "../draws/worker"; // the plain worker baseline (Gatherer)
import drawBuilder from "../draws/builder"; // the construction worker

// Universal WORKER caste (shared across genelines, not α-specific). The Scout
// carries a pheromone command (Rally/Charge/Retreat): deployed via the command
// buttons, it runs forward emitting that zone around itself and dies if killed
// — so a command is a real, protectable commitment, not a free click. It is
// NON-COMBATANT (CombatSystem keeps caste 'worker' from ever attacking).
// Geneline 'normal' = the universal substrate; filtered out of the roster
// (deploy is via the command buttons, see SandboxHUDScene.buildRoster).
const scoutDef: UnitDef = {
  name: "Scout",
  ico: "\u{1F41C}",
  hp: 40, // fragile — a sniped scout = a killed command
  atk: 1, // unused (never attacks)
  spd: 1.3, // fast: "runs forward" with/ahead of the herd
  range: 16,
  atkRate: 0.5,
  cost: 15, // cheap — the command's economy cost
  cap: 1,
  reward: 8,
  w: 14,
  h: 12,
  trait: "scout",
  role: "support",
  desc: "Pheromone Scout",
  route: "land",
  attackRange: "melee",
  tier: 0,
  incubation: 2,
  caste: "worker",
  defaultAbility: "jaw_strike", // required by the type; never fires for a worker
  geneline: "normal", // white-ish via the normal palette (resolveColors geneline fallback)
};

// The Gatherer — the worker's ECONOMY job (Forage system): runs a harvest loop
// between the hive and a nectar bloom, carrying nectar home. Non-combatant and
// killable mid-trip — the carried nectar dies with it, so the gather line is
// raidable (eco counterplay). White-bodied like all normals; it reads as
// "economy" via the gold nectar load on its back while hauling (drawWorker's
// carry visual). Uses the plain worker silhouette (drawWorker, trait
// 'gatherer'); the Scout is a distinct courier (draws/scout.ts).
const gathererDef: UnitDef = {
  name: "Gatherer",
  ico: "\u{1F36F}",
  hp: 35, // fragile — a sniped carrier = lost nectar
  atk: 1, // unused (never attacks)
  spd: 1.2, // brisk — trip time IS the income rate
  range: 16,
  atkRate: 0.5,
  cost: 30, // the eco investment; pays back over trips if it survives
  cap: 1,
  reward: 10,
  w: 13,
  h: 11,
  trait: "gatherer",
  role: "support",
  desc: "Nectar Gatherer",
  route: "land",
  attackRange: "melee",
  tier: 0,
  incubation: 2,
  caste: "worker",
  defaultAbility: "jaw_strike", // required by the type; never fires for a worker
  geneline: "normal", // white-ish via the normal palette; the gold is the carried nectar load
};

// The Builder — the worker's CONSTRUCTION job. Spawned by placing a building
// (GameManager.placeBuilding), it walks to the placement site and constructs it
// over the building's buildTime, then retires. Non-combatant and killable mid-
// trip — killing it STALLS construction (the half-built shell sits, destructible).
// cost 0 (the building's nectar covers it); cap 1 — it takes a capacity slot
// while alive, so buildings trade against army size. Driven by the Buildings
// manager (which dispatches + retires it), not Forage.
const builderDef: UnitDef = {
  name: "Builder",
  ico: "\u{1F528}", // hammer
  hp: 45, // fragile — a sniped builder stalls the build
  atk: 1, // unused (never attacks)
  spd: 1.1, // brisk — trip time delays the build
  range: 16,
  atkRate: 0.5,
  cost: 0, // spawned by placeBuilding; the building's nectar cost covers it
  cap: 1, // takes a capacity slot while alive — buildings compete with army size (strategic)
  reward: 8,
  w: 14,
  h: 12,
  trait: "builder",
  role: "support",
  desc: "Construction Worker",
  route: "land",
  attackRange: "melee",
  tier: 0,
  incubation: 2,
  caste: "worker",
  defaultAbility: "jaw_strike", // required by the type; never fires for a worker
  geneline: "normal",
};

export const units: Record<string, UnitModule> = {
  scout: { def: scoutDef, draw: drawScout },
  gatherer: { def: gathererDef, draw: drawWorker },
  builder: { def: builderDef, draw: drawBuilder },
};
