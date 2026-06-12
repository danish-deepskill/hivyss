# FX System — Architecture Contract (ability animations / juice)

> **Status:** Designed + **BUILT 2026-06-01** (reference renderer live, verified
> on-screen). Shipped: `FxDirector` (pool + budget + registry, `systems/FxDirector.ts`)
> · `shockwave` renderer (`systems/FxRenderers.ts`) · per-hit `setImpactFxDispatcher`
> + per-cast `setCastFxDispatcher` seams in `CombatSystem` (no-op default, stubbable)
> · Stampede tagged `fx:{kind:'shockwave'}`, cohesion-scaled, wired in `SandboxScene`.
> **Next:** per-dmgType default impact renderers · migrate the 5 legacy dispatchers ·
> grow the primitive vocabulary · WorldScene wiring. **Pairs with:** `DESIGN_PATTERNS.md`.

## The frame: sim → presentation seam

"Animation" here = the **presentation layer reacting to simulation signals**.
The sim emits *"ability X fired by U at P with magnitude M"*; presentation
decides how it **looks**. The sim never knows about visuals; visuals never
touch the sim. Animation = **procedural redraw from a 0→1 progress value**
(the bob / swingProgress / dmgFlash / cohesion-glow technique, generalized).

## The four homes (route every visual to exactly ONE — do not merge)

A visual belongs to one layer, decided by its **lifecycle** + whether it
**carries gameplay**. Routing it wrong is debt, so this table is load-bearing —
nothing about an ability's visual gets built without first answering "which home?"

| Visual | Lifecycle | Gameplay? | Home |
|---|---|---|---|
| impact spark, shockwave, projectile, death-burst | one-shot, fire-and-forget | no | **`FxDirector`** (new) |
| burn/frost/stun aura, **buff indicator** (rally-affected ally), cohesion glow | persistent, follows a unit | no | **`Unit.redraw()`** (existing) |
| wall, acid pool, lingering scent-zone | persistent, in the world | **yes** (blocks/damages) | **`WorldEntity`** (existing) |
| hitstop, screen flash, camera shake/kick | transient, global | no | **camera/global layer** |

**The fences (each prevents a specific debt):**
- `FxDirector` is **non-gameplay one-shots ONLY**. It never owns anything that
  damages, blocks, or stays attached to a unit. A damaging acid pool *looks*
  like an FX but is a `WorldEntity` — putting it in FxDirector would split its
  gameplay from its visual. Hard line.
- **Unit-attached persistent visuals (status AND buffs)** live in `Unit.redraw()`
  reading effect/modifier state — where slow-tint + cohesion-glow already are.
  A buff indicator = *"do I carry a positive aura modifier?"* → draw it.
  Data-driven: any buff source (Centurion rally, future amps) lights it up; it
  is not per-ability code.
- **Persistent world effects with gameplay** (walls, pools, zones) are
  `WorldEntity`s; their visual is part of that entity's own draw. FxDirector
  is not involved.
- **Global/camera effects** (hitstop, flash, shake) are a thin global layer the
  signal can also trigger — distinct from per-FX renderers (they affect the
  whole frame, not one spot).

**Centurion's rally spans homes by design** — and that's the proof the split is
right: a one-shot command **pulse** (`FxDirector`) + a persistent **buff glow**
on each affected ally (`Unit.redraw`). One cast, two layers.

## Locked decisions

- **A1 — One seam.** A single stubbable `FxDirector.play(signal)` singleton
  (no-op by default; the scene installs the real one — same pattern as the
  existing `set*Dispatcher` hooks). The 5 legacy dispatchers (stun, stagger,
  dot, heal, death) get **absorbed incrementally**, not ripped out. Adding an
  FX = registering a renderer (open/closed).
- **A2 — Signal payload** (flat data, NO Unit refs):
  `{ kind, x, y, tx?, ty?, color?, magnitude?, abilityId? }`.
  `magnitude` is the scalar that scales the visual (cohesion → shockwave
  radius, damage → flash size, stacks → intensity).
- **B1 — Descriptor: default-by-`dmgType` + optional `AbilityDef.fx` override**
  (same 3-state convention as `appliesEffects`: undefined → dmgType default,
  `fx:{...}` → signature override). Every ability gets a decent visual free.
  Emitted from the pipeline's existing **impact phase**.
- **E1 — Pooling.** Pooled `FxInstance` free-list (`active` flag +
  `update(dt)→done`); never new/destroy mid-fight (the `UnitPool` discipline).
- **E2 — Budget.** Central hard caps (concurrent-FX + particles) as tunable
  constants; over-budget → evict oldest/lowest-priority (signature > ambient);
  cull off-screen FX. Numbers set by **profiling**, not guessing.
- **F1 — Determinism (non-negotiable).** Signal is one-way; sim never reads FX
  back, FX never mutates sim. Tests run FX-off (no-op stub) → 632 stay green.

## Layers (each one job)

```
sim (pipeline impact phase) ─play(signal)→ FxDirector → renderer(by kind) → primitive → FX layer (draw)
                                              │
                                       pool + budget (caps, cull, evict)
Unit.redraw() ─reads effect state→ persistent status visuals   (separate, unchanged)
```

- **`FxDirector`** — the seam: `play(signal)`, owns pool + budget + renderer
  registry. Stubbable singleton.
- **`FxSignal`** — the flat one-shot payload (incl. `magnitude`).
- **Renderers** — `(fx, dt, g) => void`, registered per `kind`
  (`impact` · `projectile` · `burst` · `shockwave` · `beam` …).
- **Primitives** — shared draw helpers (ring, arc, tracer, spray) over the
  Phaser Canvas Graphics API (`strokeCircle`, `arc`, `lineBetween`, …).
- **Status visuals** — stay in `Unit.redraw()` (untouched).

## Build order

1. **Reference renderer: Stampede shockwave** — `kind:'shockwave'`,
   `magnitude:cohesion`; one pooled growing ring (`strokeCircle`, radius =
   `maxR * easeOut(t)`, alpha = `1-t`). Proves the seam end-to-end.
   *(Pairs with cohesion-scaling Stampede's damage — same `cohesionLevel()`.)*
2. Establish the **budget** (particle/concurrent caps) in the same pass.
3. Add the **dmgType default FX** map (free visuals for every ability).
4. **Migrate** the 5 legacy dispatchers into the director opportunistically.
5. Grow the **primitive vocabulary** (projectile, slash arc, burst) as
   abilities need them.

## Known debt — flagged, not hidden (2026-06-11, the Fire Bite work)

Two pragmatic shortcuts taken while wiring Cinderfly's Fire Bite + the burn
overlay. Both **followed an existing pattern instead of building the better
one** — fine for the scope, recorded so they're not lost:

1. **FX-field naming asymmetry.** The dispatch model has two seams (cast +
   impact); the data model now has `AbilityDef.fx` (cast) + `AbilityDef.impactFx`
   (impact). Giving the impact seam its own field was the *correct*
   disambiguation (signatures reading `fx` would double-fire per-hit), but the
   names are asymmetric. **Clean fix:** rename `fx` → `castFx` so it reads
   `castFx`/`impactFx`. Deferred only to avoid churning every existing `fx` use.

2. **Effect visuals are inline in `Unit.redraw()`, not a registry.** The burn
   overlay was added alongside the existing inline overlays (slow tint,
   dmgFlash, enrage sheen, cohesion/phase-2 halos) in `entities/Unit.ts`. The
   docs describe a designed-but-unbuilt **`EffectVisualSystem`** — a registry
   `effect → (g, u, t) => void`, the same shape as `FxRenderers` /
   `PASSIVE_HANDLERS`. **Trigger to build it:** when effect-visuals reach ~3-4
   (burn is #1 of the *status*-effect kind), stop adding inline blocks and
   build the registry, migrating slow/burn/enrage/dmgFlash into entries. Each
   new inline overlay is one more thing that refactor reclaims.

## Open design questions (resolve before the cases they gate — not before)

These are honestly **unsolved**, not hidden. Each is fine to defer *only* until
an ability needs it; none is load-bearing for the Stampede reference.

1. **Phase / channeled timing — the main unsolved piece.** One-shots are
   impact-shaped today. Multi-beat sequences (windup→impact→aftermath as timed
   beats) and **sustained** effects (channeled beam, flamethrower, a held
   telegraph) need a timing model the current "fire one-shot, play to `t=1`"
   shape doesn't cover. **Resolve before building any ability that telegraphs
   or sustains.** (A lingering *world* effect like an acid pool is NOT this —
   that's a `WorldEntity`; this is about FX that have internal phases.)
2. **FX↔SFX coupling** — does one signal drive audio too? Likely yes; decide
   when the first sound lands so cue timing is shared, not bolted on.
3. **Primitive vocabulary v1** — which primitives ship first (ring, arc,
   tracer, spray…). Decide per ability need, not speculatively.

Tooling note: the **Playwright MCP (vision)** is live (2026-06-01) — the visual
loop is screenshot-driven; tune the reference renderer by eye, not by guess.
