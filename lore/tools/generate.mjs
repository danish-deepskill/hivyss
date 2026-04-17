// Hivyss map generator
// Reads svg/data/*.json and produces svg/main_map.svg + svg/dark_map.svg
// Plain Node ESM, no dependencies. Run with: node svg/tools/generate.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');
const OUT_DIR = resolve(__dirname, '..');

// ============================================================================
// Load data
// ============================================================================

const nodeTypes = JSON.parse(readFileSync(resolve(DATA_DIR, 'node_types.json'), 'utf8'));
const mainData = JSON.parse(readFileSync(resolve(DATA_DIR, 'main_map.json'), 'utf8'));
const darkData = JSON.parse(readFileSync(resolve(DATA_DIR, 'dark_map.json'), 'utf8'));
const primordialsData = JSON.parse(readFileSync(resolve(DATA_DIR, 'primordials_map.json'), 'utf8'));

// ============================================================================
// Helpers
// ============================================================================

const lookupNode = (mapData, id) => mapData.nodes.find(n => n.id === id);
const lookupZone = (mapData, id) => mapData.zones.find(z => z.id === id);

function curve(from, to, controlOffset = null) {
  // Simple quadratic bezier — control point offset perpendicular to midpoint
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  // Default: small perpendicular offset for organic feel
  const len = Math.sqrt(dx * dx + dy * dy);
  const offset = controlOffset ?? Math.min(len * 0.15, 30);
  // Perpendicular: rotate (dx, dy) by 90° => (-dy, dx); normalize
  const nx = len > 0 ? -dy / len : 0;
  const ny = len > 0 ? dx / len : 0;
  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  return `M ${from.x} ${from.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x} ${to.y}`;
}

function tierLabel(node) {
  const t = `T${node.tier}`;
  if (node.corruption !== undefined && node.corruption > 0) {
    return `${t} C${node.corruption}`;
  }
  return t;
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
  }[c]));
}

// ============================================================================
// Render fragments
// ============================================================================

function renderDefs(meta, variant) {
  const stops = meta.bgGradient.map(s => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('');
  const bgId = `bg_${variant}`;

  // Coptic primordial gradients (used only by coptic_map nodes)
  const primordialGrads = `
    <radialGradient id="primordial_shei"><stop offset="0%" stop-color="#ffffff"/><stop offset="55%" stop-color="#a0c0ff"/><stop offset="100%" stop-color="#101040"/></radialGradient>
    <radialGradient id="primordial_dei"><stop offset="0%" stop-color="#ffe0a0"/><stop offset="45%" stop-color="#c060c0"/><stop offset="100%" stop-color="#200020"/></radialGradient>
    <radialGradient id="primordial_fei"><stop offset="0%" stop-color="#ffa080"/><stop offset="50%" stop-color="#c02020"/><stop offset="100%" stop-color="#200000"/></radialGradient>
    <radialGradient id="primordial_djandja"><stop offset="0%" stop-color="#a0ffc0"/><stop offset="50%" stop-color="#208060"/><stop offset="100%" stop-color="#001020"/></radialGradient>
    <radialGradient id="primordial_tchima"><stop offset="0%" stop-color="#ffb0ff"/><stop offset="50%" stop-color="#8030c0"/><stop offset="100%" stop-color="#100020"/></radialGradient>`;

  return `  <defs>
    <linearGradient id="${bgId}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>
    <radialGradient id="hive"><stop offset="0%" stop-color="#ffeb90"/><stop offset="70%" stop-color="#b07020"/><stop offset="100%" stop-color="#401500"/></radialGradient>
    <radialGradient id="core"><stop offset="0%" stop-color="#fff090"/><stop offset="55%" stop-color="#ff7010"/><stop offset="100%" stop-color="#400500"/></radialGradient>
    <radialGradient id="darkcore"><stop offset="0%" stop-color="#e060e0"/><stop offset="40%" stop-color="#601060"/><stop offset="100%" stop-color="#100010"/></radialGradient>
    <radialGradient id="husk"><stop offset="0%" stop-color="#c8c8b8"/><stop offset="60%" stop-color="#70705c"/><stop offset="100%" stop-color="#2a2820"/></radialGradient>${primordialGrads}
    <filter id="glow"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>`;
}

function renderTitle(meta) {
  const titleColor = meta.variant === 'dark' ? '#c060c0' : (meta.variant === 'primordials' ? '#e0e0ff' : '#f0d080');
  const subtitleColor = meta.variant === 'dark' ? '#805080' : (meta.variant === 'primordials' ? '#8090c0' : '#a08060');
  let out = `  <text x="${meta.width / 2}" y="28" fill="${titleColor}" font-size="16" font-weight="bold" text-anchor="middle" letter-spacing="4">${escapeXml(meta.title)}</text>`;
  if (meta.subtitle) {
    out += `\n  <text x="${meta.width / 2}" y="45" fill="${subtitleColor}" font-size="9" text-anchor="middle">${escapeXml(meta.subtitle)}</text>`;
  }
  return out;
}

function renderLayers(layers, mapWidth) {
  if (!layers || layers.length === 0) return '';
  const out = [];
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    // Divider line at top of layer (skip first)
    if (i > 0 && l.dividerColor) {
      out.push(`  <line x1="0" y1="${l.yStart - 10}" x2="${mapWidth}" y2="${l.yStart - 10}" stroke="${l.dividerColor}" stroke-width="1" stroke-dasharray="3,4" opacity="0.35"/>`);
    }
    // Label + subtitle
    out.push(`  <text x="20" y="${l.yStart + (i === 0 ? 110 : 20)}" fill="${l.labelColor}" font-size="13" font-weight="bold" letter-spacing="3">${escapeXml(l.name)}</text>`);
    out.push(`  <text x="20" y="${l.yStart + (i === 0 ? 125 : 35)}" fill="${l.subtitleColor}" font-size="9">${escapeXml(l.subtitle)}</text>`);
  }
  return out.join('\n');
}

function renderZones(zones) {
  if (!zones || zones.length === 0) return '';
  const out = [];
  for (const z of zones) {
    const labelX = z.labelOffset ? z.position.x + z.labelOffset.x : z.position.x - z.radius.x + 20;
    const labelY = z.labelOffset ? z.position.y + z.labelOffset.y : z.position.y - z.radius.y - 8;
    out.push(`  <ellipse cx="${z.position.x}" cy="${z.position.y}" rx="${z.radius.x}" ry="${z.radius.y}" fill="${z.fill}" opacity="0.13" stroke="${z.stroke}" stroke-opacity="0.4" stroke-dasharray="5,3"/>`);
    out.push(`  <text x="${labelX}" y="${labelY}" fill="${z.stroke}" font-size="10" font-style="italic">${escapeXml(z.name)} [${escapeXml(z.ownerSymbol)}]</text>`);
  }
  return out.join('\n');
}

function renderEdges(edges, nodes) {
  const standard = [];
  const ascent = [];
  const anomaly = [];
  const descent = [];

  for (const e of edges) {
    const from = nodes.find(n => n.id === e.from);
    const to = nodes.find(n => n.id === e.to);
    if (!from || !to) {
      console.warn(`[edge] missing node: ${e.from} → ${e.to}`);
      continue;
    }
    const path = `<path d="${curve(from.position, to.position, e.curve)}"/>`;
    if (e.type === 'ascent') ascent.push(path);
    else if (e.type === 'anomaly_bleed') anomaly.push(path);
    else if (e.type === 'descent') descent.push(path);
    else standard.push(path);
  }

  const out = [];
  if (standard.length || descent.length) {
    out.push(`  <g fill="none" stroke="#c0a070" stroke-width="2" stroke-opacity="0.55" stroke-linecap="round">`);
    standard.forEach(p => out.push(`    ${p}`));
    descent.forEach(p => out.push(`    ${p}`));
    out.push(`  </g>`);
  }
  if (ascent.length) {
    out.push(`  <g fill="none" stroke="#7090b0" stroke-width="2" stroke-opacity="0.55" stroke-dasharray="6,4">`);
    ascent.forEach(p => out.push(`    ${p}`));
    out.push(`  </g>`);
  }
  if (anomaly.length) {
    out.push(`  <g fill="none" stroke="#a030a0" stroke-width="2.5" stroke-opacity="0.55" stroke-dasharray="3,3">`);
    anomaly.forEach(p => out.push(`    ${p}`));
    out.push(`  </g>`);
  }

  return out.join('\n');
}

function renderNodes(nodes, zones) {
  const out = [];
  for (const node of nodes) {
    const style = nodeTypes[node.type];
    if (!style) {
      console.warn(`[node] unknown type: ${node.type} for ${node.id}`);
      continue;
    }
    const zone = zones.find(z => z.id === node.biome);

    // Determine fill / stroke
    let fill = style.fill || (zone ? zone.fill : '#888');
    let stroke = style.stroke || (zone ? zone.stroke : '#ccc');

    // For battle nodes, derive fill from zone
    if (node.type === 'battle' && zone) {
      fill = zone.fill;
      stroke = zone.stroke;
    }

    const dashAttr = style.strokeDashed ? ' stroke-dasharray="2,2"' : '';
    const filterAttr = style.useGlow ? ' filter="url(#glow)"' : '';
    const gradientId = node.useGradient || style.useGradient;
    const fillVal = gradientId ? `url(#${gradientId})` : fill;
    // Per-node stroke override (e.g. for primordials)
    if (node.stroke) stroke = node.stroke;

    out.push(`  <circle cx="${node.position.x}" cy="${node.position.y}" r="${style.radius}" fill="${fillVal}" stroke="${stroke}" stroke-width="${style.strokeWidth}"${dashAttr}${filterAttr}/>`);

    // Label
    const labelOffset = node.labelOffset || { x: 0, y: style.radius + 14 };
    const lx = node.position.x + labelOffset.x;
    const ly = node.position.y + labelOffset.y;
    const labelColor = style.labelColor || '#ccc';
    const labelSize = style.labelSize || 9;
    const labelText = node.tier !== undefined && node.type !== 'hub' && node.type !== 'endpoint'
      ? `${escapeXml(node.name)} · ${tierLabel(node)}`
      : escapeXml(node.name);
    out.push(`  <text x="${lx}" y="${ly}" fill="${labelColor}" font-size="${labelSize}" text-anchor="middle"${node.type === 'hub' || node.type === 'endpoint' ? ' font-weight="bold"' : ''}>${labelText}</text>`);

    // Subtitle
    if (node.subtitle) {
      const sublineColor = style.labelColor || '#ccc';
      out.push(`  <text x="${lx}" y="${ly + 12}" fill="${sublineColor}" font-size="8" text-anchor="middle" opacity="0.9">${escapeXml(node.subtitle)}</text>`);
    }
  }
  return out.join('\n');
}

function renderStarfield(count, width, height, seed = 42) {
  // Deterministic LCG so output is reproducible
  let state = seed;
  const rand = () => {
    state = (state * 1103515245 + 12345) & 0x7FFFFFFF;
    return state / 0x7FFFFFFF;
  };
  const out = [];
  for (let i = 0; i < count; i++) {
    const x = (rand() * width).toFixed(1);
    const y = (rand() * height).toFixed(1);
    const r = (0.4 + rand() * 1.4).toFixed(1);
    const opacity = (0.25 + rand() * 0.65).toFixed(2);
    out.push(`  <circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${opacity}"/>`);
  }
  return out.join('\n');
}

function renderSpecials(specials, meta) {
  const out = [];
  for (const s of specials) {
    if (s.type === 'starfield') {
      out.push(renderStarfield(s.count || 60, meta.width, meta.height, s.seed));
    } else if (s.type === 'scripture') {
      const fontSize = s.fontSize || 9;
      const color = s.color || '#aaa';
      out.push(`  <text x="${s.position.x}" y="${s.position.y}" fill="${color}" font-size="${fontSize}" font-style="italic" text-anchor="middle">${escapeXml(s.text)}</text>`);
    } else if (s.type === 'husk') {
      const cx = s.position.x;
      const cy = s.position.y;
      const r = s.radius;
      out.push(`  <g opacity="0.85">`);
      out.push(`    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#husk)" stroke="#a0a090" stroke-width="1"/>`);
      out.push(`    <ellipse cx="${cx - 10}" cy="${cy - 7}" rx="8" ry="5" fill="#30302a" opacity="0.6"/>`);
      out.push(`    <ellipse cx="${cx + 10}" cy="${cy + 7}" rx="6" ry="4" fill="#30302a" opacity="0.5"/>`);
      out.push(`    <text x="${cx}" y="${cy + r + 15}" fill="#b0b0a0" font-size="9" text-anchor="middle">THE HUSK</text>`);
      out.push(`    <text x="${cx}" y="${cy + r + 27}" fill="#808070" font-size="7" text-anchor="middle">Archaic · post-ω</text>`);
      out.push(`  </g>`);
    } else if (s.type === 'anomaly_entry') {
      out.push(`  <circle cx="${s.position.x}" cy="${s.position.y}" r="11" fill="#301030" stroke="#c060c0" stroke-width="2.5" stroke-dasharray="2,2"/>`);
      out.push(`  <text x="${s.position.x}" y="${s.position.y - 16}" fill="#c060c0" font-size="8" text-anchor="middle" font-style="italic">${escapeXml(s.label || '⚠ anomaly')}</text>`);
    }
  }
  return out.join('\n');
}

function renderLegend(variant, mapHeight) {
  const x = 635;
  const y = mapHeight - 145;
  const isMain = variant === 'main';
  const accentColor = isMain ? '#603020' : '#501020';
  const accentStroke = isMain ? '#e08040' : '#a02040';
  const endLabel = isMain ? 'ω · main ending' : 'ת Taw · true ending';
  const endGradient = isMain ? 'core' : 'darkcore';
  const edgeColor = isMain ? '#c0a070' : '#8030a0';
  const ascentLabel = isMain ? 'Drift ascent · Anomaly bleed' : 'Anomaly bridge to Main';
  const ascentColor = isMain ? '#7090b0' : '#a030a0';

  return `  <g transform="translate(${x}, ${y})">
    <rect x="0" y="0" width="250" height="135" fill="#000" opacity="0.55" rx="4"/>
    <text x="12" y="18" fill="#fff" font-size="10" font-weight="bold">LEGEND</text>
    <circle cx="22" cy="36" r="6" fill="#808080" stroke="#ccc" stroke-width="1"/>
    <text x="35" y="39" fill="#ccc" font-size="9">Battle node (biome-colored)</text>
    <circle cx="22" cy="54" r="7" fill="#301030" stroke="#a030a0" stroke-width="2" stroke-dasharray="2,2"/>
    <text x="35" y="57" fill="#ccc" font-size="9">Anomaly (bridge between maps)</text>
    <circle cx="22" cy="73" r="8" fill="${accentColor}" stroke="${accentStroke}" stroke-width="2"/>
    <text x="35" y="76" fill="#ccc" font-size="9">Boss node</text>
    <circle cx="22" cy="92" r="9" fill="url(#${endGradient})"/>
    <text x="35" y="95" fill="#ccc" font-size="9">${endLabel}</text>
    <line x1="12" y1="112" x2="32" y2="112" stroke="${edgeColor}" stroke-width="2" stroke-linecap="round"/>
    <text x="36" y="115" fill="#ccc" font-size="9">Standard edge (bidirectional)</text>
    <line x1="12" y1="128" x2="32" y2="128" stroke="${ascentColor}" stroke-width="2" stroke-dasharray="5,3"/>
    <text x="36" y="131" fill="#ccc" font-size="9">${ascentLabel}</text>
  </g>`;
}

// ============================================================================
// Main generator
// ============================================================================

function generate(mapData) {
  const { meta } = mapData;
  const bgId = `bg_${meta.variant}`;

  const parts = [];
  parts.push(`<svg viewBox="0 0 ${meta.width} ${meta.height}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">`);
  parts.push(renderDefs(meta, meta.variant));
  parts.push(`  <rect width="${meta.width}" height="${meta.height}" fill="url(#${bgId})"/>`);
  parts.push(renderTitle(meta));
  parts.push(renderLayers(mapData.layers, meta.width));
  parts.push(`  <!-- Zones -->`);
  parts.push(renderZones(mapData.zones));
  parts.push(`  <!-- Edges -->`);
  parts.push(renderEdges(mapData.edges, mapData.nodes));
  parts.push(`  <!-- Nodes -->`);
  parts.push(renderNodes(mapData.nodes, mapData.zones));
  if (mapData.specials && mapData.specials.length > 0) {
    parts.push(`  <!-- Specials -->`);
    parts.push(renderSpecials(mapData.specials, meta));
  }
  if (meta.variant !== 'primordials') {
    parts.push(`  <!-- Legend -->`);
    parts.push(renderLegend(meta.variant, meta.height));
  }
  parts.push(`</svg>`);
  return parts.join('\n');
}

// ============================================================================
// Validation
// ============================================================================

function validate(mapData, name) {
  const errs = [];
  const nodeIds = new Set(mapData.nodes.map(n => n.id));
  const zoneIds = new Set(mapData.zones.map(z => z.id));

  // Edges reference existing nodes
  for (const e of mapData.edges) {
    if (!nodeIds.has(e.from)) errs.push(`[${name}] edge.from missing: ${e.from}`);
    if (!nodeIds.has(e.to)) errs.push(`[${name}] edge.to missing: ${e.to}`);
  }
  // Nodes reference existing zones
  for (const n of mapData.nodes) {
    if (n.biome && !zoneIds.has(n.biome)) errs.push(`[${name}] node.biome missing: ${n.id} → ${n.biome}`);
  }
  // Zone tier in valid range
  for (const z of mapData.zones) {
    if (z.tier < 0 || z.tier > 10) errs.push(`[${name}] zone tier out of range: ${z.id} = ${z.tier}`);
  }
  // Node tier in valid range
  for (const n of mapData.nodes) {
    if (n.tier < 0 || n.tier > 10) errs.push(`[${name}] node tier out of range: ${n.id} = ${n.tier}`);
  }

  if (errs.length > 0) {
    console.warn(`Validation warnings for ${name}:`);
    errs.forEach(e => console.warn('  ' + e));
  } else {
    console.log(`✓ ${name} passes validation`);
  }
}

// ============================================================================
// Run
// ============================================================================

console.log('Hivyss Map Generator');
console.log('====================');
validate(mainData, 'main_map');
validate(darkData, 'dark_map');
validate(primordialsData, 'primordials_map');

const mainSvg = generate(mainData);
const darkSvg = generate(darkData);
const primordialsSvg = generate(primordialsData);

writeFileSync(resolve(OUT_DIR, 'main_map.svg'), mainSvg);
writeFileSync(resolve(OUT_DIR, 'dark_map.svg'), darkSvg);
writeFileSync(resolve(OUT_DIR, 'primordials_map.svg'), primordialsSvg);

console.log(`✓ Wrote ${resolve(OUT_DIR, 'main_map.svg')} (${mainSvg.length} bytes, ${mainData.nodes.length} nodes)`);
console.log(`✓ Wrote ${resolve(OUT_DIR, 'dark_map.svg')} (${darkSvg.length} bytes, ${darkData.nodes.length} nodes)`);
console.log(`✓ Wrote ${resolve(OUT_DIR, 'primordials_map.svg')} (${primordialsSvg.length} bytes, ${primordialsData.nodes.length} nodes)`);
