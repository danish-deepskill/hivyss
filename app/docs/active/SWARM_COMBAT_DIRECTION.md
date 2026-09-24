# Swarm-Combat Direction — design capture (2026-06-13)

> **Status:** a long design conversation's output. Mostly **[PROPOSED] / [OPEN]**
> — deep-future direction, NOT built (except the Tower system, which *is* built +
> tested). Captured before context loss. Pairs with `STRATEGIC_DESIGN_SKETCH.md`
> (§12-13 node/run model) + `MARKET_RESEARCH.md` (the Hive Blight competitor).
> The throughline: **Hivyss = a *swarm-command* autobattler-roguelike — "you
> *will* a swarm, you don't micro it."** That verb is the moat.

---

## 1. Combat field — the decision [PROPOSED]

Three options weighed (perspective is a *camera*, not a *genre*):
1. **2 lanes** (current) — discrete, shallow (lanes only 24px apart → basically a
   thick single line). Channels the swarm; no flanking; least swarm-y. **Built.**
2. **1 open field, low side-view** (Stick War) — wide field, ~240px N-S band.
   *Dominated for Hivyss:* needs the same 2-D rework as #3 but reads worse for a
   big swarm (flat overlap) and differentiates less.
3. **⭐ Raised ¾ angle, side-profile *billboard* art** (SC2-ish camera, NOT a
   top-down art redraw) — **the destination.** Reads a 20-50-unit swarm clearly
   (depth-separated), best "command a swarm" hook, flanking most meaningful,
   **reuses the existing `laneDepth`/`laneDepthLerp` scale system** (no art
   redraw), Royal + pheromones shine with the overview.

**Verdict: target option 3; but PROVE THE CORE LOOP IS FUN IN 2-LANE FIRST**
(it's built, zero cost — the fun lives in the *loop*: deploy → economy → Royal →
pheromones → genelines). Only then invest the 2-D combat rework to reach #3.
**Skip #2 entirely.**

**Option 3 is NOT an RTS.** No unit-micro, no base-building, no APM. It's an
*autobattler* viewed at an RTS-ish *angle* — RTS *grandeur*, autobattler
*accessibility*. Sells to the roguelike-strategy audience, not the (declining)
RTS market.

**Metric note (verified in code):** everything is **px** ("design pixels" @ a
fixed 1280×720, Scale.FIT scales the canvas). Unit `range`/`w`/`h` are **direct
px** — *no `S` scale factor* (units/CLAUDE.md saying "scaled by S" is **stale**).
Only `SPD_MULT` (global tempo, 1.0) + `laneDepth().scale` (cosmetic render only)
modify. World 2560px wide; melee range ~14-20px; tower range 155px; hive 85px.

---

## 2. Swarm movement = ant pheromone TRAILS [PROPOSED — the standout idea]

Real ant model: **a scout leads, laying a pheromone trail (a winding road); the
army follows the trail; battle happens where leading edges meet.** This makes the
pheromone the *literal movement*, unifying the whole control identity — and
**reuses systems you already have** (scout couriers + units already deposit
fading pheromone-trail blobs).

- **Implementation = steering/flocking (boids), NOT A\* pathfinding.** The boids
  `seek` target becomes the **dynamic trail** (not "the enemy hive"). Cheaper +
  *produces* the organic tide; A\* would make rigid conga lines.
- **THE TRAP: band, not conga.** Strict trail-following = a fragile single-file
  column. Fix: **trail = the seek-route, separation = the width** → a flowing
  *band/column with mass*. Never strict single-file.
- **Trail persists + fades** → the army outlives the lead; a new lead emerges.
- **The route IS the strategy** — battlefield *location* is emergent from both
  sides' routing. Direct → mid clash; wide → flank; split → pincer.

---

## 3. Control model — command lines, not units [PROPOSED]

**You direct the LINES; units auto-follow. Per-unit drag/assign = micro = banned.**
Extend the existing tap/pheromone model (NOT drag-and-drop):
- **Tap a destination** → a scout leads the *main* trail there; brood auto-pours
  down it. (One intent — the default.)
- **"Choose a line" = WEIGHT it** — a **Charge** pheromone on a trail surges the
  swarm down it. You turn a dial on a *line*, never assign *bugs*.
- **Split a flank** = a deliberate, occasional gesture (2nd tap / drag-branch).
- **Load guardrail:** 1 main thrust = norm, 2 (pincer) = a play, **3+ = past the
  budget** — the swarm auto-fills extras; don't design a routing-board to babysit.
- Optional: **drag-to-draw-a-route** as an advanced power-move (tap-to-head stays
  the low-load default).

**Foragers = autonomous trails [PROPOSED].** Thematically yes (canonical ant
foraging), but **you do NOT command them** — the colony self-routes them
(auto-find forage + corpses, gather). Split: **soldiers = player-commanded war-
tide; foragers = self-running economy.** The gem: forager trails are **visible +
*vulnerable* supply lines** → you **defend yours / raid the enemy's** *via your
soldier-command* (real ant warfare). Corpse-scavenging extends their trails into
the kill-zone = risk/reward. At most ONE high-level "lean economy/war" lever.

**The sneak / backdoor play [PROPOSED] — already emergent.** Radius-based
engagement means a trail **routed wide (outside enemy aggro)** slips a detachment
past the clash → hits the spire/hive. Two flavors: *sneak-around* (avoid aggro;
graze an enemy → pulled in) vs *commit-through* (Charge → ignore units, rush the
structure, take hits). **Counterplay (not a free win):** detection (peel to
intercept), splitting weakens your front, and **the spire IS the anti-backdoor**
(*this retro-justifies the tower system + node-grade — a 0-spire Forage is a soft
target; a 2-spire Hive punishes it*). True-stealth (burrow→emerge) = a
**tunneler-geneline signature** (`burrowed` units already exist).

---

## 4. The Royal — positional economy + sole ability caster [PROPOSED]

**Positional economy:** the Royal's position is a continuous **tempo-vs-economy**
decision (her aura already wants the *front*; add a reason to stay *home*).
- **War-Queen (forward):** aura buffs the front line; command.
- **Brood-Queen (home):** faster incubation + larvae regen + passive income +
  **brood QUALITY** (the §4 quality-ladder gem) + a home heal.
- **Nearby (a hive-presence *zone*) vs Inside (nest off-board):** *Inside* is the
  richer toggle — a **nest→bank-a-clutch→sortie** rhythm, **safe only while the
  hive holds** (a push *forces* her out), aura absent while nested. *Nearby* keeps
  her killable at home (stops free turtling). **[OPEN] which.**
- Per-geneline lean = character (α Matriarch = war-queen; γ = brood-queen).
- **Balance knob:** the forward payoff must be *fight-winning* or "turtle the
  queen" dominates (economy + death-stakes already push her home).

**Abilities = the Royal is the SOLE caster** (the queen *is* the hive's agency;
no separate "hive caster"). The split that kills redundancy:
- **Active abilities** (cast, vyss-spent) = the **Royal's** → lost in her respawn
  window; Normal (no Royal) has *no* kit (the scrappy start).
- **Autonomic** (economy/incubation/maturation) = the *colony*, always-on.

**Kit slots:** **Presence** (passive, position-gated — *general*, + alien
exceptions) · **Spells** (the geneline's **hive abilities**, cast Clash-Royale-
style at a point — *these are literally GENELINES' `Tremor / Spore Storm / Fortify
/ Artillery`* — *specific*; life-gated, NOT position-gated) · **Ultimate**
(*specific* signature; Late-maturation). **Maturation UNLOCKS the kit** (Early =
Presence → Mid = spells → Late = ultimate) — gives maturation a reason beyond
capacity. **Pheromones command the ARMY; spells = direct field effects** (command
vs effect).

**Royal jelly** = a premium **"royal/growth" currency** (funds maturation + the
ultimate/quality). vyss = the *plays* (pheromones + spells); jelly = the *growth*.
**[OPEN]** earns the 3rd-currency slot only if kept a *scarce, slow* premium.

---

## 5. General / Shared-slot / Specific framework [PROPOSED]

Three buckets (most identity lives in the *middle*):
- **General** — same for all (forager, capacity, pheromone set, currencies,
  Presence) — rare *alien* exceptions.
- **Shared slot, geneline fill** — everyone has the slot, fills it own way
  (geneline hook, signature pheromone, **spells**, hive *body*, Elite signature).
- **Specific** — only some have it (δ elite-anchor, **hive *trait*** [attacks /
  auto-spawns / buffs], tower *types*, walls, production buildings, the Ultimate).
- **Defender caste → dropped → a "Defend" pheromone** instead (hold-position
  command; completes the vocabulary: charge/hold/retreat). γ's defensive identity
  = tanky kits + Defend, not a 5th caste.

---

## 6. Genelines = WIN-PATHS, not all combat [PROPOSED]

24 genelines = 24 *strategies*, not 24 armies (the only way 24 stay distinct;
RimWorld-validated; biologically true — a hive is *mostly* non-combat workers).
- **Every geneline wins SOMEHOW — its specialty IS its combat** (Architect →
  structures fight; Forager → bought army; Breeder → mass; Symbiont → amplify a
  host). *"The Genie wins with its engineering, not its frail bodies."*
- **The one rule:** *allow purity, forbid uselessness.* Pure specialist = fine;
  pure support (mix-only) = fine, *sparingly*; pure *nothing* = dead content.
- **Balance win-path-vs-win-path** (aggression must punish a slow economy *before*
  it scales) — **asymmetric parity**, not sameness. Watch economy snowball.
- Hivyss has NO colony-layer escape hatch (unlike RimWorld) — the specialty must
  **cash out *in a battle*.**

---

## 7. Real-colony mechanics — the autonomy filter [PROPOSED]

**Rule: take what the player WATCHES (autonomous life); reject what they MANAGE
(load). The swarm should feel alive, not be a spreadsheet.** Budget already
stressed (3 currencies, 4 castes, pheromones, genelines, towers, Royal, trails).

- **✅ TAKE (universal, autonomous, load-light):** **Alarm-rally** (auto-rally +
  enrage when the hive's hit — best pick) · **Dynamic task allocation** (workers
  auto-shift to need — *reduces* micro; + one "economy/war" lever).
- **✅ TAKE (geneline *signatures*, contained):** **Living architecture**
  (body-bridges/walls — the standout, an Architect signature) · **Fungus/aphid
  farming** (autonomous geneline economy) · **Honeypot storage** (a *unit* that
  banks → pops a burst, not a 4th currency).
- **❌ SKIP:** quorum sensing (opaque) · trophallaxis (invisible sim) · **age
  polyethism** (anti-swarm — per-unit tracking) · trail reinforcement (opacity;
  defer) · defensive balling (emerges *free* from focus-fire) · budding (post-MVP
  meta) · necrophoresis-piles (light polish on existing vyss).
- **Already echoed (validation):** corpse→vyss (necrophoresis), Swarmlord eating
  the swarm (cannibalism), royal jelly→quality (caste-by-diet), capture
  (slave-making), the Royal nest↔sortie (army-ant nomadic/stationary phases),
  trails (stigmergy).

---

## What's BUILT vs PROPOSED
- **BUILT this session (code + 654 tests):** the **Tower/buildings architecture**
  — `Structure`/`StructureEntity` bases, generic `Tower` + `drawTower` registry +
  `TowerDef` (data-driven, per-variant `crossLaneFire`), position model
  (far/near/middle), HP bar, broken state, click-to-show range ring, combat
  structure-targeting (lane-gated). Plus the **Swarmlord stack cap**. (All in the
  *sandbox*; not in real battles yet.)
- **Everything in §1-7 above is PROPOSED/OPEN** — design, not code.

## Open forks (decide before building)
1. **Combat field** — commit to option 3 (¾ semi-top-down) as the destination? +
   the "prove fun in 2-lane first" sequencing.
2. **Royal home toggle** — *nearby* (killable) vs *inside* (nest/sortie/clutch).
3. **Royal jelly** — 3rd currency, or fold into vyss?
4. **Movement rework** — extract a `sameZone(a,b)` helper (route the ~12
   lane-checks through it) so the 2-lane→open-field jump is a one-function flip.
   (Ability *data* is lane-agnostic + adapts free; only the *targeting runtime* is
   lane-coupled.)
5. Which colony mechanics make v1 vs geneline-signatures-later.
