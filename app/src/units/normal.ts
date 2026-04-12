// Normal geneline — baseline (universal) units, no special palette.
// Designed for AI Lab testing: clean tier curve (T1-T4), role coverage at every
// tier, deliberate speed/cost spreads. 11 units, 3-3-3-2 across tiers.
//
// Naming follows Vyssid Naming Convention (GAME_DESIGN.md §Vyssid Naming):
// universal/plain insect-feel names, no military ranks, no fantasy terms.

import type { UnitDef, CombatHooks, UnitModule } from "../types";
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

// =========================================================
// TIER 1 — Baseline (15-30n) — available to D1 hives
// Roles: tank, dps, ranged (no support yet)
// =========================================================

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
};

// =========================================================
// TIER 2 — Extended baseline (40-55n) — D2 hives gain these
// Adds: support role, glass-cannon dps, mid tank
// =========================================================

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
};

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
};

// =========================================================
// TIER 3 — Specialists (70-90n) — D3 hives gain these
// Adds: AOE dps, sniper ranged, aura support
// =========================================================

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
};

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
};

// =========================================================
// TIER 4 — Elites (110-130n) — D4 hives gain these
// =========================================================

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
};

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
};

// =========================================================
// Combat Hooks
// =========================================================

const mendwingCombat: CombatHooks = {
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
    return false;
  },
};

const cinderflyCombat: CombatHooks = {
  afterHit(u, target, _dmg, ctx) {
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

const longeyeCombat: CombatHooks = {
  onAttack(u, _target, foes, dmg, ctx) {
    // Piercing shot — hits up to 2 enemies, second at 50% damage
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

const wardlingCombat: CombatHooks = {
  modifyAllyDamage(auraUnit, target, dmg, _ctx) {
    // Allies within ~114px take 20% less damage
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

const stormflyCombat: CombatHooks = {
  onAttack(u, target, foes, dmg, ctx) {
    // Chain lightning: hit primary + up to 2 nearby foes, every 4th hit overcharges
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
      if (!t.dead && Math.random() < 0.25) {
        t.stunTimer = 0.6;
        if (ctx.particles)
          ctx.particles.float(t.x + t.unitW / 2, t.y - 18, "STUNNED!", 0x80ffff);
      }
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

// =========================================================
// Export — ordered by tier for AI Lab roster planning
// =========================================================

export const units: Record<string, UnitModule> = {
  // T1 — Baseline (15-30n)
  hardshell: { def: hardshellDef, draw: drawHardshell },
  grub: { def: grubDef, draw: drawGrub },
  pricker: { def: prickerDef, draw: drawPricker },

  // T2 — Extended baseline (40-55n)
  domeback: { def: domebackDef, draw: drawDomeback },
  skitterling: { def: skitterlingDef, draw: drawSkitterling },
  mendwing: { def: mendwingDef, combat: mendwingCombat, draw: drawMendwing },

  // T3 — Specialists (70-90n)
  cinderfly: { def: cinderflyDef, combat: cinderflyCombat, draw: drawCinderfly },
  longeye: { def: longeyeDef, combat: longeyeCombat, draw: drawLongeye },
  wardling: { def: wardlingDef, combat: wardlingCombat, draw: drawWardling },

  // T4 — Elites (110-130n)
  bashguard: { def: bashguardDef, draw: drawBashguard },
  stormfly: { def: stormflyDef, combat: stormflyCombat, draw: drawStormfly },
};
