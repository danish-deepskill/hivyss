# Unit Design Pattern

## File Structure

Each unit is a self-contained module in `src/units/`:

```
src/units/
  registry.ts        — Imports all units, exports UNIT_DEFS, TIER_DEFS, COMBAT_MAP, drawUnit
  renderUtils.ts     — Shared drawing helpers (hexToInt, lerpColor, drawCommonParts)
  enemyTraits.ts     — Draw functions + combat hooks for enemy-only traits (boss, shield, poison)
  <unitname>.ts      — One file per unit (stats + draw function + optional combat hooks)
```

## Adding a New Unit

1. Create `src/units/<unitname>.ts` following the template below
2. Add `import * as <unitname> from './<unitname>'` in `registry.ts`
3. Add `<unitname>` to the `UNITS` object in `registry.ts`
4. Enemy mirror is auto-generated (no manual enemy def needed)
5. Add to wave compositions in `src/config/WaveDefs.ts` if desired (key = `e<unitname>`)
6. Add `TRAIT_DESC` entry in `src/scenes/DeckScene.ts` `showTooltip()` for tooltip text

That's it — UNIT_DEFS, DRAW_MAP, COMBAT_MAP auto-build from UNITS.

## Unit File Template

```ts
import type { UnitDef, CombatHooks, DrawFunction } from '../types';
import { hexToInt, drawCommonParts } from './renderUtils';

export const def: UnitDef = {
  name: 'UnitName',
  ico: '\u{EMOJI}',        // Unicode emoji for UI fallback
  hp: 100,
  atk: 30,
  spd: 1.0,                // Movement speed (scaled by S * SPD_MULT automatically)
  range: 20,               // Attack range in px (scaled by S automatically)
  atkRate: 0.8,            // Attacks per second
  cost: 50,                // Nectar cost to deploy
  reward: 20,              // Nectar earned when enemy version is killed
  w: 16, h: 14,            // Base sprite dimensions (scaled by S automatically)
  col: 0x50a8f0,           // Primary body color (hex integer)
  dk: 0x1a4880,            // Dark/accent color for outlines, limbs
  trait: 'unique_trait',   // Must be unique — maps to draw function AND combat hooks
  desc: 'Short Desc',      // Shown on card (keep under ~15 chars)
  tier: 'D',               // F, E, D, C, B, A, S, SS, SSS
};

// Optional: combat hooks (only export if the unit has special abilities)
export const combat: CombatHooks = {
  // See "Combat Hook System" below for available hooks
};

export const draw: DrawFunction = (g, u, cx, uy) => {
  // Draw the unit body here. See "Draw Function Conventions" below.
};
```

## Combat Hook System

Each unit can optionally export a `combat` object with hooks. CombatSystem calls these
hooks at the right time — no need to modify CombatSystem when adding new units.

### Available Hooks

| Hook | Signature | When Called | Return |
|------|-----------|------------|--------|
| `onSpawn` | `(u, ctx)` | Once when unit first enters combat | void |
| `onUpdate` | `(u, dt, ctx)` | Every frame (passive effects) | `true` to skip normal AI |
| `onAttack` | `(u, target, foes, dmg, ctx)` | Replaces default attack logic | void |
| `afterHit` | `(u, target, dmg, ctx)` | After dealing damage to target | void |
| `onDeath` | `(u, ctx)` | When this unit dies | void |
| `modifyDamage` | `(u, dmg, ctx)` | Incoming damage to self | modified dmg |
| `modifyAllyDamage` | `(auraUnit, target, dmg, ctx)` | Damage to a nearby ally | modified dmg |
| `getAtk` | `(u)` | Override ATK calculation | ATK value |

### The `ctx` Object (CombatContext)

All hooks receive a typed context object:
```ts
{
  particles: ParticleManager | null;
  audio: AudioManager | null;
  scene: Phaser.Scene;
  allAlive: Unit[];
  S: number;                              // Scale factor (W / 900)
  events: { emit(event, data): void };    // EventBus for cross-system events
  hitUnit(target, dmg, dmgType): void;    // Apply damage (triggers modifiers + death)
  playHitSound(type): void;               // Play hit SFX ('melee' | 'ranged' | 'aoe' | 'heal')
}
```

### Hook Examples

**Simple on-hit effect (burn):**
```ts
export const combat: CombatHooks = {
  afterHit(u, target, dmg, ctx) {
    target.burnTimer = 2;
    target.burnDmgAcc = 0;
  },
};
```

**Custom attack (chain lightning):**
```ts
export const combat: CombatHooks = {
  onAttack(u, target, foes, dmg, ctx) {
    ctx.hitUnit(target, dmg, 'ranged');
    // ... chain to more targets
    ctx.playHitSound('aoe');
  },
};
```

**Passive aura:**
```ts
export const combat: CombatHooks = {
  modifyAllyDamage(auraUnit, target, dmg, ctx) {
    if (Math.abs(auraUnit.x - target.x) < 80 * ctx.S) {
      return Math.ceil(dmg * 0.8); // 20% reduction
    }
    return dmg;
  },
};
```

**ATK modifier (berserk):**
```ts
export const combat: CombatHooks = {
  getAtk(u) {
    const hpFrac = u.hp / u.maxHp;
    if (hpFrac <= 0.25) return u.atk * 2;
    if (hpFrac <= 0.5) return u.atk * 1.5;
    return u.atk;
  },
};
```

### Units WITHOUT Special Abilities

Units with no special combat behavior (grub, mandible, zephyr, locust, scarab) do NOT
need a `combat` export. CombatSystem uses default melee/ranged attack based on range.

## Draw Function Conventions

### Coordinate System
- `cx` is the horizontal center of the unit
- `uy` is the top of the unit (already includes bob animation offset)
- All positions should be relative to `cx`/`uy` using fractions of `u.w` and `u.h`
- Use `u.facing` (1 or -1) to mirror the unit horizontally
- Sub-pixel coordinates are fine — WebGL handles them natively

### Body Structure (back to front)
1. **Special backgrounds** (auras, glows, hover shadows) — draw first
2. **Abdomen** — largest ellipse, positioned behind center
3. **Thorax** — middle section
4. **Head** — front section, positioned in facing direction
5. **Signature feature** — horn, wings, shield, weapon, etc.
6. **Attack effects** — only visible when `u.state === 'attack'`
7. **Common parts** — call `drawCommonParts(g, u, cx, uy)` for standard mandibles/antennae/legs, OR draw custom ones

### Color Usage
- `hexToInt(u.col)` — primary body fill color
- `hexToInt(u.dk)` — dark accent for outlines, limbs, details
- Fixed colors for effects (fire: 0xff6010, poison: 0x80ff40, electric: 0x80ffff, etc.)

### Animation
- `u.bob` — continuously incrementing float, use with `Math.sin(u.bob * speed)` for oscillation
- `u.state` — `'march'` or `'attack'`, use for idle vs attack animations
- `u.hp / u.maxHp` — health fraction, use for rage/damage visuals

### Visual Signature Rules
- Every unit MUST have a visually distinct silhouette
- Every unit SHOULD have a unique visual feature (horn, wings, glow, weapon, stripes, etc.)
- Attack state should have a visible effect (muzzle flash, jaw open, impact lines, etc.)
- Higher tier units should look more elaborate/detailed
- Units that draw their own legs/antennae should NOT call `drawCommonParts`

## Trait System

Each unit has a unique `trait` string that:
1. Maps to its draw function via the registry DRAW_MAP
2. Maps to its combat hooks via the registry COMBAT_MAP
3. Shows in tooltip descriptions in `src/scenes/DeckScene.ts`

When adding a new trait with special abilities:
- Add `combat` export in the unit file (gameplay hooks)
- Add `draw` function in the unit file (visual)
- Add `TRAIT_DESC` in DeckScene.ts `showTooltip()` (tooltip text)

For units with no special ability, only `draw` is needed.

## Tier Guidelines

| Tier | Cost Range | Power Level | Complexity |
|------|-----------|-------------|------------|
| F    | 10-20     | Fodder      | No ability |
| E    | 30-45     | Basic       | Simple ability |
| D    | 50-85     | Specialized | One strong ability |
| C    | 85-125    | Elite       | Strong ability + extra mechanic |
| B    | 125-160   | Rare        | Multi-hit or compound abilities |
| A    | 160+      | Epic        | Powerful unique mechanic |
| S+   | 200+      | Legendary   | Game-changing ability |

## Registry (registry.ts)

When adding a unit, add two things:
```ts
import * as newunit from './newunit';

const UNITS: Record<string, UnitModule> = {
  // ... existing units
  newunit,  // <-- add here
};
```

The registry auto-builds UNIT_DEFS, DRAW_MAP, and COMBAT_MAP from the UNITS object.
No other registration needed — combat hooks are picked up automatically from the
unit's `combat` export.
