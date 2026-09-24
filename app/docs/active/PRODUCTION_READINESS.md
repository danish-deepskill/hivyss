# Production Readiness — what "shippable" means, and in what order (2026-06-15)

> **Why this exists:** captured after a long rendering/perf + design thread. The
> value of this doc is the **ORDER**, not the checklist — most of what follows is
> *premature until the loop is proven fun.* Pairs with `app/docs/mvp/VISION.md §10-11`
> (MVP slice + build order) and `SWARM_COMBAT_DIRECTION.md` (the open forks).

---

## The one principle: fun gates everything

"Production ready" is **not** a rendering question. The gates, in hard priority order:

> **Gate 0 (fun) → Gate 1 (the game exists) → Gate 2 (technical hardening) → Gate 3 (release) → Gate 4 (polish).**

The trap this doc exists to prevent: **rabbit-holing on rendering/perf (Canvas→WebGL,
300 units) before the loop is proven fun.** The renderer decides how *big* you can
scale; the loop decides whether the game is *worth* playing. Never optimize the
second before securing the first.

## "Production ready" means different things per platform

| Target | The bar | Renderer note |
|---|---|---|
| **itch.io** (demo / prototype / EA) | lowest — *does it build to HTML5 and play?* | **Canvas is fine; the current renderer ships.** Ready ~whenever a playable slice exists. |
| **Steam** (premium / EA) | higher — needs the **run loop + proven fun + content + onboarding + store page** | Canvas OK *if* unit counts stay modest. |
| **Mobile** (F2P or premium) | perf-sensitive + touch + compliance + (F2P) monetization | Canvas is weak on mobile → a **big swarm here forces the sprite+WebGL migration**. |

---

## Gate 0 — Prove it's fun + unblock  *(DO THIS FIRST)*
*Status: UNGATED — the #1 risk, still unanswered.*
- [ ] **Prove the core loop is fun** — a tight vertical slice: build hive → deploy →
  economy → battle → win/lose. If this isn't fun, fix it before anything below.
- [ ] **Resolve the blocking forks** (they gate *what* you build): perspective/lanes
  (1-lane×strata vs 2.5D field), persistent-vs-per-run, mobile-first vs mobile-also.
  See `SWARM_COMBAT_DIRECTION.md`.

## Gate 1 — The game exists (the run, not just a battle)
*Status: **BUILT (thin) — corrected 2026-06-15.** A complete run loop EXISTS and is wired:
`RunController` + `NodeMapScene` + `RewardScene` + `BattleScene` + `RunState` + `LayerDefs` —
node map → battle → reward → next node → next-layer / run-complete, with branching paths
(StS-style sibling-gating), layer progression, permadeath/persistent modes, rewards (units +
building buffs), and roster growth. The gap is **content + reconciliation, NOT architecture.**
The earlier "only a battle substrate" framing was stale.*
- [x] **The run loop** — built + wired (`RunController`).
- [ ] **Content** — currently ONLY layer `'1'` (6 nodes, normal→alpha); its terminal nodes point
  to `'2A'/'2B'` which are **undefined**, so a run ends after one layer. Extend via `LayerDefs`
  DATA (data-driven — "add a layer = add data, no code"). *This* is the real Gate-1 gap.
- [ ] **Onboarding / first-time UX** — a tutorial or guided first run. *Accessibility is the
  audience gate.*
- [ ] **Reconcile the built loop with the new direction** — its persistent/permadeath modes,
  `vhyst` reward nodes, and node model vs the 1-lane × strata / two-game / genelines-as-keys /
  depth-leaderboard plan. Check what the loop assumes against the new design.

## Gate 2 — Technical production-hardening
*Status: partial — pooling (`UnitPool`) + `SpatialIndex` good; rendering NOT migrated.*
- [ ] **Rendering — ONLY if committing to swarm scale (100+ units):** migrate per-frame
  Graphics → **baked sprite atlas + WebGL + batching** (the 300-unit path). Skip if
  counts stay modest. *Two changes are a package: cached sprites AND WebGL.*
- [ ] **Sim stays O(n·k), never O(n²)** — targeting + the boids separation/weight go
  through `SpatialIndex` (90k all-pairs checks/frame at 300 units would choke regardless
  of rendering).
- [ ] **FX pooled + capped; HP bars cheap** (pooled / drawn only-when-damaged).
- [ ] **Perf validated on min-spec** — the ~1-hour WebGL spike at target count, *on the
  weakest device* (especially mobile), BEFORE building content that assumes the count.
- [ ] **Save/load** — run persistence + settings.
- [ ] **Stability** — no crashes/leaks across long sessions; error boundaries; the pool
  already mitigates churn.
- [ ] **Production build** — `vite build`, atlas/asset optimization, bundle-size +
  load-time check.

## Gate 3 — Platform / release readiness
*Status: not started (pre-product).*
- [ ] **Pick the platform + its requirements** (itch / Steam / mobile — each differs).
- [ ] **Settings/options** — audio, resolution, controls, basic accessibility.
- [ ] **Input** — mouse + touch (if mobile); verify `Scale.FIT` across devices/aspect ratios.
- [ ] **Audio** — SFX + music pass (currently minimal).
- [ ] **Store presence** — capsule/cover art, screenshots, trailer, description, (Steam) page.
- [ ] **Compliance** (if commercial) — privacy, store policies; mobile store rules;
  monetization plumbing if F2P.

## Gate 4 — Polish + QA
*Status: pre-product.*
- [ ] **Balance pass** — genelines, economy, the difficulty/depth curve.
- [ ] **Game feel / juice / VFX / UI polish.**
- [ ] **QA / playtest pass** — bugs, edge cases, a few external testers.

---

## Where you are now (honest snapshot, 2026-06-15)
- **Technically shippable to itch.io TODAY** as a prototype — Canvas builds + runs; the
  renderer is *not* a blocker at current scale.
- **Not yet a finished product** — but further along than the old framing claimed: the **run
  loop is built (thin)**, so the gap is **Gate 0 (prove the run is fun — now *testable*, just
  play NEW RUN)** + **Gate 1 CONTENT (extend the one-layer run + reconcile it with the new
  direction)**, **not** building a run from scratch and **not** rendering.
- The rendering migration (Gate 2) is a **known, standard, later** optimization, reached
  only **if** you commit to big swarms — it is not a reason you can't ship.

> **The single most important line in this doc:** keep your effort on **Gate 0 (is the
> loop fun)** until it's answered. Everything below it is premature until then.
