# MVP Genelines, Map & Factions — Design Reference

> **Status:** DRAFT, captured 2026-05-31. The consolidated MVP design: the 4 genelines, their rosters, biomes, the node/territory map, procedural generation, and the static faction layer.
>
> **Pairs with:** `MVP_REQUIREMENTS.md` (scope/budget) · `GENELINE_ALPHA.md` (α detail) · `reference/TIER_CONTRACT.md` (tier authoring) · `lore/HIVYSS.md` §3-8 (cosmology, grounded here).
>
> **Reading the markers:** **[LOCKED]** = decided, build to it. **[PROPOSED]** = first-pass, tune at the playtest. **[OPEN]** = unresolved.
>
> **The #1 rule above all of this:** the MVP exists to answer *"is the combat fun?"* Everything below is **designed now, built after combat is proven fun.** Don't let map/faction depth front-run the playtest.

---

## 1. The four genelines [LOCKED]

Lore-grounded (HIVYSS.md §7 theme table + §6 decision-loops). They differ by **role, not size** — the classic strategy triad plus a control axis:

> **α OFFENSE (rush) · β NUMBERS (swarm) · γ DEFENSE (turtle) · δ CONTROL/range (boss).**

**Size is a gradient that *reinforces* role — never the differentiator** (β small·many → α medium·standard → γ big·few). Crucially, **roles scale to all 24 genelines; sizes don't** — you can't tell a roster apart on size alone. (Counter-lean: §1.1.)

| Geneline | Role | Identity · size | Hook | Decision loop | Killed by |
|---|---|---|---|---|---|
| **α Primal** | **OFFENSE** (rush) | aggressive herd · **medium** | **Pack cohesion** = charge-synergy (commit as one) — *not* a swarm-buff | *when to commit the push* | AOE / scatter |
| **β Swarm** | **NUMBERS** (swarm) | the tide · **small·many** | **cheap expendable units + death effects** | *which deaths are productive* | AOE clear / sustain |
| **γ Fortress** | **DEFENSE** (turtle) | the wall · **big·few** | **armor + armor-degradation, walls** | *how long to hold* | armor-pen / bypass |
| **δ Military** | **CONTROL/range** | colonial dictator (boss) | **formation + command + ranged/artillery** | *how to position, when to advance* | break formation / flank |

- **Opposite death-stances** (the sharpest split): α wants units *alive to strike*; β wants them *cheap and dying* (death = the payoff); γ wants them *never to die* (armor denies it).
- δ is the only geneline with **ranged + artillery** (α/β/γ are melee-bound) — and the only one reaching **T4**.
- **α/β/γ are the shallow Skin starters (T0-3); δ is the deeper Veins geneline (T0-4).** That depth gradient is the MVP demonstrating the full game's "depth = tier" structure in miniature.

### 1.1 Counter-triangle — emergent LEAN, **not** a rigid RPS [LOCKED as a principle]

Do **not** engineer rock-paper-scissors. Counters **emerge from the archetypes**, and a clean cycle falls out on its own:

> **β → α → γ → β** — β's AOE/death-effects punish α's *clustering* · α's massed concentrated burst cracks γ's slow *armor* · γ's armor/walls/reflect outlast β's fragile *swarm*.

- Keep it a **tuning lean** (mild edges), **never a hard counter** — preserve the "1-in-10 skill upset" (TIER_CONTRACT §1).
- **Why not forced RPS:** (1) it would distort the distinct identities (the real value); (2) hard counters kill skill expression; (3) you field a *mixed* roster, so the matchup layer is naturally soft. Above all — **archetype-distinctness scales to the full 24-geneline roster; a fixed 3-way RPS does not.**
- **δ sits outside the triangle** — the ranged/formation boss is a *different-axis* check all three must solve (close the gap / break the line). The boss *should* demand more than the trio's RPS.
- **Tune only after** the genelines exist *and* α is proven fun. Don't balance a meta that doesn't exist yet.

---

## 2. Rosters

Funnel shape per geneline: ~7 units, T0→ceiling. α is **built**; δ's units **exist** (re-home from the legacy "alpha" military); β + γ are **fresh**.

### α Primal — *Pack Cohesion* — **[LARGELY BUILT]** (`units/alpha.ts`) — updated 2026-06-02
| T | Unit | Caste | Role / signature | Status |
|--|--|--|--|--|
|0|Chitling|soldier|fodder — cheap mass|✅ stat |
|0|Goreling|soldier|fast charger|✅ stat |
|1|Hornshell|soldier|wall tank (soaks front)|✅ stat |
|1|Goretusk|soldier|**tight-wedge cohesion** — sharper payoff (+15%/ally), tighter radius (45)|✅ |
|1|Quillback|soldier|**ranged anti-air** (spits spines) — α's only ranged unit|✅ (was Carapex) |
|2|**Goliath**|**Elite**|**Stampede** (cohesion-scaled AOE, ≤4×0.5, no kb, shockwave, `charge`) + **cohesion-amplifier aura**|✅ full |
|2|**Maulhorn**|**Elite**|**Ram Charge** — single-target ×2, knockback 100, no FX, `ram` anim (recoil)|✅ full |
|3|**Matriarch**|**Royal**|herd-queen capstone; ultimate TBD|🟡 unit built, ultimate blocked on Royal system |

Pyramid **2/3/2/1** (T0/T1/T2/T3) — *restructured 2026-06-02*: a single **Royal** (Matriarch, new unit) at T3, **2 Elites** at T2 (Goliath, Maulhorn), soldiers below. **BUILT:** Pack Cohesion (+ the herd heat-glow), both Elite signatures — each with a *distinct* body animation (Goliath `charge`/forward-settle vs Maulhorn `ram`/recoil-bounce), *distinct* FX (AOE shockwave vs none), and damage shape (AOE-chip vs single-nuke); Goretusk's **tight-wedge cohesion**; **Quillback** (ranged anti-air, was Carapex); Goliath's **cohesion-amplifier aura** (the amplifier folded onto the anchor). **TO BUILD:** just the Matriarch's Royal ultimate (needs the Royal control/trigger system). *(A flat-speed "momentum" for Goretusk was tried and cut — speed only matters on the approach, so it was a non-decision; per TIER_CONTRACT a T1 should be a pure-data twist, which the tight-wedge cohesion is.)* The low-cohesion-cap re-frame below has been **applied** (cap 4).

**Re-frame (2026-05-31):** α is the **OFFENSE/rush** — a *medium aggressive pack*, **not a swarm**. The current build (cheap **Chitling** fodder + cohesion cap **5**) leans swarm-ish and collides with β. Re-tune toward **fewer, medium-statured aggressive units + a LOW cohesion cap (~3-4)** so cohesion rewards *committing a strike force as one*, not spamming bodies. Framing: *"the charge hits hardest when the herd commits together."* (β owns NUMBERS; γ owns big-durable — α must own neither.)

### β Swarm — *cheap + productive death* — **[PROPOSED]**
| T | Unit | Role / signature |
|--|--|--|
|0|Maggotling|ultra-cheap fodder; **death → spore cloud**|
|1|Burster|suicide runner; **explodes on death**|
|1|Brooder|slow; **spawns free swarmlings** while alive|
|2|Hivespitter|cheap ranged; **death leaves acid pool**|
|2|Carrionling|gains atk **when a swarm-ally dies nearby**|
|3|Broodmother|support; spawns swarmlings + swarm buff|
|3 Elite|Swarmlord|**Tide** — sacrifice nearby swarmlings for a burst surge|

### γ Fortress — *armor as a degrading resource / walls* — **[PROPOSED]**
| T | Unit | Role / signature |
|--|--|--|
|0|Pebbling|cheap armored crawler|
|1|Shieldbug|frontline; **armor degrades as it soaks**|
|1|Burrower|plant → immobile, huge armor|
|2|Rampart|**deploys a wall segment** (blocks the lane)|
|2|Thornback|**reflects** a % of damage taken (pipeline behavior)|
|3|Bulwark|support; **repairs nearby allies' armor**|
|3 Elite|Aegis|**Bastion** — plant a fortress: line-wide armor + regen|

### δ Military — *formation + command + ranged* — **[RE-HOME existing units]**
| T | Unit | Role / signature |
|--|--|--|
|0|Grunt|basic soldier|
|1|Mandible|melee specialist|
|1|Needler|**ranged**|
|2|Bombardier|**AOE artillery**|
|2|Ravager|berserk dps|
|3|Legionnaire|heavy; **formation/rank bonus**|
|4 Elite|Centurion|**command aura + Rally** — the **MVP boss capstone**|

---

## 3. Biomes (one per geneline) [biome concept LOCKED · names/rules PROPOSED]

Zone = Biome = a geneline's **territory** (palette + environmental rule + owner). Lore: §3-4, §6 habitat axis. The environmental rule bends combat toward the owner's hook, so **the biome teaches the geneline.**

| Geneline | Biome | Terrain & look | Environmental rule (favors the hook) |
|---|---|---|---|
| α | **Sun Carapace** *(lore)* | open sunlit membrane-plains | open field, no chokes → massing thrives |
| β | **Fetid Pool** *(lore)* | rotting breeding-pool | corpses linger / ambient spawns → death-effects amplified |
| γ | **Chitin Ridge** *(proposed)* | calcified shell-walls, chokes | cover + chokepoints → armor & holding matter |
| δ | **Arterial March** *(proposed)* | fortified vein-corridors, scent-roads | narrow lanes + sightlines → formation & ranged shine |

**[OPEN]** Are environmental *rules* in MVP scope, or biomes = visual + ownership only for v1 (rules deferred)?

---

## 4. Faction model (static) [LOCKED]

**2 factions + 1 unaligned.** Members of a faction are allied *to each other*. **Static, seeded once at run start, fixed till the end — a `relationship` flag, NOT a reputation engine.**

| Bucket | Members | Relationship |
|---|---|---|
| **Your faction** (ally) | you + 1 geneline | allied to each other |
| **Enemy faction** | 2 genelines (**δ + 1 collaborator**) | allied to each other, hostile to you |
| **Non-faction** | 1 geneline | unaligned — neutral wildcard |

- **δ is fixed in the enemy faction** — the Empire's leader, always the boss.
- The 3 Skin genelines (α/β/γ) **seed** into: **1 ally · 1 collaborator (enemy) · 1 neutral.**
- Net: **1 ally · 1 neutral · 2 enemy** (collaborator + δ).

**Acquisition by relationship:**
| Relationship | Their hive | Get their gene by |
|---|---|---|
| Your-faction ally | friendly hive (popup + quest) | **gift / quest reward** (no fight) |
| Enemy (collaborator + δ) | boss battle | **conquer** the hive (δ's = run-end) |
| Non-faction neutral | optional | **fight-to-take, or skip** |

**Scope guard:** the faction is narrative grouping + seed-time stance only. **No live alliance mechanics** (reinforcements, rep drift, betrayals) for MVP.

### Narrative spine [LOCKED, light]
> The **δ Empire** (disciplined colonial military) is colonizing the wild Skin colonies. You're the resistance: **one wild colony joins you**, **one sold out to the empire** (collaborator), **one stays out** (neutral). You descend Skin → Veins to topple the dictator.

**Consistency flag:** δ is the **MVP / "Chapter 1" boss — NOT Hivyss's ultimate antagonist.** The true finale is the **Core / ρ Rho** superintelligence (deeper, full game). Beating δ ends the run and *teases* the Core. Unity (δ) vs. disunity (the fractured wild colonies) is the literal theme.

---

## 5. The node / territory map [LOCKED]

Each biome is a **territory** with a difficulty gradient toward its hive — a **funnel**: wide contested frontier, single defended heart.

```
   [Forage] ─────► [Warren] ─────► [Hive]
   wild/mixed       pure interior   pure + Elite + ACQUIRE
   low diff ──────────────────────► peak diff
   funnel:  2-3 nodes   1-2 nodes      1 node     (Forage > Warren ≥ Hive)
```

**Node vocabulary:**
| Term | Type | Notes |
|---|---|---|
| **Forage** | Battle | territory border — *mixed* (Normal + geneline spillover). Many ways in. No acquisition. |
| **Warren** | Battle | fortified interior — mostly pure. (Only in 3-node territories.) |
| **Hive** | **Boss** | the capital — **pure + Elite + acquire gene**. δ's Hive = run end. |
| **◦Wild** | Battle | neutral **Normal** node (T0) — the unclaimed buffer + branch junctions. |
| **vhyst** | Treasure/Cache | free reward / rest (already in code). |

**Two coupled gradients, both peaking at the Hive:**
- **Difficulty = distance from the Hive** (and layer depth). The `difficulty` field scales enemy tier: Skin Forage T0-1 → Hive T2-3 + Elite; Veins ramps T2 → **T4** at δ's Hive.
- **Purity = distance from the Hive.** Forage = mixed/wild; Hive = 100% pure (legibility + acquisition). *Never* muddy a Hive.

**Normal = the wild substrate**; genelines = organized territories carved into it. This is Normal's permanent role (also the starting roster).

---

## 6. Map topology + procedural generation [LOCKED]

**Topology:** Home Hive is a **central hub** (fast-travel anchor). Biomes radiate **west / south / east** (**no north** in MVP); the descent runs **south** into Veins. A **wild ring** of Normal nodes encircles Home as buffer + junctions. **Open *within* a layer (radial freedom); gated *between* layers** — the descent opens after clearing **2 of 3 Skin Hives** **[PROPOSED gate]**.

**Generation = templated procedural per seed** (not free-form random):
- **Skeleton (fixed, guarantees fairness):** Home center · biomes radiate out · Forage→Warren→Hive funnel · Veins gated below · difficulty rises with depth.
- **Seeded (varies the run):** which genelines fill slots, node counts per biome (Forage 2-3 / Warren 1-2 / Hive 1), border-crossing edges, vhyst placement, the faction split (ally/collaborator/neutral among α/β/γ).
- **Substrate:** depth-bands (depth = difficulty, lateral = territory). **Think GRAPH, not grid** — `NodeDef.next[]` is an arbitrary adjacency list, so "diagonals" is a non-question; connect by meaning, **render organic** (jitter + curved edges + biome blobs).
- **Guardrails (validate, re-roll on fail):** full connectivity · Home always reachable · no Hive/boss adjacent to Home · biomes stay clustered (legibility) · purity gradient holds · a solvable ramped path always exists.

**Code insertion point:** replace static `LAYER_DEFS` with `generateMap(seed) → LayerDef[]`, **same `NodeDef` output contract** (add a `biome` field + a `relationship` field + mixed-comp support for Forage). `NodeMapScene` / `RunController` / `SeededRNG` already exist and stay unchanged.

**Pool vs slots note:** geneline *selection* variety needs pool > slots. With MVP-4 (3 Skin slots, 3 Skin genelines), the seed varies *layout + faction roles*, not *which* genelines appear. Real selection variety needs the full game (or expansion). **[OPEN]** see §8.

---

## 7. Quests (light) [LOCKED, light]

Quests ≠ a faction system. The map's **run objectives** (conquer hives, acquire genes, beat δ) are already functional quests. The added layer:
- The **your-faction ally gives quests** = `{ giver geneline, objective (clear node X / acquire N), reward }`, piggybacking on objectives you already have ("wipe the collaborator's hive → bonus").
- **Popup UI** (DOM) on visiting an ally hive — greeting + quest + "claim gene." (Village free-roam = **post-MVP**.)
- Completion check = "did node X flip to won." **No quest engine.**

---

## 8. Build order & scope

**Combat-fun first — everything else is designed-now / built-after.**

**Build sequence:**
1. **Prove combat is fun** (α + cohesion + pheromones + 2-lane sandbox **playtest** — *the #1 risk, still unanswered*).
2. **α per-unit signatures** (knockback → momentum → amplifier → Stampede) + **cohesion visual feedback** (currently invisible — gap).
3. β / γ rosters + δ re-home.
4. Biomes + the territory map + procedural generator.
5. Static faction flag + light quests + ally-hive popup.

**Deferred (post-MVP / EA):** village free-roam · dynamic reputation / rep drift / diplomacy mechanics · the full 7-faction (Archaic-ancestry) system · the Core/ρ Rho finale · other realms · mutation/evolution · T5+.

**[OPEN] decisions:**
- **4 vs 6 genelines** — this doc assumes **MVP = 4** (α/β/γ/δ). A prototype map screenshot showed 6 (adds ε Signalers, ζ Symbionts in Veins, δ re-themed "Pursuit Veldt"). Expanding to 5-6 is what unlocks real geneline-*selection* variety in procedural runs — but it's more roster work. Decide before building the generator.
- Environmental rules in MVP scope, or biomes visual-only for v1? (§3)
- Skin gate condition: clear **2 of 3** Hives vs 1 vs a gateway node. (§6)
- Per-biome node-count + crossing-density knobs. (§6)
