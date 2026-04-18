# Hivyss Sprite Style Guide

Style bible for AI-generated concept art / sprites. All prompts to PixelForge (or any Gemini Nano Banana 2 tool) should follow the **Prompt Pattern** below and pass `assets/_ref_tier_a.png` as a reference image.

**Canonical reference:** `assets/_ref_tier_a.png` — the dark-red tick vyssid with layered chitin and glowing abdominal cracks. All future vyssids visually relate to this anchor.

---

## Core Principle: Name the Anatomy, Not the Style

AI image models respond better to **specific body parts and effects** than to abstract style adjectives. Style lives in the reference image; the prompt describes the creature.

**Bad (abstract):**
> "pixel art creature, dark fantasy style, atmospheric, rendered"

**Good (anatomical):**
> "layered chitin plates, swollen abdomen with glowing cracks, jagged mandibles, spines on back"

Let the reference image carry the style. Let the prompt carry the creature.

---

## Prompt Pattern

```
[HOSTILE TEMPERAMENT] [BODY SHAPE] creature,
[POSTURE],
[HEAD FEATURES: eyes, mandibles, antennae],
[BODY FEATURES: chitin plates, spines, cracks, growths],
[LIMBS: count, posture, claws/hooks],
[SIGNATURE TRAIT: glowing parts, bone accents, explosive elements],
dark red primary with white bone accents,
pixel art, side view, clean outline, no background.
```

**Example (the canonical tick):**
```
Hostile tick-like creature, low crouched body, small head, short legs,
jagged mandibles, glowing eyes, layered chitin, swollen explosive 
abdomen with faint glowing cracks, spines on back, dark red primary 
with white bone accents, pixel art, side view, clean outline, no background.
```

---

## Canonical Palette

| Role | Hex | Use |
|---|---|---|
| Primary plate | `#8a2020` | Main armor/carapace color |
| Plate midtone | `#5a1818` | Shadowed plate sides |
| Plate shadow | `#2a0a0a` | Deep crevices between plates |
| Bone accent | `#e8dcc4` | White/ivory plate edges, spines, fangs |
| Glow (warm) | `#ff6030` | Cracks, glowing eyes, ability tells |
| Glow (cool alt) | `#60c0ff` | Alternate ability/faction glow |
| Outline | `#0a0505` | Hard silhouette edge |

**Paste into prompts as:**
```
Palette: #8a2020 primary, #5a1818 midtone, #2a0a0a shadow, 
#e8dcc4 bone accent, #ff6030 glow, #0a0505 outline.
```

---

## Visual Language — Baked-in Mechanics

The style has built-in vocabulary for game feedback. Use consistently:

- **Chitin plate count** → tier progression (Tier 1 = few plates, Tier 5 = heavily layered)
- **Glowing cracks intensity** → ability charge state (idle = faint, charged = bright)
- **Bone accent coverage** → unit age/veteran status (fresh = minimal bone, elder = extensive)
- **Glow color** → faction/geneline (warm red = alpha, cool blue = future geneline, etc.)

---

## Composition Rules

- **Canvas:** 128x128 or 512x512 (downscalable to 24-64px gameplay size)
- **Facing:** left (flip in-engine for right-facing)
- **Ground line:** bottom 15% of canvas — feet/body rest there
- **Headroom:** top 10% empty (reserved for spikes, antennae, air units)
- **Margin:** 5% padding on left/right edges
- **Silhouette:** must read as pure black shape — no floating detail
- **Background:** always transparent (no color fill, no scene context)

---

## Reference Workflow

1. **Always pass reference image** to PixelForge via `references` param:
   ```
   references: ["C:/Work/Simulation/hivyss/assets/_ref_tier_a.png"]
   ```
2. When you generate something clearly better and still on-style, **promote it**: copy over `_ref_tier_a.png`.
3. Never drift the reference more than one generation at a time — small style deltas only.
4. Never mix references. One prompt = one reference image.

---

## Batch Generation Rules

- Generate **4-8 related units in one session** — context drift is worse across sessions than within
- Same reference image for the whole batch
- Same palette declaration for the whole batch
- Vary only the anatomy lines (subject) between prompts
- Save each with descriptive filename: `assets/alpha_grunt_concept.png`, `assets/alpha_mandible_concept.png`

---

## Example Prompts for Existing Alpha Units

**Grunt (Tier 1 soldier):**
```
Hostile ant-like vyssid, crouched hunter stance, small compound eyes,
short curved mandibles, thin chitin plates on thorax, minimal spines, 
six segmented legs, unadorned abdomen, dark red primary with white 
bone accents, pixel art, side view, clean outline, no background.
```

**Mandible (Tier 2 balanced):**
```
Hostile ant-like vyssid, upright combat stance, medium compound eyes,
oversized serrated mandibles, layered chitin plates on thorax and 
abdomen, short back spines, six segmented legs, dark red primary 
with white bone accents on mandible edges, pixel art, side view, 
clean outline, no background.
```

**Bombardier (Tier 3 explosive):**
```
Hostile tick-like vyssid, low crouched body, small head, short legs,
jagged mandibles, glowing eyes, layered chitin, swollen explosive 
abdomen with bright glowing cracks, back spines, dark red primary 
with white bone accents, pixel art, side view, clean outline, no background.
```

**Centurion (Tier 7 elite):**
```
Hostile armored vyssid champion, towering hunched stance, glowing 
eyes, massive jagged mandibles, heavily layered chitin plates across 
entire body, tall back spines with bone tips, muscular six-legged 
frame, extensive white bone accent plating along spine, dark red 
primary with white bone accents, pixel art, side view, clean outline, 
no background.
```

---

## What NOT to Include in Prompts

- ❌ "high quality", "masterpiece", "4k", "detailed" — abstract descriptors don't help and can push toward painterly rendering
- ❌ "anime", "cartoon", "vector" — style pollution
- ❌ Camera language: "wide angle", "bokeh", "depth of field" — these are photo terms that break pixel art
- ❌ Lighting descriptors beyond "clean outline" — reference image carries lighting
- ❌ Multiple creatures in one prompt — generate separately

---

## When AI Sprites Are Used

Current Hivyss units are **procedural canvas draw functions** (`app/src/draws/`). AI sprites are used as:

- **Concept art** to inform procedural draw functions (shape language, silhouette, palette)
- **Design review references** for visual consistency across genelines
- **Mood exploration** for new geneline aesthetics before code is written
- **Placeholder runtime assets** if/when pivoting away from procedural rendering

AI sprites are NOT currently runtime game assets — the procedural system enforces style consistency at render time. If that pivots, update this doc.

---

## Multi-Tier Expansion (Future)

If Hivyss later needs higher-fidelity art (boss portraits, menu splash, lore cards), add tiers below. **Do not cross-reference between tiers** — each tier gets its own reference image and palette.

### Tier B — Portrait/Boss Art (not yet in use)
*TBD when first needed.*

### Tier C — Mood/Concept Boards (not yet in use)
*TBD when first needed.*
