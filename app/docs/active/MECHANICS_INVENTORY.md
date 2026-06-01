# Hivyss — Mechanics Inventory (lore vs. built)

> **Purpose:** Ground truth on *every* game mechanic the lore describes vs. what's actually implemented in code. Prevents designing the MVP around systems that don't exist (or rebuilding ones that do). Audited against `app/src/systems/` + keyword sweep + targeted code reads.
>
> **Pairs with:** `MVP_REQUIREMENTS.md` (what the MVP includes), `lore/HIVYSS.md` §8-11 (the full design).
>
> **Status:** Audited 2026-05-31; combat/caste rows updated 2026-06-02 (Elite trigger, 2-lane, pheromones, FX + unit-animation systems, α=8). Re-audit when systems land.

**Legend:** ✅ Built · 🟡 Foundation/partial · 📐 Designed in lore (not built) · 💡 Idea/sketch

---

## Combat layer (§8)

| Mechanic | Status | Notes |
|---|---|---|
| Core unit combat (deploy → fight → damage) | ✅ | `CombatSystem` + `CombatPipeline`, 647 tests |
| 9 damage types + 7 resistance tiers | ✅ | `config/combat/damageTypes`, `resistances` |
| Effects / DOT / CC (burn, stun, slow…) | ✅ | `EffectSystem` |
| Modifiers (buffs/debuffs) | ✅ | `ModifierSystem` |
| Resources (charges / overcharge) | ✅ | `ResourceSystem` |
| Passive behaviors (auras, self-mod, heal) | ✅ | `PassiveHandlers` registry (2026-05-30) |
| Foreswing/backswing timing + strike anim | ✅ | `swingProgress` / `getStrike` (2026-05-30) |
| FX one-shot system (impact / shockwave) | ✅ | `FxDirector` + renderers, pooled/budgeted/stubbable (2026-06-01) |
| Unit signature animations (procedural pose-from-t) | ✅ | `units/motions.ts` + `Unit` controller + sim windup→impact timing (2026-06-01) |
| Capacity (hard cap, ~20) | ✅ | `Capacity` |
| Routes (air / land / tunnel as height bands) | ✅ | `LANE` config = 3 routes × **2 lanes** now |
| 4 Hive abilities (nuke / wall / slow / repair) | ✅ | `AbilityManager` |
| Single combat mode + win/lose | ✅ | `gm.won`, `gameOver{winner}`, GameOverScene |
| **2-lane structure** | ✅ | built (`LANE_VERTICAL_SPAN`/`laneDepth`; cohesion is per-lane). Routes (height) ≠ lanes (the 2 rows). Lock 1-vs-2 still OPEN |
| **4 battle modes** (HivevHive/Siege/Defense/Clash) | 📐 | only ONE generic win/lose mode exists |
| **Pheromone command** (Rally/Charge/Retreat) | 🟡 | built in the sandbox as zones; worker-scout *emission* layer still 📐 |
| **Spires** (turrets) + **worker-built walls** | 📐 | not built (the *wall ability* exists; worker-walls don't) |

## Caste & control (§8)

| Mechanic | Status | Notes |
|---|---|---|
| Caste *data tag* on units | ✅ | `UnitDef.caste` field only |
| **Soldier** (auto-fight) | ✅ | = the default built unit behavior |
| **Worker** (gather / build / pheromone scouts) | 📐 | not built — zero worker units |
| **Elite** (player-triggered signature ability) | ✅ | trigger system + HUD slots built (cooldown + in-range gating); α signatures Goliath Stampede + Maulhorn Ram shipped. Enemy-AI trigger still 📐 |
| **Royal** (4-mode queen/avatar/hero, WASD control) | 📐 | not built |
| Royal Special Bar (charge → ultimate) | 📐 | not built |
| Player control surface (5 categories) | 🟡 | **deploy + hive abilities + pheromones + Elite signatures** built (sandbox) |

## Economy & production

| Mechanic | Status | Notes |
|---|---|---|
| Nectar economy | ✅ | `EconomyManager` |
| Incubation (larva → hatch on timer) | ✅ | `IncubationManager` |
| Larva quality (weak/normal/strong + mutation chance) | 📐 | not built |
| Gene / vyss-egg / chamber tuning (reproduction loop) | 📐 | not built |

## Run / roguelike

| Mechanic | Status | Notes |
|---|---|---|
| Run system + node map | ✅ | `RunController` / `RunState` |
| Wave generation / management | ✅ | `WaveGenerator` / `WaveManager` |
| Seeded battles + save | ✅ | `SeededRNG` / `SaveManager` |
| AI opponent (Hive **v1**, weighted random) | ✅ | `AIHiveController` / `HiveProfileGenerator` |
| AI **v2** (smart, layered) | 📐 | DEFERRED |
| 6 anatomical layers (full structure) | 🟡 | node map exists; full layer model = designed |
| Node = cluster of 2-5 battles | 📐 | not built |
| Home-hive hub / fast-travel | 📐 | not built |

## Strategic overworld (§9) — none built

Step movement · event encounters (ambush/discovery/…) · **faction reputation (7 factions, matrix)** · quest system · territory & garrison (capture / broods / hostile raids) · allied factions / enemy offensives. → all **📐**

## Hive building & cross-cutting (§11) — almost none built

| Mechanic | Status | Notes |
|---|---|---|
| **Hive building** (rooms: Larva Chamber, Evolution Pit…) | 📐 | not built |
| **Hive styling** (Royal's 5-facet package) | 📐 | not built |
| **Gene library / acquisition** (9 paths, conquest loot) | 📐 | *the core of the MVP "acquisition" scope* |
| Gene-imprint extraction (conquest loot) | 📐 | not built |
| **Mutation** (mutagen scouts, mid-battle transform) | 📐 | not built |
| **Evolution** (unlock new units via branches) | 📐 | not built |
| Generic vs Individual unit identity | 🟡 | `UnitPersistent` type foundation only |
| Soul Graft (persistent grafted death-abilities) | 🟡 | `graftedDeathAbilities` field — foundation only |

## Realms & endings — only Main, partially

| Mechanic | Status | Notes |
|---|---|---|
| Main Hivyss (Greek genelines) | 🟡 | 2 of 24 built (Normal 11 + α 8) |
| Husk (Coptic) / Dark Realm (Phoenician) / Primordials (Archaic) | 📐 | maps generated, no content |
| Corruption axis (0-5) | 📐 | not built |
| 5 endings (iceberg) | 📐 | not built |

---

## What this means for the MVP

**The actual built core** (a playable autobattler-with-runs):
> combat engine · nectar economy · incubation · capacity · routes · run/wave loop · AI v1 · 4 hive abilities · save · single-lane single-mode win/lose

**Everything that makes Hivyss distinctive is designed-only:** pheromones, the caste control loop (worker/elite/royal), gene acquisition, hive building, factions, mutation, evolution, 2-lane, the strategic overworld, the other 3 realms.

So the MVP-mechanic question = **"built core + which 📐 systems do we pull in?"** And the chosen MVP scope (combat + run + **acquisition**) means **building the gene-library/acquisition system from scratch** — it's 📐, not ✅.

**LOCKED MVP mechanic frame (2026-05-31):**
- **In (built):** deploy · nectar/capacity · routes (air/land/tunnel) · 4 hive abilities · run/wave loop · AI v1 · single win/lose mode
- **In (to build):**
  - **Worker caste (base/universal)** — the agency foundation. Does TWO jobs: (a) **pheromone scout** — places/carries Rally/Charge/Retreat zones (vulnerable, killable → positioning matters); (b) **nectar gatherer** — active economy (gather + protect) vs passive trickle. Universal unit, shared across genelines (not α-specific). *Specialist/build workers (Engineer, etc.) stay deferred.*
  - **Pheromone command** — Rally/Charge/Retreat, emitted **via worker-scouts** (lore-native, not free placement). The active-agency layer.
  - **2-lane** — committed, but **sequenced**: built AFTER α's fun is validated in 1-lane first (doesn't block α design). *(UPDATE 2026-06-02: 2-lane was actually built ahead of this sequencing; the 1-vs-2 LOCK is still OPEN and α's fun is still untested — see `SESSION_HANDOFF.md §0`. The "add 2nd lane" step below is therefore already done, out of order.)*
  - **Elite signature** — player-triggered ability on the one T4 Elite per geneline.
  - **Gene acquisition** — the meta loop (build AFTER the fight is proven fun).
- **Defer (post-MVP):** Royal-hero · **specialist/build workers** (spires/walls) · hive-building · factions · mutation/evolution · other realms

**Build order** (per the priority discussion): mechanic-frame decision ✅ → **α roster design** (next) → build α + pheromones → feel-layer on α → playtest (1-lane) → add 2nd lane → acquisition.
