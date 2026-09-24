import Phaser from 'phaser';
import type { HitFlavor, DamageColorMap, CombatContext, IUnit, IParticleManager, DamageEvent, HitSoundType, PheromoneZone, PheromoneKind, AbilityDef } from '../types';
import { DEFAULT_WORLD_W, SBW } from '../config/Constants';
import { LANE } from '../config/Layout';
import { canAttack } from '../config/RouteMatrix';
const GND = LANE.land.groundY;
import { HiveStructure } from '../entities/structures/HiveStructure';
import { HiveEntity } from '../entities/structures/HiveEntity';
import { StructureEntity } from '../entities/structures/StructureEntity';
import { AudioManager } from './AudioManager';
import { EventBus } from './EventBus';
import { CombatPipeline } from './CombatPipeline';
import { updateEffects, hasActiveEffect, applyEffect } from './EffectSystem';
import { setDotDispatcher } from '../config/combat/effects/dispatch';
import { terrainEffectAt, dispatchTerrainTick } from './TerrainDispatch';
import { computeReflect } from '../config/combat/reflect';
import { degradeArmor } from '../config/combat/armorDegrade';
import type { CalcTarget } from './CombatPipeline';
import { setStunFxDispatcher, setStaggerFxDispatcher } from '../config/combat/effects/cc';
import { applyModifiers, addModifier } from './ModifierSystem';
import { getResource, addResource } from './ResourceSystem';
import { runSelectorInRange, resolveImpactTarget, signatureWouldWhiff } from './Targeting';
import { resolveRoyalOrder, ROYAL_ARRIVE } from './RoyalControl';
import {
  setHealFxDispatcher,
  setDeathTriggerDispatcher,
  makeDotDispatcher,
  dispatchCastFx,
  dispatchImpactFx,
  dispatchSpawn,
} from './CombatDispatch';
import {
  applyHealPhase,
  setAoeRiderAliveAccessor,
  registerPhase8PostApplyHandlers,
  registerPhase8ModifyHandlers,
} from './CombatPhases';
import { lookupAbility } from '../config/combat/abilities';
import { PASSIVE_HANDLERS, type PassiveTickEnv } from './PassiveHandlers';
import { TRAIL_SPACING, TRAIL_BLOB_RADIUS, TRAIL_BLOB_FADE } from '../config/PheromoneDefs';

// Min gap between hit sounds — a packed herd lands many hits per frame; without
// this throttle they pile into a buzz. Shared by the category + fitted paths.
const HIT_SOUND_THROTTLE_MS = 80;

// Consistent damage indicator colors by type
const DMG_COLORS: DamageColorMap = {
  melee:  0xf04040,  // red — physical melee
  ranged: 0xf0a030,  // orange — ranged shots
  aoe:    0xffcc20,  // yellow — area/explosion
  poison: 0x60e030,  // green — poison DOT
  burn:   0xff6010,  // fire orange — burn DOT
  heal:   0x60f880,  // green — healing
  nectar: 0xf0c040,  // nectar — reward
  blocked:0x5ac8f8,  // blue — blocked/shielded
  base:   0xf05050,  // red — base damage
};

export class CombatSystem {
  scene: Phaser.Scene;
  events: EventBus;
  audio: AudioManager | null;
  worldW: number;
  _lastHitSound: number;
  _lastHealSound: number;
  _lastAttacker: IUnit | null;

  pipeline: CombatPipeline;

  /**
   * Live CombatContext captured at the top of resolve(); cleared at
   * the bottom so stale references can't leak across frames.
   * Subscribers registered at construction read this via closure.
   */
  private _currentCtx: CombatContext | null = null;

  /**
   * Sides with a pending Elite/Royal signature trigger. A player input
   * (sandbox key / HUD button) calls requestSignatures(side), which adds
   * the side here; resolve() drains it right after updatePassives so the
   * signature fires WITH fresh cohesion/aura modifiers in scope and inside
   * the established _currentCtx. Cleared every frame after draining.
   */
  private _pendingSignatureSides = new Set<'player' | 'enemy'>();

  /**
   * Specific unit ids with a pending signature trigger (a per-Elite slot
   * click). Drained alongside _pendingSignatureSides — a unit fires if its
   * side OR its id is pending. Lets the HUD fire one Elite, not all.
   */
  private _pendingSignatureUnits = new Set<number>();

  /**
   * Base entity wrappers, set once by GameManager. Optional so the
   * sandbox (dummy bases without wrappers) keeps working; _findTarget
   * skips base targeting when unset.
   */
  playerBaseEntity: HiveEntity | null = null;
  enemyBaseEntity: HiveEntity | null = null;
  /** Non-base attackable structures (towers / buildings), FLATTENED across every
   *  source for the hot per-unit target scan. Rebuilt only when a source updates. */
  structureTargets: StructureEntity[] = [];
  /** Per-source target lists (key → entities), e.g. 'towers' + 'buildings'. Unioned
   *  into `structureTargets` so multiple managers can coexist without clobbering. */
  private structureSources = new Map<string, StructureEntity[]>();

  constructor(scene: Phaser.Scene, events: EventBus, worldW: number = DEFAULT_WORLD_W) {
    this.scene = scene;
    this.events = events;
    this.audio = null;
    this.worldW = worldW;
    this._lastHitSound = 0;
    this._lastHealSound = 0;
    this._lastAttacker = null;

    this.pipeline = new CombatPipeline();
    // Modify + post_apply registration routes through the helpers so
    // the phase8.test.ts order pins stay meaningful without Phaser.
    // Do not inline.
    registerPhase8ModifyHandlers(this.pipeline);
    this.pipeline.on('pre_apply',  applyHealPhase);
    this.pipeline.on('apply',      (e) => this._applyDamagePhase(e));
    // Reflect (thorns) — return a fraction of a DIRECT hit to the attacker.
    // computeReflect is pure; we queue its result with isReflected=true so the
    // return hit can't itself reflect (the loop break). γ Thornback & kin.
    this.pipeline.on('post_apply', (e) => {
      const r = computeReflect(e);
      if (!r) return;
      const ev = this.pipeline.queueAbility(r.source, r.victim, 'jaw_strike', {
        baseDamageOverride: r.amount,
        legacyHitFlavor: 'melee',
      });
      ev.isReflected = true;
    });
    // Armour-degrade (γ) — PHYSICAL hits wear physical armour. Accumulate soaked
    // damage; when it crosses the unit's `per` threshold, strip sharp/blunt one
    // tier toward normal (degradeArmor is pure; we mutate the live resistance).
    this.pipeline.on('post_apply', (e) => {
      if (e.dmgType !== 'sharp' && e.dmgType !== 'blunt') return; // only physical wears plates
      if (e.finalDamage <= 0) return;
      const t = e.target as CalcTarget & { degradeArmor?: { per: number }; _armorWear?: number };
      if (!t.degradeArmor || t.dead) return;
      const res = degradeArmor(
        t.resistance?.sharp,
        t.resistance?.blunt,
        (t._armorWear ?? 0) + e.finalDamage,
        t.degradeArmor.per,
      );
      t._armorWear = res.wear;
      if (t.resistance) {
        if (res.sharp !== undefined) t.resistance.sharp = res.sharp;
        if (res.blunt !== undefined) t.resistance.blunt = res.blunt;
      }
    });
    registerPhase8PostApplyHandlers(
      this.pipeline,
      (e) => this._applyDeathEffectsPhase(e),
    );

    // DOT dispatcher — burn.onTick and future DOT hooks call
    // dispatchDotDamage, which forwards to this closure.
    setDotDispatcher(makeDotDispatcher({
      getCurrentCtx: () => this._currentCtx,
      getLastAttacker: () => this._lastAttacker,
      setLastAttacker: (u) => { this._lastAttacker = u; },
      queueAbility: (attacker, target, abilityName, opts) => {
        this.pipeline.queueAbility(attacker, target, abilityName, opts);
      },
      resolveFrame: () => { this.pipeline.resolveFrame(); },
    }));

    // Heal FX dispatcher — spawns green "+N" float + heal sound.
    setHealFxDispatcher((target, amount) => {
      const ctx = this._currentCtx;
      if (!ctx) return;
      if (ctx.particles) {
        ctx.particles.float(
          target.x + target.unitW / 2,
          target.y - 8,
          `+${amount}`,
          0x60f880,
        );
      }
      this._playHitSound(this.audio, 'heal');
    });

    // Death-trigger dispatcher — explosion FX + selector + queueAbility
    // per target. Fires once per death from applyDeathTriggerPhase.
    setDeathTriggerDispatcher((dyingUnit, deathAbilityName) => {
      const ctx = this._currentCtx;
      if (!ctx) return;

      const bx = dyingUnit.x + dyingUnit.unitW / 2;
      const by = dyingUnit.y + dyingUnit.unitH / 2;
      if (ctx.particles) {
        // Direct particle push via `as any` — IParticleManager doesn't
        // expose the internal array.
        const pm = ctx.particles as any;
        // 30 fast wide particles
        for (let i = 0; i < 30; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 3 + Math.random() * 5;
          pm.particles.push({
            x: bx, y: by,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s - 2,
            life: 0.8 + Math.random() * 0.5,
            col: [0xffcc20, 0xff8020, 0xff4010][Math.floor(Math.random() * 3)],
            r: 2.5 + Math.random() * 3,
          });
        }
        // 12 slow rising embers
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
      }
      if (ctx.particles) {
        ctx.particles.float(bx, dyingUnit.y - 14, 'BOOM!', 0xffcc20, true);
      }
      this._playHitSound(this.audio, 'aoe');

      const ability = lookupAbility(deathAbilityName);
      const allAlive = ctx.allAlive ?? [];
      const targets = runSelectorInRange(
        ability.targeting!,
        dyingUnit,
        ability,
        allAlive,
      );
      for (const t of targets) {
        this.pipeline.queueAbility(dyingUnit, t as IUnit, deathAbilityName, {
          // Per-ability death damage (β's spore/blast/acid each carry their
          // own); absent → the legacy 65 (death_bomb's original tuning).
          baseDamageOverride: ability.deathDamage ?? 65,
        });
      }
    });

    // AOE rider alive-list accessor — live _currentCtx each call.
    setAoeRiderAliveAccessor(() =>
      (this._currentCtx?.allAlive ?? []) as IUnit[],
    );

    setStunFxDispatcher((target) => {
      const ctx = this._currentCtx;
      if (!ctx || !ctx.particles) return;
      ctx.particles.float(
        target.x + target.unitW / 2,
        target.y - 18,
        'STUNNED!',
        0x80ffff,
      );
    });

    setStaggerFxDispatcher((target) => {
      const ctx = this._currentCtx;
      if (!ctx || !ctx.particles) return;
      ctx.particles.float(
        target.x + target.unitW / 2,
        target.y - 14,
        'STAGGER!',
        0xffaa30,
      );
    });
  }

  /** GameManager calls once at battle setup; sandbox skips. */
  setBaseEntities(player: HiveEntity, enemy: HiveEntity): void {
    this.playerBaseEntity = player;
    this.enemyBaseEntity = enemy;
  }

  /** Register one SOURCE's attackable structures (e.g. 'towers', 'buildings').
   *  Multi-source: re-unions all sources into the flat scan list, so managers
   *  that coexist (towers + buildings in one battle) no longer clobber each other. */
  setStructureTargets(sourceKey: string, structures: StructureEntity[]): void {
    this.structureSources.set(sourceKey, structures);
    this.structureTargets = ([] as StructureEntity[]).concat(...this.structureSources.values());
  }

  /**
   * Queue a player-triggered Elite/Royal signature for every ready unit of
   * `side`. Non-blocking: it only records the request; the actual cast
   * happens at the top of the next resolve() (after passives, inside ctx).
   * Idempotent within a frame — a side already pending stays pending.
   */
  requestSignatures(side: 'player' | 'enemy'): void {
    this._pendingSignatureSides.add(side);
  }

  /** Queue one specific unit's signature (per-Elite slot trigger). */
  requestSignature(unitId: number): void {
    this._pendingSignatureUnits.add(unitId);
  }

  /**
   * Land a signature's effect: queue its ability against in-range targets and
   * emit its cast-FX at the caster (cohesion-scaled). Called either instantly
   * (no animation) or at the lunge peak (telegraphed). Caller resolves the frame.
   */
  private fireSignatureImpact(u: IUnit, ctx: CombatContext, alive: IUnit[]): void {
    if (!u.signatureAbility) return;
    const ability = lookupAbility(u.signatureAbility);
    const targets = runSelectorInRange(ability.targeting, u, ability, alive);
    ctx.sourceUnit = u;
    if (ability.category === 'utility' && ability.appliesEffects && ability.appliesEffects.length > 0) {
      // Buff/utility signature (Primal Roar) — apply its effects directly to the
      // selected in-range allies; no damage pipeline. The caster (the Queen) leads
      // the surge, so she roars herself too (selectors omit self).
      for (const eff of ability.appliesEffects) applyEffect(u, eff, { source: u });
      for (const t of targets) {
        for (const eff of ability.appliesEffects) applyEffect(t as IUnit, eff, { source: u });
      }
    } else {
      for (const t of targets) {
        this.pipeline.queueAbility(u, t as IUnit, u.signatureAbility, {});
      }
    }

    // Generative payload (β): the cast BIRTHS units around the caster —
    // Broodlord's Spawn-Wave, Broodmother's Brood Surge. Substrate-installed
    // dispatcher; no-op in tests.
    if (ability.spawns) {
      const scx = u.x + u.unitW / 2;
      for (let i = 0; i < ability.spawns.count; i++) {
        const offset = (i - (ability.spawns.count - 1) / 2) * 14;
        dispatchSpawn(ability.spawns.key, u.side, scx + offset);
      }
    }

    // Sacrifice payload (β Swarmlord's Tide): CONSUME same-geneline soldier
    // allies in radius — they vanish (eaten: no corpses, no death triggers) —
    // and permanently grow flat atk per body. Sacrifice ≠ death, by design.
    if (ability.sacrifice) {
      const scx = u.x + u.unitW / 2;
      let eaten = 0;
      for (const ally of alive) {
        if (ally === u || ally.side !== u.side || ally.dead) continue;
        if (ally.geneline !== u.geneline) continue;
        if (ally.caste === 'elite' || ally.caste === 'royal' || ally.caste === 'worker') continue;
        if (Math.abs((ally.x + ally.unitW / 2) - scx) > ability.sacrifice.radius) continue;
        ally.kill();
        eaten++;
        ctx.particles?.burst(ally.x + ally.unitW / 2, ally.y + ally.unitH / 2, 0x7aa030, 8);
      }
      if (eaten > 0) {
        // Tide still CONSUMES the whole swarm in radius, but the atk gain is
        // CAPPED: count existing tide stacks and add at most up to `max` (one
        // flat stack per body, mirroring Carrionling's deathFeed). Bounded —
        // not an unbounded permanent snowball.
        const tag = `tide:${u.id}`;
        const have = u.modifiers?.filter(m => m.source === tag).length ?? 0;
        const gained = Math.min(eaten, Math.max(0, ability.sacrifice.max - have));
        for (let k = 0; k < gained; k++) {
          addModifier(u, { stat: 'atk', type: 'flat', value: ability.sacrifice.perUnitAtk, source: tag });
        }
        ctx.particles?.float(scx, u.y - 16, `FEAST ×${eaten}`, 0x9adb3a, true);
      }
    }

    if (ability.fx) {
      dispatchCastFx({
        ability,
        x: u.x + u.unitW / 2,
        y: u.y + u.unitH / 2,
        magnitude: u.cohesionLevel?.().frac ?? 0,
      });
    }
    // Signature sound — bypasses the herd hit-throttle (cooldown-gated, it's a
    // hero beat) and swells with cohesion so a massed Stampede lands heavier.
    if (ability.sfx) {
      ctx.audio?.playSfx(ability.sfx, {
        pitch: this._pitchForUnit(u),
        intensity: u.cohesionLevel?.().frac ?? 0,
      });
    }
  }

  /**
   * One unit's attack-swing state machine for this frame — shared by every
   * attack site (a unit/base target in range, and both base-assault march
   * paths). Drives foreswing → _swinging → impact → backswing/cooldown
   * uniformly:
   *   - winding up            → wait
   *   - foreswing completed    → fire `onImpact()`, then start backswing +
   *                              cooldown (interval − foreswing, already elapsed)
   *   - idle + ready          → begin a new foreswing; `onWindupStart` lets a
   *                              moving-target caller lock the foe at swing-start
   *                              (the base paths skip it — walls don't move)
   * Caller has already established the unit attacks THIS frame. Keeps the
   * 3-state dance + cooldown math in one place instead of copy-pasted per site.
   */
  private tickAttackSwing(u: IUnit, onImpact: () => void, onWindupStart?: () => void): void {
    u.startAttack();
    if (u.foreswingTimer > 0) return; // still winding up
    if (u._swinging) {
      u._swinging = false;
      onImpact();
      const effectiveAtkRate = applyModifiers(u, u.atkRate, 'atkRate');
      u.atkCd = (1 / effectiveAtkRate) - u.foreswing;
      u.backswingTimer = u.backswing;
    } else if (u.canAttack() && u.backswingTimer <= 0) {
      u.foreswingTimer = u.foreswing;
      u._swinging = true;
      onWindupStart?.();
    }
  }

  resolve(units: IUnit[], dt: number, playerBase: HiveStructure, enemyBase: HiveStructure, particles: IParticleManager | null, wallActive: number, audio: AudioManager | null, zones: PheromoneZone[] = []): void {
    const alive = units.filter(u => !u.dead);
    this.audio = audio;

    // Shared context passed to all combat hooks
    const ctx: CombatContext = {
      particles,
      audio,
      scene: this.scene,
      events: this.events,
      allAlive: alive,
      S: 1,
      sourceUnit: null,
      playHitSound: (type: HitSoundType) => this._playHitSound(audio, type),
    };

    // Expose ctx to pipeline subscribers for the duration of resolve().
    this._currentCtx = ctx;

    // Passive tick runs BEFORE attacks so aura-applied modifiers
    // (Centurion rally, Wardling ward) are visible in the same frame.
    // Passes both `units` (includes dead — aura death-cleanup walks
    // them) and `alive` (self-modifier branch reads only alive).
    this.updatePassives(units, alive, dt);

    // Drain pending Elite/Royal signature triggers (player input). Runs
    // AFTER passives so cohesion/aura modifiers are current, BEFORE the
    // attack pass. Each ready signature queues its ability through the
    // pipeline (the same path heal_cast uses) and resets the caster's
    // cooldown. One resolveFrame drains all queued signature events.
    // TRIGGER pass: a signature WITH a body animation starts its windup here;
    // its damage + FX fire later at the lunge peak (impact pass below). A
    // signature with no animation fires immediately. Cooldown starts on trigger.
    if (this._pendingSignatureSides.size > 0 || this._pendingSignatureUnits.size > 0) {
      let firedNow = false;
      for (const u of alive) {
        const requested = this._pendingSignatureSides.has(u.side) || this._pendingSignatureUnits.has(u.id);
        if (!requested) continue;
        if (!u.canSignature()) continue;
        // Whiff guard — don't burn a DAMAGE signature's cooldown when no foe is
        // in range (keeps it ready). signatureWouldWhiff() is pure + unit-tested.
        if (signatureWouldWhiff(lookupAbility(u.signatureAbility!), u, alive)) continue;
        u.sigCd = u.signatureCooldown;
        if (u.signatureAnim && u.startSignatureAnim) {
          u.startSignatureAnim(); // telegraph → impact fires at the windup peak
        } else {
          this.fireSignatureImpact(u, ctx, alive); // no anim → instant
          firedNow = true;
        }
      }
      if (firedNow) this.pipeline.resolveFrame();
      this._pendingSignatureSides.clear();
      this._pendingSignatureUnits.clear();
    }

    // IMPACT pass: telegraphed signatures whose windup just completed fire their
    // damage + cast-FX NOW (synced to the body's lunge), not at the trigger.
    let firedImpact = false;
    for (const u of alive) {
      if (u.signatureImpactReady?.()) {
        this.fireSignatureImpact(u, ctx, alive);
        firedImpact = true;
      }
    }
    if (firedImpact) this.pipeline.resolveFrame();

    alive.forEach(u => {
      ctx.sourceUnit = u;
      u.update(dt);

      // One-time spawn latch. Behavior that used to attach here
      // (legacy onSpawn hooks) now composes from ability data; see
      // DESIGN_PATTERNS.md §3.
      u._spawned = true;

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
      if (hasActiveEffect(u, 'stun')) {
        u.state = 'march'; // idle visually
        if (u._swinging) { u._swinging = false; u.foreswingTimer = 0; }
        return;
      }

      // Find foe in attack range (any living enemy on the single front).
      const foes = alive.filter(e => e.side !== u.side && !e.dead);
      const { target, dist } = this._findTarget(u, foes);

      // Pheromone command — FIRST own-side zone whose 1D center-x band
      // covers this unit's center. Rally/Retreat are MOVEMENT overrides
      // that must FORCE the march branch (a unit with a target never
      // marches), so they null the effective target. Charge keeps its
      // target (attacks AND pushes); its boost lives in the march
      // override so it only applies when there's nothing in range.
      const zone = this._activeCommand(u, zones);
      // Royal click-order (MOBA-lite): may force the attack target (a focus in
      // range) or set a march destination. An explicit order outranks an ambient
      // pheromone; a no-op for every uncommanded unit. (RoyalControl.ts.)
      const order = resolveRoyalOrder(u);
      // Workers (Scouts) are NON-COMBATANT and ignore commands — they just run
      // forward emitting their OWN zone. (Reading their own zone would idle a
      // rally-scout on its center / send a retreat-scout backward.) So for a
      // worker null both `cmd` (→ plain forward march) and the attack target.
      const isWorker = u.caste === 'worker';
      const cmd = (isWorker || !zone) ? null : zone.kind;
      // order.disengage: a Royal TRAVELING under a click-order must not auto-
      // engage — a foe in range would pin her in the attack branch and the move
      // would never run (fighting preempts marching for every unit).
      const effTarget = order.target ?? ((isWorker || order.disengage || cmd === 'rally' || cmd === 'retreat') ? null : target);

      // Frenzy Musk (α's signature pheromone): cohesion carriers in the zone
      // CASH their banked pack-bonus into a frozen, doubled surge (the effect
      // snapshots on apply; the cohesion handler suppresses live tracking for
      // its duration). One-shot per visit — re-applies only after expiry.
      if (cmd === 'frenzy' && !isWorker
        && u.passives?.some(p => p.kind === 'cohesion')
        && !hasActiveEffect(u, 'frenzy_surge')) {
        applyEffect(u, 'frenzy_surge', { source: u });
      }

      if (effTarget) {
        this.tickAttackSwing(u, () => {
          if (effTarget instanceof HiveEntity) {
            // In-range base attack — ranged units only (melee units
            // can't enter this branch via _findTarget). Fires from
            // the unit's current position; wallActive blocks only
            // player-base damage.
            const dmg = Math.max(1, u.atk);

            if (effTarget.side === 'player') {
              const actualDmg = wallActive > 0 ? 0 : dmg;
              effTarget.takeDamage(actualDmg);
              if (wallActive > 0) {
                if (particles) particles.float(SBW / 2, GND - 40, 'BLOCKED!', DMG_COLORS.blocked);
              } else {
                effTarget.structure.flash(0.2);
                if (particles) particles.float(SBW / 2, GND - 40, `-${dmg}`, DMG_COLORS.base);
              }
              if (particles) particles.burst(SBW - 2, GND - 20, u.primary, 4);
            } else {
              effTarget.takeDamage(dmg);
              effTarget.structure.flash(0.2);
              if (particles) particles.float(this.worldW - SBW / 2, GND - 40, `-${dmg}`, DMG_COLORS.base);
              if (particles) particles.burst(this.worldW - SBW + 2, GND - 20, u.primary, 4);
            }
          } else if (effTarget instanceof StructureEntity) {
            // Mid-lane spire / tower — simple structure damage (no wall block,
            // no unit pipeline), at the structure's own position.
            const dmg = Math.max(1, u.atk);
            effTarget.takeDamage(dmg);
            effTarget.structure.flash(0.2);
            if (particles) {
              particles.float(effTarget.x, GND - 40, `-${dmg}`, DMG_COLORS.base);
              particles.burst(effTarget.x, GND - 20, u.primary, 4);
            }
          } else {
            this._lastAttacker = u;
            const hitType: HitFlavor = u.range >= 50 ? 'ranged' : 'melee';
            // Windup-drift fix: commit the hit to the foe LOCKED at swing-start
            // (so damage matches the lunge), falling back to the current nearest
            // if it died/left. Pure + unit-tested via resolveImpactTarget().
            const impactTarget = resolveImpactTarget(u.lockedTarget, effTarget as IUnit, u);

            {
              const abilityName = u.defaultAbility!;
              const ability = lookupAbility(abilityName);
              const tc = ability.targetCount ?? 1;

              if (tc > 1) {
                // Multi-target (Stormfly chain, Longeye pierce). Primary
                // comes from _findTarget (edge-to-edge); the selector
                // would miss it at the range boundary by unitW pixels.
                // Calculate phase computes per-target finalDamage =
                // applyModifiers(atk) × dmgMult × targetFalloff[i] ×
                // damageMultiplier; we set _targetIndex + damageMultiplier
                // (overcharge) on each queued event below.
                //
                // Secondary selection: chainRange → within range of
                // primary (Stormfly); absent → attacker-centric selector
                // minus primary (Longeye).
                let secondaries: IUnit[];
                if (ability.chainRange != null) {
                  const cr = ability.chainRange;
                  const primary = impactTarget;
                  secondaries = (ctx.allAlive as IUnit[])
                    .filter(e =>
                      e !== primary &&
                      e.side !== u.side &&
                      !e.dead &&
                      !e.burrowed &&
                      Math.abs(e.x - primary.x) <= cr,
                    )
                    .sort((a, b) =>
                      Math.abs(a.x - primary.x) - Math.abs(b.x - primary.x),
                    )
                    .slice(0, tc - 1);
                } else {
                  const selectorResults = runSelectorInRange(
                    ability.targeting!,
                    u,
                    ability,
                    ctx.allAlive,
                  );
                  secondaries = selectorResults
                    .filter(e => e !== impactTarget)
                    .slice(0, tc - 1) as IUnit[];
                }
                const targets = [impactTarget, ...secondaries];

                // Every-Nth-cast damage doubling via ResourceSystem
                // castCount. Gated on ability.overchargeEvery.
                let overcharge = 1;
                if (ability.overchargeEvery) {
                  const castCount = getResource(u as any, 'castCount');
                  addResource(u as any, 'castCount', 1);
                  if ((castCount + 1) % ability.overchargeEvery === 0) {
                    overcharge = 2;
                    if (ctx.particles) {
                      ctx.particles.float(
                        u.x + u.unitW / 2, u.y - 18,
                        'OVERCHARGE!', 0xffff40,
                      );
                    }
                  }
                }

                for (let i = 0; i < targets.length; i++) {
                  const t = targets[i] as IUnit;
                  const event = this.pipeline.queueAbility(u, t, abilityName, {
                    legacyHitFlavor: hitType,
                  });
                  event._targetIndex = i;
                  event.damageMultiplier = overcharge;
                }

                // Chain arc FX between consecutive targets
                if (ctx.particles && targets.length > 1) {
                  for (let i = 1; i < targets.length; i++) {
                    const prev = targets[i - 1] as IUnit;
                    const curr = targets[i] as IUnit;
                    ctx.particles.burst(
                      (prev.x + curr.x) / 2 + (prev.unitW + curr.unitW) / 4,
                      (prev.y + curr.y) / 2,
                      0x80ffff,
                      3,
                    );
                  }
                }

                // Single resolveFrame drains ALL queued events.
                this.pipeline.resolveFrame();
                this._playAbilitySound(audio, ability, u, hitType);
              } else {
                this.pipeline.queueAbility(
                  u,
                  impactTarget,
                  abilityName,
                  { legacyHitFlavor: hitType },
                );
                this.pipeline.resolveFrame();
                this._playAbilitySound(audio, ability, u, hitType);
              }
            }
            this._lastAttacker = null;
          }
        }, () => {
          // Lock the target at windup-start so the hit commits to it; a closer foe
          // drifting in mid-swing won't steal it. Bases don't move → no lock.
          u.lockedTarget = effTarget instanceof HiveEntity ? null : (effTarget as IUnit);
        });
      } else {
        // March
        u.state = 'march';
        let spd = u.getSpeed();

        // Terrain (neutral, per-route): a flood/web underfoot slows the march;
        // a wall ahead blocks forward advance. Slow scales the velocity here;
        // block is enforced AFTER the move (revert a forward step that pushed
        // into an impassable cell) so it covers every movement mode below
        // without editing each one. A flyer/tunneler on another route queries
        // empty terrain → unaffected (movement-immunity for free).
        const _terrCx = u.x + u.unitW / 2;
        const _terrHere = terrainEffectAt(u.currentRoute, _terrCx);
        if (_terrHere?.slowPct) spd *= Math.max(0, 1 - _terrHere.slowPct / 100);
        if (_terrHere?.root) spd = 0;
        const _blockedAhead = !!terrainEffectAt(
          u.currentRoute,
          _terrCx + u.facing * (u.unitW / 2 + 1),
        )?.block;
        const _preMoveX = u.x;

        // Pheromone movement override. `cmd` is the own-side zone
        // covering this unit (rally/charge/retreat) or null. Each
        // command reshapes the march velocity; `facing` is IMMUTABLE,
        // so retreat moves backward via a NEGATIVE velocity — never a
        // facing flip.
        if (order.marchTo != null) {
          // Royal click-order movement. She's a controllable hero, so unlike
          // forward-only rank-and-file she TURNS to face where she walks (no
          // moonwalking backward), and once arrived she HOLDS the spot in a ready
          // stance — facing the nearest threat, guarding it from either side —
          // instead of marching in place.
          const unitCx = u.x + u.unitW / 2;
          const delta = order.marchTo - unitCx;
          if (Math.abs(delta) > ROYAL_ARRIVE) {
            u.facing = delta > 0 ? 1 : -1;
            u.x += Math.sign(delta) * spd * 60 * dt;
          } else {
            u.state = 'attack';                    // arrived — stand/guard, not walk-in-place
            u.facing = this._faceNearestFoe(u, foes);
          }
        } else if (cmd === 'rally') {
          // Mass toward the zone center; HOLD within ~8px so the herd
          // settles instead of jittering across the center line.
          const center = zone ? zone.x : null;
          if (center !== null) {
            const unitCx = u.x + u.unitW / 2;
            const delta = center - unitCx;
            if (Math.abs(delta) > 8) {
              u.x += Math.sign(delta) * spd * 60 * dt;
            }
            // else HOLD — no movement.
          }
        } else if (cmd === 'charge' || cmd === 'frenzy') {
          // Advance forward at boosted speed (frenzy IS a charge surge).
          u.x += u.facing * spd * 1.5 * 60 * dt;
        } else if (cmd === 'retreat') {
          // Fall back — negative velocity (NOT a facing flip).
          u.x -= u.facing * spd * 1.2 * 60 * dt;
          // Don't retreat off the field — clamp to the back line.
          u.x = Math.max(SBW, Math.min(this.worldW - SBW - u.unitW, u.x));
        } else {
          // Normal march.
          u.x += u.facing * spd * 60 * dt;
        }

        // Wall block — undo a forward step that pushed into an impassable cell.
        // A backward move (retreat: sign opposite facing) passes through.
        if (_blockedAhead && Math.sign(u.x - _preMoveX) === u.facing) {
          u.x = _preMoveX;
        }

        // Player unit reaches enemy base — attack it (workers just clamp + idle)
        if (u.side === 'player' && u.x + u.unitW >= this.worldW - SBW) {
          u.x = this.worldW - SBW - u.unitW;
          if (isWorker) { /* non-combatant — hold at the line, keep emitting */ } else {
            this.tickAttackSwing(u, () => {
              const dmg = Math.max(1, u.atk);
              enemyBase.setHp(enemyBase.hp - dmg);
              enemyBase.flash(0.2);
              if (particles) particles.float(this.worldW - SBW / 2, GND - 40, `-${dmg}`, DMG_COLORS.base);
              if (particles) particles.burst(this.worldW - SBW + 2, GND - 20, u.primary, 4);
            });
          }
        }

        // Enemy unit reaches player base — attack it (workers just clamp + idle)
        if (u.side === 'enemy' && u.x <= SBW) {
          u.x = SBW;
          if (isWorker) { /* non-combatant — hold at the line, keep emitting */ } else {
            this.tickAttackSwing(u, () => {
              const dmg = Math.max(1, u.atk);
              const actualDmg = wallActive > 0 ? 0 : dmg;
              playerBase.setHp(playerBase.hp - actualDmg);
              if (wallActive > 0) {
                if (particles) particles.float(SBW / 2, GND - 40, 'BLOCKED!', DMG_COLORS.blocked);
              } else {
                playerBase.flash(0.2);
                if (particles) particles.float(SBW / 2, GND - 40, `-${dmg}`, DMG_COLORS.base);
              }
              if (particles) particles.burst(SBW - 2, GND - 20, u.primary, 4);
            });
          }
        }

        // Not attacking any base — cancel foreswing
        const atPlayerBase = u.side === 'enemy' && u.x <= SBW;
        const atEnemyBase = u.side === 'player' && u.x + u.unitW >= this.worldW - SBW;
        if (!atPlayerBase && !atEnemyBase) {
          if (u._swinging) { u._swinging = false; u.foreswingTimer = 0; }
        }
      }
    });

    // Pheromone TRAIL deposit — a courier Scout (a unit carrying a
    // `pheromoneKind`) drops a fading scent-blob every TRAIL_SPACING px it
    // travels. Each blob is a static zone the caller decays like any other.
    // Killing the courier stops new drops → the trail is exactly as long as it
    // survived (proportional deposit); laid blobs fade Scout-independently.
    for (const u of alive) {
      if (!u.pheromoneKind) continue;
      const cx = u.x + u.unitW / 2;
      if (u._lastDepositX == null || Math.abs(cx - u._lastDepositX) >= TRAIL_SPACING) {
        u._lastDepositX = cx;
        zones.push({ kind: u.pheromoneKind, x: cx, radius: TRAIL_BLOB_RADIUS, side: u.side, remaining: TRAIL_BLOB_FADE });
      }
    }

    // Terrain unit-interaction (passive DoT, catalyst cell-entry). Runs HERE —
    // inside resolve, ctx live — so terrain damage routes through the same DoT
    // seam and feeds the death economy. No-op when no terrain is registered.
    dispatchTerrainTick(alive, dt);

    // Tick active effects AFTER the per-unit combat loop but BEFORE
    // clearing _currentCtx — DOT hooks route damage through the
    // pipeline and need the live ctx for FX.
    updateEffects(alive, dt);

    // End of frame — release the ctx reference so stale state can't
    // leak into the next frame via phase subscribers.
    this._currentCtx = null;
  }

  // --- Pheromone command resolution ---
  //
  // Zone membership is 1D center-x distance, side-scoped: only own-side
  // units obey, and the band is `|unit.center.x - zone.x| < zone.radius`.
  // First matching zone wins (placement order = priority). resolve() READS
  // zones for commands AND appends courier-Scout trail blobs; lifetime/decay
  // happens in the caller's tick (GameManager / SandboxScene).

  /** The kind of the FIRST own-side zone covering `u`, or null. */
  /**
   * The first own-side pheromone zone covering `u` (1D center-x distance,
   * strict-less-than = IN range), or null. Caller reads `.kind` for the
   * command and `.x` for the rally center.
   */
  private _activeCommand(u: IUnit, zones: PheromoneZone[]): PheromoneZone | null {
    if (zones.length === 0) return null;
    const unitCx = u.x + u.unitW / 2;
    for (const z of zones) {
      if (u.side !== z.side) continue;
      if (Math.abs(unitCx - z.x) < z.radius) return z;
    }
    return null;
  }

  // --- Target finding ---
  //
  // Returns the closest valid target for `u`. Phase 6 follow-up #2
  // Returns the closest valid target for `u`. Ranged units can target
  // opposing bases; melee units can't (they fall through to the
  // at-wall attack path so their wall-touching animation is preserved).
  /**
   * Facing toward the nearest foe (either direction), or the unit's forward
   * default when none. Lets the controllable Royal guard a held spot from BOTH
   * sides — face an enemy that broke through behind her, not just stare forward —
   * so next frame's facing-gated _findTarget can engage it.
   */
  private _faceNearestFoe(u: IUnit, foes: IUnit[]): number {
    const cx = u.x + u.unitW / 2;
    let best = Infinity;
    let dir = u.side === 'player' ? 1 : -1;
    for (const e of foes) {
      const g = Math.abs((e.x + e.unitW / 2) - cx);
      if (g < best) { best = g; dir = (e.x + e.unitW / 2) >= cx ? 1 : -1; }
    }
    return dir;
  }

  _findTarget(u: IUnit, foes: IUnit[]): { target: IUnit | StructureEntity | null; dist: number } {
    let target: IUnit | StructureEntity | null = null;
    let bestDist = Infinity;
    foes.forEach(e => {
      if (e.burrowed) return;
      if (!canAttack(u.currentRoute, u.attackRange, e.currentRoute)) return;
      const dist = u.facing > 0
        ? (e.x - (u.x + u.unitW))
        : (u.x - (e.x + e.unitW));
      const absDist = Math.max(0, dist);
      if (absDist <= u.range && dist > -(e.unitW + u.unitW) && absDist < bestDist) {
        bestDist = absDist;
        target = e;
      }
    });

    // Ranged units can acquire the opposing base as a target.
    if (u.attackRange === 'ranged') {
      const enemyBase = u.side === 'player' ? this.enemyBaseEntity : this.playerBaseEntity;
      if (enemyBase && !enemyBase.dead) {
        const dist = u.facing > 0
          ? (enemyBase.x - (u.x + u.unitW))
          : (u.x - (enemyBase.x + enemyBase.unitW));
        const absDist = Math.max(0, dist);
        if (absDist <= u.range && absDist < bestDist) {
          bestDist = absDist;
          target = enemyBase;
        }
      }
    }

    // Towers — attackable by ALL units in range (mid-field structures, unlike
    // the wall base, which melee reach via the at-wall path).
    for (const s of this.structureTargets) {
      if (s.dead || s.side === u.side) continue;
      const dist = u.facing > 0 ? (s.x - (u.x + u.unitW)) : (u.x - (s.x + s.unitW));
      const absDist = Math.max(0, dist);
      if (absDist <= u.range && absDist < bestDist) {
        bestDist = absDist;
        target = s;
      }
    }

    return { target, dist: bestDist };
  }

  /**
   * `apply` subscriber: route check, takeDamage, damage particles.
   * Poise/stagger live on knockback.onApply via the blunt default
   * effect.
   */
  private _applyDamagePhase(event: DamageEvent): void {
    const ctx = this._currentCtx;
    if (!ctx) return;

    const u = event.target as IUnit;
    if (u.dead || u.burrowed) { event.cancelled = true; return; }

    const attacker = event.attacker as IUnit;
    if (attacker && attacker !== u && !canAttack(attacker.currentRoute, attacker.attackRange, u.currentRoute)) {
      event.cancelled = true;
      return;
    }

    const dmgType: HitFlavor = event._legacyHitFlavor ?? 'melee';
    const col = DMG_COLORS[dmgType] || DMG_COLORS.melee;

    // Integer-floor safety net against any subscriber leaving a
    // fractional finalDamage. The modify chain already rounds.
    let dmg = Math.round(event.finalDamage);
    event.finalDamage = dmg;
    u.takeDamage(dmg);

    if (ctx.particles) {
      ctx.particles.float(u.x + u.unitW / 2, u.y - 6, `-${dmg}`, col);
      ctx.particles.burst(u.x + u.unitW / 2, u.y + u.unitH / 2, col, 4);
    }

    // FX_SYSTEM.md seam — impact FX (no-op until the scene installs a real
    // FxDirector). Reads the ability's `fx` descriptor + hit center; magnitude
    // = damage for now (signatures will pass cohesion). Presentation-only.
    dispatchImpactFx({
      ability: event.ability,
      x: u.x + u.unitW / 2,
      y: u.y + u.unitH / 2,
      magnitude: dmg,
    });
  }

  /**
   * Passive tick loop. Three dispatch branches run once per resolve(),
   * BEFORE the per-unit attack forEach so modifier writes are visible
   * to the attack cycle in the same frame:
   *
   *   - Self-modifier (Ravager): predicate-gated modifier on self.
   *     Source-tagged `self:${id}:${stat}`; addModifier/remove flips
   *     on/off as condition crosses threshold.
   *   - Aura (Centurion, Wardling): walked-list pattern. Walk 1
   *     adds source-tagged `aura:${ownerId}:${stat}` modifiers to
   *     in-range same-side allies that don't already carry it. Walk 2
   *     removes source-tagged modifiers from allies no longer in range.
   *     Death cleanup: if owner is dead and `_auraCleanedUp` is false,
   *     run Walk 2 with `inRange = ∅`.
   *   - Passive heal (Mendwing): ticks per-unit cooldown; when ready
   *     AND a valid target exists, queues heal via queueAbility.
   *
   * `units` includes dead (aura death-cleanup needs it); `alive` is
   * the pre-filtered live roster.
   */
  private updatePassives(units: IUnit[], alive: IUnit[], dt: number): void {
    // Registry driver. Each handler sweeps its declared list once and
    // ticks every matching PassiveDef entry on each carrying unit. The
    // three handlers (self → aura → heal) are verbatim ports of the
    // former branches; sweep order and per-unit iteration order are
    // preserved, so behavior is byte-identical for single-passive units.
    //
    // To add a passive kind: add a union variant in types.ts + register
    // a handler in PassiveHandlers.ts. Nothing changes here.
    const env: PassiveTickEnv = { alive, units, dt, pipeline: this.pipeline };

    for (const handler of PASSIVE_HANDLERS) {
      const list = handler.sweep === 'all' ? units : alive;
      for (const u of list) {
        const passives = u.passives;
        if (!passives) continue;
        for (const p of passives) {
          if (p.kind === handler.kind) handler.tick(u, p, env);
        }
      }
    }

    // Drain heal events queued by the heal-cast handler. Runs BEFORE the
    // attack forEach so heals land before same-frame damage (Mendwing
    // saves the ally from the incoming attack). Safe: updatePassives is
    // called from resolve() before any phase subscriber runs, so this is
    // not reentrant.
    this.pipeline.resolveFrame();
  }

  /**
   * Death FX + nectar reward subscriber. CHECK-ONLY on the
   * `_deathTriggerFired` latch — does NOT set it. The latch is set
   * later in the same drain by applyDeathTriggerPhase, arming this
   * subscriber against double-fire on event 2+ against an already-
   * dead target. Do NOT add `_deathTriggerFired = true` here.
   */
  private _applyDeathEffectsPhase(event: DamageEvent): void {
    const ctx = this._currentCtx;
    if (!ctx) return;

    const u = event.target as IUnit;
    if (!u.dead || u._deathTriggerFired) return;

    if (ctx.particles) {
      ctx.particles.burst(u.x + u.unitW / 2, u.y + u.unitH / 2, u.primary, 14);
    }
    if (this.audio) this.audio.unitDeath();

    // Carrion feeding (\u03b2 Carrionling): same-geneline allies with a deathFeed
    // config grow on this death \u2014 each nearby fallen swarm-mate permanently
    // feeds them flat atk (stacked source-tagged modifiers, capped at max).
    const dyingCx = u.x + u.unitW / 2;
    for (const ally of ctx.allAlive as IUnit[]) {
      const feed = ally.deathFeed;
      if (!feed || ally.dead || ally === u) continue;
      if (ally.side !== u.side || ally.geneline !== u.geneline) continue;
      if (Math.abs((ally.x + ally.unitW / 2) - dyingCx) > feed.radius) continue;
      const tag = `feed:${ally.id}`;
      const stacks = ally.modifiers?.filter(m => m.source === tag).length ?? 0;
      if (stacks >= feed.max) continue;
      addModifier(ally, { stat: 'atk', type: 'flat', value: feed.perDeath, source: tag });
      if (ally.resources) ally.resources['feed'] = stacks + 1; // the draw gorges on this
      ctx.particles?.float(ally.x + ally.unitW / 2, ally.y - 12, 'FEED', 0x9adb3a);
    }

    // Every death announces itself \u2014 the corpse economy (GameManager layer)
    // drops a scavengeable pickup from this. Kill stats ride enemyKilled.
    // route + element feed the terrain corpse-footprint (a unit with a terrain
    // affinity lays/ignites its element where it fell). Harmless for the rest.
    this.events.emit('unitDied', { key: u.key, side: u.side, x: u.x, y: u.y, route: u.currentRoute, element: u.element });
    if (u.side === 'enemy') {
      this.events.emit('enemyKilled', { unit: { key: u.key, reward: u.reward, x: u.x, y: u.y } });
    }
  }

  _playHitSound(audio: AudioManager | null, type: HitFlavor | HitSoundType): void {
    if (!audio) return;
    const now = performance.now();
    if (now - this._lastHitSound < HIT_SOUND_THROTTLE_MS) return;
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

  // Basic-attack sound, ability-fitted when the ability names an `sfx` recipe
  // (jaw/needle/ram), else the category fallback. Shares the herd throttle so a
  // massed pack doesn't buzz; per-unit timbre rides on body size via pitch.
  _playAbilitySound(
    audio: AudioManager | null,
    ability: AbilityDef,
    attacker: IUnit,
    fallback: HitFlavor,
  ): void {
    if (!audio) return;
    // Per-unit voice wins over the ability's default — units sharing an attack
    // (the whole herd line is on jaw_strike) still sound distinct.
    const key = attacker.sfx ?? ability.sfx;
    if (!key) { this._playHitSound(audio, fallback); return; }
    const now = performance.now();
    if (now - this._lastHitSound < HIT_SOUND_THROTTLE_MS) return;
    this._lastHitSound = now;
    audio.playSfx(key, { pitch: this._pitchForUnit(attacker) });
  }

  // Body size → voice pitch: small bodies crisp/high, big bodies deep. Spans
  // well over an octave across the roster (Chitling w16 → Matriarch w40) so size
  // reads clearly, and the floor sits low enough that the heavies stay distinct
  // instead of all pinning to the clamp.
  _pitchForUnit(u: IUnit): number {
    const ref = 22;
    return Math.max(0.5, Math.min(1.7, ref / (u.unitW || ref)));
  }
}
