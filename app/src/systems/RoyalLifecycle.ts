import type { RoyalStatus } from '../types';
import { UNIT_DEFS } from '../units/registry';
import { lookupAbility } from '../config/combat/abilities';
import { addModifier, removeModifiersBySource } from './ModifierSystem';
import type { Unit } from '../entities/Unit';
import type { BattleCore } from './BattleCore';
import type { EventBus } from './EventBus';

// Royal lifecycle (VISION §3) — playtest knobs.
const ROYAL_RESPAWN_TIME = 15;   // [sec] dead-window before the next lineage arrives
const LEADERLESS_ATK_PCT = -20;  // [%] herd atk penalty while the Royal is gone
const LEADERLESS_SOURCE = 'leaderless:player';

/**
 * The player's controllable Royal (VISION §3) — spawn-at-the-bell, click
 * command mode, death stakes, and next-lineage respawn. Extracted from
 * GameManager so the hero's state machine lives in one place; GameManager
 * composes it and exposes thin delegates for the scenes.
 *
 * Three power tiers around the authored baseline:
 *   leaderless (she just died)  <  BASELINE (authored)  <  amplified (alive)
 * The amplifier is her cohesion-amp AURA (drops automatically via the aura
 * death-cleanup); leaderless is the death-triggered penalty maintained here.
 * DEATH-triggered, not "no Royal present" — a battle that never had a Royal
 * (sandbox skirmish) sits at clean baseline.
 */
export class RoyalLifecycle {
  /** The live Royal; null until spawned / while dead (awaiting respawn). */
  royal: Unit | null = null;
  /** Royal command mode (R / portrait / body-click). Clicks only order her
   *  while true; cleared on her death. */
  selected = false;

  private key: string | null = null;
  /** Seconds until the next lineage; > 0 == the leaderless window. */
  private respawnTimer = 0;

  constructor(
    private core: BattleCore,
    private events: EventBus,
    /** Spawn x + the playable-field clamp for ground-click orders. */
    private bounds: { spawnX: number; minX: number; maxX: number },
  ) {}

  /** Find the deck's royal and put her on the field, held at the hive. */
  spawnFromDeck(deckKeys: string[]): void {
    this.key = deckKeys.find(k => UNIT_DEFS[k]?.caste === 'royal') ?? null;
    this.royal = this.spawn();
  }

  /**
   * Spawn the Royal at the hive with a HOLD order on the spot — she does NOT
   * auto-march like rank-and-file; she waits + guards home until the player
   * commits her. Shared by the opening spawn + respawn.
   */
  private spawn(): Unit | null {
    if (!this.key) return null;
    const def = UNIT_DEFS[this.key];
    if (!def) return null;
    const royal = this.core.createUnit(this.key, 'player', def, this.bounds.spawnX, 0);
    royal.order = { kind: 'move', x: royal.x + royal.unitW / 2 }; // hold at spawn, guard the hive
    return royal;
  }

  /**
   * Death → respawn countdown (the leaderless window) → a fresh lineage.
   * The leaderless penalty is maintained per-frame on every living player
   * unit while she's gone (units deployed mid-gap inherit it) and lifted the
   * frame she returns.
   */
  update(dt: number): void {
    if (this.royal && this.royal.dead) {
      this.royal = null;
      this.selected = false; // can't command a corpse
      this.respawnTimer = ROYAL_RESPAWN_TIME;
      this.events.emit('logMessage', { message: 'The Matriarch has fallen — the herd is leaderless!' });
    }

    if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawnTimer = 0;
        this.royal = this.spawn();
        if (this.royal) this.events.emit('logMessage', { message: 'A new Matriarch emerges!' });
      }
    }

    const leaderless = this.respawnTimer > 0;
    for (const u of this.core.units) {
      if (u.side !== 'player' || u.dead) continue;
      const has = u.modifiers?.some(m => m.source === LEADERLESS_SOURCE) ?? false;
      if (leaderless && !has) {
        addModifier(u, { stat: 'atk', type: 'percent', value: LEADERLESS_ATK_PCT, source: LEADERLESS_SOURCE });
      } else if (!leaderless && has) {
        removeModifiersBySource(u, LEADERLESS_SOURCE);
      }
    }
  }

  /** Toggle command mode. Only a living Royal can be selected; deselect always. */
  toggleSelect(): void {
    if (this.selected) { this.selected = false; return; }
    if (this.royal && !this.royal.dead) this.selected = true;
  }

  /**
   * Battlefield click (MOBA-lite control):
   *   - on/near her body in her lane → SELECT (the discoverable pick-up)
   *   - while selected: an enemy under the click → focus + chase (and cross
   *     lanes to reach it); open ground → move there (clamped to the field).
   *     A click in the other lane sets the lane-switch destination.
   *   - unselected field click → a hint, not a silent no-op.
   */
  commandClick(worldX: number, lane: number): void {
    const r = this.royal;
    if (!r || r.dead) return;

    // Generous, lane-scoped body hit-box — a fumbled "almost hit her" click
    // should select; a click in the OTHER lane at her x reads as a lane-switch.
    const grabHalf = Math.max(24, r.unitW);
    if (lane === r.lane && Math.abs(worldX - (r.x + r.unitW / 2)) <= grabHalf) {
      this.selected = true;
      return;
    }

    if (!this.selected) {
      this.events.emit('logMessage', { message: 'Select the Matriarch first — click her, her card, or press R.' });
      return;
    }

    let focus: Unit | null = null;
    for (const u of this.core.units) {
      if (u.side !== 'enemy' || u.dead || u.lane !== lane) continue;
      if (worldX >= u.x - 4 && worldX <= u.x + u.unitW + 4) { focus = u; break; }
    }
    // Clamp ground-clicks to the playable field — past the hive walls means
    // "all the way back/forward", not "stand inside the hive".
    const x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, worldX));
    // Destination lane — if it differs, this kicks off the cross-lane slide
    // (her combat row flips at the midpoint; disengaged until landed).
    r._laneTarget = lane;
    r.order = focus ? { kind: 'focus', target: focus } : { kind: 'move', x };
  }

  /** Royal state for the HUD profile panel (registry 'royal.status'). */
  getStatus(): RoyalStatus {
    const r = this.royal;
    const key = this.key ?? '';
    const def = key ? UNIT_DEFS[key] : undefined;
    if (!r || r.dead) {
      return {
        present: this.key != null, alive: false,
        key, name: def?.name ?? 'Royal',
        hp: 0, maxHp: def?.hp ?? 0, hpFrac: 0,
        respawnIn: Math.max(0, Math.ceil(this.respawnTimer)),
        id: -1, sigName: '', sigReady: false, sigCdFrac: 0,
      };
    }
    const sigName = r.signatureAbility ? lookupAbility(r.signatureAbility).name : '';
    const frac = r.signatureCooldown > 0 ? r.sigCd / r.signatureCooldown : 0;
    return {
      present: true, alive: true,
      key, name: r.unitName,
      hp: r.hp, maxHp: r.maxHp, hpFrac: r.maxHp > 0 ? r.hp / r.maxHp : 0,
      respawnIn: 0, id: r.id, sigName,
      sigReady: r.canSignature(),
      sigCdFrac: frac < 0 ? 0 : frac > 1 ? 1 : frac,
    };
  }
}
