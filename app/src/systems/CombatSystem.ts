import Phaser from 'phaser';
import type { DamageType, DamageColorMap, CombatHooks, CombatContext, IUnit, IParticleManager, IAudioManager, HitSoundType } from '../types';
import { BASE_W, WORLD_W, GND, S } from '../config/Constants';
import { COMBAT_MAP } from '../units/registry';
import { BaseStructure } from '../entities/BaseStructure';
import { AudioManager } from './AudioManager';
import { EventBus } from './EventBus';
const SBW: number = Math.round(BASE_W * S); // scaled base width

// Consistent damage indicator colors by type
const DMG_COLORS: DamageColorMap = {
  melee:  0xf04040,  // red — physical melee
  ranged: 0xf0a030,  // orange — ranged shots
  aoe:    0xffcc20,  // yellow — area/explosion
  poison: 0x60e030,  // green — poison DOT
  burn:   0xff6010,  // fire orange — burn DOT
  heal:   0x60f880,  // green — healing
  gold:   0xf0c040,  // gold — reward
  blocked:0x5ac8f8,  // blue — blocked/shielded
  base:   0xf05050,  // red — base damage
};

export class CombatSystem {
  scene: Phaser.Scene;
  events: EventBus;
  audio: AudioManager | null;
  _lastHitSound: number;
  _lastHealSound: number;
  _lastAttacker: IUnit | null;

  constructor(scene: Phaser.Scene, events: EventBus) {
    this.scene = scene;
    this.events = events;
    this.audio = null;
    this._lastHitSound = 0;
    this._lastHealSound = 0;
    this._lastAttacker = null;
  }

  resolve(units: IUnit[], dt: number, playerBase: BaseStructure, enemyBase: BaseStructure, particles: IParticleManager | null, wallActive: number, audio: AudioManager | null): void {
    const alive = units.filter(u => !u.dead);
    this.audio = audio;

    // Shared context passed to all combat hooks
    const ctx: CombatContext = {
      particles,
      audio,
      scene: this.scene,
      events: this.events,
      allAlive: alive,
      S,
      hitUnit: (target: IUnit, dmg: number, dmgType: DamageType) => this.hitUnit(target, dmg, dmgType, ctx),
      playHitSound: (type: HitSoundType) => this._playHitSound(audio, type),
    };

    alive.forEach(u => {
      u.update(dt);
      const handler = COMBAT_MAP[u.trait];

      // One-time spawn hook
      if (!u._spawned) {
        u._spawned = true;
        if (handler && handler.onSpawn) handler.onSpawn(u, ctx);
      }

      // Apply knockback velocity (smooth push) — skip normal AI while sliding
      if (u.knockback !== 0) {
        u.x += u.knockback * dt;
        u.knockback *= Math.pow(0.04, dt);
        if (Math.abs(u.knockback) < 5) u.knockback = 0;
        // Knockback interrupts foreswing — attack resets, no damage
        if (u._swinging) { u._swinging = false; u.foreswingTimer = 0; }
        u.backswingTimer = 0;
        return; // staggered — no movement or attacks while knocked back
      }

      // Stunned — skip all AI
      if (u.stunTimer > 0) {
        u.state = 'march'; // idle visually
        if (u._swinging) { u._swinging = false; u.foreswingTimer = 0; }
        return;
      }

      // Status effect DOTs (generic, not trait-specific)
      this._processStatusEffects(u, dt, ctx);

      // Passive update hook (healer, regen, summon, burrow movement, etc.)
      if (handler && handler.onUpdate) {
        const skipAI = handler.onUpdate(u, dt, ctx);
        if (skipAI) return; // handler took full control (e.g. burrowed)
      }

      // Find foe in attack range
      const foes = alive.filter(e => e.side !== u.side && !e.dead);
      const { target, dist } = this._findTarget(u, foes);

      if (target) {
        u.startAttack();

        if (u.foreswingTimer > 0) {
          // Still winding up — wait
        } else if (u._swinging) {
          // Foreswing just completed — DEAL DAMAGE
          u._swinging = false;

          const baseAtk = (handler && handler.getAtk) ? handler.getAtk(u) : u.atk;
          const dmg = Math.max(1, baseAtk + ((Math.random() * 6) | 0) - 3);

          this._lastAttacker = u;
          if (handler && handler.onAttack) {
            handler.onAttack(u, target, foes, dmg, ctx);
          } else {
            const hitType: DamageType = u.range >= 50 ? 'ranged' : 'melee';
            this.hitUnit(target, dmg, hitType, ctx);
            this._playHitSound(audio, hitType);
          }
          this._lastAttacker = null;

          // Cooldown = total interval minus foreswing (already elapsed)
          u.atkCd = (1 / u.atkRate) - u.foreswing;
          u.backswingTimer = u.backswing;

          if (handler && handler.afterHit && target && !target.dead) {
            handler.afterHit(u, target, dmg, ctx);
          }
        } else if (u.canAttack() && u.backswingTimer <= 0) {
          // Start new attack cycle — begin foreswing
          u.foreswingTimer = u.foreswing;
          u._swinging = true;
        }
      } else {
        // March
        u.state = 'march';
        const spd = u.getSpeed();
        u.x += u.facing * spd * 60 * dt;

        // Player unit reaches enemy base edge — stop
        if (u.side === 'player' && u.x + u.unitW >= WORLD_W - SBW) {
          u.x = WORLD_W - SBW - u.unitW;
        }

        // Enemy unit reaches player base — attack it
        if (u.side === 'enemy' && u.x <= SBW) {
          u.x = SBW;
          u.startAttack();

          if (u.foreswingTimer > 0) {
            // Winding up
          } else if (u._swinging) {
            // Foreswing done — hit base
            u._swinging = false;
            const baseAtk = (handler && handler.getAtk) ? handler.getAtk(u) : u.atk;
            const dmg = Math.max(1, baseAtk + ((Math.random() * 4) | 0));
            const actualDmg = wallActive > 0 ? 0 : dmg;
            playerBase.setHp(playerBase.hp - actualDmg);
            if (wallActive > 0) {
              if (particles) particles.float(SBW / 2, GND - 40, 'BLOCKED!', DMG_COLORS.blocked);
            } else {
              playerBase.flash(0.2);
              if (particles) particles.float(SBW / 2, GND - 40, `-${dmg}`, DMG_COLORS.base);
            }
            if (particles) particles.burst(SBW - 2, GND - 20, u.col, 4);
            u.atkCd = (1 / u.atkRate) - u.foreswing;
            u.backswingTimer = u.backswing;
          } else if (u.canAttack() && u.backswingTimer <= 0) {
            u.foreswingTimer = u.foreswing;
            u._swinging = true;
          }
        } else {
          // Not attacking base either — cancel any foreswing
          if (u._swinging) { u._swinging = false; u.foreswingTimer = 0; }
        }
      }
    });
  }

  // --- Generic status effect DOTs (applied to any unit regardless of trait) ---
  _processStatusEffects(u: IUnit, dt: number, ctx: CombatContext): void {
    if (u.poisonTimer > 0) {
      u.poisonDmgAcc = (u.poisonDmgAcc || 0) + dt;
      if (u.poisonDmgAcc >= 1) {
        u.poisonDmgAcc = 0;
        this.hitUnit(u, 5, 'poison', ctx);
      }
    }
    if (u.burnTimer > 0) {
      u.burnDmgAcc = (u.burnDmgAcc || 0) + dt;
      if (u.burnDmgAcc >= 0.5) {
        u.burnDmgAcc = 0;
        this.hitUnit(u, 5, 'burn', ctx);
      }
    }
  }

  // --- Target finding ---
  _findTarget(u: IUnit, foes: IUnit[]): { target: IUnit | null; dist: number } {
    let target: IUnit | null = null;
    let bestDist = Infinity;
    foes.forEach(e => {
      if (e.burrowed) return;
      const dist = u.facing > 0
        ? (e.x - (u.x + u.unitW))
        : (u.x - (e.x + e.unitW));
      const absDist = Math.max(0, dist);
      if (absDist <= u.range && dist > -(e.unitW + u.unitW) && absDist < bestDist) {
        bestDist = absDist;
        target = e;
      }
    });
    return { target, dist: bestDist };
  }

  // --- Damage application with modifier hooks ---
  hitUnit(u: IUnit, dmg: number, dmgType: DamageType, ctx: CombatContext): void {
    if (u.dead || u.burrowed) return;
    const col = DMG_COLORS[dmgType] || DMG_COLORS.melee;

    // Aura-type ally damage reduction: check all allies for modifyAllyDamage hook
    if (ctx.allAlive) {
      ctx.allAlive.forEach(ally => {
        if (ally.side === u.side && ally !== u && !ally.dead) {
          const allyHandler = COMBAT_MAP[ally.trait];
          if (allyHandler && allyHandler.modifyAllyDamage) {
            dmg = allyHandler.modifyAllyDamage(ally, u, dmg, ctx);
          }
        }
      });
    }

    // Self damage modifier (shield absorption, etc.)
    const selfHandler = COMBAT_MAP[u.trait];
    if (selfHandler && selfHandler.modifyDamage) {
      dmg = selfHandler.modifyDamage(u, dmg, ctx);
    }

    u.takeDamage(dmg);

    // Poise accumulation — only from direct combat damage, not DOTs
    if (dmgType === 'melee' || dmgType === 'ranged' || dmgType === 'aoe') {
      // attacker knockForce is passed via the force parameter, default to dmg
      const force = (this._lastAttacker?.knockForce ?? dmg) - u.knockResist;
      if (force > 0) {
        u.poiseAccum += force;
        if (u.poiseAccum >= 100) {
          // Stagger! Distance scales with overflow
          const overflow = u.poiseAccum - 100;
          u.poiseAccum = 0;
          const knockDist = (100 + overflow * 0.5) * ctx.S;
          if (Math.abs(u.knockback) < 10) {
            u.knockback = -u.facing * knockDist;
            if (ctx.particles) {
              ctx.particles.float(u.x + u.unitW / 2, u.y - 14, 'STAGGER!', 0xffaa30);
            }
          }
        }
      }
    }

    if (ctx.particles) {
      ctx.particles.float(u.x + u.unitW / 2, u.y - 6, `-${dmg}`, col);
      ctx.particles.burst(u.x + u.unitW / 2, u.y + u.unitH / 2, col, 4);
    }

    if (u.dead) {
      if (ctx.particles) {
        ctx.particles.burst(u.x + u.unitW / 2, u.y + u.unitH / 2, u.col, 14);
      }
      const isBoss = u.trait === 'boss' || u.trait === 'boss_summon' || u.trait === 'boss_regen';
      if (this.audio) {
        if (isBoss) this.audio.bossDeath();
        else this.audio.unitDeath();
      }

      // onDeath hook (explosion, etc.)
      const handler = COMBAT_MAP[u.trait];
      if (handler && handler.onDeath) {
        handler.onDeath(u, ctx);
      }

      // Gold reward for killing enemies
      if (u.side === 'enemy') {
        this.events.emit('enemyKilled', { unit: { key: u.key, reward: u.reward, x: u.x, y: u.y } });
        if (ctx.particles) {
          ctx.particles.float(u.x + u.unitW / 2, u.y - 18, `+${u.reward}\u2B21`, DMG_COLORS.gold);
        }
      }
    }
  }

  _playHitSound(audio: AudioManager | null, type: DamageType | HitSoundType): void {
    if (!audio) return;
    const now = performance.now();
    if (now - this._lastHitSound < 80) return;
    this._lastHitSound = now;
    if (type === 'heal') {
      if (now - this._lastHealSound > 500) {
        this._lastHealSound = now;
        audio.heal();
      }
      return;
    }
    if (type === 'aoe') audio.aoeHit();
    else if (type === 'ranged') audio.rangedShot();
    else audio.meleeHit();
  }
}
