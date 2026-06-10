import type { IUnit } from '../types';

// Royal click-control resolution (MOBA-lite, VISION §3). Pure domain rule that
// turns the player's order into a per-frame target + march override, so
// CombatSystem.resolve() stays free of caste branching. Only a commanded Royal
// returns anything but NONE.

/** "Arrived" tolerance (px) — she holds within this of the ordered spot instead
 *  of jittering across it. Mirrors the rally hold-band. */
export const ROYAL_ARRIVE = 6;

export interface OrderResolution {
  /** Attack target the order forces (a focus in range), else null → default targeting. */
  target: IUnit | null;
  /** March destination world-x while the order moves her, else null → no override. */
  marchTo: number | null;
  /** True while TRAVELING under an order — she must not auto-engage, or any foe
   *  in range pins her in the attack branch and the move never happens (the
   *  "she won't come back" bug). Same rule as rally/retreat zones. */
  disengage: boolean;
  /** True while she's still sliding between lanes — she can't fight mid-cross (the
   *  vulnerable window) and keeps the WALK pose rather than dropping into a guard. */
  crossing: boolean;
}

const NONE: OrderResolution = { target: null, marchTo: null, disengage: false, crossing: false };

/**
 * Resolve a unit's click-order into a target + march override:
 *   move  → traveling: walk to x, DISENGAGED (ignores foes en route — that's the
 *           point of "come back"); arrived: HOLD the spot + fight what's in range
 *           (the classic RTS move-then-hold).
 *   focus → in range: attack that foe; out of range: chase it, disengaged from
 *           everything else (it's a called shot, not a brawl).
 *
 * Side-effect: clears a focus whose target died/left (the order's own
 * lifecycle), so she resumes autonomous play. No-op for any unit without an
 * order. Distance is direction-agnostic (center gap minus half-widths) so a
 * focus that ends up behind her is chased, not falsely "in range".
 */
export function resolveRoyalOrder(u: IUnit): OrderResolution {
  const order = u.order;
  if (!order) return NONE;

  const cu = u.x + u.unitW / 2;
  // Mid lane-switch: she's sliding across the depth stack and can't fight until
  // fully landed — that exposed window IS the cost of redeploying to a new front.
  const crossing = u._laneTarget !== undefined && u._laneVisual !== undefined
    && Math.abs(u._laneVisual - u._laneTarget) > 0.02;

  if (order.kind === 'move') {
    const traveling = Math.abs(order.x - cu) > ROYAL_ARRIVE;
    // Arrived → marchTo still pins her to the spot (the march branch holds
    // inside ROYAL_ARRIVE); default targeting resumes so she defends her ground.
    return { target: null, marchTo: order.x, disengage: traveling || crossing, crossing };
  }

  const f = order.target;
  // Drop the focus if it's truly gone — but a lane MISMATCH only counts once she's
  // landed: mid-cross her combat row is her physical lane (not yet the focus's), and
  // the chase must persist so she engages it on arrival in the destination lane.
  if (!f || f.dead || f.side === u.side || (!crossing && f.lane !== u.lane)) {
    u.order = null; // focus gone → resume autonomous
    return NONE;
  }
  const cf = f.x + f.unitW / 2;
  const gap = Math.abs(cf - cu) - (f.unitW + u.unitW) / 2;
  if (!crossing && gap <= u.range) return { target: f, marchTo: null, disengage: false, crossing: false };
  return { target: null, marchTo: cf, disengage: true, crossing };
}
