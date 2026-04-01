import { UNIT_DEFS, TIER_DEFS, GENELINE_DEFS } from '../units/registry';

export function createUnitCard(key: string, opts?: {
  preview?: string;
  onClick?: () => void;
}): HTMLDivElement {
  const d = UNIT_DEFS[key];
  const div = document.createElement('div');
  div.className = 'ucard';

  if (!d) return div;

  const iconHtml = opts?.preview
    ? `<img class="uico-img" src="${opts.preview}" alt="${d.name}">`
    : `<div class="uico">${d.ico}</div>`;

  const tier = TIER_DEFS[d.tier] || TIER_DEFS[1];
  const gl = d.geneline ? GENELINE_DEFS[d.geneline] : null;
  const glHtml = gl
    ? ` <span style="display:inline-block;width:10px;height:10px;line-height:10px;text-align:center;border-radius:50%;background:${gl.color};color:#d4c4b0;font-size:7px;font-weight:bold;vertical-align:baseline">${gl.symbol}</span>`
    : '';

  const route = d.route ?? 'land';
  const routeHtml = route === 'air'
    ? '<span style="position:absolute;top:2px;right:4px;font-size:8px;color:#80c0ff" title="Air">\u2708</span>'
    : route === 'tunnel'
    ? '<span style="position:absolute;top:2px;right:4px;font-size:8px;color:#c09060" title="Tunnel">\u26CF</span>'
    : '';

  div.innerHTML = `
    <div class="utier" style="color:${tier.color}">${tier.label}${glHtml}</div>
    ${routeHtml}
    ${iconHtml}
    <div class="uname">${d.name}</div>
    <div class="ucost">${d.cost}n</div>
  `;

  if (opts?.onClick) div.onclick = opts.onClick;

  return div;
}
