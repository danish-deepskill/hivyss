# Unit Animation System — Architecture Contract (procedural, MUGEN-scale)

> **Status:** Designed + **BUILT 2026-06-01** (Goliath's Stampede charge live +
> verified on-screen). Shipped: `units/motions.ts` (motion-primitive library +
> 8 tests) · `Unit` controller (`signatureAnim`, `currentMotion`,
> `startSignatureAnim`, `signatureImpactReady`; `redraw` applies the transform —
> body offset + squash/lean via graphics transform) · sim **windup→impact phase
> timing** in `CombatSystem` (trigger pass starts the telegraph; impact pass
> fires damage + cast-FX at the lunge peak) · `UnitDef.signatureAnim` +
> `signatureAnimPhases` · Goliath = `charge({ rear: 0.3, lunge: 0.6 })`.
> **Next:** more clips (hit-flinch, death) + per-unit signature anims as units
> need them — each is a primitive + params, zero architecture cost.
> **Pairs with:** `FX_SYSTEM.md` (FX = the *consequence*; this = the *act*) ·
> `units/CLAUDE.md` (draw-function conventions) · `DESIGN_PATTERNS.md`.

## The frame

No sprite frames here — **animation = a procedural pose computed from a
normalized progress `t`**, redrawn each frame. This already exists in miniature:
`swingProgress()` → `{windup, recover}` is the **attack** clip; the bob is the
**idle** clip. This system *generalizes* that one seed into a uniform clip
model so every unit and every move plugs in the same way.

The unit is **always in one animation clip**; its draw is a pure function of
**(clip, phase, t)**; gameplay events fire from the **sim**, and the animation
reads the same sim timing to stay in sync (it never drives gameplay).

---

## PART 1 — MANAGEABILITY (the spine; everything else serves this)

The system lives or dies on whether authoring one unit's move is *easy*. Three
rules, all proven by the existing draw-composition pattern (`goliath.ts`
composes `drawHerd(...)` + a co-located `signature:` fn):

**M1 — The author writes POSES, never timing or state-machines.** The system
owns clips, phases, transitions, priority, ticking. The author answers only:
*"what does the body look like at progress `t`?"* (Exactly like an FX renderer
author writes `(fx,t,g)=>draw` and never touches the pool/budget.)

**M2 — Most moves = a motion primitive + params (one line).** A shared library
of reusable motions — `lunge · rear · charge · recoil · shake · squashStretch ·
pulse` — applied as a transform over the body the draw already renders. The
"archetype × flavor" model applied to motion: a handful of primitives × params
= dozens of distinct moves, ~no code each. Bespoke moves drop to a small custom
pose fn.

**M3 — Defaults cover the boring 90%; you author only the unique move.** Every
unit gets `idle` (bob) + `attack` (the existing `swingProgress` swing) FREE. A
new unit authors *nothing* to animate normally — only a clip for its signature.

**Ability binds by ONE data field** (same convention as `fx:`):
```ts
stampede: { …, fx: { kind: 'shockwave' }, anim: 'charge' }
```

### Worked example — Goliath's Stampede (the whole authoring cost)
```ts
// goliath.ts — co-located with the unit's appearance, ONE line:
signatureAnim: charge({ rear: 0.3, lunge: 0.6 }),  // rear back → lunge forward → settle
```
`charge` (a shared primitive) handles rear(windup)→lunge(active)→settle(recover)
from the clip phase; the author tunes two numbers. The shockwave + damage fire
from the SIM at the lunge peak (see Part 2). That's it — no timing code, no
state-machine, no wiring beyond the `anim: 'charge'` field on the ability.

---

## PART 2 — The internals (in service of the authoring)

**Clip model.** `{ name, phases: {windup,active,recover}, loop?, priority }`.
Clips: `idle`(loop) · `attack` · `signature` · `hit`(flinch) · `death`. Unit
declares only its custom clips; the rest are engine defaults.

**Animation controller** (on `Unit`, presentation-only): tracks the current
clip + elapsed + phase; `update()` ticks it; the draw reads it. Priority picks
the active clip: **death > hit > signature > attack > idle** (hit briefly
interrupts; death overrides all).

**Where timing comes from — the load-bearing split:**
- **Gameplay clips** (`attack`, `signature`) read **sim** timers, so the visual
  *active frame* lines up with the gameplay hit. `attack` derives from
  `foreswing/backswing` (already real); `signature` needs a sim **windup→impact**
  timer (the phase-timing piece `FX_SYSTEM.md` flagged — add it here).
- **Cosmetic clips** (`idle`, `hit`, `death`) own their own presentation timer
  (no gameplay timing involved).

**The draw reads it.** `RenderUnit` carries the anim signal
(`{ clip, t, phase, phaseT }`) — generalizing today's `windup/recover` (which
become the `attack` clip's phase data; migrate, don't duplicate). The draw fn /
motion primitive maps it to a pose.

**Events fire from the SIM, not the animation.** At a phase boundary the **sim**
queues the damage + emits the cast-FX (the Stampede shockwave). The animation
reads the *same* sim phase and shows the lunge at that instant — **synced via a
shared clock, not the animation triggering gameplay.** This is what keeps the
boundary clean.

---

## The load-bearing invariant (prevents the worst debt)

**The sim owns gameplay timing; the animation is presentation reading it.**
Fighting games fuse "active frames = hitbox"; we must NOT. Gameplay-relevant
timing (`foreswing`, signature `windup`) lives in the sim — it decides *when
damage lands*, is deterministic, and is covered by the 632 tests. The
clip→pose mapping is presentation, **off in tests**, and never read by the sim.
Animation-off → sim timing unchanged → tests green. One-way, always.

## Build order

1. **Motion-primitive library** (`units/motions.ts`) — `charge/lunge/rear/recoil/
   shake`, each `(phase, t) → transform`. Testable pure functions.
2. **Animation controller** on `Unit` + `RenderUnit.anim` (fold `windup/recover`
   into the `attack` clip). tsc + 632 green, animation-off no-ops.
3. **Sim signature windup→impact timing** (the phase model) — Stampede telegraphs,
   then the shockwave + damage fire at the peak.
4. **Goliath `charge`** as the reference clip — author it, tune by eye (MCP).
5. Every later unit/move = a primitive + params (or a small pose fn). Zero
   architecture cost.

## Open questions (resolve when the case needs it)

- **Cancels / interrupt windows** (can a hit cancel a signature mid-windup?) —
  a fighting-game depth knob; default = signatures uninterruptible, defer the rest.
- **Per-clip event lists** vs the sim owning all events — start with sim-owned
  (simplest, cleanest boundary); add author-declared cosmetic events only if needed.
- **Blending** between clips (smooth idle→attack) — defer; hard-swap is fine to start.
