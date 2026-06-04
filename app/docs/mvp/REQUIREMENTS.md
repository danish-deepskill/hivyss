# Hivyss MVP — Constraints & Requirements

> **Purpose:** Foundation spec. Locks *what the MVP must be and must NOT be* **before** any geneline/roster design begins. Every later design doc (geneline specs, rosters, run layout) must conform to this.
>
> **Pairs with:** `lore/HIVYSS.md` (cosmology + map distribution), `app/docs/reference/TIER_CONTRACT.md` (tier budget), `app/docs/reference/GAME_DESIGN.md`, `UNIT_LIFECYCLE_ROADMAP.md` (now subordinate to this).
>
> **Status:** DRAFT 2026-05-31 — captured from the MVP scoping discussion. **Open decisions in §8 must be resolved before geneline design.**
>
> **⚠ SCOPE EXPANDED 2026-06-03 — `VISION.md` is now the newest authoritative design; where it differs, it wins.** The MVP now includes the **hive-build loadout loop + a thin controllable Royal + maturation phases** as core (this doc originally deferred them — see §7). Only the *full* 4-mode Royal + 5-facet styling remain deferred. The **combat-first gate (§3 Phase 0) is unchanged** — prove the α fight is fun first; the hive-build loop is the co-core built right after.

---

## 1. Goal & context (LOCKED)

- **Purpose:** **Commercial / early-access seed.** Highest bar — architecture *and* content must **scale**, not just work once.
- **#1 risk to validate:** **Is the combat fun?** Everything sequences around proving this *first*.
- **Product scope (the destination):** combat + run + gene-acquisition. The finished game is the full vertical slice.
- **Pace:** **Quality-first, no deadline.** Do each layer right; never rush; never ship a half-baked layer to hit a date.
- **Lore is FROZEN for the MVP.** It's rich enough already (and yes, it still wants more polish/ideas — that's *deferred to post-EA*). **No new cosmology / geneline-vision / worldbuilding work during the MVP.** Every hour there is an hour stolen from proving the combat is fun. Treat `HIVYSS.md` as read-only reference until the MVP ships.

---

## 2. What the MVP must PROVE (success criteria, risk-ordered)

1. **Combat is fun** *(primary — the gate).* Moment-to-moment battle feel **and** tactical depth are genuinely enjoyable. Validated by playtest: the player says *"this is fun"* unprompted.
2. **Genelines feel different.** Distinct decision-loops per §6 (the variety hook). *(Legibility test: recognize the geneline from one unit in ~2s.)*
3. **The run is compelling.** A bounded descent with escalation + a climax.
4. **The acquisition fantasy works.** Start generic → fight → acquire genes → roster visibly grows.

---

## 3. Build sequence (LOCKED — driven by risk, NOT scope)

Product scope ≠ build order. Build the riskiest thing first; everything else sits on top of it.

| Phase | Proves | Build |
|---|---|---|
| **0 — Combat-fun proof** *(gates all)* | #1 risk | **One** geneline + the **feel layer** (animation/sound/juice/depth). Skirmish only, no run. Don't proceed until it's *fun*. |
| **1 — Variety** | #2 | Add genelines (the contrast). |
| **2 — Run loop** | #3 | 2-layer descent + nodes + boss climax. |
| **3 — Acquisition meta** | #4 | Normal starter → fight → acquire genes. |
| *(post-MVP)* | scaling | 3rd layer / Mid-Core / T4+ content, more genelines. |

---

## 4. Numeric budget (LOCKED)

| Dimension | **MVP** | Full game |
|---|---|---|
| Layers | **2** (Skin, Veins) | 6 |
| Nodes | **~10–14** (trimmed; ~1 anchor biome per layer) | 51 |
| Designed genelines | **4** enemy/acquirable **+ 1** generic starter (Normal) | 60 |
| Tier ceiling | **α/β/γ → T3** (Royal T3, Elites T2) · **δ → T4** (Centurion = the only T4, & the boss) | T10 |
| Units per geneline | **1 Royal + 2 Elites + ~4 soldiers ≈ 7** *(base skeleton; soldier & Elite counts flex by playstyle — see `GENELINES §2`)* | varies |
| Total designed units | **~28–32** + Normal starter | 200+ |
| Bosses | **1** (Veins climax) | many |

---

## 5. Structural constraints (LOCKED — grounded in the map data)

- **Genelines ⟷ biomes ⟷ layers are ONE coupled structure.** Depth picks genelines. Per `lore/data/main_map.json`, the MVP's two layers own these biomes:
  - **Skin (T0–2):** α (carapace_plains), β (hive_marsh), γ (stone_ridge)
  - **Veins (T1–3):** δ (pursuit_veldt), ε (pulse_network), ζ (bond_hollow)
  - → the 4 MVP genelines are drawn from these owners.
- **Descent and acquisition are the SAME loop:** start with the Normal generic starter → descend Skin → Veins → fight each layer's native geneline → acquire its genes → climax at the Veins boss.
- **Tier discipline:** T0–T3 soldiers + **one** T4 signature Elite per geneline (the thesis-carrier, e.g. δ's Centurion). **NEVER T5–T6** (Nerve/Core apex — the 100–200-line "thesis-as-one-mechanic" units; the most expensive in the game; post-EA).
- **2-lane battle structure** (locked in lore §8).
- **Each geneline is an ECOSYSTEM with a thesis** (§6 ten axes), built from **interdependent roles** — *not* one hook with reskins. (e.g. δ: shields protect the cannon; the cannon gives the shields offense; the commander multiplies both.) Only 1–2 units emit the hook; the rest are a real army that benefits from it.

---

## 6. Combat-fun requirements (Phase 0 — the primary risk)

- **Feel:** every MVP unit uses the strike-animation seam (`Unit.swingProgress` → `getStrike`); per-unit attack animations (**Grunt is the template**); per-unit/ability **fitted sound** (current sound is generic-by-category — a real gap); hit juice (particles, feedback).
- **Depth:** role interdependence per geneline → tactical decisions that actually change outcomes (positioning, timing, composition), not just "deploy and watch."
- Phase 0 ships **one** geneline — **α Primal** (§8) — to this bar before *any* breadth is added.

---

## 7. OUT OF SCOPE (explicit — the MVP does NOT include)

- Layers 3–6 (Organs, Nerve, Core) + the Drift ascent side-branch
- T4 beyond the one Elite per geneline; all T5–T10 units
- Dark Realm, Husk, Primordials (the other 3 realms)
- Strategic-overworld depth: faction reputation, quests, territory/garrison, hostile raids, allied factions
- Royal 4-mode system, hive styling (5 facets), mutation, evolution trees
- Any geneline beyond the 4 designed + Normal starter
- The full 24-Greek / 60-faction cosmology

*Anything here that creeps into MVP scope is a red flag — push it to post-EA.*

---

## 8. OPEN decisions (MUST resolve before geneline design)

1. **The exact 4 genelines.** Candidates: Skin → α/β/γ, Veins → δ/ε/ζ. Current lean: **β (swarm) + γ (fortress) + δ (military) + a 4th** (α Primal, ε Signalers, or ζ Symbionts). Must span distinct archetypes/decision-loops.
2. ~~δ vs α as the Phase-0 showcase~~ **→ LOCKED 2026-05-31: α Primal.** Designed fresh via §6 (herd / raw strength / foundational; hook = pack cohesion + presence buffs). The existing built military units (Centurion, Legionnaire, Bombardier) become **δ**, deferred post-Phase-0. Generic units (Grunt, etc.) stay usable for α or the Normal starter — the strike-animation work is *not* wasted.
3. ~~Art direction: procedural vs sprite~~ **→ LOCKED 2026-05-31: procedural is the final MVP/EA art.** No sprite migration. Invest *fully* in procedural feel — per-unit strike animations (Grunt template), fitted sound, hit juice. The procedural look IS the aesthetic; the feel work is durable, not scaffolding.
4. **Boss design.** Veins climax — a native/δ champion (cheaper) vs a smaller "Mid-Core stand-in."
5. **Normal's role.** Generic playable **starter** (enables the acquisition loop) vs shelved. Lean: **starter.**

---

## 9. Non-negotiables (inherited from the existing build)

- **Tech:** procedural Phaser Canvas rendering (current), TypeScript, data-driven units (`UnitDef` / `AbilityDef` / `PassiveDef` registry).
- **Reuse, don't rebuild:** combat engine (closed, 632+ tests), capacity, incubation, routes (air/land/tunnel), run/node map, AI Hive v1, 4 player abilities, sandbox.
- **Lore discipline:** §6 geneline identity (10 axes + legibility test), TIER_CONTRACT budget, §14 insect-naming (single-word, no military ranks/fantasy tropes), element-as-consequence (no "fire faction").

---

*Document version: 0.1 (draft). Update as open decisions in §8 are locked — convert each to a LOCKED line in the relevant section and date it.*
