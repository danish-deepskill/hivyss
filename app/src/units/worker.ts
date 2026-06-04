import type { UnitDef, UnitModule } from "../types";
import { PALETTES } from "../config/Palettes";
import drawScout from "../draws/scout";

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
  palette: PALETTES.normal,
  geneline: "normal",
};

export const units: Record<string, UnitModule> = {
  scout: { def: scoutDef, draw: drawScout },
};
