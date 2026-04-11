import Phaser from 'phaser';
import { W, H } from '../config/Constants';
import { LAYER_DEFS } from '../config/LayerDefs';
import type { NodeDef } from '../config/LayerDefs';
import type { RunState } from '../systems/RunState';
import { isRunFailed } from '../systems/RunState';
import { onNodeSelected, isNodeAvailable } from '../systems/RunController';
import { UNIT_DEFS } from '../units/registry';

interface NodeMapData {
  runState: RunState;
}

export class NodeMapScene extends Phaser.Scene {
  private runState!: RunState;

  constructor() {
    super('NodeMapScene');
  }

  create(data: NodeMapData): void {
    this.runState = data.runState;
    const layer = LAYER_DEFS[this.runState.layerKey];

    if (!layer) {
      // No more layers defined — run complete
      this.scene.start('MainMenuScene');
      return;
    }

    if (isRunFailed(this.runState)) {
      this.scene.start('MainMenuScene');
      return;
    }

    const outer = document.createElement('div');
    outer.style.cssText = 'width:1280px; height:720px; position:relative; pointer-events:none; font-family:"Courier New",monospace; color:#ddd; overflow:hidden;';

    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute; inset:0; display:flex; flex-direction:column; pointer-events:auto;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'flex-shrink:0; display:flex; align-items:center; padding:10px 16px; background:#09090e; border-bottom:1px solid #1a1a28;';

    const title = document.createElement('span');
    title.style.cssText = 'font-family:"Press Start 2P",monospace; font-size:13px; color:#f0c040; letter-spacing:2px;';
    title.textContent = `LAYER ${this.runState.layer}`;

    const seedLbl = document.createElement('span');
    seedLbl.style.cssText = 'font-size:11px; color:#555; margin-left:20px; letter-spacing:1px; cursor:pointer;';
    seedLbl.textContent = this.runState.seed;
    seedLbl.title = 'Click to copy seed';
    seedLbl.onclick = () => {
      navigator.clipboard.writeText(this.runState.seed);
      seedLbl.textContent = 'Copied!';
      setTimeout(() => { seedLbl.textContent = this.runState.seed; }, 1000);
    };

    const spacer = document.createElement('div');
    spacer.style.cssText = 'flex:1;';

    const modeLbl = document.createElement('span');
    modeLbl.style.cssText = 'font-size:9px; color:#666; margin-right:12px; letter-spacing:1px;';
    modeLbl.textContent = this.runState.mode === 'permadeath' ? 'PERMADEATH' : 'PERSISTENT';

    const abandonBtn = document.createElement('button');
    abandonBtn.style.cssText = 'font-family:"Press Start 2P",monospace; font-size:9px; color:#666; background:#0a0a14; border:1px solid #333; border-radius:3px; padding:5px 10px; cursor:pointer;';
    abandonBtn.textContent = 'ABANDON';
    abandonBtn.onmouseenter = () => { abandonBtn.style.color = '#c04040'; };
    abandonBtn.onmouseleave = () => { abandonBtn.style.color = '#666'; };
    abandonBtn.onclick = () => this.scene.start('MainMenuScene');

    header.append(title, seedLbl, spacer, modeLbl, abandonBtn);
    panel.appendChild(header);

    // Node map area
    const mapArea = document.createElement('div');
    mapArea.style.cssText = 'flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:20px;';

    // Build node graph visualization
    const nodeGraph = this.buildNodeGraph(layer.nodes);
    mapArea.appendChild(nodeGraph);

    panel.appendChild(mapArea);

    // Bottom: roster + buffs
    const bottomBar = document.createElement('div');
    bottomBar.style.cssText = 'flex-shrink:0; padding:10px 16px; background:#09090e; border-top:1px solid #1a1a28;';

    // Roster
    const rosterRow = document.createElement('div');
    rosterRow.style.cssText = 'display:flex; gap:6px; justify-content:center; flex-wrap:wrap; margin-bottom:6px;';
    this.runState.roster.forEach(key => {
      const def = UNIT_DEFS[key];
      if (!def) return;
      const chip = document.createElement('span');
      chip.style.cssText = 'font-size:10px; color:#aaa; background:#141420; border:1px solid #333; border-radius:3px; padding:2px 8px;';
      chip.textContent = def.name;
      rosterRow.appendChild(chip);
    });
    bottomBar.appendChild(rosterRow);

    // Buffs
    if (this.runState.buffs.length > 0) {
      const buffRow = document.createElement('div');
      buffRow.style.cssText = 'display:flex; gap:8px; justify-content:center; flex-wrap:wrap;';
      this.runState.buffs.forEach(buff => {
        const chip = document.createElement('span');
        chip.style.cssText = 'font-size:9px; color:#80c0ff; background:#0a1420; border:1px solid #1a3050; border-radius:3px; padding:2px 6px;';
        chip.textContent = buff.name;
        buffRow.appendChild(chip);
      });
      bottomBar.appendChild(buffRow);
    }

    panel.appendChild(bottomBar);
    outer.appendChild(panel);
    this.add.dom(640, 360, outer);

    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('MainMenuScene'));
    this.events.once('shutdown', () => this.input.keyboard!.removeAllListeners());
  }

  private buildNodeGraph(nodes: NodeDef[]): HTMLElement {
    const cols = this.getNodeRows(nodes);
    const NODE_R = 30;      // circle radius
    const COL_W = 120;      // horizontal spacing between columns
    const ROW_H = 90;       // vertical spacing between branched nodes
    const LABEL_H = 16;     // space for label below circle

    // Calculate grid: each node gets an (x, y) center coordinate
    const positions: Record<number, { x: number; y: number }> = {};
    const maxRows = Math.max(...cols.map(c => c.length));
    const totalW = cols.length * COL_W;
    const totalH = maxRows * ROW_H;

    cols.forEach((col, colIdx) => {
      const cx = colIdx * COL_W + COL_W / 2;
      col.forEach((nodeIdx, rowIdx) => {
        const offset = (col.length - 1) * ROW_H / 2;
        const cy = totalH / 2 + rowIdx * ROW_H - offset;
        positions[nodeIdx] = { x: cx, y: cy };
      });
    });

    // Build display labels
    const nodeLabels: Record<number, string> = {};
    const L = this.runState.layer;
    let displayCol = 1;
    cols.forEach(col => {
      const letters = 'ABCDEFGH';
      col.forEach((nodeIdx, i) => {
        nodeLabels[nodeIdx] = col.length === 1 ? `${L}-${displayCol}` : `${L}-${displayCol}${letters[i]}`;
      });
      displayCol++;
    });

    // Line color logic
    const edgeColor = (fromIdx: number, toIdx: number) => {
      if (this.runState.nodeResults[fromIdx] === 'won' && this.runState.nodeResults[toIdx] === 'won') return '#60c040';
      if (this.runState.nodeResults[fromIdx] === 'won' && isNodeAvailable(this.runState, toIdx)) return '#f0c040';
      return '#333';
    };

    // Container with relative positioning for absolute-placed nodes + SVG
    const container = document.createElement('div');
    container.style.cssText = `position:relative; width:${totalW}px; height:${totalH + LABEL_H}px;`;

    // SVG layer for lines (behind nodes)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(totalW));
    svg.setAttribute('height', String(totalH + LABEL_H));
    svg.style.cssText = 'position:absolute; top:0; left:0; pointer-events:none;';

    // Draw edges
    for (let i = 0; i < nodes.length; i++) {
      const from = positions[i];
      if (!from) continue;
      for (const nextIdx of nodes[i].next) {
        const to = positions[nextIdx];
        if (!to) continue;
        const color = edgeColor(i, nextIdx);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(from.x));
        line.setAttribute('y1', String(from.y));
        line.setAttribute('x2', String(to.x));
        line.setAttribute('y2', String(to.y));
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
      }
    }

    container.appendChild(svg);

    // Place node elements at calculated positions
    for (let i = 0; i < nodes.length; i++) {
      const pos = positions[i];
      if (!pos) continue;
      const node = nodes[i];
      const result = this.runState.nodeResults[i];
      const avail = isNodeAvailable(this.runState, i);
      const el = this.createNodeElement(node, i, result, avail, nodeLabels[i]);
      el.style.cssText += `position:absolute; left:${pos.x}px; top:${pos.y}px; transform:translate(-50%,-50%);`;
      container.appendChild(el);
    }

    return container;
  }

  // BFS to group nodes into rows by depth
  private getNodeRows(nodes: NodeDef[]): number[][] {
    const depth: Record<number, number> = { 0: 0 };
    const queue = [0];
    const visited = new Set<number>([0]);

    while (queue.length > 0) {
      const idx = queue.shift()!;
      for (const next of nodes[idx].next) {
        if (!visited.has(next)) {
          visited.add(next);
          depth[next] = depth[idx] + 1;
          queue.push(next);
        }
      }
    }

    const maxDepth = Math.max(...Object.values(depth));
    const rows: number[][] = [];
    for (let d = 0; d <= maxDepth; d++) {
      const row = Object.entries(depth)
        .filter(([, dep]) => dep === d)
        .map(([idx]) => parseInt(idx));
      rows.push(row);
    }

    return rows;
  }


  private createNodeElement(node: NodeDef, idx: number, result: string, isAvailable: boolean, displayLabel?: string): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:4px;';

    const circle = document.createElement('div');
    const size = 60;
    let bgColor = '#141420';
    let borderColor = '#333';
    let textColor = '#666';

    if (result === 'won') {
      bgColor = '#1a2a1a';
      borderColor = '#60c040';
      textColor = '#60c040';
    } else if (isAvailable) {
      bgColor = '#1a1a2a';
      borderColor = '#f0c040';
      textColor = '#f0c040';
    }

    const nodeId = displayLabel || String(idx + 1);
    const fontSize = nodeId.length > 3 ? '9px' : '11px';
    circle.style.cssText = `width:${size}px; height:${size}px; border-radius:50%; background:${bgColor}; border:2px solid ${borderColor}; display:flex; align-items:center; justify-content:center; font-family:"Press Start 2P",monospace; font-size:${fontSize}; color:${textColor};`;

    circle.textContent = nodeId;

    if (isAvailable) {
      circle.style.cursor = 'pointer';
      circle.onmouseenter = () => { circle.style.borderColor = '#ffe080'; circle.style.transform = 'scale(1.1)'; };
      circle.onmouseleave = () => { circle.style.borderColor = '#f0c040'; circle.style.transform = ''; };
      circle.onclick = () => this.enterNode(idx);
    }

    const label = document.createElement('div');
    label.style.cssText = `font-size:9px; color:${textColor}; text-align:center;`;
    label.textContent = node.preview;

    if (node.type === 'vhyst') {
      label.innerHTML = `${node.preview} <span style="color:#80c0ff">free</span>`;
    }
    el.append(circle, label);

    return el;
  }

  private enterNode(nodeIdx: number): void {
    const transition = onNodeSelected(this.runState, nodeIdx);
    this.scene.start(transition.scene, transition.data);
  }
}
