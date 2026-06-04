# Hivyss — Game Vision & MVP Slice (design capture)

> **Status:** **AUTHORITATIVE — newest top-level design (2026-06-03).** The **destination** (full-game vision) + the **MVP slice** (§10) + the **build order** (§11). **Where this conflicts with earlier scope docs, this wins** — notably it *expands* the MVP to make the **hive-build loop + a thin controllable Royal core** (which `REQUIREMENTS` had deferred; that doc is now updated to match). It **defers to `GENELINES`** for geneline-roster + node-map + biome *content* detail.
>
> **Pairs with:** `GENELINES.md` (geneline/map content) · `REQUIREMENTS.md` (budget/constraints) · `ALPHA.md` · `reference/TIER_CONTRACT.md` · `lore/HIVYSS.md`.
>
> **Markers:** **[LOCKED]** decided · **[LEAN]** recommended, not final · **[OPEN]** unresolved.

---

## 0. The one-line identity [LOCKED]

> Hivyss = **build a hive, deploy it, fight, grow it.**

A **lane-autobattler** core (Battle Cats DNA — *you command, you don't micro*) with **RTS macro** (economy, the hive loadout, SC2-commander-distinct genelines) and a **MOBA-lite hero** (the controllable Royal). **The hive-build is the hook as much as the combat** — neither alone is Hivyss.

---

## 1. The core loop — two nested arcs [LOCKED]

| | Per-battle arc | Per-run arc |
|---|---|---|
| Timescale | ~minutes (one fight) | hours (the run) |
| Phases | **open → build → climax** | early → mid → late **run** |
| Driven by | economy ramp + Royal charge + hive maturation | hive-building + gene acquisition |

- **Per-battle = a self-contained small→big arc**, gated by **3-4 hive-maturation phases** (see §2.1). Every battle is a full open→build→climax, regardless of where you are in the run.
- **NOT unit XP.** In-battle "leveling" is **hive tiers** (RTS tech-up), not per-unit RPG XP. The Royal levels *with* the hive phases, not on a separate bar.
- The run changes *what you bring*; the battle arc is the *same shape* every time.

---

## 2. The Hive = a bounded loadout around the Royal [LOCKED concept]

**Keystone:** **Royal → Hive → Roster.** The Royal carries the genes → the Hive turns them into units → the Roster is what you deploy. That's why there's exactly **one** Royal: she's the irreplaceable keystone, everything else configured around her.

**The loadout (a deckbuilder, composed between battles):**

| Slot | Count [LEAN] |
|---|---|
| Royal | **1** (keystone) |
| Elites | **2** |
| Soldiers | N (the bulk) |
| Workers | scout · gatherer · builder |
| Hive abilities | **2** (geneline-specific) |
| Pheromone commands | **2** (pick from your scout pool) |
| Buildings | **2** (builder-placed) |

The 2s are **lean capacity**, not a sacred number — keep the control surface tight, but let a slot be 3 or 1 if the gameplay wants it (`bounded ≠ symmetric`). Over a run you *acquire* more than you can field; the loadout choice is the strategy.

### 2.1 In-battle hive maturation [LEAN]
The captured/young hive **matures through 3-4 discrete phases** during a battle (RTS tech-tiers): e.g. Phase 1 fodder only → Phase 2 unlock Elites → Phase 3 the Royal's ultimate. **Phases advance by player investment** (spend larva/nectar to tech up) — the classic *tech-up vs pump-units* decision. (Avoid "mature by winning" as the *only* driver — it snowballs.)

---

## 3. The Royal (keystone hero) [LOCKED concept]

- **Controllable hero** (WC3-style), on the field from the start. The army's anchor.
- **Individual + respawn** — named, quality-rolled; on death a **next-lineage royal** respawns on a timer. (Lore `TIER_CONTRACT §11`: 4-mode + 5-facet style package — full version deferred.)
- **On Royal death:** her geneline's hook doesn't switch off — it **drops to baseline** (she's an *amplifier*, not the source) **+ a "leaderless" debuff** until the next lineage arrives. Real, felt, recoverable — and makes her the #1 protect-target.

---

## 4. Castes [LOCKED]

`soldier · elite · royal · worker` — orthogonal to tier (a T3 soldier and T3 elite share a complexity budget, differ in *control*).

- **Soldier** — auto-fight, the bulk. Plain HP bar.
- **Elite** — premium, distinguished two ways: **(1) a player-triggered signature** (Stampede, Ram) **+ (2) a passive phase-2 at a per-Elite HP threshold** (enrage — *default ~50%, but configurable*: a fragile Elite might flip at 30%, a tank at 66%). The *rule* is uniform (Elites enrage); the *threshold + content* are per-Elite (Goliath low → cohesion-amp spikes; Maulhorn low → faster rams). **The HP bar shows a vertical divider at that threshold** so the two-phase boss reads at a glance (soldiers get a plain bar). *(Engine: today's `hp_below_half` predicate is the fixed-50% version — Ravager's pattern in `archive.ts`. The Elite rule needs it **parameterized into a `phaseThreshold` field**, and the bar divider drawn at that value.)*
- **Royal** — §3.
- **Worker** — one caste, **three jobs**: **scout** (pheromone — built, P1), **gatherer** (active nectar), **builder** (places the 2 buildings). Non-combatant; killable; the hive's labor.

---

## 5. Pheromones — the deposit-fade model [LOCKED]

A command is delivered by a **Scout (worker)** that couriers from the hive to a player-selected target, laying a **fading fog-trail** as it runs.

- **Fog, not a ring.** Visually a drifting scent trail (1D segments along the lane).
- **Proportional deposit** — the fog exists exactly as far as the Scout physically got. Dies at the center of the target radius → half-covered; a quarter in → a quarter. No thresholds, a smooth gradient. **The command IS the Scout's live trail.**
- **Then it fades** on its own timer, Scout-independent (real pheromone lingers; killing the Scout *after* it laid the trail doesn't erase it).
- **Counterplay = the run.** Intercept the courier *before* it lays the scent to thin/deny it; after, you're too late.
- **Not OP, no invented nerf:** the fog fades (temporary), and re-deposit costs another vulnerable Scout. Balance = the distance it survives + the fade duration.
- **Base commands** (Rally = gather/hold · Charge = advance faster · Retreat = fall back — *flip facing to actually run away*) are muddy/overlapping; you field **2 of a growing pool**, and the depth moves to **per-geneline signature pheromones** (§6).

---

## 6. Geneline distinctness framework [LOCKED principle]

**North star: SC2 Co-op commanders** (each a different *way to play*) **on a Dota-clean bounded frame.** Uniqueness lives in the **army model + economy + verb**, NOT the unit stats.

**Four axes** — pick a *distinct corner* per geneline:
1. **Army model** — herd · swarm · few tanks · formation · hero-squad · one giant · spawners.
2. **Economy** — incubation · corpses · free spawn · mutation · fusion.
3. **Death stance** — alive-to-strike · cheap-and-dying · never-die · die-and-feed.
4. **Verb** — commit · sacrifice · hold · position · consume · sync · fuse · mutate.

> **Discipline: two genelines may share an axis — never all four.** When two *feel* the same, shove one into an unused corner.

The 4 MVP genelines (locked): **α** massed herd / alive / *commit* · **β** swarm / dying / *sacrifice* · **γ** walls / never-die / *hold* · **δ** formation / disciplined / *position + range*. Reserve the top of the alphabet (**ρ Rho / the Core**) for the **"breaks the rules" tier** — the Invoker/Primordial that violates the framework.

**Signature expressions** (each geneline's verb in 3 forms — α example):
- **Building** — *Spawning Mound* (forward burrow, deploy closer to the front).
- **Pheromone** — *Frenzy Musk* (units cash cohesion into a charge surge).
- **Hive ability** — *Tremor* (blunt AOE god-power, clears a path).
Each is distinct in *effect*, not just flavor — the test for whether a layer earns its existence.

---

## 7. Hive abilities [LOCKED principle]

= the **SC2 top-bar**: **geneline-specific** instant/cooldown god-powers, **not a shared set**. (The old `nuke/wall/slow/repair` placeholders are scrapped.) Count stays small (~2); content is bespoke per geneline. Keep them to things pheromones/Elites *can't* do (direct top-down power vs herd-command vs unit-trigger), so the layers don't blur.

---

## 8. The battlefield — the "between" [LEAN]

Two hives at the ends; the game is making the corridor between them *not empty*:
- **3 route-bands** — air (above) · land (mid) · tunnel (below). Verticality without a 2D map.
- **No-man's-land** — the shifting clash line (the core tug-of-war).
- **Forward structures + enemy defenses** → "march to their base" becomes a **siege** with intermediate goals.
- **One central contested objective** — a neutral buff-camp both sides fight over (the lane's "Baron"). *Not* ambient filler.
- **Biome terrain** — the environmental rule made physical (choke favors γ / open favors α). The matchup, placed on the field.
- **Normal-as-creeps** — the wild substrate; great as **node defenders** (map scale), used sparingly in-lane (only as the contested objective).

### 8.1 Lanes — **2 lanes [LOCKED** per `REQUIREMENTS §5` + lore §8]; *interactive* [LEAN]
The **2-lane count is locked.** The open refinement is whether the lanes **interact**: cross-lane tools (a **spire that targets by range, not lane**; **knockback** that punts across) make 2 lanes worth their legibility tax — two *independent* lanes are just two 1-lane games. Cross-lane fire must be *visually readable* (clear beam/projectile). **[LEAN: interactive; confirm at playtest.]**

---

## 9. Buildings [LOCKED concept]

Builder-worker places persistent field structures (the "2 buildings" slot). **Spires** (offensive turrets — see §8.1 cross-lane) and **walls** (defensive) are *buildings*, not hive abilities — which resolves the old "hive-Wall ability vs worker-wall" overlap. γ Fortress leans hardest on walls (its identity).

---

## 10. The MVP slice — in vs out [LOCKED intent]

> **`GENELINES.md` is the source of truth for the geneline roster (4 — α/β/γ/δ), the node/territory map, biomes, and the faction layer.** This section does NOT restate them — it adds the *loop / hive / Royal / pheromone / caste / worker* systems on top. **Where the two differ, GENELINES wins.**

The MVP is a **vertical slice**: the *systems* (the shape of the real game) at **minimal content** — meaning **the 4 MVP genelines (not 24)** and the **designed node map (not the full overworld)**, no future features. **Hive-building is a core pillar, not deferred** — what's thin is the *shelf you choose from*, not the loop.

| System | **In (MVP slice)** | **Out (content / future)** |
|---|---|---|
| Genelines | **4** — α/β/γ/δ (`GENELINES §1`) | the other 20; the 4-vs-6 question (`§8` OPEN) |
| Royal | **1** controllable + **1** ultimate | full 4-mode + 5-facet style |
| Hive-build loop | **core** — compose / deploy / mature / grow | deep deckbuild, gene-library depth |
| Pheromones | **1-2** base commands (deposit-fade Scout) | per-geneline signature pheromones |
| Workers | **scout · gatherer · builder** (the full caste) | specialist workers (Engineer, etc.) |
| Buildings | **1-2** (spire, wall) | the full set |
| Maturation | **3-4 hive phases** | — (core) |
| Lanes | **2 interactive + 1 cross-lane tool** | — (foundational) |
| Run / map | the **node/territory map** — Forage→Warren→Hive funnel, biomes, node types `◦Wild/vhyst` (`GENELINES §5-6`) | live 7-faction rep engine · other realms · live alliances |
| Field | **1 central objective + biome terrain** | events, full biome rules |

**Cut from MVP entirely:** mutation · evolution · live faction/rep engine · other realms · corruption · soul graft · hive rooms · **the other 20 genelines**.

> **✅ RESOLVED 2026-06-03 → (A): the MVP expands.** `VISION` is the newest authority, so the **hive-build loop + a thin controllable Royal + maturation phases are MVP-core.** `REQUIREMENTS` is updated to match — its §7 now defers only the *full* 4-mode Royal + 5-facet styling, not the thin versions. **The combat-first gate still holds:** Phase 0 is still "prove the α fight is fun" (§11); the hive-build loop is the co-core built *right after*, not before.
>
> **Still OPEN — tier ceiling:** `REQUIREMENTS §4-5` says "1 T4 Elite per geneline," but α ships **T2 Elites + a T3 Royal, no T4** (`GENELINES §2`). Decide whether α's Elites are T4 (per the budget) or the roster's T2/T3 stands.

---

## 11. Build order [LOCKED]

Even in a slice, sequence by **de-risk**, not importance:

> **fight (get it fun) → hive-build loop (the co-core) → the run (the `GENELINES §5-6` territory map, thin node-count first).**

Combat goes first **not because it outranks the hive, but because the hive feeds it** — every hive-build choice only matters if the fight it pours into is good. Both are the core.

**Scope is 4 genelines; *sequence* is α-first.** Build **α** first to validate the fight, then **β/γ/δ** — don't confuse the build order with a smaller MVP. The map is *designed* (`GENELINES`); you build it thin (few nodes) first, then flesh it.

**The #1 risk (sharpened):** not "is the *combat* fun" but **"is the build-a-hive-and-fight *loop* fun."** Still **UNTESTED.** Everything in this doc is worthless until that's answered — *do not let design depth keep front-running the playtest.*

---

## 12. Principles [LOCKED]

- **Bounded everything** — small, deliberate loadouts/interfaces; depth from *combinations*, not slot count (Invoker: bounded interface, unbounded combos).
- **Duality is a theme, not a law** — main/dark, normal/mutated are *real* opposites (lean in); the loadout-2s are just capacity (don't sacralize). Don't force symmetry over gameplay.
- **Absorb, don't add** — one system soaks up many lore ideas: spires/walls → buildings; mutation → a geneline; quality → the Individual layer; evolution → the hive-build. Not one system per lore bullet.

---

## 13. Design references (where the decisions came from)

- **Battle Cats** — the lane-autobattler base + in-battle economy ramp (the "wallet," not unit XP).
- **Dota 2** — bounded slots (4 + ult), depth from *combination* (Invoker: 3 orbs → 10 spells on a fixed interface).
- **SC2 Co-op (18 commanders)** — the north star for geneline distinctness: radically different *ways to play* on a shared skeleton. The top-bar = hive abilities (bespoke per commander).
- **Warcraft III** — the **Hero** model → the Royal (small force + a growing hero + items/grafts); Undead corpses → β/θ death-genelines; Night Elf living buildings/wisps → buildings + builder-worker; upkeep → soft capacity; creep camps → node-clearing loot.
