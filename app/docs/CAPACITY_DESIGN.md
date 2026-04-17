# Capacity System — Mini-Spec

> **Status:** IMPLEMENTED 2026-04-12. Created as the implementation companion to `MECHANICS_ROADMAP.md` Item 1. This doc is preserved as-written — it captures the design decisions made *before* coding, including the module-vs-class call and the sign-off items. For implementation status, file list, and findings, see `MECHANICS_ROADMAP.md` Item 1.

## Goal

Add a hard cap on the total "capacity weight" of units a side can field at once. Each `UnitDef` declares a `cap` cost. A side's used cap is the sum of cap from its deployed-alive units plus its incubating units. Deploy is rejected if it would exceed the max.

## Architectural call: module of helpers, not a manager class

The roadmap originally said "new `CapacityManager` (~80 lines)". After mapping the code I'm proposing a smaller approach:

**Capacity is fully derived state.** The single piece of state we need is `MAX_CAPACITY` (a tunable constant). Everything else — used cap, remaining cap, "would this deploy fit" — is a pure function of (units array, incubation chambers, side).

Compare with the existing managers:
- `EconomyManager` is a class because it owns mutable state (`nectar`, `income`, `incomeAcc`).
- `IncubationManager` is a class because it owns `chambers[]` and `larvaCount`.
- `CapacityManager` would own... nothing. The class would be 5 methods over zero fields, which is the textbook smell for "this should be a module."

**Decision:** new file `app/src/systems/Capacity.ts` exporting:
- `MAX_CAPACITY` constant (re-exported from Constants)
- `capUsed(units, side, chambers): number` — pure function
- `canDeploy(def, used, max?): boolean` — pure function
- `capRemaining(used, max?): number` — pure function

If the system grows state later (per-side cap modifiers, temporary cap buffs from abilities, run-difficulty scaling), promote to a class then. **YAGNI applies hard here.**

> **Sign-off needed:** Are you OK with module-of-helpers instead of a class? If you'd rather the parallel structure to EconomyManager / IncubationManager (consistency over minimalism), say so and I'll write it as a class.

## What gets counted

```
sideCap(side) =
    sum( unit.def.cap ?? 0  for unit in GameManager.units if unit.active and unit.side === side )
  + sum( chamber.def.cap ?? 0  for chamber in <side>.incubation.chambers if chamber !== null )
```

- `def.cap ?? 0` — units without a `cap` field count as 0 (the base/hive structure, future summoned tokens, etc.).
- "Deployed alive" = `unit.active === true` (UnitPool's idle pool is `active === false`, so dead units automatically stop counting).
- Incubating = chamber is non-null. Cancellation sets chamber to null, which automatically frees cap. No explicit refund call needed.
- Larvae are NOT counted (decision #2 in roadmap — uncommitted).

## Code touch points

### 1. Add field to `UnitDef`

[types.ts:38](../src/types.ts#L38) — add `cap?: number;` next to `cost`. Optional so the base / future tokens can omit it.

### 2. New file: `app/src/systems/Capacity.ts`

```typescript
import type { UnitDef, Side } from '../types';
import type { Unit } from './Unit';
import type { Chamber } from './IncubationManager';
import { MAX_CAPACITY } from '../config/Constants';

export { MAX_CAPACITY };

export function capUsed(units: Unit[], side: Side, chambers: (Chamber | null)[]): number {
  let total = 0;
  for (const u of units) {
    if (u.active && u.side === side) total += u.def.cap ?? 0;
  }
  for (const c of chambers) {
    if (c) total += c.def.cap ?? 0;
  }
  return total;
}

export function canDeploy(def: UnitDef, used: number, max: number = MAX_CAPACITY): boolean {
  return used + (def.cap ?? 0) <= max;
}

export function capRemaining(used: number, max: number = MAX_CAPACITY): number {
  return Math.max(0, max - used);
}
```

> Verify exact `Chamber` export path during implementation — Explore notes it's defined in `IncubationManager.ts`.

### 3. Add `MAX_CAPACITY` to Constants

`app/src/config/Constants.ts` — add `export const MAX_CAPACITY = 20;` near `MAX_NECTAR`.

### 4. Player deploy validation

[GameManager.ts:277-298](../src/systems/GameManager.ts#L277-L298) — `playerSpawn`. Insert cap check **between** the `isFull()` chamber check and the `economy.spend(def.cost)` line:

```typescript
const used = capUsed(this.units, 'player', this.incubation.chambers);
if (!canDeploy(def, used)) {
  return { success: false, message: 'Capacity full!' };
}
```

Order matters: we need to check cap before spending nectar so a rejected deploy doesn't burn currency.

### 5. AI deploy filter

[AIHiveController.ts:210-228](../src/systems/AIHiveController.ts#L210-L228) — `getAffordableUnits`. After the existing cost filter, add a remaining-cap filter so the AI can't queue picks that would over-cap. AI uses GameManager.units (filtered by `side === 'enemy'`) + its own `this.incubation.chambers`.

```typescript
const aiUsed = capUsed(this.gameManager.units, 'enemy', this.incubation.chambers);
const remaining = capRemaining(aiUsed);

for (const key of this.profile.roster) {
  ...
  if (def.cost > this.nectar) continue;
  if ((def.cap ?? 0) > remaining) continue;  // NEW
  ...
}
```

> Verify: does AIHiveController already have a reference to `gameManager`? If not, pass it in via constructor or store on init. Explore output didn't confirm this — check during implementation. Worst case: AI tracks its own count from chambers + a parallel "alive enemies" filter.

### 6. UI — cap bar

[MenuUIScene.ts:197-225](../src/scenes/MenuUIScene.ts#L197-L225) — mirror the nectar bar DOM structure, distinct color. Pick a cool tone to contrast nectar's gold:

```typescript
// Suggested gradient: cyan/teal — distinct from nectar gold
const capTrack = document.createElement('div');
capTrack.style.cssText = '...same as nectarTrack...';
this.capFill = this.el('div', 'height:100%; background:linear-gradient(90deg,#106080,#40c0e0); ...');
capTrack.appendChild(this.capFill);

// Add label: "12 / 20" text overlay
this.capLabel = ...;
```

**Update path:** Add cap value to the registry write at [WorldScene.ts:163-166](../src/scenes/WorldScene.ts#L163-L166):
```typescript
this.registry.set('capUsed', capUsed(this.gm.units, 'player', this.gm.incubation.chambers));
this.registry.set('capMax', MAX_CAPACITY);
```

MenuUIScene reads in its update loop and sets `capFill.style.width` and the label.

Per-frame cost: `capUsed` is O(N) over ~30 units. Negligible. If profiling ever shows a hot spot we cache it; not worth pre-optimising.

### 7. UI — per-card warning

[MenuUIScene.ts:178-184](../src/scenes/MenuUIScene.ts#L178-L184) — extend the existing card-disabled toggle:

```typescript
const used = this.registry.get('capUsed') ?? 0;
const max = this.registry.get('capMax') ?? MAX_CAPACITY;
this.deckKeys.forEach(key => {
  const d = UNIT_DEFS[key];
  ...
  const wouldExceed = !canDeploy(d, used, max);
  card.classList.toggle('disabled', nectar < d.cost || !canQueue || wouldExceed);
  card.classList.toggle('cap-blocked', wouldExceed);  // for distinct visual
});
```

> **Open during implementation** (per roadmap "Still open" list): exact visual for cap-blocked cards. Roadmap says decide inline. My lean: same disabled state + small cap badge in the corner. Pick when I see it on screen.

### 8. Per-card cap label

[UnitCard.ts:30-36](../src/ui/UnitCard.ts#L30-L36) — add a cap value next to the cost so players can see what each unit weighs:

```typescript
<div class="ucost">${d.cost}n</div>
<div class="ucap">${d.cap ?? 0}c</div>  // NEW
```

Tiny CSS for `.ucap` styling.

## Cap values to apply

From the locked roadmap table (lines 65-89). Repeated here so this doc is self-contained.

**Normal (11):** Grub 1, Hardshell 3, Pricker 2, Skitterling 1, Mendwing 2, Domeback 4, Cinderfly 3, Longeye 3, Wardling 4, Bashguard 5, Stormfly 5

**Alpha (7):** Grunt 1, Mandible 2, Needler 2, Bombardier 3, Legionnaire 4, Ravager 3, Centurion 5

**Max cap:** 20 (player and AI both).

Base/hive structures: no `cap` field → 0 contribution.

## Implementation order

1. Add `MAX_CAPACITY` to Constants
2. Add `cap?: number` to `UnitDef`
3. Apply cap values to all 18 unit defs
4. Create `Capacity.ts`
5. Wire deploy rejection in `GameManager.playerSpawn`
6. Wire AI filter in `AIHiveController.getAffordableUnits`
7. Add registry writes in WorldScene
8. Add cap bar DOM in MenuUIScene
9. Add per-card warning state
10. Add `.ucap` to UnitCard
11. Manual test: spam grubs to 20, can't deploy 21st. Death frees slot. Cancel incubation frees slot. AI never over-caps.
12. Update `MECHANICS_ROADMAP.md`: mark Item 1 ✅, remove stale duplicate "Suggested cap values" table at lines 106-122 and stale action items at 124-129.

## Out of scope (deferred)

- Run-difficulty scaling of max cap (Item 4 balance pass)
- Soft cap with cost penalty (rejected, decision #3)
- Keyword-based cap (Item 2 territory)
- Cap visualization on AI side (debug overlay only — player UI doesn't need to see enemy cap)
- Per-ability cap modifiers (no current ability touches this)

## What I need from you before I start coding

1. **Sign-off on module-of-helpers vs class.** Default = module. Say "use a class" if you'd rather the parallel structure.
2. **Sign-off on cap bar color.** Default = cyan/teal (`#106080 → #40c0e0`).
3. **Confirm cap label format on cards.** `5c` next to `130n`? Different layout?
4. **Confirm "Capacity full!" rejection message** or pick wording you prefer.

Everything else flows from the roadmap decisions and is locked.
