import Phaser from 'phaser';
import { H, SBW, DEFAULT_WORLD_W } from '../config/Constants';
import { LANE } from '../config/Layout';
import { getGroundY, laneDepth } from '../config/RouteMatrix';
const GND = LANE.land.groundY;
// Lane midline — the single-lane land ground. Clicks above this Y go to
// lane 0 (upper), below to lane 1 (lower). Also where the divider draws.
const LANE_MIDLINE_Y = LANE.land.groundY;
import { UNIT_DEFS, drawUnit } from '../units/registry';
import { lookupAbility } from '../config/combat/abilities';
import { ENEMY_DEFS } from '../config/EnemyDefs';
import { resolveColors } from '../config/Palettes';
import { Unit, resetUid } from '../entities/Unit';
import { BaseStructure } from '../entities/BaseStructure';
import { BaseEntity } from '../entities/BaseEntity';
import { CombatSystem } from '../systems/CombatSystem';
import { setCastFxDispatcher } from '../systems/CombatDispatch';
import { FxDirector } from '../systems/FxDirector';
import { registerCoreFx } from '../systems/FxRenderers';
import { EventBus } from '../systems/EventBus';
import { ParticleManager } from '../systems/ParticleManager';
import { AudioManager } from '../systems/AudioManager';
import { HpHud } from '../systems/HpHud';
import { ViewportController } from '../systems/ViewportController';
import { saveUserPreset, type Placement } from '../systems/SandboxPresets';
import type { EffectBearer } from '../config/combat/effects/types';
import type { RenderUnit, Side, UnitDef, PheromoneZone, PheromoneKind } from '../types';
import { PHEROMONE_DEFS } from '../config/PheromoneDefs';

// Sandbox base HP — matches production BASE_HP.
const SANDBOX_BASE_HP = 1000;
const UNIT_KEYS: string[] = Object.keys(UNIT_DEFS);

// Max Elite-caste units allowed per side. Mirrors the caste design
// ("Few (1-4) per battle", HIVYSS.md §8). Sandbox-local for now; the real
// deploy/capacity system will own this once Elites ship to live play.
const MAX_ELITES_PER_SIDE = 3;

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
  private fxDirector!: FxDirector;
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

  // Pheromone command state. `pheromoneZones` is the live array passed
  // to combat.resolve each frame; `selectedPheromone` is the active
  // kind (keys 1/2/3) or null (null = normal unit-placement mode).
  private pheromoneZones!: PheromoneZone[];
  private selectedPheromone!: PheromoneKind | null;
  private pheromoneLayer!: Phaser.GameObjects.Graphics;  // zone fills/rings, under units
  private pheromoneGhost!: Phaser.GameObjects.Graphics;   // follow-cursor preview circle

  // Background biome — the selectable environment (Wild / Sun Carapace). The
  // background is redrawn on switch; bgObjects tracks everything drawBackground
  // created so it can be cleared first.
  private biomeKey!: 'wild' | 'sunCarapace';
  private bgObjects!: Phaser.GameObjects.GameObject[];

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
    this.pheromoneZones = [];
    this.selectedPheromone = null;
    this.biomeKey = 'wild';
    this.bgObjects = [];

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

    // Pheromone zone layer — created right after the background so it
    // renders above the ground but below the units (which spawn later
    // in startFight, so they sit higher in the same-depth draw order).
    // Depth 50 keeps it under the depth-100 particle layer; the
    // translucent fill (alpha ~0.18) keeps units readable regardless.
    this.pheromoneLayer = this.add.graphics();
    this.pheromoneLayer.setDepth(50);
    this.pheromoneGhost = this.add.graphics();
    this.pheromoneGhost.setDepth(51);

    // FX director — one-shot ability FX (Stampede shockwave…) on its own
    // layer above the units. The cast-FX seam routes signature casts here,
    // resolving the ability's fx.kind → a registered renderer; magnitude
    // carries cohesion so the shockwave scales with the herd.
    const fxLayer = this.add.graphics();
    fxLayer.setDepth(64);
    this.fxDirector = new FxDirector(fxLayer);
    registerCoreFx(this.fxDirector);
    setCastFxDispatcher((s) => this.fxDirector.play({
      kind: s.ability.fx?.kind ?? '',
      x: s.x,
      y: s.y,
      color: 0xc8a070,   // dust tan (blunt); per-dmgType palette later
      magnitude: s.magnitude,
    }));

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

    // Pheromone command selection — number keys 1/2/3 (also R/C/T)
    // pick the active kind; click then paints a zone. ESC / 0 clears
    // the selection (back to unit-placement mode). Works mid-fight.
    this.input.keyboard?.on('keydown', this.onPheromoneKey, this);

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
    // HUD pheromone button row — mirrors keyboard selection.
    const onSelectPheromone = (evt: { kind: PheromoneKind | null }) => {
      this.selectPheromone(evt.kind);
    };
    // HUD biome dropdown — switch the background environment + redraw.
    const onSelectBiome = (evt: { biome: 'wild' | 'sunCarapace' }) => {
      this.biomeKey = evt.biome;
      this.drawBackground();
    };
    // HUD Elite-signature trigger, mid-fight only. With a unitId → fire that
    // one Elite (a slot click); without → fire all ready (the E hotkey).
    // Fire one Elite's signature from its HUD slot (mid-fight only).
    const onTriggerSignature = (evt: { unitId?: number }) => {
      if (this.running && evt.unitId != null) this.combat.requestSignature(evt.unitId);
    };

    this.eventBus.on('sandboxSelectUnit', onSelect);
    this.eventBus.on('sandboxFight', onFight);
    this.eventBus.on('sandboxReset', onReset);
    this.eventBus.on('sandboxClear', onClear);
    this.eventBus.on('sandboxLoadPreset', onLoadPreset);
    this.eventBus.on('sandboxSaveCurrentAs', onSaveAs);
    this.eventBus.on('sandboxSelectPheromone', onSelectPheromone);
    this.eventBus.on('sandboxSelectBiome', onSelectBiome);
    this.eventBus.on('sandboxTriggerSignature', onTriggerSignature);

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
      this.eventBus.off('sandboxSelectPheromone', onSelectPheromone);
      this.eventBus.off('sandboxSelectBiome', onSelectBiome);
      this.eventBus.off('sandboxTriggerSignature', onTriggerSignature);
      this.input.keyboard?.off('keydown', this.onPheromoneKey, this);
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
    // Picking a unit exits pheromone mode (the two cursor modes are
    // mutually exclusive). Clear the local kind + ghost and tell the
    // HUD button row to deselect.
    if (unitKey !== null && this.selectedPheromone !== null) {
      this.selectedPheromone = null;
      this.pheromoneGhost.clear();
      this.eventBus.emit('sandboxSelectPheromoneActive', { kind: null });
    }
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

  /**
   * Lane is derived from the pointer's world Y relative to the lane
   * midline: above → lane 0 (upper), below → lane 1 (lower).
   */
  private laneForY(y: number): number {
    return y < LANE_MIDLINE_Y ? 0 : 1;
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
    // Pheromone ghost — independent of the unit-placement ghost.
    if (this.selectedPheromone !== null) {
      this.drawPheromoneGhost(pointer);
      return;
    }

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
    // Resize to the lane the cursor is over so the ghost previews the
    // far-row shrink before you commit the placement.
    this.ghostSprite.setScale(1.2 * laneDepth(this.laneForY(pointer.worldY)).scale);

    // Auto-side: tint flips across the midline. setTexture only on
    // actual side change so pointermove doesn't thrash the texture.
    const side = this.sideForX(pointer.worldX);
    if (side !== this.ghostSide && this.selectedUnitKey) {
      this.ghostSprite.setTexture(this.previewKeyForSide(this.selectedUnitKey, side));
      this.ghostSide = side;
    }

    const valid = this.canPlaceSelected(pointer.worldX);

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
    // Screen-space filter — reject clicks on HUD zones.
    if (pointer.y < TOP_BAR_BOTTOM_Y) return;
    if (pointer.y >= CONTROL_PANEL_TOP_Y) return;

    // Pheromone placement — runs even DURING a fight (zones are painted
    // mid-battle to command units). Left-click only; right-click still
    // pans the camera (ViewportController) / deletes placements.
    if (this.selectedPheromone !== null && !pointer.rightButtonDown()) {
      if (!this.isValidPlacementForPointer(pointer.worldX)) return;
      // Normal click deploys a Scout that carries the command (the real path).
      // Shift+click drops a free static zone instead — a debug convenience for
      // isolating zone tuning from scout behaviour.
      const debugStatic = (pointer.event as MouseEvent | undefined)?.shiftKey === true;
      if (debugStatic) this.placePheromone(this.selectedPheromone, pointer.worldX, pointer.worldY);
      else this.deployScout(this.selectedPheromone, pointer.worldX, pointer.worldY);
      return;
    }

    // Everything below is pre-fight unit editing only.
    if (this.running) return;

    if (pointer.rightButtonDown()) {
      this.tryDeletePlacementAt(pointer.worldX, pointer.worldY);
      return;
    }

    if (this.selectedUnitKey === null) return;
    if (!this.canPlaceSelected(pointer.worldX)) return;
    this.placeUnit(pointer.worldX, pointer.worldY);
  }

  private placeUnit(x: number, y: number): void {
    const key = this.selectedUnitKey;
    if (!key) return;
    const side = this.sideForX(x);
    // Hard guard (defense in depth — the ghost already blocks this path).
    if (UNIT_DEFS[key]?.caste === 'elite' && this.eliteCount(side) >= MAX_ELITES_PER_SIDE) return;
    this.placements.push({ unitKey: key, side, x, lane: this.laneForY(y) });
    this.renderPlacementSprite(this.placements.length - 1);
    this.emitPlacementCount();
  }

  /** Count Elite-caste placements on a side (for the per-side Elite cap). */
  private eliteCount(side: Placement['side']): number {
    let n = 0;
    for (const p of this.placements) {
      if (p.side === side && UNIT_DEFS[p.unitKey]?.caste === 'elite') n++;
    }
    return n;
  }

  /**
   * Combined placement validity for the *currently selected* unit: the
   * zone must be legal AND, if the unit is an Elite, the target side must
   * be under MAX_ELITES_PER_SIDE. Drives both the ghost tint (preventive
   * red) and the click guard, so they never disagree.
   */
  private canPlaceSelected(worldX: number): boolean {
    if (!this.isValidPlacementForPointer(worldX)) return false;
    const key = this.selectedUnitKey;
    if (key && UNIT_DEFS[key]?.caste === 'elite') {
      if (this.eliteCount(this.sideForX(worldX)) >= MAX_ELITES_PER_SIDE) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------
  // Pheromone command (select kind → click to paint a movement zone)
  // ---------------------------------------------------------------

  /**
   * Keyboard selection: 1/R = rally, 2/C = charge, 3/T = retreat,
   * 0/Esc = clear. (Esc also clears the unit selection via the HUD; we
   * additionally clear the local pheromone selection.) Selecting a
   * pheromone clears any active unit-placement ghost so the two modes
   * don't fight over the cursor.
   */
  private onPheromoneKey(ev: KeyboardEvent): void {
    let kind: PheromoneKind | null | undefined;
    switch (ev.key.toLowerCase()) {
      case '1': case 'r': kind = 'rally'; break;
      case '2': case 'c': kind = 'charge'; break;
      case '3': case 't': kind = 'retreat'; break;
      case '0': case 'escape': kind = null; break;
      default: return;  // not a pheromone key — ignore
    }
    this.selectPheromone(kind);
  }

  /** Set the active pheromone kind (null = back to unit-placement mode). */
  private selectPheromone(kind: PheromoneKind | null): void {
    this.selectedPheromone = kind;
    if (kind !== null) {
      // Entering pheromone mode — drop the unit ghost + selection so
      // clicks paint zones instead of placing units.
      this.clearGhost();
      this.ghostInvalidOutline.clear();
      this.ghostInvalidOutline.setVisible(false);
      if (this.selectedUnitKey !== null) {
        this.selectedUnitKey = null;
        this.eventBus.emit('sandboxSelectUnit', { unitKey: null });
      }
    } else {
      this.pheromoneGhost.clear();
    }
    // Broadcast so the HUD button row can reflect the active state.
    this.eventBus.emit('sandboxSelectPheromoneActive', { kind });
  }

  /**
   * Paint a zone of `kind` at world-(x, y); side derived from x relative
   * to the midline, lane from y relative to the lane midline.
   */
  private placePheromone(kind: PheromoneKind, x: number, y: number): void {
    const def = PHEROMONE_DEFS[kind];
    this.pheromoneZones.push({
      kind,
      x,
      radius: def.radius,
      side: this.sideForX(x),
      lane: this.laneForY(y),
      remaining: def.duration,
    });
    this.drawPheromoneZones();
  }

  /**
   * Deploy a Scout (worker) carrying `kind` at world-(x, y): a fast, fragile,
   * NON-combatant that runs forward emitting a MOBILE pheromone zone bound to
   * it. Kill the Scout → the command dies with it (update() tracks + culls the
   * owner-zone). This is the real, vulnerable command path that replaces the
   * old free instant click-zone. Live spawn — running only.
   */
  private deployScout(kind: PheromoneKind, x: number, y: number): void {
    if (!this.running) return;
    const side = this.sideForX(x);
    const lane = this.laneForY(y);
    const baseDef = side === 'enemy' ? ENEMY_DEFS['escout'] : UNIT_DEFS['scout'];
    if (!baseDef) return;

    const scout = new Unit(this, { ...baseDef, _key: 'scout' }, side, x, lane);
    scout.primary = PHEROMONE_DEFS[kind].color; // tint the scout to its command
    scout.setDepth(60 + lane);
    this.units.push(scout);

    const pdef = PHEROMONE_DEFS[kind];
    this.pheromoneZones.push({
      kind,
      x: scout.x + scout.unitW / 2,
      radius: pdef.radius,
      side,
      lane,
      remaining: pdef.duration, // unused for owner-zones (culled on scout death)
      ownerUnitId: scout.id,
    });
    this.drawPheromoneZones();
  }

  /** Cursor-follow preview circle for the selected pheromone. */
  private drawPheromoneGhost(pointer: Phaser.Input.Pointer): void {
    const g = this.pheromoneGhost;
    g.clear();
    if (this.selectedPheromone === null) return;

    const inBattlefield =
      pointer.y >= TOP_BAR_BOTTOM_Y &&
      pointer.y < CONTROL_PANEL_TOP_Y;
    if (!inBattlefield) return;

    const def = PHEROMONE_DEFS[this.selectedPheromone];
    const valid = this.isValidPlacementForPointer(pointer.worldX);
    const color = valid ? def.color : 0xff3030;
    // Render at the lane the pointer is over (above/below the midline).
    const zy = getGroundY('land', this.laneForY(pointer.worldY));
    g.fillStyle(color, 0.15);
    g.fillCircle(pointer.worldX, zy, def.radius);
    g.lineStyle(2, color, 0.6);
    g.strokeCircle(pointer.worldX, zy, def.radius);
  }

  /** Rebuild the persistent zone layer from `pheromoneZones`. */
  private drawPheromoneZones(): void {
    const g = this.pheromoneLayer;
    g.clear();
    for (const z of this.pheromoneZones) {
      const def = PHEROMONE_DEFS[z.kind];
      const zy = getGroundY('land', z.lane);
      g.fillStyle(def.color, 0.18);
      g.fillCircle(z.x, zy, z.radius);
      g.lineStyle(2, def.color, 0.7);
      g.strokeCircle(z.x, zy, z.radius);
    }
  }

  private emitPlacementCount(): void {
    let player = 0, enemy = 0;
    for (const p of this.placements) {
      if (p.side === 'player') player++; else enemy++;
    }
    this.eventBus.emit('sandboxPlacementCount', { player, enemy });
    this.emitEliteSlots();
  }

  /**
   * Push the player's Elite-signature slot state to the HUD. Fixed length
   * = MAX_ELITES_PER_SIDE; null = an empty slot. Pre-fight the source is
   * Elite placements (so slots preview as you place); in-fight it's the
   * live Elite units (real cooldowns, firable, drops out on death).
   */
  private emitEliteSlots(): void {
    type Slot = { id: number; name: string; ready: boolean; cdFrac: number; firable: boolean; inRange: boolean };
    const slots: Array<Slot | null> = [];
    if (this.running) {
      for (const u of this.units) {
        if (u.side !== 'player' || u.dead) continue;
        if (UNIT_DEFS[u.key]?.caste !== 'elite') continue;
        const frac = u.signatureCooldown > 0 ? u.sigCd / u.signatureCooldown : 0;
        slots.push({
          id: u.id,
          name: u.unitName,
          ready: u.canSignature(),
          cdFrac: frac < 0 ? 0 : frac > 1 ? 1 : frac,
          firable: !!u.signatureAbility,
          inRange: this.signatureHasTarget(u),
        });
      }
    } else {
      for (const p of this.placements) {
        if (p.side !== 'player') continue;
        if (UNIT_DEFS[p.unitKey]?.caste !== 'elite') continue;
        slots.push({ id: -1, name: UNIT_DEFS[p.unitKey]?.name ?? p.unitKey, ready: false, cdFrac: 0, firable: false, inRange: false });
      }
    }
    while (slots.length < MAX_ELITES_PER_SIDE) slots.push(null);
    slots.length = MAX_ELITES_PER_SIDE; // clamp defensively
    this.eventBus.emit('sandboxEliteSlots', { slots });
  }

  /** True if an enemy is within the unit's signature-ability range (same lane)
   *  — i.e. firing the signature would actually connect. */
  private signatureHasTarget(u: Unit): boolean {
    if (!u.signatureAbility) return false;
    const range = lookupAbility(u.signatureAbility).range ?? 0;
    if (range <= 0) return false;
    const ux = u.x + u.unitW / 2;
    for (const e of this.units) {
      if (e.side === u.side || e.dead || e.lane !== u.lane) continue;
      if (Math.abs((e.x + e.unitW / 2) - ux) < range) return true;
    }
    return false;
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
      const unitY = getGroundY(def.route ?? 'land', p.lane ?? 0);
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
    const lane = p.lane ?? 0;
    const y = getGroundY(def.route ?? 'land', lane);
    const dep = laneDepth(lane);
    const spr = this.add.image(p.x, y, this.previewKeyForSide(p.unitKey, p.side));
    // Feet-anchor — see handleSelectUnit comment for the originY math.
    // Scaling around the feet origin keeps the unit grounded; lane depth
    // shrinks + dims the far (North) row to match the live fight.
    spr.setOrigin(0.5, (10 + def.h) / (def.h + 30));
    spr.setAlpha(0.6 * dep.alpha);
    spr.setScale(1.2 * dep.scale);
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

  private clearPheromoneZones(): void {
    this.pheromoneZones = [];
    this.pheromoneLayer.clear();
  }

  private clearPlacements(): void {
    if (this.running) return;
    this.placements = [];
    this.clearPlacementSprites();
    this.clearPheromoneZones();
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
    // Old presets (saved before lanes existed) have no `lane`; default
    // them to lane 0 so every placement is lane-resolved downstream.
    this.placements = placements.map((p) => ({ ...p, lane: p.lane ?? 0 }));
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
    this.clearPheromoneZones();
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
      const lane = p.lane ?? 0;
      const unit = new Unit(this, { ...baseDef, _key: p.unitKey }, p.side, p.x, lane);
      // Render units ABOVE the pheromone zone layer (depth 50) so the
      // painted zones read as ground markings under the herd. +lane so the
      // near (South) row draws over the far (North) row where they overlap.
      unit.setDepth(60 + lane);
      this.units.push(unit);
    }

    // Fresh fight — clear any zones + FX left from a prior run.
    this.pheromoneZones = [];
    this.fxDirector.reset();
    this.drawPheromoneZones();

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

    // Pheromone zones — decay then drop expired BEFORE resolve reads
    // them (resolve only READS zones). Redraw on any change.
    if (this.pheromoneZones.length > 0) {
      let changed = false;
      this.pheromoneZones = this.pheromoneZones.filter((z) => {
        if (z.ownerUnitId != null) {
          // Mobile worker-zone: track the Scout each frame; the command dies
          // with it (cull when the owner is dead/gone).
          const owner = this.units.find((u) => u.id === z.ownerUnitId && !u.dead);
          if (!owner) { changed = true; return false; }
          const nx = owner.x + owner.unitW / 2;
          if (nx !== z.x || owner.lane !== z.lane) { z.x = nx; z.lane = owner.lane; changed = true; }
          return true;
        }
        z.remaining -= dt;
        if (z.remaining <= 0) { changed = true; return false; }
        return true;
      });
      if (changed) this.drawPheromoneZones();
    }

    this.combat.resolve(
      this.units, dt,
      this.playerBaseStructure, this.enemyBaseStructure,
      this.particles, 0, this.audio,
      this.pheromoneZones,
    );

    this.fxDirector.update(dt);

    this.playerBaseEntity.syncDead();
    this.enemyBaseEntity.syncDead();

    this.redrawHpBars();

    this.units = this.units.filter((u: Unit) => {
      if (u.dead) { u.kill(); return false; }
      return true;
    });

    // Refresh Elite-signature slots (live cooldowns + drop dead Elites).
    this.emitEliteSlots();

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
      burrowed: false, windup: 0, recover: 0,
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

  private lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bgr = (b >> 8) & 255, bb = b & 255;
    return (((ar + (br - ar) * t) | 0) << 16) | (((ag + (bgr - ag) * t) | 0) << 8) | ((ab + (bb - ab) * t) | 0);
  }

  /**
   * Battlefield as a 2.5D cross-section for the selected BIOME: a sky/backdrop,
   * a surface, then the underground tunnel galleries. Redrawable — destroys the
   * previous background objects first (so [B] can switch biomes live).
   */
  private drawBackground(): void {
    this.bgObjects.forEach((o) => o.destroy());
    this.bgObjects = [];
    const ww = DEFAULT_WORLD_W;
    const bg = this.add.graphics();
    bg.setDepth(-100);   // always behind bases/units — a redraw is added to the
                         // display list LAST, so without this it'd paint over them.
    this.bgObjects.push(bg);

    const lN = getGroundY('land', 0), lS = getGroundY('land', 1);
    const tN = getGroundY('tunnel', 0), tS = getGroundY('tunnel', 1);
    const grassTop = Math.round(lN);        // grass tip = North land's feet (it walks ON the surface)
    const dirtTop  = Math.round(lS + 8);    // underground begins just below the surface

    if (this.biomeKey === 'sunCarapace') this.drawCarapaceSurface(bg, ww, grassTop, dirtTop);
    else this.drawWildSurface(bg, ww, grassTop, dirtTop);

    this.drawUnderground(bg, ww, dirtTop, tN, tS);

    // Faint VS marker high in the sky.
    const vs = this.add.text(ww / 2, Math.round(grassTop * 0.4), 'VS', {
      fontFamily: '"Press Start 2P", monospace', fontSize: '20px', color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.06).setDepth(-90);
    this.bgObjects.push(vs);
  }

  // ---- WILD biome (Normal / neutral) — untamed woodland: misty forest sky,
  // layered tree silhouettes, green grass surface. ----
  private drawWildSurface(bg: Phaser.GameObjects.Graphics, ww: number, grassTop: number, dirtTop: number): void {
    const steps = 14, stepH = Math.ceil(grassTop / steps);
    for (let i = 0; i < steps; i++) {
      bg.fillStyle(this.lerpColor(0x162a28, 0x40604a, i / (steps - 1)));
      bg.fillRect(0, i * stepH, ww, stepH + 1);
    }
    bg.fillStyle(0x294a38, 0.7);                                 // far misty hills
    for (let x = -40; x < ww; x += 220) bg.fillEllipse(x, grassTop, 320, 150);
    bg.fillStyle(0x305238, 0.8);
    for (let x = 80; x < ww; x += 260) bg.fillEllipse(x, grassTop + 6, 280, 120);
    const tree = (cx: number, h: number, w: number, trunk: number, leaf: number): void => {
      bg.fillStyle(trunk); bg.fillRect(cx - w * 0.12, grassTop - h * 0.55, w * 0.24, h * 0.55);
      bg.fillStyle(leaf);
      bg.fillEllipse(cx, grassTop - h * 0.72, w, h * 0.5);
      bg.fillEllipse(cx - w * 0.5, grassTop - h * 0.55, w * 0.7, h * 0.38);
      bg.fillEllipse(cx + w * 0.5, grassTop - h * 0.55, w * 0.7, h * 0.38);
      bg.fillEllipse(cx, grassTop - h * 0.5, w * 0.9, h * 0.4);
    };
    for (let i = 0; i < 26; i++) tree((i * 197 + 30) % ww, 120 + (i * 31) % 70, 70 + (i % 3) * 16, 0x223a28, 0x315a3a);
    for (let i = 0; i < 18; i++) tree((i * 233 + 110) % ww, 150 + (i * 41) % 90, 90 + (i % 3) * 22, 0x2a4630, 0x3e6e44);
    bg.fillStyle(0x46763a);                                     // grass fill (harmonised with the trees)
    bg.fillRect(0, grassTop, ww, dirtTop - grassTop + 6);
    bg.fillStyle(0x5e9048);                                     // sunlit grass top
    for (let x = 0; x < ww; x += 4) bg.fillRect(x, grassTop - ((x * 7) % 4), 4, 6 + ((x * 7) % 4));
    bg.fillStyle(0x508040);                                     // tufts
    for (let i = 0; i < 90; i++) {
      const gx = (i * 67) % ww, th = 6 + (i % 4) * 4;
      bg.fillRect(gx, grassTop - th, 2, th);
      bg.fillRect(gx + 3, grassTop - Math.round(th * 0.7), 2, Math.round(th * 0.7));
      bg.fillRect(gx - 3, grassTop - Math.round(th * 0.6), 2, Math.round(th * 0.6));
    }
  }

  // ---- SUN CARAPACE biome (α Primal) — open sunlit chitin plain: warm golden
  // sky + a sun, distant low ridges (NO trees — open for the herd to mass),
  // amber exoskeleton surface with segmented plate-seams. ----
  private drawCarapaceSurface(bg: Phaser.GameObjects.Graphics, ww: number, grassTop: number, dirtTop: number): void {
    const steps = 14, stepH = Math.ceil(grassTop / steps);
    for (let i = 0; i < steps; i++) {
      bg.fillStyle(this.lerpColor(0x6a8290, 0xe8c474, i / (steps - 1)));   // warm sky → golden heat horizon
      bg.fillRect(0, i * stepH, ww, stepH + 1);
    }
    bg.fillStyle(0xfff0c8, 0.16); bg.fillCircle(ww * 0.3, grassTop * 0.42, 60);   // sun halo
    bg.fillStyle(0xfff4d4, 0.55); bg.fillCircle(ww * 0.3, grassTop * 0.42, 34);   // sun disc
    bg.fillStyle(0x9c7438, 0.45);                                 // distant low chitin ridges (open)
    for (let x = -30; x < ww; x += 210) bg.fillEllipse(x, grassTop + 6, 280, 64);
    bg.fillStyle(0xb0863e, 0.55);
    for (let x = 110; x < ww; x += 250) bg.fillEllipse(x, grassTop + 10, 230, 50);
    bg.fillStyle(0xcaa86a);                                       // sandstone surface (sun-baked, sandy)
    bg.fillRect(0, grassTop, ww, dirtTop - grassTop + 6);
    bg.fillStyle(0xe4c888);                                       // sunlit sand top edge
    bg.fillRect(0, grassTop, ww, 4);
    bg.fillStyle(0xb88c52, 0.5);                                  // horizontal sandstone striations (sedimentary layers)
    for (let y = grassTop + 8; y < dirtTop; y += 6) {
      for (let x = 0; x < ww; x += 18) bg.fillRect(x + ((y * 5) % 10), y, 14, 2);
    }
    bg.fillStyle(0x8a6638, 0.4);                                  // sparse vertical cracks (carapace-shell hint)
    for (let x = 0; x < ww; x += 96) bg.fillRect(x + ((x * 7) % 18), grassTop + 4, 2, dirtTop - grassTop - 6);
    bg.fillStyle(0x7c7a38);                                       // sparse dry tufts in the seams
    for (let i = 0; i < 46; i++) {
      const gx = (i * 97) % ww, th = 4 + (i % 3) * 3;
      bg.fillRect(gx, grassTop - th, 2, th);
      bg.fillRect(gx + 3, grassTop - Math.round(th * 0.6), 2, Math.round(th * 0.6));
    }
  }

  // ---- Underground (shared across biomes) — ant-nest galleries. North unit
  // sits BEHIND the South tunnel's opacity (sGal@60.5); both buried by tVeil@62.
  // Soil is warmed slightly for Sun Carapace. ----
  private drawUnderground(bg: Phaser.GameObjects.Graphics, ww: number, dirtTop: number, tN: number, tS: number): void {
    const dirtH = H - dirtTop, ds = Math.max(1, Math.ceil(dirtH / 4));
    // Per-biome underground palette. Wild = dark, loamy forest soil (fades to
    // near-black). Sun Carapace = warm, lighter SANDSTONE strata (drier desert
    // subsoil — stays warm rather than going black).
    const sand = this.biomeKey === 'sunCarapace';
    const pal = sand
      ? { top: 0xba9c5c, bot: 0x46331a, speck: 0x3a2812, crack: 0x4a3620, tunN: 0x5e4626, tunS: 0x301f0e, veil: 0x3a2812, veilSpeck: 0x241808 }
      : { top: 0x7a5029, bot: 0x1a1107, speck: 0x2c1c0e, crack: 0x201305, tunN: 0x4a3620, tunS: 0x1c1308, veil: 0x281a0c, veilSpeck: 0x140d06 };

    for (let i = 0; i < ds; i++) {                        // soil body → deep earth
      bg.fillStyle(this.lerpColor(pal.top, pal.bot, Math.min(1, (i / Math.max(1, ds - 1)) * 1.3)));
      bg.fillRect(0, dirtTop + Math.floor((i * dirtH) / ds), ww, Math.ceil(dirtH / ds) + 1);
    }
    // Sandstone biomes get horizontal sedimentary striations (vs loamy specks).
    if (sand) {
      bg.fillStyle(0x8a6630, 0.3);
      for (let y = dirtTop + 6; y < H; y += 14) for (let x = 0; x < ww; x += 22) bg.fillRect(x + ((y * 5) % 12), y, 16, 2);
    }
    bg.fillStyle(pal.speck, 0.4);                         // grain speckle
    for (let i = 0; i < 200; i++) bg.fillRect((i * 89) % ww, dirtTop + 4 + (i * 47) % Math.max(1, dirtH - 8), 2, 2);
    bg.lineStyle(2, pal.crack, 0.4);                      // branching cracks
    for (let i = 0; i < 20; i++) {
      let cx = (i * 211) % ww, cy = dirtTop + 16 + (i * 53) % Math.max(1, dirtH - 48);
      bg.beginPath(); bg.moveTo(cx, cy);
      for (let s = 0; s < 4; s++) { cx += ((i + s) % 5) * 6 - 12; cy += 8 + (s % 3) * 4; bg.lineTo(cx, cy); }
      bg.strokePath();
    }
    const galleryH = 38;
    const galTop = (y: number): number => Math.round(y - 12 - galleryH / 2);
    bg.fillStyle(pal.tunN, 1);                            // North tunnel — solid, behind the North unit
    bg.fillRect(0, galTop(tN), ww, galleryH);
    const sGal = this.add.graphics();                    // South tunnel — over the North unit (60.5)
    sGal.setDepth(60.5);
    sGal.fillStyle(pal.tunS, 0.55);
    sGal.fillRect(0, galTop(tS), ww, galleryH);
    this.bgObjects.push(sGal);
    const tVeil = this.add.graphics();                   // dirt veil over both tunnel units (62)
    tVeil.setDepth(62);
    tVeil.fillStyle(pal.veil, 0.5);
    tVeil.fillRect(0, dirtTop, ww, H - dirtTop);
    tVeil.fillStyle(pal.veilSpeck, 0.35);
    for (let i = 0; i < 180; i++) tVeil.fillRect((i * 83) % ww, dirtTop + 2 + (i * 59) % Math.max(1, H - dirtTop - 6), 3, 2);
    this.bgObjects.push(tVeil);
  }
}
