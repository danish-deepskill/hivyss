# α Primal — Geneline Design Spec (MVP Phase-0 showcase)

> **Status:** DRAFT 2026-05-31. The **Phase-0 showcase geneline** — the one we make *genuinely fun* before any breadth (`REQUIREMENTS.md` §3). Designed through the **locked mechanic frame** (`MECHANICS_INVENTORY.md`): deploy + nectar/capacity + routes + 4 hive abilities + **worker (scout+gatherer)** + **pheromones via scouts** + **2-lane (sequenced)** + **1 Elite signature**.
>
> **This locks identity, roles, the hook, and interdependence. It does NOT set stats** — those come from balance playtest. It's the *what & why*, not the *how much*.

---

## 1. Identity — the §6 ten axes

| Axis | α Primal |
|---|---|
| **Core fantasy** | Command a primal **herd** — instinctive raw strength that's overwhelming when *massed and timed*, fragile when *scattered*. You're an alpha directing a beast-herd's momentum, not a general drilling soldiers (that's δ). |
| **Mechanical hook** | **Pack Cohesion** (see §2) — units escalate in power based on how many α allies are massed near them. |
| **Economy** | Mid-cost, mass-leaning. Solid beasts you want *several of together* — not throwaway swarm (that's β). |
| **Caste lean** | Soldier-heavy (the herd) + **2 Elites** (Goliath, Maulhorn) + **1 Royal** (Matriarch) + universal worker. |
| **Damage lean** | **Blunt** (trample/slam/gore) primary, some **Sharp** (tusks/horns). Physical force — *not* elemental. (Element-as-consequence: α is raw strength, not "the X faction.") |
| **Biome / habitat** | Skin / `carapace_plains` (open ground = herd terrain). *(Governs α as an enemy in the run; the player's showcase roster spans its full tier range.)* |
| **Tempo curve** | **Mid spike.** Vulnerable early (needs mass to activate cohesion); snowballs once the herd forms + Goliath anchors; falls off if picked apart/scattered. |
| **Counter (legible)** | **AOE + displacement.** α *wants* to clump → AOE punishes the massed herd; knockback scatters it (kills the bonus). Readable to the opponent: "they herd up → AOE them / scatter them." |
| **Archaic ancestry** | **Stigma / Territory** (per §7 faction table). Reconciles as "a herd claims and holds grazing ground." |
| **Elite doctrine** | Two Elites: **Goliath** anchors + amplifies the herd's core — the player times its **Stampede** when massed + aimed; **Maulhorn** rams a single target to scatter/clear space. "Anchor, then unleash momentum." |

---

## 2. The hook — Pack Cohesion (and the decision it creates)

**Pack Cohesion:** each α unit gains an escalating bonus (damage / damage-resist, maybe speed) scaled by the count of α allies inside a "herd radius." Massed = strong (snowballs); scattered = baseline.

**The active decision this forces (this is what makes it *fun*, not deploy-and-watch):**
- **Herd TIGHT** → max cohesion (devastating) **BUT** vulnerable to AOE/displacement.
- **SPREAD** → safe from AOE **BUT** weak (no bonus).
- The player manages this every moment **via pheromone scouts**: **Charge** (mass + advance on a lane), **Rally** (hold/regroup the herd), **Retreat** (scatter to dodge an incoming AOE — sacrificing the bonus to survive).

**Decision-loop (§6):** *"Keep the herd tight and aimed — or spread to dodge that AOE? And when do I unleash the Stampede?"* — distinctly different from β's *"how many to spam."* ✓

The counter (AOE/displacement) and the hook (cohesion) are **the same tension** — the thing that makes α strong is the thing that kills it. That's the engine of the fun.

---

## 3. Roster — the 2/3/2/1 pyramid, T0–T3 (restructured 2026-06-02)

*(Names are §14-style placeholders — insectoid herd-beasts; roles are the design. This table is the BUILT state — `units/alpha.ts`.)*

| # | Tier | Unit | Caste | Role | Cohesion participation |
|---|---|---|---|---|---|
| 1 | T0 | **Chitling** | soldier | herd fodder (cheap melee) | the *mass* — cheaply bumps the herd count for everyone |
| 2 | T0 | **Goreling** | soldier | charger (fast melee, tusks) | beneficiary; speed keeps it massed mid-charge |
| 3 | T1 | **Hornshell** | soldier | frontline tank (soaks the front) | the **enabler** — tanks focus-fire so the tight herd survives |
| 4 | T1 | **Goretusk** | soldier | **tight-wedge cohesion** — sharper payoff (+15%/ally), tighter radius (45) | rewards a *concentrated* herd; "commit as one or don't bother" |
| 5 | T1 | **Quillback** | soldier | **ranged anti-air** (spits spines) — α's only ranged unit | the picket — the herd's one answer to air it otherwise can't touch |
| 6 | T2 | **Goliath** | **Elite** | anchor + cohesion **amplifier** + **Stampede** signature | radiates *and amplifies* the core aura; Stampede = cohesion-scaled AOE burst |
| 7 | T2 | **Maulhorn** | **Elite** | **Ram Charge** signature — single-target ×2, knockback 100 | weaponizes displacement; clears space for the herd to advance |
| 8 | T3 | **Matriarch** | **Royal** | herd-queen capstone — click-controlled hero + **Primal Roar** ultimate (BUILT) | the heart — biggest cohesion radius + amplifier aura; the pack forms around her |

**Pyramid 2/3/2/1** = 5 soldiers + 2 Elites + 1 Royal + the universal worker. Restructure notes vs the original design: the cohesion **amplifier** folded onto Goliath (the anchor that gathers the herd also makes it hit harder); **Carapex → Quillback** (α needed a ranged anti-air answer more than a second amplifier carrier); **Matriarch** is the new Royal capstone (her ultimate is blocked on the Royal control system).

---

## 4. Why it's an ecosystem, not a hook + reskins

Each role is **load-bearing** — remove one and the herd breaks:
- Remove **Hornshell** → the massed herd melts to focus-fire/AOE (no front to soak).
- Remove **Goliath** → no anchor, no cohesion *amplifier*, no burst payoff (it now carries all three).
- Remove **Quillback** → the herd has no answer to air — air units pick it apart untouched.
- Remove the **fodder/chargers** → never enough mass to trigger cohesion at all.

So the roles *create* the decisions: you mass behind the Hornshell, build momentum with the Goretusk, anchor + amplify with Goliath, screen the air with the Quillback — and bail with Retreat when the AOE comes. **That interplay is the gameplay.**

**Legibility test (§6):** see one α unit — Goliath leading a clustered pack, or a Hornshell shielding the herd — and read *"herd geneline: strong massed, beats face, dies scattered"* in ~2s. ✓

---

## 5. Build path (how it maps to existing systems) — mostly BUILT now (2026-06-02)

- **Pack Cohesion** ✅ — a `'cohesion'` `PassiveDef` kind in the `PASSIVE_HANDLERS` registry (its first new consumer). Scales an atk modifier by the count of same-lane same-side α allies in radius; reads `radius`/`perAlly` through `applyModifiers` so an amplifier can boost it. Plus the herd heat-glow in `Unit.redraw()` (reads `cohesionLevel()`).
- **Elite signatures** ✅ — the Elite-signature system is built (`CombatSystem.requestSignature` + HUD slots, cooldown + in-range gating). **Goliath Stampede** (cohesion-scaled AOE, ≤4×0.5, shockwave FX, `charge` body anim) + **Maulhorn Ram Charge** (single ×2, knockback 100, `ram` recoil anim) both shipped — distinct motion / FX / damage shape each.
- **Goretusk** ✅ — its T1 "twist" is a **tight-wedge cohesion** (`cohesion({ radius: 45, perAlly: 15 })`): tighter radius, +15%/ally → up to +60% atk when clumped. Pure data, no custom logic (TIER_CONTRACT-clean). *(A flat-speed "momentum" toggle was tried and cut — speed only matters on the approach, so it was a non-decision; the tight-wedge cohesion IS the identity.)*
- **Goliath cohesion amplifier** ✅ — an `aura_modifier` on `cohesion_perAlly`; the cohesion handler reads perAlly through `applyModifiers`, so the anchor amplifies nearby allies' cohesion (the reusable amplify/disrupt seam).
- **Quillback** ✅ — `attackRange:'ranged'` + land route → reaches the air lane (α's anti-air); reuses `needle_shot`.
- **Pheromones** (Charge/Rally/Retreat) ✅ — the deposit-fade courier model (VISION §5) in both the sandbox and the real loop: a Scout couriers the command laying a fading scent-trail; intercept is the counterplay. (Click-targeted delivery still open.)
- **Matriarch ultimate + Royal control** ✅ — built 2026-06-11 (`RoyalLifecycle`): on-field from the bell, click-select → click-move/focus, **Primal Roar** (lane-radius cohesion surge + charge via the `herd_roar` presence-flag effect), death → leaderless → next-lineage respawn, speed-scaled lane-switch, HUD profile.
- Everything else (deploy, damage, melee, capacity) = built.

---

## 6. Design risks to watch

1. **α vs δ collapse.** Both α (cohesion) and δ (formation) are proximity-buff hooks. Keep them distinct: **α = primal MOMENTUM / charge / burst (kinetic, instinctive)**; **δ = disciplined FORMATION / hold / coordination (positional, ordered)**. If they feel the same when δ is built later, re-differentiate.
2. **The buff-passivity trap.** If cohesion just "ticks" while you watch, α fails the #1 risk. The pheromone tight-vs-spread tension + the Stampede timing are what keep it *active*. The design must make those decisions *frequent and consequential* — that's the playtest bar.

---

## 7. Open / deferred (NOT in this spec)

- **All stats / numbers** — from balance playtest, not design.
- **Final names** — §14 insect-naming pass later.
- **Exact cohesion curve** (per-ally bonus, radius, cap) — tune in playtest.
- **The worker + pheromone + Elite-signature systems** themselves — separate builds (this spec just *uses* them).
