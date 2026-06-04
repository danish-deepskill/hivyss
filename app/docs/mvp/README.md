# Hivyss MVP — design docs

> **One folder, one entry point.** Everything about the MVP's design and scope lives here. Read **`VISION.md` first** — it's the **authoritative** top-level; the rest are domain references it builds on. **Where two docs differ, `VISION.md` wins** (it's the newest).

## Read order
1. **`VISION.md`** — **AUTHORITATIVE.** Game identity · the core loop · the hive / Royal / caste / pheromone / worker systems · the **MVP slice (in vs out)** · the build order. Start here.
2. **`REQUIREMENTS.md`** — scope budget + constraints (layers / nodes / genelines / tiers / units) · the **combat-first build sequence** · explicit out-of-scope. *(Superseded-in-part by VISION — see its top note.)*
3. **`GENELINES.md`** — the 4 genelines (α/β/γ/δ): rosters · biomes · the **node/territory map** · the faction model. The geneline + map **content** source of truth.
4. **`ALPHA.md`** — α Primal in depth (identity · roster ecosystem · build path). The Phase-0 showcase geneline.
5. **`MECHANICS_INVENTORY.md`** — built-vs-lore **status audit** (what's *coded* vs *designed*). The "where are we" reference — not design.
6. **`PHASE0_BUILD.md`** — Phase-0 build notes.

## Authority & the one rule
- **`VISION.md` is the newest top-level design** and **supersedes** earlier scope decisions where they conflict — notably it *expands* the MVP to make the **hive-build loop + a thin controllable Royal core** (older `REQUIREMENTS.md` had deferred them; it now defers to VISION).
- **`VISION.md` itself defers to `GENELINES.md`** for geneline-roster + node-map + biome **content** detail.
- So: **scope/systems → VISION · geneline+map content → GENELINES · budget/constraints → REQUIREMENTS · status → MECHANICS_INVENTORY.** No "which doc wins" ambiguity.

## The one rule above all of it
The **#1 risk is unchanged and still un-gated: *is the α fight fun?*** Everything in this folder is **designed-now / built-after** that's proven. Don't let the volume of design here front-run the playtest.
