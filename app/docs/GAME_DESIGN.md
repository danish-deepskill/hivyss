# Game Design — Hivyss (Future Planned)

Future game mechanics and systems. Read before designing new features.
This document captures design decisions — not yet implemented.

---

## Terminology & Lore

### Core Terms
| Term | Meaning | Usage |
|------|---------|-------|
| **Vyss** | Life essence / genetic potential | The vital force of insect life on planet Hivyss |
| **Vyssid** | A being with vyss | Any unit/creature in the game (lore term for "unit") |
| **Hivyss** | Hive of vyss | The planet — origin of all vyss |
| **Geneline** | A lineage of vyss expression | Genetic faction (Alpha, Beta, etc. — Greek letters) |
| **Nectar** | Floral resource | Currency |
| **Pheromone** | Chemical signal | Command system for soldiers |
| **Larva** | Immature vyssid | Pre-hatch unit in incubation |
| **Spire** | Capturable turret structure | Biological tower — auto-attacks enemies when captured |
| **Brood** | Colony offspring | Used for hard cap (army size limit) |

### Tier System
Tiers measure how fully a vyssid's genetic potential (vyss) is expressed.

| Tier | Name | UI label | Layer introduced |
|------|------|----------|-----------------|
| 1 | Vyss | V | 1 |
| 2 | Kilovyss | K | 1 |
| 3 | Megavyss | M | 1 |
| 4 | Gigavyss | G | 2 |
| 5 | Teravyss | T | 3 |
| 6 | Petavyss | P | 4 |
| 7 | Exavyss | E | 5 |
| 8 | Zettavyss | Z | 6 |
| 9 | Yottavyss | Y | 7 |
| 10 | Ronnavyss | R | 8 |
| 11 | Quettavyss | Q | 9 (Core) |

### Tier Naming Convention
- **Tier name** = the power level itself (e.g., "Kilovyss tier")
- **Unit on that tier** = tier + vyssid (e.g., "Mandible is a Kilovyssid")
- Scale follows SI data prefixes (kilo → mega → giga → ... → yotta → ronna → quetta) with vyss suffix
- Quettavyss = the ultimate tier — peak genetic expression

### Tier Complexity Ramp
| Tier | Mechanical complexity |
|------|----------------------|
| Vyss (1) | No ability |
| Kilovyss (2) | Role defined, no hook |
| Megavyss (3) | 1 simple hook |
| Gigavyss (4) | 1 hook + affects allies/enemies |
| Teravyss (5) | 2 hooks |
| Petavyss (6) | 2 hooks + positioning matters |
| Exavyss (7) | Complex unique mechanic |
| Zettavyss (8) | Multi-mechanic + transforms |
| Yottavyss (9) | Army-altering presence |
| Ronnavyss (10) | Game-changing — bends the rules |
| Quettavyss (11) | Ultimate — transcendent, run-defining |

---

## Castes

Four unit castes defining control scheme and purpose:

| Caste | Control | Purpose |
|-------|---------|---------|
| `worker` | Auto | Utility — economy, engineering, pheromone scouts |
| `soldier` | Auto | Offensive combat — marches forward, fights |
| `elite` | Player-controlled (RTS click) | Tactical combat — player directs movement/targeting |
| `royal` | Direct hero control (WASD/click) | Champion — one on field, player IS the unit |

### Rules
- Soldiers march automatically, cannot be directly controlled
- Workers auto-perform their job (gather, build, scout)
- Elites are the only RTS-controlled units — click to move/target on the lane
- Only ONE Royal on the field at a time — direct hero control
- Royal dying = temporary army debuff (lose coordination), not game over

---

## Pheromone System

Workers emit pheromones that affect nearby Soldiers' behavior. Pheromones are biological commands — kill the Worker, the command stops.

### Command Pheromones (from Scout workers)
| Pheromone | Effect on nearby Soldiers |
|-----------|--------------------------|
| Retreat | Fall back past scout's position |
| Rally | Group up, hold position |
| Charge | Increased speed toward enemies |

### Mutagen Pheromones (from Mutagen Scout workers)
Delivers mutations to deployed units mid-battle. See Mutation section.

### How it works
1. Spawn a Scout (Worker caste, fast, fragile)
2. Scout runs to the frontline
3. Scout emits pheromone zone around itself
4. Nearby Soldiers change behavior / receive mutation
5. Pheromone fades when scout dies or timer expires

---

## Routes

Three routes for unit movement:

```
AIR      ─────────────────────────────
LAND     ═════════════════════════════
TUNNEL   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
```

### Route Affinity
Each unit has a native route. Using the wrong route applies a debuff:

| Unit affinity | On native route | On wrong route |
|---------------|----------------|----------------|
| Land | Full strength | Weakened |
| Tunnel | Full strength | Weakened |
| Air | Full strength | Cannot use other routes |

### Route Interactions (who can fight who)
| Attacker → Target | Air | Land | Tunnel |
|--------------------|-----|------|--------|
| **Air** | Yes | Yes (swoop) | No |
| **Land** | Ranged only | Yes | No |
| **Tunnel** | No | No | Yes |

Cross-route specialists can break these rules via route-switching abilities or passive ticks.

### Deploy Controls
- Click unit card = deploy to native route (default)
- Shift + Click = deploy to opposite route (land ↔ tunnel, with debuff)
- Air units always go air, shift does nothing

### Runtime Route Switching
Units can change route mid-battle by assigning `u.currentRoute` from a passive tick or effect hook:
```ts
// Example: air unit crash-lands when low HP
u.currentRoute = 'land';
```
UnitDef has `route` (native), IUnit has `currentRoute` (mutable at runtime).

---

## Terrain

Dynamic terrain on the land route:

### Water
- Blocks land route at that section
- Land units forced into tunnel (with debuff) or need air units
- Flyers pass over unaffected
- Swimmers (aquatic units) cross freely

### Hill (branching path)
```
                ╱── HILL PATH ──╲
LAND  ═════════╱                 ╲═══════════
               ╲── FLAT PATH ──╱
```
- Unit chooses hill or flat path at the fork
- Hill path: slower to climb, but high ground advantage (range, damage bonus)
- Flat path: normal speed, normal combat
- Defending from hill = advantage

### Destructible Terrain (Worker engineering)
- Workers can dig tunnel entrances mid-battle
- Workers can build walls on land route
- Workers can collapse tunnels on enemies
- Terrain is dynamic, shaped by gameplay

---

## Evolution

Unit evolution = **unlocking new units** through branching paths. NOT stat inflation.

### How it works
- After winning a battle, player can choose to evolve a unit in their deck
- Evolution unlocks a NEW higher-tier unit from the same geneline
- Original unit stays in deck — both are available
- Each unit has 2-3 evolution branches (player chooses one per run)

### Example: Alpha evolution tree
```
       ┌→ Mandible (E, melee)
Grunt ─┤
       └→ Needler (E, ranged)

         ┌→ Ravager (D, berserker)
Mandible ┤
         └→ Legionnaire (D, tank)

         ┌→ Centurion (C, support)
Ravager ─┤
         └→ ??? (C, assassin)
```

### Rules
- Evolution adds to deck, does NOT replace the base unit
- Cheap units (Grunt) stay useful as fodder alongside evolved forms
- Each geneline has its own evolution tree
- 24 genelines × branching trees = 200+ total units reachable
- Each run the player explores ~15-20 units through chosen branches
- Replayability through variety, not power

---

## Larva Quality

Each larva spawned has a random quality. Hive level improves odds.

### Quality Tiers
| Quality | Stat modifier | Ability modifier | Mutation chance |
|---------|--------------|-----------------|----------------|
| Weak | -20% all stats | -20% ability values | 15% |
| Normal | Base | Base | 50% |
| Strong | +20% all stats | +20% ability values | 100% |

### Hive Level → Quality Distribution
| Hive Level | Weak | Normal | Strong |
|------------|------|--------|--------|
| 1 | 60% | 35% | 5% |
| 2 | 35% | 50% | 15% |
| 3 | 15% | 50% | 35% |
| 4 | 5% | 35% | 60% |

### Rules
- Quality is visible on larva before deploying — player chooses which larva for which unit
- Quality scales ALL numbers equally (stats + ability values via AbilityParams pattern)
- Strong larva = guaranteed mutation if Mutagen Scout reaches it
- Weak larva = cheap fodder, low mutation chance
- Quality is consumed on mutation — Mutated form has fixed stats, no quality modifier

### Implementation
Uses the AbilityParams pattern (see DESIGN_PATTERNS.md). Quality multiplier applied once at spawn to both stats and abilityParams. Hooks read from unit instance, never hardcoded.

---

## Mutation

Mid-battle unit transformation via Mutagen Scout workers. Transforms unit into unique mutated form with new art and better abilities.

### How it works
1. Spawn a Mutagen Scout (Worker caste, expensive, one-time use)
2. Scout runs to your deployed units
3. Releases mutation pheromone on nearby units
4. Each affected unit rolls mutation chance (based on quality: weak=15%, normal=50%, strong=100%)
5. Successful: unit transforms into its Mutated form (new art, enhanced ability)
6. Quality resets — Mutated form has fixed stats regardless of original quality
7. Scout dies after releasing

### Mutation Types
| Type | Rarity | What happens |
|------|--------|-------------|
| Common (generic comp) | Frequent | Stat modifier overlay (+HP, +atkRate, etc.) |
| Rare (unique form) | Rare | Hand-crafted mutated art + new/enhanced ability |

### Example Unique Mutations
| Unit | Mutated Form | New ability |
|------|-------------|------------|
| Grunt | Mutated Grunt | Gains poison bite |
| Mandible | Mutated Mandible | Jaw attack cleaves 2 targets |
| Bombardier | Mutated Bombardier | Death explosion radius doubled |
| Centurion | Mutated Centurion | Aura also boosts atkRate |

### Three Systems Summary
| System | What it does | When | Persists |
|--------|-------------|------|----------|
| Evolution | Unlocks new unit in deck | Between battles | For the run |
| Quality | ±20% stats/abilities + mutation chance | On larva spawn | Until mutation |
| Mutation | Transforms into new form | Mid-battle via scout | For the battle |

---

## Hive / Brain Unit

The hive base is the colony brain:

- Hive HP reaching 0 = game over
- Hive below 25% HP = army debuff (coordination breakdown)
- Royal dying = temporary army debuff, NOT game over
- Hive can be upgraded between battles

### Hive Upgrades
- More larva chamber slots
- Base turret slots (Workers build turrets)
- Better larva production rate
- Visual evolution (small mound → fortified hive → massive colony)

---

## Battle Modes

Four distinct battle modes, determined by the strategic situation on the territory map:

### Mode 1: Hive vs Hive (Standard)
Both sides have a hive, both spawn units. Tug of war.
```
[YOUR HIVE]═══[SPIRE]═══[SPIRE]═══[ENEMY HIVE]
```
- You spawn from your hive, enemy spawns from theirs
- Spires in between are neutral — first to reach captures them
- Win by destroying enemy hive
- Tests everything: economy, combat, building

### Mode 2: Siege (You Attack)
You bring a pre-built army to assault an enemy hive. No base of your own.
```
→→→ YOUR ARMY →→→═══[SPIRE]═══[ENEMY HIVE]
```
- Pick your army before battle (spend nectar on a fixed roster)
- No hive = no spawning mid-battle, no reinforcements
- Captured spires become forward turrets
- Win by destroying enemy hive before your army dies
- Tests: army composition, aggression

### Mode 3: Defense (You Defend)
Enemy sends waves at your hive. No enemy base to destroy.
```
[YOUR HIVE]═══[SPIRE]═══[SPIRE]═══←←← ENEMY WAVES
```
- You spawn units and build spire turrets
- Enemy sends escalating waves (no hive to kill)
- Win by surviving X waves
- Workers are MVP — build turrets, gather nectar
- Tests: engineering, wave management, tower defense

### Mode 4: Clash (Field Battle)
Pure army vs army. No bases. Pre-draft + tactical deployment.
```
→→→ YOUR ARMY →→→═══[SPIRES]═══←←← ENEMY ARMY
```
- Both sides pick armies beforehand (spend fixed nectar budget)
- No spawning, no economy mid-battle
- Player deploys from reserves — choosing when and what order
- Win by wiping enemy army
- Tests: drafting, deployment timing, pure tactics

### Mode Sequence in a Layer
Mode is determined by the strategic situation — tells a story:
```
Battle 1: Clash — armies meet scouting in open field
Battle 2: Defense — enemy retaliates, attacks your hive
Battle 3: Siege — you push to assault their hive
Boss: Hive vs Hive — final showdown, both bases
```

---

## Territory System

Hives are scattered across the map. Any geneline can capture them.

### Map Structure
```
[YOUR HIVE]───(battle)───[NEUTRAL HIVE]───(battle)───[ENEMY HIVE]
                              │
                          [SPIRE]
```

### Capturable Structures
| Structure | What it does | Who captures |
|-----------|-------------|-------------|
| **Hive** | Forward spawn point + room slot for home hive | Soldiers push, Workers capture |
| **Spire** | Auto-attacks nearby enemies (turret) | Workers capture and upgrade |
| **Nectar Deposit** | Generates passive nectar income | Workers |

### Captured Hive → Home Hive Room Slot
Each captured hive adds a room slot to your home hive. Managed from one screen via hive mind — no need to visit individual hives.

---

## Hive Building

Your home hive grows as you capture more hives. Between battles, build and upgrade rooms.

### Room Types
| Room | What it unlocks | Upgrade levels |
|------|----------------|---------------|
| Larva Chamber | More larva slots, faster hatch | 3 levels |
| Evolution Pit | Evolve units between battles | 3 levels |
| Mutation Lab | Prepare mutagen scouts | 3 levels |
| Scout Den | Reveal next battle info, send pheromone scouts | 3 levels |
| Nectar Vault | Start battles with more nectar, higher cap | 3 levels |
| Armory | Units start with stat bonus | 3 levels |
| Spire Workshop | Build better turret types | 3 levels |

### Room Slot Progression
| Captures | Available slots | Notes |
|----------|----------------|-------|
| 0 | Home hive only (1-2 built-in rooms) | Larva Chamber |
| 2 | +2 slots | First build choices |
| 5 | +5 slots | Mid-run |
| 10+ | +10 slots | Full colony infrastructure |

### Hive Visual Progression
Home hive visually grows across the run:
- Start: small mound
- Mid-run: fortified colony
- End-game: massive fortress

---

## Hard Cap

Army size limit. Each unit costs cap. Cannot exceed.

### Cap Cost by Tier
| Tier | Cap cost | Example |
|------|---------|---------|
| Vyss (1) | 1 | Grunt = 1 cap |
| Kilovyss (2) | 2 | Mandible = 2 cap |
| Megavyss (3) | 3 | Bombardier = 3 cap |
| Gigavyss (4) | 4 | Centurion = 4 cap |
| Higher tiers | 5-8 | Scales with power |

### Cap Sources
| Source | Cap bonus |
|--------|----------|
| Home hive | 10 (starting) |
| Captured hive | +3 each |
| Hive upgrade (Armory) | +5 per level |
| Geneline bonus | Some genelines get more cap (Beta swarm gets extra) |

### Gameplay Effect
Forces army composition decisions:
```
Cap: 20
Option A: 20 Grunts (20 × 1 cap) — swarm
Option B: 5 Legionnaires (5 × 4 cap) — tank wall
Option C: 2 Centurion + 4 Mandible + 4 Grunt (8+8+4 = 20 cap) — balanced
```
Unit dies → cap frees up → can spawn again.

---

## Genelines

24 genelines (Greek letters: alpha through omega). Each geneline has a unique theme, palette, and gameplay identity.

### Vyssid Naming Convention

Names should feel like insect species — not job titles. Blend geneline theme with bug identity.

**Styles (all produce single-word names):**
- **Simple compound**: Two words glued — Shellguard, Ironmaw, Stonegrub, Lancewing
- **Fusion**: Syllables merge into a new word — Primite (Primal+Mite), Hiveperator (Hive+Imperator), Formant (Formation+Ant)
- **Standalone**: Real or invented bug word — Mandible, Crawlid, Gruzzer

**Guidelines:**
- Name should evoke the geneline's theme at a glance
- Geneline prefix/theme vocabulary makes the unit's faction obvious (Iron- = Armored, Fang- = Feral)
- Universal units stay unprefixed/plain — no geneline flavor (Grunt, Needler, Hardshell)
- Single word for soldiers/workers; two words allowed for elites/royals for gravitas
- Short, punchy, 2-3 syllables preferred
- Avoid pure military ranks or fantasy terms with no bug feel
- Reference: Hollow Knight (Vengefly, Crawlid, Husk Guard), Rimworld insects (compound style)

### Power Scaling
- NOT equal power — later layers introduce stronger genelines
- Enemies scale with layers, so stronger units are needed
- Mixing genelines is encouraged — no single geneline can fill a full deck alone
- Each geneline has its own unique roster shape — no fixed roster size or tier range
- Examples of roster variety:
  - Swarm geneline: many cheap Vyss/Kilovyss units, few elites
  - Royal-focused geneline: sacrifices lower caste units for powerful Royal buffs
  - Worker-specialist geneline: lots of workers, few soldiers
  - Small elite geneline: only 3-4 units but each is unique and powerful
  - Broad geneline: units across all tiers and castes

### Layer 1 Genelines (Starter Group — Equal Power Budget)

#### Alpha (α) — Military / Coordinated Army
**Inspiration:** SC2 co-op Raynor — strong individual units, commander buffs
**Theme:** Militaristic, disciplined
**Palette:** Primary `#c03030` (red), Secondary `#d4c4b0` (bone), Dark `#6b1a1a`, Shadow `#3d0e0e`
**Bug types:** Ants, wasps, ticks, beetles (variety within geneline)

| Trait | Description |
|-------|-------------|
| Playstyle | Build a strong army, buff it with commanders, coordinated push |
| Strength | Army-wide buffs (Centurion aura), solid stats across all roles |
| Weakness | No healing, no magic, no sustain — if army dies, nothing left |
| Caste focus | Soldier-heavy, few specialists |
| Unit count | Broad roster — units across all tiers |
| Speed | Medium |
| Cost | Medium |
| Counter | Kill the commander (Centurion), army loses buffs and crumbles |

**Current Alpha units:**
| Unit | Tier | Role | Mechanic |
|------|------|------|----------|
| Grunt | Vyss | Cheap fodder | None |
| Mandible | Kilovyss | Balanced melee | None |
| Needler | Kilovyss | Ranged DPS | Ranged auto-attack |
| Bombardier | Megavyss | Suicide bomber (tick) | Death explosion 65 AOE |
| Ravager | Megavyss | Berserker (wasp) | Rage atkRate at <50% HP |
| Legionnaire | Megavyss | Heavy tank (beetle) | Massive HP, knockback resist |
| Centurion | Gigavyss | Commander (ant) | +20% ATK aura to 5 allies |

#### Beta (β) — Swarm / Horde
**Inspiration:** SC2 co-op Zagara — cheap expendable units, overwhelming numbers
**Theme:** Swarming, fast, expendable, organic
**Palette:** Primary `#8cb030` (sickly green), Secondary `#d4d080` (pale yellow), Dark `#3a5010`, Shadow `#1e2808`

| Trait | Description |
|-------|-------------|
| Playstyle | Spam cheap units, overwhelm with numbers, sacrifice freely |
| Strength | Quantity, map pressure, never runs out, low cap cost per unit |
| Weakness | Each unit is fragile, weak to AOE, no strong individuals |
| Caste focus | Soldier-swarm, many low-tier units |
| Unit count | Many cheap Vyss/Kilovyss units, few higher tiers |
| Speed | Fast |
| Cost | Very cheap per unit |
| Counter | AOE damage wipes swarms, single strong unit can hold a chokepoint |

**Key mechanics:**
- Units have very low cap cost (1-2 each) — field many at once
- Some units have death effects (suicide bombers, spawn-on-death)
- Hive auto-spawns basic swarm units passively
- Strength in numbers — individual stats are poor

#### Gamma (γ) — Fortress / Armored
**Inspiration:** Xanides geneline reference — extremely slow, heavily armored, armor degrades
**Theme:** Rocky, mineral, fortress, impenetrable
**Palette:** Primary `#808080` (stone grey), Secondary `#c0b090` (sandstone), Dark `#404040`, Shadow `#202020`

| Trait | Description |
|-------|-------------|
| Playstyle | Slow unstoppable wall, absorb damage, outlast the enemy |
| Strength | Armor mechanic — high damage reduction, extremely tanky |
| Weakness | Very slow, expensive, vulnerable after armor breaks |
| Caste focus | Guardian-heavy, defensive positioning |
| Unit count | Few units, each is expensive and powerful |
| Speed | Very slow |
| Cost | Expensive |
| Counter | Sustained damage to break armor, then burst the exposed unit |

**Key mechanics:**
- Unique armor system — damage resistance % that degrades below 80% HP
- Visual change when armor breaks (armored → unarmored appearance)
- Higher tier Gamma units have stronger armor and degradation thresholds
- Guardian caste units excel — hold position, become fortifications
- Boss drops "pherocore" resource for hive building

### Layer 1 Group Balance
Same total power budget, different distribution:

| | Alpha | Beta | Gamma |
|---|-------|------|-------|
| Units | Few, strong | Many, weak | Few, very tanky |
| Speed | Medium | Fast | Slow |
| Cost per unit | Medium | Cheap | Expensive |
| Cap per unit | Medium (2-4) | Low (1-2) | High (4-6) |
| Identity | Buffed army | Endless swarm | Armored wall |
| Counter | Kill commander | AOE damage | Break armor with sustained damage |

### Future Layer Group Genelines
Each layer introduces 3 new genelines, balanced within their group. Later groups are stronger overall. Themes TBD but examples:
- Layer 2: elemental genelines (fire, ice, electric?)
- Layer 3-4: exotic genelines (shadow, nature, psychic?)
- Layer 5+: advanced genelines with complex mechanics
- Main game uses 24 standard Greek letters (α through ω)

### Future Expansions
- 7 Archaic Greek letters (ϝ ϟ ϡ Ϻ Ͱ ϛ ϙ) — ancient/extinct genelines, may be added in the future
- 5 Coptic letters (Ϸ ϯ ϥ ϫ ϭ) — mystery genelines of unknown origin, may be added in the future

### Set Bonuses
Reward keeping multiple units from same geneline:
```
2 Alpha units → +10% army HP
4 Alpha units → +20% army HP + knockback resist
Full Alpha    → "Legion" — all soldiers march faster
```
Mix bonuses also possible for cross-geneline synergy.

---

## Roguelike Structure

6 main layers + Mid-Core + Core + 3 Dark Realms + Dark Core. No acts — layers tell the story through escalating depth. Each run generates a random seed.

### Lore
The planet Hivyss has a superintelligence at its core. The deeper you go, the more advanced the enemy vyssids become — bio-engineered, adaptive, evolved. The player's entire journey is an experiment by the core intelligence. It's been watching and learning from every battle.

### Iceberg Structure
```
Surface:     Layer 1-3 → Mid-Core       (casual ending — "I beat the game!")
Deeper:      Layer 4-6 → Core           (main ending — "wait, there's more?")
Hidden:      Anomalies → Dark Realms    (post-game — "what IS this?")
Abyss:       Dark Core                   (true ending — "...the truth")
```

### Layer Progression
| Location | New genelines | Count | New max tier | Tier name |
|----------|--------------|-------|-------------|-----------|
| Layer 1 | α | 1 | 1, 2, 3 | Vyss, Kilovyss, Megavyss |
| Layer 2 | β, γ | 2 | 4 | Gigavyss |
| Layer 3 | δ, ε, ζ | 3 | 5 | Teravyss |
| **Mid-Core** | **η** | **1** | — | **Boss geneline reward** |
| Layer 4 | θ, ι, κ | 3 | 6, 7 | Petavyss, Exavyss |
| Layer 5 | λ, μ, ν | 3 | 8 | Zettavyss |
| Layer 6 | ξ, ο, π | 3 | 9 | Yottavyss |
| **Core** | **ρ** | **1** | **10** | **Ronnavyss** |
| Dark Realm 1 | σ, τ | 2 | — | — |
| Dark Realm 2 | υ, φ | 2 | — | — |
| Dark Realm 3 | χ, ψ | 2 | — | — |
| **Dark Core** | **ω** | **1** | **11** | **Quettavyss** |

1+2+3+1+3+3+3+1+2+2+2+1 = 24 genelines total.

### Special Geneline Rewards
- **η (Eta)** — Mid-Core boss reward. First "boss geneline," casual players' trophy.
- **ρ (Rho)** — Core boss reward. Main game's rarest geneline.
- **ω (Omega)** — Dark Core reward. The final letter. The ultimate geneline. The superintelligence's own geneline.

α (Alpha) is your beginning. ω (Omega) is the true end.

### Distribution Shape
```
Layer 1:      α                    (1 — learn Alpha alone)
Layer 2:      β γ                  (2 — first choice)
Layer 3:      δ ε ζ               (3 — mini-finale roster)
Mid-Core:     η                    (1 — boss reward)
Layer 4:      θ ι κ               (3 — deeper, stronger)
Layer 5:      λ μ ν               (3 — expanding)
Layer 6:      ξ ο π               (3 — final layer)
Core:         ρ                    (1 — boss reward)
Dark Realm 1: σ τ                  (2 — post-game, dark/forbidden)
Dark Realm 2: υ φ                  (2 — ancient, unnatural)
Dark Realm 3: χ ψ                  (2 — deepest secrets)
Dark Core:    ω                    (1 — the ultimate)
```

### Geneline Power Balance
- Genelines within the same layer = balanced (same power budget)
- Later layers are stronger overall (enemies scale too)
- Player starts with Alpha, discovers others as rewards
- Mixing genelines from different layers is encouraged
- "You fight it, you can recruit it" — beating enemies unlocks their geneline
- Dark realm genelines have forbidden mechanics (necromancy, parasitism, void)

### Layer Structure (per layer)
Each layer is a territory to conquer. Same enemy geneline throughout the layer — player masters countering it across multiple battles:

| Node | Type | Description |
|------|------|-------------|
| 1 | Battle (Clash) | Armies meet scouting — learn enemy geneline |
| 2 | Battle (Defense) | Enemy retaliates — defend your hive |
| 3 | Battle (Siege) | Push to enemy hive — assault |
| 4 | Boss (Hive vs Hive) | Final showdown — both bases |

Between battles: return to home hive, build rooms, evolve units, prepare scouts.

### Endings
| Ending | Trigger | Player type |
|--------|---------|-------------|
| **Casual ending** | Beat Mid-Core (after Layer 3) | Casual — "I finished the game!" |
| **Main ending** | Beat Core (after Layer 6) | Standard — "the real ending" |
| **True ending** | Beat all 3 Dark Realms + Dark Core | Completionist — "the truth" |

### Dark Realms
Unlocked post-Core. Anomalies appear on previously captured hives. Player investigates anomalies to discover dark realm entrances.

- **Not accessible during main layers** — requires research/investigation after beating layer 6
- **Enemies use forbidden mechanics** — genelines that break normal rules
- **Harder than main layers** — unprepared players will be destroyed
- **Must prepare strategically** — specific genelines/builds needed to counter dark realm enemies

| Dark Realm | Enemy theme | Rule it breaks |
|-----------|------------|----------------|
| 1 | Necromancy/Undead | Dead units revive, enemy uses your corpses |
| 2 | Parasite/Corruption | Takes over your units, turns them against you |
| 3 | Void/Entropy | Erases units from existence, no death effects |

### Enemy Captured Hives
Previously captured hives can be **attacked by new enemy genelines**. Player must defend or lose the hive (and its room slot).

### Random Seed
Each run generates a random seed that determines:
- Territory map layout and hive positions
- Enemy compositions per battle
- Geneline offerings as rewards
- Larva quality rolls
- Battle modes per node
- Terrain features (water, hills)
- Shop inventory and event encounters

Same seed = same run layout. Player choices differ. Enables seed sharing, daily challenges, speedruns.

### Post-Battle Rewards
After each battle, player chooses one:
- New unit (from available genelines)
- Evolve existing unit (branch choice)
- Resources (nectar, hive upgrade materials)
- Mutation scouts (for next battle)

---

## Royal Special Bar

Royal unit builds charge through army's kills. When full, unleashes a geneline ultimate ability:
- Alpha ultimate: massive army charge, all soldiers buffed
- Each geneline's Royal has a unique ultimate
- Adds timing/skill expression to Royal control

---

## Combat System

### Default Ability (auto-attack)
Every unit has a `defaultAbility` — there is NO separate basic attack system. The default ability runs through the full damage pipeline like any other ability. Most units default to a physical type (blunt or sharp):

| Physical type | Default effect | Examples |
|--------------|----------------|---------|
| **Blunt** | Knockback/stagger | Body slam, ram, crush |
| **Sharp** | Pierce (hit unit behind) | Jaws, stingers, needles |

```ts
// In UnitDef — references an ability by name
defaultAbility: 'jaw_strike'  // defined in config/combat/abilities/sharp.ts
```

### Damage Types (9)
Most default abilities are physical (blunt/sharp). Abilities can use any type:

| Type | Default effect | Category |
|------|---------------|----------|
| Blunt | Knockback, stagger | Physical |
| Sharp | Pierce through units | Physical |
| Heat | Burn DOT (high damage, short, can spread) | Elemental |
| Cold | Slow + freeze at high damage | Elemental |
| Toxic | Poison DOT (low damage, long, stacks, % HP based) | Elemental |
| Electric | Stun + chain to nearby | Elemental |
| Psychic | Fear (retreat) + confusion | Dark |
| Void | Bypass armor + erase buffs | Dark |
| Holy | Bonus vs dark types + cleanse DOT | Dark |

Bleed is NOT tied to sharp — it's a special ability on specific units only.

### Burn vs Poison (DOT differentiation)
| | Burn (heat) | Poison (toxic) |
|---|------------|---------------|
| Damage | High per tick | Low per tick |
| Duration | Short (2-3s) | Long (6-8s) |
| Stacking | No, refreshes | Yes, multiple stacks |
| Scaling | Flat damage | % of max HP |
| Spread | Can spread to nearby | Stays on target |
| Counter | Ends when duration expires | Needs cleanse |
| Strong vs | Swarms (flat damage kills low HP) | Tanks (% HP shreds high HP) |

### Resistance System
Each unit has resistance tiers per damage type. Only list types that deviate from normal:

```ts
// Grunt — slightly weak to sharp
resistance: { sharp: 'weak' }

// Legionnaire — armored beetle
resistance: { blunt: 'strong', sharp: 'strong', heat: 'weak' }

// Dark realm unit
resistance: { holy: 'weakest', void: 'strongest', psychic: 'strong' }

// Unlisted types default to 'normal'
```

### Resistance Tiers
7 tiers from weakest (most vulnerable) to strongest (most resistant):

```
weakest → weaker → weak → normal → strong → stronger → strongest
```

### Ability Tier Stats
Each ability defines its own stats per resistance tier. No global multiplier — the designer controls exactly what happens:

```ts
Ignite: {
  dmgType: 'heat',
  tiers: {
    weakest:  { damage: 100, burnDOT: 15, burnDuration: 5 },
    weaker:   { damage: 80,  burnDOT: 12, burnDuration: 4 },
    weak:     { damage: 65,  burnDOT: 10, burnDuration: 3 },
    normal:   { damage: 50,  burnDOT: 8,  burnDuration: 2 },
    strong:   { damage: 35,  burnDOT: 5,  burnDuration: 1.5 },
    stronger: { damage: 20,  burnDOT: 3,  burnDuration: 1 },
    strongest:{ damage: 10,  burnDOT: 1,  burnDuration: 0.5 },
  }
}
```

Each ability has full control over what happens at each tier — damage, DOT, duration, effect strength all independently tuned. No accidental triple-scaling from a global multiplier.

### Everything Is An Ability
No separate "basic attack" system. No "innate element" system. Everything goes through the same pipeline:

| Ability type | Trigger | Example |
|-------------|---------|---------|
| **Default ability** | Auto-attack timer | `jaw_strike` (sharp), `fire_bite` (heat) |
| **Passive ability** | Every frame / condition | `rage` (below 50% HP), `rally_aura` |
| **Death ability** | On death | `death_bomb` (AOE explosion) |
| **Hook ability** | Complex targeting/logic | `chain_lightning` (bounce targeting) |

On-hit elemental effects are hooks on the default ability, not a separate system:

```ts
// Frost Jaw — default ability is sharp, hook adds cold effect per hit
defaultAbility: 'jaw_strike'   // sharp damage through pipeline
combat: {
  afterHit(u, target) {
    applyEffect(target, 'cold', 'slow');  // hook, not innate element
  }
}
```

### Damage Pipeline
Queue-based, event-driven. All damage events are queued and resolved once per frame — no recursive resolution. See DESIGN_PATTERNS.md for full architecture.

**7 phases per event:**
```
pre_damage → calculate → resist → modify → pre_apply → apply → post_apply
```

**Per-frame flow:**
```
1. Systems queue events (queueAbility)
2. Effects tick (updateEffects — DOTs deal damage, expired effects trigger onExpire)
3. Queue drains (resolveFrame — each event runs through 7 phases)
4. Death chains, reflects, redirects queue MORE events — processed next iteration, no recursion
5. Dead units skipped automatically
```

### Resistance Cap
Maximum 'strongest' tier (no immunity). Even the highest resistance still takes some damage/effect. No unit is fully immune to any damage type.

### Penetration (high-tier units)
Exavyss+ tier units may have penetration — treats defender's resistance as one tier lower:

```
Enemy: heat resistance 'strong'
Your Yottavyss unit: has heat penetration
Effective resistance: 'normal' (one tier down)
```

---

## Visual Effect System

Separate from combat logic and unit draw functions. Combat decides what happened, visual system shows it.

**Principle:** Combat emits events → Visual system subscribes → Draws overlays on units. Unit draw functions NEVER know about effects.

### Effect Visual Registry
Maps gameplay effects to visual indicators. One file, all mappings:

| Effect | Visual type | Look |
|--------|-----------|------|
| ATK buff | Icon above unit | Red up-arrow |
| Speed buff | Icon above unit | Blue up-arrow |
| Burn | Body overlay | Orange flicker |
| Poison | Body overlay | Green pulse |
| Stun | Above unit | Stars/spiral |
| Freeze | Full overlay | Ice blue, static |
| Fear | Above unit | Purple shake |
| Marked | Above unit | Red crosshair |
| Shell intact | Outline | Grey border |
| Invulnerable | Full overlay | White shimmer |
| Linked | Line between units | Blue connection |

### Render Order
```
1. Background
2. Unit shadows
3. Unit bodies (draw functions — never modified for effects)
4. Effect overlays (EffectVisualSystem — ALL effect visuals here)
5. Particles
6. UI
```

### How it works
- EffectVisualSystem subscribes to `EFFECT_APPLIED`, `EFFECT_EXPIRED`, `MODIFIER_APPLIED`, `MODIFIER_REMOVED` events
- Reads unit's active effects and modifiers each frame
- Draws appropriate overlay on top of each unit
- Works for ALL units (player and enemy) — infected enemy shows same visual as infected ally
- Adding new effect visual = one entry in registry, no unit file changes

---

## Game Inspirations

Key references and what to take from each:

| Game | Key idea for Hivyss |
|------|-------------------|
| Swords & Soldiers | Core loop — auto-march + spells, validates base design |
| Battle Cats | Unit collection, tier upgrades, evolution forms |
| Age of War | Base evolution mid-match, turrets, age progression |
| Stick War | Direct hero control (Royal caste), worker mining |
| Kingdom: Two Crowns | Indirect control via investment (pheromone system) |
| Slay the Spire | Roguelike structure, deck building, post-battle rewards |
| Cartoon Wars | Mid-battle upgrades (mutation system) |
| Cortex Command | Brain unit concept (hive = brain) |
| King Arthur's Gold | Destructible terrain, building mid-battle |
| Aegis Defenders | Mix TD + unit spawning (Worker engineering) |
| SC2 Co-op (Zagara) | Beta geneline inspiration — swarm/expendable army |
| Noita | Iceberg design — hidden depth layers, "wait there's more" |
| Made in Abyss | Deeper = more dangerous, environmental tension |
| Path of Exile | Damage types, resistance, penetration, ailment system |
| Game Programming Patterns (Bob Nystrom) | Component pattern, event systems, damage pipeline |

---

## Implementation Priority

| Phase | Features | Description |
|-------|----------|-------------|
| 1 | Alpha geneline, hard cap, tier system | Complete all Alpha units (Vyss through Gigavyss), implement hard cap, new tier names in code |
| 2 | Battle modes, territory system | 4 battle modes (Hive vs Hive, Siege, Defense, Clash), hive capture, spire turrets |
| 3 | Beta + Gamma genelines, hive building | Layer 1 complete — swarm + fortress genelines, home hive rooms, post-battle rewards |
| 4 | Roguelike structure, seed system | 6 layers + Mid-Core + Core, random seed, territory map, enemy hive recapture |
| 5 | Caste system, pheromone system | Worker/soldier/elite/royal castes, scout pheromones (command + mutagen) |
| 6 | Evolution tree, larva quality | Unit evolution branching, weak/normal/strong larva, quality-scaled abilities |
| 7 | Mutation / Comp System | Mutagen scouts, common comps, rare unique mutated forms |
| 8 | Route system, terrain | Air/land/tunnel routes, water + hill terrain, deploy controls |
| 9 | Remaining genelines (layers 2-6) | 15 genelines for layers 2-6, balanced per layer group |
| 10 | Dark realms, Dark Core, endings | 3 dark realms, 6 dark realm genelines, Dark Core + Omega, iceberg endings |

### Future Expansions (not planned yet)
- 7 Archaic Greek letters (ϝ ϟ ϡ Ϻ Ͱ ϛ ϙ) — ancient genelines, may be added in the future
- 5 Coptic letters (Ϸ ϯ ϥ ϫ ϭ) — mystery genelines of unknown origin, may be added in the future
