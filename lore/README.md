# Hivyss Map System

Data-driven map generation for the Hivyss world maps.

## Files

```
svg/
├── README.md              ← this file
├── main_map.svg           ← GENERATED — do not hand-edit
├── dark_map.svg           ← GENERATED — do not hand-edit
├── data/
│   ├── schema.ts          ← TypeScript type definitions (reference only)
│   ├── node_types.json    ← node type styling rules (battle/boss/anomaly/hub/endpoint/...)
│   ├── main_map.json      ← source data for Main Hivyss
│   └── dark_map.json      ← source data for Dark Hivyss
└── tools/
    └── generate.mjs       ← generator script (Node ESM, no deps)
```

## Data model

```
Layer (depth band, 6 total: drift / skin / veins / organs / nerve / core)
  └─ Zone = Biome (territorial region, geneline-owned, has biome character)
       └─ Node (visible map circle — represents 2-5 actual battles in-game)
            · biome field references the zone it belongs to
```

**Key concept:** `zones` and `biomes` are the same thing. A zone IS a biome — it carries the biome's palette, environmental rule, and event table. Each `node` references its biome via the `biome` field (which is a zone id).

**Visual abstraction:** what you see on the map as a single node circle represents a cluster of 2-5 actual battle nodes when you "zoom in" during gameplay. The SVG is a strategic overview, not a tactical breakdown.

## Workflow

1. Edit JSON files in `data/`
2. Run `node svg/tools/generate.mjs`
3. SVGs in `svg/` regenerate

## Usage

```bash
# from project root
node svg/tools/generate.mjs

# or with npm script (add to package.json):
# "scripts": { "build:maps": "node svg/tools/generate.mjs" }
npm run build:maps
```

## Editing the maps

| Task | What to edit |
|---|---|
| **Move a node** | Edit its `position` in the relevant `nodes` entry |
| **Add a node** | Append to the `nodes` array; set `id`, `name`, `type`, `layer`, `biome`, `tier`, `position` |
| **Add an edge** | Append to `edges` with `from`/`to` node ids and `type` (`standard`/`ascent`/`descent`/`anomaly_bleed`) |
| **Change a biome's look (palette/rule)** | Edit the relevant zone in `zones` — affects all nodes referencing it |
| **Add a new biome** | Add a new zone to `zones`, then reference its `id` from nodes via the `biome` field |
| **Change a layer's tier range** | Edit the layer in `layers` |
| **Adjust node styling rules** | Edit `data/node_types.json` (affects all nodes of that type across both maps) |

## Why this exists

Hand-authored SVG was painful — moving one node meant updating its circle, its label, and every edge that referenced it. This system separates **what the map is** (data) from **how it renders** (generator), so:

- Edits are 10× faster
- No risk of orphan references when nodes move
- Procgen variance is trivial (same data, randomized positions per seed)
- Eventually the runtime game can read the same JSON to render the in-game map

## Future extensions

- **Auto-layout**: replace explicit `position` with force-directed layout (d3-force)
- **Procgen seeds**: shuffle node positions and edge curves per seed
- **Dark derivation**: auto-generate dark_map.json from main_map.json (currently both are explicit)
- **In-game integration**: have Phaser read these JSON files for runtime rendering
