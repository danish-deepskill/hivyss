# Strategic / World Design — conversation capture (2026-06-12)

> **What this is:** the design thinking from a long strategic-layer + world
> conversation, so it isn't lost. **Mostly DEEP-FUTURE / post-MVP** (the
> strategic layer, deep genelines, realms). Status tags: **[LOCKED]** decided ·
> **[PROPOSED]** coherent, tune when built · **[OPEN]** unresolved fork.
> Cross-refs: `GENELINES.md §1.0` (reservations), `VISION §5` (mix-roster),
> `DARK_REALM_SKETCH.md` (Beth/Vyss), `lore/WORLDBUILDING_PRINCIPLES.md`.

---

## 1. Caste model — the three are different *verbs*, not power tiers

- **[PROPOSED — corrected 2026-06-12, amends `HIVYSS §8`]** Caste = **control
  paradigm + a power-premium** — the two rise together. Tier and caste are still
  different AXES (a cheap T0 Elite or a complex T3 Soldier can exist), BUT
  **within a tier, caste RANK carries a power-premium**: a T2 Elite is
  **stronger than** a T2 Soldier (rarer, costlier — it has the soldier's combat
  PLUS a signature, a force-multiplier aura, and **smarter AI**: reads the lane,
  prioritizes high-value targets, coordinates). The Royal is the **apex**
  (strongest + full drive). So higher caste = more control AND more power — NOT
  "equal but different." (The docs' "same complexity *budget*" = same mechanical
  *sophistication* level, not same *power*.)
- **[LOCKED]** The **self-vs-ally rule** (`GENELINES §2`): **Soldiers are
  self-affecting** (fight for themselves); **ally-affecting power is T4+ → lives
  in the Elite**. So an Elite is a **force-multiplier**, not a stronger soldier.
- **[PROPOSED]** The relationship that makes Elites *feel* distinct: **Soldier =
  ammunition (Generic, spend & respawn); Elite = a character (Individual —
  named, persists, grows; lean into the Tier-A/B axis).** *No permadeath* (too
  harsh + breaks lore — if soldiers/Royal die, an immortal Elite is the odd one
  out). Elite death **matters via ROLE** instead: it dies normally, but the
  buff/coordination it provided *stops*, so the cluster around it collapses.
- **[PROPOSED]** **Antenna command-link** — the Royal directly commands her
  **Elites** (move/focus/trigger); **Soldiers** respond only to **pheromone
  zones**. Command directness = proximity to the Royal (drive self → command
  retinue → sway the masses). Elites stay smart-by-default; the Royal command is
  an *optional override*. Lost when the Royal dies (decapitation → Elites go
  auto). Rides the built `RoyalLifecycle` + leaderless death-stakes.
- One line: **Soldier = the muscle · Elite = the nerve · Royal = the commander.**

## 2. Squad system — emergent (universal) vs rigid (δ)

- **[PROPOSED]** **Universal = emergent/loose:** soldiers gravitate to nearby
  Elites + benefit from the aura → clusters form *naturally* (the Elite is the
  visible cluster-leader). **Never overrides unit speed** — fast units charge
  ahead (unbuffed vanguard), slow units anchor (buffed core); the squad
  *stratifies by speed*, no slowdown. Builds on Goliath's aura + a march-bias.
- **[PROPOSED]** **δ Military signature = rigid Phalanx:** the δ Elite organizes
  δ units into **class-ranked formation** — tanks/melee rush to a **front** slot
  then lock to the Elite's pace; ranged speed up to a **back** slot then lock.
  Advances as one wall. **Tradeoff:** individual speed sacrificed for rank
  bonuses. **Weakness:** breaks on displacement (the locked `§1.0` knockback
  ruling). Slot assignment is data-driven (`attackRange`/`role`). δ-only, so it
  doesn't spend the formation corner on everyone.
- **[OPEN]** δ formation: the rank *bonus* (armor? coordinated fire? flat atk?),
  formation scope/capacity, re-form behavior after displacement.
- **[OPEN]** Universal squad UI: click-to-command an Elite vs auto-follow retinue.

## 3. Per-geneline hive config — character via the *hive*, not just units

- **[PROPOSED]** Split the axes so no geneline double-dips:
  - **Army SIZE** = unit cap-costs (BUILT: β swarmling cap 0.5, γ big-cap).
  - **Production FLOW / quality / defense** = a per-geneline **HiveProfile**
    (larva regen, larva cap, quality odds, hive HP) — same pattern as the built
    `MaturationDefs` phases, keyed by geneline.
  - β = fast regen + many + **rough quality** · γ = slow + **tanky hive** ·
    δ = slow + **premium quality** + defended hive · α = fast incubation tempo.
- **[LOCKED principle]** **Everything geneline-specific (hooks, hive config,
  Elites, signature tools) rewards SAME-geneline.** Off-geneline units are
  *mercenaries* — raw stats, no synergy, **default** (not the hive's) production
  rate. So "β hive + γ units" = slow off-spec production + few (γ cap) + no
  hooks = strictly worse than pure. Closes every "X hive + Y units" cheese by
  *extending* `VISION §5`'s pure=peak rule to the hive config. (Royal exempt
  from cap — BUILT this session.)

## 4. Quality & mutation ladder

- **[PROPOSED]** Unify into **one rarity ladder: weak → normal → strong →
  EVOLVED** (the user's "mutated = stronger 4th tier, visually distinct").
  **Visible on the larva** (4 distinct looks) so deploy is a *decision*.
- **[PROPOSED]** Scope variance by caste premium-ness: **Soldiers full range**
  (averages out); **Elites floored at normal** (no weak — premium protection,
  evolved Elites = centerpieces); **Royal = no birth roll** — grows via her
  **mutation build** instead.
- **[PROPOSED]** **Maturation improves quality odds** (5th maturation perk —
  Early weak-heavy → Late strong/evolved-rich). One config field on the phase.
- **[PROPOSED]** Reaching EVOLVED = mostly **earned** (spend **mutagen** on a
  strong larva), rare natural roll at Late maturation. Soften the blind ±20%
  stat swing (it's the punishing part); the *mutation-gate* is the good part.
- **[PROPOSED]** Terminology split: **EVOLVED** = the unit quality top-tier;
  **MUTATION** = the *Royal's* capability build (Qud-style, mutagen-fueled, with
  **Defects = Corruption** — Phoenician/dark mutations for power + drift).

## 5. Trade & allies (strategic layer, post-MVP)

- **[PROPOSED]** **Currencies:** nectar (common) + vhyst (premium). Vyss is OUT
  (battle-scoped). **Goods (bio-commodities, never fantasy loot):** **genes**
  (flagship — splash other genelines), **mutagen** (fuels mutation/evolved),
  specimens/eggs (named individuals), royal jelly (quality), pheromone packets,
  intel, mercenary contracts.
- **[PROPOSED]** **Faction comparative advantage** — each faction is the best
  source of *its* geneline's goods → **which faction you ally with is a build
  decision**. Ally = full trade; neutral = limited; enemy = none; wandering
  merchant = black market.
- **[PROPOSED]** **Ally benefits:** gene-splash recruitment (headline), forward
  base/heal/trade hub, free-unit gifts, joint assault, garrison reinforce, safe
  corridors, raid warnings; **late hook = cross-geneline fusion** (deep alliance
  → a hybrid unit). The "visit & see" works because **styled hives render as
  their geneline** (5-facet style).

## 6. Geneline balance — cohorts + earned imbalance

- **[PROPOSED]** Balance **6 (or ~3–4) genelines at a time in ordered cohorts**,
  each in a **staggered tier-band** (0–3 → 1–4 → 2–5 → 3–6). Power escalates by
  **shifting the tier RANGE** (drop fodder, gain apex), not stat inflation.
- **[PROPOSED]** **Earned imbalance ACROSS depth, asymmetric parity WITHIN
  depth.** Deeper = stronger (you *earn* it); same-depth = rough equal *budget*
  + counter-triangle leans (distinct, not identical). "Balance everything" is
  *PvP* wisdom — Hivyss is **PvE with roster choice**, so natural imbalance is
  fine *and lore-true* (genelines = shards of varying completeness). Conditions:
  weakness is **legible** (no traps) + weak = the **accessible/early** tier
  (a cost tradeoff with its own niche), not strictly-worse.
- **[OPEN]** **Outgrow vs scale:** do shallow genelines get *replaced* via
  acquisition (docs lean this — your "main" is the run's evolving roster), or do
  they **scale** (evolution lifts them) so you can main one all run? Decides
  whether "play your favorite geneline to the Core" is real.

## 7. The Made-in-Abyss descent (Hive + Abyss)

- **[PROPOSED authoring rule]** **Two axes scale with depth: POWER *and*
  STRANGENESS.** Shallow = legible balanced archetypes (Classic deviation);
  deep = stronger AND weirder/rule-breaking (Alien deviation — ν "no combat
  units," ψ "breaks the rules," ω, the Primordials). The weirdness budget *is*
  the depth. → author the MVP-4 clean & learnable; get progressively unhinged
  the deeper you write.
- **[OPEN idea]** **Curse of Ascent** — going *up* costs you (corruption/Dark
  Vyss accrues as you descend; the abyss marks you; the way out is *down*).
  Ties the descent to the Corruption axis.

## 8. The 4-realm cosmology (where Dark Realm / Primordials sit)

- **[LOCKED — `HIVYSS §2/§4`]** 60 genelines = **Greek 24** (Main Hivyss, the
  base game) + **Phoenician 22** (Dark Realm — 1:1 dark twins of the first 22
  Greek) + **Coptic 7** (the Husk/moon — preserved, paired w/ the primordials) +
  **Archaic 7** (the Primordials — transcendent source, T10). Dark Realm and
  Primordials are **outside** the 24 Greek. Family tree: 7 Primordials shattered
  → Phoenician (ancestral/dark), Greek (refined), Coptic (preserved). ψ/ω = no
  Phoenician twin. Descent: Greek → Phoenician → Coptic (Reckoning) → Primordials
  (Beyond) — deeper realms = stronger & stranger.

## 9. §14 reframe + the Angelfly enforcer

- **[PROPOSED — amends `lore/HIVYSS §14`]** §14 ("no angels/demons/dragons") is
  **too blanket**. Keep its *spirit* (no generic fantasy; biological coherence —
  what makes Hivyss distinct), fix its *letter*: **ban literal generic-fantasy
  FORMS, allow their ARCHETYPES reskinned to insect-biology** (pass the §1
  "belongs in a living body" test). **Scale with depth** — surface = strict
  insect-biology, deep realms = progressively transcendent/alien (but never
  generic-Abrahamic). Guardrail against creep = the §1 test.
- **[PROPOSED]** **The Angelfly order** — a radiant **angel-INSECT** enforcer
  geneline (clearly a bug — chitin/6 legs/compound eyes — with angelic radiance
  as *biological* flavor: bioluminescent halo, translucent radiant wings; real
  precedent = lacewings/luna moths). Fusion-name ladder **Angelfly →
  Archangelfly → Seraphid** (the apex = biblically-accurate many-winged
  many-eyed blazing insect — angel *and* bug *and* deep-realm horror at once).
  Mechanic = **suppression / nullification / ORDER** (strips buffs, cancels
  rule-breaking, punishes corruption — the *anti-ψ*). Placement = **δ Military's
  Phoenician dark twin** (δ's earthly order corrupted into radiant holy-terror).
  → see `DARK_REALM_SKETCH.md`.

## 10. Enforcement = dynamic political patchwork (not a uniform cop)

- **[PROPOSED]** No single realm-wide enforcer (δ at T1–4 can't police T6 deep
  genelines). Instead, **power varies in KIND by region, and is DYNAMIC:**
  - **Colonial occupation** (δ projects from Veins *up* into the Skin — δ is the
    "colonial dictator," a foreign occupier, NOT the Skin's native law) ·
    **native homeland rule** (α in Sun Carapace) · **enforcer order** (Angelfly
    in Dark-Veins) · **lawless wild** (the wild ring / Forage frontiers) ·
    **contested war zones** (borders).
  - **Dynamic:** holdings expand/collapse, factions war independently of you,
    your **reputation** decides who hunts vs ignores you, capturing a node flips
    control. The same *layer* has different rules in different *nodes*.
  - δ corrected: **the colonial EMPIRE** (rules Veins, occupies outward, the
    run-end boss you fight as the insurgent), not "police." Angelfly = its dark
    imperial twin.
  - Already half-built — the faction / territory / reputation / node systems
    *express* this; we're naming the fiction.

## 11. The false-heredity reconcile (Rogue Lineage model)

- **[OPEN — #1 worldbuilding reconcile]** `HIVYSS §1` claims "every death is
  heredity, the next generation begins closer" but v1 **resets per run** → the
  line is currently *false*. **Rogue Lineage** is the model to fix it:
  death = continue as a **descendant** of the lineage with inherited progress
  (geneline = lineage; the Royal's "death → next lineage" already gestures at
  it). Either **build** the thin cross-run inheritance that makes the metaphor
  true, or **rewrite** the line. Decides whether the cosmology's core promise is
  real or prose.

---

## 12. Run progression — Normal start → capture → roster loadouts [PROPOSED, 2026-06-13]

> The user's idea is still **~30% formed** ("I need to take time"); captured so it
> isn't lost. Builds on the LOCKED node map (`GENELINES §4-6`), doesn't replace it.

- **Start as Normal, earn genelines.** Already half-LOCKED: `GENELINES §5` —
  *"Normal = the wild substrate … also the starting roster."* You begin with the
  Normal roster and **no Royal**; acquiring your first geneline (ally gift, or
  conquest) is a genuine **power + system unlock**, not a given.
- **Normal has no Royal [PROPOSED-lock].** The Royal/hero layer is a **geneline
  privilege** — the whole control-a-hero mechanic *turns on* at your first
  capture. Knock-ons: a distinct scrappy early-run texture; and Normal's hive is
  the **plain wax dome** (the default body — "no identity yet" reads visually).
- **Multi-geneline runs via the rule: OWN ≠ FIELD.** With 24 genelines, locking
  to one per run wastes the premise; but **fielding** several at once = an
  identity-less everything-blob that destroys what makes genelines distinct. So:
  - **Own** (run-wide): each captured hive joins your **collection** — its units
    enter your deploy pool, its **queen** stays alive governing that hive (lore-
    true; *not* a worker-only colony). You accrue a **stable** of queens/genelines.
  - **Field** (per battle): you commit **one deploy roster** = one queen/identity.
  - You experience several genelines by **switching which roster you bring**, not
    by stacking. **Own many, field one.** The Royal stays special *in the battle*
    (one queen leads each fight), not by capping how many you own.
- **Deploy-roster loadouts (the fun core).** At Home (+ your captured hives as
  rally points) you pre-build a few **rosters** — Roster A ≈ α (α queen + α
  units), Roster B ≈ β (captured β queen + β units) — and pick one per node. A
  **multi-loadout deck-builder**: "bring the right army for this matchup."
- **Guardrail:** capture = more **options/adaptability**, never more **power in a
  single fight** (you never field two queens). Breadth in prep, focus in combat.
  Bonus: owning several = **run resilience** (re-equip a different identity if a
  fight/Royal goes bad).
- **Refines, doesn't break, the old rule:** `"hive+Royal = your selected
  geneline"` → `"= your ACTIVE geneline, swappable as you capture more."` Same
  combat model (one hive, one Royal per battle).
- **Forks:** [O] roster composition — **pure** vs **anchor+splash** (lean:
  queen+Elites match the active geneline; **soldiers** can be a melting pot) ·
  [O] # of roster slots (2-3 vs unlimited) · [O] swap cost (free at Home vs gated).

## 13. The node-combat model — attacker vs node, not hive-vs-hive [PROPOSED, 2026-06-13]

- **Every battle is YOU (attacker) assaulting a NODE (defender)** — *not* two
  symmetric hives. The node you *come from* is just a launch point; the node you
  *attack* defines the enemy. Literal "Hive vs Hive" only happens at a **Hive**
  node. **Your side stays consistent; the enemy scales by node grade.**
- **Node grade = the caste-tier cap of the battle + the defender's installed
  structure** (the principle that makes the gradient cohere: **territory tier
  mirrors the caste tier of who holds it**):

  | Node | Held by | Structure | Spires | Battle ceiling |
  |---|---|---|---|---|
  | **Forage** | soldiers/workers | minimal / weak mound | **0** | low (skirmish) |
  | **Warren** | an **Elite** | lesser fortified chamber | **1** | mid (+Elite) |
  | **Hive** | the **Royal** | full hive | **2** (forward+inner) | high (+Royal) |

  Already half-canon: `GENELINES §5` tier gradient is *Forage T0-1 → Hive T2-3 +
  Elite*, so Elites are excluded from Forage **by tier** today. Caste-cap just
  makes it explicit. *Forage is leaderless for BOTH sides* (you don't drag your
  queen to a frontier scrap → gives the Royal **death-stakes teeth**).
- **Forage/Warren combat = same loop, lower ceiling.** Economy (incubation /
  larvae / forage) is **decoupled from the Royal** — *already true in the build*
  (no-Royal battles run the full economy; that's the Normal early-game). The node
  grade sets your **maturation ceiling** (Forage=Early, Warren=Mid, Hive=Late) —
  reusing the built maturation phases as the per-node power cap.
- **You don't bring your hive — you tunnel in.** Lore fix (insect-true: army ants
  bivouac, carry brood on the march):
  - **Capital hive** (home + captured hives) — **rooted, safe, never on the
    battlefield**; the queen's seat, where you prep rosters, draw brood/supply,
    pick the next node. The **strategic/home layer.**
  - **Field-nest** (what you fight *from*) — a **temporary forward burrow** your
    swarm digs on arrival; a **small hive with a few chambers** that hatches the
    brood you carried. Expendable (lose it = lose the fight; capital untouched).
    The **tactical/combat layer.** *This is the "player hive" the game fights from
    today, reframed.*
  - So production IS present every battle (the field-nest), but **bounded by
    supply** — the existing **capacity + larvae + nectar** caps, now *explained*
    (a campaign force, not your whole empire). When you bring the **Queen**, she's
    *leaving her hive to lead in person* → why it's weighty.
- **Siege asymmetry (the Hive fight):** the defender is an **established colony →
  starts "already mature"** (high tier, Royal home, spires up) as an **entrenched
  garrison**; you start **Early and ramp.** That gap **is** the siege + the
  difficulty (bigger hive = further to climb). Winnable because the defender is
  **strong-but-static/finite** while you **grow + came prepared** (chosen roster).
  Already half-built: enemy tier ceiling = node **difficulty** (`HiveProfile.maxTier`).
  *How big the head-start gap should be = a playtest tuning number.*
- **Build-cheapness:** most of this *configures the battle you already have* —
  (1) economy ≠ Royal (decoupled today), (2) maturation = the per-node ceiling
  (built), (3) keep your side as-is + scale the **enemy** (structure HP / spire
  count / garrison / Royal-spawn off node grade). New work: functional **spires**
  (this build), a `NodeDef.grade` field, and the pure Forage **field-battle**
  win-condition (post-MVP; MVP = weak-mound siege).

---

## Open forks (decide before the builds they gate)

1. **Outgrow vs scale** shallow genelines (§6).
2. **False-heredity:** build cross-run inheritance vs rewrite (§11) — the #1
   coherence fix.
3. **Persistent vs per-run stable** (blocks the node-map overhaul; pre-existing).
4. δ formation rank-bonus + squad UI (§2).
5. §14 reframe — adopt the archetype-via-reskin amendment? (§9)
6. Curse-of-Ascent — in scope? (§7)
7. **Roster loadouts (§12):** composition (pure vs anchor+splash) · # of slots ·
   swap cost.
8. **Node-combat (§13):** Forage win-condition (weak-mound siege MVP vs true
   field-battle post-MVP) · the siege head-start gap (tuning) · `NodeDef.grade`
   data shape · persistent captured-hive meta (economy/counter-attack = post-MVP).
9. **Re-pick primary geneline** — locked at first acquisition, or swappable at
   Home? (§12)
