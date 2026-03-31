import Phaser from 'phaser';
import { W, H } from '../config/Constants';
import { UNIT_DEFS, TIER_DEFS, GENELINE_DEFS, drawUnit } from '../units/registry';
import { SaveManager } from '../systems/SaveManager';
import type { RenderUnit } from '../types';

const MAX_DECK_SIZE: number = 10;
const POOL_COLS: number = 7;
const POOL_ROWS: number = 2;
const PAGE_SIZE: number = POOL_COLS * POOL_ROWS;

const CARD_W: number = 114;
const CARD_H: number = 78;
const CARD_GAP_X: number = 11;
const CARD_GAP_Y: number = 8;

function getDefaultDeck(max: number): string[] {
  const keys: string[] = Object.keys(UNIT_DEFS).filter(k => !UNIT_DEFS[k].unlock);
  return keys.slice(0, max);
}

interface CardEntry {
  container: Phaser.GameObjects.Container;
  cardBg: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
}

interface DeckSlot {
  bg: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  w: number;
  h: number;
  icon: Phaser.GameObjects.Image | null;
  nameTxt: Phaser.GameObjects.Text | null;
}

interface TooltipLine {
  text: string;
  color: string;
  size: string;
  bold?: boolean;
}

export class DeckScene extends Phaser.Scene {
  private save!: SaveManager;
  private pool!: string[];
  private deckSize!: number;
  private selected!: Set<string>;
  private previews!: Record<string, string>;
  private cards!: Record<string, CardEntry>;
  private deckLabel!: Phaser.GameObjects.Text;
  private deckSlots!: DeckSlot[];
  private confirmBtn!: Phaser.GameObjects.Text;
  private tooltip!: Phaser.GameObjects.Container;
  private tooltipBg!: Phaser.GameObjects.Graphics;
  private tooltipTexts!: Phaser.GameObjects.Text[];
  private page!: number;
  private totalPages!: number;
  private pageLbl!: Phaser.GameObjects.Text;
  private prevBtn!: Phaser.GameObjects.Text;
  private nextBtn!: Phaser.GameObjects.Text;

  constructor() {
    super('DeckScene');
  }

  create(): void {
    this.save = new SaveManager();


    // Background
    const bg: Phaser.GameObjects.Graphics = this.add.graphics();
    bg.fillStyle(0x0a0a14);
    bg.fillRect(0, 0, W, H);

    // Title
    this.add.text(W / 2, 12, 'BUILD YOUR DECK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#f0c040',
    }).setOrigin(0.5);

    // Determine available units
    this.pool = [];
    Object.entries(UNIT_DEFS).forEach(([key, def]) => {
      if (def.unlock) {
        const level: number = this.save.getUpgradeLevel(def.unlock);
        if (level < 1) return;
      }
      this.pool.push(key);
    });

    this.deckSize = Math.min(MAX_DECK_SIZE, this.pool.length);

    // Load saved deck
    let savedDeck: string[] = this.save.getDeck();
    savedDeck = savedDeck.filter(k => this.pool.includes(k));
    if (savedDeck.length === 0) savedDeck = getDefaultDeck(this.deckSize).filter(k => this.pool.includes(k));
    this.selected = new Set<string>(savedDeck.slice(0, this.deckSize));

    // Clean up any leftover textures from a previous visit
    this.pool.forEach((key: string) => {
      const texKey: string = '_deck_' + key;
      if (this.textures.exists(texKey)) this.textures.remove(texKey);
    });

    // Generate unit preview textures at 2x for crisp display at any size
    const TEX_SCALE = 2;
    this.previews = {};
    this.pool.forEach((key: string) => {
      const def = UNIT_DEFS[key];
      const pad: number = Math.round(11 * TEX_SCALE);
      const uw: number = Math.round(def.w * TEX_SCALE);
      const uh: number = Math.round(def.h * TEX_SCALE);
      const pw: number = uw + pad * 2;
      const ph: number = uh + pad * 2;
      const g: Phaser.GameObjects.Graphics = this.add.graphics();
      const renderUnit: RenderUnit = {
        w: uw, h: uh,
        col: def.col, dk: def.dk,
        facing: 1, bob: 0, state: 'march' as const, atkCd: 0, atkRate: def.atkRate,
        trait: def.trait, hp: def.hp, maxHp: def.hp, burrowed: false, foreswingTimer: 0, backswingTimer: 0,
      };
      drawUnit(g, renderUnit, pw / 2, pad);
      const texKey: string = '_deck_' + key;
      g.generateTexture(texKey, pw, ph);
      g.destroy();
      this.previews[key] = texKey;
    });

    // Pagination
    this.page = 0;
    this.totalPages = Math.ceil(this.pool.length / PAGE_SIZE);

    // Draw pool cards — all created, visibility managed by showPage()
    this.cards = {};
    const actualCols: number = Math.min(this.pool.length, POOL_COLS);
    const gridW: number = actualCols * (CARD_W + CARD_GAP_X) - CARD_GAP_X;
    const startX: number = Math.round((W - gridW) / 2);
    const startY: number = 30;

    this.pool.forEach((key: string, i: number) => {
      const pageIdx: number = i % PAGE_SIZE;
      const col: number = pageIdx % POOL_COLS;
      const row: number = Math.floor(pageIdx / POOL_COLS);
      const x: number = startX + col * (CARD_W + CARD_GAP_X);
      const y: number = startY + row * (CARD_H + CARD_GAP_Y);
      this.createCard(key, x, y);
    });

    // --- Bottom section: page nav + deck label + deck slots + buttons ---
    const bottomY: number = startY + POOL_ROWS * (CARD_H + CARD_GAP_Y) + 14;

    // Page nav
    this.prevBtn = this.add.text(W / 2 - 71, bottomY, '<', {
      fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#555',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.pageLbl = this.add.text(W / 2, bottomY, '', {
      fontFamily: '"Courier New", monospace', fontSize: '10px', color: '#888',
    }).setOrigin(0.5);

    this.nextBtn = this.add.text(W / 2 + 71, bottomY, '>', {
      fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#555',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.prevBtn.on('pointerdown', () => { if (this.page > 0) { this.page--; this.showPage(); } });
    this.nextBtn.on('pointerdown', () => { if (this.page < this.totalPages - 1) { this.page++; this.showPage(); } });
    this.prevBtn.on('pointerover', () => this.prevBtn.setColor('#ccc'));
    this.prevBtn.on('pointerout', () => this.prevBtn.setColor('#555'));
    this.nextBtn.on('pointerover', () => this.nextBtn.setColor('#ccc'));
    this.nextBtn.on('pointerout', () => this.nextBtn.setColor('#555'));

    // Deck count label
    const deckLblY: number = bottomY + 24;
    this.deckLabel = this.add.text(W / 2, deckLblY, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#f0c040',
    }).setOrigin(0.5);

    // Deck slots row
    const slotW: number = 54;
    const slotH: number = 24;
    const slotGap: number = 6;
    const slotsY: number = deckLblY + 18;
    const slotsRowW: number = this.deckSize * (slotW + slotGap) - slotGap;
    const slotsStartX: number = (W - slotsRowW) / 2;

    this.deckSlots = [];
    for (let i = 0; i < this.deckSize; i++) {
      const sx: number = slotsStartX + i * (slotW + slotGap);
      const slotBg: Phaser.GameObjects.Graphics = this.add.graphics();
      slotBg.fillStyle(0x141420);
      slotBg.fillRoundedRect(sx, slotsY, slotW, slotH, 3);
      slotBg.lineStyle(1, 0x222233);
      slotBg.strokeRoundedRect(sx, slotsY, slotW, slotH, 3);
      // Clickable hit area to remove unit from deck
      const hitArea = this.add.rectangle(sx + slotW / 2, slotsY + slotH / 2, slotW, slotH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        const deckArr = [...this.selected];
        if (i < deckArr.length) {
          this.selected.delete(deckArr[i]);
          this.updateUI();
        }
      });
      this.deckSlots.push({ bg: slotBg, x: sx, y: slotsY, w: slotW, h: slotH, icon: null, nameTxt: null });
    }

    // Buttons row
    const btnY: number = slotsY + slotH + 16;

    const backBtn: Phaser.GameObjects.Text = this.add.text(W / 2 - 114, btnY, 'BACK', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#888',
      backgroundColor: '#0a0a14',
      padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const confirmBtn: Phaser.GameObjects.Text = this.add.text(W / 2 + 114, btnY, 'BATTLE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#f0c040',
      backgroundColor: '#150e04',
      padding: { x: 18, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.confirmBtn = confirmBtn;

    backBtn.on('pointerover', () => backBtn.setColor('#ccc'));
    backBtn.on('pointerout', () => backBtn.setColor('#888'));
    backBtn.on('pointerdown', () => { this.scene.start('MainMenuScene'); });

    confirmBtn.on('pointerover', () => {
      if (this.selected.size === this.deckSize) confirmBtn.setColor('#ffe080');
    });
    confirmBtn.on('pointerout', () => confirmBtn.setColor('#f0c040'));
    confirmBtn.on('pointerdown', () => {
      if (this.selected.size !== this.deckSize) return;
      const deckKeys: string[] = [...this.selected];
      this.save.setDeck(deckKeys);
      this.scene.start('BattleScene', { deck: deckKeys });
    });

    // Tooltip container (hidden by default)
    this.tooltip = this.add.container(0, 0).setVisible(false).setDepth(100);
    this.tooltipBg = this.add.graphics();
    this.tooltip.add(this.tooltipBg);
    this.tooltipTexts = [];

    this.showPage();
    this.updateUI();
  }

  private showPage(): void {
    const start = this.page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    this.pool.forEach((key: string, i: number) => {
      const card = this.cards[key];
      if (card) card.container.setVisible(i >= start && i < end);
    });
    this.pageLbl.setText(this.totalPages > 1 ? `${this.page + 1}/${this.totalPages}` : '');
    this.prevBtn.setVisible(this.totalPages > 1);
    this.nextBtn.setVisible(this.totalPages > 1);
    this.hideTooltip();
  }

  private showTooltip(key: string, worldX: number, worldY: number): void {
    const def = UNIT_DEFS[key];
    const dps: string = (def.atk * def.atkRate).toFixed(1);

    const TRAIT_DESC: Record<string, string> = {
      grub: 'Cheap fodder, no special ability',
      basic: 'No special ability',
      ranged: `Attacks from ${def.range}px range`,
      sniper: `Extreme ${def.range}px range, pierces 2 enemies`,
      area: 'Explodes on death dealing 65 AOE damage (up to 5)',
      swift: 'Very fast movement speed',
      healer: 'Heals nearest wounded ally every 2s',
      massive: 'Extremely high HP tank',
      berserk: 'Attack speed increases below 50% HP',
      rally: '+20% ATK to 5 nearest allies in range',
      shield: 'Absorbs 50% damage for 3s after spawn',
      shield_poison: 'Shield (50% absorb 3s) + Poison on hit',
      poison: 'Attacks apply poison (5 dmg/s for 3s)',
      burrow: 'Goes underground on spawn, surfaces behind enemy lines',
      aura: 'Nearby allies take 20% less damage',
      burn: 'Attacks set enemies on fire (8 dmg/s for 2s)',
      knockback: 'Rams enemies backward on each hit',
      lightning: 'Chain hits 3 foes, 25% stun, every 4th hit = 2x dmg',
    };

    const glTag = def.geneline ? ` ${GENELINE_DEFS[def.geneline].symbol}` : '';
    const lines: TooltipLine[] = [
      { text: `${def.name}  [${(TIER_DEFS[def.tier] || TIER_DEFS.F).label}]${glTag}`, color: '#ffe080', size: '17px', bold: true },
      { text: `HP: ${def.hp}   ATK: ${def.atk}   DPS: ${dps}`, color: '#ccc', size: '14px' },
      { text: `Speed: ${def.spd}   Range: ${def.range}   Rate: ${def.atkRate}/s`, color: '#999', size: '13px' },
      { text: `Cost: ${def.cost}g   Incubation: ${def.incubation}s`, color: '#f0c040', size: '13px' },
      { text: TRAIT_DESC[def.trait] || def.desc, color: '#80c0ff', size: '13px' },
    ];

    // Clear old texts
    this.tooltipTexts.forEach((t: Phaser.GameObjects.Text) => t.destroy());
    this.tooltipTexts = [];

    const pad: number = 14;
    let maxW: number = 0;
    let yOff: number = pad;

    lines.forEach((line: TooltipLine) => {
      const t: Phaser.GameObjects.Text = this.add.text(pad, yOff, line.text, {
        fontFamily: '"Courier New", monospace',
        fontSize: line.size,
        color: line.color,
        fontStyle: line.bold ? 'bold' : '',
      });
      this.tooltip.add(t);
      this.tooltipTexts.push(t);
      maxW = Math.max(maxW, t.width);
      yOff += t.height + 4;
    });

    const tw: number = maxW + pad * 2;
    const th: number = yOff + pad * 0.5;

    // Position: above the card, clamped to canvas
    let tx: number = worldX - tw / 2;
    let ty: number = worldY - th - 11;
    if (tx < 4) tx = 4;
    if (tx + tw > W - 4) tx = W - 4 - tw;
    if (ty < 4) ty = worldY + 85; // flip below if no room above

    this.tooltip.setPosition(tx, ty);
    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(0x0a0a18, 0.95);
    this.tooltipBg.fillRoundedRect(0, 0, tw, th, 6);
    this.tooltipBg.lineStyle(1, 0x444466);
    this.tooltipBg.strokeRoundedRect(0, 0, tw, th, 6);
    this.tooltip.setVisible(true);
  }

  private hideTooltip(): void {
    this.tooltip.setVisible(false);
  }

  private createCard(key: string, x: number, y: number): void {
    const def = UNIT_DEFS[key];
    const container: Phaser.GameObjects.Container = this.add.container(x, y);

    const cardBg: Phaser.GameObjects.Graphics = this.add.graphics();
    container.add(cardBg);

    const cx: number = Math.round(CARD_W / 2);

    // Tier badge (top-left)
    const tier = TIER_DEFS[def.tier] || TIER_DEFS.F;
    const tierBadge: Phaser.GameObjects.Text = this.add.text(4, 3, tier.label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: tier.color,
    });
    container.add(tierBadge);

    // Geneline badge (circle with symbol, next to tier)
    if (def.geneline) {
      const gl = GENELINE_DEFS[def.geneline];
      const glX = 4 + tierBadge.width + 14;
      const glY = 3 + tierBadge.height / 2;
      const glR = 7;
      const glGfx: Phaser.GameObjects.Graphics = this.add.graphics();
      // Red circle background
      glGfx.fillStyle(parseInt(gl.color.replace('#', ''), 16));
      glGfx.fillCircle(glX, glY, glR);
      // Dark outline
      glGfx.lineStyle(1, 0x3d0e0e);
      glGfx.strokeCircle(glX, glY, glR);
      container.add(glGfx);
      // Bone-colored symbol
      const glBadge: Phaser.GameObjects.Text = this.add.text(glX, glY - 1, gl.symbol, {
        fontFamily: '"Courier New", monospace',
        fontSize: '16px',
        color: '#d4c4b0',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(glBadge);
    }

    // Cost (top-right)
    const cost: Phaser.GameObjects.Text = this.add.text(CARD_W - 4, 3, `${def.cost}g`, {
      fontFamily: '"Courier New", monospace',
      fontSize: '11px',
      color: '#f0c040',
      fontStyle: 'bold',
    }).setOrigin(1, 0);
    container.add(cost);

    // Unit preview image (center)
    const texKey: string = this.previews[key];
    const icon: Phaser.GameObjects.Image = this.add.image(cx, 36, texKey).setScale(0.8);
    container.add(icon);

    // Name (below icon)
    const name: Phaser.GameObjects.Text = this.add.text(cx, 60, def.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#ddd',
    }).setOrigin(0.5);
    container.add(name);

    // Desc (bottom)
    const desc: Phaser.GameObjects.Text = this.add.text(cx, 74, def.desc, {
      fontFamily: '"Courier New", monospace',
      fontSize: '9px',
      color: '#888',
    }).setOrigin(0.5);
    container.add(desc);

    // Hit area
    const hitArea: Phaser.GameObjects.Rectangle = this.add.rectangle(CARD_W / 2, CARD_H / 2, CARD_W, CARD_H, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', () => this.toggleUnit(key));
    hitArea.on('pointerover', () => {
      if (!this.selected.has(key)) {
        cardBg.clear();
        cardBg.fillStyle(0x1a1a2a);
        cardBg.fillRoundedRect(0, 0, CARD_W, CARD_H, 4);
        cardBg.lineStyle(1, 0x555566);
        cardBg.strokeRoundedRect(0, 0, CARD_W, CARD_H, 4);
      }
      this.showTooltip(key, x + CARD_W / 2, y);
    });
    hitArea.on('pointerout', () => {
      this.drawCardBg(cardBg, key);
      this.hideTooltip();
    });

    this.cards[key] = { container, cardBg, name };
  }

  private toggleUnit(key: string): void {
    if (this.selected.has(key)) {
      this.selected.delete(key);
    } else {
      if (this.selected.size >= this.deckSize) return;
      this.selected.add(key);
    }
    this.updateUI();
  }

  private drawCardBg(cardBg: Phaser.GameObjects.Graphics, key: string): void {
    cardBg.clear();
    if (this.selected.has(key)) {
      cardBg.fillStyle(0x1a2a1a);
      cardBg.fillRoundedRect(0, 0, CARD_W, CARD_H, 4);
      cardBg.lineStyle(2, 0x60c040);
      cardBg.strokeRoundedRect(0, 0, CARD_W, CARD_H, 4);
    } else {
      cardBg.fillStyle(0x0e0e1a);
      cardBg.fillRoundedRect(0, 0, CARD_W, CARD_H, 4);
      cardBg.lineStyle(1, 0x222233);
      cardBg.strokeRoundedRect(0, 0, CARD_W, CARD_H, 4);
    }
  }

  private updateUI(): void {
    this.pool.forEach((key: string) => {
      const card: CardEntry | undefined = this.cards[key];
      if (card) this.drawCardBg(card.cardBg, key);
    });

    const count: number = this.selected.size;
    const full: boolean = count === this.deckSize;
    this.deckLabel.setText(`YOUR DECK (${count}/${this.deckSize})`);
    this.deckLabel.setColor(full ? '#60c040' : '#f0c040');

    // Update deck slots with icons
    const deckArr: string[] = [...this.selected];
    this.deckSlots.forEach((slot: DeckSlot, i: number) => {
      if (slot.icon) { slot.icon.destroy(); slot.icon = null; }
      if (slot.nameTxt) { slot.nameTxt.destroy(); slot.nameTxt = null; }

      slot.bg.clear();
      if (i < deckArr.length) {
        const key: string = deckArr[i];
        const texKey: string = this.previews[key];
        slot.icon = this.add.image(Math.round(slot.x + slot.w / 2), Math.round(slot.y + slot.h * 0.4), texKey).setScale(0.4);
        slot.nameTxt = this.add.text(Math.round(slot.x + slot.w / 2), slot.y + slot.h - 2, UNIT_DEFS[key].name, {
          fontFamily: '"Courier New", monospace',
          fontSize: '7px',
          color: '#aaa',
        }).setOrigin(0.5);
        slot.bg.fillStyle(0x1a2a1a);
        slot.bg.fillRoundedRect(slot.x, slot.y, slot.w, slot.h, 3);
        slot.bg.lineStyle(1, 0x406030);
        slot.bg.strokeRoundedRect(slot.x, slot.y, slot.w, slot.h, 3);
      } else {
        slot.bg.fillStyle(0x141420);
        slot.bg.fillRoundedRect(slot.x, slot.y, slot.w, slot.h, 3);
        slot.bg.lineStyle(1, 0x222233);
        slot.bg.strokeRoundedRect(slot.x, slot.y, slot.w, slot.h, 3);
      }
    });

    this.confirmBtn.setAlpha(full ? 1 : 0.35);
  }

}
