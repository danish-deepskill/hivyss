// Motion-primitive library — reusable body-motion transforms for the unit
// animation system (see app/docs/active/UNIT_ANIMATION_SYSTEM.md).
//
// Each primitive is a configured, pure `(MotionCtx) => MotionTransform`. A unit
// author composes ONE in the unit's draw file — e.g. `charge({ rear: 0.3,
// lunge: 0.6 })` — and the draw applies the returned transform to the body.
// The author writes poses-from-t this way; the controller owns timing. These
// are presentation-only and deterministic (no random / no Date), so they're
// trivially unit-testable and reproducible.

export type AnimPhase = 'windup' | 'active' | 'recover';

export interface MotionCtx {
  /** Overall clip progress 0→1. */
  t: number;
  /** Current phase of the clip. */
  phase: AnimPhase;
  /** Progress within the current phase, 0→1. */
  phaseT: number;
}

/**
 * A facing-relative body transform the draw applies before rendering:
 *  - `dx` / `dy`: offset as a fraction of unit width / height (dx is along the
 *    unit's facing — positive = forward).
 *  - `lean`: forward tilt (~radians); positive leans into the facing.
 *  - `squash`: vertical scale (1 = neutral; >1 taller, <1 flatter).
 */
export interface MotionTransform {
  dx: number;
  dy: number;
  lean: number;
  squash: number;
}

export type Motion = (ctx: MotionCtx) => MotionTransform;

export const NEUTRAL: MotionTransform = { dx: 0, dy: 0, lean: 0, squash: 1 };

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const arc = (t: number): number => Math.sin(t * Math.PI); // 0→1→0 over the phase

/**
 * Charge — rear back (windup) → explosive lunge forward (active) → settle
 * (recover). The signature herd-charge motion (Goliath's Stampede). `rear` and
 * `lunge` are forward-offset fractions of unit width.
 */
export function charge(opts: { rear?: number; lunge?: number } = {}): Motion {
  const rear = opts.rear ?? 0.25;
  const lunge = opts.lunge ?? 0.5;
  return ({ phase, phaseT }) => {
    if (phase === 'windup') {
      const e = easeOut(phaseT);
      return { dx: -rear * e, dy: 0.05 * e, lean: -0.2 * e, squash: 1 + 0.1 * e };
    }
    if (phase === 'active') {
      const e = easeOut(phaseT);
      return { dx: lerp(-rear, lunge, e), dy: -0.03 * arc(phaseT), lean: lerp(-0.2, 0.35, e), squash: 1 - 0.08 * arc(phaseT) };
    }
    const e = easeOut(phaseT);
    return { dx: lunge * (1 - e), dy: 0, lean: 0.35 * (1 - e), squash: 1 };
  };
}

/**
 * Ram — a violent headbutt-charge, distinct from `charge`: a quick low crouch
 * (windup) → a flat head-first thrust forward (active) → a RECOIL bounce
 * backward on impact (recover). Where `charge` settles *forward*, `ram` stabs
 * and kicks *back* — it rammed something solid. `thrust` is the forward reach;
 * `recoil` is how far it bounces back. Maulhorn's signature.
 */
export function ram(opts: { thrust?: number; recoil?: number } = {}): Motion {
  const thrust = opts.thrust ?? 0.5;
  const recoil = opts.recoil ?? 0.22;
  return ({ phase, phaseT }) => {
    if (phase === 'windup') {
      // snap-rear into a low coiled crouch (head cocked back, body flattened)
      const e = easeOut(phaseT);
      return { dx: -0.16 * e, dy: 0.1 * e, lean: -0.12 * e, squash: 1 - 0.12 * e };
    }
    if (phase === 'active') {
      // flat head-first thrust — forward and low, horn leading
      const e = easeOut(phaseT);
      return { dx: lerp(-0.16, thrust, e), dy: 0.04 * (1 - e), lean: lerp(-0.12, 0.42, e), squash: 0.96 };
    }
    // recover: RECOIL — snap back past neutral (the bounce), a small upward
    // jolt + back-tilt, then settle. This kickback is what reads as "impact".
    const back =
      phaseT < 0.4
        ? lerp(thrust, -recoil, phaseT / 0.4) // snapped back by the hit
        : lerp(-recoil, 0, (phaseT - 0.4) / 0.6); // settle to neutral
    const jolt = arc(phaseT);
    return { dx: back, dy: -0.07 * jolt, lean: 0.42 * (1 - phaseT) - 0.12 * jolt, squash: 1 + 0.05 * jolt };
  };
}

/** Lunge — a quick forward stab with no rear (light melee). Active-phase only. */
export function lunge(opts: { dist?: number } = {}): Motion {
  const dist = opts.dist ?? 0.3;
  return ({ phase, phaseT }) =>
    phase === 'active'
      ? { dx: dist * arc(phaseT), dy: 0, lean: 0.2 * arc(phaseT), squash: 1 }
      : NEUTRAL;
}

/** Rear — pull/tilt back and hold, then release (a pure telegraph). */
export function rear(opts: { dist?: number } = {}): Motion {
  const dist = opts.dist ?? 0.2;
  return ({ phase, phaseT }) => {
    const e = phase === 'recover' ? 1 - easeOut(phaseT) : easeOut(phaseT);
    return { dx: -dist * e, dy: 0.04 * e, lean: -0.25 * e, squash: 1 + 0.08 * e };
  };
}

/** Recoil — a backward kick out and back (knockback / firing a ranged shot). */
export function recoil(opts: { dist?: number } = {}): Motion {
  const dist = opts.dist ?? 0.18;
  return ({ phaseT }) => {
    const e = arc(phaseT);
    return { dx: -dist * e, dy: 0, lean: -0.15 * e, squash: 1 };
  };
}

/** Shake — a continuous deterministic jitter (stun, charge-up). Phase-agnostic. */
export function shake(opts: { amp?: number; freq?: number } = {}): Motion {
  const amp = opts.amp ?? 0.04;
  const freq = opts.freq ?? 30;
  return ({ t }) => ({ dx: amp * Math.sin(t * freq), dy: amp * 0.5 * Math.cos(t * freq * 1.3), lean: 0, squash: 1 });
}

/** Sum multiple motions (offsets/lean add; squash multiplies) — e.g. charge + shake. */
export function combine(...motions: Motion[]): Motion {
  return (ctx) =>
    motions.reduce<MotionTransform>(
      (acc, m) => {
        const x = m(ctx);
        return { dx: acc.dx + x.dx, dy: acc.dy + x.dy, lean: acc.lean + x.lean, squash: acc.squash * x.squash };
      },
      { ...NEUTRAL },
    );
}
