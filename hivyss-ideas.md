# HIVE SIEGE — Game Design Document
> Version 1.0 | Status: Pre-Production

---

## Table of Contents
1. [Game Overview](#1-game-overview)
2. [Core Philosophy](#2-core-philosophy)
3. [Gameplay Format](#3-gameplay-format)
4. [The Battlefield — Three Routes](#4-the-battlefield--three-routes)
5. [The Larva Mound System](#5-the-larva-mound-system)
6. [Resource System](#6-resource-system)
7. [Unit Roster](#7-unit-roster)
8. [Mutation System](#8-mutation-system)
9. [Status Effects](#9-status-effects)
10. [Terrain & Environmental Hazards](#10-terrain--environmental-hazards)
11. [Pheromone Signal System](#11-pheromone-signal-system)
12. [Worker Bug System](#12-worker-bug-system)
13. [Enemy Design](#13-enemy-design)
14. [Boss Design](#14-boss-design)
15. [Game Modes](#15-game-modes)
16. [Meta Progression](#16-meta-progression)
17. [Technical Stack](#17-technical-stack)
18. [Project Architecture](#18-project-architecture)
19. [Release Roadmap](#19-release-roadmap)
20. [Design Rules](#20-design-rules)

---

## 1. Game Overview

**Game Name:** Hive Siege
**Genre:** Lane Defense / Lite RTS Hybrid
**Platform:** Browser (Phaser 3 + Vite) → Mobile via Capacitor
**Engine:** Phaser 3.88, TypeScript, Vite
**Target Audience:** Mid-core mobile gamers, fans of Battle Cats, casual StarCraft/Zerg fans
**Strategy Depth:** Medium — meaningful decisions without overwhelming complexity

### Elevator Pitch
> *"A bug colony lane defense game where you can't just deploy units — you have to grow them first. Time your incubation right or your army arrives too late."*

### Inspiration
- **Battle Cats** — core lane defense loop, single lane, unit cost economy
- **StarCraft 2 Zerg** — biological theme, larva system, worker economy, mutation
- **Plants vs Zombies** — accessible strategy, map variety, clear unit roles

### What Makes Hive Siege Unique
| Mechanic | No Other Game Does This |
|----------|------------------------|
| Larva Mound incubation system | Units must gestate before deploying |
| Three biologically distinct routes | Air / Land / Tunnel — not parallel copies |
| Mutation system | Units evolve into stronger versions mid-battle |
| Worker bug economy | Separate worker roster collecting resources on the map |
| Pheromone Signal commands | One-button real-time command layer |

---

## 2. Core Philosophy

### Design Pillars
1. **Prediction over Reaction** — Incubation timers reward players who anticipate, not just react
2. **Biology as Mechanics** — Every system should feel like real insect colony behavior
3. **Medium Strategy** — Deep enough for veterans, accessible enough for newcomers
4. **Progressive Disclosure** — Complexity introduced gradually, never all at once

### The Design Rule
Before adding any feature, ask three questions:
1. Does it make decisions more **interesting** or just more **complicated**?
2. What does a **new player** feel the first time they encounter this?
3. What does a **veteran player** feel after 20 hours with this?

### The Uniqueness Test
Before implementing any mechanic ask:
> *"Does any other game do this?"*
- **Yes** → Can I twist it enough to make it mine?
- **No** → Protect it, build around it, make it the star

---

## 3. Gameplay Format

### Core Loop
```
Earn Nectar (passive trickle + worker collection)
    ↓
Queue units in Larva Mound chambers
    ↓
Units incubate over time (variable gestation per tier)
    ↓
Units auto-deploy to their route when ready
    ↓
Units push toward enemy base, fighting on their route
    ↓
Destroy enemy base to win
```

### Single Lane Structure
Like Battle Cats — one horizontal battlefield per route. Units auto-walk toward the enemy base and attack whatever is in range. Player does not control units directly after deployment.

### Victory / Defeat Conditions
- **Win** — Destroy the enemy base on any route combination
- **Lose** — Enemy destroys your base

---

## 4. The Battlefield — Three Routes

The battlefield has three parallel horizontal routes stacked vertically on screen. Each route is a separate lane with its own units, enemies, and terrain.

```
┌─────────────────────────────────────────────┐
│  ✈ AIR ROUTE      [your units → → →] [enemies]  │
├─────────────────────────────────────────────┤
│  🌿 LAND ROUTE    [your units → → →] [enemies]  │
├─────────────────────────────────────────────┤
│  ⛏ TUNNEL ROUTE  [your units → → →] [enemies]  │
└─────────────────────────────────────────────┘
```

### Route Rules
- Units only attack and are attacked by enemies **on the same route**
- Units auto-assign to their route based on their biology — no player routing needed
- Some high-tier or mutated units may be cross-route capable

### Route Assignment by Biology
| Route | Unit Type | Examples |
|-------|-----------|---------|
| Air | Flying insects | Hornet, Zephyr, Voltfly |
| Land | Ground insects | Scarab, Mandible, Guardian, Ember |
| Tunnel | Burrowing insects | Digger + tunnel-specific units |

### Why Three Routes Works
- Players choose **which units** to deploy — route is baked into unit identity
- Strategic question becomes: *"My air route is overwhelmed — what air units do I need?"*
- Naturally rewards balanced army building across all three routes
- Visually exciting — screen is alive with activity on all layers

---

## 5. The Larva Mound System

**The most original mechanic in Hive Siege. Protect it.**

### Overview
The Larva Mound replaces the traditional "instant deploy" slot system. Instead of deploying units instantly, players queue units into incubation chambers. Units gestate over time then auto-deploy to their route when ready.

```
[🥚 Hornet 8s] [🥚 Scarab 12s] [🥚 ........] [🥚 ........] [🥚 ........] [🥚 ........]
                        Larva Mound — 6 Chambers
```

### How It Works
1. Player selects a unit from the deploy menu
2. Unit enters an empty Larva Mound chamber — Nectar is spent immediately
3. Incubation timer counts down (variable per unit tier)
4. Unit auto-deploys to its route when timer hits zero
5. Chamber becomes available for next unit

### Incubation Times by Tier
| Tier | Process Time | Design Intent |
|------|-------------|---------------|
| F | 3s | Spammable, near-instant |
| E | 6s | Quick but not instant |
| D | 10s | Requires moderate planning |
| C | 15s | Meaningful commitment |
| B | 20s | Significant investment |
| A | 28s | Rare and deliberate |
| S | 38s | High stakes deployment |
| SS | 50s | Strategic centerpiece |
| SSS | 65s | Game-defining decision |
| X | 90s | Ultimate commitment |

### Larva Mound Chambers
- Players start with **6 chambers**
- Chambers unlock through meta progression
- Full chambers force players to choose — cancel a unit or wait
- **Cancelling** refunds 50% Nectar — costly but possible

### Strategic Depth Created
| Situation | Decision |
|-----------|---------|
| Big wave incoming in 10s | Is it too late to incubate? |
| All chambers full | Cancel slow unit to rush a fast one? |
| Low economy | Cheap fast units or save for slow expensive one? |
| Multiple routes threatened | Split chambers or focus one route? |

### Hybrid Mutation Trigger (see Section 8)
While incubating, units have a small passive chance to emerge already mutated — a rare surprise reward for attentive players.

---

## 6. Resource System

### Three Resources
| Resource | Icon | Purpose | How Earned |
|----------|------|---------|-----------|
| **Nectar** | 🍃 | Deploy units, queue incubation | Passive trickle + worker collection |
| **Ichor** | 🧪 | Activate mutations, Pheromone Signals | Earned by killing enemies |
| **Resin** | 🪨 | Meta upgrades between sessions | Earned completing levels |

### Nectar Economy
- Trickles passively over time — base rate increases with meta upgrades
- Worker bugs collect bonus Nectar from map nodes (V2)
- Spending Nectar is immediate — unit enters Larva Mound at cost

### Ichor Economy
- Earned per enemy kill — scales with enemy tier
- Spent on Mutation Catalysts and Pheromone Signals
- Creates pressure: save for mutation or spend on signals?

### Resin Economy
- Persistent between sessions — never lost
- Spent in Colony Research meta progression tree
- Cannot be earned mid-battle

---

## 7. Unit Roster

### Tier System
10 tiers from F (weakest) to X (legendary):
`F → E → D → C → B → A → S → SS → SSS → X`

### Design Intent Per Tier
| Tier | Role | Design Philosophy |
|------|------|-----------------|
| F–E | Fodder / Early game | Always useful as cheap spam, never obsolete |
| D–C | Specialist units | Real abilities, meaningful choices |
| B–A | Rare powerful | Strong synergies, hard to obtain |
| S–SS | Game-changing | Fight-defining abilities |
| SSS | Near-broken | Powerful but costly commitments |
| X | One of a kind | Breaks a rule other units follow |

### Current Unit Roster (V1)

#### F Tier
**Grub** | Route: Land
- HP: 55 | ATK: 12 | Speed: 1.6 | Range: 20 | ATK Rate: 1.1/s | Cost: 15🍃
- Ability: None — pure fodder
- Strategy: Spam early to stall enemies. Meat shield for backline units.
- Mutation: Soldier Grub — gains 25% HP and deals 5 damage on death

---

#### E Tier
**Mandible** | Route: Land
- HP: 140 | ATK: 32 | Speed: 1.2 | Range: 22 | ATK Rate: 0.9/s | Cost: 40🍃
- Ability: None — balanced all-rounder
- Strategy: Bread-and-butter frontline fighter. Cost-efficient and reliable.
- Mutation: Alpha Mandible — +30% ATK, attacks slow enemy movement speed by 20%

**Bombardier** | Route: Land
- HP: 110 | ATK: 28 | Speed: 1.4 | Range: 22 | ATK Rate: 0.85/s | Cost: 40🍃
- Ability: Area Attack — hits ALL enemies in range. Explodes for 35 damage on death.
- Strategy: Devastating against packed waves. Dying is useful.
- Mutation: Mega Bombardier — explosion radius doubles, stuns nearby enemies for 1s

**Zephyr** | Route: Air
- HP: 40 | ATK: 20 | Speed: 3.5 | Range: 18 | ATK Rate: 1.2/s | Cost: 40🍃
- Ability: None — pure speed
- Strategy: Rush unit. Harasses ranged backline. Glass cannon.
- Mutation: Storm Zephyr — gains 15 HP, leaves a lightning trail damaging following enemies

---

#### D Tier
**Locust** | Route: Air
- HP: 75 | ATK: 42 | Speed: 0.9 | Range: 90 | ATK Rate: 0.75/s | Cost: 50🍃
- Ability: Ranged attack
- Strategy: Place behind air melee units. Pairs well with Guardian aura.
- Mutation: Plague Locust — ranged attacks now apply 3s poison on hit

**Aphid** | Route: Land
- HP: 120 | ATK: 8 | Speed: 0.8 | Range: 60 | ATK Rate: 0.6/s | Cost: 50🍃
- Ability: Heal — every 2s heals nearest wounded ally for 20 HP
- Strategy: Deploy behind frontline. Keeps tanks alive significantly longer.
- Mutation: Queen's Aphid — heals 35 HP every 2s, also cleanses one status effect per heal

**Digger** | Route: Tunnel
- HP: 100 | ATK: 25 | Speed: 2.5 | Range: 20 | ATK Rate: 1.0/s | Cost: 55🍃
- Ability: Burrow — untargetable for 2s on spawn, moves 1.5x faster, surfaces behind enemy frontline
- Strategy: Bypasses frontline to attack squishy backline units. Surprise factor is key.
- Mutation: Deep Digger — burrow duration extends to 4s, surfaces with a shockwave stunning nearby enemies

**Ember** | Route: Land
- HP: 80 | ATK: 40 | Speed: 1.3 | Range: 30 | ATK Rate: 0.8/s | Cost: 65🍃
- Ability: Burn AOE — spreads burn to 3 nearby enemies. 4 dmg/0.5s for 8s (64 total). Refreshes on re-hit, doesn't stack.
- Strategy: Incredible against clumped enemies. Burn continues after Ember dies.
- Mutation: Inferno Ember — burn spreads to 5 targets, burn damage increases to 6/0.5s

**Guardian** | Route: Land
- HP: 300 | ATK: 15 | Speed: 0.7 | Range: 25 | ATK Rate: 0.5/s | Cost: 70🍃
- Ability: Damage Aura — all allies within range take 20% less damage
- Strategy: Ultimate support tank. Place in army center.
- Mutation: Ancient Guardian — aura expands, damage reduction increases to 30%

**Hornet** | Route: Air
- HP: 140 | ATK: 55 (up to 110) | Speed: 2.2 | Range: 20 | ATK Rate: 1.3/s | Cost: 100🍃
- Ability: Berserk — below 50% HP: 1.5x ATK (82). Below 25% HP: 2x ATK (110)
- Strategy: Fast and deadly. Send in groups. Pairs with Aphid to hover in rage zone.
- Mutation: Inferno Hornet — Berserk activates at 70% HP, gains fire trail on movement

**Scarab** | Route: Land
- HP: 400 | ATK: 18 | Speed: 0.6 | Range: 26 | ATK Rate: 0.5/s | Cost: 85🍃
- Ability: None — pure bulk
- Strategy: Premier tank. Deploy first. With Guardian + Aphid = nearly unkillable.
- Mutation: Ancient Scarab — gains 25% HP, reflects 10% of damage taken back to attacker

---

#### C Tier
**Mantis** | Route: Land
- HP: 100 | ATK: 120 | Speed: 0.3 | Range: 200 | ATK Rate: 0.25/s | Cost: 85🍃
- Ability: Piercing Shot — hits 2 enemies in line. First: full damage. Second: 50%.
- Strategy: Highest single-hit damage. Needs strong frontline protection.
- Mutation: Death Mantis — pierces 3 enemies, third target takes 25% damage

**Rhino** | Route: Land
- HP: 280 | ATK: 45 | Speed: 1.0 | Range: 24 | ATK Rate: 0.7/s | Cost: 95🍃
- Ability: Knockback — rams target backward. Staggered enemies can't move or attack while sliding.
- Strategy: Crowd control king. Stunlocks single targets. Great against slow heavies.
- Mutation: Iron Rhino — knockback distance doubles, knockback has 30% chance to knock adjacent enemies too

**Beetle** | Route: Land (Ranged)
- HP: 450 | ATK: 30 | Speed: 0.7 | Range: 55 | ATK Rate: 0.55/s | Cost: 120🍃
- Ability: Shield + Poison — 50% damage reduction for first 3s after spawn. Attacks apply 5 dmg/s poison for 3s.
- Strategy: Tankiest offensive unit. Spawn shield absorbs initial burst.
- Mutation: Plague Beetle — poison duration extends to 6s, poison spreads to adjacent enemies on expiry

---

#### B Tier
**Voltfly** | Route: Air
- HP: 240 | ATK: 55 | Speed: 1.1 | Range: 85 | ATK Rate: 0.8/s | Cost: 130🍃
- Ability: Chain Lightning — chains to 3 enemies (100%/70%/40%). 25% stun chance per target for 0.6s. Every 4th attack: Overcharge (2x damage).
- Strategy: Best against swarms. Chain melts groups. Stun locks multiple targets.
- Mutation: Storm Voltfly — chains to 5 enemies, stun chance increases to 40%, Overcharge every 3rd attack

---

### Unit Design Rules
- Lower tier units must **always have utility** — never completely obsolete
- Each unit should have a clear **one-sentence identity**
- Every unit should answer: *"Why would I deploy this instead of something stronger?"*
- F/E tier answer: cost efficiency and speed of incubation

---

## 8. Mutation System

**Second most original mechanic. One mutation stage per unit — clean and decisive.**

### Core Concept
Units can evolve into a stronger version of themselves. Same unit identity, enhanced stats and upgraded ability. Not a new unit — a better version of the same unit.

### What Mutation Changes
```typescript
interface UnitMutation {
  name: string                    // e.g. "Inferno Hornet"
  statMultipliers: {
    hp?: number                   // e.g. 1.2 = +20% HP
    atk?: number
    speed?: number
    atkRate?: number
  }
  abilityUpgrade: {
    type: 'enhance' | 'add'
    description: string
  }
  visual: 'color_shift' | 'size_up' | 'glow' | 'particle'
}
```

### Activation — Hybrid Model

**Passive chance (Lucky)**
While incubating in Larva Mound, small random chance unit emerges already mutated:
```
Incubating Hornet → 8% chance per second → Emerges as Inferno Hornet
"Your Hornet emerged mutated!"
```
Rare, exciting, never guaranteed. Rewards attentive players.

**Active Catalyst (Strategic)**
After deploying, spend Ichor to force mutation immediately:
```
Deploy Hornet → Spend 40 Ichor → Instantly becomes Inferno Hornet
```
Reliable but expensive. Player controlled timing. Creates meaningful Ichor decision.

### Catalyst Cost
| Unit Tier | Catalyst Cost |
|-----------|-------------|
| F | 15 Ichor |
| E | 25 Ichor |
| D | 40 Ichor |
| C | 60 Ichor |
| B | 85 Ichor |
| A+ | 120+ Ichor |

### Design Rules
- Same unit type cannot mutate into itself repeatedly
- Mutated units cannot mutate again
- Some pure-tank units (Scarab) mutate less dramatically — mostly stat increases
- Mutation is permanent for the battle — no reverting

### Content Scale
```
15 units × 1 mutation each = 15 mutations to design
Feasible for solo developer
```

---

## 9. Status Effects

**V1 launches with maximum 3 status effects. Expand in V2+.**

### V1 Status Effects
| Status | Source | Effect | Duration |
|--------|--------|--------|---------|
| **Burn** 🔥 | Ember | 4 dmg/0.5s | 8s (refreshable) |
| **Poison** ☠️ | Beetle | 5 dmg/s | 3s (stackable source) |
| **Stun** ⚡ | Voltfly | Can't move or attack | 0.6s |

### Status Rules
- Burn refreshes on re-hit but doesn't stack (multiple Embers = longer burn, same intensity)
- Poison from Beetle applies per hit
- Stun is brief but chain-stun from Voltfly can lock multiple targets

### Future Status Effects (V2+)
- **Wet** — increases chain lightning range, reduces burn duration
- **Frozen** — doubles knockback distance, shatters for bonus damage
- **Blind** — reduces enemy attack range by 50%

### Status Interaction Vision (V3+)
```
Burn + Wet = Extinguished (burn cancelled, steam cloud briefly blocks vision)
Wet + Voltfly = Extended chain (lightning jumps to 5 targets instead of 3)
Frozen + Rhino knockback = Shatter (bonus AOE damage on impact)
Poison + Burn = Toxic Blaze (double DOT, new visual)
```

---

## 10. Terrain & Environmental Hazards

### Philosophy
Terrain adds complexity **through level design** not new systems. Each map can have unique challenges without adding permanent new mechanics.

### V1 Terrain Types (Maximum 2 per map at launch)
| Terrain | Effect | Route |
|---------|--------|-------|
| **Mud Patch** | Units moving through are slowed 40% | Land |
| **Choke Point** | Narrow section — units bunch together | Land/Tunnel |
| **Burrow Zone** | Digger stays burrowed 2x longer | Tunnel |
| **Wind Zone** | Pushes units forward or backward | Air |
| **Hazard Tile** | Fire/acid patches dealing damage | Any |

### V2+ Terrain Types
| Terrain | Effect | Biological Logic |
|---------|--------|-----------------|
| **Lake** | Non-swimmers reroute through tunnel | Bugs navigate around water |
| **Fire Zone** | Fire-resistant units cross freely | Some bugs flame-resistant |
| **Electrified Ground** | Air units bypass, ground units take damage | Elevation advantage |
| **Cave Section** | Air units forced to land route temporarily | Ceiling blocks flight |

### Terrain Traits on Units (V2)
```typescript
interface TerrainTraits {
  canSwim?: boolean          // crosses lakes without rerouting
  fireResistant?: boolean    // crosses fire zones safely
  amphibious?: boolean       // switches between water/land freely
}
```

### Map Terrain Puzzle Design
Each map terrain combination creates a strategic puzzle:
> *"Given this terrain, which units in my roster handle it best?"*

This rewards roster knowledge and map reading without adding UI complexity.

---

## 11. Pheromone Signal System

**Real-time command layer without micromanagement. One button, big impact.**

### Overview
Once per wave, player can send a chemical signal to all deployed units simultaneously. Thematically authentic — insects communicate through pheromones.

### Signal Types
| Signal | Effect | Duration | Ichor Cost |
|--------|--------|---------|-----------|
| 🔴 **Aggression** | All units +30% ATK, -20% defense | 8s | 20 |
| 🔵 **Retreat** | All units move backward temporarily | 5s | 15 |
| 🟡 **Defend** | All units stop advancing, form defensive line | Until cancelled | 10 |
| 🟢 **Scatter** | Units spread across all routes simultaneously | 3s | 25 |

### Design Intent
- Adds skill expression without requiring precise micromanagement
- Spending Ichor on signals competes with Mutation Catalyst spending
- Once per wave limit prevents spam — timing matters
- Retreat signal is uniquely powerful in a lane defense game — no other game lets you pull back

---

## 12. Worker Bug System

**(V2 Feature — do not build in V1)**

### Overview
Workers are a parallel roster alongside combat units. Same tier system, same depth, different purpose. They collect resources from map nodes and return to base.

```
Your Base ←→ Worker Bug ←→ Resource Node (on map)
```

### Worker Roles
| Role | Purpose |
|------|---------|
| Collector | Gathers resources from nodes |
| Carrier | Transports larger amounts back |
| Scout | Reveals hidden resource nodes |
| Guard | Protects other workers from enemies |
| Processor | Converts one resource type to another |

### Worker Stats
```typescript
interface WorkerData extends UnitData {
  carryCapacity: number
  collectSpeed: number
  returnSpeed: number
  resourceAffinity?: ResourceType
  processingRate?: number
  evasion?: number
  guardRadius?: number
  revealRadius?: number
}
```

### Strategic Tension
The 10 slot equivalent creates real decisions:
```
More workers = faster economy, weaker combat army
More fighters = stronger push, slower economy
```

### V2 Worker Roster (Draft)
| Tier | Unit | Special |
|------|------|---------|
| F | Larva Worker | Basic collector, very slow |
| E | Ant Carrier | 2x carry capacity |
| E | Termite Scout | Reveals resource nodes, carries nothing |
| D | Beetle Porter | 50% damage reduction, survives enemy territory |
| D | Weevil Processor | Converts Chitin → Ichor at base |
| C | Firefly Scout | Reveals entire map section |
| C | Dung Beetle Carrier | 5x carry capacity, tankiest worker |
| B | Silk Spinner | Builds temporary bridges over water terrain |
| A | Queen's Attendant | Passive Nectar generation at base |

---

## 13. Enemy Design

### Enemy Route Assignment
Enemies mirror player units — air enemies on air route, land on land, tunnel on tunnel. Players must cover all three routes or enemy units reach base unopposed.

### Enemy Behavior Variety (V1)
| Type | Behavior |
|------|---------|
| Standard | Walk forward and attack |
| Ranged | Stop at range and attack |
| Rusher | Fast but fragile — reaches base quickly |
| Tank | Slow, massive HP |
| Spawner | Periodically produces weak adds |

### Enemy Behavior (V2+)
| Type | Behavior |
|------|---------|
| Burrower | Surfaces behind player frontline |
| Shield Bearer | Protects units behind it |
| Kamikaze | Explodes on death |
| Healer | Restores nearby enemy HP |
| Route Switcher | Changes routes mid-battle |

### Wave Preview Scouting
Players see incoming wave composition before it arrives. Scouting units extend this preview window:

| Condition | Preview Time |
|-----------|-------------|
| No scout | 8s before arrival |
| Scout unit deployed | 20s before arrival |
| Mutated scout | 30s before arrival |

This synergizes directly with incubation timers — more preview time = better preparation.

---

## 14. Boss Design

### Design Philosophy
Each boss specifically tests a different player capability. They should feel like a puzzle, not just a health sponge.

### V1 Bosses

**Queen** (Wave 10)
| HP | ATK | Speed | Trait |
|----|-----|-------|-------|
| 1800 | 35 | 0.24 | Standard Boss |

- Tests: Sustained DPS output
- Strategy: Pure damage race — tank and spank
- Weak to: Burn, Poison stacking

**General** (Wave 20)
| HP | ATK | Speed | Trait |
|----|-----|-------|-------|
| 3500 | 50 | 0.21 | Summon |

- Spawns 2 Mandible units every 8 seconds
- Tests: Economy management — can you handle adds while damaging boss?
- Strategy: Prioritize add control or burn boss fast
- Weak to: AOE abilities, Bombardier

**Empress** (Wave 30)
| HP | ATK | Speed | Trait |
|----|-----|-------|-------|
| 6000 | 65 | 0.18 | Regeneration |

- Regenerates 20 HP every second
- Tests: Burst damage — sustained DPS can't keep up with regen
- Strategy: Save Mutation Catalysts and Pheromone Aggression signals for coordinated burst
- Weak to: Mantis Piercing Shot, Voltfly Overcharge

### Future Boss Design Principles (V2+)
- Bosses with multiple phases that change behavior at HP thresholds
- Bosses that interact with terrain (boss that floods the land route)
- Bosses that specifically counter common unit types — forcing roster adaptation
- Cross-route bosses that threaten all three lanes simultaneously

---

## 15. Game Modes

### Campaign Mode
- Handcrafted levels with specific enemy compositions
- Teaches mechanics gradually through designed encounters
- Clear win conditions and completion rewards (Resin)
- Each world introduces new mechanics or terrain types

**Progressive Disclosure Schedule:**
| Levels | Feature Introduced |
|--------|-------------------|
| 1–3 | Land route only, basic combat |
| 4–5 | Incubation timers introduced |
| 6–7 | Air route unlocked |
| 8–9 | Terrain hazards introduced |
| 10 | Tunnel route unlocked + Queen boss |
| 11–15 | Status effects, full complexity |
| 20 | General boss |
| 30 | Empress boss |

### Survival Mode (Endless Siege)
- Infinite waves of escalating difficulty
- Worker economy and upgrade/replace decisions matter more
- Leaderboard — how far did you get?
- Wave mutators every 10 waves (V2+):
  - *"All enemies have 50% burn resistance"*
  - *"Enemy movement speed +20% this wave"*
  - *"Bounty target: kill the marked enemy for bonus Ichor"*

---

## 16. Meta Progression

### Colony Research Tree
Persistent upgrades purchased with Resin between sessions:

| Category | Example Upgrades |
|----------|-----------------|
| Economy | Nectar trickle rate, starting Nectar, Ichor per kill |
| Larva Mound | Additional chambers, reduced incubation times |
| Combat | Unit-specific stat boosts |
| Mutation | Reduced Catalyst costs, increased passive mutation chance |
| Workers (V2) | Worker speed, carry capacity, node spawn rate |

### Unit Unlock System
- F/E tier units available from start
- D tier units unlock through campaign progression
- C/B tier units unlock through Resin spending or campaign milestones
- A+ tier units unlock through deep progression — rare and exciting

---

## 17. Technical Stack

### Core Technologies
| Tool | Purpose |
|------|---------|
| **Phaser 3.88** | Game engine |
| **TypeScript** | Type safety across complex data structures |
| **Vite** | Bundler — fastest dev experience for Phaser |
| **Capacitor** | Wrap for iOS/Android mobile release |

### Development Tools
| Tool | Purpose |
|------|---------|
| **VS Code** | Editor |
| **Claude Code** | AI pair programming |
| **ESLint + Prettier** | Code quality |
| **Git + GitHub** | Version control |

### Asset Tools
| Tool | Purpose |
|------|---------|
| **Aseprite** | Pixel art sprites |
| **TexturePacker** | Sprite atlas packing for Phaser performance |
| **Tiled** | Level/terrain map editor (Phaser native integration) |
| **Suno.ai** | Background music generation |
| **Bfxr** | Sound effect generation |

### Phaser Setup Notes
- Always read docs at `https://newdocs.phaser.io/docs/3.88.0` before generating code
- Use Arcade Physics — simple, fast, perfect for lane defense
- Use prototype with Graphics API first (colored shapes), replace with sprites later
- Object pooling critical for performance with many units

---

## 18. Project Architecture

### Folder Structure
```
hive-siege/
├── public/assets/
│   ├── audio/bgm/
│   ├── audio/sfx/
│   ├── images/units/
│   ├── images/terrain/
│   └── images/ui/
├── src/
│   ├── main.ts                    # Entry point, Phaser config
│   ├── config/
│   │   ├── GameConfig.ts          # Phaser game config
│   │   ├── BalanceConfig.ts       # All tuning values
│   │   └── Constants.ts           # Global constants
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── PreloadScene.ts
│   │   ├── MainMenuScene.ts
│   │   ├── GameScene.ts           # Core gameplay
│   │   ├── UIScene.ts             # HUD overlay
│   │   ├── PauseScene.ts
│   │   └── GameOverScene.ts
│   ├── systems/
│   │   ├── WaveSystem.ts          # Wave spawning
│   │   ├── EconomySystem.ts       # Nectar/Ichor management
│   │   ├── RouteSystem.ts         # Air/Land/Tunnel management
│   │   ├── StatusSystem.ts        # Burn/Poison/Stun
│   │   ├── MutationSystem.ts      # Mutation logic
│   │   ├── AbilitySystem.ts       # Active ability management
│   │   ├── CollisionSystem.ts     # Hit detection per route
│   │   └── ProgressionSystem.ts   # Meta progression
│   ├── entities/
│   │   ├── base/
│   │   │   ├── Unit.ts            # Base unit class (ALL units use this)
│   │   │   ├── Enemy.ts           # Base enemy class
│   │   │   └── Projectile.ts      # Base projectile class
│   │   ├── units/
│   │   │   ├── air/               # Hornet, Zephyr, Voltfly...
│   │   │   ├── land/              # Scarab, Guardian, Ember...
│   │   │   └── tunnel/            # Digger...
│   │   ├── enemies/
│   │   │   ├── air/
│   │   │   ├── land/
│   │   │   └── tunnel/
│   │   └── bosses/
│   │       ├── Queen.ts
│   │       ├── General.ts
│   │       └── Empress.ts
│   ├── data/                      # Pure data — no logic
│   │   ├── units/
│   │   │   ├── land.ts            # All land unit stats
│   │   │   ├── air.ts
│   │   │   └── tunnel.ts
│   │   ├── enemies/
│   │   ├── waves/
│   │   │   ├── campaign/
│   │   │   └── survival/
│   │   ├── mutations.ts           # All mutation definitions
│   │   ├── abilities.ts           # All ability definitions
│   │   └── statusEffects.ts
│   ├── ui/
│   │   ├── HUD.ts
│   │   ├── LarvaMound.ts          # Larva Mound UI
│   │   ├── HealthBar.ts
│   │   ├── RouteIndicator.ts
│   │   ├── EconomyDisplay.ts
│   │   └── SignalButton.ts        # Pheromone Signal UI
│   ├── managers/
│   │   ├── AudioManager.ts
│   │   ├── SaveManager.ts
│   │   ├── PoolManager.ts         # Object pooling — critical for performance
│   │   └── EventManager.ts        # Global event bus
│   ├── types/
│   │   ├── Unit.types.ts
│   │   ├── Enemy.types.ts
│   │   ├── Mutation.types.ts
│   │   ├── Ability.types.ts
│   │   ├── Status.types.ts
│   │   ├── Wave.types.ts
│   │   └── Save.types.ts
│   └── utils/
│       ├── MathUtils.ts
│       ├── RouteUtils.ts
│       ├── StatusUtils.ts
│       └── DebugUtils.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Data-Driven Architecture (Critical for 100+ units)
Units are data objects, not individual classes. Adding a new unit = adding one object to a data array. No new files, no new classes.

```typescript
// data/units/land.ts — ALL land units in one file
export const LAND_UNITS: UnitData[] = [
  {
    id: 'scarab',
    name: 'Scarab',
    tier: 'D',
    route: 'land',
    stats: { hp: 400, atk: 18, speed: 0.6, range: 26, atkRate: 0.5, cost: 85 },
    abilityIds: [],
    mutationId: 'ancient_scarab'
  },
  // ... all other land units
]
```

### Build Order
1. `types/` — define interfaces first
2. `data/` — populate unit and mutation data
3. `main.ts` + `scenes/` — get Phaser running
4. `entities/base/Unit.ts` — one class handles all units
5. `systems/RouteSystem.ts` — core three-route mechanic
6. `systems/EconomySystem.ts` — Nectar loop
7. `ui/LarvaMound.ts` — incubation UI
8. `systems/WaveSystem.ts` — enemy spawning
9. Everything else builds on top

---

## 19. Release Roadmap

### V1 — Launch: The Core Siege
**Goal:** Get players hooked on the core loop
- Three routes (Air/Land/Tunnel)
- 15–20 units across F→B tier
- Larva Mound incubation system
- Nectar economy (passive trickle only)
- 3 status effects (Burn, Poison, Stun)
- 10 campaign levels with progressive disclosure
- Survival mode
- 3 bosses (Queen, General, Empress)
- Basic terrain hazards (mud, choke points)
- Mutation system (Stage 1, Hybrid activation)
- Pheromone Signal system

### V2 — The Worker Economy
**Goal:** Add economic depth and second objective
- Worker bug system and worker roster
- Resource nodes on maps
- Nectar + Ichor dual resource mid-battle
- Active Pheromone Signal system (if not in V1)
- Wave mutators for Survival mode
- 10 new campaign levels

### V3 — The Fortification Update
**Goal:** Add strategic defensive layer
- Building system (walls, turrets)
- Resin resource integration
- Water terrain maps
- Formation synergies
- Advanced status interactions

### V4 — The Great Swarm
**Goal:** Content expansion, deepen progression
- A + S tier units
- Metamorphosis/evolution for workers
- 50+ total units
- New boss phase mechanics
- Endless Siege mutator expansion

### V5 — The Deep Hive
**Goal:** Veteran-level depth
- SS + SSS tier units
- Full status interaction system
- Colony Research tree expansion
- Unit relationship bonuses
- 100+ total units

### V6 — The X Factor
**Goal:** Endgame and community
- X tier units
- Advanced terrain types
- PvP mode
- Seasonal events
- Full worker roster

---

## 20. Design Rules

### The Feature Impact Test
Before adding any feature, critique its effect on user experience:
1. Does it make decisions **interesting** or just **complicated**?
2. What does a **new player** feel first time they see this?
3. What does a **veteran** feel after 20 hours?
4. Does it lead with a **positive feeling** when triggered?

### The Uniqueness Filter
> *"Does any other game do this?"*
If yes — twist it. If no — protect it.

### The Scope Protector
> *"Is this V1 or is this a roadmap feature?"*
Every feature that isn't core to the incubation/three-route loop belongs on the roadmap, not in V1.

### The One Sentence Test
Every mechanic should be describable in one sentence that makes someone say *"wait, really? that's cool."*
- ✅ *"You have to grow your units before they deploy"*
- ✅ *"Your bug might randomly mutate during incubation"*
- ❌ *"You manage resources and deploy units"* — too generic

### Core Uniqueness to Protect
These are Hive Siege's identity. Never compromise them:
1. **Larva Mound incubation** — no instant deployment ever
2. **Three biologically distinct routes** — not identical parallel lanes
3. **Mutation as evolution** — same unit, better version
4. **Bug colony fantasy** — everything should feel like insect behavior

---

*Document maintained by: [Your Name]*
*Last updated: 2026*
*Game: Hive Siege | Engine: Phaser 3.88 + TypeScript + Vite*
