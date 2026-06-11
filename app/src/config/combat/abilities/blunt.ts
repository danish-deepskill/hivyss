// Blunt damage abilities. Blunt carries the knockback effect by
// default via DEFAULT_EFFECTS['blunt']; abilities opt out with
// `appliesEffects: []` or override with an explicit list.

import type { AbilityDef } from '../../../types';
import { linearDamageTiers, linearDamageTiersWithKnockForce } from './_tierTables';

export const bluntAbilities: Record<string, AbilityDef> = {
  // Homogenized knockForce = 100 — highest source-unit value from the
  // knockback-refactor audit (Bashguard 100, Legionnaire 20 dissolved
  // into the homogenized value). Flat across all 7 tiers preserves
  // pre-refactor knockback parity; per-tier scaling is a future
  // balance pass.
  bash_strike: {
    name: 'Bash Strike',
    category: 'damage',
    dmgType: 'blunt',
    targeting: 'nearest_enemy_in_range',
    range: 32,
    targetCount: 1,
    trigger: 'onAttack',
    tiers: linearDamageTiersWithKnockForce(100),
  },

  // Goliath's Elite signature — a player-triggered AOE charge that knocks
  // back every enemy in a wide arc around the caster. PLACEHOLDER payload:
  // a flat blunt burst so the trigger system is testable today. The
  // cohesion-scaled version (damage ∝ the herd's packed cohesion, read from
  // the same state `cohesionLevel()` drives the glow) is the next iteration.
  stampede: {
    name: 'Stampede',
    category: 'damage',
    dmgType: 'blunt',
    targeting: 'all_enemies_in_range',
    range: 70,
    targetCount: 4,
    trigger: 'onAttack',
    // Damage-only, NO knockback — opts out of blunt's default 'knockback'
    // effect (the herd tramples through; it doesn't punt). ×0.5 per target —
    // it's an AOE that chips a group, NOT a focused nuke like Maulhorn's ram.
    appliesEffects: [],
    tiers: linearDamageTiers(0.5),
    fx: { kind: 'shockwave' },
    sfx: 'stampede',
  },

  // β Burster — the suicide runner POPS: a hard concussive death-blast that
  // punts the line back (blunt's default knockback rides along). Its body IS
  // the ammunition; the unit's basic attack is an afterthought.
  death_blast: {
    name: 'Death Blast',
    category: 'damage',
    dmgType: 'blunt',
    targeting: 'all_enemies_in_range',
    range: 46,
    targetCount: 5,
    trigger: 'onDeath',
    skipsResistance: true,
    deathDamage: 50,
    fx: { kind: 'shockwave' },
  },

  // Maulhorn's Elite signature — a focused SINGLE-TARGET ram: slams the nearest
  // enemy in front with the hardest knockback in the roster. No shockwave (that's
  // Goliath's AOE) — just the ram body motion + a hard knockback hit.
  ram_charge: {
    name: 'Ram Charge',
    category: 'damage',
    dmgType: 'blunt',
    targeting: 'nearest_enemy_in_range',
    range: 72,            // a charge reaches forward to grab the nearest foe
    targetCount: 1,
    trigger: 'onAttack',
    // NO appliesEffects — keep blunt's default 'knockback' (carries knockForce).
    // ×2.0 damage, knockback 100. NOTE the helper couples knockForce to the
    // damage scale (knockForce = base × dmgMult), so base 50 × ×2 scale = 100.
    tiers: linearDamageTiersWithKnockForce(50, 2),
    // no fx — focused single-target ram, not an AOE shockwave
    sfx: 'ram',
  },
};
