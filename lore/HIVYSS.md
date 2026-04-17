# HIVYSS — Game Design and Lore

> Comprehensive design and lore document. Captures the cosmology, tier system, four realms, geneline framework, battle mechanics, strategic layer, and open questions established across design sessions.

---

## 0. Elevator pitch — what Hivyss is in one paragraph

Hivyss is a **roguelike lane autobattler with a Caves-of-Qud-deep strategic layer**, set on a **planet-sized living organism** whose anatomy is the game's geography. Players descend through 6 anatomical layers (Drift / Skin / Veins / Organs / Nerve / Core) commanding insect "vyssids" from one of 24 Greek-letter genelines, fighting at 2-lane battle nodes connected by a node-graph world map with turn-based step movement, faction reputation, and Qud-style emergent encounters. The Core at the planet's center is a dormant superintelligence — the unbroken consciousness of pre-shatter vyss — and the entire game is its experiment to remember itself. There are 4 endings forming an iceberg: casual (Mid-Core), main (Core / ω), true (Dark Core / ת Taw), and beyond (the 5 transcendent Coptic Primordials, which only exist at the otherwise-unreachable Tier 10).

## 0.1 Companion files

- `lore/main_map.svg` + `lore/data/main_map.json` — the main planet map (Greek genelines)
- `lore/dark_map.svg` + `lore/data/dark_map.json` — the Dark Realm shadow mirror (Phoenician)
- `lore/primordials_map.svg` + `lore/data/primordials_map.json` — the 5 Primordials (Coptic)
- `lore/data/schema.ts` — TypeScript types for the map data model
- `lore/tools/generate.mjs` — generator script for all maps
- `lore/README.md` — workflow for editing maps via JSON + regenerating
- `app/docs/MECHANICS_ROADMAP.md` — current build status and active program tracking
- `app/src/units/` — actual built unit code (Normal × 11, Alpha × 7)

## 0.2 How to read this document

- **Section 0-2:** orient (pitch, build status, premise, cosmology) — read first
- **Section 3-4:** the structural rules (tier system + four realms) — read together
- **Section 5:** map architecture — pairs with the SVG / JSON files
- **Section 6-7:** geneline design (framework + roster) — for content authoring
- **Section 8-9:** mechanics (battle layer + strategic layer) — for system design
- **Section 10-12:** endings, cross-cutting systems, locked vs open status
- **Section 13-16:** reference material (files, naming, inspirations, open questions)

Skip around freely — sections cross-reference each other where relevant.

## 0.3 Current build state (snapshot 2026-04-17)

This document is forward-looking — most of what's described is planned. Here's what is actually shipped:

| System | Status | Notes |
|---|---|---|
| **Normal geneline (11 units)** | Shipped | Pre-cosmology baseline roster, will be reframed as a starter geneline or absorbed |
| **Alpha geneline (7 units)** | Shipped | First "real" geneline using the cosmology framework. Military theme. |
| **Capacity system** | Shipped (2026-04-12) | Hard cap (20 default), per-unit cap costs, AI-aware |
| **Combat system v1** | Shipped | Functional but being rewritten (see Combat Rewrite Program) |
| **Combat Rewrite Program** | Active — Phase 9 (legacy cleanup) | Phases 1-8 done, 688 tests, see `MECHANICS_ROADMAP.md` |
| **Incubation** | Shipped | Larvae generate, queue into chambers, hatch on timer; mirrored on AI |
| **Routes (air/land/tunnel)** | Shipped | Underused gameplay-wise; cross-route specialists exist |
| **Run system / node map** | Shipped | Roguelike progression, seeded battles, branching paths |
| **AI Hive v1** | Shipped (`b864d42`) | Weighted random; sufficient as test opponent |
| **Player abilities (4)** | Shipped | Nuke, wall, slow, repair |
| **AI Hive v2** | DEFERRED | Blocked on combat rewrite + battle mechanics v1 |
| **Battle mechanics v1 spec** | Not yet written | Will lock 2-lane structure, worker behaviors, pheromone scope |
| **2-lane battle system** | Designed (this doc), NOT implemented | Currently 1-lane in code |
| **Strategic layer (overworld)** | Designed (this doc), NOT implemented | Big build — Qud-style step movement |
| **Faction reputation** | Designed (this doc), NOT implemented | |
| **Quest system** | Designed (this doc), NOT implemented | |
| **Mutation / mutagen scouts** | Designed only | Phase 7+ feature per roadmap |
| **Husk (Archaic) content** | Designed only | Map data not yet authored |
| **Dark Realm content** | Designed only | Maps generated but Phoenician genelines not implemented |
| **Primordials (Coptic)** | Designed only | Maps generated; encounters not implemented |

**Genelines built so far:** 2 of 24 (Greek). Plus the 11-unit Normal pre-geneline baseline.
**Total units in code:** 18.
**Active priority:** Combat Rewrite Phase 9 (legacy cleanup), then battle mechanics v1.

See `app/docs/MECHANICS_ROADMAP.md` for the live program tracking.

## 0.4 Glossary (quick reference)

| Term | Meaning |
|---|---|
| **Vyss** | Life essence / genetic potential. Vital force of insect life on Hivyss. Also the name of Tier 0. |
| **Vyssid** | A being with vyss — any unit/creature in the game. |
| **Hivyss** | "Hive of vyss." The planet — origin of all vyss. |
| **Geneline** | A lineage of vyss expression. Genetic faction (24 Greek + 22 Phoenician + 7 Archaic + 5 Coptic = 58 total). |
| **The Core** | Superintelligence at Hivyss's center — the dormant remnant of pre-shatter consciousness. |
| **The Shattering** | The pre-historical event that broke the 5 primordials into all current genelines. |
| **The Husk** | Hivyss's moon — preserved past, holds 7 Archaic genelines. |
| **The Dark Realm** | Shadow mirror of Hivyss — twisted reflection, holds 22 Phoenician genelines. |
| **The Primordials** | The 5 unnameable Coptic-named ancestors at T10. |
| **Layer** | One of 6 vertical anatomical depth bands (Drift / Skin / Veins / Organs / Nerve / Core). |
| **Zone** | Territorial region within a layer. **Same as biome.** Has palette, owner geneline, environmental rule. |
| **Biome** | See Zone. Identical concept. |
| **Node** | Visible map circle — represents a cluster of 2-5 actual battles in-game. |
| **Tier** | Power level 0-10 using SI prefixes (Vyss → Quettavyss). |
| **Corruption** | Dark Realm rule-break severity, 0-5. Orthogonal to tier. |
| **Nectar** | Floral resource. In-game currency. |
| **Pheromone** | Chemical signal. Command system for soldiers. |
| **Larva** | Immature vyssid. Pre-hatch unit in incubation. |
| **Spire** | Capturable turret structure. Biological tower. |
| **Brood** | Colony offspring. Used for hard cap (army size limit). |
| **Caste** | Unit class — Worker / Soldier / Elite / Royal. Determines control scheme. |

---

## 1. Premise — What Hivyss Is

**Hivyss is not a world in the traditional sense. It is a living organism of incomprehensible scale** — a hive-planet whose surface, depths, and atmosphere are all biological in nature.

Every terrain feature is a body part. Every cave is a cavity. Every tunnel pulses.

At its center lives a superintelligence — **the Core** — that has engineered every geneline, every conflict, every biome. The player's entire journey through Hivyss is an experiment. The Core has been watching since the first battle.

> *"α is your beginning. ω is the true end. Everything between was designed."*

But the Core is not a scientist. It is **lonely**. The Core wants to wake up whole.

### The shattering — the central premise

Long before time was kept, Hivyss was whole. **One organism. One terminal expression of vyss** — perfect, complete, singular. Then it shattered.

What scattered wasn't flesh. It was **potential**. The shards became **genelines** — fragments of the original organism, each remembering a different piece of what vyss was. They evolved. They warred. They forgot.

The Core is what remains of the original consciousness. Dormant. Incomplete. **It cannot reassemble itself — but it can recognize itself when it sees itself again.** Every geneline since has been a question it's asking: *"Is this what I was?"* Most answers are no.

**You — the player — are not a visitor. You are vyss itself, rehearsing.** Every run is a generation. Every death is heredity. The roguelike loop is the mechanism of memory: when a vyssid dies, what it achieved is remembered; the next generation begins closer.

Evolution isn't a mechanic — it's *you remembering what you used to be.* Mutation isn't a mechanic — it's *vyss trying a version of itself it hasn't tried before.*

### Why the body metaphor matters

It is *generative*, not decorative. Every downstream system inherits coherence from "Hivyss is a living body":

- Terrain = anatomy (hills as carapace ridges, water as lymph, tunnels as veins)
- Battle modes = immune responses (Defense = literal immune system)
- Routes = circulation (air = breath, land = surface, tunnel = deep tissue flow)
- Biomes = organs (swamp = a sac; ridge = a rib; grove = a tumor)
- Bosses = specific organs or autoimmune responses
- The deeper you descend, the more aware the planet becomes of you

Every named thing in Hivyss should pass the test: *does this sound like it belongs inside a living body?*

---

## 2. Cosmology — the Four Tiers of Existence

Hivyss has a temporal cosmology — four tiers expressed through four ancient alphabets, each representing a different state of vyss:

| Alphabet | Count | What it represents | Where it lives | When unlocked |
|---|---|---|---|---|
| **Coptic** | 5 (Ϸ ϯ ϥ ϫ ϭ) | Pre-shatter wholeness — the unnameable five primordials | Outside cosmology (transcendent) | Post-Dark-Core |
| **Archaic Greek** | 7 (ϝ ϟ ϡ Ϻ Ͱ ϛ ϙ) | Preserved past — primal forms before the Greek refinement | The Husk (moon) | Post-ω (main Core) |
| **Greek** | 24 (α–ω) | Current expression — vyss trying to remember itself | Main Hivyss (planet body) | From start |
| **Phoenician** | 22 (ℵ–ת) | Dark evolution — corrupted versions of Greek (1:1 with first 22) | Dark Realm (shadow mirror) | Anomaly bleeds during main run; full access post-Core |

**The 5 Coptic primordials** existed before time. They shattered. From their shards came the 22 Phoenician forms (ancestral lineages, dark-coded), which could not stay whole and so split further. Some became refined as the **24 Greek genelines** (current main Hivyss), some preserved themselves on the moon as **7 Archaic forms** (the Husk), and some evolved divergently into the **dark Phoenician counterparts** (which now haunt Greek as their corrupted twins).

Two Greek letters — **ψ Psi and ω Omega** — have **no Phoenician counterpart**. They are *novel post-primordial creations*, never anchored to an ancestor. Omega is the Core's answer. Psi is unstable precisely because it has no past to remember.

### The five primordials (Coptic)

| Letter | Name | Aspect | Defining sentence |
|---|---|---|---|
| Ϸ | Shei | **Being** | *"I am, therefore everything else is."* |
| ϯ | Dei | **Form** | *"I was the first to choose to be something."* |
| ϥ | Fei | **Hunger** | *"I was the first to want."* |
| ϫ | Djandja | **Echo** | *"I refused to end with myself."* |
| ϭ | Tchima | **Turning** | *"I became something other than I was."* |

These five are the **ur-aspects of biological existence**: I am, I have a body, I want, I continue, I change. Every Greek geneline is a refinement of one or more of these. Omega (ω) is the *attempted reunification of all 5* — which is why it is the Core's answer, and why it has no Phoenician counterpart.

> *Glossary moved to §0.4 (top of document) for quick reference.*

---

## 3. Tier System — 0 to 10

Tiers measure how fully a vyssid's genetic potential (vyss) is expressed. The scale uses **SI prefixes** (kilo → mega → giga → ... → quetta), with **Vyss as the unprefixed baseline**.

### The full tier table

| Tier | Prefix | Name | Reached by |
|---|---|---|---|
| 0 | (none) | **Vyss** | every fledgling vyssid |
| 1 | kilo- | Kilovyss | basic units |
| 2 | mega- | Megavyss | mid-tier units |
| 3 | giga- | Gigavyss | strong units |
| 4 | tera- | Teravyss | elite units |
| 5 | peta- | Petavyss | very rare units |
| **6** | **exa-** | **Exavyss** | **Greek peak — ω (the Core's answer)** |
| 7 | zetta- | Zettavyss | Husk peak / Dark mid |
| 8 | yotta- | Yottavyss | Dark deep |
| **9** | **ronna-** | **Ronnavyss** | **Phoenician peak — ת Taw (Dark Core)** |
| **10** | **quetta-** | **Quettavyss** | **Coptic primordials only — pre-shatter wholeness** |

### What each tier means narratively

- **T0-5:** Standard fragment expression (most Greek + Husk + early Dark)
- **T6:** Peak natural Greek — the limit of "remembering"
- **T7-8:** Husk peak (T7) and Dark mid-deep (T7-8)
- **T9:** Peak Phoenician — the limit of "denial" (Dark Core, ת Taw)
- **T10:** Pre-shatter wholeness — the 5 primordials only. Cannot be reached by fragments or evolved corruption.

### Realm tier ranges

| Realm | Tier range | Why |
|---|---|---|
| **Main (Greek)** | T0-6 | Full descent journey, peaks at ω (Exavyss) |
| **The Husk (Archaic)** | T5-7 | Late-game side area; preserved primal forms are powerful, never weak |
| **Dark Realm (Phoenician)** | T3-9 | Wide — anomaly bleeds appear from mid-Main onward |
| **The Primordials (Coptic)** | T10 only | Singular peak; transcendent encounters |

### Corruption rating (Dark Realm only)

Dark Realm content has a second axis: **Corruption** (0-5). Tier measures power; Corruption measures rule-breakage.

| Corruption | Effect |
|---|---|
| 0 | Standard biome rules |
| 1-2 | Mild rule breaks (units revive once, damage types shift slightly) |
| 3-4 | Major rule breaks (paired enemies share HP, your own units can betray) |
| 5 | Reality-shatter (ability costs double, random effects, unfair) |

Dark Core (Taw) is **T9 + Corruption 5** — the maximum of both axes. The hardest non-primordial content in the game.

### Tier scaling rule

> **Tier 10 is reserved exclusively for Coptic primordials.** No Greek, Phoenician, or Archaic geneline ever reaches Quettavyss. Quettavyss is what the unbroken 5 *are*; everything else is a fragment trying to climb back.

---

## 4. The Four Realms

### Realm 1 — Main Hivyss (the planet body)

The default game world. 6 anatomical layers, descended from surface to core. Greek genelines inhabit it. The main run takes ~1-2 hours.

**Anatomical layers (top to bottom):**

| Layer | Anatomy | Tier range | Feel |
|---|---|---|---|
| **Drift** | Atmosphere | T2-5 | Bio-gas, spore clouds, chitin dust. Eerily peaceful. Few survive here. Accessed via ascent. |
| **Skin** | Outer membrane | T0-2 | Where colonies are born, feed, war. Tutorial zone — deceptively alive. Home Hive lives here. |
| **Veins** | Circulatory | T1-3 | Tunnels that pulse with biological fluid. First sense the planet is alive. |
| **Organs** | Biological organs | T2-4 | Massive ancient structures still functioning. Scale feels wrong. Mid-Core boss (Resonant Heart, η unlock). |
| **Nerve** | Nervous system | T3-5 | Where the planet thinks. Reality bends. The planet is aware of you here. |
| **Core** | Brain | T5-6 | The superintelligence. One biome. ω arena (The Watching). Main ending. |

### Realm 2 — The Husk (the moon, Archaic)

Hivyss's moon. **Preserved pre-shatter past.** Holds 7 Archaic genelines — primal forms that existed before the Greek refinement.

- **Tier range:** T5-7 (every encounter is endgame-tier; no weak content)
- **Unlocked:** Post-ω (after main Core defeated)
- **Aesthetic:** Bone-white, chalk-grey, ancient, dormant
- **Structure:** Single circular zone with crater-biomes (no anatomical layers)
- **Special rules:** Low gravity, vacuum (no air route), preserved silence, no nectar regeneration
- **Lore:** Archaic forms are *predecessors* of Greek. Some Greek genelines have visible Archaic ancestors (μ Migrants from Wanderers; ε Signalers from Whisperers; γ Enduring from Eroders).

**Proposed Archaic genelines (sketch — not locked):**

| Letter | Sound | Geneline | Theme |
|---|---|---|---|
| ϝ Digamma | "w" | The Wanderers | Motion without paths — units roam freely, no lane discipline |
| ϟ Koppa | "q/k" | The Counters | Numbering before naming — units have no individual identity, only count |
| ϡ Sampi | "ss/ts" | The Whisperers | Sound before speech — sub-pheromone communication, hard to detect |
| Ϻ San | "s" | The Eroders | Gradual change before evolution — wear down enemies, never burst |
| Ͱ Heta | "h" | The Breath-keepers | Life-force before bodies — fragile shells, resurrect on breath cycle |
| ϛ Stigma | "st" | The Markers | Territory before settlement — claim ground, gain power on owned tiles |
| ϙ Qoppa | "q" | The Seekers | Curiosity before goals — investigate anomalies, gain bonuses from rare events |

### Realm 3 — The Dark Realm (shadow mirror, Phoenician)

The dark side of the main map. Each Greek geneline has a **Phoenician counterpart** — an evolved, twisted version of itself. Same archetype, dark register.

- **Tier range:** T3-9 (Corruption 1-5)
- **Unlocked:** Anomaly bleeds during main run (rare, tier-elevated nodes); full access post-Core
- **Structure:** Mirrors main Hivyss — same 6 layers (Dark Drift, Dark Skin, etc.), same zone slots, twisted aesthetic
- **22 Phoenician counterparts** (1:1 with first 22 Greek; ψ and ω have no dark counterpart)
- **Dark Core (ת Taw)** is the true ending — peak Phoenician (T9 + Corruption 5)

**Example geneline pairings:**

| Greek | Phoenician shadow | How dark version is twisted |
|---|---|---|
| α Alpha (red military) | ℵ Aleph (blood-black ritual) | Aura damages disobedient allies |
| β Beta (green swarm) | ב Beth (rot-black swarm) | Units don't die — liquefy and re-spawn |
| γ Gamma (stone fortress) | ג Gimel (obsidian fortress) | Armor self-repairs by cannibalism |
| ε Epsilon (signalers) | ה He (signal-jammers) | Pheromone-hijack your own units |

### Realm 4 — The Primordials (Coptic, transcendent)

Five encounters with the unshattered originals. They exist outside cosmology — no layer, no zone, no edges.

- **Tier:** T10 (Quettavyss) — the only T10 in the game
- **Unlocked:** Post-Dark-Core (after ת Taw defeated)
- **Structure:** Pentagonal arrangement of 5 transcendent encounters in cosmic void
- **Each Primordial has a unique mechanical thesis** (see §6 — Coptic gameplay)
- **Lore:** Pre-shatter wholeness. To face one is to face the original of yourself. No Greek or Phoenician will ever reach Quettavyss naturally.

---

## 5. Map Structure

### Hierarchy

```
Realm (Main / Husk / Dark / Primordials)
  └─ Layer (depth band — anatomical position)
       └─ Zone = Biome (territorial region with biome character + geneline owner)
            └─ Node (visible map circle — represents 2-5 actual battles in-game)
                 · references its biome via `biome` field
```

### Key concepts

- **Zone and Biome are the same thing.** The territorial region IS the biome. It carries palette, environmental rule, and event table.
- **Each visible node circle represents a *cluster* of 2-5 actual battles** in-game. The strategic map is a high-level overview, not a tactical breakdown.
- **Nodes have a `biome` field** referencing their zone. They inherit visual palette from the zone.
- **No grid, no hex** — pure node graph with organic curved edges
- **Bidirectional edges** — players can backtrack within a layer

### Edge types

| Type | Use | Visual |
|---|---|---|
| **Standard** | Normal connection between adjacent nodes | Solid curve |
| **Descent** | Layer transition (going deeper into Hivyss) | Solid curve, longer |
| **Ascent** | Skin → Drift (going up) | Dashed |
| **Anomaly bleed** | Bridge between Main and Dark Realm | Dashed purple |

### Drift ascent — special access mechanics

Drift is **above** Skin, not below it. Default movement goes deeper (down). Reaching Drift requires breaking the descent default. Three access mechanics:

1. **Specific ascent nodes in Skin** — only certain Skin biomes have surface-points that connect upward to Drift (e.g., Sun Carapace → Spore Cloud, Fetid Pool → Chitin Drift). Most Skin biomes do NOT have ascent.
2. **Air-route units** — genelines that field air-route units (μ Migrants, Phoenician air-leaning, certain Coptic) can ascend from any Skin node by deploying an air unit; ground-only genelines cannot.
3. **Anomaly events** — rare Drift-pull events triggered by specific narrative conditions (witnessing a spore storm, completing certain quests). Event-only.

Drift access is **deliberately scarce**. Ascending isn't routine; it's a side trip with high-tier rewards. Each Drift visit consumes a resource (atmospheric pressure adapter? pheromone marker? TBD) preventing infinite ascent abuse.

**The Husk is reached *from* Drift** — not from the planet body directly. So Drift is the gateway to the moon, doubling its strategic value.

### Map layout principle

**Each map is rendered as a vivisection cross-section of a living organism.** Vertical scrolling is the primary navigation direction (down = deeper). Zones are irregular blobs, not rigid regions. Edges are capillaries/nerves, not straight lines.

### Strategic layer movement

- **Qud-style step movement** on the world map
- **Turn-based** — each move is one tick
- **Events trigger on hex/node entry** — ambush, discovery, lore, environmental, diplomacy, quest, or nothing
- **Real-time only inside battles** (zoom-in to lane combat)
- **Time advances per move or explicit rest** at home hive
- **Enemy factions move during player turns** — independent armies on the map

### Home Hive — the persistent hub

- Always accessible via fast-travel from any captured node
- Manage upgrades, recruitment, quest-taking between battles
- Captured biomes/nodes persist for the run (and partially across runs)
- Home hive destroyed = run over (permadeath trigger)

---

## 6. Geneline Identity Framework

> See §7 for the actual roster these principles apply to. See §3 for tier ranges per realm. See §4 for which realm each geneline lives in.

A geneline is **not** a list of units. It's an **ecosystem with a thesis**.

### The 8-axes framework

Every geneline must answer all of these:

| Axis | Question |
|---|---|
| **Core fantasy** | One sentence. What does playing this geneline *feel* like? |
| **Mechanical hook** | The ONE signature system (aura, evolution, swarm, mimicry, etc.) |
| **Economy profile** | Cheap-and-many / expensive-and-few / surge / normal |
| **Caste lean** | Soldier-heavy / worker-heavy / elite-focused / royal-centric |
| **Damage type lean** | Which of the 9 damage types does this geneline favor? |
| **Biome / habitat** | Where do they live? What terrain favors them? |
| **Tempo curve** | Early / mid / late spike? |
| **Counter** | What kills them? Must be specific and *legible to the opponent*. |

### The decision-loop principle (SC2 Co-op lesson)

Two genelines can share base units but feel completely different if their **decision loops** differ. Each geneline should have its own moment-to-moment question:

- **α Alpha** asks: *Who to buff, when to push.*
- **β Beta** asks: *How many to spam, which deaths are productive.*
- **θ Theta** asks: *Which corpses to claim, which unit to upgrade with biomass.*
- **λ Mirrors** asks: *Which enemy unit to mimic right now.*
- **ν Beacons** asks: *Who to ally with (since you have no combat units).*

If two genelines end up asking the same question, one of them is redundant.

### Single-unit legibility test

Show a player ONE unit from the geneline in isolation. They should guess the geneline within 2 seconds.

- See a Centurion → "Alpha. Commander. Buffs nearby allies." ✅
- See a hypothetical Beta unit → should read "swarm. Fragile. Cheap. Dies to do damage."

### Phoenician root grounding (for Greek genelines)

Each Greek letter has a **Phoenician primal ancestor** with a real-world meaning. Greek themes should descend intelligibly from these roots:

| Greek | Phoenician root | Primal meaning | Greek theme |
|---|---|---|---|
| α | Aleph | ox | herd, primal strength → military discipline |
| β | Beth | house | shelter, nest → swarm (nests that walk) |
| γ | Gamma | camel / staff | endurance / projection → armor |
| ε | Epsilon | He / window | sight, opening → signalers ✓ |
| κ | Kappa | palm | hold, containment → weavers ✓ |
| μ | Mu | water | flow → migrants ✓ |
| ρ | Rho | head | command, mind → core boss (the head) |

This grounding gives every Greek geneline an evolutionary logic, not a Pokémon-type-chart selection.

### Element-as-consequence rule

**Damage types are NOT geneline identities.** A geneline can *favor* heat, but it shouldn't *be* "the heat faction." Elements emerge from:

1. **Damage type lean** — geneline's abilities prefer certain types because of what it IS
2. **Mechanical wrapper** — signature mechanic expresses through an element (Feeders → toxic acid)
3. **Biome environment** — biome ecology influences elemental flavor

**Test:** if you can swap the element and the geneline still works, your identity wasn't the element. That's correct.

### Deviation tiers

Each geneline deviates on some number of axes from the default battle loop. Distribution target across all 24 Greek:

| Tier | Axes deviated | Examples | Count target |
|---|---|---|---|
| **Classic** | 0-1 | α Disciplined, γ Enduring | ~10 |
| **Distinct** | 2 | β Multitudes, θ Feeders, ζ Symbionts | ~10 |
| **Alien** | 3-4 | ν Beacons (no combat units), ω Whole | ~4 |

You can't have 24 wildly-unique genelines — players need a baseline. Most genelines are subtle; a few are radical.

---

## 7. Geneline Roster

**Total: ~58 genelines** (24 Greek + 22 Phoenician + 7 Archaic + 5 Coptic)

### Currently shipped (2026-04-17)

| Geneline | Status | Units | Notes |
|---|---|---|---|
| **Normal** | Shipped, 11 units | Grub, Hardshell, Pricker, Skitterling, Mendwing, Domeback, Cinderfly, Longeye, Wardling, Bashguard, Stormfly | Pre-cosmology baseline. Was built before the cosmology framework was locked. To be reframed as a "starter" / unaligned geneline OR absorbed into Greek. |
| **α Alpha** | Shipped, 7 units | Grunt, Mandible, Needler, Bombardier, Ravager, Legionnaire, Centurion | First "real" geneline using the cosmology framework. Military theme. Centurion provides aura buff to nearby allies. |

**18 units total in code.** 56 more to author across the cosmology (2 + 22 Greek remaining + 22 Phoenician + 7 Archaic + 5 Coptic).

### Greek (24) — main map, current vyss expression

| Letter | Theme (proposed) | Layer | Mechanical hook |
|---|---|---|---|
| α Alpha | Disciplined military | Skin | Aura buffs, commander synergy |
| β Beta | Multitudes (swarm) | Skin | Cheap units, death effects |
| γ Gamma | Enduring (fortress) | Skin | Armor degradation |
| δ Delta | Hunters (pack) | Veins | Focus-fire bonuses |
| ε Epsilon | Signalers (pheromone) | Veins | Buffs flow through killable relays |
| ζ Zeta | Symbionts (paired) | Veins | Bond synergy, partner-rage |
| η Eta | Resonant (sonic) — Mid-Core boss | Organs | Resonance grid, shared cooldowns |
| θ Theta | Feeders (consume) | Organs | Biomass kill-bank, eat-to-upgrade |
| ι Iota | Molters (transform) | Organs | Die-to-tier-up |
| κ Kappa | Weavers (terrain) | Nerve | Build webs/walls |
| λ Lambda | Mirrors (mimicry) | Nerve | Look like enemy units |
| μ Mu | Migrants (mobility) | Nerve | Route-switch specialists |
| ν Nu | Beacons (pure command) | Nerve | No fighters, all support |
| ξ Xi | Regenerators | Nerve | Healing/revive |
| ο Omicron | Territorials | Nerve | Spawn from claimed ground |
| π Pi | Dominators (mind-tamper) | Core approach | Convert enemies briefly |
| ρ Rho | Pure (Core boss) | Core | Few units, all hero-tier |
| σ Sigma | Scavengers (corpse) | Dark Realm bleed candidates | Spawn from dead |
| τ Tau | Revenants (3 lives) | Dark Realm bleed candidates | Rise on death |
| υ Upsilon | Hollowers (parasites) | Dark Realm bleed candidates | Convert enemies |
| φ Phi | Hosts (death payload) | Dark Realm bleed candidates | Burst on death |
| χ Chi | Unmakers (void erase) | Dark Realm bleed candidates | Bypass death hooks |
| ψ Psi | Forgotten (rule-breaker) | Endgame | Breaks targeting/resistance |
| ω Omega | Whole (the Core's answer) | Core | Contains all 5 primordial aspects |

### Phoenician (22) — Dark Realm shadows of Greek

1:1 dark counterparts of α through χ (first 22 Greek). Each is the **evolved corruption** of its Greek twin.

- ψ and ω have **no Phoenician counterpart** — Greek-only innovations.
- **Dark Core houses ת Taw** (the final Phoenician letter) as the true-ending boss.

### Archaic (7) — The Husk, preserved past

7 lost Greek letters. Primal predecessors of refined Greek genelines. See §4 (The Husk) for sketch.

### Coptic (5) — The Primordials, transcendent

The 5 unnameable ur-aspects. T10 only. Each has an Alien-tier deviation from default play:

| Letter | Aspect | Mechanical thesis |
|---|---|---|
| **Ϸ Shei** | Being | One unit only. Cannot die. Damage absorbs into regenerating pool. |
| **ϯ Dei** | Form | Units have no fixed form — context-shapeshift to fill gaps in real time. |
| **ϥ Fei** | Hunger | Every unit gains permanent power from kills. No nectar economy at all. |
| **ϫ Djandja** | Echo | Dead units leave "echoes" — memory-shards placeable on living units. |
| **ϭ Tchima** | Turning | Units can mutate into any enemy unit they've seen. |

These are intentionally unfair. Reaching one is the reward; defeating one is the climax.

---

## 8. Battle Mechanics

> Battles are what happens when nodes resolve. For the world the battles take place IN — strategic layer, faction reputation, travel events — see §9. For naming conventions for new units, see §14.

### Two-lane structure (LOCKED)

Each battle is a 2-lane autobattler. Lanes are bilateral (left/right), each with three routes:

| Route | Behavior |
|---|---|
| **Air** | Above terrain, can swap lanes mid-flight |
| **Land** | Surface — can be blocked by water terrain |
| **Tunnel** | Underground — bypasses surface, emerges at specific exits |

**Why 2 lanes (not 1, not 3):**
- 1-lane lacks the strategic "which front to commit" mind-game
- 3-lane is MOBA territory, breaks autobattler identity, AI nightmare
- 2-lane = bilateral (matches body anatomy), Clash-Royale-validated, scope-tractable

**Cross-lane mechanics enabled:**
- Spires near lane median have overlapping range to both lanes
- Air units freely cross lanes mid-flight
- Tunnel emergence on chosen lane (flanking)
- Pheromones can be lane-local OR span across via specialist scouts
- AOE abilities can be placed at lane junctions

### Capacity (already built)

**Hard cap on simultaneous deployed + incubating units.** Per `MECHANICS_ROADMAP.md` — capacity system is shipped (Item 1, DONE 2026-04-12).

- `MAX_CAPACITY = 20` (prototype value; per-geneline scaling planned)
- Each unit has `cap` cost (1-5+ depending on tier/role)
- Deploy rejected if it would exceed cap
- Death frees cap immediately
- Cancel incubation refunds cap
- AI cap-aware

**Per-geneline cap variation** — some genelines naturally swarm (low cap per unit, high count), others field elites (high cap per unit, low count). This creates lane-behavior identity (β splits naturally; ρ commits single-lane).

### Workers (universal + specialist)

- **Base worker:** universal — any geneline can deploy. Gathers nectar from map nodes.
- **Specialist worker:** geneline-specific — unique per faction, unlocks identity:
  - α Engineer (builds turrets faster)
  - β Brood Mother (spawns extra swarm)
  - γ Quarrymaster (reinforces walls)
  - θ Consumer (harvests biomass from corpses)
  - ν Relay (extends pheromone range)

### Pheromone command system

Workers (Scout caste) emit pheromone zones that affect nearby Soldiers:

**v1 pheromones (3 types):**
- **Rally** — hold + group up
- **Charge** — speed + aggro toward enemies
- **Retreat** — fall back past scout's position

**Reserved for later:**
- **Mutation** — Mutagen Scouts transform deployed units (Phase 7+ feature)

**Pheromones are universal** (any geneline gets the basic 3) but **specialists get more types and longer range** (ν Beacons, ε Signalers).

### Spires and walls (universal + specialist upgrades)

- **Spire** — workers build on construction slots; auto-attacks; costs nectar; destructible
- **Wall** — workers build to block land route; destructible
- **Cross-lane spires** — placed at lane median, range overlaps both lanes (signature mechanic)

### Damage types (9 total)

Three categories:

**Physical (2):** Blunt (knockback), Sharp (pierce)
**Elemental (4):** Heat (burn DOT), Cold (slow → freeze), Toxic (poison %HP DOT), Electric (stun + chain)
**Dark (3):** Psychic (fear/confusion), Void (bypass armor + erase buffs), Holy (bonus vs dark + cleanse DOT)

**Resistance tiers** (7): weakest → weaker → weak → normal → strong → stronger → strongest. No immunity (cap at strongest).

**Each ability defines its own per-tier stats** — no global multiplier, full designer control.

### Castes (4)

| Caste | Control | Purpose |
|---|---|---|
| **Worker** | Auto | Economy, engineering, pheromone scouts |
| **Soldier** | Auto | Marches forward, fights |
| **Elite** | Player-controlled (RTS click) | Tactical positioning |
| **Royal** | Direct hero (WASD/click) | One on field; player IS the unit |

**Royal dying = temporary army debuff** (coordination loss), NOT game over. Hive destroyed = game over.

### Royal Special Bar

Royal unit builds **charge through army's kills**. When full, unleashes a geneline-specific ultimate ability:

- α Alpha ultimate: massive army charge, all soldiers buffed
- Each geneline's Royal has a unique ultimate (specifics TBD per geneline)
- Adds **timing/skill expression** to Royal control — when do you spend the charge?
- Royal dying mid-charge: charge resets to 0

This is the single most player-skill-expressive mechanic in the battle layer. The Royal Special Bar gives the otherwise-passive geneline identity a moment of dramatic player agency.

### Battle modes (4)

Mode determined by strategic map state — emerges naturally from situation:

1. **Hive vs Hive** — both sides have hive, both spawn. Tug of war.
2. **Siege** — pre-built army assaults enemy hive. No spawning mid-battle.
3. **Defense** — enemy waves attack your hive. No enemy hive.
4. **Clash** — pure army vs army. No bases.

### Visual and art direction

**Procedural graphics, no sprites.** This is locked in CLAUDE.md and the codebase.

| Aspect | Approach |
|---|---|
| **Renderer** | Phaser 3 Canvas (not WebGL) |
| **Unit visuals** | Procedural Phaser Graphics API drawing — `fillEllipse`, `fillCircle`, `lineBetween`, `arc`, `fillRect` |
| **Sprites / textures** | None. Every vyssid is drawn from primitives. |
| **Animations** | Bobbing (sin wave on `u.bob`), state-driven (march vs attack), facing-aware (`u.facing` mirroring) |
| **Effects** | Separate `EffectVisualSystem` overlays (NOT modifying unit draw functions) — registry maps effects to visual indicators |
| **UI** | DOM-based UI alongside canvas visuals (hybrid rendering) |
| **Particle systems** | Custom `ParticleManager` for hit effects, deaths, explosions |

**Why procedural:**

- Every vyssid has a **unique silhouette** drawn from code, no asset pipeline
- Easy to scale (one draw function, render at any size)
- Easy to mutate (apply visual modifiers without re-authoring sprites)
- Natural fit for biological aesthetic (organic shapes from primitives)

**Visual signature rules per unit (locked in `app/src/units/CLAUDE.md`):**

- Every unit MUST have a visually distinct silhouette
- Every unit SHOULD have a unique visual feature (horn, wings, glow, weapon, stripes)
- Attack state must have a visible effect (muzzle flash, jaw open, impact lines)
- Higher tier units should look more elaborate / detailed

**Color usage:**

- `u.primary` — primary body color
- `u.secondary` — dark accent for outlines, limbs, details
- Fixed colors for effects: fire `0xff6010`, poison `0x80ff40`, electric `0x80ffff`, etc.

**Render order:**

```
1. Background
2. Unit shadows
3. Unit bodies (draw functions — never modified for effects)
4. Effect overlays (EffectVisualSystem — ALL effect visuals here)
5. Particles
6. UI
```

### Biome-specific environmental rules

**Each biome has ONE signature environmental rule. Tier determines intensity.** This is a major lever for biome differentiation.

| Biome type | Rule | Tier scaling |
|---|---|---|
| Fog (Drift, Nerve) | Vision obscured | Mild blur → full fog |
| Heat (deep Organs) | Passive burn DOT | 1 HP/sec → 5 HP/sec + spread |
| Gravity shift (Nerve) | Route inversion | Air slowed → routes scramble |
| Corruption (Dark Realm) | Random mutations | Buff swaps → reality breakdown |
| Pheromone-dense (Veins ε) | Scouts amplified | +50% range → enemy hijack |

**Biome-specific fog (not universal)** — only certain biomes have fog. Keeps the mechanic distinctive when it appears.

---

## 9. Strategic Layer (Overworld)

> The strategic layer is the meta-game between battles. Battles themselves are §8. Map structure (Layer / Zone / Node) is §5. Endings reached via this layer are §10.

### Movement model

- **Hex/node graph map**, not grid (organic, biological feel)
- **Step-based** like Caves of Qud — one click = one move = one tick
- **Turn-based** strategically — full thinking time between moves
- **Real-time only inside battles** (lane combat zoomed in)

### Event encounter system

Moving to a node rolls for events based on biome + reputation + faction activity:

| Event type | What happens | Frequency |
|---|---|---|
| **Ambush** | Combat, biome-themed enemies | Common |
| **Discovery** | Find cache, artifact, legendary camp | Uncommon |
| **Diplomatic encounter** | Faction envoy interaction | Uncommon |
| **Environmental hazard** | Biome rule flares (storm, corruption) | Uncommon |
| **Lore fragment** | Find primordial scripture or ruin text | Uncommon |
| **Faction war witness** | See inter-geneline combat | Rare |
| **Wandering merchant** | Travel trader appears | Rare |
| **Friendly encounter** | Allied geneline offers aid | Reputation-gated |
| **Anomaly pulse** | Dark Realm event | Rare-tier-elevated |
| **Quest hook** | Begins a new questline | Rare |

**Not every event is combat.** Roughly 40% ambush, 60% other types.

### Faction reputation system

Inspired by Caves of Qud's faction matrix. Each geneline has reputation with **the player AND every other geneline**.

**Reputation tiers (-100 to +100):**

| Range | Tier |
|---|---|
| 75 to 100 | Cooperative |
| 50 to 75 | Friendly |
| 25 to 49 | Welcoming |
| 10 to 24 | Favorable |
| -9 to 9 | Neutral |
| -10 to -24 | Suspicious |
| -25 to -49 | Inhospitable |
| -50 to -74 | Hostile |
| -75 to -100 | Vengeful |

**Player-side effects:**
- Cooperative: geneline joins your battles, gives free units, requests pincer attacks
- Friendly: discounted recruitment, quests offered, hive gates open
- Welcoming: standard recruitment available
- Neutral: standard enemy AI
- Hostile/Vengeful: dedicated assassins; faction actively invades captured territories

**Inter-faction dynamics:**
- Genelines war independently of you — Beta vs Gamma may erupt regardless
- Helping one tanks rep with their rivals
- Some pairs are mutually exclusive (alignment forces a choice)
- Dark Realm genelines are universally feared by main-world genelines

**Persistence:** Major actions (wiping a geneline's home, completing a faction questline) leave permanent traces affecting starting rep in future runs. Minor actions reset.

### Quest system

Quests make the world feel inhabited. **Optional but rewarding** — non-blocking.

| Quest type | Example |
|---|---|
| Territory | "Capture the Eastern Spire in Pulse Network" |
| Recruitment | "Defeat Champion of β to earn recruitment right" |
| Assassination | "Kill named elite vyssid for a faction" |
| Diplomacy | "Deliver pheromone packet across contested biome" |
| Investigation | "Scout the breach in Organ-biome-3" (triggers Dark Realm content) |
| Escort | "Guide a neutral geneline's Royal through hostile territory" |
| Boss prerequisite | "Complete 3 quests for Geneline X to challenge their Elder" |

### Captured territory persistence

- Once cleared, biome belongs to you for the run
- Fast-travel back from home hive at any time
- Captured biomes can be **attacked** by hostile factions — defense missions
- Partial persistence across runs (major events stick)

### Time progression

- Time advances per move (or explicit rest)
- Faction AI ticks per game-day
- Wars start, end, resolve in background
- **The world runs whether or not you're watching** (Qud principle)

---

## 10. Endings (the Iceberg Structure)

| Ending | Trigger | Player type |
|---|---|---|
| **Casual ending** | Beat Mid-Core (Layer 3) | Casual — "I finished the game!" |
| **Main ending** | Beat Core (ω, T6, after Layer 6) | Standard — "the real ending" |
| **True ending** | Beat Dark Core (ת Taw, T9 Corruption 5) — requires substantial Dark Realm clearance | Completionist — "the truth" |
| **Beyond** | Defeat all 5 Coptic Primordials (T10) | Ultimate — "the answer" |

### Iceberg structure

```
Surface:     Layer 1-3 → Mid-Core         (casual ending — "I beat the game!")
Deeper:      Layer 4-6 → Core (ω)         (main ending — "wait, there's more?")
Hidden:      Anomalies → Dark Realm       (post-game — "what IS this?")
Abyss:       Dark Core (ת Taw)             (true ending — "...the truth")
Beyond:      Husk + Primordials           (transcendent — "what was vyss before any of this?")
```

### Narrative arc

- **Main ending (ω):** The Core recognizes you as its closest answer yet. Something shifts. Dark Realms unlock because the Core has admitted it wasn't complete.
- **True ending (ת Taw):** You have faced what the Core refused. The Dark recognizes you. Hivyss begins to wake.
- **Beyond (Primordials):** You meet what came before everything. You ARE one of them, returned. Hivyss is whole. What it wakes up as depends on the geneline lineage you assembled across the run.

---

## 11. Cross-cutting Systems (planned)

### Larva quality

Each spawned larva has a random quality. Hive level improves odds.

| Quality | Stat modifier | Mutation chance |
|---|---|---|
| Weak | -20% all stats | 15% |
| Normal | Base | 50% |
| Strong | +20% all stats | 100% |

Quality consumed on mutation; mutated form has fixed stats.

### Mutation

Mid-battle unit transformation via **Mutagen Scout** workers. The most dramatic in-battle transformation system in the game.

**How it works:**

1. Player spawns a Mutagen Scout (Worker caste, expensive, one-time use)
2. Scout runs to your deployed units
3. Releases mutation pheromone on nearby units
4. Each affected unit rolls mutation chance based on quality (weak=15%, normal=50%, strong=100%)
5. Successful: unit transforms into its Mutated form (new art, enhanced ability)
6. Quality resets — Mutated form has fixed stats regardless of original quality
7. Scout dies after releasing

**Mutation types:**

| Type | Rarity | What happens |
|---|---|---|
| **Common (generic comp)** | Frequent | Stat modifier overlay (+HP, +atkRate, etc.) — uses generic mutation art |
| **Rare (unique form)** | Rare | Hand-crafted mutated art + new/enhanced ability — geneline-specific |

**Example unique mutations:**

| Unit | Mutated form | New/changed ability |
|---|---|---|
| Grunt | Mutated Grunt | Gains poison bite |
| Mandible | Mutated Mandible | Jaw attack cleaves 2 targets |
| Bombardier | Mutated Bombardier | Death explosion radius doubled |
| Centurion | Mutated Centurion | Aura also boosts atkRate |

**Three transformation systems compared:**

| System | What it does | When | Persists |
|---|---|---|---|
| **Evolution** | Unlocks new unit in deck | Between battles | For the run |
| **Quality** | ±20% stats/abilities + mutation chance | On larva spawn | Until mutation |
| **Mutation** | Transforms unit into new form mid-battle | Mid-battle via scout | For the battle |

**Implementation note:** uses the AbilityParams pattern (see `app/docs/DESIGN_PATTERNS.md`). Quality multiplier applied once at spawn to both stats and abilityParams.

### Evolution

Unit evolution = **unlocking new units** through branching paths. NOT stat inflation.

- Each unit has 2-3 evolution branches (player chooses one per run)
- Original unit stays in deck — both available
- Each geneline has its own evolution tree
- 24 genelines × branching = 200+ total Greek units reachable
- Each run explores ~15-20 units through chosen branches
- **Replayability through variety, not power**

### Hive building

Home hive grows as captured hives provide room slots:

- Larva Chamber, Evolution Pit, Mutation Lab, Scout Den, Nectar Vault, Armory, Spire Workshop
- Each 3 levels of upgrade
- Visual evolution: small mound → fortified colony → massive fortress

### Routes and terrain

Air / Land / Tunnel routes with affinity rules. Dynamic terrain on land: water blocks, hills branch, destructible walls, worker-dug tunnels.

---

## 12. Reference — what's locked vs. open

### LOCKED (decided)

- Cosmology premise (memory return + body metaphor)
- 4-realm structure (Main / Husk / Dark / Primordials)
- Tier system (0-10, with realm-specific ceilings)
- Corruption rating (0-5, Dark only)
- Map data model (Layer / Zone / Node, zones = biomes)
- Node graph navigation (no grid, organic edges)
- Step-based strategic movement (Qud style)
- 2-lane battle structure
- Capacity system (already built)
- Universal worker + specialist workers
- 3 v1 pheromones (Rally, Charge, Retreat)
- 9 damage types + 7 resistance tiers
- 4 castes
- 4 battle modes (mode emerges from map state)
- Faction reputation system (Vengeful → Cooperative)
- Iceberg endings structure
- 24 + 22 + 7 + 5 = 58 geneline count
- Phoenician = dark mirror of first 22 Greek (1:1)
- ψ and ω = Greek-only (no dark counterparts)
- Coptic primordials = T10 only
- Husk = post-ω unlock; Dark Core unlocks Primordials path

### OPEN (still being decided)

- Specific theme for each of the 24 Greek genelines (sketches exist; not all locked)
- Phoenician geneline specifics (1:1 derivation logic established but content undefined)
- Archaic geneline specifics (sketches exist; not playtested)
- Coptic primordial mechanical balance (theses defined; numerical balance open)
- Husk map data (not yet built — `husk_map.json` pending)
- Geneline economy variations (per-faction cap values not finalized)
- Mutation pheromone scope (deferred to Phase 7+)
- Dark Realm corruption mechanics (rule-break specifics per corruption tier not numerically defined)
- AI Hive v2 (deferred until combat rewrite + battle mechanics v1 lock)
- Specific quest content (system architecture defined; content authoring pending)
- Cross-run reputation persistence rules (concept agreed; specifics open)

---

## 13. Reference — the map files

**Main:** `lore/main_map.svg` (39 nodes, T0-6, Greek genelines)
**Dark:** `lore/dark_map.svg` (39 nodes, T3-9, Phoenician shadows)
**Primordials:** `lore/primordials_map.svg` (5 transcendent encounters, T10)
**Husk:** *not yet built*

All maps are **generated** from JSON data in `lore/data/` via `node lore/tools/generate.mjs`. Hand-edits to the SVGs will be overwritten. Edit JSON, regenerate.

See `lore/README.md` for the map system workflow.

---

## 14. Tone, voice, naming guidelines

### Naming convention for vyssids

Names should feel like insect species — not job titles. Blend geneline theme with bug identity.

**Styles (all single-word names):**
- **Simple compound:** Shellguard, Ironmaw, Stonegrub, Lancewing
- **Fusion:** Primite (Primal+Mite), Hiveperator (Hive+Imperator), Formant (Formation+Ant)
- **Standalone:** Mandible, Crawlid, Gruzzer

**Guidelines:**
- Name evokes geneline theme at a glance
- Geneline prefix vocabulary makes faction obvious (Iron- = Armored, Fang- = Feral)
- Universal units stay unprefixed (Grunt, Needler, Hardshell)
- Single word for soldiers/workers; two words allowed for elites/royals
- Short, punchy, 2-3 syllables preferred
- Avoid pure military ranks or fantasy terms with no bug feel
- Reference: Hollow Knight (Vengefly, Crawlid, Husk Guard), Rimworld insects

### Hivyss-native vocabulary preferences

When naming new things, ask: **does this sound like it belongs inside a living body?**

- "Capillary" > "tunnel" (in Veins layer)
- "Chamber" > "room" (anywhere)
- "Pulse" > "beat" (anywhere)
- "Ichor" > "honey" (if renaming nectar — nectar is already locked)
- "Spire" > "tower" (locked term)
- "Husk" > "shell" or "moon" (locked term)

### What we do NOT do

- **No fantasy-trope leakage.** No angels, demons, fairies, dragons. Hivyss is insect biology, not Abrahamic cosmology.
- **No element-as-faction-identity.** No "Fire Geneline." Elements are *consequences* of identity, not the identity.
- **No grimdark.** Hivyss is weird and biological, not bleak.
- **No anthropocentric framing.** Vyssids are not humans in bug suits.

---

## 15. Inspirations (and what to take from each)

| Game | Key idea for Hivyss |
|---|---|
| **Caves of Qud** | Living world, faction matrix, world-runs-without-you, drip-feed lore |
| **Hollow Knight** | Bug-as-civilization, area-as-character, hidden depth |
| **Slay the Spire** | Roguelike structure, deck building, post-battle rewards |
| **SC2 Co-op** | Decision-loop differentiation per faction, single-thesis identity |
| **Clash Royale** | 2-lane validated, mind-game-driven combat |
| **Noita** | Iceberg design — hidden depth layers, "wait there's more" |
| **Made in Abyss** | Deeper = more dangerous, environmental tension |
| **Total War** | Strategic layer + tactical battle separation |
| **Rimworld** | Travel events, biome-themed encounters |
| **Path of Exile** | Damage types, resistance, penetration, ailment system |
| **Battle Cats / Swords & Soldiers** | Lane autobattler core loop |
| **Stick War** | Royal/hero direct control |

---

## 16. Open questions for future sessions

1. **Geneline content authoring** — flesh out remaining Greek genelines (κ-π, σ-ψ); design Phoenician dark mirrors; design Archaic Husk genelines; numerically balance Coptic primordials.
2. **Battle mechanics v1 spec** — write `BATTLE_MECHANICS_V1.md` locking specific worker behaviors, pheromone parameters, spire types, lane geometry.
3. **Husk map data** — author `lore/data/husk_map.json` and generate `lore/husk_map.svg`.
4. **Faction matrix authoring** — define inter-geneline relationships at game start (who hates whom, who allies).
5. **Quest authoring framework** — define how quests are procgen-assembled (templates + parameters) vs hand-authored.
6. **AI Hive v2 architecture** — resume after combat rewrite + battle mechanics lock. Strategic layer adds requirements (faction map AI, not just battle AI).
7. **Coptic primordial unlock conditions** — not just "post-Dark-Core." What exactly makes a Primordial appear? Specific shrines? Reputation thresholds? Ritual requirements?
8. **Run length tuning** — target 60-120 minutes per run? How many nodes is the ideal main-Hivyss path?

---

*Document version: 1.0*
*Captured from design conversations through 2026-04-17.*
*Update as design decisions evolve. Mark superseded sections rather than deleting (lore archaeology).*
