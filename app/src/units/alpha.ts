import type { UnitDef, CombatHooks, UnitModule } from "../types";
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

// --- Grunt ---
const gruntDef = alphaDef({
  name: "Grunt",
  ico: "\u{1F6E1}\uFE0F",
  hp: 90,
  atk: 20,
  spd: 1.4,
  range: 20,
  atkRate: 1.0,
  cost: 25,
  reward: 12,
  w: 20,
  h: 18,
  trait: "grunt",
  desc: "Basic Soldier",
  route: "land",
  attackRange: "melee",
  tier: 1,
  incubation: 3,
  caste: "soldier",
});

// --- Mandible ---
const mandibleDef = alphaDef({
  name: "Mandible",
  ico: "\u{1F41C}",
  hp: 140,
  atk: 32,
  spd: 1.2,
  range: 22,
  atkRate: 0.9,
  cost: 40,
  reward: 18,
  w: 18,
  h: 16,
  trait: "basic",
  desc: "Balanced",
  route: "land",
  attackRange: "melee",
  tier: 2,
  incubation: 4,
  knockResist: 5,
  caste: "soldier",
});

// --- Bombardier ---
const bombardierDef = alphaDef({
  name: "Bombardier",
  ico: "\u{1F4A5}",
  hp: 100,
  atk: 28,
  spd: 1.6,
  range: 22,
  atkRate: 0.85,
  cost: 60,
  reward: 28,
  w: 24,
  h: 20,
  trait: "area",
  desc: "Area ATK",
  route: "land",
  attackRange: "melee",
  tier: 3,
  incubation: 5,
  knockForce: 15,
  caste: "soldier",
});

// --- Needler ---
const needlerDef = alphaDef({
  name: "Needler",
  ico: "\u{1F3AF}",
  hp: 75,
  atk: 42,
  spd: 0.9,
  range: 90,
  atkRate: 0.75,
  cost: 50,
  reward: 22,
  w: 22,
  h: 18,
  trait: "ranged",
  desc: "Ranged",
  route: "land",
  attackRange: "ranged",
  tier: 2,
  incubation: 5,
  caste: "soldier",
});

// --- Legionnaire ---
const legionnaireDef = alphaDef({
  name: "Legionnaire",
  ico: "\u{1FAB2}",
  hp: 800,
  atk: 18,
  spd: 0.6,
  range: 10,
  atkRate: 0.5,
  cost: 85,
  reward: 40,
  w: 30,
  h: 22,
  trait: "massive",
  desc: "Massive HP",
  route: "land",
  attackRange: "melee",
  tier: 3,
  incubation: 7,
  knockForce: 20,
  knockResist: 40,
  caste: "soldier",
});

// --- Ravager ---
const ravagerDef = alphaDef({
  name: "Ravager",
  ico: "\u{1F41D}",
  hp: 160,
  atk: 60,
  spd: 2.2,
  range: 20,
  atkRate: 1.25,
  cost: 70,
  reward: 32,
  w: 22,
  h: 18,
  trait: "berserk",
  desc: "Rage SPD",
  route: "air",
  attackRange: "melee",
  tier: 3,
  incubation: 6,
  caste: "soldier",
});

// --- Centurion ---
const centurionDef = alphaDef({
  name: "Centurion",
  ico: "\u{2694}\uFE0F",
  hp: 250,
  atk: 26,
  spd: 0.9,
  range: 24,
  atkRate: 0.8,
  cost: 100,
  reward: 48,
  w: 26,
  h: 22,
  trait: "rally",
  desc: "+20% Ally ATK",
  route: "land",
  attackRange: "melee",
  tier: 4,
  incubation: 8,
  knockResist: 15,
  caste: "soldier",
});

const AURA_RANGE = 80;

// --- Combat Hooks ---

const bombardierCombat: CombatHooks = {
  onDeath(u, ctx) {
    // Explode on death, hitting up to 5 nearby foes for 65 damage
    const foes = ctx.allAlive.filter((e) => e.side !== u.side && !e.dead);
    foes
      .filter(
        (e) => Math.abs(e.x + e.unitW / 2 - (u.x + u.unitW / 2)) < 50 * ctx.S,
      )
      .slice(0, 5)
      .forEach((e) => ctx.hitUnit(e, 65, "aoe"));
    if (ctx.particles) {
      const bx = u.x + u.unitW / 2;
      const by = u.y + u.unitH / 2;
      const pm = ctx.particles as any;
      // Big explosion — fast wide particles + slow lingering embers
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 3 + Math.random() * 5;
        pm.particles.push({
          x: bx,
          y: by,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 2,
          life: 0.8 + Math.random() * 0.5,
          col: [0xffcc20, 0xff8020, 0xff4010][Math.floor(Math.random() * 3)],
          r: 2.5 + Math.random() * 3,
        });
      }
      // Slow rising embers
      for (let i = 0; i < 12; i++) {
        pm.particles.push({
          x: bx + (Math.random() - 0.5) * 20,
          y: by,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -1 - Math.random() * 2,
          life: 1.0 + Math.random() * 0.6,
          col: 0xffaa30,
          r: 1 + Math.random() * 1.5,
        });
      }
      ctx.particles.float(bx, u.y - 14, "BOOM!", 0xffcc20, true);
    }
  },
};

const ravagerCombat: CombatHooks = {
  onUpdate(u, _dt) {
    // Rage: attack rate increases as HP drops
    const base = ravagerDef.atkRate;
    const hpFrac = u.hp / u.maxHp;
    if (hpFrac <= 0.5) u.atkRate = base * 1.5;
    else u.atkRate = base;
    return false;
  },
};

const centurionCombat: CombatHooks = {
  onUpdate(u, _dt, ctx) {
    // Rally aura: up to 5 nearest allies within range get +20% ATK
    const allies = ctx.allAlive
      .filter(
        (a) =>
          a.side === u.side &&
          a !== u &&
          !a.dead &&
          Math.abs(a.x + a.unitW / 2 - (u.x + u.unitW / 2)) <
            AURA_RANGE * ctx.S,
      )
      .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))
      .slice(0, 5);

    for (const a of allies) {
      if (!(a as any)._rallied) {
        (a as any)._baseAtk = (a as any)._baseAtk ?? a.atk;
        a.atk = Math.round((a as any)._baseAtk * 1.2);
        (a as any)._rallied = true;
      }
    }
    // Store buff count so draw can show chevrons
    (u as any).rallyCount = allies.length;
    return false;
  },
  onDeath(u, ctx) {
    // Remove rally buff from all allies when centurion dies
    for (const a of ctx.allAlive) {
      if (a.side === u.side && (a as any)._rallied) {
        a.atk = (a as any)._baseAtk ?? a.atk;
        (a as any)._rallied = false;
      }
    }
  },
};

// --- Export as UnitModule records ---
export const units: Record<string, UnitModule> = {
  grunt: { def: gruntDef, draw: drawGrunt },
  mandible: { def: mandibleDef, draw: drawMandible },
  bombardier: {
    def: bombardierDef,
    combat: bombardierCombat,
    draw: drawBombardier,
  },
  needler: { def: needlerDef, draw: drawNeedler },
  legionnaire: { def: legionnaireDef, draw: drawLegionnaire },
  ravager: { def: ravagerDef, combat: ravagerCombat, draw: drawRavager },
  centurion: {
    def: centurionDef,
    combat: centurionCombat,
    draw: drawCenturion,
  },
};
