import Phaser from 'phaser';
import { H, SBW, DEFAULT_WORLD_W } from '../config/Constants';
import { LANE } from '../config/Layout';
import { getGroundY } from '../config/RouteMatrix';
import { drawPheromoneTrail } from './PheromoneTrail';
const GND = LANE.land.groundY;
import { UNIT_DEFS } from '../units/registry';
import { ENEMY_DEFS } from '../config/EnemyDefs';
import { resetUid } from '../entities/Unit';
import { HiveStructure } from '../entities/structures/HiveStructure';
import { HiveEntity } from '../entities/structures/HiveEntity';
import { Towers } from '../systems/structures/Towers';
import { BattleCore } from '../systems/BattleCore';
import { setCastFxDispatcher, setImpactFxDispatcher } from '../systems/CombatDispatch';
import { FxDirector } from '../systems/FxDirector';
import { registerCoreFx } from '../systems/FxRenderers';
import { TerrainRenderer } from '../systems/TerrainRenderer';
import { EventBus } from '../systems/EventBus';
import { ParticleManager } from '../systems/ParticleManager';
import { AudioManager } from '../systems/AudioManager';
import { HpHud } from '../systems/HpHud';
import { ViewportController } from '../systems/ViewportController';
import { saveUserPreset, type Placement } from '../systems/SandboxPresets';
import { renderPreviewTexture } from '../ui/UnitPreviews';
import type { EffectBearer } from '../config/combat/effects/types';
import type { Side, PheromoneKind, EliteSlot, GeneLine } from '../types';
import { PHEROMONE_DEFS } from '../config/PheromoneDefs';
import { drawBiomeBackground } from './BiomeBackground';

// Sandbox base HP — matches production BASE_HP.
const SANDBOX_BASE_HP = 1000;
const UNIT_KEYS: string[] = Object.keys(UNIT_DEFS);

// Sandbox-only hive preview: the H key cycles BOTH hives through the authored
// geneline bodies so each can be eyeballed here (real play doesn't yet field
// them all — no β node, the run Royal is α). Add a geneline = add its key.
const HIVE_PREVIEW_GENELINES: GeneLine[] = ['normal', 'alpha', 'beta'];

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

  // Live-battle state — the substrate (units/combat/zones) is BattleCore,
  // the same module the real run loop composes; the sandbox is just a
  // different DRIVER over it (free placement, fight/reset, no economy).
  private core!: BattleCore;
  private running!: boolean;
  private elapsed!: number;
  private particles!: ParticleManager;
  private fxDirector!: FxDirector;
  private terrainRenderer!: TerrainRenderer;
  private audio!: AudioManager;

  // Cross-scene comms
  private eventBus!: EventBus;
  private viewport!: ViewportController;

  // Base targets
  private playerBaseStructure!: HiveStructure;
  private enemyBaseStructure!: HiveStructure;
  private towers!: Towers;
  private playerBaseEntity!: HiveEntity;
  private enemyBaseEntity!: HiveEntity;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private enemyHpBar!: Phaser.GameObjects.Graphics;

  // Placement rendering (world-space)
  private ghostSprite!: Phaser.GameObjects.Image | null;
  private ghostInvalidOutline!: Phaser.GameObjects.Graphics;
  private placementSprites!: Phaser.GameObjects.Image[];

  // Pheromone command state — the live zone array is core.pheromoneZones;
  // `selectedPheromone` is the active kind (keys 1/2/3) or null (null =
  // normal unit-placement mode).
  private selectedPheromone!: PheromoneKind | null;
  private pheromoneLayer!: Phaser.GameObjects.Graphics;  // zone fills/rings, under units
  private pheromoneGhost!: Phaser.GameObjects.Graphics;   // follow-cursor preview circle

  // Background biome — the selectable environment (Wild / Sun Carapace). The
  // background is redrawn on switch; bgObjects tracks everything drawBackground
  // created so it can be cleared first.
  private biomeKey!: 'wild' | 'sunCarapace' | 'fetidPool';
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
    this.running = false;
    this.elapsed = 0;
    this.ghostSprite = null;
    this.placementSprites = [];
    this.selectedPheromone = null;
    this.biomeKey = 'wild';
    this.bgObjects = [];

    // Cross-scene EventBus — stored under a sandbox-prefixed key so
    // it doesn't collide with WorldScene's 'eventBus'. Must be on the
    // registry BEFORE SandboxHUDScene launches so the HUD can pick it
    // up in its own create().
    this.eventBus = new EventBus();
    this.registry.set('sandbox.eventBus', this.eventBus);

    // The battle substrate (units/pool/combat/zones) — the SAME BattleCore
    // the real run loop uses, so combat features exist here automatically.
    // worldW matches a real run (DEFAULT_WORLD_W) so pacing feels like
    // playtest. Combat events go to a throwaway bus (no economy listening).
    this.core = new BattleCore(this, new EventBus(), DEFAULT_WORLD_W);
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

    // Terrain blobs — depth 48 (set by the renderer), below the unit band
    // (60-70) and above the biome background (~45). Decoupled + stub-able.
    this.terrainRenderer = new TerrainRenderer(this.add.graphics());

    // FX director — one-shot ability FX (Stampede shockwave…) on its own
    // layer above the units. The cast-FX seam routes signature casts here,
    // resolving the ability's fx.kind → a registered renderer; magnitude
    // carries cohesion so the shockwave scales with the herd. Depth 80 keeps it
    // above the whole unit depth band (60..70).
    const fxLayer = this.add.graphics();
    fxLayer.setDepth(80);
    this.fxDirector = new FxDirector(fxLayer);
    registerCoreFx(this.fxDirector);
    setCastFxDispatcher((s) => this.fxDirector.play({
      kind: s.ability.fx?.kind ?? '',
      x: s.x,
      y: s.y,
      color: 0xc8a070,   // dust tan (blunt); per-dmgType palette later
      magnitude: s.magnitude,
    }));
    // Impact seam — per-hit FX (Fire Bite's flame), reads the SEPARATE
    // `impactFx` field so casts never double-fire.
    setImpactFxDispatcher((s) => this.fxDirector.play({
      kind: s.ability.impactFx?.kind ?? '',
      x: s.x,
      y: s.y,
      magnitude: s.magnitude,
    }));

    // Base wiring — enemy hive pushed to the far end of the expanded
    // arena.
    this.playerBaseStructure = new HiveStructure(this, 0, 'player');
    this.playerBaseStructure.maxHp = SANDBOX_BASE_HP;
    this.playerBaseStructure.setHp(SANDBOX_BASE_HP);
    this.enemyBaseStructure = new HiveStructure(this, DEFAULT_WORLD_W - SBW, 'enemy');
    this.enemyBaseStructure.maxHp = SANDBOX_BASE_HP;
    this.enemyBaseStructure.setHp(SANDBOX_BASE_HP);
    this.playerBaseEntity = new HiveEntity(this.playerBaseStructure, SBW);
    this.enemyBaseEntity = new HiveEntity(this.enemyBaseStructure, DEFAULT_WORLD_W - SBW);
    this.core.combat.setBaseEntities(this.playerBaseEntity, this.enemyBaseEntity);

    // Spires — forward towers per side (the node-grade defense; here a sandbox
    // demo of the firing/destructible mechanic). They shoot the nearest enemy in
    // range and can be destroyed back.
    this.towers = new Towers(this, this.core, (sx, sy, tx, ty, color) =>
      this.fxDirector.play({ kind: 'spit', x: sx, y: sy, tx, ty, color }));
    // Two towers per side, demoing range + destructibility.
    this.towers.add('player', SBW + 200);
    this.towers.add('player', SBW + 360);
    this.towers.add('enemy', DEFAULT_WORLD_W - SBW - 200);
    this.towers.add('enemy', DEFAULT_WORLD_W - SBW - 360);

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

    // Dev preview: H cycles both hives through each geneline's body.
    this.input.keyboard?.on('keydown-H', this.cycleHivePreview, this);

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
    const onSelectBiome = (evt: { biome: 'wild' | 'sunCarapace' | 'fetidPool' }) => {
      this.biomeKey = evt.biome;
      this.drawBackground();
    };
    // HUD Elite-signature trigger, mid-fight only. With a unitId → fire that
    // one Elite (a slot click); without → fire all ready (the E hotkey).
    // Fire one Elite's signature from its HUD slot (mid-fight only).
    const onTriggerSignature = (evt: { unitId?: number }) => {
      if (this.running && evt.unitId != null) this.core.combat.requestSignature(evt.unitId);
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
      HpHud.attachSource(() => this.core.units);
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
      this.input.keyboard?.off('keydown-H', this.cycleHivePreview, this);
      this.towers.destroy();
      this.core.destroy(); // unsubscribe terrain + unregister its dispatch seams
      HpHud.detachSource();
      this.scene.stop('SandboxHUDScene');
    });
  }

  // ---------------------------------------------------------------
  // Base management
  // ---------------------------------------------------------------

  // Dev: advance both hives to the next geneline body (derives the next from
  // the current geneline — no extra state to keep in sync).
  private cycleHivePreview(): void {
    const order = HIVE_PREVIEW_GENELINES;
    const next = order[(order.indexOf(this.playerBaseStructure.geneline) + 1) % order.length];
    this.playerBaseStructure.setGeneline(next);
    this.enemyBaseStructure.setGeneline(next);
  }

  private resetBases(): void {
    this.playerBaseStructure.setHp(SANDBOX_BASE_HP);
    this.enemyBaseStructure.setHp(SANDBOX_BASE_HP);
    this.towers.reset();
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
    this.ghostSprite.setScale(1.2);

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

    // Left-click a tower → toggle its range ring (inspect any time); clicking
    // elsewhere clears it. Consumes the click so it doesn't also place a unit.
    if (!pointer.rightButtonDown()) {
      if (this.towers.selectAt(pointer.worldX, pointer.worldY)) return;
      this.towers.clearSelection();
    }

    // Pheromone placement — runs even DURING a fight (zones are painted
    // mid-battle to command units). Left-click only; right-click still
    // pans the camera (ViewportController) / deletes placements.
    if (this.selectedPheromone !== null && !pointer.rightButtonDown()) {
      if (!this.isValidPlacementForPointer(pointer.worldX)) return;
      // Normal click deploys a Scout that carries the command (the real path).
      // Shift+click drops a free static zone instead — a debug convenience for
      // isolating zone tuning from scout behaviour.
      const debugStatic = (pointer.event as MouseEvent | undefined)?.shiftKey === true;
      if (debugStatic) this.placePheromone(this.selectedPheromone, pointer.worldX);
      else this.deployScout(this.selectedPheromone, pointer.worldX);
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
    this.placeUnit(pointer.worldX);
  }

  private placeUnit(x: number): void {
    const key = this.selectedUnitKey;
    if (!key) return;
    const side = this.sideForX(x);
    // Hard guard (defense in depth — the ghost already blocks this path).
    if (UNIT_DEFS[key]?.caste === 'elite' && this.eliteCount(side) >= MAX_ELITES_PER_SIDE) return;
    this.placements.push({ unitKey: key, side, x });
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
   * Keyboard selection: 1/R = rally, 2/C = charge, 3/T = retreat, 4/F = frenzy,
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
      case '4': case 'f': kind = 'frenzy'; break;
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
   * Paint a zone of `kind` at world-x; side derived from x relative to the
   * midline.
   */
  private placePheromone(kind: PheromoneKind, x: number): void {
    const def = PHEROMONE_DEFS[kind];
    this.core.pheromoneZones.push({
      kind,
      x,
      radius: def.radius,
      side: this.sideForX(x),
      remaining: def.duration,
    });
    this.drawPheromoneZones();
  }

  /**
   * Deploy a Scout (worker) carrying `kind` at world-x: a fast, fragile,
   * NON-combatant that runs forward laying a FADING pheromone TRAIL as it goes
   * (the sim drops scent-blobs per `pheromoneKind` in CombatSystem.resolve).
   * Kill the Scout → no new scent, but the laid trail persists and fades on its
   * own timer (deposit-fade, VISION §5). Live spawn — running only.
   */
  private deployScout(kind: PheromoneKind, x: number): void {
    if (!this.running) return;
    this.core.spawnCourier(kind, this.sideForX(x), x);
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
    const zy = getGroundY('land');
    g.fillStyle(color, 0.15);
    g.fillCircle(pointer.worldX, zy, def.radius);
    g.lineStyle(2, color, 0.6);
    g.strokeCircle(pointer.worldX, zy, def.radius);
  }

  /** Rebuild the persistent zone layer from the live zones. */
  private drawPheromoneZones(): void {
    this.pheromoneLayer.clear();
    drawPheromoneTrail(this.pheromoneLayer, this.core.pheromoneZones);
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
    // In-fight: the shared substrate derivation (live cooldowns, in-range,
    // drops dead Elites). Pre-fight: preview slots from the placements.
    const slots: Array<EliteSlot | null> = this.running
      ? [...this.core.getEliteSlots('player')]
      : this.placements
          .filter(p => p.side === 'player' && UNIT_DEFS[p.unitKey]?.caste === 'elite')
          .map(p => ({ id: -1, key: p.unitKey, name: UNIT_DEFS[p.unitKey]?.name ?? p.unitKey, ready: false, cdFrac: 0, firable: false, inRange: false }));
    while (slots.length < MAX_ELITES_PER_SIDE) slots.push(null);
    slots.length = MAX_ELITES_PER_SIDE; // clamp defensively
    this.eventBus.emit('sandboxEliteSlots', { slots });
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
      const unitY = getGroundY(def.route ?? 'land');
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
    const y = getGroundY(def.route ?? 'land');
    const spr = this.add.image(p.x, y, this.previewKeyForSide(p.unitKey, p.side));
    // Feet-anchor — see handleSelectUnit comment for the originY math. Scaling
    // around the feet origin keeps the unit grounded.
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

  private clearPheromoneZones(): void {
    this.core.pheromoneZones = [];
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
    this.core.clear();
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
    this.core.clear();

    for (const p of this.placements) {
      const baseDef = p.side === 'enemy'
        ? ENEMY_DEFS['e' + p.unitKey]
        : UNIT_DEFS[p.unitKey];
      if (!baseDef) continue;
      this.core.createUnit(p.unitKey, p.side, baseDef, p.x);
    }

    // Fresh fight — clear any zones + FX left from a prior run.
    this.core.pheromoneZones = [];
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

  update(time: number, delta: number): void {
    const dt: number = Math.min(delta / 1000, 0.05);

    this.viewport.update(dt);
    this.particles.update(dt);
    // Terrain repaints every frame (it self-clears), so an empty grid (pre-fight
    // / post-reset) shows nothing and laid terrain stays visible at fight end.
    this.terrainRenderer.draw(this.core.terrain.grid, time * 0.001);

    if (!this.running) return;

    this.elapsed += dt;

    this.playerBaseStructure.update(dt);
    this.enemyBaseStructure.update(dt);

    // The substrate step: decay the scent-trail fade BEFORE resolve appends
    // this frame's fresh blobs, then combat, then reap the dead to the pool.
    const hadTrail = this.core.pheromoneZones.length > 0;
    this.core.tickZones(dt);
    this.core.resolve(
      dt,
      this.playerBaseStructure, this.enemyBaseStructure,
      this.particles, 0, this.audio,
    );
    this.core.postResolve();

    // Towers fire after combat resolves (units are positioned for this frame).
    this.towers.tick(dt);

    // The trail changes every frame (deposit + fade) — redraw while active,
    // and clear once when the last blob is gone.
    if (this.core.pheromoneZones.length > 0) this.drawPheromoneZones();
    else if (hadTrail) this.pheromoneLayer.clear();

    this.fxDirector.update(dt);

    this.playerBaseEntity.syncDead();
    this.enemyBaseEntity.syncDead();

    this.redrawHpBars();

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
      // Player units face right (east) in live spawns; enemies face left
      // (west). Bake the facing into the preview so the pre-fight ghost +
      // placement sprite match the live Unit's facing and don't flip on
      // FIGHT. Shared renderer — same draw the HUD + brood cards use.
      renderPreviewTexture(this, UNIT_DEFS[key], `_sb_preview_${key}`, { facing: 1 });
      const enemyDef = ENEMY_DEFS['e' + key];
      if (enemyDef) renderPreviewTexture(this, enemyDef, `_sb_preview_e${key}`, { facing: -1 });
    });
  }

  // ---------------------------------------------------------------
  // Background (extended across the expanded arena)
  // ---------------------------------------------------------------

  /**
   * Battlefield as a 2.5D cross-section for the selected BIOME: sky/backdrop,
   * surface, then the underground tunnel galleries. Delegates to the shared
   * `drawBiomeBackground` renderer (also used by the real battle). Redrawable —
   * destroys the prior bg objects first so the [B] biome dropdown switches live.
   */
  private drawBackground(): void {
    this.bgObjects.forEach((o) => o.destroy());
    const objs = drawBiomeBackground(this, this.biomeKey, DEFAULT_WORLD_W);
    // Faint VS marker high in the sky (sandbox flourish, not part of the biome).
    const grassTop = Math.round(getGroundY('land'));
    const vs = this.add.text(DEFAULT_WORLD_W / 2, Math.round(grassTop * 0.4), 'VS', {
      fontFamily: '"Press Start 2P", monospace', fontSize: '20px', color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.06).setDepth(-90);
    this.bgObjects = [...objs, vs];
  }

}
