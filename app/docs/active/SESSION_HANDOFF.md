# Session Handoff — Hivyss MVP (onboarding brief for a fresh Claude)

> Read this + the docs it points to and you'll have the prior sessions' full mental model. **Verify state:** `tsc` clean + 632 tests green, but **uncommitted**. **The work is a commercial-MVP build of Hivyss** (Phaser 3.90 Canvas, TypeScript, procedural graphics, code in `app/`).

## 0. THE ONE THING THAT MATTERS
**The MVP's #1 risk — "is the combat FUN?" — is STILL UNTESTED.** Multiple sessions have built design docs, lore, rosters, lane/route structure, and a *lot* of sandbox-background art — but the core α herd-fight has never actually been playtested. **Everything else is worthless until that's answered.** Do not get pulled back into endless visual polish.

## 0.5 LATEST SESSION (through 2026-06-02) — start here, this is where we actually are

**LATEST (2026-06-02) — α roster restructured + 2nd Elite signature + signature UI/feel.** α is now an **8-unit 2/3/2/1 pyramid**: T3 **Matriarch** (NEW Royal unit — `draws/alpha/matriarch.ts`, a grander herd-queen; her ultimate + the Royal control/trigger system are NOT built), T2 **Goliath + Maulhorn** (Elites), soldiers below (see `GENELINES.md §2`, now synced). **Maulhorn's Ram Charge is built** — a *distinct* `ram` motion (crouch → flat thrust → **recoil bounce**, vs Goliath's `charge` forward-settle) + **single-target ×2 dmg + knockback 100 + NO shockwave** (Goliath keeps the AOE shockwave but ×0.5/4-target/no-knockback). The 3 Elite **slots** show the 2 Elites and are **gated on cooldown AND enemy-in-range** (`signatureHasTarget` in `SandboxScene` → slot `inRange` state → button greys/disables when no target in the signature's range). **The E hotkey was REMOVED** — signatures fire ONLY via the slot buttons. **644 tests green, tsc clean.**
- **Knockback gotcha (important):** blunt knockback is an **EFFECT** (`DEFAULT_EFFECTS['blunt']='knockback'`), NOT a raw stat — so `appliesEffects:[]` on a blunt ability *silently kills its knockback*. Goliath Stampede uses `[]` for no-knockback; Maulhorn keeps the default. Also `linearDamageTiersWithKnockForce(base, scale)` **couples knockForce to the damage scale** (knockForce = base × dmgMult) — a papercut when you want "×N damage, same knockback".
- **α passives now BUILT (2026-06-02):** Goretusk = **tight-wedge cohesion** (sharper payoff, tighter radius — a flat-speed "momentum" was tried then **cut** as a non-decision; speed only matters on the approach, and per TIER_CONTRACT a T1 should be a pure-data twist); **Carapex → Quillback** = α's **ranged anti-air** (land route + `attackRange:'ranged'` reaches the air lane); the cohesion-**amplifier** folded onto **Goliath** (an `aura_modifier` on `cohesion_perAlly`; the cohesion handler now reads its params through `applyModifiers` — the reusable amplify/disrupt seam). **644 tests green.**
- **FILE REORG (2026-06-02):** α Primal is now the **canonical `units/alpha.ts`** (+ `draws/alpha/`); the old legacy "military alpha" roster (Grunt→Centurion) moved to **`units/archive.ts`** (+ `draws/archive/`) under a new **`archive` geneline** (its own sandbox tab, symbol ⊘). Kept registered so the ~600 combat tests still run; slated to re-home into δ Military later.
- **Still TODO on α:** Matriarch ultimate (Royal system) · **target-lock** (deeper whiff fix — the slot in-range gate only stops *starting* a doomed shot; target-lock saves a *good* shot from windup-drift) · an automated test for the Elite trigger/signature system (the one untested system).

**THE FX/ANIMATION SYSTEM IS BUILT + VERIFIED ON-SCREEN.** Read **`app/docs/active/FX_SYSTEM.md`**. Shipped this session (tsc + 632 green, seen working via Playwright MCP): `systems/FxDirector.ts` (pooled, budgeted, per-`kind` renderer registry) · `systems/FxRenderers.ts` (`shockwave` — cohesion-scaled ground ring) · `CombatSystem` seams `setImpactFxDispatcher` (per-hit) + `setCastFxDispatcher` (per-cast, carries cohesion magnitude), no-op defaults so tests stay deterministic · `AbilityDef.fx?:{kind}` · Stampede tagged `fx:{kind:'shockwave'}` · `SandboxScene` creates the director (fx layer depth 64), registers renderers, installs the cast dispatcher, ticks + resets it. **Goliath's Stampede now visibly throws a dust shockwave that scales with the herd's cohesion.**

**UNIT ANIMATION SYSTEM — BUILT + VERIFIED ON-SCREEN** (read `app/docs/active/UNIT_ANIMATION_SYSTEM.md`). Goliath's Stampede now plays a **rear→lunge** body animation with the shockwave + damage firing at the **lunge peak** (windup→impact phase timing). Shipped: `units/motions.ts` (motion-primitive library `charge/lunge/rear/recoil/shake/combine` + 8 tests) · `Unit` controller (`signatureAnim`/`currentMotion`/`startSignatureAnim`/`signatureImpactReady`; `redraw` applies body offset + squash/lean via graphics transform) · sim trigger-pass/impact-pass in `CombatSystem` (`fireSignatureImpact` helper) · `UnitDef.signatureAnim`+`signatureAnimPhases` · Goliath = `charge({rear:0.3, lunge:0.6})`, phases `{0.25/0.12/0.28}`. **640 tests green, tsc clean.** Authoring a new move = one composed primitive on the unit + phase durations (zero architecture cost). The **feel is tunable by eye** (rear/lunge amounts, phase durations) — that's the human-directed taste loop.

**Smaller next pieces:** more clips (hit-flinch, death) · per-unit signature anims (β/γ/δ as built) · FX follow-ups below.

**Smaller FX follow-ups:** (a) per-dmgType **default impact renderers** via the wired `setImpactFxDispatcher`; (b) **migrate the 5 legacy dispatchers** into FxDirector; (c) grow the FX **primitive vocabulary**; (d) **WorldScene** FX wiring (sandbox-only today). Placeholder debt: Stampede whiff wastes cooldown (no-whiff guard proposed, not added); no automated Elite-trigger test; enemy Elites have no AI trigger.

**Built this session (all uncommitted, tsc-clean + 632 tests):**
- **Cohesion VISUAL** — the herd heat-glow in `Unit.redraw()` (reads `cohesionLevel()`); per-unit cohesion refactor (`cohesion()` helper, default cap 4, Goliath wide-radius / Goretusk tight-wedge).
- **Geneline RENAMES locked → lore v1.6:** **α Primal · β Swarm · γ Fortress · δ Military** (β was "Multitudes", γ was "Enduring").
- **Elite trigger system** — `UnitDef.signatureAbility` + `Unit.sigCd`/`canSignature()`; `CombatSystem.requestSignatures(side)` / `requestSignature(unitId)` (command-queue, drains in `resolve()` after passives); **3 ELITE slots in the sandbox HUD** (per-Elite firing, cooldown fill, dead-Elite drop), **cap 3 Elites/side**, **E hotkey** = fire-all. Goliath → `stampede` (placeholder AOE blunt+knockback, **no cohesion-scaling, no visual yet**).
- **FX architecture DESIGNED** → `FX_SYSTEM.md` (sim→presentation seam; **4 homes**: FxDirector one-shots / Unit.redraw unit-status+buffs / WorldEntity gameplay-persistent / camera-global; determinism invariant; open Q = phase/channeled timing).
- **Playwright MCP "eyes" set up** — Claude can now screenshot the canvas (see [[reference_playwright_eyes]]); dev server `localhost:5173`. Use it to tune FX by eye.

**Known placeholder debt to clear during the FX build:** Stampede is a flat AOE (cohesion-scale it); it whiffs+wastes cooldown if no targets in 70px (add a no-whiff guard — proposed, not added); no Elite signature has an automated test yet; enemy Elites have no trigger (AI later).

## 1. Read order
1. **This file.**
2. **`app/docs/mvp/`** ← all MVP design + scope, ONE folder. **Start at its `README.md`** (the index): `VISION.md` is **authoritative** (vision · scope · loop · build order), then `GENELINES.md` (genelines/biome/map content), `REQUIREMENTS.md` (budget/constraints), `ALPHA.md`, `MECHANICS_INVENTORY.md`, `PHASE0_BUILD.md`. *(The MVP is now a thin slice of the whole loop — hive-build + Royal + maturation + run — not bare combat.)*
3. `app/docs/reference/TIER_CONTRACT.md`, `DRAW_STYLE.md`
4. `lore/HIVYSS.md` (now **v1.6**; skim §3 tier, §4 realms/layers, §6-7 genelines, §8). **FROZEN for MVP.**
5. `app/docs/active/FX_SYSTEM.md` ← the FX/animation architecture contract.
6. Memory: `MEMORY.md` + `project_mvp.md` + `reference_playwright_eyes.md`.

## 2. The user + how to work with them
- Solo dev. **Pushes back HARD; wants brutally HONEST verdicts, not cheerleading.** Hates tech debt. Architecture-first. Thinks like an implementer. Wants **control** (hand them the tunable "knobs," not just results).
- **Never suggest committing** (they manage git) unless asked. Don't over-document.
- They will rabbit-hole on visual/UX tuning for many rounds — engage, but **be the honest voice that re-anchors to the #1 risk** (is combat fun).
- Normally an orchestrator role for them; this stretch they've directed hands-on implementation.

## 3. The MVP design (LOCKED this session — `GENELINES.md` has it all)

**4 genelines, differentiated by ROLE (not size, not rigid RPS):**
| Geneline | Role | Hook | Layer→tier |
|---|---|---|---|
| **α Primal** | **OFFENSE** (rush) | Pack Cohesion (mass = +atk, *charge-synergy*) — a **medium aggressive pack, NOT a swarm** | Skin → **T0-3** |
| **β Swarm** | **NUMBERS** (swarm) | cheap+tiny expendable units + death-effects | Skin → T0-3 |
| **γ Fortress** | **DEFENSE** (turtle) | armor + degradation + walls | Skin → T0-3 |
| **δ Military** | **CONTROL/range** | formation + command + ranged/artillery; the **colonial-dictator BOSS** | **Veins → T0-4** |

- **Counter-lean (emergent, not engineered): β→α→γ→β.** A *lean*, never a hard counter. Archetype-distinctness scales to 24 genelines; RPS doesn't.
- **Tiers = shared sophistication ladder** (higher usually wins ~9/10 via elaborateness). Genelines = *horizontal* variety at a shared band; **depth/layers = the vertical power axis**. Greek caps at T6, T10 reserved for the 7 Primordials. (This was a big point of confusion the user worked through — see `GENELINES.md §1`.)
- **α is capped at T3** (Goliath = **T3 Elite**, not T4 — α is the shallow starter; Elite is a *caste*, legal at T3). α distribution **1/2/2/2** (Goretusk moved to T2).

**Biome = Zone = the lore term for "environment"** (palette + environmental rule + owner geneline). A **Layer** (Skin/Veins) holds **many biomes**. MVP biomes: **Sun Carapace** (α, open warm sandstone/chitin — NOT forest), **Fetid Pool** (β, swamp), **Chitin Ridge** (γ, shell-rock), **Arterial March** (δ, Veins/organic). Plus the **Wild** biome = Normal/neutral untamed woodland (the unclaimed substrate between territories).

**Map = territory model** (radial, Home-central): biomes radiate out (no north; west/south/east + descent south); **Forage → (Warren) → Hive** funnel per territory (wide mixed frontier → single pure Hive); ◦Wild neutral nodes; **purity + difficulty both peak at the Hive**; **procedural per seed, templated** (skeleton + seeded variation, constraint-validated, graph-not-grid). Built on the shipped `LAYER_DEFS` node system.

**Faction = static, 2 factions + 1 neutral** (NOT a rep engine): your faction (you + 1 ally) · enemy faction (δ + 1 wild collaborator) · 1 non-faction neutral; seeded per run; **δ fixed enemy boss.** Ally gives **light quests** (popup + reward, no engine). **Narrative spine:** the δ empire colonizes the wild Skin colonies; you descend Skin→Veins to topple the dictator. **δ = "Chapter 1" boss; the Core/ρ Rho is the true (deferred) finale.** Build the faction layer AFTER combat is proven.

**Lore reconciled to v1.5:** completed the α→Primal / δ→Military re-home across HIVYSS.md (§4 mirror, §6, §7, §8, §9) + added the role-triad. The "military" identity now lives entirely with δ.

## 4. The open structural decision (UNRESOLVED — the user's "hardest")
**1 lane vs 2 lanes** — must be the SAME for MVP and full game (foundational; can't switch later). 2 lanes = positional depth + cohesion-concentration + cross-lane knockback (the cool stuff), but a **permanent legibility tax** (the ~20 visual rounds were partly that tax). 1 lane = clean/legible but shallower. Currently built as **2 lanes**, user leaning 2 but hasn't locked it. **Routes (air/land/tunnel) ARE in the MVP** (user insisted): tunnel is sealed (tunnel↔tunnel only); air is "above the lanes" (hits nearest land, lane-agnostic).

## 5. Code state
- **α roster** built (`units/alpha.ts` — α Primal; the legacy "military alpha" units moved to `units/archive.ts` under the `archive` geneline). *(This §5 line predates the Elite-signature work — see §0.5 for the current built state.)*
- **Lanes/routes:** `config/Layout.ts` — `LANE` (air/land/tunnel Y), `LANE_VERTICAL_SPAN` (24), `LANE_DEPTH` (North 0.72×/0.7-alpha = far, South full = near). `getGroundY(route, lane)` in `RouteMatrix.ts`.
- **Pack Cohesion** live (`systems/PassiveHandlers.ts cohesionHandler`) but has **ZERO visual feedback** — you can't see/feel the buff. (Biggest blocker to a fair playtest.)
- **Pheromone command** (Rally/Charge/Retreat) live in the sandbox.
- **Sandbox background = a switchable BIOME system** (`scenes/SandboxScene.ts`): `drawBackground()` → `drawWildSurface()` / `drawCarapaceSurface()` + shared `drawUnderground()`; biome **dropdown in the HUD** (`SandboxHUDScene.buildBiomeDropdown` → `sandboxSelectBiome` event). Redrawable (bgObjects tracked; bg at depth −100 so bases/units survive a biome switch). 2.5D cross-section: sky/forest → grass/sandstone surface → depth-ordered ant-nest tunnel galleries (North sits *behind* the South tunnel's opacity). **All colour knobs are inline hex in those methods.**

## 6. THE NEXT STEP (where the conversation ended)
Per `GENELINES.md §8` build order — **prove the fight is fun, then deepen it:**
1. **Build cohesion visual feedback** (cheap, ~30 min) — a glow/scale/number that grows as the herd packs, so massing *visibly* powers up. Testing an invisible mechanic is guesswork; this makes the playtest answerable. **← recommended immediate task.**
2. **Run the PLAYTEST** (the #1 risk): mass an α herd, FIGHT, command with Rally/Charge/Retreat, judge if it's fun. The user is your eyes on the canvas; you interpret.
3. **Then** α per-unit signatures: Maulhorn knockback (uses existing engine effect) → Goliath **Stampede** (the T3 Elite signature system).
4. Only after combat is proven: β/γ rosters, the map/biomes, faction/quests.

## 7. Gotchas (important)
- **npm/npx FAIL on this Windows machine** (they spawn `bash`, which isn't found). Run binaries directly: gate = `cd app; & .\node_modules\.bin\tsc.cmd --noEmit` then `& .\node_modules\.bin\vitest.cmd run`. Dev server = `& .\node_modules\.bin\vite.cmd` (ports 5173/5174/5175).
- **Gate must stay green:** tsc clean + **632 tests**.
- **A LOT is uncommitted** (design doc, lore v1.5, α tier changes, the whole biome/background system). User manages git — flag it, don't auto-commit.
- You **cannot see the canvas** — the user playtests for *fun* and reports; you interpret.
