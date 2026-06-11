# SESSION HANDOFF — state as of 2026-06-11 (the "economy era" session)

> **Read me first, then:** `CLAUDE.md` (currency + architecture decisions are CURRENT),
> `docs/mvp/MECHANICS_INVENTORY.md` (status audit — re-audited today),
> `docs/reference/DESIGN_PATTERNS.md` §6.1 (BattleCore), `docs/mvp/GENELINES.md`
> (β BUILT + the three 2026-06-11 rulings). Those docs are the truth; this file
> is the map of what changed and what's hot.

## What exists now (all gate-green: tsc + 654 tests; committed through 422007c)

1. **BattleCore substrate** — ONE battle core (units/pool/spatial/combat/zones)
   under TWO drivers: GameManager (real run) + SandboxScene (lab). Never add
   battle state to a driver. Extractions: `RoyalLifecycle`, `Forage`,
   `Maturation`, `VyssEconomy`, `BattleDebugCommands`, `ui/UnitPreviews`.
2. **The Royal system** (α Matriarch): click-select → move/focus, lane-switch
   (speed-scaled; mid-cross her combat row follows her BODY), Primal Roar ult,
   death → leaderless → respawn, Dota-style HUD portrait + silver Elite
   portraits. She spawns holding at the hive, never auto-marches.
3. **The economy era** (knobs in `ForageDefs`/`VyssDefs`/`MaturationDefs`):
   - **Nectar** = BUILT income: gatherer workers ↔ seeded/depleting/reseeding
     blooms (rich ones deeper; reseeds center-biased = the soft Baron);
     passive is a phase-scaled floor (1→2→3/s). G-mode (G key) sets gather
     priority / corpse-scavenge stance, full fallback chains, raid alerts.
   - **Vyss ✦** = tactical currency: deaths drop corpse pickups → gatherers
     scavenge them home → vyss funds pheromones + hive abilities (+ maturation,
     the ONE bounded tech exception). Kill-nectar is GONE (anti-snowball).
   - **Maturation**: Early/Mid/Late by SPENDING (250⬡+1🐛+20✦ / 450⬡+2🐛+40✦);
     gates deploy tiers (1/2/all), grows capacity (12/16/20), steps the passive
     floor, Late awakens the Royal ult (🔒Late until then). MATURE button.
4. **β Swarm BUILT** (8 individually-authored bodies — the design bar), Fetid
   Pool biome, generative spawn engine (spawn dispatcher seam + `spawner`
   passive), Tide sacrifice (≠ death, BY DESIGN: no corpses/triggers),
   deathFeed gorging (visible belly), poison DOT wired game-wide, swarmling
   cap 0.5 / spawned units cap 0. β = sandbox + enemy content until the
   geneline picker exists.
5. **Frenzy Musk** — α's signature pheromone (key 4/F, 12✦): cohesion carriers
   CASH the banked pack-bonus into a doubled frozen 4s surge (live tracking
   suppressed = the spend). Distinct from Primal Roar (which SETS max).
6. **Workers in the deploy bar**: Scout card + pheromone dot-selector,
   Gatherer card (30n + larva), Builder placeholder (locked, future job).

## Conscious asymmetries / watch-flags (decided, not bugs)
- **The AI** does NOT forage, scavenge, or mature (income ×0.7 patch only).
  The loudest debt — every economy feature widens it. AI-v2 work.
- Balance is first-pass everywhere. Named watches: Burster AOE-per-cost,
  "does teching feel mandatory at 250⬡?", Frenzy re-cashing while a unit
  stands in the zone (surge re-applies after each expiry).
- `RUN_MAX_TIER=3` in BroodScene is now INTENDED (Elites in the run deck,
  phase-locked at battle start — demonstrates maturation).
- The sandbox is deliberately ungated (no economy/maturation) — it's the lab.

## The queue (rough order)
1. Playtest verdicts on the economy era + maturation pacing (user drives;
   NEVER tell the user to playtest — they always do).
2. **γ Fortress** to the design bar (win-path ruling in GENELINES: reflect-
   attrition + never-die accumulation) → then **δ** (formation-breaks-on-
   displacement ruling in GENELINES).
3. Kit layer: Death-bloom / Spore Storm / Brood Pit (β), Tremor / Spawning
   Mound (α) — `MaturationPhase.unlocks` is the declared pacing hook.
4. **[OPEN] persistent-vs-per-run stable** — still blocks the node-map
   overhaul. A design decision only the user can make.

## Working agreements (also in user memory — honor them)
- **Design bar** (the user's words: "masterpiece"): name-true, individually-
  authored bodies; mechanics visible ON the body; fresh-sheet biomes;
  motif-rhyming (β + Fetid Pool = the benchmark). Never template-stamp —
  the drawHerd-config approach is what they rejected.
- **Real-flow framework**: every command = the full fallback chain (target →
  taken → next → exhausted → default), each link observable.
- **Geneline budget**: 24 genelines total — never spend a future geneline's
  identity corner patching the MVP-4 (air/tunnel/sync/advancing-structures
  are reserved).
- Windows gate: `cd /c/Files/Phaser/hivyss/app && ./node_modules/.bin/tsc.cmd
  --noEmit` then `./node_modules/.bin/vitest.cmd run` (= clean + 654 green).
  NEVER npm/npx (they spawn bash and fail).
- Visual checks: ASK THE USER for screenshots. Playwright is for STATE only,
  via the dev-only `window.__game` handle (game loop is rAF-throttled when
  the automation window is unfocused — timings are unjudgeable there).
- The user manages git — commit ONLY when told, stage explicitly (never -A;
  PNG test artifacts sit untracked at the repo root, leave them).
