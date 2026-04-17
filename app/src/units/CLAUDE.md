# Unit Design Pattern

## File Structure

Each unit is a self-contained module in `src/units/`:

```
src/units/
  registry.ts        — Imports all units, exports UNIT_DEFS, TIER_DEFS, drawUnit
  renderUtils.ts     — Shared drawing helpers (hexToInt, lerpColor, drawCommonParts)
  <unitname>.ts      — One file per unit (stats + draw function)
```

## Adding a New Unit

1. Create `src/units/<unitname>.ts` following the template below
2. Add `import * as <unitname> from './<unitname>'` in `registry.ts`
3. Add `<unitname>` to the `UNITS` object in `registry.ts`
4. Enemy mirror is auto-generated (no manual enemy def needed)
5. Add to wave compositions in `src/config/WaveDefs.ts` if desired (key = `e<unitname>`)
6. Add `TRAIT_DESC` entry in `src/scenes/DeckScene.ts` `showTooltip()` for tooltip text

UNIT_DEFS / DRAW_MAP auto-build from UNITS.

## Unit File Template

```ts
import type { UnitDef, DrawFunction } from '../types';
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
  primary: 0x50a8f0,       // Primary body color (hex integer)
  secondary: 0x1a4880,     // Dark/accent color for outlines, limbs
  trait: 'unique_trait',   // Must be unique — maps to draw function
  desc: 'Short Desc',      // Shown on card (keep under ~15 chars)
  tier: 3,                 // 1-11, see Tier Guidelines below
  defaultAbility: 'jaw_strike',  // Every unit has one — routes through the pipeline
};

export const draw: DrawFunction = (g, u, cx, uy) => {
  // Draw the unit body here. See "Draw Function Conventions" below.
};
```

## Unit Behavior — Data-Driven, Not Hooks

**There are no `CombatHooks` anymore.** Unit behavior is defined entirely in data:

- **Basic attack** — `defaultAbility: 'ability_name'` on the def. The ability lives in `config/combat/abilities/` and carries dmgType, targeting, range, targetCount, tiers, appliesEffects, targetFalloff, chainRange, overchargeEvery, aoeRider — everything the pipeline needs.
- **Passive behaviors** — `auraModifier`, `selfModifier`, `passiveHeal` fields on the def. The IP-5 passive tick loop reads these every frame and dispatches source-tracked modifiers / heal casts.
- **Death triggers** — `deathAbility: 'ability_name'` on the def. `applyDeathTriggerPhase` queues the named ability when the unit dies.
- **Status effects** — `appliesEffects: ['burn', 'stun', ...]` on the ability. EffectDef declares `duration`, `tiers`, lifecycle hooks (`onApply`, `onTick`, `onExpire`, `onStack`).
- **AOE spread** — `aoeRider: { effect, radius, targetCount, excludePrimary }` on the ability. `applyAoeRiderPhase` applies the effect to nearby targets.
- **Damage multipliers** — `targetFalloff: number[]` (per-target scaling), `overchargeEvery: number` (every-Nth-cast doubling via ResourceSystem).
- **Multi-target chains** — `chainRange: number` on the ability (chain-from-primary selection, Stormfly).

Nothing is defined in procedural code on the unit anymore. Design new units by composing data.

## The `ctx` Object (CombatContext)

Draw functions don't receive `ctx`. Pipeline subscribers (`applyHealPhase`, `applyEffectsPhase`, `applyAoeRiderPhase`, `applyDeathTriggerPhase`) receive `DamageEvent` + read `_currentCtx` from CombatSystem for FX dispatch.

For FX routing, use the registered dispatchers:

- `setHealFxDispatcher` — heal `+N` float + heal sound
- `setDotDispatcher` — DOT damage routed via pipeline with `baseDamageOverride`
- `setDeathTriggerDispatcher` — death explosion FX + selector + queueAbility loop
- `setStunFxDispatcher` — "STUNNED!" float
- `setAoeRiderAliveAccessor` — alive-list provider for `applyAoeRiderPhase`

These are module-level singletons set by the CombatSystem constructor. Tests stub them.

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
- `hexToInt(u.primary)` — primary body fill color
- `hexToInt(u.secondary)` — dark accent for outlines, limbs, details
- Fixed colors for effects (fire: 0xff6010, poison: 0x80ff40, electric: 0x80ffff, etc.)

### Animation
- `u.bob` — continuously incrementing float, use with `Math.sin(u.bob * speed)` for oscillation
- `u.state` — `'march'` or `'attack'`, use for idle vs attack animations
- `u.hp / u.maxHp` — health fraction, use for rage/damage visuals
- `u.resources?.castCount` — accessible for visual anticipation (e.g. Stormfly overcharge ring)

### Visual Signature Rules
- Every unit MUST have a visually distinct silhouette
- Every unit SHOULD have a unique visual feature (horn, wings, glow, weapon, stripes, etc.)
- Attack state should have a visible effect (muzzle flash, jaw open, impact lines, etc.)
- Higher tier units should look more elaborate/detailed
- Units that draw their own legs/antennae should NOT call `drawCommonParts`

## Trait System

Each unit has a unique `trait` string that maps to its draw function via the registry DRAW_MAP and shows in tooltip descriptions in `src/scenes/DeckScene.ts`.

For units with no visual flourish beyond the basic body, `drawBasicBody` is the default fallback.

## Tier Guidelines

Numeric tiers 1-11 (see TIER_DEFS in registry.ts for full names). Rough cost bands:

| Tier | Cost Range | Power Level |
|------|-----------|-------------|
| 1-2  | 15-40     | Fodder / baseline |
| 3-4  | 50-85     | Specialists |
| 5-6  | 85-130    | Elites |
| 7+   | 150+      | Legendary / endgame |

## Registry (registry.ts)

When adding a unit, add two things:
```ts
import * as newunit from './newunit';

const UNITS: Record<string, UnitModule> = {
  // ... existing units
  newunit,  // <-- add here
};
```

The registry auto-builds UNIT_DEFS and DRAW_MAP from the UNITS object.
