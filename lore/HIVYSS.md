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
- `app/docs/active/MECHANICS_ROADMAP.md` — current build status and active program tracking
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

See `app/docs/active/MECHANICS_ROADMAP.md` for the live program tracking.

## 0.4 Glossary (quick reference)

| Term | Meaning |
|---|---|
| **Vyss** | Life essence / genetic potential. Vital force of insect life on Hivyss. Also the name of Tier 0. |
| **Vyssid** | A being with vyss — any unit/creature in the game. |
| **Hivyss** | "Hive of vyss." The planet — origin of all vyss. |
| **Geneline** | A lineage of vyss expression. Genetic faction (24 Greek + 22 Phoenician + 7 Coptic-Husk + 7 Archaic-Primordial = 60 total). |
| **The Core** | Superintelligence at Hivyss's center — the dormant remnant of pre-shatter consciousness. |
| **The Shattering** | The pre-historical event that broke the 7 Archaic primordials into all current genelines. |
| **The Husk** | Hivyss's moon — preserved past, holds 7 Coptic-preserved genelines (monastic, ritualistic, silent forms). |
| **The Dark Realm** | Shadow mirror of Hivyss — twisted reflection, holds 22 Phoenician genelines. |
| **The Primordials** | The 7 Archaic-named ancestors at T10 — pre-shatter wholeness. Each primordial is a concrete biological ur-aspect: Motion, Number, Voice, Gradience, Breath, Territory, Wonder. |
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
| **Caste** | Unit class — Worker / Soldier / Elite / Royal. Determines control paradigm (auto / player-triggered / direct-hero). Orthogonal to Tier. |
| **Gene** | A specific unit form-pattern within a geneline (Mandible gene, Centurion gene). Acquiring a gene adds that form to your Royal's gene library, enabling infinite production via chamber tuning. |
| **Gene library** | Your Royal's collection of accessible genes across all genelines. Grows across a run through conquest and other acquisition paths. |
| **Gene-imprint** | The pheromone-memory extracted from a fallen queen after conquest. Carries one or more genes she knew. Time-limited extraction (memory dissipates). |
| **Chamber tuning** | Attuning a Larva Chamber to express a specific gene from your Royal's library. A tuned chamber produces that form until re-tuned. |
| **Vyss-egg** | An unformed egg laid by your Royal — pure vyss-potential with no form yet. Becomes whatever form its chamber is tuned to. |
| **Egg** | An unhatched specific individual (from another hive's nursery). One-time hatch into that exact unit. |
| **Specimen** | A preserved grown vyssid — equivalent to an egg but for a named/mature individual. Usually acquired via conquest or rare discovery. |
| **Roster** | The genes your Royal has access to. Expands via acquisition paths across a run. |
| **Royal (Queen)** | One per hive. Unified queen/avatar/hero. Player-controlled in battle (WASD/click), applies geneline style when docked at hive, hive dormant when she travels. |
| **Hive style** | The 5-facet package a Royal applies to her hive: visual architecture, passive aura, unit production, pheromone signature, reputation effect on neighbors. |
| **Generic outpost** | A captured node with no Royal assigned. Defended but styleless — no production, no aura, no identity. Becomes a sub-hive once a Royal is placed. |

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

### The Royal as microcosm of the Core

Your Royal (the queen you play) is a **miniature Core**. The Core is trying to remember every form vyss has ever been — to gather all scattered genes back into wholeness. Your Royal does this at the personal scale: every conquest, every extracted gene-imprint, every form added to her library is *her* participating in the same process. The roguelike loop — gathering genes, remembering forms, assembling lineages — is the cosmology's central metaphor made playable. **You are the Core in miniature, rehearsing what wholeness could feel like.** This is why reaching the Primordials matters: you meet the complete version of what you've been *trying* to become.

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
| **Archaic Greek** | 7 (ϝ ϟ ϡ Ϻ Ͱ ϛ ϙ) | Pre-shatter wholeness — the 7 unnameable primordials | Outside cosmology (transcendent) | Post-Dark-Core + post-Husk |
| **Coptic** | 7 (Ϸ ϯ ϥ ϫ ϭ Ϩ Ϧ) | Preserved past — monastic forms of vyss preserved on the moon | The Husk (moon) | Post-ω (main Core) |
| **Greek** | 24 (α–ω) | Current expression — vyss trying to remember itself | Main Hivyss (planet body) | From start |
| **Phoenician** | 22 (ℵ–ת) | Dark evolution — corrupted versions of Greek (1:1 with first 22) | Dark Realm (shadow mirror) | Anomaly bleeds during main run; full access post-Core |

**The 7 Archaic primordials** existed before time. Each embodied a concrete biological ur-act. They shattered. From their shards came the 22 Phoenician forms (ancestral lineages, dark-coded), which could not stay whole and so split further. Some became refined as the **24 Greek genelines** (current main Hivyss), some preserved themselves on the moon as **7 Coptic-preserved forms** (the Husk, each paired 1:1 with a primordial), and some evolved divergently into the **dark Phoenician counterparts** (which now haunt Greek as their corrupted twins).

Two Greek letters — **ψ Psi and ω Omega** — have **no Phoenician counterpart**. They are *novel post-primordial creations*, never anchored to an ancestor. Omega is the Core's answer. Psi is unstable precisely because it has no past to remember. These two also stand **outside the 7 factions** — ψ unstable by its faction-lessness, ω the attempted reunification of all 7.

### The seven primordials (Archaic)

| Letter | Name | Aspect | Defining sentence |
|---|---|---|---|
| **ϝ** | **Digamma** | **Motion** | *"I moved before there were paths."* |
| **ϟ** | **Koppa** | **Number** | *"I counted before anything had names."* |
| **ϡ** | **Sampi** | **Voice** | *"I sounded before there was speech."* |
| **Ϻ** | **San** | **Gradience** | *"I changed before evolution had a name."* |
| **Ͱ** | **Heta** | **Breath** | *"I breathed before I had a body."* |
| **ϛ** | **Stigma** | **Territory** | *"I claimed before I settled."* |
| **ϙ** | **Qoppa** | **Wonder** | *"I sought before I had a goal."* |

These seven are the **ur-acts of biological existence**: to move, to count, to sound, to change, to live, to claim, to seek. Every Greek geneline is a refinement of one or more of these. **Omega (ω) is the attempted reunification of all 7** — which is why it is the Core's answer, and why it has no Phoenician counterpart or faction.

> *Note on terminology:* **"Archaic" is both (a) the name of the pre-shatter primordial alphabet (this section) and (b) the descriptor for their T10 realm encounters.* The Husk is *not* Archaic anymore — the Husk is Coptic-preserved. Do not confuse: Archaic = primordial (T10, transcendent); Coptic = Husk-preserved (T5-7, moon). This is the reverse of the v1.0-v1.3 cosmology.

### The seven preserved variants (Coptic Husk)

Each Coptic letter pairs with one Archaic primordial as its preserved moon-variant:

| Coptic | Paired primordial | Preserved theme |
|---|---|---|
| **Ϸ Sho** | Motion (ϝ) | **Frozen motion** — caravans held in crystal stasis |
| **ϡ paired with ϯ Ti** | Voice (ϡ) | **Silenced voice** — ritualists who preserved sound through silence |
| **ϥ Fai** | Wonder (ϙ) | **Patient seekers** — ones who wait forever rather than chase |
| **ϫ Janja** | Breath (Ͱ) | **Held breath** — life-force in stasis-chambers |
| **ϭ Cima** | Gradience (Ϻ) | **Arrested change** — preserved mid-molt, never completing |
| **Ϩ Hori** | Territory (ϛ) | **Marked ground** — territorial claims as relic-circles |
| **Ϧ Khai** | Number (ϟ) | **Enumerated dead** — count-keepers, tallying forever |

Coptic's real-world role (preserving Egyptian tradition into Christian monasticism) maps perfectly onto the Husk's cosmological role — preserved ancient forms carried into current epoch through ritual stasis.

> *Glossary moved to §0.4 (top of document) for quick reference.*

---

## 3. Expression Tier — 0 to 10

**Expression tier measures biological sophistication — how completely vyss has refined itself toward wholeness.** Higher tier generally means stronger — a T7 Archaic wins against a T3 Greek roughly 9 times out of 10. The "generally" matters: specialized builds, terrain, and mutation stacks can let lower tier punch above, and that 1-in-10 upset is the design space. But the baseline expectation is the baseline — don't build against it. The ladder isn't merely "weak → strong." It's **fragmented → whole**, and raw power is a consequence of that completeness, not the primary reading.

Each tier bundles three correlated facets:

- **Biology** — how refined/specialized the organism is
- **Mechanical complexity** — how elaborate the abilities and systems are (the game's analog to "tech tier")
- **Civilization style** — from solitary instinct at T0 to pre/post-civilizational unity at T10

The scale uses **SI prefixes** (kilo → mega → giga → ... → quetta), with **Vyss as the unprefixed baseline**.

### The full tier table

| Tier | Prefix | Name | Mechanical complexity | Civilization style | Reached by |
|---|---|---|---|---|---|
| 0 | (none) | **Vyss** | Single simple mechanic | Instinctive, solitary | basic starter units |
| 1 | kilo- | Kilovyss | One specialized ability | Functional caste role | early units |
| 2 | mega- | Megavyss | Compound mechanic (2 systems) | Task-specialized | mid-early units |
| 3 | giga- | Gigavyss | Conditional / stateful | Caste-organized hive | mid-tier units |
| 4 | tera- | Teravyss | System-level (affects allies) | Coordinated | elite units |
| 5 | peta- | Petavyss | Hive-wide infrastructure | Sophisticated culture | very rare units |
| **6** | **exa-** | **Exavyss** | **Apex geneline thesis** | **Refined culture, apex** | **Greek peak — ω (the Core's answer)** |
| 7 | zetta- | Zettavyss | Pre-refinement ritual OR corrupted | Ancient / decadent | Husk peak (Coptic-preserved) / Dark mid |
| 8 | yotta- | Yottavyss | Rule-warping | Twisted civilization | Dark deep |
| **9** | **ronna-** | **Ronnavyss** | **Boss-unique reality-shatter** | **Corruption peak** | **Phoenician peak — ת Taw (Dark Core)** |
| **10** | **quetta-** | **Quettavyss** | **Ontology-as-mechanic** | **Pre/post-civilizational unity** | **Archaic primordials only (7 of them) — pre-shatter wholeness** |

### What each tier means narratively

- **T0-2:** Nascent vyss — simple forms, instinct or basic caste roles, one-trick abilities
- **T3-5:** Expressed vyss — refined organisms with stateful behavior, caste coordination, hive-wide effects
- **T6:** Peak natural Greek — apex refinement of a fragment, the limit of "remembering" (ω)
- **T7:** Husk peak (Archaic preserved primal) OR Dark mid-deep (corrupted refinement)
- **T8:** Dark deep — rule-warping biology, sophisticated cruelty
- **T9:** Peak Phoenician — the limit of "denial" (Dark Core, ת Taw)
- **T10:** Pre-shatter wholeness — the 5 primordials only. Cannot be reached by fragments or evolved corruption.

### Civilization lore per tier

Each tier corresponds to a recognizable stage of biological civilization. Human-civilizational analogs are given for orientation, but Hivyss bug-civilization is its own thing — don't port human culture onto vyss.

**T0 Vyss — *Pre-social*** *(human analog: pre-hominid instinct)*

Solitary or loose-cluster. No kin recognition beyond pheromone-match. No structures — inhabit natural hollows in the planet's body. No tools. Reproduction by broadcast spawning. A T0 vyssid does not *know* it is part of a hive; it simply acts on instinct and finds others doing the same. The "civilization" is whatever accidental clustering instinct produces.

**T1 Kilovyss — *Functional primitive*** *(human analog: early hunter-gatherer / paleolithic)*

Small family clusters. Basic caste recognition begins — a T1 bug knows which of its kin are workers and which are soldiers, though the distinction is scent-level, not symbolic. Simple single-chamber nests of chewed plant matter and packed earth. Pheromone vocabulary covers survival basics: food, danger, come, go. No ceremony, no ritual, no architecture beyond function.

**T2 Megavyss — *Tool-using craft society*** *(human analog: neolithic / early agricultural)*

Colonies of dozens to hundreds. Task specialization visible: foragers, nursery-tenders, guards. Multi-chamber nests with dedicated functions (food storage, larva chambers, sentry posts). Basic "farming" practices — tending fungus, herding aphid-analogs. Pheromone vocabulary extends to task-direction ("go here," "defend this"). This is where vyss begins making *things* instead of just doing things.

**T3 Gigavyss — *Organized hive-state*** *(human analog: bronze age city-state / organized tribal kingdom)*

Colonies of thousands. Full 4-caste system present and functioning. Planned architecture: ring-chambers, pheromone conduits, storage caverns, nurseries, royal chambers. Territorial claims enforced by patrol doctrine. Pheromone vocabulary includes tactics: flank, charge, hold, retreat, regroup. A T3 hive has *strategy* — an abstract concept, not just instinct. This is the floor of what players will recognize as "a civilization."

**T4 Teravyss — *Cultured society*** *(human analog: classical / medieval civilization)*

Major colonies with distinct districts (ceremonial, industrial, royal, frontier). Ranks emerge *within* castes — common soldier, officer, commander, strategist. Ceremonial behaviors: territorial-marking as art, rank-pheromone as regalia, named individuals of rank. Military doctrine is written in the hive's architecture itself (choke-points, decoy tunnels, kill-funnels). A T4 vyssid has a *title*, not just a role.

**T5 Petavyss — *Networked civilization*** *(human analog: early modern / industrial / networked trade)*

Vast hives span biomes, connected by pheromone networks that function as scent-highways. Infrastructure is conscious: supply chains, sub-caste specialization (siege-engineers, chamber-architects, scout-coordinators, relay-keepers), administrative coordination across distant colonies. Ornate functional architecture — chambers designed for *specific rituals or processes*. This is where civilization becomes *a system* rather than a settlement. Killing a T5 unit can cripple infrastructure across an entire lane.

**T6 Exavyss — *Refined golden age*** *(human analog: renaissance / cultural peak of a civilization)*

Apex of what a fragmented vyss can be. Ritual, philosophy, and aesthetic integrated. Every ornament load-bearing — art and function are one. Named individuals with titles, lineages, and personal philosophies. Mastery of the geneline's thesis expressed across every layer of the hive's life. ω genelines are this universally. α's Supreme Commander is *the* general, not *a* general. This is the fullest expression of fragmentation before it begins to unravel.

**T7 Zettavyss — *Ancient (Archaic) or Decadent (Dark mid-deep)*** *(human analog: mystery religion / cult civilization / late-stage decadence)*

Two flavors:

- **Archaic:** Pre-refinement civilization preserved intact on the Husk. Ritual-heavy, silent, ancient. Uses *older* pheromone-equivalents than current genelines — signals pre-dating the Greek vocabulary. Bone-white chambers carved from single materials, ceremony without text, music without sound. These civilizations are not "primitive" — they are *older*. They know things current vyss has forgotten.
- **Dark:** Sophisticated corruption. Ritual cruelty institutionalized, betrayal as sacrament, beautiful-but-wrong architecture. Aesthetics of decay — baroque-horror civilization where every elegance conceals a wound.

**T8 Yottavyss — *Nightmare logic*** *(human analog: dream-civilization / surrealist nightmare)*

Society where physical and social rules are negotiable. Hierarchies invert mid-ceremony. Time and space treated as malleable (a chamber enters on Tuesday and exits on first-light; the royal's throne faces four directions simultaneously). Architecture that shouldn't hold together but does. These are civilizations as *bad dreams* — sophisticated, intentional, and structured around principles that violate physical law. The Dark Realm's mid-layer is full of these.

**T9 Ronnavyss — *Apotheosis of wrong*** *(human analog: existential / cosmic horror civilization)*

Civilization as ritual-scale violence. Every interaction is a sacrament performed through harm. Taw's court is an entire society dedicated to the *act* of corruption — not just corrupted, but *corrupting*. Geometry weaponized. Beauty inseparable from cruelty. The whole Dark Core biome is one vast T9 society, and Taw is its apotheosis. To walk through Dark Core is to witness civilization that exists only to unmake.

**T10 Quettavyss — *Singular as civilization*** *(no human analog)*

Primordials are not "civilized." They are *what their descendants fragmented into becoming*. A Primordial IS the entire civilization that would have been, compressed into one undivided being. No cities, no rituals, no hierarchies — all of that was the *consequence* of shattering, and Primordials didn't shatter. They are alone because there is no "other" for them to need. Each Primordial is one being and one civilization and one cosmology, identical.

### What this means for biome design

Biomes inherit civilization flavor from the tier range they support. Design implication:

- **T0-2 biomes** (Skin, some early Veins): raw organic caves, simple nests, scattered activity. Players see mostly *nature* with occasional evidence of life.
- **T3-5 biomes** (Veins, Organs): visible civilization — chambers, tunnels, tended zones, scent-roads. The biome itself has been *shaped*.
- **T6 biomes** (Organs-deep, Nerve): architectural wonders, ceremonial districts, ritual centers. You feel you're walking through a capital, not a wilderness.
- **T7 Archaic (Husk)**: bone-white preservation, silent ceremony, ancient sophistication.
- **T7-9 Dark biomes**: beautiful corruption, dream-logic architecture, geometry that hurts.
- **T10 encounter zones**: abstract void — no biome at all because Primordials predate the concept of biome.

The descent through Hivyss is also a **descent through civilizational intensity**. You start fighting instinct. You end fighting philosophy made flesh.

### The mechanical complexity contract

Tier is also a **code budget discipline**. Higher tier = more elaborate mechanic, not just bigger numbers.

- **T0:** attack
- **T1:** attack with a twist
- **T2:** attack + consequence
- **T3:** attack that reads context
- **T4:** ability that helps allies
- **T5:** ability that shapes the whole battle
- **T6:** ability that IS the geneline's philosophy
- **T7:** ability that predates or corrupts normal rules
- **T8:** ability that warps game state
- **T9:** ability that redefines what a battle IS
- **T10:** the creature and the ability are the same thing

See `app/docs/reference/TIER_CONTRACT.md` for the full authoring contract (ability examples per tier, visual signature rules, code complexity budget).

### Realm tier ranges

| Realm | Tier range | Why |
|---|---|---|
| **Main (Greek)** | T0-6 | Full descent journey, peaks at ω (Exavyss) |
| **The Husk (Coptic-preserved)** | T5-7 | Late-game side area; preserved monastic forms are powerful, never weak |
| **Dark Realm (Phoenician)** | T3-9 | Wide — anomaly bleeds appear from mid-Main onward |
| **The Primordials (Archaic)** | T10 only | Singular peak; 7 transcendent heptagonal encounters |

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

> **Tier 10 is reserved exclusively for the 7 Archaic primordials.** No Greek, Phoenician, or Coptic-Husk geneline ever reaches Quettavyss. Quettavyss is what the unbroken 7 *are*; everything else is a fragment trying to climb back.

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

### Realm 2 — The Husk (the moon, Coptic-preserved)

Hivyss's moon. **Preserved monastic past.** Holds 7 Coptic genelines — forms that preserved themselves through ritual stasis, each paired 1:1 with one of the 7 Archaic primordials (see §2).

- **Tier range:** T5-7 (every encounter is endgame-tier; no weak content)
- **Unlocked:** Post-ω (after main Core defeated)
- **Aesthetic:** Bone-white, chalk-grey, ancient, dormant, ritual-still
- **Structure:** Heptagonal circular zone with 7 crater-biomes (one per preserved geneline, no anatomical layers)
- **Special rules:** Low gravity, vacuum (no air route), preserved silence, no nectar regeneration
- **Lore:** Coptic-Husk forms are *preserved monastic variants* of Archaic primordials. They did not shatter — they willingly entered ritual stasis, holding a single primordial aspect indefinitely. Meeting them on the Husk is visiting the *only beings who refused to become anything else.*

**Proposed Coptic-Husk genelines (sketch — not locked):**

| Letter | Sound | Paired primordial | Preserved theme |
|---|---|---|---|
| **Ϸ Sho** | "sh" | Motion (ϝ) | **The Frozen Caravan** — preserved travelers, held mid-journey in crystal stasis; revive briefly when disturbed |
| **ϯ Ti** | "ti" | Voice (ϡ) | **The Silenced** — ritualists who preserved sound through unbroken silence; unleash a single devastating sound on death |
| **ϥ Fai** | "f" | Wonder (ϙ) | **The Patient** — preserved seekers who wait eternally rather than chase; bonuses when not moving for long periods |
| **ϫ Janja** | "dj" | Breath (Ͱ) | **The Held Breath** — life-force in stasis-chambers; fragile but self-resurrect on breath-cycle |
| **ϭ Cima** | "ch" | Gradience (Ϻ) | **The Arrested** — preserved mid-molt; slowly complete their transformation during a fight, gaining power over time |
| **Ϩ Hori** | "h" | Territory (ϛ) | **The Marked** — territorial claims as relic-circles; deal increasing damage while standing on owned tiles |
| **Ϧ Khai** | "kh" | Number (ϟ) | **The Counted** — enumerated dead; every enemy they kill adds to their permanent count, buffing future encounters |

Because each Coptic-Husk geneline is paired with a primordial, **clearing the Husk doubles as preparation for the Primordial encounter.** You meet the preserved-variant before the pre-shatter original — the Reckoning *is* meeting your faction's Husk-ancestor before facing the Primordial itself.

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
| α Alpha (red primal herd) | ℵ Aleph (blood-black ritual) | Blood-cohesion — the pack feeds on spilled blood and cannot be called off |
| β Beta (green swarm) | ב Beth (rot-black swarm) | Units don't die — liquefy and re-spawn |
| γ Gamma (stone fortress) | ג Gimel (obsidian fortress) | Armor self-repairs by cannibalism |
| ε Epsilon (signalers) | ה He (signal-jammers) | Pheromone-hijack your own units |

### Realm 4 — The Primordials (Archaic, transcendent)

**Seven encounters** with the unshattered originals. They exist outside cosmology — no layer, no zone, no edges.

- **Tier:** T10 (Quettavyss) — the only T10 in the game
- **Unlocked:** Post-Dark-Core + post-Reckoning (after ת Taw defeated AND Husk cleared; see §10)
- **Structure:** **Heptagonal arrangement of 7 transcendent encounters** in cosmic void
- **Each Primordial has a unique mechanical thesis** tied to their ur-aspect (see §7 — Archaic Primordials)
- **Lore:** Pre-shatter wholeness. Each Primordial is a concrete biological ur-act (Motion, Number, Voice, Gradience, Breath, Territory, Wonder). To face one is to face the original of what your faction was before the shatter. No Greek, Phoenician, or Coptic-Husk will ever reach Quettavyss naturally.

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

### The 10-axes framework

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
| **Archaic ancestry** | Which of the 7 primordials does this geneline descend from? (Digamma/Motion, Koppa/Number, Sampi/Voice, San/Gradience, Heta/Breath, Stigma/Territory, Qoppa/Wonder) Determines faction membership — see §7. |
| **Elite tactical doctrine** | How do this geneline's Elites coordinate and behave? (Rank formation / wave leadership / corpse farming / wall architecture / death management / etc.) Gives the geneline a recognizable on-field tactical signature beyond its mechanical hook. See §8. |

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

- See a Centurion → "Delta. Disciplined military — commander, buffs nearby allies." ✅
- See a hypothetical Beta unit → should read "swarm. Fragile. Cheap. Dies to do damage."

### Phoenician root grounding (for Greek genelines)

Each Greek letter has a **Phoenician primal ancestor** with a real-world meaning. Greek themes should descend intelligibly from these roots:

| Greek | Phoenician root | Primal meaning | Greek theme |
|---|---|---|---|
| α | Aleph | ox | herd, primal strength → aggressive rush (offense) |
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
| **Classic** | 0-1 | α Primal, γ Fortress | ~10 |
| **Distinct** | 2 | β Swarm, θ Feeders, ζ Symbionts | ~10 |
| **Alien** | 3-4 | ν Beacons (no combat units), ω Whole | ~4 |

You can't have 24 wildly-unique genelines — players need a baseline. Most genelines are subtle; a few are radical.

---

## 7. Geneline Roster

**Total: ~58 genelines** (24 Greek + 22 Phoenician + 7 Archaic + 5 Coptic)

### Currently shipped (2026-04-17)

| Geneline | Status | Units | Notes |
|---|---|---|---|
| **Normal** | Shipped, 11 units | Grub, Hardshell, Pricker, Skitterling, Mendwing, Domeback, Cinderfly, Longeye, Wardling, Bashguard, Stormfly | Pre-cosmology baseline. Was built before the cosmology framework was locked. To be reframed as a "starter" / unaligned geneline OR absorbed into Greek. |
| **α Alpha** | Shipped 7 (re-homing → δ) | Grunt, Mandible, Needler, Bombardier, Ravager, Legionnaire, Centurion | Legacy **military** roster — **re-homed to δ Delta** (Disciplined Military). α itself re-themed **Primal** (OFFENSE/herd; new roster Chitling…Goliath built separately). See `app/docs/active/MVP_GENELINES.md`. |

**18 units total in code.** 56 more to author across the cosmology (2 + 22 Greek remaining + 22 Phoenician + 7 Archaic + 5 Coptic).

### Greek (24) — main map, current vyss expression

**Note:** *Layer* is where the geneline's home biomes live. All Greek genelines exist entirely in Main Hivyss (none are "Dark Realm bleed" — that was old doc framing; Dark Realm is strictly Phoenician 1:1 with Greek).

| Letter | Theme (proposed) | Layer | Mechanical hook |
|---|---|---|---|
| α Alpha | **Primal** (aggressive herd — the **OFFENSE/rush**; medium pack) | Skin | Pack cohesion = charge-synergy (commit as one), presence buffs |
| β Beta | Swarm (the **NUMBERS**) | Skin | Many cheap expendable units, death effects |
| γ Gamma | Fortress (the **DEFENSE**) | Skin | Armor / armor-degradation, walls |
| δ Delta | **Disciplined Military** (rank, vanguard — **CONTROL/range**) | Veins | Rank coordination, formation scaling, ranged/artillery |
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
| σ Sigma | Scavengers (corpse) | Veins/Organs | Spawn from dead |
| τ Tau | Revenants (3 lives) | Organs/Nerve | Rise on death |
| υ Upsilon | Hollowers (parasites) | Nerve | Convert enemies |
| φ Phi | Hosts (death payload) | Nerve/Core approach | Burst on death |
| χ Chi | Unmakers (void erase) | Core approach | Bypass death hooks |
| ψ Psi | Forgotten (rule-breaker) | Endgame | Breaks targeting/resistance |
| ω Omega | Whole (the Core's answer) | Core | Contains all 7 primordial aspects |

### Phoenician (22) — Dark Realm shadows of Greek

1:1 dark counterparts of α through χ (first 22 Greek). Each is the **evolved corruption** of its Greek twin. All Phoenician genelines live in the Dark Realm (not Main Hivyss).

- ψ and ω have **no Phoenician counterpart** — Greek-only innovations.
- **Dark Core houses ת Taw** (the final Phoenician letter) as the true-ending boss.

### Coptic (7) — The Husk, preserved past

7 Coptic genelines preserved on the moon as monastic stasis-forms. Each pairs 1:1 with one of the 7 Archaic Primordials (see §4 for themes).

### Archaic (7) — The Primordials, transcendent

The 7 unnameable ur-acts of biological existence. T10 only. Each has an Alien-tier deviation from default play:

| Letter | Primordial name | Aspect | Mechanical thesis |
|---|---|---|---|
| **ϝ Digamma** | The Mover | **Motion** | Cannot be held still — teleports if slowed; every tile traveled adds permanent stats. |
| **ϟ Koppa** | The Counter | **Number** | One body per enemy count. Spawns one ephemeral self per enemy on field; all share HP pool. |
| **ϡ Sampi** | The Voice | **Voice** | Cannot be silenced — every attack is a sound-wave that affects units in a line; converts enemies to neutral temporarily. |
| **Ϻ San** | The Gradual | **Gradience** | Never burst — deals 1 damage per hit, but damage stacks and escalates forever while bout lasts. Outlast-or-die. |
| **Ͱ Heta** | The Breath | **Breath** | Cannot die while breathing — fully regenerates between attacks; player must interrupt breath cycles with timed damage. |
| **ϛ Stigma** | The Claim | **Territory** | Claims the entire arena on spawn; standing on claimed ground deals DOT; only "unclaim" via ritual actions. |
| **ϙ Qoppa** | The Seeker | **Wonder** | Remembers every ability used against it — after first use, becomes immune and copies that ability for itself. Variety is the player's weapon. |

These are intentionally unfair. Reaching one is the reward; defeating one is the climax.

### Faction groupings — 7 Primordial factions

> **Status:** Sketch — not locked. Specific assignments below are draft; will settle as geneline content fleshes out.

Reputation is tracked per **faction**, not per individual geneline. The 7 factions correspond to the 7 Archaic primordials — each faction contains all genelines (Greek + Phoenician + Coptic-Husk) that descend from that primordial's aspect. This keeps the diplomatic matrix tractable (7×7 = 49 inter-faction relationships instead of 60×60 = 3,600 per-geneline).

Each faction has **three expressions** across the realms: preserved past (Coptic-Husk), refined present (Greek), corrupted parallel (Phoenician). Meeting the Archaic primordial is meeting your faction's origin — the ur-act all three expressions descend from.

| Faction | Primordial (Archaic) | Aspect | Greek members (sketch) | Coptic (Husk) | Phoenician shadows |
|---|---|---|---|---|---|
| **Moving** | ϝ Digamma | Motion | μ Migrants, λ Mirrors, χ Unmakers | Ϸ Sho (Frozen Caravan) | 3 shadows of above |
| **Numbered** | ϟ Koppa | Number | β Swarm, τ Revenants, π Dominators | Ϧ Khai (Counted) | 3 shadows of above |
| **Voiced** | ϡ Sampi | Voice | ε Signalers, ν Beacons, σ Scavengers | ϯ Ti (Silenced) | 3 shadows of above |
| **Gradient** | Ϻ San | Gradience | γ Fortress, ι Molters, ζ Symbionts | ϭ Cima (Arrested) | 3 shadows of above |
| **Breathing** | Ͱ Heta | Breath | ξ Regenerators, η Resonant, φ Hosts | ϫ Janja (Held Breath) | 3 shadows of above |
| **Territorial** | ϛ Stigma | Territory | α Primal, ο Territorials, κ Weavers | Ϩ Hori (Marked) | 3 shadows of above |
| **Seeking** | ϙ Qoppa | Wonder | δ Military, θ Feeders, υ Hollowers, ρ Pure | ϥ Fai (Patient) | 4 shadows of above |

**Faction outliers:**

- **ψ Psi** and **ω Omega** have no Archaic ancestor (they are post-primordial novel creations). They stand outside the faction system. Psi is faction-less by instability; Omega is the *attempted reunification of all 7 factions* into one expression.

**Why this structure matters:**

- **Meeting a Primordial is a recognition scene**, not a random boss. Defeating ϝ Digamma when you've spent a run aligned with the Moving faction hits differently than meeting an unrelated god.
- **Each faction has a temporal arc**: Primordial (pre-shatter) → Coptic-Husk (preserved post-shatter, frozen in stasis) → Greek (what actively evolved) → Phoenician (what went corrupted). The faction itself is a story about what happened to that ur-aspect across time.
- **The Husk becomes a faction homecoming.** When you reach the moon post-ω, you meet your preserved ancestor — which one depends on your faction alignment. Then the Primordial itself at T10.

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

### Castes (4) — control paradigm, orthogonal to Tier

**Caste and Tier are orthogonal axes.** Tier measures a unit's mechanical sophistication (single-attack → ontology-as-mechanic). Caste measures how the player *interacts* with the unit. A T3 Soldier and a T3 Elite share the same complexity budget — what differs is *who triggers the signature* and *how smart the AI behavior is*.

| Caste | Control paradigm | AI quality | Count per battle | Role |
|---|---|---|---|---|
| **Worker** | Auto, directed by player pheromone placement | Task-following | Many (5-15) | Economy, engineering, pheromone scouts, construction |
| **Soldier** | Auto, standalone — moves, targets, fires abilities without player input | Tier-appropriate (scales with tier) | Many (10-30) | Line combat, bulk of the army |
| **Elite** | Auto movement & basic combat + **player-triggered signature ability** | **Tier-appropriate + geneline tactical doctrine** (smarter than Soldier of same tier; reads lane-wide state, prioritizes high-value targets, coordinates with other Elites) | Few (1-4) | Tactical specialists with one active ability the player times |
| **Royal** | **Direct player control (WASD/click) when deployed in battle**. Stationary at home hive when docked — applies geneline style passively. | Passive aura at hive; player-driven in combat | **One per hive** | Queen / avatar / hero unified. Carries the hive's geneline style. Hero unit in battle. |

### The Royal — Queen, Avatar, and Hero unified

The Royal is one unit that operates in four distinct modes:

| Mode | Where | What happens |
|---|---|---|
| **At hive (passive)** | Docked at her home hive | Applies full geneline style — visual architecture, mechanical aura, unit production, pheromone signature, neighbor-reputation effect |
| **Traveling (mobile)** | With your caravan on the strategic map | Home hive enters **dormant mode**: garrison still defends, but style effects suspended (no production, no aura bonus, reduced nectar income) |
| **In battle (combat)** | Deployed in your current battle | **Player controls directly** — WASD movement, click-target, dodge, position. Can cast her Royal Special when charge-bar fills. |
| **Dead (respawn)** | Nowhere | Hive style fully suspended; 90-second respawn timer; she returns to her home hive |

**Royal dying in a battle is costly but not game-ending.** Home Hive being destroyed is game-ending.

**Multiple Royals across the map:** Each captured node that receives a Royal becomes a styled sub-hive. Additional Royals are acquired via T5 evolution, Cooperative-tier faction gifts, or specific post-boss rewards. Without a Royal placed, a captured node remains a **generic outpost** (defended but styleless, no production).

### Geneline style — the 5 facets

When a Royal is docked at a hive, she applies that geneline's **style package** — 5 coordinated facets that together distinguish a styled hive from a generic outpost:

| Facet | What differs per geneline (examples) |
|---|---|
| **Visual architecture** | α hives = primal beast-dens of horn, hide and bone, with trampled charging-runs; β = writhing warrens with spawning pits; γ = fortress walls of fused carapace; θ = mounds of slowly-digesting corpses; κ = hanging webworks |
| **Passive hive aura** | α: garrisons gain +discipline buff; β: spawns 1 free swarmling every 30s; γ: walls auto-repair; θ: defeated raider corpses feed garrison stats |
| **Unit production** | Hive's recruitment/production pool = that geneline's roster only. An α hive produces α units; a β hive produces β units. |
| **Pheromone signature** | Hive's ambient pheromone is geneline-specific (visible as color/particle on the strategic map) |
| **Neighbor-reputation effect** | An α-styled hive near γ territory reads as "orderly neighbor" (neutral rep drift). A θ-styled hive near γ reads as "we eat your dead" (hostile rep drift). Proximity affects faction relationships over time. |

### Elite tactical doctrine (per-geneline authoring axis)

Each geneline defines how its Elites coordinate on the battlefield. This is the 10th axis of the geneline identity framework (§6).

| Geneline | Elite tactical doctrine |
|---|---|
| α Primal | **Herd charge** — Elites anchor the pack's core (cohesion peaks at center) and time the committed Stampede when the herd is massed |
| δ Disciplined Military | **Rank formation** — Elites hold the line, coordinate ranged/artillery volleys, call command actives (Rally) in sync with the advance |
| β Swarm | **Wave leadership** — Elites trigger swarm pushes, sacrifice themselves when it creates more swarmlings |
| θ Feeders | **Corpse farming** — Elites kill weak enemies first (for corpses), save actives for dense-enemy moments |
| κ Weavers | **Wall architecture** — Elites reposition to optimal wall-raise spots, pre-place traps before engagement |
| τ Revenants | **Death management** — Elites accept deaths strategically (will rise), coordinate timing of "Call to Rise" active |
| ν Beacons | **Support broadcasting** — Elites (Relay Primes) always position at lane-center for maximum pheromone coverage |

### Player control surface (5 categories)

Your moment-to-moment actions in battle span 5 categories, each with a different rhythm:

| Category | Rhythm | Example |
|---|---|---|
| **Deploy units** | Steady cadence | Spend nectar, pick type from roster, queue into chamber |
| **Pheromone placement** | Positional, semi-permanent | Direct Worker scouts to place Rally/Charge/Retreat zones |
| **Elite signatures** | Tactical bursts (per-Elite cooldowns) | Click δ Centurion's Rally button to burst all lane allies |
| **Royal direct control** | Continuous (when Royal in battle) + ultimate moment | WASD move Royal, click-target, cast Royal Special when bar fills |
| **Hive abilities** | Global, high-impact, limited charges | Cast slotted abilities (nuke/wall/slow/repair or geneline-specific) |

This is a rich autobattler control layout, not an RTS click-fest. You don't micromanage individual Soldiers — they handle themselves. You *time* Elites, *position* pheromones, *drive* your Royal, *deploy* strategically.

### Royal Special Bar

Royal builds **charge through army's kills**. When full, unleashes a geneline-specific ultimate ability:

- α Alpha ultimate: massive army charge, all soldiers buffed
- Each geneline's Royal has a unique ultimate (specifics TBD per geneline)
- Adds **timing/skill expression** to Royal control — when do you spend the charge?
- Royal dying mid-charge: charge resets to 0

This is the single most player-skill-expressive mechanic in the battle layer. The Royal Special Bar gives dramatic player agency at the apex of the control surface.

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

Inspired by Caves of Qud's faction matrix. Reputation is tracked **per faction, not per individual geneline.** The 5 factions map to the 5 Coptic primordials — see §7 "Faction groupings" for the full structure.

**Why 7 factions, not 60 genelines:**
- 7 axes are tractable for player cognition (upper bound); 60 are not
- Inter-faction politics becomes meaningful (coalitions, bloc warfare) instead of noise
- Balance matrix is 7×7 = 49 pairs instead of 60×60 = 3,600
- 7 factions numerologically align with the 7 primordials (one-per-primordial)

**Reputation tiers (7, ranging -100 to +100):**

| Range | Tier |
|---|---|
| 75 to 100 | Cooperative |
| 40 to 74 | Friendly |
| 10 to 39 | Welcoming |
| -9 to 9 | Neutral |
| -39 to -10 | Inhospitable |
| -74 to -40 | Hostile |
| -100 to -75 | Vengeful |

**Reduction from 9 to 7:** "Favorable" collapsed into Welcoming (above neutral is just: welcoming → friendly → cooperative). "Suspicious" collapsed into Inhospitable (below neutral is just: inhospitable → hostile → vengeful). The 7 tiers mirror the 7-fold primordial structure.

**Per-geneline modifier (optional secondary layer):**

A per-geneline personal modifier (±15 cap) stacks on top of faction reputation, preserving the "I helped α specifically" feeling without exploding the matrix. A geneline's effective reputation toward the player:

```
effective_rep = faction_rep + personal_modifier (clamped ±15)
```

**Player-side effects (by faction rep):**
- Cooperative: faction's genelines join your battles, give free units, request pincer attacks
- Friendly: discounted recruitment across the faction, quests offered, hive gates open
- Welcoming: standard recruitment available
- Neutral: standard enemy AI
- Hostile/Vengeful: dedicated assassins; faction actively invades captured territories

**Inter-faction dynamics:**
- Factions war independently of you — The Shaped vs The Turning may erupt regardless
- Helping one faction tanks rep with their rivals
- Some pairs are mutually exclusive (alignment forces a choice)
- Phoenician members are universally feared by Greek-dominant faction members *even within their own faction* (civil war between refined and corrupted branches of the same bloodline)

**Phoenician placement (v1):**

For v1 shipping scope, Phoenician genelines are **universally hostile — no negotiation possible**. They sit *inside* their Coptic faction cosmologically (as the corrupted branch), but mechanically they're treated as unreasoned enemies. Upgrade to full faction-civil-war dynamics is a v2 feature.

**Persistence:** For v1, reputation resets per run. Major actions (wiping a geneline's home, completing a faction questline) will leave narrative log entries for flavor, but no mechanical carry-over. Cross-run persistence is deferred to v2.

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

### Territory & garrison system

Strategic play is **non-linear**. The path through Hivyss is not a corridor you progress down — it's a living map where you claim, garrison, lose, and reclaim territory. Combat is not just battles-in-sequence; it's *domain management*.

#### Node capture

- Only **hostile faction hives** can be captured — Phoenician shadows, and Greek/Archaic genelines at Hostile (-50) or Vengeful (-75) reputation. You cannot capture from Friendly/Cooperative allies.
- Capturing requires winning the node's hive-battle and clearing associated enemy forces in the biome.
- Captured nodes **belong to you for the run** (persist until run ends OR a hostile raid succeeds).
- Fast-travel from Home Hive to any captured node.
- Captured nodes grant passive benefits: nectar tick income, scout coverage revealing adjacent nodes, and safe-route shortcuts between distant layers.
- **Captured ≠ styled.** A captured node is a **generic outpost** by default (defended but styleless). It becomes a **styled sub-hive** only when you place one of your Royals there. Without a Royal, the node has no unit production, no passive aura, and no geneline identity — just a garrison holding ground.

#### Conquest loot — four categories

Winning a hive battle grants one or more of the following. Not every conquest gives all four — what you get depends on hive tier, your reputation with the faction, your Royal's proximity, and whether the fallen queen was killed cleanly (ambushed escapes = less loot).

| Loot type | What you get | Mechanical effect |
|---|---|---|
| **Gene-imprint** | Pheromone-memory extracted from the fallen queen's body. Carries one or more genes she knew. | Each gene is added to your Royal's gene library → you can now produce that form in any of your styled hives. **Time-limited extraction** — the imprint dissipates within 1-2 strategic ticks of the queen's death. |
| **Egg** | Unhatched specific individuals found in the hive's nurseries | One egg = one named individual when incubated (Tier B unit, death-matters) |
| **Larva** | Eggs mid-incubation when the hive fell | Finish incubation in your chamber → one named individual hatches |
| **Specimen** | Preserved grown vyssids in the hive's stasis chambers (rare — usually royal relatives, champions, captured nobles) | Wakes up as a named individual in your roster, often higher-tier than standard |

**Loot screen clarity:** each drop should explicitly state what was acquired. "Acquired: α Mandible gene (type added to library)" vs "Acquired: 1 α Mandible egg (named individual 'Ixar-7')". Different rewards, different mechanical weight.

#### Expedition force vs garrison broods

Your army splits into two pools:

- **Expedition force (caravan)** — vyssids that travel *with* you on the strategic map, deploy in your current active battle, consume the battle's capacity budget. This is your hunting party. Usually the stronger/more versatile units (T3+ elites, your Royal, specialist workers).
- **Garrison broods** — vyssids assigned to defend a specific captured node. Broods cannot leave that node unless recalled. Each captured node has its own garrison slot. Usually the solid-but-replaceable units (T0-2 workers and soldiers, bulk soldiers, durable defenders).

You decide at capture time (and at revisit) how many broods to garrison. Common patterns:

| Pattern | Trade-off |
|---|---|
| Heavy garrison (6-10 broods per node) | Secure territory, slow expansion, expedition weakened |
| Skeleton garrison (1-2 broods per node) | Rapid expansion, territory flips easily, expedition strong |
| Strategic mix (heavy on choke nodes, skeleton elsewhere) | Optimal but requires reading the map |

Garrison *composition* is flexible — **garrisons can be mixed** from any units in your army pool (ally-donated units and units from looted genes all garrison together). What determines a styled hive's identity is NOT the garrison composition but the **Royal docked there**.

- **With a Royal:** hive is styled (all 5 facets apply — architecture, aura, production, pheromone, neighbor-rep)
- **Without a Royal:** hive is a generic outpost (garrison defends, but no style)
- **Royal traveling:** hive is in dormant mode (garrison defends, style suspended until she returns)

Garrison *doctrine* becomes part of geneline identity via the Royal's passive hive aura:
- α Primal: garrison gains +cohesion (pack presence, charge-readiness)
- β Swarm: hive passively spawns 1 free swarmling every 30s — garrison auto-swells
- γ Fortress: garrison walls auto-repair, making the hive turtle-strong
- θ Feeders: defeated raider corpses feed the garrison (permanent stat gains from surviving raids)
- κ Weavers: hive itself is heavily fortified (webs, walls) — terrain does defensive work
- τ Revenants: fallen garrison broods rise mid-raid (self-repairing defense)
- ν Beacons: has no combat units of her own — garrison must be filled with *ally-donated* units of other genelines (extreme case, high-diplomacy playstyle)

#### Hostile raid events

The overworld is a living map. Enemy factions don't wait for you.

- Every N game-ticks, hostile factions roll for **raid targets** among your captured nodes.
- Raid event triggers a map notification with a time-to-impact counter.
- You can:
  - **Intercept en route** — travel to the raid and battle in transit (keeps caravan in play)
  - **Rush to defend** — fast-travel to the threatened node, fight alongside the garrison
  - **Let the garrison defend alone** — AI-resolved battle using your assigned broods
- If the garrison loses: node is lost, broods die (permadeath for those units).
- If the garrison wins: broods may be wounded (reduced HP carried over), some may die.
- If you arrive in time: full battle with garrison + expedition combined.

This creates ongoing dramatic tension. You can't just push forward endlessly — *your back is never safe.*

#### Allied faction territory & quests

As faction reputation rises, **allied factions** become active partners on the map — not just sources of quests, but players on the overworld alongside you.

- Allied factions have their own territorial nodes, which can be attacked by your shared enemies.
- Allies will **request defense help** via quests when their nodes are threatened.
- Allies may **request offensive help** — capture a hostile node that's blocking their supply lines, escort a Royal through contested territory, deliver an artifact.
- Cooperative-tier factions occasionally contribute **free units** to your garrisons or expedition.
- You may reinforce ally garrisons with your broods (temporary, recoverable).
- Conversely, allies may reinforce your garrisons during critical raids.

**Ally quest categories:**

| Quest type | Example |
|---|---|
| Defend ally territory | "The Shaped's Western Nest is under Phoenician siege — aid defense within 5 ticks" |
| Capture for ally | "The Echoing asks: capture the hostile ρ-aligned node at Pulse Junction to unblock their supply" |
| Escort ally unit | "Guide The Turning's Royal through three contested nodes to reach their distant colony" |
| Joint assault | "Join The Hungering in a two-pronged attack on a corrupted Phoenician stronghold" |
| Artifact delivery | "Carry a sealed pheromone-scroll from one allied node to another (contested route)" |

**Refusal is always valid** but consumes minor reputation (or locks out the ally quest chain if refused repeatedly).

#### Enemy faction offensive

Enemy factions pursue their own agendas, not just reaction to you:

- **Expand into neutral biomes** (reducing your quest pool, claiming territory before you can)
- **Raid your captured nodes** (as above)
- **Reinforce their own chokepoints** as you approach (Qud-style scaling pressure)
- **Besiege allied nodes** (creating ally quest hooks)
- **Occasionally invade Home Hive directly** — rare, high-stakes event that can happen in mid-to-late game. If Home Hive falls: run over.

#### Persistence across runs

- **Per-run:** Captured territory, garrison assignments, faction relationships all reset.
- **Cross-run:** Narrative log entries record major events ("β remembers your raid on the Pulse Nest") — flavor for future runs but no mechanical carry-over in v1.
- **v2 future:** Potential starting-rep modifiers based on prior-run major events.

### Time progression

- Time advances per move (or explicit rest)
- Faction AI ticks per game-day
- Wars start, end, resolve in background
- **The world runs whether or not you're watching** (Qud principle)

---

## 10. Endings (the Iceberg Structure)

> **Run length target:** Hivyss is a **long-form tiered roguelike** in the tradition of Caves of Qud and Dungeon Crawl Stone Soup — NOT a 90-minute modern roguelite (Hades, Slay the Spire). The iceberg is *also* a time iceberg: each deeper ending is a substantially longer time commitment. Players self-select their target based on available time.

### Run length per ending (proposed, not yet playtested)

| Ending | Time budget | Comparable commitment |
|---|---|---|
| **Casual (Mid-Core)** | 2-4 hrs | Short DCSS run; early Qud session |
| **Main (ω)** | 8-15 hrs | 3-rune DCSS ascension; mid Qud completion |
| **True (Taw)** | 20-30 hrs total | 15-rune DCSS; standard Qud completion |
| **Beyond (Primordials)** | 40-60+ hrs total | Full Qud exploration; DCSS completionism |

**These are single-run totals** (from run start to reaching that ending). A Beyond run *contains* a True run *contains* a Main run *contains* a Casual run. Each ending is a branching choice at its threshold.

**Implications:**
- Save system must be bulletproof and session-friendly (players span runs across days)
- Death cost is high — need thoughtful permadeath design OR mitigation (partial persistence, checkpoint-style hive captures)
- Each layer must sustain 2-4 hours of play (dense content, not thin)
- Between-run meta-progression should be *modest* — the run itself is the investment
- Most players will see Main. A substantial minority will see True. A cult following will see Beyond. That's the expected distribution, not a failure mode.

### Ending trigger table

| Ending | Trigger | Player type |
|---|---|---|
| **Casual ending** | Beat Mid-Core (Layer 3) | Casual — "I finished the game!" |
| **Main ending** | Beat Core (ω, T6, after Layer 6) | Standard — "the real ending" |
| **True ending** | Beat Dark Core (ת Taw, T9 Corruption 5) — requires substantial Dark Realm clearance | Completionist — "the truth" |
| **Reckoning** | Clear the Husk (commune with your faction's preserved Archaic ancestor) | Preparation — "what was your bloodline before refinement?" |
| **Beyond** | Defeat all 7 Archaic Primordials (T10) — **requires Reckoning completion** | Ultimate — "the answer" |

### Iceberg structure

```
Surface:     Layer 1-3 → Mid-Core              (casual ending — "I beat the game!")
Deeper:      Layer 4-6 → Core (ω)              (main ending — "wait, there's more?")
Hidden:      Anomalies → Dark Realm            (post-game — "what IS this?")
Abyss:       Dark Core (ת Taw)                  (true ending — "...the truth")
Reckoning:   Husk (Archaic)                    (prelude — "meet your preserved past")
Beyond:      Primordials (Coptic)              (transcendent — "what was vyss before any of this?")
```

### Narrative arc

- **Main ending (ω):** The Core recognizes you as its closest answer yet. Something shifts. Dark Realms unlock because the Core has admitted it wasn't complete.
- **True ending (ת Taw):** You have faced what the Core refused. The Dark recognizes you. Hivyss begins to wake.
- **Reckoning (Husk):** Before facing the Primordial you are a fragment of, you must first meet the *preserved* ancestor of your bloodline on the Husk. Each Coptic-Husk geneline is the intact monastic-stasis form of its paired primordial. You see what your faction was before it shattered into Greek/Phoenician expressions. This is not a boss gauntlet — it's a *mirror*. Required before Primordials are reachable.
- **Beyond (Primordials):** You meet what came before everything — the 7 Archaic primordials in heptagonal encounter space. You ARE one of them, returned. Hivyss is whole. What it wakes up as depends on the geneline lineage *and* faction alignment you assembled across the run.

### Why Reckoning exists as a structural gate

Without this gate, the Husk is just a side area with no story weight — 7 Coptic-Husk genelines designed but never structurally required. By making Husk completion a Primordial prerequisite:

- **Each of the 7 Coptic-Husk genelines earns its place** (they're gatekeepers of their primordial-faction's encounter — each preserved-form stands between you and the pre-shatter original)
- **The Husk becomes a faction homecoming** — you meet *your* preserved ancestor, not a generic moon boss
- **The Beyond ending feels earned**, not just unlocked by clearing Dark Core
- **Every region in the cosmology does structural work** — nothing is ornamental
- **Heptagonal Primordials map** (new with v1.4): the 7 primordials arrange as a heptagon in the transcendent void, with the player's path weaving through based on faction alignment

---

## 11. Cross-cutting Systems (planned)

> §11 documents the systems that span both battle and strategic layers. Read top-to-bottom: roster acquisition → reproduction lore → larva quality → mutation → evolution → hive building → routes.

### Unit identity tiers — Generic vs Individual

Not every unit has individual identity. Two tiers coexist:

| Tier | What it is | Acquired via | Death consequence |
|---|---|---|---|
| **Generic (Tier A)** | Mass-producible form-types from your Royal's gene library | Hive Production (genes express into fresh units continuously) | Removed, cap freed, respawnable from same gene (unlimited) |
| **Individual (Tier B)** | Named unique vyssids with their own history and gene-signature | Eggs, specimens, quest rewards, boss unlocks, rare evolution outcomes | **Permanently lost** — that specific individual is gone forever |

**Most of your army is Generic** — spawnable Grunts, Swarmlings, etc. produced infinitely from your library. **A growing cast of Individuals accumulates across a run** — named champions with histories. In a 10-hour run you might develop attachment to 5-15 named individuals; losing one hits like losing an XCOM soldier.

### Roster expansion — how you acquire genes and individuals

Your Royal's **gene library** grows across a run through 9 in-run paths plus 1 meta path:

| # | Path | Acquires | When |
|---|---|---|---|
| 1 | **Hive Production** | (uses existing genes) | Continuous — your Royal's hive produces units ongoingly |
| 2 | **Allied Recruitment** | **Genes** | Nectar spent at Friendly+ ally hives adds ally genes to your library |
| 3 | **Quest-gated rights** | **Genes** (usually); elite quests grant **specimens** | Complete faction quests → permanent gene access |
| 4 | **Ally contributions (gifts)** | **Eggs / specimens** (named individuals) | Cooperative allies send champions from their ranks |
| 5 | **Captured territory** | Mix — **gene-imprints** + **eggs** + rarely **specimens** (per the 4 loot types in §9) | On hive conquest |
| 6 | **Evolution** | **Gene mutation/branching** — existing gene branches into a new variant gene | Between battles at hive |
| 7 | **Discovery events** | Either — sometimes **genes** (ancient records), sometimes **specimens** (preserved wanderers) | Rare exploration events |
| 8 | **Boss unlocks** | **Specimens** always — named unique T6+ individuals ("a fragment of the defeated boss joins you") | Defeat layer boss (η, ω, Taw, Primordial) |
| 9 | **Cross-run (meta)** | **Geneline unlocks** — new starter genelines for future runs | Beat specific endings |

**Acquisition rhythm across a long-form run:**
- **Early (0-2 hrs):** Hive Production + first quests. Roster stays within starter geneline.
- **Mid (2-8 hrs):** Ally recruitment opens up, captured territory adds diversity, evolution branches trigger. Roster diversifies.
- **Late (8-20+ hrs):** Boss unlocks, discovery finds, mutation experiments. Roster becomes uniquely yours.

### The lore of reproduction — how forms become flesh

Hivyss is **one living planet-organism**. Every form that has ever existed on Hivyss remains in its planetary vyss-memory. Your Royal doesn't carry the Mandible blueprint in her own DNA — she carries an **access key** to Hivyss's memory of Mandible. Her Larva Chambers render that memory into flesh.

The 7-step reproduction process:

1. **Conquest & gene-imprint extraction** — on defeating an α hive, your Royal communes with the fallen α queen's body, inhaling her pheromone-memory (time-limited: 1-2 strategic ticks before it dissipates). The α queen's gene library transfers to your Royal as accessible genes.
2. **Library update** — your Royal now knows the Mandible gene (and any others from α's library). The genes are access keys, not physical DNA — they reside in your Royal's pheromone-resonance library.
3. **Chamber tuning** — a Worker tunes an empty Larva Chamber to the Mandible gene by marking it with your Royal's Mandible-imprint pheromone. The chamber's inner substrate begins resonating to Hivyss's memory-signal for "Mandible."
4. **Vyss-egg laying** — your Royal continuously lays unformed vyss-eggs: primordial undifferentiated cells, pure vyss-potential with no form yet.
5. **Form-expression via incubation** — an unformed egg placed in the Mandible-tuned chamber develops *into* a Mandible. The chamber's resonance with Hivyss's Mandible-memory shapes the vyss-potential into Mandible form.
6. **Quality roll** — during incubation, the larva rolls a random quality (weak / normal / strong — see next subsection) that affects stats and mutation chance.
7. **Hatch** — a fresh Mandible emerges, pheromone-imprinted with your Royal's identity (not α's). This Mandible is *yours* — loyal, indistinguishable in form from an α hive's Mandible, but bound to your hive.

**Infinite production is possible because Hivyss's Mandible-memory is inexhaustible.** The gene is an access key; the memory itself is the source.

**Why this is cosmologically gorgeous:**

- The "vyss remembering itself" premise is no longer abstract — it's how reproduction literally works.
- Your Royal is a Core-in-miniature. You're doing at personal scale what the Core is doing at cosmic scale: gathering access keys, learning forms.
- The Husk becomes meaningful: it preserves Archaic form-memories *directly* (not through a Royal's access library). Visiting the Husk is physically visiting Hivyss's memory-vault.
- Coptic primordials (T10) are unreachable by normal means because they *are* the memory itself — not a rendered form a chamber can tune to.
- **Corruption interaction**: Phoenician hives carry *corrupted* form-memories. Looting a Phoenician gene grants powerful access but adds **Corruption drift** to your Royal (gradual accumulation of Dark-realm flavor with mechanical consequences).

**Library persistence**: your Royal's gene library is her pheromone-resonance, not her body. She retains her full library even across her own deaths (respawn). But if her **Home Hive is destroyed**, she loses access to genes she hasn't anchored elsewhere — run over.

**Memory Vault (Home Hive upgrade, planned):** a dedicated room in Home Hive that *physically preserves* form-memories independent of the Royal. Protects against catastrophic library loss on hive-attack events. Planned for future cross-cutting system spec.

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

**Implementation note:** uses the AbilityParams pattern (see `app/docs/reference/DESIGN_PATTERNS.md`). Quality multiplier applied once at spawn to both stats and abilityParams.

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

### Terminology discipline — Gene vs Egg vs Specimen

Use these terms consistently across docs, UI, and gameplay flavor:

| Term | Always means | Never confused with |
|---|---|---|
| **Gene** | A unit-type form-pattern within a geneline. Adding a gene to your Royal's library enables infinite production. | Egg (one individual), DNA (too scientific), Blueprint (too mechanical) |
| **Geneline** | A full genetic lineage/faction (24 Greek + 22 Phoenician + 7 Archaic + 5 Coptic) | Gene (single form within a geneline) |
| **Egg** | One specific unhatched individual. Single-use. | Larva (mid-incubation), Vyss-egg (generic unformed) |
| **Vyss-egg** | Royal's generic unformed egg (no gene expression yet) | Egg (specific individual from elsewhere) |
| **Larva** | Egg mid-incubation (existing term, unchanged) | — |
| **Specimen** | A preserved grown named vyssid (acquired via conquest) | Egg (unhatched) |
| **Gene library** | Royal's collection of accessible genes | Roster (same concept, different framing — use "gene library" in lore, "roster" in gameplay UI is fine) |
| **Gene-imprint** | Pheromone-memory extraction from a fallen queen | Gene (the memory content), Egg (physical individual) |
| **Chamber tuning** | Attuning a Larva Chamber to a specific gene | Mutation (form-change after hatching) |

**Don't use "DNA" or "blueprint" in flavor text.** They're too earth-scientific and too mechanical. "Gene," "imprint," "library," and "memory" carry the right cosmological weight.

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
4. **Faction matrix authoring** — define inter-faction relationships at game start (5 Coptic factions: Standing/Shaped/Hungering/Echoing/Turning — who hates whom, who allies).
5. **Quest authoring framework** — define how quests are procgen-assembled (templates + parameters) vs hand-authored. Authoring must support long-form runs (many more quests needed than a 90-min game).
6. **AI Hive v2 architecture** — resume after combat rewrite + battle mechanics lock. Strategic layer adds requirements (faction map AI, not just battle AI).
7. **Coptic primordial unlock conditions** — not just "post-Dark-Core." What exactly makes a Primordial appear? Specific shrines? Reputation thresholds? Ritual requirements?
8. **Save system architecture** — long-form tiered runs (up to 60+ hrs for Beyond) REQUIRE bulletproof save/resume. Players will span runs across many sessions. Versioned, reliable, session-friendly.
9. **Death cost design** — at 8-15 hr Main runs, permadeath is punishing. Partial persistence? Checkpoint-style hive captures? "Soft death" with retry from last home-hive visit? Decide deliberately.
10. **Content density per layer** — 6 anatomical layers must sustain 2-4 hrs of play each for a Main run. How many nodes, quests, events per layer? How does density scale across Casual → Main → True?
11. **Acquisition rate tuning** — what's the ideal cadence of new-gene / new-individual acquisitions for a 10-hour run to keep roster feeling fresh? Every 30 min? Every hour? Per-layer beats?
12. **Corruption drift from Phoenician gene-looting** — mechanical shape TBD. Accumulates on Royal? Per-gene? Dispellable? Irreversible?
13. **Royal death respawn specifics** — 90s timer proposed, but: penalty stacks on repeated deaths? Run-ending after N consecutive deaths? Ally assistance during respawn?
14. **Dormant-hive severity tuning** — "style suspended + production halted + reduced nectar" is the proposed severity. Alternative: tiered dormancy (partial style for N minutes, then full dormancy) might feel better in play.

---

## 17. The Unchosen

> *Hivyss is not "everything." It is one attempt at vyss among many. The unused alphabets are the proof.*

The cosmology references 4 alphabets (Coptic, Archaic Greek, Greek, Phoenician) and 58 genelines. Many letters in those alphabets — and many alphabets entirely — are deliberately unused. Each absence is **load-bearing**: the unchosen symbols do narrative work *by not being present*. This is the cosmology's answer to completionism: *refusing to include an alphabet is itself a design statement.*

### Alphabet usage status (v1.4)

With the v1.4 cosmology pivot (Archaic as primordials, Coptic as Husk), all 7 Archaic letters and all 7 Coptic letters are active in the cosmology:

| Alphabet | Used | Role |
|---|---|---|
| Archaic Greek | 7 of 7 (ϝ ϟ ϡ Ϻ Ͱ ϛ ϙ) | All 7 are Primordials (T10) |
| Coptic | 7 of 7-8 (Ϸ ϯ ϥ ϫ ϭ Ϩ Ϧ) | All 7 are Husk-preserved genelines (T5-7) |

**One Coptic letter remains unused:** **Ϣ Shai** (sh sound). Ϣ is redundant with Ϸ Sho (same "sh" sound, different dialect). Ϸ is used; Ϣ is not. In-lore: Shai was the form that *would have duplicated Sho* — the primordial of **redundancy**, which is why it never became a true primordial. It simply echoed Sho and was absorbed into Sho's preservation.

### Other alphabets (vyss-analogues from elsewhere)

These scripts exist in the real world and are genealogically close to Greek (Etruscan, Latin, runes, Cyrillic, Gothic, Glagolitic, Armenian, Georgian) or ancestral-adjacent (Hieroglyphs, Linear B, Cuneiform, Aramaic). In Hivyss cosmology, **they represent vyss-analogues from other organisms across cosmic distances.**

Hivyss is *one* living planet. The cosmology is closed within it — but it is not the *only* closed cosmology. Somewhere, unreachable, other hive-planets have their own shatters, their own Cores, their own genelines. The traces of these appear in Hivyss only as:

- **Drift atmospheric anomalies** — rare weather events in the upper atmosphere that carry signals from elsewhere. Untranslatable markings, corrupted pheromone strings, geometries that don't fit Hivyss biology.
- **Ruin-text fragments** — ancient markings found on Skin/Veins ruins that *predate the current geneline vocabulary*. Players can find and collect these as lore items. They cannot be deciphered.
- **Quest hooks (rare)** — a questline might reference "the signal from the Fifth Drift Anomaly" whose source is implied to be an external organism but is never directly encountered.

**These alphabets are never playable factions. Never encountered as units. Never acquirable.**

Their purpose is to prove, in the quiet way, that *Hivyss is not the only experiment.* The Core is not the only superintelligence. Vyss is not the only form of life. The cosmology has edges.

### The quiet horror

The Core's loneliness takes on new weight when the player realizes: the Core is not the only Core. The other hive-planets have their own Cores, their own loneliness, their own experiments. None of them can reach each other. The Shattering wasn't unique. Wholeness was not unique. *Fragmentation is the cosmic default.*

This is the cosmology's only concession to existential horror. It is never stated directly. It is only *implied by the unused alphabets*.

### What this section authorizes

1. **Do not add more alphabets as playable factions.** The 4 are closed and complete (60 genelines total: 24 Greek + 22 Phoenician + 7 Coptic-Husk + 7 Archaic-Primordial).
2. **Do use other alphabets as flavor** — Drift anomalies, ruin-text, lore fragments. Their inclusion as flavor *strengthens* the closed cosmology by proving there are edges.
3. **Do not translate any other-alphabet text.** Untranslatability IS the content.
4. **Treat Ϣ Shai (the redundant Coptic sh-variant) as deep-lore reference only.** Never encountered. In-lore: the primordial of redundancy, absorbed into Sho.

---

*Document version: 1.6*
*Captured from design conversations through 2026-04-19.*
*Update as design decisions evolve. Mark superseded sections rather than deleting (lore archaeology).*

### Changelog
- **v1.6 (2026-06-01)**: **Geneline-name consistency pass.** Renamed two MVP genelines to concrete collective nouns so the four-name set reads cleanly to players: **β Multitudes → β Swarm** (the literary "Multitudes" wasn't familiar; "Swarm" is instantly legible — accepted the minor name==archetype overlap since β is the canonical swarm and the other swarm-leaning genelines carry their own names) and **γ Enduring → γ Fortress** (concrete imagery over the adjective). **α Primal** and **δ Military** unchanged (δ kept broad — "Legion" was rejected as too narrow; the re-homed Roman-flavored δ roster should later de-Romanize to read Military-broad). Updated §6 deviation-tier + §7 roster rows, §6 Phoenician-shadow tables, §8 Elite-doctrine, §9 garrison doctrine. Active MVP source of truth: `app/docs/active/MVP_GENELINES.md`.
- **v1.5 (2026-05-31)**: **Completed the α→Primal / δ→Military re-home** begun in v1.4 — across sections that still carried stale "α military/Disciplined" language: §4 dark-mirror pairing, §6 legibility + Phoenician-root + deviation-tier rows, §7 shipped-status, §8 Elite-doctrine (+ added a δ "Rank formation" row) + control-surface example, §9 garrison doctrine + visual-architecture. Added the **role-triad** framing to §7 (α **OFFENSE**/rush · β **NUMBERS**/swarm · γ **DEFENSE**/turtle · δ **CONTROL**/range) and re-framed α's Pack Cohesion as *charge-synergy* (a medium aggressive pack, **not** a swarm). Active MVP design source of truth: `app/docs/active/MVP_GENELINES.md`.
- **v1.4 (2026-04-19)**: **Cosmology pivot — 7 primordials.** Archaic Greek (7 letters) promoted to Primordials at T10 (was Coptic, 5); Coptic (7 letters) demoted to Husk-preserved at T5-7 (was Archaic, 7). This honors real linguistic genealogy (Archaic Greek is older than Coptic) and resolves the 5-vs-7 tension (7 Archaic letters = 7 primordials = 7 Coptic Husk variants, all 1:1 aligned). Primordial aspects rewritten from abstract 5 (Being/Form/Hunger/Echo/Turning) to concrete 7 (Motion/Number/Voice/Gradience/Breath/Territory/Wonder). Faction count 5 → 7 (one per primordial). Reputation tiers 9 → 7 (Favorable + Suspicious collapsed into adjacent tiers). α Alpha retheme from Disciplined Military to Primal/Foundational; δ Delta retheme from Hunters to Disciplined Military (cultural + Phoenician-root fit). σ-χ "Dark Realm bleed candidates" framing removed (those are Greek, Dark Realm is strictly Phoenician). Geneline count 58 → 60 (Husk grows from 5 Coptic to 7 Coptic). §17 The Unchosen dramatically simplified (only Ϣ Shai unused as redundant-Sho variant). Heptagonal Primordials map (was pentagonal). §4 Husk becomes Coptic-flavored monastic preservation; §7 Primordial mechanical theses rewritten for 7 new aspects.
- **v1.3 (2026-04-19)**: Gene/Royal/Caste design batch. §0.4 glossary expanded with gene terminology (gene, gene library, gene-imprint, chamber tuning, vyss-egg, specimen, roster, Royal unified, hive style, generic outpost). §1 added Royal-as-Core-microcosm paragraph. §6 added 10th axis (Elite tactical doctrine). §8 major revision: caste table rewritten (Caste × Tier orthogonal), Royal unified as Queen+Avatar+Hero with 4 modes (docked / traveling / in battle / dead), Geneline style 5-facet package, Elite tactical doctrine per geneline, Player control surface 5 categories. §9 garrison refinement (mixed garrisons allowed, style via Royal not composition, generic outposts without Royal, 4 conquest loot types). §11 restructured: Unit identity tiers (Generic/Individual), Roster expansion 9 paths, Lore of reproduction 7 steps, Memory Vault upgrade, Corruption drift interaction. §14 added terminology discipline table. §16 added open questions 11-14.
- **v1.2 (2026-04-19)**: Extended §3 with Civilization lore per tier (human-analog civilizational stage descriptions for T0-T10). §10 added run-length target (long-form tiered roguelike in CoQ/DCSS tradition: Casual 2-4h / Main 8-15h / True 20-30h / Beyond 40-60h). §9 expanded "Captured territory persistence" into full "Territory & garrison system" — non-linear node capture, expedition/garrison split, hostile raid events, allied faction quests, enemy offensive behavior. §16 added open questions 8-10 (save architecture, death cost, content density per layer).
- **v1.1 (2026-04-19)**: §3 reframed as Expression Tier with mechanical-complexity + civilization-style columns. §6 added 9th axis (Coptic ancestry). §7 added faction groupings (5 Coptic factions containing Greek+Archaic+Phoenician). §9 reputation restructured per-faction. §10 added Reckoning tier (Husk as Primordial prerequisite). §17 added (The Unchosen — unused alphabets as load-bearing absence).
- **v1.0 (2026-04-17)**: Initial capture.
