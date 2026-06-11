# MVP Genelines, Map & Factions — Design Reference

> **Status:** DRAFT, captured 2026-05-31. The consolidated MVP design: the 4 genelines, their rosters, biomes, the node/territory map, procedural generation, and the static faction layer.
>
> **Pairs with:** `REQUIREMENTS.md` (scope/budget) · `ALPHA.md` (α detail) · `reference/TIER_CONTRACT.md` (tier authoring) · `lore/HIVYSS.md` §3-8 (cosmology, grounded here).
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

### 1.0 Route verticality — a RESERVED axis [RULING 2026-06-11]

The air/land/tunnel route system is built, but the MVP-4 rosters stay
**grounded on purpose**: with 24 genelines to fill, air and tunnel are
*identity corners* for future genelines (an air geneline = a different way to
play; a tunnel geneline = the underminer, shipped together with its
counterplay content — tunnel is binary-uninteractive until tunnel-watch/
buildings exist). Do NOT spend them as one-off roster filler. The single
pencilled exception: **β's Bloatfly** (carrion fly over the Fetid Pool — a
cheap dying flyer death-bursting spores from above) as β's second-wave air
unit, the most thematically inevitable air unit in the game. Until then,
verticality appears via the Normal/wild substrate (which is what α's
Quillback anti-air answers).

### 1.1 Counter-triangle — emergent LEAN, **not** a rigid RPS [LOCKED as a principle]

Do **not** engineer rock-paper-scissors. Counters **emerge from the archetypes**, and a clean cycle falls out on its own:

> **β → α → γ → β** — β's AOE/death-effects punish α's *clustering* · α's massed concentrated burst cracks γ's slow *armor* · γ's armor/walls/reflect outlast β's fragile *swarm*.

- Keep it a **tuning lean** (mild edges), **never a hard counter** — preserve the "1-in-10 skill upset" (TIER_CONTRACT §1).
- **Why not forced RPS:** (1) it would distort the distinct identities (the real value); (2) hard counters kill skill expression; (3) you field a *mixed* roster, so the matchup layer is naturally soft. Above all — **archetype-distinctness scales to the full 24-geneline roster; a fixed 3-way RPS does not.**
- **δ sits outside the triangle** — the ranged/formation boss is a *different-axis* check all three must solve (close the gap / break the line). The boss *should* demand more than the trio's RPS.
- **Tune only after** the genelines exist *and* α is proven fun. Don't balance a meta that doesn't exist yet.

---

## 2. Rosters

**Roster contract (every geneline).** **Base skeleton = 1 Royal + 2 Elites + 4 soldiers (7 units)** — the default anchor; fielded via the bounded **loadout** (`VISION §2`: + 2 hive abilities + 2 pheromones + 2 buildings). **The Royal is always 1; the rest ADAPT to the army-model** (the SC2-commander lesson — *don't force a uniform count*): **soldier count flexes most** — α the skeleton (4), β a wide cheap base + a *spawned* mass, γ **few-but-durable**, δ premium specialists; **Elite count flexes too** (1–3+, mostly a future-geneline lever — a hero-squad = mostly Elites, little fodder). **Target ≈ 28–32 units across the MVP-4.** Two dimensions govern each unit:

- **Tier = complexity** (per `reference/TIER_CONTRACT.md`, the default base): **T0** = a verb · **T1** = a twist (one specialized ability, *no custom logic*) · **T2** = a consequence (two systems) · **T3** = reads context (stateful) · **T4** = helps allies (system-level). The **Elite** caste adds a *player-triggered signature* (+ a passive **phase-2 enrage** at its `phaseThreshold`); the **Royal** is the queen capstone (controllable hero). **Skin genelines (α/β/γ) cap at T3** with the Royal at T3 + Elites at T2; **δ (Veins) ramps to T4** — its Royal/boss is the run-end capstone (`REQUIREMENTS §4-5`).
  - **The self-vs-ally rule (load-bearing for tiering).** **Soldiers (T0-3) are SELF-affecting** — attack, death-effect, stance, reading context to buff *themselves*. **Generative / ally-affecting power** (spawn units, heal/buff *others*) is **T4+** on the ladder, so it lives in an **Elite signature/aura** or the **Royal** — *never a soldier slot.* (An Elite earns ally-affecting power by being premium — e.g. Goliath's amplifier aura at T2; a soldier does not. A spawner therefore can't be a T1 soldier — spawning is custom generative logic.)
- **Identity = a distinct corner of the `VISION §6` framework** — *army model · economy · death-stance · verb*. **Two genelines may share an axis, never all four.** Each roster is an **ecosystem** of interdependent roles serving the hook (`REQUIREMENTS §5`), not a hook + reskins.
- **Kit = the geneline's expression of the shared systems** — its **hook** (the geneline-wide passive), a **signature pheromone** (`VISION §5`), **geneline-specific hive abilities** (`VISION §7`), **buildings** (`VISION §9`), and its **economy + capacity character** (how it fills the shared hard cap — β a cheap *tide*, γ a *few big* bodies). Listed per geneline below as **Kit:**.

α is **built**; δ's units **exist** (re-home from `units/archive.ts`); β + γ are **fresh**. β/γ/δ below are **[PROPOSED]** — coherent to the framework now, tuned/named (§14) when built, *after α's fun is proven*.

### Identity & Kit at a glance

**Identity** — each geneline owns a *distinct corner* (no two share all four axes):

| | α Primal | β Swarm | γ Fortress | δ Military |
|---|---|---|---|---|
| **Army** | massed herd | expendable swarm | few durable walls | ranked formation |
| **Economy** | incubation | free-spawn / corpse | incubation | incubation |
| **Death** | alive-to-strike | cheap-and-dying | never-die | disciplined |
| **Verb** | **commit** | **sacrifice** | **hold / degrade** | **position + range** |
| **Size** | medium | high — a *tide* | low — *few big* | medium — premium |
| **Tier range** | T0–3 | T0–3 | T0–3 | **T1–4** *(Veins — runs hotter)* |
| **Killed by** | AOE + displace | AOE clear + sustain | armor-pen + flank | break the line + flank |

**Kit** — its expression of the shared systems (`VISION §5/§7/§9`):

| | α Primal | β Swarm | γ Fortress | δ Military |
|---|---|---|---|---|
| **Hook** *(passive)* | Pack Cohesion | productive death | armor (degrades) | formation rank |
| **Pheromone** | Frenzy Musk | Death-bloom | Bastion-scent | Volley-mark |
| **Hive ability** | Tremor | Spore Storm | Fortify | Artillery Strike |
| **Building** | Spawning Mound | Brood Pit | Wall + Spire | Bunker |

*Pheromone glosses — **Frenzy Musk:** cash cohesion → charge surge · **Death-bloom:** deaths inside spill extra spawns · **Bastion-scent:** root + armor/regen · **Volley-mark:** δ units focus-fire the spot. (α concrete; β/γ/δ **[PROPOSED]**.)*

### α Primal — *Pack Cohesion* — **[LARGELY BUILT]** (`units/alpha.ts`) — updated 2026-06-02

| T | Unit | Caste | Role / signature | Status |
|--|--|--|--|--|
|0|Chitling|soldier|fodder — cheap mass|✅ stat |
|0|Goreling|soldier|fast charger|✅ stat |
|1|Hornshell|soldier|wall tank (soaks front)|✅ stat |
|1|Quillback|soldier|**ranged anti-air** (spits spines) — α's only ranged unit|✅ (was Carapex) |
|2|**Goliath**|**Elite**|**Stampede** (cohesion-scaled AOE, ≤4×0.5, no kb, shockwave, `charge`) + **cohesion-amplifier aura**|✅ full |
|2|**Maulhorn**|**Elite**|**Ram Charge** — single-target ×2, knockback 100, no FX, `ram` anim (recoil)|✅ full |
|3|**Matriarch**|**Royal**|herd-queen capstone; click-controlled hero + **Primal Roar** ultimate|✅ full (Royal system built 2026-06-11) |

Pyramid **2/2/2/1** (T0/T1/T2/T3) = **the base skeleton** (1 Royal + 2 Elites + **4 soldiers** = 7) — *trimmed 2026-06-03* from 5 soldiers: **Goretusk cut** (its tight-wedge cohesion overlapped the baseline cohesion + Goliath's amplifier — redundant role; cutting it lands α on the skeleton and honors the "fewer, medium units, not swarm-spam" re-frame). **BUILT:** Pack Cohesion (+ the herd heat-glow), both Elite signatures — each with a *distinct* body animation (Goliath `charge`/forward-settle vs Maulhorn `ram`/recoil-bounce), *distinct* FX (AOE shockwave vs none), and damage shape (AOE-chip vs single-nuke); **Quillback** (ranged anti-air, was Carapex); Goliath's **cohesion-amplifier aura** (the amplifier folded onto the anchor); **the Matriarch's full Royal kit** (2026-06-11 — click-control, Primal Roar ultimate, death stakes/respawn, lane-switch, queen redesign). **α is roster-complete.** The low-cohesion-cap re-frame below has been **applied** (cap 4).

**Re-frame (2026-05-31):** α is the **OFFENSE/rush** — a *medium aggressive pack*, **not a swarm**. The current build (cheap **Chitling** fodder + cohesion cap **5**) leans swarm-ish and collides with β. Re-tune toward **fewer, medium-statured aggressive units + a LOW cohesion cap (~3-4)** so cohesion rewards *committing a strike force as one*, not spamming bodies. Framing: *"the charge hits hardest when the herd commits together."* (β owns NUMBERS; γ owns big-durable — α must own neither.)

### β Swarm — *cheap + productive death* — **[BUILT 2026-06-11]** (`units/beta.ts`)

**BUILT:** the full 8-unit roster below (every body individually authored —
the design bar), the **generative spawn engine** (spawn dispatcher + `spawner`
passive: Broodmother broods free Swarmlings; Broodlord's Spawn-Wave; Brood
Surge ult), **Tide** (sacrifice — eaten allies fire no death triggers, drop no
corpses, BY DESIGN), **deathFeed** (Carrionling visibly gorges), the three
death-effects (spore/blast/acid) with the **poison DOT wired** game-wide, the
Broodmother's swarm aura, and the **Fetid Pool biome**. Capacity character:
deployed Swarmlings cap 0.5, SPAWNED units cap 0 (the tide is a parallel
economy). **Kit still to come (sequenced late per VISION §10):** Death-bloom
pheromone · Spore Storm · Brood Pit; the Bloatfly air unit is second-wave
(§1.0). β is sandbox + enemy content until the geneline picker lands.

| T | Unit | Caste | Role / signature |
|--|--|--|--|
|0|Swarmling|soldier|free / ultra-cheap body; plain attack — the mass (also the spawn output) |
|1|Maggotling|soldier|cheap; **death → spore cloud** (self death-trigger) |
|1|Burster|soldier|suicide runner; **explodes on death** (self death-trigger) |
|2|Hivespitter|soldier|cheap ranged; **death → lingering acid pool** (ranged + death-effect) |
|3|Carrionling|soldier|**gains atk when a swarm-ally dies nearby** (reads death-context → buffs *self*) |
|2|**Swarmlord**|**Elite**|**Tide** — sacrifice nearby Swarmlings for a burst surge |
|2|**Broodlord**|**Elite**|**Spawn-wave** — birth a swarm on demand (generative → an *Elite*, not a soldier) |
|3|**Broodmother**|**Royal**|the queen — passively spawns Swarmlings + a swarm buff; ultimate = a brood surge |

*The "many" is **spawned**, not deployed: Broodmother (passive) + Broodlord (on-demand) birth free Swarmlings, Stukov-style. **No soldier is a spawner** — that's T4+ generative logic (the original "Brooder T1 spawner" was the mis-tier).*

> **RULING 2026-06-11 — γ's WIN CONDITION (solved inside hold/degrade, budget-safe):**
> a turtle in a base-race needs a designed path to victory, and γ's must NOT
> become "advancing structures" (that corner is reserved for a future
> creeping-hive geneline). γ wins by **(1) reflect-attrition** — Thornback-class
> reflection means the enemy's own offense breaks on the wall ("you lose by
> hitting me"), and **(2) never-die accumulation** — an army that doesn't shrink
> eventually outnumbers one that bleeds; the push happens when the spent enemy
> wave can no longer answer the intact wall walking forward. Calcifier's shatter
> is the lone crack-opener note. Side-effect to embrace: γ matchups STARVE the
> corpse economy on both sides (nothing dies) — the wall fight is also a
> command-layer drought, which is γ's tempo made systemic.

### γ Fortress — *armor as a degrading resource / walls* — **[PROPOSED]**

| T | Unit | Caste | Role / signature |
|--|--|--|--|
|0|Pebbling|soldier|cheap armored crawler (durable fodder) |
|1|Burrower|soldier|**plant → immobile, huge armor** (a stance — `TIER_CONTRACT` T1 "Burrow") |
|2|Shieldbug|soldier|frontline; **armor degrades as it soaks** (armor + degradation, two systems) |
|2|Thornback|soldier|**reflects a % of damage taken** (self-defensive pipeline behavior) |
|3|Calcifier|soldier|at low HP, **hardens (immobile + huge armor) then shatters for AOE** (self-context — `TIER_CONTRACT` "Deathcalcify") |
|2|**Rampart**|**Elite**|**Wall** — deploy a lane-blocking segment (generative → an *Elite*) |
|2|**Aegis**|**Elite**|**Bastion** — plant a fortress: line-wide armor + regen |
|3|**Regina** *(name TBD)*|**Royal**|the citadel-queen — fortress aura + **repairs allies' armor**; ultimate = total fortification |

*Repair lives in the **Royal** (ally-affecting = T4+), not a soldier — the old "Bulwark repairs allies' armor" soldier was the same mis-tier as β's spawner.*

> **RULING 2026-06-11 — "BREAK FORMATION" made mechanical (budget-safe):** δ's
> stated weakness needs a mechanism, not words, and it must not be a new system.
> **Formation rank bonuses BREAK when the unit is displaced** — knockback
> (blunt's default effect, already wired) is the formation-breaker. This gives
> the melee trio their gap-story for free: α's Maulhorn ram and β's Burster
> death-blast become anti-δ tools the moment δ exists; γ remains δ's worst
> matchup BY DESIGN (the triangle's outside check). No new mechanic spent.

### δ Military — *formation + command + ranged* — **[PROPOSED — re-home + tier-up `units/archive.ts`]**
*The **Veins boss geneline**, designed **up** from the trio: **no T0 fodder** (a professional army), soldiers **T1–T3**, **Elites at T3** (vs the trio's T2), and the only **T4** — Centurion, δ's Royal *and* the run-end boss. Fitting archived units re-home here **retiered to Veins depth**; the berserk **Ravager** doesn't fit δ's *disciplined* framework → it stays archived / re-homes elsewhere.*

| T | Unit | Caste | Role / signature |
|--|--|--|--|
|1|Trooper|soldier|disciplined ranged line infantry — δ's baseline (*no T0 fodder*) |
|1|Mandible|soldier|melee specialist; screens + anchors the ranged line |
|2|Marksman|soldier|precision ranged; **pierces armor** (ranged + pierce) |
|2|Bombardier|soldier|arcing **AOE artillery** (ranged + AOE) |
|3|Legionnaire|soldier|heavy; **gains a rank bonus in formation** (reads the line → buffs *self*; `TIER_CONTRACT` "Phalanx") |
|**3**|**Siegewright**|**Elite**|**Barrage** — a devastating targeted artillery strike |
|**3**|**Longeye**|**Elite**|**Execute** — a precision kill-shot on the enemy's highest-value unit |
|**4**|**Centurion**|**Royal / BOSS**|**command aura + Rally** (army-wide formation buff); the **run-end boss** |

*Re-homes the archived legacy "military alpha" (`units/archive.ts`). δ alone ramps to **T4** (Veins depth) — Centurion is the **only T4 in the MVP**, and it doubles as δ's Royal *and* the final boss.*

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
