# Procedural Draw Style — Quality Bar for Unit Art

> **Purpose:** The art bar for procedural unit draws. Procedural is the **final** MVP/EA art direction — so "programmer-art ellipses" is not acceptable. This is *how* to make Phaser-Canvas bugs look genuinely good, concretely.
>
> **Pairs with:** `app/src/units/CLAUDE.md` (draw structure + coordinate conventions), `TIER_CONTRACT.md` §5 (per-tier visual budget — the *what*), this doc (the *how*).
>
> **API constraint** (from CLAUDE.md): valid = `fillEllipse`, `strokeEllipse`, `fillCircle`, `arc`, `fillRect`, `lineBetween`. No native gradient fill on Graphics ellipses — so we fake volume with **layered offset shapes** (below).
>
> **Status:** DRAFT 2026-05-31. The α roster sets the reference; refine as the style matures.

---

## The one thing that matters most: FAKE LIGHT

Flat-filled ellipses read as "unfinished." The single biggest upgrade is **consistent shading from one light direction** — and it costs ~3 draw calls per body segment.

**Light comes from the top-left.** Always. Across every unit. (Consistency *is* the polish.)

So every body segment is **3 stacked ellipses**, not one:
1. **Shadow/rim** — a slightly larger ellipse in a *darkened* color, offset **down-right** (away from light).
2. **Base** — the main fill.
3. **Highlight** — a smaller ellipse in a *lightened* color, offset **up-left** (toward light).

### Add this helper to `units/renderUtils.ts`
```ts
// A body segment with fake volume (light from top-left). Use this for
// every abdomen/thorax/head instead of a flat fillEllipse.
export function shadedBlob(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, w: number, h: number,
  color: number,
): void {
  const shadow = lerpColor(color, 0x000000, 0.42);
  const light  = lerpColor(color, 0xffffff, 0.34);
  g.fillStyle(shadow); g.fillEllipse(cx + w * 0.05, cy + h * 0.07, w * 1.06, h * 1.06); // rim/shadow
  g.fillStyle(color);  g.fillEllipse(cx, cy, w, h);                                      // base
  g.fillStyle(light);  g.fillEllipse(cx - w * 0.13, cy - h * 0.15, w * 0.48, h * 0.42);  // highlight
}
```
`lerpColor` + `hexToInt` already exist in `renderUtils.ts`. **This one helper is ~80% of the visual upgrade.** Author every body segment through it.

---

## Layered draw order (per unit)
```
1. Ground shadow        (flat dark ellipse on the ground, low alpha)
2. Back legs/limbs      (behind the body)
3. Body segments        ← shadedBlob() for each: abdomen → thorax → head
4. Carapace detail      (plate seams, segmentation — strokeEllipse / arc / lineBetween)
5. Patterning           (spots/stripes — small fillCircle / lineBetween in accent color)
6. Front legs/antennae  (in front of the body, with secondary motion via u.bob)
7. Eyes                 (shadedBlob-lite: dark socket + bright iris + tiny white glint)
8. Signature feature    (horn/tusk/wing/shield — the unit's silhouette hook)
9. Bioluminescence      (higher tiers — see below)
10. Attack FX           (via getStrike — the strike anim seam)
```

---

## Detail techniques (cheap, high-impact)

- **Carapace seams** — `strokeEllipse` a slightly smaller arc inside a segment, or `lineBetween` plate-lines, in the shadow color. Reads as chitin plating.
- **Segmentation** — 2–3 thin darker arcs across the abdomen.
- **Eyes** — never a flat white circle. Dark socket (`fillCircle` shadow) → colored/black iris → **one tiny white glint** offset up-left. The glint alone makes a unit feel alive.
- **Patterning** — a few accent-color spots (`fillCircle`) or stripes (`lineBetween`); asymmetric > symmetric.
- **Outline** — the `shadedBlob` rim layer *is* the outline; keep it subtle, not a hard black stroke.

## Bioluminescence (T3+ per TIER_CONTRACT §5)
Glow = stacked translucent circles, largest+faintest first:
```ts
g.fillStyle(glowColor, 0.10); g.fillCircle(x, y, r * 2.2);
g.fillStyle(glowColor, 0.18); g.fillCircle(x, y, r * 1.4);
g.fillStyle(glowColor, 0.9);  g.fillCircle(x, y, r);        // hot core
```
Use sparingly — joints, eyes, signature organ. Lower tiers (T0–T2): little to none.

---

## Per-tier visual budget (the MVP band: T0–T4)
From `TIER_CONTRACT.md` §5 — author *to* this, don't under-hit it:

| Tier | Segments | Colors | Ornament | Biolum | Notes (α MVP) |
|---|---|---|---|---|---|
| T0 | 1–2 | 1 (+ dark underbelly) | none | none | Grazeling — simple but *shaded* |
| T1 | 2–3 | 1 + accent | one feature (horn/spine) | none | Goreling, Hornback |
| T2 | 3 | 1 + accent pattern | one asymmetric organ | none | Trampler |
| T3 | 3–4 | 2 integrated | layered carapace, rank sigil | subtle at rest | Packlord, Stampeder |
| T4 | 4 | 2–3 | ritual markings, upright stance | **joints glow** | Goliath (Elite) |

**Higher tier = more elaborate, more shaded, more glow.** The visual escalation should be readable at a glance.

---

## Color
- Use the geneline palette (`u.primary` / `u.secondary` / `palette`); derive highlight/shadow via `lerpColor` (don't hand-pick — keep it consistent with `shadedBlob`).
- α Primal palette lean: earthy/primal — ochres, rust-reds, bone, dark chitin. (Final palette TBD; this is the flavor.)

---

## "Is this draw good enough?" checklist
- [ ] Every body segment uses `shadedBlob` (has volume, not flat)?
- [ ] Light reads as top-left, consistent with other units?
- [ ] Distinct **silhouette** — recognizable from the shape alone?
- [ ] One **signature feature** (the unit's visual hook)?
- [ ] Eyes have a **glint**?
- [ ] At least one detail layer (carapace seam / patterning)?
- [ ] Tier-appropriate elaboration per §5 (higher tier = more)?
- [ ] Attack reads via `getStrike` (the strike anim)?

If all checked, it clears the bar. If it's flat ellipses, it doesn't.

---

## Scope note
This is the bar for **newly authored** units (the α roster, Step 1). The **17 legacy units** keep their old flat draws for now — a full art-elevation retrofit is a **pre-EA polish pass**, *after* the fight is proven fun (it does not serve the #1 risk). Don't retrofit during Phase 0; *do* author α to this bar from the start (cheaper than redrawing).
