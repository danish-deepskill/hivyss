import type { IParticleManager } from '../types';
import {
  BLOOM_POOR, BLOOM_RICH, POOR_BAND, RICH_BAND, BLOOM_SPACING,
  RESEED_CHECK, RESEED_CHANCE, RESEED_BAND, MAX_ACTIVE_BLOOMS,
  HARVEST_TIME, FORAGE_ARRIVE, RATE_WINDOW,
} from '../config/ForageDefs';
import { CORPSE_DECAY } from '../config/VyssDefs';
import { getGroundY } from '../config/RouteMatrix';
import type { Unit } from '../entities/Unit';
import type { BattleCore } from './BattleCore';
import type { EconomyManager } from './EconomyManager';
import type { VyssEconomy } from './VyssEconomy';
import type { EventBus } from './EventBus';
import type { SeededRNG } from './SeededRNG';

/** A nectar bloom — a stateful, DEPLETABLE forage site. Plain data (no
 *  Phaser); WorldScene renders from this each frame (pool → petal scale,
 *  flash → raid alert, rich → 3-flower cluster). */
export interface Bloom {
  id: number;
  x: number;
  lane: number;
  carry: number;
  pool: number;
  maxPool: number;
  rich: boolean;
  /** Raid-alert flash timer (sec) — set when a gatherer working it dies. */
  flash: number;
}

/** A fallen vyssid's remains — a physical, decaying pickup gatherers
 *  scavenge home for the corpse pool. Ownership is whoever hauls it. */
export interface CorpsePickup {
  id: number;
  x: number;
  lane: number;
  yield: number;
  /** Seconds before the field absorbs it. */
  decay: number;
}

/** One gatherer's live trip. `idle` = nothing to work, waiting at home. */
interface GatherJob {
  targetKind: 'bloom' | 'corpse';
  targetId: number | null;
  phase: 'out' | 'harvest' | 'home' | 'idle';
  timer: number;
  /** Load on its back (dies with the carrier — the eco-raid counterplay). */
  carrying: number;
  carryKind: 'nectar' | 'corpse';
}

/**
 * Forage — the worker economy. Owns the bloom field (seeded scatter,
 * depletion, center-biased reseeds) AND the corpse pickups (deaths drop them;
 * gatherers scavenge them), and drives GATHERER workers through the generic
 * `unit.order` seam — zero new branches in the combat loop.
 *
 * The player commands the economy as a STANCE, not micro (G-mode click):
 *   - click a bloom  → all current+future gatherers prioritize it
 *   - click a corpse → all gatherers switch to CORPSE-DUTY
 *   - click empty    → auto (least-crowded bloom, ties to the richer)
 *
 * Every duty runs the full fallback chain (real-flow rule): target taken or
 * gone mid-trip → auto-retarget the nearest remaining → pool exhausted → fall
 * back to the default duty (blooms) with a log line — never a silent stall.
 *
 * GameManager-layer (like RoyalLifecycle), NOT BattleCore — the sandbox lab
 * doesn't run an economy.
 */
export class Forage {
  readonly blooms: Bloom[] = [];
  readonly corpsePickups: CorpsePickup[] = [];
  /** Standing duty: scavenge corpses, or work the blooms. */
  stance: 'nectar' | 'corpse' = 'nectar';
  /** Standing bloom order (nectar stance): a bloom id, or null = auto. */
  priorityId: number | null = null;

  private jobs = new Map<number, GatherJob>();
  private nextId = 1;
  private elapsed = 0;
  private reseedTimer = 0;
  private lastAlertAt = -99;
  /** Recent deposits for the HUD's honest income rate (n/s over RATE_WINDOW). */
  private deposits: Array<{ at: number; n: number }> = [];

  constructor(
    private core: BattleCore,
    private economy: EconomyManager,
    private vyss: VyssEconomy,
    private particles: IParticleManager,
    private events: EventBus,
    private rng: SeededRNG,
    /** Deposit point (hive doorstep) + field width for bloom world-x. */
    private bounds: { homeX: number; worldW: number },
  ) {
    // Opening scatter: one POOR bloom in the safe band, one RICH one deeper
    // (the risk premium), spaced apart so the two sites read as a choice.
    const poorX = this.rollX(POOR_BAND);
    let richX = this.rollX(RICH_BAND);
    if (Math.abs(richX - poorX) < BLOOM_SPACING) richX = poorX + BLOOM_SPACING;
    this.spawnBloom(poorX, this.rollLane(), BLOOM_POOR);
    this.spawnBloom(richX, this.rollLane(), BLOOM_RICH);
  }

  private rollX(band: [number, number]): number {
    return (band[0] + this.rng.next() * (band[1] - band[0])) * this.bounds.worldW;
  }

  private rollLane(): number {
    return this.rng.next() < 0.5 ? 0 : 1;
  }

  private spawnBloom(x: number, lane: number, kind: { carry: number; pool: number; rich: boolean }): Bloom {
    const b: Bloom = {
      id: this.nextId++,
      x, lane,
      carry: kind.carry,
      pool: kind.pool,
      maxPool: kind.pool,
      rich: kind.rich,
      flash: 0,
    };
    this.blooms.push(b);
    return b;
  }

  /** A death dropped remains on the field — scavengeable until it decays. */
  dropCorpse(x: number, lane: number, vyssYield: number): void {
    this.corpsePickups.push({ id: this.nextId++, x, lane, yield: vyssYield, decay: CORPSE_DECAY });
  }

  private bloomById(id: number | null): Bloom | undefined {
    return id == null ? undefined : this.blooms.find(b => b.id === id);
  }

  private corpseById(id: number | null): CorpsePickup | undefined {
    return id == null ? undefined : this.corpsePickups.find(c => c.id === id);
  }

  /** Gatherer count working a bloom (for auto-assignment balance). */
  private workersOn(id: number): number {
    let n = 0;
    for (const j of this.jobs.values()) if (j.targetKind === 'bloom' && j.targetId === id) n++;
    return n;
  }

  /** Auto bloom pick: the standing priority if alive, else least-crowded
   *  (ties go richer). Null when the field is bare. */
  private pickBloom(): Bloom | null {
    const pri = this.bloomById(this.priorityId);
    if (pri) return pri;
    let best: Bloom | null = null;
    let bestCount = Infinity;
    for (const b of [...this.blooms].sort((a, z) => z.carry - a.carry)) {
      const n = this.workersOn(b.id);
      if (n < bestCount) { bestCount = n; best = b; }
    }
    return best;
  }

  /** Nearest remaining corpse to `x` (the retarget rule). */
  private pickCorpse(x: number): CorpsePickup | null {
    let best: CorpsePickup | null = null;
    let bestD = Infinity;
    for (const c of this.corpsePickups) {
      const d = Math.abs(c.x - x);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  /**
   * Send a worker to its next target, honoring the stance and running the
   * fallback chain: corpse-duty with no corpses left → revert the WHOLE
   * stance to the blooms (announced); blooms bare → idle at home (reseeds
   * re-dispatch). Sets lane (the generic lane-slide carries it across).
   */
  private dispatch(u: Unit, job: GatherJob): void {
    if (this.stance === 'corpse') {
      const c = this.pickCorpse(u.x + u.unitW / 2);
      if (c) {
        job.targetKind = 'corpse';
        job.targetId = c.id;
        job.phase = 'out';
        u._laneTarget = c.lane;
        u.order = { kind: 'move', x: c.x };
        return;
      }
      // Exhausted → the chain falls back to the default duty, audibly.
      this.stance = 'nectar';
      this.events.emit('logMessage', { message: 'No corpses left — gatherers return to the blooms.' });
    }
    const bloom = this.pickBloom();
    if (!bloom) {
      job.targetKind = 'bloom';
      job.targetId = null;
      job.phase = 'idle';
      u.order = { kind: 'move', x: this.bounds.homeX };
      return;
    }
    job.targetKind = 'bloom';
    job.targetId = bloom.id;
    job.phase = 'out';
    u._laneTarget = bloom.lane;
    u.order = { kind: 'move', x: bloom.x };
  }

  /** Put a freshly deployed gatherer to work. */
  assign(u: Unit): void {
    const job: GatherJob = { targetKind: 'bloom', targetId: null, phase: 'idle', timer: 0, carrying: 0, carryKind: 'nectar' };
    this.jobs.set(u.id, job);
    this.dispatch(u, job);
  }

  /** G-mode bloom order: all current + future gatherers prioritize `bloomId`
   *  (null = auto). Also exits corpse-duty. Carriers finish their run first. */
  setPriority(bloomId: number | null): void {
    this.stance = 'nectar';
    this.priorityId = bloomId;
    this.redispatchAll();
  }

  /** G-mode corpse order: all gatherers switch to corpse-duty. */
  setCorpseStance(): void {
    this.stance = 'corpse';
    this.redispatchAll();
  }

  private redispatchAll(): void {
    for (const u of this.core.units) {
      const job = this.jobs.get(u.id);
      if (!job || u.dead) continue;
      if (job.phase !== 'home') this.dispatch(u, job); // carriers deposit first
    }
  }

  /** Live worker count (HUD). */
  get workerCount(): number {
    return this.jobs.size;
  }

  /** Honest income rate (n/s) — actual nectar deposits over the window. */
  get rate(): number {
    let sum = 0;
    for (const d of this.deposits) sum += d.n;
    return sum / RATE_WINDOW;
  }

  tick(dt: number): void {
    this.elapsed += dt;

    // Field upkeep — bloom flash decay, corpse decay, reseeding. A fresh RICH
    // bloom seeds in the contested center band on a periodic chance roll, and
    // IMMEDIATELY when the field is bare (no attrition stalemates).
    for (const b of this.blooms) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);
    for (let i = this.corpsePickups.length - 1; i >= 0; i--) {
      this.corpsePickups[i].decay -= dt;
      if (this.corpsePickups[i].decay <= 0) this.corpsePickups.splice(i, 1);
    }
    this.reseedTimer += dt;
    const bare = this.blooms.length === 0;
    if (bare || this.reseedTimer >= RESEED_CHECK) {
      if (!bare) this.reseedTimer = 0;
      if (this.blooms.length < MAX_ACTIVE_BLOOMS && (bare || this.rng.next() < RESEED_CHANCE)) {
        const b = this.spawnBloom(this.rollX(RESEED_BAND), this.rollLane(), BLOOM_RICH);
        this.events.emit('logMessage', { message: '🌼 A nectar bloom has blossomed mid-field!' });
        this.particles.float(b.x, getGroundY('land', b.lane) - 24, 'BLOOM!', 0xf0c040, true);
        for (const u of this.core.units) {
          const job = this.jobs.get(u.id);
          if (job && !u.dead && job.phase === 'idle') this.dispatch(u, job);
        }
      }
    }

    // Prune the recent-deposit window (HUD rate).
    while (this.deposits.length > 0 && this.elapsed - this.deposits[0].at > RATE_WINDOW) {
      this.deposits.shift();
    }

    if (this.jobs.size === 0) return;

    // Reap jobs whose gatherer died — and raid-alert their bloom: a sniped
    // worker is the eco-raid signal, and split-lane attention needs the ping.
    const liveIds = new Set<number>();
    for (const u of this.core.units) if (!u.dead) liveIds.add(u.id);
    for (const [id, job] of this.jobs) {
      if (liveIds.has(id)) continue;
      this.jobs.delete(id);
      const bloom = job.targetKind === 'bloom' ? this.bloomById(job.targetId) : undefined;
      if (bloom) bloom.flash = 1.6;
      if (this.elapsed - this.lastAlertAt > 4) {
        this.lastAlertAt = this.elapsed;
        this.events.emit('logMessage', { message: '⚠ A gatherer was killed — the forage line is under attack!' });
      }
    }

    for (const u of this.core.units) {
      const job = this.jobs.get(u.id);
      if (!job || u.dead) continue;
      const cx = u.x + u.unitW / 2;

      if (job.phase === 'out') {
        if (job.targetKind === 'corpse') {
          const c = this.corpseById(job.targetId);
          // Taken by another gatherer or decayed mid-walk → retarget (chain).
          if (!c) { this.dispatch(u, job); continue; }
          if (Math.abs(cx - c.x) <= FORAGE_ARRIVE) {
            // Scavenge — instant pickup, haul it home.
            this.corpsePickups.splice(this.corpsePickups.indexOf(c), 1);
            job.carrying = c.yield;
            job.carryKind = 'corpse';
            u.resources['carry'] = 2; // bone-grey load (presentation)
            job.phase = 'home';
            u.order = { kind: 'move', x: this.bounds.homeX };
          }
        } else {
          const bloom = this.bloomById(job.targetId);
          if (!bloom) { this.dispatch(u, job); continue; } // wilted en route
          if (Math.abs(cx - bloom.x) <= FORAGE_ARRIVE) {
            job.phase = 'harvest';
            job.timer = HARVEST_TIME;
          }
        }
      } else if (job.phase === 'harvest') {
        const bloom = this.bloomById(job.targetId);
        if (!bloom) { this.dispatch(u, job); continue; }
        job.timer -= dt;
        if (job.timer <= 0) {
          // Draw down the bloom (partial last trip) — the load now rides on
          // the worker's back: kill the carrier, lose the nectar.
          job.carrying = Math.min(bloom.carry, bloom.pool);
          job.carryKind = 'nectar';
          bloom.pool -= job.carrying;
          u.resources['carry'] = 1; // gold load (presentation)
          if (bloom.pool <= 0) {
            this.blooms.splice(this.blooms.indexOf(bloom), 1);
            this.events.emit('logMessage', { message: 'A nectar bloom has run dry.' });
            if (this.priorityId === bloom.id) this.priorityId = null;
          }
          job.phase = 'home';
          u.order = { kind: 'move', x: this.bounds.homeX };
        }
      } else if (job.phase === 'home') {
        if (Math.abs(cx - this.bounds.homeX) <= FORAGE_ARRIVE) {
          if (job.carryKind === 'corpse') {
            this.vyss.earn(job.carrying);
            this.particles.float(cx, u.y - 10, `+${Math.floor(job.carrying)}✦`, 0xc8c8d8);
          } else {
            this.economy.earn(job.carrying);
            this.deposits.push({ at: this.elapsed, n: job.carrying });
            this.particles.float(cx, u.y - 10, `+${job.carrying}⬡`, 0xf0c040);
          }
          job.carrying = 0;
          u.resources['carry'] = 0;
          this.dispatch(u, job);
        }
      }
      // idle: holding at home — reseeds / new orders re-dispatch.
    }
  }
}
