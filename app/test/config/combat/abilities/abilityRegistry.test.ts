import { describe, it, expect } from 'vitest';
import { ABILITIES, lookupAbility, hasAbility } from '../../../../src/config/combat/abilities/index';
import { SELECTORS } from '../../../../src/systems/Targeting';
import { RESISTANCE_TIERS } from '../../../../src/config/combat/resistances';
import type { AbilityDef } from '../../../../src/types';
import type { ResistanceTier } from '../../../../src/config/combat/resistances';

// ------------------------------------------------------------------
// lookupAbility / hasAbility
// ------------------------------------------------------------------

describe('lookupAbility', () => {
  it('returns the AbilityDef for a registered name', () => {
    const a = lookupAbility('jaw_strike');
    expect(a.name).toBe('Jaw Strike');
    expect(a.category).toBe('damage');
    expect(a.dmgType).toBe('sharp');
  });

  it('throws on unknown names', () => {
    expect(() => lookupAbility('fictional_ability')).toThrow();
  });
});

describe('hasAbility', () => {
  it('is true for registered abilities', () => {
    expect(hasAbility('jaw_strike')).toBe(true);
    expect(hasAbility('heal_pulse')).toBe(true);
  });

  it('is false for unknown names — no throw, no side effect', () => {
    expect(hasAbility('nonexistent')).toBe(false);
  });
});

// ------------------------------------------------------------------
// Phase 3 legacy-unit coverage — every legacy unit's attack pattern
// must be represented. This is the Phase 3 exit criterion made
// enforceable: add a new unit with a new attack pattern → this test
// fails until you add its ability.
// ------------------------------------------------------------------

describe('legacy unit attack-pattern coverage', () => {
  // Map of unit key → ability key that represents its legacy attack.
  // Bombardier and Centurion carry TWO entries (basic + special);
  // Wardling carries two (basic + passive ward).
  const COVERAGE: Array<{ unit: string; ability: string }> = [
    // Normal geneline
    { unit: 'hardshell',   ability: 'jaw_strike' },
    { unit: 'grub',        ability: 'jaw_strike' },
    { unit: 'pricker',     ability: 'pricker_jab' },
    { unit: 'domeback',    ability: 'jaw_strike' },
    { unit: 'skitterling', ability: 'jaw_strike' },
    // Phase 8 Stage 4 item 14 — migrated via F5 IP-5 passiveHeal
    // + F13=B locked 90px range. `needle_shot` is Mendwing's
    // offensive (defaultAbility); `heal_pulse` is the passive heal
    // queued by the heal_cast passive handler via a
    // `{ kind: 'heal_cast', abilityName: 'heal_pulse', cooldown: 2 }` passive.
    // Legacy mendwingCombat.onUpdate DELETED.
    { unit: 'mendwing',    ability: 'needle_shot' },
    { unit: 'mendwing',    ability: 'heal_pulse' },
    { unit: 'cinderfly',   ability: 'fire_bite' },
    { unit: 'longeye',     ability: 'piercing_shot' },
    // Phase 8 Stage 4 item 12 — migrated via F5 IP-1 + walked-list
    // aura (dmg_taken -20%, range 114). `jaw_strike` is Wardling's
    // offensive; `guardian_ward` AbilityDef is now pre-rewrite
    // design-doc data (the aura runs via wardlingDef's aura_modifier
    // passive, not via the ability dispatch). Both entries retained — the
    // dual-coverage pattern matches pre-migration design intent
    // that a unit with an offensive attack + passive aura has
    // TWO abilities in the registry.
    { unit: 'wardling',    ability: 'jaw_strike' },
    { unit: 'wardling',    ability: 'guardian_ward' },
    // Phase 8 Stage 3 item 10 — migrated via F11 Option 1
    // half-migration (placeholder knockback + legacy poise). See
    // units/normal.ts bashguardDef comment for the decision tree.
    { unit: 'bashguard',   ability: 'bash_strike' },
    { unit: 'stormfly',    ability: 'chain_lightning' },

    // Alpha geneline
    { unit: 'grunt',       ability: 'jaw_strike' },
    { unit: 'mandible',    ability: 'jaw_strike' },
    { unit: 'bombardier',  ability: 'jaw_strike' },
    { unit: 'bombardier',  ability: 'death_bomb' },
    { unit: 'needler',     ability: 'needle_shot' },
    // Phase 8 Stage 3 item 9 — Legionnaire migrated to bash_strike
    // (F11 half-migration, knockForce: 20). See
    // units/alpha.ts legionnaireDef comment for the decision tree.
    { unit: 'legionnaire', ability: 'bash_strike' },
    // Phase 8 Stage 4 item 11 — migrated via F5 IP-3 + IP-5
    // selfModifier (hp_below_half step function, +50% atkRate).
    // See units/alpha.ts ravagerDef comment for the decision.
    { unit: 'ravager',     ability: 'jaw_strike' },
    // Phase 8 Stage 4 item 13 — migrated via F5 IP-2 + walked-list
    // aura (atk +20%, range 80). SECOND consumer of the aura
    // dispatch branch (first: Wardling item 12). `jaw_strike` is
    // Centurion's offensive; `rally_aura` AbilityDef is now pre-
    // rewrite design-doc data (the aura runs via centurionDef's
    // aura_modifier passive, not via the ability dispatch).
    // Matches the Wardling + guardian_ward dual-coverage pattern.
    { unit: 'centurion',   ability: 'jaw_strike' },
    { unit: 'centurion',   ability: 'rally_aura' },
  ];

  it('every entry points at a registered ability', () => {
    for (const { unit, ability } of COVERAGE) {
      expect(hasAbility(ability), `${unit} → ${ability}`).toBe(true);
    }
  });

  it('every legacy unit has at least one ability defined', () => {
    const unitsCovered = new Set(COVERAGE.map(c => c.unit));
    const expected = [
      'hardshell', 'grub', 'pricker', 'domeback', 'skitterling', 'mendwing',
      'cinderfly', 'longeye', 'wardling', 'bashguard', 'stormfly',
      'grunt', 'mandible', 'bombardier', 'needler', 'legionnaire',
      'ravager', 'centurion',
    ];
    for (const u of expected) {
      expect(unitsCovered.has(u), `missing coverage for ${u}`).toBe(true);
    }
  });
});

// ------------------------------------------------------------------
// Structural invariants — enforced across every registered ability
// so future additions can't drift silently.
// ------------------------------------------------------------------

describe('AbilityDef structural invariants', () => {
  const all: Array<[string, AbilityDef]> = Object.entries(ABILITIES);

  it('every ability has a name and a category', () => {
    for (const [key, a] of all) {
      expect(typeof a.name, key).toBe('string');
      expect(a.name.length, key).toBeGreaterThan(0);
      expect(['damage', 'heal', 'utility', 'passive']).toContain(a.category);
    }
  });

  it('every ability references a registered target selector', () => {
    for (const [key, a] of all) {
      expect(SELECTORS[a.targeting], `${key} → ${a.targeting}`).toBeDefined();
    }
  });

  it('damage abilities carry a dmgType from the 9-type set (except skipsResistance wrappers)', () => {
    // Phase 4 adds `override_damage_event` which is category:'damage' but
    // skipsResistance:true — it uses the HitFlavor bridge at queue time
    // and intentionally has no fixed dmgType. Every OTHER damage ability
    // must declare its dmgType.
    const validTypes = [
      'blunt', 'sharp', 'heat', 'cold', 'toxic',
      'electric', 'psychic', 'void', 'holy',
    ];
    for (const [key, a] of all) {
      if (a.category !== 'damage') continue;
      if (a.skipsResistance) continue;
      expect(a.dmgType, `${key} missing dmgType`).toBeDefined();
      expect(validTypes, key).toContain(a.dmgType);
    }
  });

  it('damage abilities carry a tier table with every tier row (except skipsResistance wrappers)', () => {
    for (const [key, a] of all) {
      if (a.category !== 'damage') continue;
      if (a.skipsResistance) continue;
      expect(a.tiers, `${key} missing tiers`).toBeDefined();
      for (const tier of RESISTANCE_TIERS) {
        expect(a.tiers![tier], `${key} missing tier ${tier}`).toBeDefined();
      }
    }
  });

  it('damage abilities scale with resistance: weakest > normal > strongest', () => {
    for (const [key, a] of all) {
      if (a.category !== 'damage' || !a.tiers) continue;
      const weakest = a.tiers.weakest?.dmgMult ?? 0;
      const normal = a.tiers.normal?.dmgMult ?? 0;
      const strongest = a.tiers.strongest?.dmgMult ?? 0;
      expect(weakest, `${key} weakest should exceed normal`).toBeGreaterThan(normal);
      expect(normal, `${key} normal should exceed strongest`).toBeGreaterThan(strongest);
    }
  });

  it('damage abilities are calibrated to 1.0x at normal (legacy parity)', () => {
    // Phase 3 locks the normal-tier multiplier at 1.0 so legacy battles
    // running through the pipeline in Phase 4 produce identical numbers
    // (no silent buffs from the rewrite). Phase 10 can revisit.
    // skipsResistance wrappers are exempt — they use baseDamageOverride.
    //
    // INTENTIONALLY off-calibration (Elite signatures, balance-by-design):
    //   stampede   ×0.5 — AOE herd-trample, low per-target by design.
    //   ram_charge ×2.0 — single-target heavy hit, the trade for no AOE.
    // These are deliberate, not "silent rewrite buffs"; pin them explicitly.
    const RESCALED: Record<string, number> = { stampede: 0.5, ram_charge: 2.0 };
    for (const [key, a] of all) {
      if (a.category !== 'damage') continue;
      if (a.skipsResistance) continue;
      expect(a.tiers?.normal?.dmgMult, key).toBe(RESCALED[key] ?? 1.0);
    }
  });

  it('tier multipliers are all positive', () => {
    for (const [key, a] of all) {
      if (!a.tiers) continue;
      for (const tier of Object.keys(a.tiers) as ResistanceTier[]) {
        const stats = a.tiers[tier]!;
        expect(stats.dmgMult, `${key} tier ${tier}`).toBeGreaterThan(0);
      }
    }
  });

  it('heal abilities carry a positive healAmount', () => {
    for (const [key, a] of all) {
      if (a.category === 'heal') {
        expect(a.healAmount, `${key} healAmount`).toBeDefined();
        expect(a.healAmount!, key).toBeGreaterThan(0);
      }
    }
  });

  it('passive abilities carry either auraMods or appliesEffects', () => {
    for (const [key, a] of all) {
      if (a.category !== 'passive') continue;
      const hasAura = a.auraMods !== undefined;
      const hasEffects = a.appliesEffects !== undefined && a.appliesEffects.length > 0;
      expect(hasAura || hasEffects, `${key} passive has no payload`).toBe(true);
    }
  });

  it('every ability has a sensible range (>0 or explicitly passive/self/no_targeting)', () => {
    for (const [key, a] of all) {
      if (a.targeting === 'self') continue;
      if (a.targeting === 'no_targeting') continue; // wrapper sentinel — Phase 4
      expect(a.range, `${key} range`).toBeDefined();
      expect(a.range!, key).toBeGreaterThan(0);
    }
  });
});

// ------------------------------------------------------------------
// Specific ability spot checks — pin the exact shape of the
// headline abilities so accidental edits break loudly.
// ------------------------------------------------------------------

describe('Ability spot checks', () => {
  it('jaw_strike — basic sharp melee, single target, onAttack', () => {
    const a = lookupAbility('jaw_strike');
    expect(a.category).toBe('damage');
    expect(a.dmgType).toBe('sharp');
    expect(a.trigger).toBe('onAttack');
    expect(a.targetCount).toBe(1);
  });

  it('piercing_shot — long-range sharp with count=2 (Longeye)', () => {
    const a = lookupAbility('piercing_shot');
    expect(a.dmgType).toBe('sharp');
    expect(a.targetCount).toBe(2);
    expect(a.range).toBeGreaterThanOrEqual(200);
  });

  it('fire_bite — heat (Cinderfly); burn applied via DEFAULT_EFFECTS', () => {
    const a = lookupAbility('fire_bite');
    expect(a.dmgType).toBe('heat');
    // appliesEffects undefined → DEFAULT_EFFECTS['heat'] = 'burn'
    // applies at queueAbility time. Exercised in phase7b/8 integration
    // tests; this spot check just pins the declarative shape.
    expect(a.appliesEffects).toBeUndefined();
  });

  it('death_bomb — heat AOE with onDeath trigger, explicit burn opt-out', () => {
    const a = lookupAbility('death_bomb');
    expect(a.dmgType).toBe('heat');
    expect(a.trigger).toBe('onDeath');
    expect(a.targetCount).toBe(5);
    // Explicit [] opts out of the heat → burn default; death_bomb is
    // a one-shot blast, not an ignition.
    expect(a.appliesEffects).toEqual([]);
  });

  it('chain_lightning — electric count=3 (Stormfly); stun via DEFAULT_EFFECTS', () => {
    const a = lookupAbility('chain_lightning');
    expect(a.dmgType).toBe('electric');
    expect(a.targetCount).toBe(3);
    // appliesEffects undefined → DEFAULT_EFFECTS['electric'] = 'stun'
    // applies at queueAbility time, gated by tier effectChance: 0.25.
    expect(a.appliesEffects).toBeUndefined();
  });

  it('heal_pulse — heal category, Mendwing healAmount=20', () => {
    const a = lookupAbility('heal_pulse');
    expect(a.category).toBe('heal');
    expect(a.dmgType).toBeUndefined();
    expect(a.healAmount).toBe(20);
    expect(a.targeting).toBe('lowest_hp_ally_in_range');
  });

  it('rally_aura — passive with +20% atk aura (Centurion)', () => {
    const a = lookupAbility('rally_aura');
    expect(a.category).toBe('passive');
    expect(a.trigger).toBe('passive');
    expect(a.auraMods?.atkMult).toBe(1.2);
  });

  it('guardian_ward — passive with -20% damage taken aura (Wardling)', () => {
    const a = lookupAbility('guardian_ward');
    expect(a.category).toBe('passive');
    expect(a.auraMods?.dmgTakenMult).toBe(0.8);
  });

  it('override_damage_event — Phase 4 wrapper sentinel', () => {
    const a = lookupAbility('override_damage_event');
    expect(a.category).toBe('damage');
    expect(a.skipsResistance).toBe(true);
    expect(a.targeting).toBe('no_targeting');
    // No dmgType on the wrapper — HitFlavor bridge sets it per-event.
    expect(a.dmgType).toBeUndefined();
    // No tier table — calculate phase uses baseDamageOverride instead.
    expect(a.tiers).toBeUndefined();
  });
});
