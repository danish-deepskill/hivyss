// Combat Rewrite Layer 2 — damage types (static data).
//
// Nine damage types, grouped into three categories. Every attack in
// the rewrite pipeline carries one of these; Layer 4 effects and
// Layer 5 modifiers both key off the DamageType / category.
//
// Category groupings govern "anti-physical" / "elemental ward" style
// resistances: a modifier that says "take 20% less elemental damage"
// filters on category, not on individual types.
//
// Each type ships with a `defaultEffect` — the effect string that will
// be applied when no explicit effect list is set on an ability (e.g.
// every plain heat attack burns unless the ability opts out). These
// strings are UNUSED in Phase 2; the effect registry arrives in Phase 5.
//
// This file is pure data: no imports from types.ts, no runtime side
// effects, safe to consume from tests without pulling Phaser.

export const DAMAGE_TYPES = {
  blunt:    { category: 'physical',  defaultEffect: 'knockback' },
  sharp:    { category: 'physical',  defaultEffect: 'pierce' },
  heat:     { category: 'elemental', defaultEffect: 'burn' },
  cold:     { category: 'elemental', defaultEffect: 'slow' },
  toxic:    { category: 'elemental', defaultEffect: 'poison' },
  electric: { category: 'elemental', defaultEffect: 'stun' },
  psychic:  { category: 'dark',      defaultEffect: 'fear' },
  void:     { category: 'dark',      defaultEffect: 'armor_bypass' },
  holy:     { category: 'dark',      defaultEffect: 'cleanse' },
} as const;

export type DamageType = keyof typeof DAMAGE_TYPES;

export type DamageCategory = (typeof DAMAGE_TYPES)[DamageType]['category'];

/** All damage types that belong to a given category. Pure, cached-by-use. */
export function damageTypesInCategory(category: DamageCategory): DamageType[] {
  const out: DamageType[] = [];
  for (const key of Object.keys(DAMAGE_TYPES) as DamageType[]) {
    if (DAMAGE_TYPES[key].category === category) out.push(key);
  }
  return out;
}

/** Convenience lookup. Throws on an unknown key — static data, must be exhaustive. */
export function getDamageTypeDef(type: DamageType): (typeof DAMAGE_TYPES)[DamageType] {
  const def = DAMAGE_TYPES[type];
  if (!def) throw new Error(`Unknown damage type: ${type}`);
  return def;
}
