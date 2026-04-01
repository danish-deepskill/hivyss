import type { UnitDef, CombatHooks, UnitModule } from "../types";
import { getGroundY } from "../config/RouteMatrix";
import drawGrub from "../draws/grub";
import drawZephyr from "../draws/zephyr";
import drawAphid from "../draws/aphid";
import drawBeetle from "../draws/beetle";
import drawDigger from "../draws/digger";
import drawEmber from "../draws/ember";
import drawGuardian from "../draws/guardian";
import drawMantis from "../draws/mantis";
import drawRhino from "../draws/rhino";
import drawVoltfly from "../draws/voltfly";

// --- Grub ---
const grubDef: UnitDef = {
  name: "Grub",
  ico: "\u{1F41B}",
  hp: 55,
  atk: 12,
  spd: 2.28,
  range: 28,
  atkRate: 1.1,
  cost: 15,
  reward: 8,
  w: 23,
  h: 20,
  primary: 0x80d040,
  secondary: 0x3a6010,
  trait: "grub",
  desc: "Fodder",
  route: "land",
  attackRange: "melee",
  tier: "F",
  incubation: 2,
  caste: "soldier",
};

// --- Zephyr ---
const zephyrDef: UnitDef = {
  name: "Zephyr",
  ico: "\u{1F4A8}",
  hp: 40,
  atk: 40,
  spd: 4.98,
  range: 26,
  atkRate: 1.2,
  cost: 40,
  reward: 15,
  w: 18,
  h: 17,
  primary: 0x80f8c0,
  secondary: 0x208050,
  trait: "swift",
  desc: "Very Fast",
  route: "land",
  attackRange: "melee",
  tier: "E",
  incubation: 3,
  caste: "soldier",
};

// --- Aphid ---
const aphidDef: UnitDef = {
  name: "Aphid",
  ico: "\u{1F33F}",
  hp: 120,
  atk: 8,
  spd: 1.14,
  range: 85,
  atkRate: 0.6,
  cost: 50,
  reward: 25,
  w: 23,
  h: 21,
  primary: 0xf060c0,
  secondary: 0x801060,
  trait: "healer",
  desc: "Heals Allies",
  route: "land",
  attackRange: "ranged",
  tier: "D",
  incubation: 8,
  knockResist: 5,
  caste: "soldier",
};

// --- Beetle ---
const beetleDef: UnitDef = {
  name: "Beetle",
  ico: "\u{1F6E1}\uFE0F",
  hp: 450,
  atk: 30,
  spd: 1.0,
  range: 78,
  atkRate: 0.55,
  cost: 120,
  reward: 55,
  w: 31,
  h: 27,
  primary: 0x6090c0,
  secondary: 0x304060,
  trait: "shield_poison",
  desc: "Shield + Poison",
  route: "land",
  attackRange: "melee",
  tier: "C",
  incubation: 15,
  knockResist: 25,
  caste: "soldier",
};

// --- Digger ---
const diggerDef: UnitDef = {
  name: "Digger",
  ico: "\u{1F573}\uFE0F",
  hp: 100,
  atk: 35,
  spd: 3.56,
  range: 28,
  atkRate: 1.0,
  cost: 55,
  reward: 20,
  w: 20,
  h: 18,
  primary: 0xc09050,
  secondary: 0x604020,
  trait: "burrow",
  desc: "Burrows Past",
  route: "tunnel",
  attackRange: "melee",
  tier: "D",
  incubation: 7,
  caste: "soldier",
};

// --- Ember ---
const emberDef: UnitDef = {
  name: "Ember",
  ico: "\u{1F525}",
  hp: 80,
  atk: 40,
  spd: 1.85,
  range: 43,
  atkRate: 0.8,
  cost: 65,
  reward: 28,
  w: 21,
  h: 20,
  primary: 0xf08020,
  secondary: 0xa04008,
  trait: "burn",
  desc: "Burns Foes",
  route: "land",
  attackRange: "melee",
  tier: "D",
  incubation: 8,
  knockForce: 10,
  caste: "soldier",
};

// --- Guardian ---
const guardianDef: UnitDef = {
  name: "Guardian",
  ico: "\u{1F6E1}\uFE0F",
  hp: 300,
  atk: 15,
  spd: 1.0,
  range: 36,
  atkRate: 0.5,
  cost: 70,
  reward: 35,
  w: 31,
  h: 28,
  primary: 0xe0c040,
  secondary: 0x806020,
  trait: "aura",
  desc: "-20% Ally DMG",
  route: "land",
  attackRange: "melee",
  tier: "D",
  incubation: 10,
  knockResist: 20,
  caste: "soldier",
};

// --- Mantis ---
const mantisDef: UnitDef = {
  name: "Mantis",
  ico: "\u{1F52D}",
  hp: 100,
  atk: 120,
  spd: 0.71,
  range: 284,
  atkRate: 0.25,
  cost: 85,
  reward: 38,
  w: 21,
  h: 20,
  primary: 0xc0a0f0,
  secondary: 0x503080,
  trait: "sniper",
  desc: "Long Range",
  route: "land",
  attackRange: "ranged",
  tier: "C",
  incubation: 14,
  caste: "soldier",
};

// --- Rhino ---
const rhinoDef: UnitDef = {
  name: "Rhino",
  ico: "\u{1F98F}",
  hp: 280,
  atk: 45,
  spd: 1.42,
  range: 34,
  atkRate: 0.7,
  cost: 95,
  reward: 42,
  w: 57,
  h: 34,
  primary: 0x908060,
  secondary: 0x504030,
  trait: "knockback",
  desc: "Rams Enemies",
  route: "land",
  attackRange: "melee",
  tier: "C",
  incubation: 13,
  caste: "soldier",
  knockForce: 100,
  knockResist: 30,
};

// --- Voltfly ---
const voltflyDef: UnitDef = {
  name: "Voltfly",
  ico: "\u{26A1}",
  hp: 240,
  atk: 55,
  spd: 1.56,
  range: 128,
  atkRate: 0.6,
  cost: 130,
  reward: 50,
  w: 24,
  h: 21,
  primary: 0x40c0f0,
  secondary: 0x1060a0,
  trait: "lightning",
  desc: "Chain Lightning",
  route: "land",
  attackRange: "ranged",
  tier: "B",
  incubation: 18,
  knockForce: 20,
  knockResist: 10,
  caste: "elite",
};

// --- Combat Hooks ---

const aphidCombat: CombatHooks = {
  onUpdate(u, dt, ctx) {
    // Heal nearest wounded ally every 2 seconds
    u.healTimer = (u.healTimer || 0) + dt;
    if (u.healTimer >= 2) {
      u.healTimer = 0;
      const allies = ctx.allAlive.filter(
        (a) => a.side === u.side && a !== u && a.hp < a.maxHp,
      );
      if (allies.length > 0) {
        const nearest = allies.reduce((a, b) =>
          Math.abs(a.x - u.x) < Math.abs(b.x - u.x) ? a : b,
        );
        const healAmt = nearest.heal(20);
        if (healAmt > 0) {
          if (ctx.particles)
            ctx.particles.float(
              nearest.x + nearest.unitW / 2,
              nearest.y - 8,
              `+${healAmt}`,
              0x60f880,
            );
          ctx.playHitSound("heal");
        }
      }
    }
    return false; // doesn't skip normal AI
  },
};

const beetleCombat: CombatHooks = {
  modifyDamage(u, dmg, ctx) {
    // Shield: absorb 50% damage for first 3 seconds
    if (u.shieldAbsorbTimer === undefined) u.shieldAbsorbTimer = 3;
    if (u.shieldAbsorbTimer > 0) return Math.ceil(dmg * 0.5);
    return dmg;
  },
  afterHit(u, target, dmg, ctx) {
    // Poison on hit
    target.poisonTimer = 3;
    target.poisonDmgAcc = 0;
  },
};

const diggerCombat: CombatHooks = {
  onSpawn(u, ctx) {
    u.burrowed = true;
    u.burrowTimer = 5; // max burrow time (safety cap)
  },
  onUpdate(u, dt, ctx) {
    if (!u.burrowed) return false; // not handled, proceed normally
    u.burrowTimer -= dt;
    u.x += u.facing * u.getSpeed() * 60 * dt * 1.5;

    // Surface once past at least one enemy, or safety timer expires
    const foes = ctx.allAlive.filter((e) => e.side !== u.side && !e.dead);
    const gap = 43; // surface a short distance behind the enemy
    const passed = foes.some((e) => (u.x - e.x) * u.facing > gap);

    if (passed || u.burrowTimer <= 0) {
      u.burrowed = false;
      u.currentRoute = "land"; // surface onto land route
      u.y = getGroundY("land") - u.unitH; // move to land Y
      u.ambush = true; // first hit deals critical damage
      if (ctx.particles) {
        ctx.particles.burst(
          u.x + u.unitW / 2,
          u.y + u.unitH / 2,
          u.primary,
          10,
        );
        ctx.particles.float(u.x + u.unitW / 2, u.y - 14, "SURFACE!", 0x906030);
      }
    }
    return true; // handled, skip normal AI
  },
  getAtk(u) {
    if (u.ambush) return u.atk * 2; // ambush crit
    return u.atk;
  },
  afterHit(u, _target, dmg, ctx) {
    if (u.ambush) {
      u.ambush = false;
      if (ctx.particles) {
        ctx.particles.float(u.x + u.unitW / 2, u.y - 14, "AMBUSH!", 0xff4444);
      }
    }
  },
};

const emberCombat: CombatHooks = {
  afterHit(u, target, dmg, ctx) {
    // Spread burn to up to 3 nearby enemies
    const foes = ctx.allAlive
      .filter(
        (e) =>
          e.side !== u.side &&
          !e.dead &&
          !e.burrowed &&
          Math.abs(e.x + e.unitW / 2 - (target.x + target.unitW / 2)) < 85,
      )
      .sort((a, b) => Math.abs(a.x - target.x) - Math.abs(b.x - target.x))
      .slice(0, 3);
    foes.forEach((e) => {
      e.burnTimer = 8;
      e.burnDmgAcc = 0;
    });
  },
};

const guardianCombat: CombatHooks = {
  modifyAllyDamage(auraUnit, target, dmg, ctx) {
    // Reduce damage to nearby allies by 20%
    if (
      Math.abs(
        auraUnit.x + auraUnit.unitW / 2 - (target.x + target.unitW / 2),
      ) < 114
    ) {
      return Math.ceil(dmg * 0.8);
    }
    return dmg;
  },
};

const mantisCombat: CombatHooks = {
  onAttack(u, target, foes, dmg, ctx) {
    // Piercing shot hits up to 2 enemies, second at 50% damage
    const targets = foes
      .filter((e) => {
        if (e.burrowed) return false;
        const d = u.facing > 0 ? e.x - (u.x + u.unitW) : u.x - (e.x + e.unitW);
        return Math.max(0, d) <= u.range;
      })
      .sort((a, b) => {
        const da = u.facing > 0 ? a.x - u.x : u.x - a.x;
        const db = u.facing > 0 ? b.x - u.x : u.x - b.x;
        return da - db;
      })
      .slice(0, 2);
    targets.forEach((e, i) =>
      ctx.hitUnit(e, i === 0 ? dmg : Math.ceil(dmg * 0.5), "ranged"),
    );
    ctx.playHitSound("ranged");
  },
};

const voltflyCombat: CombatHooks = {
  onAttack(u, target, foes, dmg, ctx) {
    // Chain lightning: hit primary + up to 2 nearby foes
    u.hitCount = (u.hitCount || 0) + 1;
    const isOvercharge = u.hitCount % 4 === 0;
    const chainDmg = isOvercharge ? dmg * 2 : dmg;
    const chainTargets = [target];

    const chainRange = 114;
    const others = foes
      .filter(
        (e) =>
          e !== target &&
          !e.burrowed &&
          !e.dead &&
          Math.abs(e.x - target.x) <= chainRange,
      )
      .sort((a, b) => Math.abs(a.x - target.x) - Math.abs(b.x - target.x));
    if (others[0]) chainTargets.push(others[0]);
    if (others[1]) chainTargets.push(others[1]);

    const dmgScale = [1.0, 0.7, 0.4];
    chainTargets.forEach((t, i) => {
      const d = Math.max(1, Math.round(chainDmg * dmgScale[i]));
      ctx.hitUnit(t, d, "ranged");
      // 25% stun per target
      if (!t.dead && Math.random() < 0.25) {
        t.stunTimer = 0.6;
        if (ctx.particles)
          ctx.particles.float(
            t.x + t.unitW / 2,
            t.y - 18,
            "STUNNED!",
            0x80ffff,
          );
      }
      // Chain arc particles
      if (i > 0 && ctx.particles) {
        const prev = chainTargets[i - 1];
        ctx.particles.burst(
          (prev.x + t.x) / 2 + (prev.unitW + t.unitW) / 4,
          (prev.y + t.y) / 2,
          0x80ffff,
          3,
        );
      }
    });
    if (isOvercharge && ctx.particles) {
      ctx.particles.float(u.x + u.unitW / 2, u.y - 18, "OVERCHARGE!", 0xffff40);
    }
    ctx.playHitSound("aoe");
  },
};

// --- Export as UnitModule records ---
export const units: Record<string, UnitModule> = {
  grub: { def: grubDef, draw: drawGrub },
  zephyr: { def: zephyrDef, draw: drawZephyr },
  aphid: { def: aphidDef, combat: aphidCombat, draw: drawAphid },
  beetle: { def: beetleDef, combat: beetleCombat, draw: drawBeetle },
  digger: { def: diggerDef, combat: diggerCombat, draw: drawDigger },
  ember: { def: emberDef, combat: emberCombat, draw: drawEmber },
  guardian: { def: guardianDef, combat: guardianCombat, draw: drawGuardian },
  mantis: { def: mantisDef, combat: mantisCombat, draw: drawMantis },
  rhino: { def: rhinoDef, draw: drawRhino },
  voltfly: { def: voltflyDef, combat: voltflyCombat, draw: drawVoltfly },
};
