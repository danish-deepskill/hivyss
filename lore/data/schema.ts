// Hivyss map data schema
// Reference types — used for documentation and IDE hints when editing JSON.
// The generator (svg/tools/generate.mjs) is plain JS and does not import this file.

// ============================================================================
// Top-level
// ============================================================================

export interface MapData {
  meta: Meta;
  layers: Layer[];
  zones: Zone[];          // zone = biome (territorial region with biome character)
  nodes: MapNode[];       // visible map points; each represents 2-5 battles in-game
  edges: Edge[];
  specials?: Special[];   // husk moon, anomaly entry markers, etc.
}

export interface Meta {
  variant: 'main' | 'dark';
  title: string;          // "MAIN HIVYSS — Greek genelines (α–ω)"
  subtitle?: string;
  width: number;
  height: number;
  bgGradient: GradientStop[];
}

export interface GradientStop {
  offset: string;         // "0%", "50%"
  color: string;          // hex
}

// ============================================================================
// Layers — vertical depth bands
// ============================================================================

export interface Layer {
  id: string;             // "skin", "veins", etc.
  name: string;           // "SKIN"
  subtitle: string;       // "outer membrane · T1-3"
  tierRange: [number, number];
  corruptionRange?: [number, number]; // dark layers only
  yStart: number;         // top y of layer band
  yEnd: number;           // bottom y of layer band
  labelColor: string;
  subtitleColor: string;
  dividerColor: string;
}

// ============================================================================
// Zones — these ARE biomes. Territorial regions with biome character.
// ============================================================================

export interface Zone {
  id: string;             // "carapace_plains"
  name: string;           // "Carapace Plains"
  layer: string;          // FK to layer.id

  // Geneline ownership
  owner: string;          // "alpha" or "aleph" — the geneline that lives here
  ownerSymbol: string;    // "α" or "ℵ" — display character

  // Tier (zone-level; nodes can vary ±1)
  tier: number;
  corruption?: number;    // 0-5, dark map only

  // Biome character (zone IS the biome)
  envRule: BiomeRule;     // environmental rule for battles in this zone
  eventTable?: string;    // id of event table for travel encounters

  // Visual
  fill: string;           // ellipse fill
  stroke: string;         // ellipse stroke
  position: { x: number; y: number };
  radius: { x: number; y: number };

  labelOffset?: { x: number; y: number }; // optional override for zone label position
}

export type BiomeRule =
  | 'clear'           // no special rule
  | 'water_heavy'     // swamp, slows ground units
  | 'fog_spore'       // visibility reduced
  | 'fog_dim'         // dim, only moving units visible
  | 'heat_passive'    // burn DOT
  | 'cold_drift'     // slow units
  | 'corruption'      // dark realm rules apply
  | 'gravity_shift'   // route inversion
  | 'pheromone_dense' // signals propagate further
  | 'silence'         // sound abilities reduced
  | 'crystalline';    // ranged dominant, line-of-sight bonus

// ============================================================================
// Nodes — visible map points. Each = 2-5 battles in actual gameplay.
// ============================================================================

export interface MapNode {
  id: string;             // "shallow_marsh"
  name: string;           // "Shallow Marsh"
  subtitle?: string;      // "Mid-Core Boss · unlocks η"
  type: NodeType;
  layer: string;          // FK to layer.id
  biome: string;          // FK to zone.id (zone = biome)
  tier: number;           // can deviate ±1 from zone.tier; anomalies break further
  corruption?: number;    // dark map only
  position: { x: number; y: number };
  labelOffset?: { x: number; y: number };
  underlyingNodes?: number; // hint: how many actual battles this represents (default 3)
  bridgesTo?: string;     // for anomaly nodes: target id in the other map (e.g. "dark:dark_crossroads")
}

export type NodeType =
  | 'battle'        // standard combat node
  | 'boss'          // mini-boss / mid-boss / boss
  | 'anomaly'       // bridges to dark realm
  | 'hub'           // home hive (or analogous)
  | 'endpoint'      // ω arena / Taw arena
  | 'ascent_point'  // Drift access points
  | 'entry';        // Dark map entry from main

// ============================================================================
// Edges — connections between nodes (bidirectional unless noted)
// ============================================================================

export interface Edge {
  from: string;     // node id
  to: string;       // node id
  type: EdgeType;
  curve?: number;   // optional: bezier control offset (default auto)
}

export type EdgeType =
  | 'standard'      // normal walk between nodes
  | 'ascent'        // Skin → Drift
  | 'anomaly_bleed' // Main ↔ Dark bridge
  | 'descent';      // Layer transition (visual emphasis)

// ============================================================================
// Specials — non-node decorations (Husk moon, anomaly entry markers)
// ============================================================================

export type Special =
  | { type: 'husk'; position: { x: number; y: number }; radius: number }
  | { type: 'anomaly_entry'; position: { x: number; y: number }; label: string };

// ============================================================================
// Node type styling (lives in node_types.json, shared between maps)
// ============================================================================

export interface NodeTypeStyle {
  radius: number;
  strokeWidth: number;
  strokeDashed?: boolean;
  useGlow?: boolean;
  fill?: string;          // fallback if zone doesn't override
  stroke?: string;
  useGradient?: 'hive' | 'core' | 'darkcore' | 'husk';
  labelColor?: string;
  labelSize?: number;
}
