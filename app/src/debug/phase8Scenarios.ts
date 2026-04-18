// Phase 8 smoke test scenarios — PHASE-SCOPED.
//
// LIFECYCLE DISCIPLINE — READ BEFORE EDITING:
//
// These scenario DEFINITIONS are phase-scoped. When Phase 8 closes,
// this file gets DELETED and replaced with phase9Scenarios.ts (by
// the fresh Phase 9 executor as their first task). Do NOT leave old
// scenarios as "examples" — they rot into tech debt (stat values
// change across phases, abilities get renamed, selectors shift).
//
// The scenarios ENGINE at src/debug/scenarioEngine.ts is PERMANENT.
// Do NOT delete it during a phase transition. Only this file gets
// replaced.
//
// Each phase owns its own definitions file:
//   Phase 7b: phase7bScenarios.ts  ← deleted at Phase 8 Stage 1
//   Phase 8:  phase8Scenarios.ts   ← THIS FILE
//   Phase 9:  phase9Scenarios.ts   ← replaces this on Phase 8 close
//
// If you're reading this during Phase 9+ and this file still exists,
// that's a tech-debt bug — delete it.
//
// SCENARIO INVENTORY (locked against phase8Scenarios.test.ts):
//
//   phase7bParity        — Stage 1 live smoke: mixed migrated/legacy
//                          battle, confirms F3 fork + scaffolds
//                          don't regress Phase 6/7/7b parity.
//   bashguardKnockback   — Stage 3 F11 half-migration parity.
//   legionnaireMigration — Stage 3 pure-stat migration.
//   ravagerBerserk       — Stage 4 IP-3 atkRate step function at
//                          50% HP (1.5× rate crossing).
//   wardlingAura         — Stage 4 IP-1 ally dmg_taken -20%.
//   centurionRallyMulti  — Stage 4 IP-2 + IP-5 multi-source aura
//                          cleanup when one of two Centurions dies.
//   mendwingHeal         — Stage 4 IP-5 heal range (F13 90px locked).
//   bombardierDeath      — Stage 5 IP-4 death trigger + 5-Bombardier
//                          cascade against `CombatPipeline.SAFETY_CAP`.
//   stormflyChain        — Stage 5 F4 targetFalloff + F5 Resource-
//                          based overcharge every 4th cast.
//   longeyePierce        — Stage 5 F4 targetFalloff 2-target pierce.
//   stage4AllPassives    — Stage 4 close consolidated smoke (Task 2):
//                          all four Stage 4 migrations in one battle
//                          (Ravager rage + Wardling aura + 2 Centurion
//                          multi-source rally + Mendwing heal) with a
//                          Phase 6/7 regression roster on the enemy
//                          side (Legionnaire blunt:strong, Cinderfly
//                          burn + aoeRider spread, Longeye pierce,
//                          Skitterling fast-attacker HP pressure).
//                          Lands Stage 4 Task 2 BEFORE any unit
//                          migration in items 11-14 per the
//                          decisions-doc stage-boundary smoke policy.
//   stage5AllComplex     — Stage 5 OPEN scenario (Task 1): 5-Bombardier
//                          tight cluster (within 50px death AOE radius),
//                          1 Stormfly on a 3-enemy chain line, 1 Longeye
//                          on a 2-enemy pierce line, versus a Phase 6/7
//                          regression roster with sustained-damage
//                          drivers (Bashguard melee + Cinderfly burn
//                          spread) to grind the Bombardier cluster into
//                          cascade-death range. Legacy baseline captured
//                          in the helpText so Items 15-17 (Bombardier /
//                          Stormfly / Longeye migrations) have a stable
//                          parity anchor. Ships BEFORE any Stage 5 unit
//                          file touches per the decisions-doc stage-
//                          boundary smoke policy.
//
// Adding a new scenario: call registerScenario({ name, description,
// setup, helpText? }) from this file AND update the test inventory.
// Keep scenarios thin — just call the sandbox spawn API in the right
// order, do not embed combat logic or assertions here.

import { registerScenario } from './scenarioEngine';

export function registerPhase8Scenarios(): void {
  registerScenario({
    name: 'phase7bParity',
    description:
      'Phase 8 Stage 1 regression canary — mixed migrated/legacy battle.',
    helpText:
      'All Phase 6/7a/7b migrated units (Skitterling, Cinderfly, ' +
      'Grunt, Mandible, Hardshell, Pricker) plus the Phase 8 ' +
      'migration targets still on legacy (Mendwing, Longeye, ' +
      'Wardling, Legionnaire). Used after every Stage 1–2 working-' +
      'tree change to confirm the F3 fork reversal + scaffold + ' +
      'cross-cutting touches do not regress Phase 7b parity. No ' +
      'console errors, no stuck units, no crash. Mirrors the legacy ' +
      'phase7bScenarios.mixedBattle with the same roster.',
    setup(ctx) {
      ctx.spawn('pricker', 'player', 100);
      ctx.spawn('hardshell', 'player', 160);
      ctx.spawn('grunt', 'player', 220);
      ctx.spawn('mandible', 'player', 270);
      ctx.spawn('cinderfly', 'player', 320);
      ctx.spawn('skitterling', 'player', 370);

      ctx.spawn('longeye', 'enemy', 1100);
      ctx.spawn('mendwing', 'enemy', 1050);
      ctx.spawn('wardling', 'enemy', 1000);
      ctx.spawn('legionnaire', 'enemy', 950);

      ctx.startFight();
    },
  });

  registerScenario({
    name: 'bashguardKnockback',
    description:
      'Phase 8 Stage 3 item 10 — Bashguard F11 half-migration + Phase 2 blunt milestone bookend.',
    helpText:
      'Bashguard F11 half-migration smoke. Spawns Bashguard against ' +
      'three tanks covering the F11 observation matrix (deterministic ' +
      'post Phase 10 variance redesign; knockback refactor dropped ' +
      'knockResist — knockForce now scales with tier parallel to dmgMult ' +
      'via bash_strike tier data):\n' +
      '  - Hardshell (blunt: strong): ' +
      'damage 43 (round(50 × 0.85)), staggers every other hit (force 85).\n' +
      '  - Legionnaire (blunt: strong): ' +
      'damage 43, staggers every other hit (force 85).\n' +
      '  - Domeback (no resistance): ' +
      'damage 50 (normal tier × 1.0), staggers every hit (force 100).\n' +
      'Watch for: no console errors from the knockback Effect lookup, ' +
      'flat 43 on Hardshell/Legionnaire (no variance now).',
    setup(ctx) {
      ctx.spawn('bashguard', 'player', 300);
      ctx.spawn('hardshell', 'enemy', 900);
      ctx.spawn('legionnaire', 'enemy', 960);
      ctx.spawn('domeback', 'enemy', 1020);
      ctx.startFight();
    },
  });

  registerScenario({
    name: 'legionnaireMigration',
    description:
      'Phase 8 Stage 3 — Legionnaire pure-stat migration smoke.',
    helpText:
      'Pre-Stage-3: legacy Legionnaire vs grub cluster. Post-Stage-3: ' +
      'migrated Legionnaire via `defaultAbility`. Damage per hit ' +
      'should match byte-for-byte.',
    setup(ctx) {
      ctx.spawn('legionnaire', 'player', 300);
      ctx.spawn('grub', 'enemy', 900);
      ctx.spawn('grub', 'enemy', 940);
      ctx.spawn('grub', 'enemy', 980);
      ctx.startFight();
    },
  });

  registerScenario({
    name: 'ravagerBerserk',
    description:
      'Phase 8 Stage 4 F5 IP-3 — Ravager atkRate step function at 50% HP.',
    helpText:
      'Watch Ravager attack cadence as HP drops past 50%: the step ' +
      'function via `applyModifiers(u, u.atkRate, atkRate)` should ' +
      'kick from 1× to 1.5× rate exactly when HP crosses the ' +
      'threshold, and snap back if healed above 50%. Use a wounded ' +
      'Ravager vs a long-HP target for a clean observation window.',
    setup(ctx) {
      ctx.spawn('ravager', 'player', 300);
      ctx.spawn('hardshell', 'enemy', 900);
      ctx.spawn('hardshell', 'enemy', 950);
      ctx.startFight();
    },
  });

  registerScenario({
    name: 'wardlingAura',
    description:
      'Phase 8 Stage 4 F5 IP-1 — Wardling ally damage reduction aura.',
    helpText:
      'Wardling covers a stationary Grunt inside 90px range; an ' +
      'enemy Pricker attacks the Grunt. Pre-aura: Grunt takes full ' +
      'damage. Post-aura: Grunt takes ceil(dmg × 0.8). Used to pin ' +
      'the modify-phase subscriber applyAuraDamageModify and the ' +
      'walked-list no-churn property (steady-state ally.modifiers ' +
      'has exactly 1 aura source tag entry).',
    setup(ctx) {
      ctx.spawn('wardling', 'player', 250);
      ctx.spawn('grunt', 'player', 300);
      ctx.spawn('pricker', 'enemy', 900);
      ctx.startFight();
    },
  });

  registerScenario({
    name: 'centurionRallyMulti',
    description:
      'Phase 8 Stage 4 F5 IP-2 + IP-5 — multi-source Centurion rally cleanup.',
    helpText:
      'Two Centurions overlap; a Grunt sits in both ranges. Grunt ' +
      'carries TWO aura:${id}:atk modifiers (additive +40%). Kill ' +
      'one Centurion: the dead-centurion tag is cleaned via passive ' +
      'tick death path; Grunt retains the surviving Centurions tag ' +
      '(+20% net). Legacy `_ralliedByUid` could not express this ' +
      'stacking — this scenario is the source-tracked modifier ' +
      'equivalence smoke.',
    setup(ctx) {
      ctx.spawn('centurion', 'player', 200);
      ctx.spawn('centurion', 'player', 260);
      ctx.spawn('grunt', 'player', 230);
      ctx.spawn('pricker', 'enemy', 900);
      ctx.startFight();
    },
  });

  registerScenario({
    name: 'mendwingHeal',
    description:
      'Phase 8 Stage 4 F5 IP-5 + F13 — Mendwing heal range smoke (90px lock).',
    helpText:
      'Mendwing + 2 wounded allies at mixed distances: one at 50px ' +
      '(inside range) and one at 150px (outside range). F13 default ' +
      'lock is Option B (90px lowest_hp_ally_in_range). The close ' +
      'ally should heal every 2s; the far ally should never heal. ' +
      'If F13 is overruled to Option A (infinite range), both heal.',
    setup(ctx) {
      ctx.spawn('mendwing', 'player', 600);
      ctx.spawn('ravager', 'player', 540); // 40px ahead, inside 90
      ctx.spawn('pricker', 'enemy', 950);
      ctx.spawn('needler', 'enemy', 900);
      ctx.spawn('mendwing', 'enemy', 1200);
      ctx.spawn('mendwing', 'enemy', 1300);
      ctx.spawn('mendwing', 'enemy', 1400);
      ctx.startFight();
    },
  });

  registerScenario({
    name: 'bombardierDeath',
    description:
      'Phase 8 Stage 5 F5 IP-4 + Finding 12 — Bombardier death_bomb.',
    helpText:
      'Single Bombardier dies vs 5-grub cluster; 5 AOE events queue ' +
      'via applyDeathTriggerPhase; each grub takes 65 damage. Finding ' +
      '12 re-entry latch prevents double-fire if two damage events ' +
      'land on the dying Bombardier in one drain cycle. For cascade ' +
      'stress, swap in 5 Bombardiers via the setup and verify the ' +
      'pipeline SAFETY_CAP engages if the cascade is deep enough.',
    setup(ctx) {
      ctx.spawn('bombardier', 'player', 300);
      ctx.spawn('grub', 'enemy', 800);
      ctx.spawn('grub', 'enemy', 830);
      ctx.spawn('grub', 'enemy', 860);
      ctx.spawn('grub', 'enemy', 890);
      ctx.spawn('grub', 'enemy', 920);
      ctx.startFight();
    },
  });

  registerScenario({
    name: 'stormflyChain',
    description:
      'Phase 8 Stage 5 F4 + F5 — Stormfly chain_lightning falloff + overcharge.',
    helpText:
      'Stormfly chain hits up to 3 targets with targetFalloff ' +
      '[1.0, 0.7, 0.4]; every 4th cast doubles via Resource-based ' +
      'overcharge. 25% stun chance per target via ' +
      'appliesEffects: [stun]. Watch damage numbers across casts 1–8 ' +
      'to verify the falloff and the cast-4/cast-8 overcharge spike.',
    setup(ctx) {
      ctx.spawn('stormfly', 'player', 300);
      ctx.spawn('grub', 'enemy', 900);
      ctx.spawn('grub', 'enemy', 940);
      ctx.spawn('grub', 'enemy', 980);
      ctx.startFight();
    },
  });

  registerScenario({
    name: 'longeyePierce',
    description:
      'Phase 8 Stage 5 F4 — Longeye piercing_shot 2-target falloff.',
    helpText:
      'Longeye fires on a 2-grub line. Primary target takes full ' +
      'damage; second target takes ceil(dmg × 0.5). targetFalloff ' +
      '[1.0, 0.5] pinned in the ability data, read by the calculate ' +
      'phase via event._targetIndex.',
    setup(ctx) {
      ctx.spawn('longeye', 'player', 200);
      ctx.spawn('grub', 'enemy', 900);
      ctx.spawn('grub', 'enemy', 940);
      ctx.startFight();
    },
  });

  registerScenario({
    name: 'stage4AllPassives',
    description:
      'Phase 8 Stage 4 close — all four passive migrations (Ravager + Wardling + 2× Centurion + Mendwing) in one battle.',
    helpText:
      'Stage 4 close consolidated smoke per the 2026-04-15 stage-' +
      'boundary cadence. Exercises every Stage 4 migration in one run ' +
      'against a Phase 6/7 regression roster. Run this scenario after ' +
      'items 11-14 land and before writing the Stage 4 close report.\n' +
      '\n' +
      'LAYOUT (player-side x-positions):\n' +
      '  100: Ravager           — FRONTLINE, uncovered baseline\n' +
      '  170: Mendwing          — heals Ravager (F13=B: 70px dist < 90px range)\n' +
      '  220: Centurion 1       — rally_aura 80px → covers 140-300\n' +
      '  260: Grunt             — SHARED: in BOTH Centurion ranges + Wardling\n' +
      '  275: Wardling          — guardian_ward 114px → covers 161-389\n' +
      '  290: Mandible          — SHARED: in BOTH Centurion ranges + Wardling\n' +
      '  300: Centurion 2       — rally_aura 80px → covers 220-380\n' +
      '  360: Pricker           — single-Centurion (C2 only) + Wardling\n' +
      '\n' +
      'OBSERVATIONS (8 total):\n' +
      '\n' +
      '1. Ravager rage (IP-3 + selfModifier step function). Ravager at ' +
      'x=100 is uncovered by both Centurions and Wardling. Skitterling ' +
      '(fast attacker, x=940) closes first and drives Ravager below ' +
      '50% HP. Watch Ravager`s attack cadence step-up from base rate ' +
      'to 1.5× the moment HP crosses 50%. If Ravager is healed back ' +
      'above 50% by Mendwing, cadence should drop back to base rate — ' +
      'the step function works in both directions.\n' +
      '\n' +
      '2. Wardling aura (IP-1 + dmg_taken -20%). Wardling at x=275 ' +
      'covers Pricker/Grunt/Mandible/Centurion1/Centurion2/Mendwing ' +
      '(all within 114px). Float damage numbers on covered allies ' +
      'should be round(baseDmg × 0.8). Compare Ravager (uncovered) ' +
      'damage-taken baseline vs covered allies` reduced damage. ' +
      'Expected ~20% reduction on covered units.\n' +
      '\n' +
      '3. Centurion rally single-source (IP-2 + atk +20%). Pricker at ' +
      'x=360 is covered ONLY by Centurion 2, not Centurion 1 (dist ' +
      'from C1 is 140 > 80). Pricker`s outgoing damage should be ' +
      'round(pricker.atk × 1.2). Compare to Ravager (zero Centurion ' +
      'buffs) for baseline.\n' +
      '\n' +
      '4. Centurion multi-source stacking (2× IP-2 additive). Grunt ' +
      '(x=260) and Mandible (x=290) are in BOTH Centurion ranges. ' +
      'Their outgoing damage should be round(atk × 1.4) (+20% + +20% ' +
      '= +40% additive via ModifierSystem percent stacking). Visible ' +
      'as distinctly higher damage output than Pricker (single ' +
      'Centurion).\n' +
      '\n' +
      '5. Centurion death cleanup — multi-source latch path. Let ' +
      'Centurion 1 die (it will take hits from melee enemies once ' +
      'the line collapses). After C1 dies: Grunt and Mandible`s atk ' +
      'should DROP from +40% to +20% (not back to baseline — ' +
      'Centurion 2 is still alive and its aura stays on). The ' +
      '`_auraCleanedUp` latch + walked-list diff should remove ' +
      'aura:${c1.id}:atk from Grunt/Mandible`s modifier list without ' +
      'touching aura:${c2.id}:atk.\n' +
      '\n' +
      '6. Mendwing heal cadence (IP-5 heal category + F13=B range). ' +
      'Mendwing at x=170 casts heal_pulse every 2s on the lowest-HP ' +
      'ally within 90px. Ravager at x=100 (dist 70) is in range; when ' +
      'Ravager takes damage, Mendwing heals him for 20 per pulse. ' +
      'Green +20 float text on Ravager every 2s. Under F13=A (if ' +
      'orchestrator overrules to infinite range), Mendwing also ' +
      'reaches Pricker/Centurion2/Mandible if any of them drop below ' +
      'maxHp.\n' +
      '\n' +
      '7. Burn spread coexistence (Cinderfly regression canary). ' +
      'Cinderfly at x=980 fires fire_bite on the nearest player unit. ' +
      'Primary gets ActiveEffect burn via appliesEffects; up to 3 ' +
      'adjacent enemies within 85px of primary get burn via the ' +
      'aoeRider primitive (Phase 9 Batch 1 replacement for legacy ' +
      'afterHit spread). Burns tick on player units alongside Stage 4 ' +
      'modifiers; IP-1 Wardling aura reduces burn tick damage via the ' +
      'pipeline modify phase.\n' +
      '\n' +
      '8. Longeye pierce via pipeline (Phase 8 Stage 5 migration). ' +
      'Longeye at x=1020 routes piercing_shot through the multi-target ' +
      'attack cycle with targetFalloff [1.0, 0.5]. Hits 2 player units: ' +
      'first at full damage, second at round(dmg × 0.5).\n' +
      '\n' +
      'IMPLICIT: no console errors anywhere (placeholder knockback ' +
      'from Legionnaire/Bashguard if they appear, IP-1/2/3 gates, ' +
      'applyFinalDamageFloor, F3 fork, F11 coexistence, burn cadence). ' +
      'Bisection protocol: if ANY observation is wrong, stop-and-' +
      'report scenario output and revert the most recent migration ' +
      'first (Mendwing item 14), re-run this scenario, iterate back ' +
      'through Centurion → Wardling → Ravager until smoke clears. ' +
      'The last-undone migration is the culprit.',
    setup(ctx) {
      // Player side — all 4 Stage 4 migrations + damage dealers.
      // Layout per helpText; positions computed against rally_aura
      // range 80 and guardian_ward range 114 so Ravager is the
      // uncovered baseline and Grunt/Mandible sit in BOTH Centurion
      // ranges for multi-source stacking.
      ctx.spawn('ravager', 'player', 100);
      ctx.spawn('mendwing', 'player', 170);
      ctx.spawn('centurion', 'player', 220);
      ctx.spawn('grunt', 'player', 260);
      ctx.spawn('wardling', 'player', 275);
      ctx.spawn('mandible', 'player', 290);
      ctx.spawn('centurion', 'player', 300);
      ctx.spawn('pricker', 'player', 360);

      // Enemy side — regression roster + HP pressure driver.
      // Skitterling is fast (spd 2.2) so it closes first and drives
      // Ravager below 50% HP, triggering the rage step function.
      // Legionnaire carries blunt:strong milestone regression, Cinderfly
      // exercises aoeRider burn spread, Longeye exercises multi-target
      // pierce via the pipeline.

      ctx.spawn('legionnaire', 'enemy', 900);
      ctx.spawn('skitterling', 'enemy', 940);
      ctx.spawn('cinderfly', 'enemy', 980);
      ctx.spawn('longeye', 'enemy', 1020);
      ctx.spawn('grub', 'enemy', 1060);
      ctx.spawn('grub', 'enemy', 1100);

      ctx.startFight();
    },
  });

  registerScenario({
    name: 'stage5AllComplex',
    description:
      'Phase 8 Stage 5 close — all three complex migrations (5× Bombardier death cascade + Stormfly chain + Longeye pierce) in one battle.',
    helpText:
      'Stage 5 close consolidated smoke per the 2026-04-15 stage-' +
      'boundary cadence. Exercises every Stage 5 migration in one run ' +
      'against a regression roster. Run this scenario after items 15-17 ' +
      'land and before writing the Stage 5 close report. Also serves as ' +
      'the PRE-MIGRATION legacy baseline — run once BEFORE Item 15 to ' +
      'capture legacy damage numbers as the parity diff anchor.\n' +
      '\n' +
      'LOCKS EXERCISED:\n' +
      '  F4  — per-target damage falloff on AbilityDef. ' +
      '`chain_lightning.targetFalloff = [1.0, 0.7, 0.4]`, ' +
      '`piercing_shot.targetFalloff = [1.0, 0.5]`.\n' +
      '  F12 — native multi-target for Bombardier death_bomb (selector ' +
      '+ for-loop + queueAbility from `applyDeathTriggerPhase`). The ' +
      '`aoeRider` primitive was added in Phase 9 Batch 1 for Cinderfly; ' +
      'Bombardier still uses the native multi-target path.\n' +
      '  Finding 12 — double-fire guard with asymmetric latch ownership. ' +
      '`_applyDeathEffectsPhase` is CHECK-ONLY on `_deathTriggerFired`; ' +
      '`applyDeathTriggerPhase` is CHECK-AND-SET. Each Bombardier death ' +
      'fires its explosion exactly once even if two damage events land ' +
      'on the already-dead unit in one drain.\n' +
      '\n' +
      'LAYOUT (player-side x-positions):\n' +
      '  140: Bombardier 1  \\\n' +
      '  152: Bombardier 2   |\n' +
      '  164: Bombardier 3   > tight cluster, span 48px,\n' +
      '  176: Bombardier 4   | all within 50px death AOE radius\n' +
      '  188: Bombardier 5  /\n' +
      '  250: Stormfly       — ranged 130, chain_lightning primary on\n' +
      '                        nearest grub; chains to 2 nearest within\n' +
      '                        114px of primary\n' +
      '  200: Longeye        — ranged 240, piercing_shot on 2 nearest\n' +
      '                        in forward arc\n' +
      '\n' +
      'LAYOUT (enemy-side x-positions):\n' +
      '  700: Grub 1  — primary chain/pierce target\n' +
      '  730: Grub 2  — chain target 2 + pierce target 2\n' +
      '  760: Grub 3  — chain target 3\n' +
      '  800: Grub 4  \\\n' +
      '  830: Grub 5   > replacement targets after frontline dies\n' +
      '  860: Grub 6  /\n' +
      '  950: Bashguard  — heavy melee, walks into Bombardier cluster\n' +
      '  900: Cinderfly  — melee fire_bite; aoeRider spreads burn to\n' +
      '                    up to 3 enemies within 85px of primary.\n' +
      '                    Sustained damage on the Bombardier cluster.\n' +
      '\n' +
      'OBSERVATIONS:\n' +
      '\n' +
      '1. Bombardier cluster independent death AOEs (F5 IP-4 + ' +
      'Finding 12 + F12). The `all_enemies_in_range` selector filters ' +
      'by `e.side !== dyingUnit.side` — death AOE hits ENEMIES ONLY. ' +
      'Same-side Bombardiers do NOT damage each other; no cross-' +
      'Bombardier cascade. The 5-Bombardier cluster tests that 5 ' +
      'independent deaths each fire their own AOE burst at nearby ' +
      'enemies via `applyDeathTriggerPhase` → `queueAbility("death_bomb", ' +
      '{ baseDamageOverride: 65 })` per target within 50px ' +
      '(center-to-center). calculatePhase fast path sets finalDamage=65 ' +
      'directly; no variance on death-triggered events. Flat 65 per ' +
      'target modulo target resistance. As enemies grind ' +
      'the cluster down, multiple Bombardiers dying in quick ' +
      'succession fire independent AOE bursts at overlapping enemy ' +
      'targets — the observation target is that each death fires ' +
      'exactly once (Finding 12 guard) and each burst deals 65 per ' +
      'hit independently.\n' +
      '\n' +
      '2. SAFETY_CAP (CombatPipeline.SAFETY_CAP = 200). LEGACY: no ' +
      'engagement. Per-call drain cadence means each onDeath AOE ' +
      'resolves synchronously: 5 deaths x up-to-5 enemy targets = ' +
      'up-to-25 events total, well under 200/drain. No cross-side ' +
      'cascade exists (death AOE is enemy-only), so SAFETY_CAP cannot ' +
      'be reached by same-side Bombardier deaths alone. POST-MIGRATION ' +
      '(Item 15): same constraint applies — `applyDeathTriggerPhase` ' +
      'queues `death_bomb` events at enemies, not allies. Verify cap ' +
      'does NOT engage for a normal 5-death burst (25 events). ' +
      'SAFETY_CAP cascade testing with synthetic cross-side Bombardier ' +
      'pairs (enemy Bombardier kills player Bombardier whose death_bomb ' +
      'kills another enemy Bombardier, etc.) belongs in a dedicated ' +
      'automated test in phase8.test.ts at Item 15, not in this live ' +
      'smoke scenario.\n' +
      '\n' +
      '3. Stormfly chain falloff (targetFalloff live). Multi-target ' +
      'attack cycle sets event._targetIndex + event.damageMultiplier; ' +
      'calculate phase computes finalDamage = applyModifiers(atk) × ' +
      'tierMult × falloff[i] × overcharge with falloff [1.0, 0.7, 0.4]. ' +
      'Expected per-target (normal cast): T1 50, T2 35, T3 20. ' +
      'Overcharge (every 4th cast): T1 100, T2 70, T3 40. ' +
      'Overcharge tracked via `ResourceSystem.castCount % 4 === 0`. ' +
      'Centurion rally aura now buffs chain damage by +20% (post Phase ' +
      '10 Batch 2) — T1 60, T2 42, T3 24 under rally.\n' +
      '\n' +
      '4. Stormfly stun chance (25% per target). ' +
      '`chain_lightning.appliesEffects = ["stun"]` with ' +
      'effectChance 0.25 at queue time. Stun onApply bridges to ' +
      '`stunTimer = 0.6`. "STUNNED!" float fires via the stun FX ' +
      'dispatcher. Stochastic — observe across 8+ casts.\n' +
      '\n' +
      '5. Longeye pierce falloff (F4). Multi-target attack cycle ' +
      'with `piercing_shot.targetFalloff = [1.0, 0.5]`. T1 full ' +
      'damage 60, T2 round(60 × 0.5) = 30.\n' +
      '\n' +
      '6. Bombardier coexistence. Bombardier melee basic attack + ' +
      'death_bomb via `applyDeathTriggerPhase` fire alongside the ' +
      'migrated Stormfly/Longeye multi-target paths — all route ' +
      'through the pipeline.\n' +
      '\n' +
      'IMPLICIT: no console errors anywhere (placeholder knockback ' +
      'lookup, Finding 12 guard, applyFinalDamageFloor, ' +
      'applyVarianceAndCritModify, burn cadence on Cinderfly spread). ' +
      'Bisection protocol: if ANY observation is ' +
      'wrong post-migration, stop-and-report scenario output and ' +
      'revert the most recent migration first (Longeye item 17), ' +
      're-run this scenario, iterate back through Stormfly -> ' +
      'Bombardier until smoke clears. The last-undone migration is ' +
      'the culprit.',
    setup(ctx) {
      // Player side — 5 Bombardiers (tight cluster for death cascade)
      // + Stormfly (chain) + Longeye (pierce). Cluster span 48px;
      // every Bombardier is within 50px of every other's center.
      ctx.spawn('bombardier', 'player', 140);
      ctx.spawn('bombardier', 'player', 152);
      ctx.spawn('bombardier', 'player', 164);
      ctx.spawn('bombardier', 'player', 176);
      ctx.spawn('bombardier', 'player', 188);
      ctx.spawn('stormfly', 'player', 250);
      ctx.spawn('longeye', 'player', 200);

      // Enemy side — 6 grubs (chain/pierce target line) + Bashguard
      // (heavy melee to grind Bombardier HP) + Cinderfly (burn spread
      // on up to 3 adjacent, sustained DoT on the Bombardier cluster).
      // Grubs spaced 30px; first 3 within 60px of primary (all inside
      // Stormfly's 114px chain radius); grubs 4-6 are replacements.
      ctx.spawn('grub', 'enemy', 700);
      ctx.spawn('grub', 'enemy', 730);
      ctx.spawn('grub', 'enemy', 760);
      ctx.spawn('grub', 'enemy', 800);
      ctx.spawn('grub', 'enemy', 830);
      ctx.spawn('grub', 'enemy', 860);
      ctx.spawn('cinderfly', 'enemy', 900);
      ctx.spawn('bashguard', 'enemy', 950);

      ctx.startFight();
    },
  });
}
