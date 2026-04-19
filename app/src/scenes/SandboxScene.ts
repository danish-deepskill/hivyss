import Phaser from 'phaser';
import { H, SBW, DEFAULT_WORLD_W } from '../config/Constants';
import { LANE } from '../config/Layout';
const GND = LANE.land.groundY;
import { UNIT_DEFS, drawUnit } from '../units/registry';
import { ENEMY_DEFS } from '../config/EnemyDefs';
import { resolveColors } from '../config/Palettes';
import { Unit, resetUid } from '../entities/Unit';
import { BaseStructure } from '../entities/BaseStructure';
import { BaseEntity } from '../entities/BaseEntity';
import { CombatSystem } from '../systems/CombatSystem';
import { EventBus } from '../systems/EventBus';
import { ParticleManager } from '../systems/ParticleManager';
import { AudioManager } from '../systems/AudioManager';
import { HpHud } from '../systems/HpHud';
import { ViewportController } from '../systems/ViewportController';
import { saveUserPreset, type Placement } from '../systems/SandboxPresets';
import type { EffectBearer } from '../config/combat/effects/types';
import type { RenderUnit, Side, UnitDef } from '../types';

// Sandbox base HP — matches production BASE_HP.
const SANDBOX_BASE_HP = 1000;
const UNIT_KEYS: string[] = Object.keys(UNIT_DEFS);

// Horizontal placement bounds. Each side owns its half of the
// battlefield; within that half, HIVE_PAD keeps the placement zone
// outside the hive structure on its own side. Continuity with the
// pre-rewrite arena offset (player units used to spawn at x=57).
const HIVE_PAD = 57;

// Screen-space HUD filter — SandboxHUDScene owns these zones. Scene-
// level pointerdown / pointermove in SandboxScene still fires on HUD
// background clicks (panel graphics aren't interactive), so we filter
// by screen-space pointer.y instead of world-Y. Zoom-independent.
// CONTROL_PANEL_H must stay in sync with SandboxHUDScene's constant.
const TOP_BAR_BOTTOM_Y = 50;
const CONTROL_PANEL_H = 240;
const CONTROL_PANEL_TOP_Y = H - CONTROL_PANEL_H;

export class SandboxScene extends Phaser.Scene {
  // Placement state
  private placements!: Placement[];
  private selectedUnitKey!: string | null;
  // Current ghost tint side (null while no ghost exists). Tracked so
  // onPointerMove doesn't call setTexture every frame — only when the
  // pointer crosses the midline and the side actually changes.
  private ghostSide!: Side | null;

  // Live-battle state
  private units!: Unit[];
  private running!: boolean;
  private elapsed!: number;
  private combat!: CombatSystem;
  private particles!: ParticleManager;
  private audio!: AudioManager;

  // Cross-scene comms
  private eventBus!: EventBus;
  private viewport!: ViewportController;

  // Base targets
  private playerBaseStructure!: BaseStructure;
  private enemyBaseStructure!: BaseStructure;
  private playerBaseEntity!: BaseEntity;
  private enemyBaseEntity!: BaseEntity;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private enemyHpBar!: Phaser.GameObjects.Graphics;

  // Placement rendering (world-space)
  private ghostSprite!: Phaser.GameObjects.Image | null;
  private ghostInvalidOutline!: Phaser.GameObjects.Graphics;
  private placementSprites!: Phaser.GameObjects.Image[];

  constructor() {
    super('SandboxScene');
  }

  create(): void {
    resetUid();

    // State
    this.placements = [];
    this.selectedUnitKey = null;
    this.ghostSide = null;
    this.units = [];
    this.running = false;
    this.elapsed = 0;
    this.ghostSprite = null;
    this.placementSprites = [];

    // Cross-scene EventBus — stored under a sandbox-prefixed key so
    // it doesn't collide with WorldScene's 'eventBus'. Must be on the
    // registry BEFORE SandboxHUDScene launches so the HUD can pick it
    // up in its own create().
    this.eventBus = new EventBus();
    this.registry.set('sandbox.eventBus', this.eventBus);

    // Combat pipeline + rendering helpers. worldW now matches a real
    // run (DEFAULT_WORLD_W = 2560), so CombatSystem wall checks align
    // with the expanded arena and combat pacing feels like playtest.
    this.combat = new CombatSystem(this, new EventBus(), DEFAULT_WORLD_W);
    this.particles = new ParticleManager(this);
    this.audio = new AudioManager();

    // Preview textures for both sides — HUD reads from the same
    // shared TextureManager, so they must exist before HUD's create()
    // builds its roster. generatePreviews runs here; scene.launch
    // for HUD happens after this call.
    this.generatePreviews();

    this.drawBackground();

    // Base wiring — enemy hive pushed to the far end of the expanded
    // arena.
    this.playerBaseStructure = new BaseStructure(this, 0, 'player');
    this.playerBaseStructure.maxHp = SANDBOX_BASE_HP;
    this.playerBaseStructure.setHp(SANDBOX_BASE_HP);
    this.enemyBaseStructure = new BaseStructure(this, DEFAULT_WORLD_W - SBW, 'enemy');
    this.enemyBaseStructure.maxHp = SANDBOX_BASE_HP;
    this.enemyBaseStructure.setHp(SANDBOX_BASE_HP);
    this.playerBaseEntity = new BaseEntity(this.playerBaseStructure, SBW);
    this.enemyBaseEntity = new BaseEntity(this.enemyBaseStructure, DEFAULT_WORLD_W - SBW);
    this.combat.setBaseEntities(this.playerBaseEntity, this.enemyBaseEntity);

    this.playerHpBar = this.add.graphics();
    this.enemyHpBar = this.add.graphics();
    this.redrawHpBars();

    // Invalid-placement outline reused across pointer moves.
    this.ghostInvalidOutline = this.add.graphics();
    this.ghostInvalidOutline.setVisible(false);

    // Camera + drag/zoom + keyboard pan. initialCenter at arena
    // center so both hives read equally at load; sandbox is a
    // symmetric surface, not a one-sided run. edgeZone: 0 disables
    // mouse-edge pan — user wants hover near RESET to not scroll.
    this.viewport = new ViewportController(this);
    this.viewport.attach({
      worldW: DEFAULT_WORLD_W,
      initialCenter: { x: DEFAULT_WORLD_W / 2, y: H / 2 },
      edgeZone: 0,
      // Right-click drag so left-click stays dedicated to placement.
      dragButton: 'right',
    });

    // Browser right-click menu suppression — right-click is the
    // placement-delete gesture.
    this.input.mouse?.disableContextMenu();

    // Battlefield pointer handling — ghost follow + place / delete.
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerdown', this.onPointerDown, this);

    // HUD launches after previews exist + EventBus is on registry.
    this.scene.launch('SandboxHUDScene');

    // EventBus subscriptions for HUD-initiated actions.
    const onSelect = (evt: { unitKey: string | null }) => {
      this.handleSelectUnit(evt.unitKey);
    };
    const onFight = () => { this.startFight(); };
    const onReset = () => { this.resetArena(); };
    const onClear = () => { this.clearPlacements(); };
    const onLoadPreset = (evt: { placements: Placement[] }) => {
      this.handleLoadPreset(evt.placements);
    };
    const onSaveAs = (evt: { name: string }) => {
      this.handleSaveCurrentAs(evt.name);
    };

    this.eventBus.on('sandboxSelectUnit', onSelect);
    this.eventBus.on('sandboxFight', onFight);
    this.eventBus.on('sandboxReset', onReset);
    this.eventBus.on('sandboxClear', onClear);
    this.eventBus.on('sandboxLoadPreset', onLoadPreset);
    this.eventBus.on('sandboxSaveCurrentAs', onSaveAs);

    if (import.meta.env.DEV) {
      HpHud.attachSource(() => this.units);
    }

    this.events.once('shutdown', () => {
      this.eventBus.off('sandboxSelectUnit', onSelect);
      this.eventBus.off('sandboxFight', onFight);
      this.eventBus.off('sandboxReset', onReset);
      this.eventBus.off('sandboxClear', onClear);
      this.eventBus.off('sandboxLoadPreset', onLoadPreset);
      this.eventBus.off('sandboxSaveCurrentAs', onSaveAs);
      HpHud.detachSource();
      this.scene.stop('SandboxHUDScene');
    });
  }

  // ---------------------------------------------------------------
  // Base management
  // ---------------------------------------------------------------

  private resetBases(): void {
    this.playerBaseStructure.setHp(SANDBOX_BASE_HP);
    this.enemyBaseStructure.setHp(SANDBOX_BASE_HP);
    this.playerBaseEntity.syncDead();
    this.enemyBaseEntity.syncDead();
    (this.playerBaseEntity as EffectBearer).activeEffects = [];
    (this.enemyBaseEntity as EffectBearer).activeEffects = [];
    if (this.playerHpBar) this.redrawHpBars();
  }

  private redrawHpBars(): void {
    this.drawHpBar(this.playerHpBar, 2, GND - 114, SBW - 4,
      this.playerBaseStructure.hp, this.playerBaseStructure.maxHp, 'player');
    this.drawHpBar(this.enemyHpBar, DEFAULT_WORLD_W - SBW + 2, GND - 114, SBW - 4,
      this.enemyBaseStructure.hp, this.enemyBaseStructure.maxHp, 'enemy');
  }

  private drawHpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, hp: number, maxHp: number, side: Side): void {
    g.clear();
    const frac = Math.max(0, hp / maxHp);
    const isBlue = side === 'player';
    g.fillStyle(0x080810);
    g.fillRect(x, y, w, 6);
    let hpColor: number;
    if (frac > 0.5) hpColor = isBlue ? 0x4ab0f0 : 0xf05050;
    else if (frac > 0.25) hpColor = 0xf0c040;
    else hpColor = 0xf03030;
    g.fillStyle(hpColor);
    g.fillRect(x, y, w * frac, 6);
    g.lineStyle(0.5, 0x111111);
    g.strokeRect(x, y, w, 6);
  }

  // ---------------------------------------------------------------
  // HUD-driven state mutators
  // ---------------------------------------------------------------

  private handleSelectUnit(unitKey: string | null): void {
    this.selectedUnitKey = unitKey;
    if (unitKey === null) {
      this.clearGhost();
      this.ghostInvalidOutline.clear();
      this.ghostInvalidOutline.setVisible(false);
      return;
    }
    // Default to player tint on creation; onPointerMove corrects
    // based on current pointer position once it fires.
    const initialSide: Side = 'player';
    const texKey = this.previewKeyForSide(unitKey, initialSide);
    const def = UNIT_DEFS[unitKey];
    // Feet-anchor: generateOnePreview uses asymmetric padding (10px
    // top, 20px bottom). originY = (top_pad + def.h) / texture_height
    // puts the unit's bottom edge at the passed-in y coord.
    const originY = (10 + def.h) / (def.h + 30);
    if (!this.ghostSprite) {
      this.ghostSprite = this.add.image(-100, -100, texKey);
      this.ghostSprite.setOrigin(0.5, originY);
      this.ghostSprite.setAlpha(0.55);
      this.ghostSprite.setScale(1.2);
    } else {
      this.ghostSprite.setTexture(texKey);
      this.ghostSprite.setOrigin(0.5, originY);
    }
    this.ghostSide = initialSide;
  }

  /** Side is derived from the pointer's world X relative to midline. */
  private sideForX(x: number): Side {
    return x < DEFAULT_WORLD_W / 2 ? 'player' : 'enemy';
  }

  private clearGhost(): void {
    if (this.ghostSprite) {
      this.ghostSprite.destroy();
      this.ghostSprite = null;
    }
  }

  private previewKeyForSide(key: string, side: Side): string {
    return (side === 'enemy' ? '_sb_preview_e' : '_sb_preview_') + key;
  }

  // ---------------------------------------------------------------
  // Pointer handling (battlefield click-to-place + ghost follow)
  // ---------------------------------------------------------------

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.ghostSprite || this.selectedUnitKey === null) return;

    // Screen-space HUD filter — zoom-independent. World-space clicks
    // that happen to land over HUD zones in screen terms are rejected.
    const inBattlefield =
      pointer.y >= TOP_BAR_BOTTOM_Y &&
      pointer.y < CONTROL_PANEL_TOP_Y;

    if (!inBattlefield) {
      // Pointer is over the HUD — hide the ghost + outline entirely
      // so a half-sprite doesn't poke above the panel edge.
      this.ghostSprite.setVisible(false);
      this.ghostInvalidOutline.setVisible(false);
      return;
    }

    this.ghostSprite.setVisible(true);
    this.ghostSprite.setPosition(pointer.worldX, pointer.worldY);

    // Auto-side: tint flips across the midline. setTexture only on
    // actual side change so pointermove doesn't thrash the texture.
    const side = this.sideForX(pointer.worldX);
    if (side !== this.ghostSide && this.selectedUnitKey) {
      this.ghostSprite.setTexture(this.previewKeyForSide(this.selectedUnitKey, side));
      this.ghostSide = side;
    }

    const valid = this.isValidPlacementForPointer(pointer.worldX);

    if (valid) {
      this.ghostSprite.clearTint();
      this.ghostSprite.setAlpha(0.55);
      this.ghostInvalidOutline.clear();
      this.ghostInvalidOutline.setVisible(false);
    } else {
      this.ghostSprite.setTint(0xff3030);
      this.ghostSprite.setAlpha(0.4);
      const w = this.ghostSprite.displayWidth;
      const h = this.ghostSprite.displayHeight;
      this.ghostInvalidOutline.clear();
      this.ghostInvalidOutline.lineStyle(2, 0xff3030, 0.8);
      this.ghostInvalidOutline.strokeRect(
        pointer.worldX - w / 2,
        pointer.worldY - h / 2,
        w, h,
      );
      this.ghostInvalidOutline.setVisible(true);
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.running) return;

    // Screen-space filter — reject clicks on HUD zones.
    if (pointer.y < TOP_BAR_BOTTOM_Y) return;
    if (pointer.y >= CONTROL_PANEL_TOP_Y) return;

    if (pointer.rightButtonDown()) {
      this.tryDeletePlacementAt(pointer.worldX, pointer.worldY);
      return;
    }

    if (this.selectedUnitKey === null) return;
    if (!this.isValidPlacementForPointer(pointer.worldX)) return;
    this.placeUnit(pointer.worldX);
  }

  private placeUnit(x: number): void {
    const key = this.selectedUnitKey;
    if (!key) return;
    this.placements.push({ unitKey: key, side: this.sideForX(x), x });
    this.renderPlacementSprite(this.placements.length - 1);
    this.emitPlacementCount();
  }

  private emitPlacementCount(): void {
    let player = 0, enemy = 0;
    for (const p of this.placements) {
      if (p.side === 'player') player++; else enemy++;
    }
    this.eventBus.emit('sandboxPlacementCount', { player, enemy });
  }

  /**
   * Hive exclusion only — side is derived from x via sideForX, so the
   * only invalid zones are the two hive structures. Midline just
   * flips which side a placement goes to; no "wrong-side" error.
   */
  private isValidPlacementForPointer(x: number): boolean {
    return x >= HIVE_PAD && x <= DEFAULT_WORLD_W - HIVE_PAD;
  }

  private tryDeletePlacementAt(x: number, y: number): void {
    for (let i = this.placements.length - 1; i >= 0; i--) {
      const p = this.placements[i];
      const def = UNIT_DEFS[p.unitKey];
      if (!def) continue;
      const unitY = LANE[def.route ?? 'land'].groundY;
      const dx = Math.abs(x - p.x);
      const dy = Math.abs(y - unitY);
      if (dx <= def.w / 2 + 6 && dy <= def.h) {
        this.placements.splice(i, 1);
        this.rerenderAllPlacementSprites();
        this.emitPlacementCount();
        return;
      }
    }
  }

  private renderPlacementSprite(idx: number): void {
    const p = this.placements[idx];
    const def = UNIT_DEFS[p.unitKey];
    const y = LANE[def.route ?? 'land'].groundY;
    const spr = this.add.image(p.x, y, this.previewKeyForSide(p.unitKey, p.side));
    // Feet-anchor — see handleSelectUnit comment for the originY math.
    spr.setOrigin(0.5, (10 + def.h) / (def.h + 30));
    spr.setAlpha(0.6);
    spr.setScale(1.2);
    this.placementSprites.push(spr);
  }

  private clearPlacementSprites(): void {
    this.placementSprites.forEach(s => s.destroy());
    this.placementSprites = [];
  }

  private rerenderAllPlacementSprites(): void {
    this.clearPlacementSprites();
    for (let i = 0; i < this.placements.length; i++) {
      this.renderPlacementSprite(i);
    }
  }

  // ---------------------------------------------------------------
  // Fight / reset / clear
  // ---------------------------------------------------------------

  private clearPlacements(): void {
    if (this.running) return;
    this.placements = [];
    this.clearPlacementSprites();
    this.resetBases();
    this.eventBus.emit('sandboxFightResult', {
      result: 'draw', message: '', color: '#f0c040', timeStr: '',
    });
    this.emitPlacementCount();
  }

  /**
   * Replace the current placement set with a preset's placements.
   * Mirrors clearPlacements then renders each placement sprite.
   * No-op during a running fight.
   */
  private handleLoadPreset(placements: Placement[]): void {
    if (this.running) return;
    this.placements = placements.map((p) => ({ ...p }));
    this.clearGhost();
    this.clearPlacementSprites();
    this.resetBases();
    this.rerenderAllPlacementSprites();
    this.selectedUnitKey = null;
    this.ghostSide = null;
    this.eventBus.emit('sandboxSelectUnit', { unitKey: null });
    this.eventBus.emit('sandboxFightResult', {
      result: 'draw', message: '', color: '#f0c040', timeStr: '',
    });
    this.emitPlacementCount();
  }

  /**
   * Persist the current placements under the given name. HUD re-
   * reads the dropdown after the sandboxPresetsChanged broadcast.
   */
  private handleSaveCurrentAs(name: string): void {
    saveUserPreset(name, this.placements);
    this.eventBus.emit('sandboxPresetsChanged', {});
  }

  private resetArena(): void {
    resetUid();
    this.running = false;
    this.elapsed = 0;
    this.units.forEach((u: Unit) => u.kill());
    this.units = [];
    this.resetBases();
    this.rerenderAllPlacementSprites();
    this.eventBus.emit('sandboxRunningState', { running: false });
    this.eventBus.emit('sandboxFightResult', {
      result: 'draw', message: '', color: '#f0c040', timeStr: '',
    });
  }

  private startFight(): void {
    if (this.running) return;
    if (this.placements.length === 0) return;

    resetUid();

    this.clearPlacementSprites();
    this.units.forEach((u: Unit) => u.kill());
    this.units = [];

    for (const p of this.placements) {
      const baseDef = p.side === 'enemy'
        ? ENEMY_DEFS['e' + p.unitKey]
        : UNIT_DEFS[p.unitKey];
      if (!baseDef) continue;
      const unit = new Unit(this, { ...baseDef, _key: p.unitKey }, p.side, p.x);
      this.units.push(unit);
    }

    this.resetBases();
    this.running = true;
    this.elapsed = 0;
    this.eventBus.emit('sandboxRunningState', { running: true });
    this.eventBus.emit('sandboxFightResult', {
      result: 'draw', message: '', color: '#f0c040', timeStr: '',
    });
  }

  // ---------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dt: number = Math.min(delta / 1000, 0.05);

    this.viewport.update(dt);
    this.particles.update(dt);

    if (!this.running) return;

    this.elapsed += dt;

    this.playerBaseStructure.update(dt);
    this.enemyBaseStructure.update(dt);

    this.combat.resolve(
      this.units, dt,
      this.playerBaseStructure, this.enemyBaseStructure,
      this.particles, 0, this.audio,
    );

    this.playerBaseEntity.syncDead();
    this.enemyBaseEntity.syncDead();

    this.redrawHpBars();

    this.units = this.units.filter((u: Unit) => {
      if (u.dead) { u.kill(); return false; }
      return true;
    });

    const playerBaseDead = this.playerBaseStructure.hp <= 0;
    const enemyBaseDead = this.enemyBaseStructure.hp <= 0;

    if (playerBaseDead || enemyBaseDead) {
      this.running = false;
      this.eventBus.emit('sandboxRunningState', { running: false });

      const timeStr = `${this.elapsed.toFixed(1)}s`;
      if (playerBaseDead && enemyBaseDead) {
        this.eventBus.emit('sandboxFightResult', {
          result: 'draw', message: 'DRAW!', color: '#888888', timeStr,
        });
      } else if (enemyBaseDead) {
        this.eventBus.emit('sandboxFightResult', {
          result: 'player', message: 'PLAYER WINS!', color: '#40c0ff', timeStr,
        });
      } else {
        this.eventBus.emit('sandboxFightResult', {
          result: 'enemy', message: 'ENEMY WINS!', color: '#ff6040', timeStr,
        });
      }
    }
  }

  // ---------------------------------------------------------------
  // Preview textures — one per (unit, side)
  // ---------------------------------------------------------------

  private generatePreviews(): void {
    UNIT_KEYS.forEach((key: string) => {
      [`_sb_preview_${key}`, `_sb_preview_e${key}`].forEach((texKey) => {
        if (this.textures.exists(texKey)) this.textures.remove(texKey);
      });
    });

    UNIT_KEYS.forEach((key: string) => {
      const playerDef = UNIT_DEFS[key];
      // Player units face right (east) in live spawns; enemies face
      // left (west). Bake the facing into the preview so the pre-
      // fight ghost + placement sprite match the live Unit's facing
      // and don't flip on FIGHT.
      this.generateOnePreview(playerDef, `_sb_preview_${key}`, 1);
      const enemyDef = ENEMY_DEFS['e' + key];
      if (enemyDef) this.generateOnePreview(enemyDef, `_sb_preview_e${key}`, -1);
    });
  }

  private generateOnePreview(def: UnitDef, texKey: string, facing: number): void {
    const pad = 10;
    const pw = def.w + pad * 2;
    const ph = def.h + pad * 2 + 10;
    const g = this.add.graphics();
    const renderUnit: RenderUnit = {
      w: def.w, h: def.h,
      ...resolveColors(def),
      palette: def.palette,
      facing, bob: 0,
      state: 'march' as const, atkCd: 0, atkRate: def.atkRate,
      trait: def.trait, hp: def.hp, maxHp: def.hp,
      burrowed: false, foreswingTimer: 0, backswingTimer: 0,
    };
    drawUnit(g, renderUnit, pw / 2, pad);
    g.generateTexture(texKey, pw, ph);
    g.destroy();
    // Pixel-perfect upscale for roster thumbnails + placement ghost
    // + pre-fight placement sprites at 1.5× camera zoom × 1.2× scale.
    // Default LINEAR blurs; NEAREST matches the game's pixel-art look.
    this.textures.get(texKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // ---------------------------------------------------------------
  // Background (extended across the expanded arena)
  // ---------------------------------------------------------------

  private drawBackground(): void {
    const ww = DEFAULT_WORLD_W;
    const bg = this.add.graphics();
    bg.fillStyle(0x0e0e18);
    bg.fillRect(0, 0, ww, H);
    bg.fillStyle(0xffffff, 0.1);
    for (let i = 0; i < 100; i++) {
      bg.fillRect((i * 137.5) % ww, (i * 73) % (GND - 20), 1, 1);
    }
    bg.fillStyle(0x1e1a0c);
    bg.fillRect(0, GND, ww, H - GND);
    bg.fillStyle(0x2a2410);
    bg.fillRect(0, GND, ww, 8);

    bg.lineStyle(1, 0xffffff, 0.08);
    for (let y = 50; y < GND; y += 12) {
      bg.beginPath();
      bg.moveTo(ww / 2, y);
      bg.lineTo(ww / 2, Math.min(y + 4, GND));
      bg.strokePath();
    }
    this.add.text(ww / 2, GND * 0.5, 'VS', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '28px', color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.06);
  }
}
