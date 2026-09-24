import Phaser from 'phaser';
import { DEFAULT_WORLD_W } from '../config/Constants';
import { drawBiomeBackground } from './BiomeBackground';
import { drawPheromoneTrail } from './PheromoneTrail';
import { setCastFxDispatcher, setImpactFxDispatcher } from '../systems/CombatDispatch';
import { FxDirector } from '../systems/FxDirector';
import { registerCoreFx } from '../systems/FxRenderers';
import { TerrainRenderer } from '../systems/TerrainRenderer';
import { PlacementGhost } from '../systems/structures/PlacementGhost';
import { BUILDING_HALF_W, BUILDING_HEIGHT } from '../draws/structures/buildings/dims';
import { getGroundY } from '../config/RouteMatrix';
import { UNIT_DEFS } from '../units/registry';
import { FORAGE_ENABLED } from '../config/ForageDefs';
import { ABILITY_DEFS } from '../config/AbilityDefs';
import { GameManager } from '../systems/GameManager';
import { capUsed, MAX_CAPACITY } from '../systems/Capacity';
import { ViewportController } from '../systems/ViewportController';
import type { PlayerAbilityKey, WaveDef, HiveProfile, PheromoneKind, Route } from '../types';
import type { RunBuff } from '../systems/RunState';

interface WorldSceneData {
  deck: string[];
  startWave: number;
  worldW?: number;
  customWaves?: WaveDef[];
  runBuffs?: RunBuff[];
  hiveProfile?: HiveProfile;
  hiveSeed?: number;
}

export class WorldScene extends Phaser.Scene {
  gm!: GameManager;
  private worldW: number = DEFAULT_WORLD_W;
  private viewport!: ViewportController;
  private pheromoneLayer!: Phaser.GameObjects.Graphics;
  private royalLayer!: Phaser.GameObjects.Graphics;
  private bloomLayer!: Phaser.GameObjects.Graphics;
  private fxDirector!: FxDirector;
  private terrainRenderer!: TerrainRenderer;
  private placementGhost!: PlacementGhost;
  /** Reused scratch for per-frame cursor→world projection (no per-frame alloc). */
  private readonly _ghostPt = new Phaser.Math.Vector2();
  /** Shift-held telegraph: a marker at the tunnel ground line by the hive,
   *  showing the next deploy spawns underground (Phase 2a). */
  private deployHint!: Phaser.GameObjects.Container;

  constructor() {
    super('WorldScene');
  }

  create(data: WorldSceneData): void {
    this.worldW = data.worldW ?? DEFAULT_WORLD_W;

    this.drawBackground();

    // Scent-trail layer — drawn above the biome, under units (matches the
    // sandbox's pheromone depth so both render the deposit-fade identically).
    this.pheromoneLayer = this.add.graphics();
    this.pheromoneLayer.setDepth(50);

    // Royal control affordance — a ring under the controllable Royal + her
    // current order marker. Above the scent layer, under the units.
    this.royalLayer = this.add.graphics();
    this.royalLayer.setDepth(51);

    // Nectar blooms (the forage economy) — repainted each frame from Forage
    // state: petals scale with the remaining pool, rich blooms are clusters,
    // the priority ring marks the standing G-order, raids flash red.
    if (FORAGE_ENABLED) {
      this.bloomLayer = this.add.graphics();
      this.bloomLayer.setDepth(49); // under the scent layer + units
    }

    // FX director — one-shot ability FX (Stampede / Primal Roar shockwaves)
    // above the units, same wiring as the sandbox. Until this, cast-FX only
    // had a renderer in the sandbox — invisible in real runs. Depth 80 keeps it
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
    // Impact seam — per-hit FX (Fire Bite's flame). Reads the SEPARATE
    // `impactFx` field so casts never double-fire (unknown kind = no-op).
    setImpactFxDispatcher((s) => this.fxDirector.play({
      kind: s.ability.impactFx?.kind ?? '',
      x: s.x,
      y: s.y,
      magnitude: s.magnitude,
    }));

    // Terrain blobs — depth 48 (below the unit band, above the biome bg). Same
    // wiring as the sandbox; the grid lives on the substrate (gm.core.terrain)
    // and is read each frame in update(). Without this the real run would run
    // invisible block/slow/DoT terrain.
    this.terrainRenderer = new TerrainRenderer(this.add.graphics());

    // Build-placement ghost — a tinted footprint preview under the cursor while
    // in build mode. Reusable presentation; fed by gm.previewPlacement (the one
    // placement authority), so it always matches where the building actually lands.
    this.placementGhost = new PlacementGhost(this.add.graphics());

    // Create game manager (owns all systems, entities, and game state)
    this.gm = new GameManager(this, data.deck, data.startWave, this.worldW, data.customWaves, data.runBuffs, data.hiveProfile, data.hiveSeed);

    // Store shared data on registry for HUDScene + MenuUIScene
    this.registry.set('worldW', this.worldW);
    // Hide royal-caste units from the deploy bar — the Royal is auto-spawned
    // on-field (GameManager) and click-controlled, never incubated.
    this.registry.set('deckKeys', data.deck.filter(k => UNIT_DEFS[k]?.caste !== 'royal'));
    this.registry.set('previews', this.gm.generateUnitPreviews());
    this.registry.set('eventBus', this.gm.events);

    // Subscribe to UI action events (MenuUIScene emits these)
    const onDeploy = (evt: { key: string; route: Route }) => {
      const result = this.gm.playerSpawn(evt.key, evt.route);
      if (result.message) this.gm.events.emit('logMessage', { message: result.message });
    };
    const onAbility = (evt: { key: string }) => {
      const result = this.gm.castAbility(evt.key as PlayerAbilityKey);
      if (result.message) this.gm.events.emit('logMessage', { message: result.message });
    };
    const onCancel = (evt: { index: number }) => {
      const result = this.gm.cancelIncubation(evt.index);
      if (result.message) this.gm.events.emit('logMessage', { message: result.message });
    };
    // Elite/Royal signature slot fired from the HUD → trigger THAT unit's
    // signature (routes through the maturation gate for the Royal ultimate).
    const onSignature = (evt: { unitId: number }) => {
      if (this.gm.running && evt.unitId != null) this.gm.requestSignature(evt.unitId);
    };
    // MATURE button → spend to advance the hive phase.
    const onMature = () => {
      const result = this.gm.matureHive();
      if (result.message) this.gm.events.emit('logMessage', { message: result.message });
    };
    // Pheromone command button → cast it on the player army's front.
    const onPheromone = (evt: { kind: PheromoneKind }) => {
      const result = this.gm.castPheromone(evt.kind);
      if (result.message) this.gm.events.emit('logMessage', { message: result.message });
    };
    // Royal profile click (or R key) → toggle command mode.
    const onToggleRoyalSelect = () => this.gm.toggleRoyalSelect();
    // Gatherer deploy button → send a forage worker (its bloom picks the lane).
    const onDeployGatherer = () => {
      const result = this.gm.deployGatherer();
      if (result.message) this.gm.events.emit('logMessage', { message: result.message });
    };
    // Builder button → enter build-placement mode (next field click places it).
    const onEnterBuildMode = (evt: { variant: string }) => this.gm.enterBuildMode(evt.variant);
    this.gm.events.on('deployUnit', onDeploy);
    this.gm.events.on('useAbility', onAbility);
    this.gm.events.on('cancelIncubation', onCancel);
    this.gm.events.on('triggerSignature', onSignature);
    this.gm.events.on('castPheromone', onPheromone);
    this.gm.events.on('toggleRoyalSelect', onToggleRoyalSelect);
    this.gm.events.on('deployGatherer', onDeployGatherer);
    this.gm.events.on('enterBuildMode', onEnterBuildMode);
    this.gm.events.on('matureHive', onMature);

    // Cleanup on shutdown
    this.events.once('shutdown', () => {
      this.gm.cleanupDebugCommands();
      this.gm.events.off('deployUnit', onDeploy);
      this.gm.events.off('useAbility', onAbility);
      this.gm.events.off('cancelIncubation', onCancel);
      this.gm.events.off('triggerSignature', onSignature);
      this.gm.events.off('castPheromone', onPheromone);
      this.gm.events.off('toggleRoyalSelect', onToggleRoyalSelect);
      this.gm.events.off('deployGatherer', onDeployGatherer);
      this.gm.events.off('enterBuildMode', onEnterBuildMode);
      this.gm.events.off('matureHive', onMature);
      this.gm.buildings.destroy(); // drop placed buildings + free their grid cells
      this.placementGhost.destroy();
      this.gm.core.destroy(); // unsubscribe terrain + unregister its dispatch seams
    });

    // ESC — toggle pause overlay
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      if (this.scene.isPaused()) {
        this.scene.resume();
        this.scene.stop('PauseScene');
      } else {
        this.scene.pause();
        this.scene.launch('PauseScene');
      }
    });

    // R — toggle Royal command mode (then a left-click on the field orders her).
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => {
      this.gm?.toggleRoyalSelect();
    });

    // G — toggle GATHER mode (then a left-click picks the priority bloom;
    // empty field = auto). Mutually exclusive with Royal command mode.
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G).on('down', () => {
      this.gm?.toggleGatherMode();
    });

    // Shift = TUNNEL deploy (Phase 2a): while held, a hint at the hive's tunnel
    // ground line telegraphs that the next deploy spawns underground. The deploy
    // route itself is read off the click/keypress in MenuUIScene.
    this.deployHint = this.buildDeployHint();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Shift') this.deployHint.setVisible(true);
    });
    this.input.keyboard!.on('keyup', (e: KeyboardEvent) => {
      if (e.key === 'Shift') this.deployHint.setVisible(false);
    });

    // Suppress browser right-click menu so right-drag pan fires
    // cleanly on the canvas.
    this.input.mouse?.disableContextMenu();

    // Left-click the battlefield → mode-routed command (G-mode: gather
    // priority; otherwise Royal control). Same scene-level Phaser pointerdown
    // the sandbox uses — pointer.worldX/Y carries the camera transform, and
    // clicks on the DOM HUD never reach the canvas. Right-drag stays the pan.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button !== 0 || !this.gm?.running) return;
      this.gm.commandFieldClick(p.worldX);
    });
    // The build-placement ghost is repainted every frame in update() from the
    // LIVE camera + cursor (not pointer events), so it tracks pan/edge-pan/zoom
    // and never disagrees with the cell the click lands in.

    // Camera + pan/zoom controller. Right-drag so left-click stays
    // available for any future unit-selection UX without colliding
    // with pan.
    this.viewport = new ViewportController(this);
    this.viewport.attach({
      worldW: this.worldW,
      zoom: 1.5,
      dragButton: 'right',
    });
  }

  update(time: number, delta: number): void {
    const dt: number = Math.min(delta / 1000, 0.05);

    // Pan/zoom tick — owned by ViewportController.
    this.viewport.update(dt);

    // Terrain repaints every frame (self-clears); an empty grid draws nothing.
    if (this.gm) this.terrainRenderer.draw(this.gm.core.terrain.grid, time * 0.001);

    // Build-placement ghost — recompute from the LIVE camera + cursor each frame
    // (after viewport.update) so it tracks pan/edge-pan/zoom and previews the
    // SAME x the click will place at (getWorldPoint uses the same camera transform).
    if (this.gm?.running && this.gm.buildMode && this.viewport.isOverCanvas()) {
      const p = this.input.activePointer;
      const wx = this.cameras.main.getWorldPoint(p.x, p.y, this._ghostPt).x;
      const pv = this.gm.previewPlacement(wx);
      this.placementGhost.show({
        x: pv.x,
        groundY: getGroundY('land'),
        halfW: BUILDING_HALF_W,
        height: BUILDING_HEIGHT,
        valid: pv.valid,
      });
    } else if (this.gm) {
      this.placementGhost.hide();
    }

    // Write shared state to registry every frame (HUDScene + MenuUIScene read these)
    this.registry.set('cam.scrollX', this.viewport.getScrollX());
    this.registry.set('cam.zoom', this.viewport.getZoom());
    if (this.gm) {
      // Base HP (HUDScene)
      this.registry.set('playerBase.hp', this.gm.playerHive.base.hp);
      this.registry.set('playerBase.maxHp', this.gm.playerHive.base.maxHp);
      this.registry.set('enemyBase.hp', this.gm.enemyHive.base.hp);
      this.registry.set('enemyBase.maxHp', this.gm.enemyHive.base.maxHp);
      this.registry.set('SBW', this.gm.SBW);

      // AI Hive state (MenuUIScene — enemy economy + incubation)
      if (this.gm.waves && 'incubation' in this.gm.waves) {
        const ai = this.gm.waves as any;
        this.registry.set('ai.nectar', Math.floor(ai.nectar));
        this.registry.set('ai.income', ai.income);
        this.registry.set('ai.personality', ai.profile.personality);
        this.registry.set('ai.chambers', ai.incubation.chambers);
        this.registry.set('ai.numChambers', ai.incubation.numChambers);
      }

      // Economy (MenuUIScene)
      this.registry.set('eco.nectar', this.gm.economy.nectar);
      this.registry.set('eco.maxNectar', this.gm.economy.maxNectar);
      this.registry.set('eco.income', this.gm.economy.income);
      this.registry.set('eco.nectarPct', this.gm.economy.getNectarPercent());

      // Capacity (MenuUIScene) — derived per-frame from live units + chambers
      const playerCapUsed = capUsed(this.gm.units, 'player', this.gm.incubation.chambers);
      this.registry.set('cap.used', playerCapUsed);
      this.registry.set('cap.max', this.gm.maxCapacity); // grows with the hive phase

      // Incubation (MenuUIScene)
      this.registry.set('inc.chambers', this.gm.incubation.chambers);
      this.registry.set('inc.numChambers', this.gm.incubation.numChambers);
      this.registry.set('inc.larvaCount', this.gm.incubation.larvaCount);
      this.registry.set('inc.larvaTimer', this.gm.incubation.larvaTimer);
      this.registry.set('inc.canQueue', this.gm.incubation.canQueue());

      // Abilities (MenuUIScene)
      const ablCanCast: Record<string, boolean> = {};
      const ablCdPct: Record<string, number> = {};
      Object.keys(ABILITY_DEFS).forEach(k => {
        // Hive abilities spend the CORPSE wallet (the tactical currency).
        ablCanCast[k] = this.gm.abilities.canCast(k, this.gm.vyss);
        ablCdPct[k] = this.gm.abilities.getCooldownPercent(k);
      });
      this.registry.set('abl.canCast', ablCanCast);
      this.registry.set('abl.cooldownPct', ablCdPct);

      // Game state (MenuUIScene)
      this.registry.set('wave.stage', this.gm.waves.stage);
      this.registry.set('game.elapsed', this.gm.elapsed);
      this.registry.set('game.running', this.gm.running);
      this.registry.set('elite.slots', this.gm.getEliteSlots());
      this.registry.set('royal.status', this.gm.getRoyalStatus());
      this.registry.set('royal.selected', this.gm.royalSelected);
      this.registry.set('vyss.count', Math.floor(this.gm.vyss.vyss));
      this.registry.set('gather.mode', this.gm.gatherMode);
      if (this.gm.maturation) {
        this.registry.set('hive.phaseName', this.gm.maturation.phaseName);
        this.registry.set('hive.tierCap', this.gm.maturation.tierCap);
        this.registry.set('hive.matureCost', this.gm.maturation.nextCost);
        this.registry.set('hive.nextPerks', this.gm.maturation.nextPerks);
        this.registry.set('hive.canMature', this.gm.maturation.canMature(this.gm.economy, this.gm.incubation, this.gm.vyss));
      }
      if (this.gm.forage) {
        this.registry.set('forage.rate', this.gm.forage.rate);
        this.registry.set('forage.workers', this.gm.forage.workerCount);
        this.drawBlooms();
      }

      // Repaint the scent-trail from the live zones (deposited + decayed in tick).
      this.pheromoneLayer.clear();
      drawPheromoneTrail(this.pheromoneLayer, this.gm.pheromoneZones);

      // Royal control affordance (who you control + the active order).
      this.drawRoyalControl();

      // One-shot ability FX (cast shockwaves etc).
      this.fxDirector.update(dt);
    }

    if (!this.gm.running) return;

    // Tick game logic
    this.gm.tick(dt);
  }

  /**
   * Draw the Royal control affordance — a ring marking who you command, plus a
   * marker for the active order (a beacon at the move spot, or a red ring on the
   * focused enemy). Presentation-only; repainted each frame from live state.
   */
  private drawRoyalControl(): void {
    const g = this.royalLayer;
    g.clear();
    const r = this.gm.playerRoyal;
    if (!r || r.dead) return;
    const selected = this.gm.royalSelected;

    // Control ring — bright when you're commanding her (selected), a faint dot
    // otherwise so you can still spot her without it shouting.
    const groundY = getGroundY('land');
    g.lineStyle(selected ? 2.5 : 1.5, 0x60e0ff, selected ? 0.95 : 0.3);
    g.strokeEllipse(r.x + r.unitW / 2, groundY, r.unitW * 1.1, r.unitW * 0.42);

    // Order markers only matter while she's under command.
    const order = r.order;
    if (!selected || !order) return;
    if (order.kind === 'move') {
      g.lineStyle(2, 0x60e0ff, 0.7);
      g.strokeEllipse(order.x, groundY, 14, 6);
      g.lineBetween(order.x, groundY - 11, order.x, groundY);
    } else if (!order.target.dead) {
      const t = order.target;
      g.lineStyle(2, 0xff5050, 0.9);
      g.strokeEllipse(t.x + t.unitW / 2, groundY, t.unitW * 1.25, t.unitW * 0.5);
    }
  }

  /**
   * Repaint the nectar blooms from live Forage state: a flower (or 3-flower
   * cluster when rich) whose petals SHRINK + fade as the pool drains; a gold
   * ring marks the standing priority (G-order); a red flash marks a raid.
   */
  private drawBlooms(): void {
    const g = this.bloomLayer;
    g.clear();
    const forage = this.gm.forage;
    if (!forage) return;
    // Corpse pickups — fallen chitin husks, fading as they decay. Scavenge
    // targets for G-mode; bigger yields draw bigger husks.
    for (const c of forage.corpsePickups) {
      const cy = getGroundY('land');
      const a = Math.max(0.15, Math.min(1, c.decay / 6)); // fade out over the last seconds
      const r = 2.5 + Math.min(4, c.yield * 0.4);
      g.fillStyle(0x8a8a96, 0.55 * a);
      g.fillEllipse(c.x, cy - 2, r * 2.2, r * 1.1);
      g.lineStyle(1.2, 0xc8c8d8, 0.8 * a);
      g.lineBetween(c.x - r, cy - 2 - r * 0.5, c.x + r, cy - 2 + r * 0.3);
      g.lineBetween(c.x - r * 0.7, cy - 2 + r * 0.4, c.x + r * 0.7, cy - 2 - r * 0.6);
    }
    for (const b of forage.blooms) {
      const by = getGroundY('land');
      const fill = Math.max(0.35, b.pool / b.maxPool); // wilt toward 35% size
      const heads = b.rich ? [-7, 0, 7] : [0];          // cluster = one object, three flowers
      // priority ring — the standing gather order
      if (forage.priorityId === b.id) {
        g.lineStyle(1.5, 0xf0c040, 0.85);
        g.strokeEllipse(b.x, by + 1, 26, 9);
      }
      // raid flash
      if (b.flash > 0) {
        g.fillStyle(0xff3020, 0.25 * b.flash);
        g.fillCircle(b.x, by - 8, 16);
      }
      for (const ox of heads) {
        const hx = b.x + ox;
        const hy = by - 9 - (ox === 0 ? 1 : 0);
        g.lineStyle(1.5, 0x4a7a30, 0.9);
        g.lineBetween(hx, by, hx, hy);
        const r = (b.rich ? 3.4 : 3.0) * fill;
        g.fillStyle(0xf0c040, 0.5 + 0.45 * fill);
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          g.fillCircle(hx + Math.cos(a) * r, hy + Math.sin(a) * r, r * 0.75);
        }
        g.fillStyle(0xffe890, 0.55 + 0.45 * fill);
        g.fillCircle(hx, hy, r * 0.7);
      }
    }
  }

  /**
   * Build the Shift-held tunnel-deploy telegraph — a dim marker at the hive's
   * TUNNEL ground line (dashed line + downward chevron + label) so the player
   * sees a Shift-deploy will emerge underground. Created hidden; toggled by the
   * Shift key handlers. Phase 2a control affordance (no balance).
   */
  private buildDeployHint(): Phaser.GameObjects.Container {
    const x0 = this.gm.SBW, x1 = x0 + 150;
    const ty = getGroundY('tunnel');
    const g = this.add.graphics();
    g.lineStyle(2, 0xc89058, 0.9);
    for (let x = x0; x < x1; x += 14) g.lineBetween(x, ty, x + 8, ty);   // dashed ground line
    g.fillStyle(0xc89058, 0.9);                                          // downward chevron
    g.fillTriangle(x0 + 8, ty - 16, x0 + 24, ty - 16, x0 + 16, ty - 4);
    const label = this.add.text(x0 + 30, ty - 24, 'TUNNEL DEPLOY', {
      fontFamily: 'monospace', fontSize: '11px', color: '#e0b070',
    }).setOrigin(0, 0.5);
    const c = this.add.container(0, 0, [g, label]);
    c.setDepth(90); // above the unit band (60..70), the tunnel veil (72) + FX (80)
    c.setVisible(false);
    return c;
  }

  private drawBackground(): void {
    // Shared biome landscape (sky → surface → underground) — the same 2.5D
    // cross-section the sandbox uses, so the real battle and the sandbox match.
    // Biome is α's Sun Carapace for now (runs are α-only); it'll derive from the
    // node/zone when the geneline picker lands.
    drawBiomeBackground(this, 'sunCarapace', this.worldW);
  }
}
