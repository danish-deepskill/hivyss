/**
 * Human-readable blurbs for each unit `trait`. Used by BroodScene
 * tooltips and SandboxHUDScene tooltips. Keys match `UnitDef.trait`
 * strings.
 */
export const TRAIT_DESC: Record<string, string> = {
  // Plain / fodder
  grub: 'Cheap fodder, no special ability',
  grunt: 'Cheap fodder, no special ability',
  basic: 'No special ability',
  // Tanks
  wall: 'Slow durable wall, high knock resist',
  shell: 'Mid-tier shelled tank',
  massive: 'Extremely high HP tank',
  // DPS
  swift: 'Glass cannon — extreme speed, very fragile',
  berserk: 'Attack speed increases below 50% HP',
  burn: 'Attacks set up to 3 nearby enemies on fire',
  knockback: 'Heavy bruiser, rams enemies backward on hit',
  area: 'Explodes on death dealing 65 AOE damage (up to 5)',
  // Ranged
  poker: 'Fragile ranged poker, single target',
  // Support
  healer: 'Heals nearest wounded ally every 2s',
  aura: 'Nearby allies take 20% less damage',
  rally: '+20% ATK to 5 nearest allies in range',
  // AOE / chain
  lightning: 'Chain lightning — hits 3 foes, 25% stun, 4th hit = 2x dmg',
};
