# Tier Contract — Unit Authoring Discipline

> **Purpose:** This doc is the authoring contract for unit design. When authoring or reviewing any unit, this doc is the source of truth for what a tier *means mechanically*, *visually*, and *as a code budget*.
>
> **Pairs with:**
> - `lore/HIVYSS.md` §3 — the cosmological framing of Expression Tier
> - `app/src/units/CLAUDE.md` — unit file structure + draw function conventions
> - `app/docs/DESIGN_PATTERNS.md` — implementation patterns (AbilityDef, etc.)
>
> **Status:** Captured 2026-04-19 from design review. Ability examples are illustrative; visual/code budgets are prescriptive.

---

## 1. What tier measures

**Expression tier measures biological sophistication.** Power correlates strongly but not perfectly.

Three correlated facets per tier:

1. **Biology** — anatomical refinement/specialization
2. **Mechanical complexity** — elaborateness of abilities and interactions
3. **Civilization style** — social structure from instinct to pre/post-civilizational unity

**Key discipline:** tier is not primarily a power lever. It is a *sophistication* lever. Power *emerges* from sophistication — and correlates strongly with it. This means:

- **Higher tier usually beats lower tier.** This is the baseline: ~9 out of 10 encounters, the higher-tier unit wins. Do not design against this expectation.
- **A T6 unit should have dramatically *more elaborate* abilities than a T3 unit**, not just bigger numbers — and that elaborateness is *why* it wins, not raw stats alone.
- **The design space is in the 1-in-10 upset:** a T3 unit can beat a T7 through clever play, specialization, terrain advantage, or mutation stack. This is a *feature* — it keeps lower-tier units meaningful and rewards player skill. But it is the exception, not the rule.
- **A T1 unit should not require custom implementation logic** — if it does, re-tier it.

---

## 2. The tier complexity ladder (one-line per tier)

| Tier | Name | Mechanical shape |
|---|---|---|
| T0 | Vyss | attack |
| T1 | Kilovyss | attack with a twist |
| T2 | Megavyss | attack + consequence |
| T3 | Gigavyss | attack that reads context |
| T4 | Teravyss | ability that helps allies |
| T5 | Petavyss | ability that shapes the whole battle |
| T6 | Exavyss | ability that IS the geneline's philosophy |
| T7 | Zettavyss | ability that predates or corrupts normal rules |
| T8 | Yottavyss | ability that warps game state |
| T9 | Ronnavyss | ability that redefines what a battle IS |
| T10 | Quettavyss | the creature and the ability are the same thing |

---

## 3. Ability examples per tier

These are illustrative shapes. Each geneline authors its own flavor on the same structural contract.

### T0 — Vyss (simple single mechanic)

- **Bite** — deal 5 damage to target in melee range
- **Scuttle** — move toward nearest enemy at base speed

*No triggers, conditions, or state. The T0 contract is: one verb.*

### T1 — Kilovyss (one specialized ability)

- **Venom Sting** — ranged shot: 4 damage + poison DOT 2/sec for 3s
- **Burrow** — tunnel route: disappear and re-emerge up to 4 tiles away
- **Acid Spit** — short projectile: 6 damage, reduces target armor by 1

*One dedicated ability beyond the baseline. Single effect, one-line AbilityDef.*

### T2 — Megavyss (compound — two systems interacting)

- **Bombard** — arcing projectile: explodes in 2-tile AOE + burn DOT on all hit
- **Grapple-Drag** — extend claw: pull enemy 2 tiles toward self, follow with bite for bonus damage
- **Mark-and-Feed** — mark enemy with pheromone: allied units gain +25% damage vs marked; mark lasts 8s

*Two systems interacting. Internal logic. Still fits in AbilityDef with params.*

### T3 — Gigavyss (conditional / stateful)

- **Hunt-Guard Stance** — toggle modes: Hunt (+30% attack speed, kills add 2s duration) / Guard (+50% armor, each block stores a charge; release as counterattack)
- **Phalanx** — passive: with 2+ allies in 2-tile radius, +50% armor and reflect 10% damage; alone, reverts to baseline
- **Deathcalcify** — at <30% HP, become immobile with +100% armor for 3s, then shatter for AOE damage

*Reads context. Unit behavior depends on state. Conditional branch in AbilityDef.*

### T4 — Teravyss (system-level — affects allies)

- **Command Aura** — passive: allies within 4 tiles gain +15% attack speed, +10% damage
- **Pheromone Relay** — passive: extends range of all friendly pheromones by 2 tiles while alive
- **Rally** — active (20s cd): all allies in lane gain +20% damage for 3s

*Affects other units. Requires hooks into the ally-query system.*

### T5 — Petavyss (hive-wide infrastructure)

- **Network Uplink** — passive: all allied pheromones last 50% longer battle-wide; on death, all active pheromones dispel instantly
- **Resurrection Relay** — passive: when any ally dies within 10 tiles, 25% chance to respawn them at 50% HP at home hive
- **Caste Surge** — every 15s: pick one caste (worker/soldier/elite/royal); that caste gets +50% stats globally for 5s

*Infrastructure. The whole army's behavior depends on this unit's presence. Custom system-level hooks.*

### T6 — Exavyss (apex — geneline thesis made flesh)

- **α Supreme Commander** — every ally attack grants all other allies 1 stack of Discipline (cap 10). At 10 stacks, all allies simultaneously unleash their next attack at +100% damage; consumes stacks.
- **β Eternal Swarm** — spawn rate scales with enemy count on field (+1 spawn/sec per 5 enemies); any β unit that dies has 30% chance to leave behind a swarmling (free T0 unit)
- **θ Consume All** — every corpse within 8 tiles flows to θ; each grants +1 HP, +1 damage, +1 attack speed permanently; stats persist across battles for this run

*The geneline's identity made into a single mechanic. One per geneline. Custom system.*

### T7 — Zettavyss (Archaic pre-refinement OR Dark mid corrupted)

**Archaic flavor:**

- **Breath Cycle** — cannot die outright. Every 10s, reset HP to max but lose 20% *max HP* permanently. Dies when max HP hits 0.
- **Territorial Mark** — claim 3-tile radius as owned. All enemies in owned territory take 5 DOT. Leaving reclaims the area immediately.

**Dark flavor:**

- **Reverse Heal** — healing aura targets enemies instead of allies; each heal deals twice that damage to the healed enemy as DOT over 5s
- **Pheromone Hijack** — any enemy pheromone within 8 tiles becomes *yours* and works inverted (rally becomes scatter, charge becomes retreat)

*Operates on pre-refinement or corrupted rules. Requires rule-override logic.*

### T8 — Yottavyss (rule-warping)

- **Shared Fate** — link all visible enemies. Damage to one deals 50% to all others. Chain breaks when one dies; remaining enemies scatter randomly.
- **Cost Inversion** — while alive: enemy abilities cost 2× nectar, your abilities cost 0 nectar but cooldowns are doubled
- **Betrayal Pulse** — every 20s, one random enemy unit switches to your side for 10s; on revert, it explodes for heavy damage

*Warps game state. Modifies rules for all participants. Substantial custom logic.*

### T9 — Ronnavyss (boss-unique reality-shatter)

- **Reality Shatter (Taw, Corruption 5)** — every 30s: all units on field swap positions randomly, ability cooldowns randomize, all units' current nectar costs randomize. Lasts until Taw dies.
- **Paired Anima** — Taw has an invisible twin sharing HP. Damage must hit both within 2s to count; positions of both shift every 5s unpredictably.
- **Memory Theft** — every unique ability cast *by anyone* during battle is stolen and permanently added to Taw's kit. Boss fights longer = Boss gets your own toolkit.

*Boss-level unique system. The mechanic IS the battle experience. Hand-authored.*

### T10 — Quettavyss (ontology-as-mechanic — Primordials only)

*(Updated in HIVYSS v1.4 cosmology pivot — Primordials are now the 7 Archaic letters, not 5 Coptic):*

- **ϝ Digamma (Motion)** — Cannot be held still. Teleports short distance if slowed/stunned. Every tile traveled adds +1 permanent damage. Slowing her only feeds her.
- **ϟ Koppa (Number)** — Spawns one ephemeral body per enemy on field. All share a single HP pool. Kill a body → reduces pool. Player must out-attrition the multiplying count.
- **ϡ Sampi (Voice)** — Every attack is a sound-wave affecting all units in a line. Enemies hit by the wave become temporarily neutral (stop fighting). Voice cannot be silenced.
- **Ϻ San (Gradience)** — Deals 1 damage per hit, but damage stacks and escalates forever while the bout lasts. Player must outlast-or-die; she has no burst, only inevitable accumulation.
- **Ͱ Heta (Breath)** — Cannot die while breathing. Fully regenerates between attacks. Player must interrupt breath cycles with timed damage during narrow windows.
- **ϛ Stigma (Territory)** — Claims the entire arena on spawn. Standing on claimed ground deals DOT. Only "unclaimed" via ritual actions or specific abilities.
- **ϙ Qoppa (Wonder)** — Remembers every ability used against it. After first use, becomes immune to that ability AND copies it for itself. Variety is the player's only weapon.

*The creature IS the ability. No stats/abilities in the normal sense. Entirely bespoke implementation per primordial.*

---

## 4. Code complexity budget per tier

**This is a hard discipline.** If your implementation complexity doesn't match the tier budget, the unit is mis-tiered.

| Tier | Budget | Implementation shape |
|---|---|---|
| T0 | ~5 lines AbilityDef data | Standard single-effect ability, no custom code |
| T1 | ~10 lines AbilityDef + standard params | One ability with one effect family (damage, DOT, movement) |
| T2 | ~15 lines AbilityDef + chained params | Two effect families composed (e.g., damage + mark) |
| T3 | ~30 lines + conditional hooks | Conditional behavior, state check on existing signals |
| T4 | ~50 lines + aura/ally-query | System-level effect via ally iteration |
| T5 | ~100 lines + custom system hook | Global effect, custom subsystem touch |
| T6 | ~200 lines + new mechanical system | Geneline-unique subsystem (Discipline stacks, Swarm spawn scaling, Biomass) |
| T7 | ~300 lines + rule-override system | Breaks or inverts normal ability resolution |
| T8 | ~500 lines + game-state modifier | Warps core loop (costs, cooldowns, team assignment) |
| T9 | ~1000 lines + bespoke boss system | Boss-unique; per-encounter hand-authored |
| T10 | No budget — custom primordial subsystem | Each primordial is its own system, not an AbilityDef |

**If you find yourself writing 200+ lines for a T2 unit, the unit is probably T4 or T5.** Re-tier it or simplify the ability. The budget is the contract.

**If you find yourself writing 10 lines for a T6 unit, the unit is under-designed.** A T6 must be the geneline's thesis made flesh — that cannot fit in 10 lines of AbilityDef data.

---

## 5. Visual signature rules per tier

These are prescriptive for unit draw functions (per `app/src/units/CLAUDE.md` visual rules).

| Tier | Body segments | Colors | Ornament density | Bioluminescence | Animation |
|---|---|---|---|---|---|
| T0 | 1-2 | 1 primary (+ optional dark underbelly) | None | None | Bob only |
| T1 | 2-3 | 1 primary + 1 accent stripe/spot | Minimal — one feature (stinger, spine) | None | Bob + attack state |
| T2 | 3 | 1 primary + 1 accent pattern | One asymmetric organ visible (payload sac, claw) | None | Bob + attack + ability state |
| T3 | 3-4 | 2 integrated colors | Layered carapace, faction stripe, rank sigil | Optional — subtle at rest | Bob + stance switching |
| T4 | 4 | 2-3 colors | Ritual markings (repeating geometric motif), upright stance | Joints glow | Multi-state stances |
| T5 | 4-5 | 3 colors | Crest, ornate antennae, tertiary ritual mark | Active pulse | Asymmetric idle pose |
| T6 | 5+ | 3 fully integrated colors | Baroque detail — every ornament is load-bearing | Dominant feature | Unique per geneline — named idle |
| T7 Archaic | Asymmetric from preservation | Bone-white + chalk-grey | Ritual scarring (older than current geneline vocabulary) | None (silent) | Slow, labored |
| T7 Dark | Warped proportions | Oily iridescence | Corrupted elaborations | Sickly shimmer | Unsettling jerk |
| T8 | Features shouldn't quite fit | Warped palette | Asymmetric organ growths, disturbing proportions | Unstable flicker | Wrong timings |
| T9 | Reality-breaking geometry | Non-Euclidean palette | Rules-violating shapes (clipping, impossible joinery) | Reality-warp | Per-boss unique |
| T10 | Abstract / pre-form | Aspect-specific (Shei = perfect sphere, Tchima = morphing, etc.) | N/A — the form IS the aspect | Aspect-manifesting | Ontology-specific |

---

## 6. Naming conventions per tier

Per `lore/HIVYSS.md` §14 (Tone, voice, naming guidelines). Refined with tier as a dimension:

| Tier | Name structure | Examples |
|---|---|---|
| T0-1 | Single word, crude, functional | Grub, Needler, Skitter, Pricker |
| T2-3 | Single word, specialized/role-indicating | Mandible, Bombardier, Legionnaire |
| T4-5 | Single word OR two-word title allowed | Centurion, Ravager, Relay Prime |
| T6 | Named individual — title + role | "Voice of the First Thread", "Discipline Incarnate" |
| T7 Archaic | Older-than-Greek naming, ritual-weighted | "Old Breath", "Stone-Speaker", "Silent Warden" |
| T7 Dark | Corrupted Greek-style with Phoenician echo | "Sepulchral Aleph", "Hollow Beth", "Rotmother Gimel" |
| T8-9 | Phoenician-letter-derived, unsettling | "Taw-Hollowed", "Mem-Drowned", "Nun-Forgotten" |
| T10 | Primordial's name only | "Ϸ Shei", "ϯ Dei", "ϥ Fei", "ϫ Djandja", "ϭ Tchima" |

**Guideline:** the more a unit's name feels like a *proper noun*, the higher its tier. T0-3 are *types* (a grub, a mandible); T6+ are *individuals* (the Voice of the First Thread).

---

## 7. Tier assignment checklist

When assigning a tier to a new unit, verify all four match:

- [ ] **Mechanical:** ability complexity matches the tier's ladder position
- [ ] **Code:** implementation budget matches the tier's line-count range (±50%)
- [ ] **Visual:** ornament density and color count match the tier's visual signature
- [ ] **Naming:** name structure matches the tier's naming convention

**If 3 of 4 match and 1 doesn't, the non-matching one is probably what needs adjustment.** If 2 of 4 don't match, re-tier the unit.

---

## 8. Mapping existing α roster to tier contract

The shipped α Alpha units as calibration examples:

| Unit | Tier | Mechanical shape | Fits contract? |
|---|---|---|---|
| Grunt | T0 | Simple melee attack | ✓ Bite-equivalent |
| Mandible | T1 | Specialized melee | ✓ One-ability |
| Needler | T1 | Specialized ranged | ✓ One-ability |
| Bombardier | T2 | AOE + death-trigger | ✓ Compound |
| Ravager | T3 | State-based berserk | ✓ Conditional |
| Legionnaire | T3 | Heavy soldier with pack bonus | ✓ Context-reading |
| Centurion | T4 | Commander aura | ✓ System-level / affects allies |

α's roster spans T0-T4. This is an appropriate starter-geneline spread. α's T5-T6 units (faction-scale infrastructure, ω-adjacent apex) are future content.

---

## 9. Out of scope for this doc

Things that are **not** this doc's concern:

- **Balance values** — tier doesn't tell you "how much damage" or "how much HP." Those are per-unit balance concerns, authored against playtest feedback.
- **Which genelines get which tier distribution** — that's geneline identity design per `lore/HIVYSS.md` §6.
- **How the strategic layer spawns units by tier** — that's spawn-table design per future battle mechanics v1 spec.
- **Effect visual rendering** — that's `EffectVisualSystem` per `app/docs/DESIGN_PATTERNS.md`.

This doc is strictly the **unit authoring contract**.

---

## 10. When to update this doc

- When a new tier mechanical shape is discovered in play (e.g., a novel T5 pattern emerges that deserves documenting)
- When ability examples become stale (new genelines add new T6 theses that should be listed)
- When implementation budget estimates prove wildly wrong (recalibrate the code budget table)
- When a new geneline's units are authored, append them to §8 as calibration examples

Do **not** update:
- For individual balance tweaks (those live in unit files, not here)
- For lore changes (those live in `lore/HIVYSS.md`)

---

## 11. Caste authoring contract

Tier determines mechanical complexity. **Caste determines player interaction paradigm.** These are orthogonal — a T3 Soldier and a T3 Elite have the same complexity budget but different control models.

### Worker authoring

- **Control:** auto, directed by player pheromone placement
- **Abilities:** no player-activated abilities; all pheromone-response is auto
- **AI:** task-following — path to pheromone zones, execute assigned task (build, gather, incubate)
- **Code budget:** ~30-50 lines per Worker type + shared pheromone-response framework
- **Count per battle:** 5-15 (many)
- **Tier range typical:** T0-T2 (basic) with specialist sub-types at T3-T4 (e.g., Mutagen Scout)
- **Geneline variants:** each geneline defines 1-2 specialist workers (α Engineer, θ Consumer, ε Relay, κ Weaver)

### Soldier authoring

- **Control:** fully auto, standalone
- **Abilities:** all abilities auto-fire when conditions met
- **AI:** tier-appropriate (see §2 complexity ladder). T0-2 simple; T3-5 stateful/system-level; but all autonomous.
- **Code budget:** per tier budget in §4 — no extra above tier
- **Count per battle:** 10-30 (most of the army)
- **Tier range:** T0-T6 (any tier can be a Soldier caste)
- **Key contract:** no player input required — if you find yourself wanting the player to trigger this, re-caste as Elite

### Elite authoring

- **Control:** auto movement + auto basic combat + **one player-triggered signature ability**
- **Abilities:** exactly ONE player-activated signature. Additional abilities (passives, auto-actives) are allowed; the player-triggered signature is the caste contract.
- **AI:** tier-appropriate **plus geneline tactical doctrine** — richer behavior than a Soldier of the same tier. Reads lane-wide state, prioritizes high-value targets (enemy Elites/Royals), coordinates with other Elites, positions for flanks.
- **Code budget:** tier budget + ~30 lines for player-activation hook + ~30 lines for geneline tactical doctrine AI wrapper
- **Count per battle:** 1-4 (few, premium)
- **Tier range typical:** T2-T6 (Elite makes most sense at T3+; a T1 Elite with a player trigger feels underweight)
- **Geneline variants:** each geneline defines its own tactical doctrine (rank formation / wave leadership / corpse farming / wall architecture / death management / support broadcasting — see `lore/HIVYSS.md` §8)

### Royal authoring

**Royal is the most expensive caste to author.** A Royal is a queen, an avatar, and a hero unified into one unit. Per geneline, there is ONE Royal unit definition.

- **Control:** 4-mode state machine (see below)
- **Abilities:** full passive hive-style package (5 facets) + Royal Special Bar ultimate + direct-control combat abilities
- **AI:** N/A when docked (stationary passive); player-driven when in battle
- **Code budget:** tier budget (always T5-T6) + 4-mode state machine + 5-facet style package + Royal Special subsystem + direct-control input bindings. Substantial — plan ~300-500 lines per Royal implementation.
- **Count:** ONE per hive (home + any captured nodes with a placed Royal)
- **Tier range:** T5-T6 only (Royals are apex units)

**4-mode state machine for Royal:**

| Mode | Where | Implementation |
|---|---|---|
| At hive (docked) | Home hive or a captured node with Royal placed | Stationary entity; applies 5-facet style package as ongoing hive effects; non-combat |
| Traveling (mobile) | With caravan on strategic map | Style package suspended on her docked hive (dormant-hive state); Royal is a caravan passenger until deployed into battle |
| In battle (combat) | Deployed in active battle | Player-controlled (WASD/click); has combat stats, abilities, Royal Special Bar |
| Dead (respawn) | Nowhere | 90-second respawn timer; hive style fully suspended during timer; on timer end, respawns at her home hive |

**Style package (5 facets) per Royal:**

1. Visual architecture — hive appearance when Royal is docked (procedural draw functions for hive structure)
2. Passive hive aura — mechanical effect on garrison/production while docked
3. Unit production — which genes the hive produces passively (Royal's native geneline only)
4. Pheromone signature — color/particle on strategic map
5. Neighbor-reputation effect — rep drift with adjacent territories' factions

**Royal Special Bar:** charge through army's kills → unleash geneline-specific ultimate when full. Per `lore/HIVYSS.md` §8.

### Caste × Tier interaction matrix

A quick reference for caste-appropriate tier ranges:

| Caste | T0 | T1 | T2 | T3 | T4 | T5 | T6 | T7+ |
|---|---|---|---|---|---|---|---|---|
| Worker | ✓ | ✓ | ✓ | ✓ (specialist) | rare | — | — | — |
| Soldier | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (enemy only) |
| Elite | — | rare | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Royal | — | — | — | — | — | ✓ | ✓ | (Archaic Primordials are T10, transcend the caste system) |

---

## 12. Unit identity tier — Generic vs Individual

Separate from mechanical tier. Describes whether a unit has *individual identity* or is spawn-from-type.

### Generic (Tier A — spawn-from-gene)

- Produced from a gene in Royal's library via chamber tuning → vyss-egg → incubation → hatch
- No individual identity — any Grub is any Grub
- Death → respawnable from same gene (unlimited from hive production)
- Authoring: a unit file with standard UnitDef, ability hooks, and draw function
- Most units in the game are Generic

### Individual (Tier B — named, gene-bearing)

- Acquired via special paths (eggs, specimens, quest rewards, boss unlocks, rare evolution outcomes)
- Has a unique name, fixed-at-acquisition quality roll, mutation history, kill count, special abilities
- Death → permanently lost (the gene-signature is gone from the roster)
- Authoring: a UnitDef variant plus individual metadata (name, history, rolled stats)
- Royals are always Individual tier (one per hive)
- Named boss-unlock units are Individual
- Most often T4+ in mechanical tier

**Authoring guideline:** generic units live at mechanical tier T0-T3. Individuals tend to be T4+ (rare T3) or come from specific acquisition sources (bosses, quests, discoveries). A T1 Individual is unusual — if you find yourself authoring one, ask whether it should be Generic with a unique name cosmetic instead.

---

*Document version: 1.1*
*Updated 2026-04-19 with caste authoring contract (§11) and Unit identity tier (§12).*
*Captures the tier-as-sophistication reframe + mechanical-complexity contract + caste paradigm + individual-identity distinction established during April 19 design reviews.*
