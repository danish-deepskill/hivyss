import Phaser from 'phaser';
import { DEFAULT_WORLD_W } from '../config/Constants';
import { drawBiomeBackground } from './BiomeBackground';
import { drawPheromoneTrail } from './PheromoneTrail';
import { laneFromY, getGroundY } from '../config/RouteMatrix';
import { UNIT_DEFS } from '../units/registry';
import { ABILITY_DEFS } from '../config/AbilityDefs';
import { GameManager } from '../systems/GameManager';
import { capUsed, MAX_CAPACITY } from '../systems/Capacity';
import { ViewportController } from '../systems/ViewportController';
import type { PlayerAbilityKey, WaveDef, HiveProfile, PheromoneKind } from '../types';
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
    const onDeploy = (evt: { key: string; lane: number }) => {
      const result = this.gm.playerSpawn(evt.key, evt.lane);
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
    // Elite signature slot fired from the HUD → trigger THAT Elite's signature.
    const onSignature = (evt: { unitId: number }) => {
      if (this.gm.running && evt.unitId != null) this.gm.combat.requestSignature(evt.unitId);
    };
    // Pheromone command button → cast it on the player army's front.
    const onPheromone = (evt: { kind: PheromoneKind; lane: number }) => {
      const result = this.gm.castPheromone(evt.kind, evt.lane);
      if (result.message) this.gm.events.emit('logMessage', { message: result.message });
    };
    // Royal profile click (or R key) → toggle command mode.
    const onToggleRoyalSelect = () => this.gm.toggleRoyalSelect();
    this.gm.events.on('deployUnit', onDeploy);
    this.gm.events.on('useAbility', onAbility);
    this.gm.events.on('cancelIncubation', onCancel);
    this.gm.events.on('triggerSignature', onSignature);
    this.gm.events.on('castPheromone', onPheromone);
    this.gm.events.on('toggleRoyalSelect', onToggleRoyalSelect);

    // Cleanup on shutdown
    this.events.once('shutdown', () => {
      this.gm.cleanupDebugCommands();
      this.gm.events.off('deployUnit', onDeploy);
      this.gm.events.off('useAbility', onAbility);
      this.gm.events.off('cancelIncubation', onCancel);
      this.gm.events.off('triggerSignature', onSignature);
      this.gm.events.off('castPheromone', onPheromone);
      this.gm.events.off('toggleRoyalSelect', onToggleRoyalSelect);
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

    // Suppress browser right-click menu so right-drag pan fires
    // cleanly on the canvas.
    this.input.mouse?.disableContextMenu();

    // Left-click the battlefield → Royal control (select her / order her).
    // Same scene-level Phaser pointerdown the sandbox uses for placement —
    // pointer.worldX/Y carries the camera transform, and clicks on the DOM HUD
    // never reach the canvas, so no manual filtering. Right-drag stays the pan.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.button !== 0 || !this.gm?.running) return;
      this.gm.commandRoyalClick(p.worldX, laneFromY(p.worldY));
    });

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

  update(_time: number, delta: number): void {
    const dt: number = Math.min(delta / 1000, 0.05);

    // Pan/zoom tick — owned by ViewportController.
    this.viewport.update(dt);

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
      this.registry.set('cap.max', MAX_CAPACITY);

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
        ablCanCast[k] = this.gm.abilities.canCast(k, this.gm.economy);
        ablCdPct[k] = this.gm.abilities.getCooldownPercent(k);
      });
      this.registry.set('abl.canCast', ablCanCast);
      this.registry.set('abl.cooldownPct', ablCdPct);

      // Game state (MenuUIScene)
      this.registry.set('wave.stage', this.gm.waves.stage);
      this.registry.set('game.running', this.gm.running);
      this.registry.set('elite.slots', this.gm.getEliteSlots());
      this.registry.set('royal.status', this.gm.getRoyalStatus());
      this.registry.set('royal.selected', this.gm.royalSelected);

      // Repaint the scent-trail from the live zones (deposited + decayed in tick).
      this.pheromoneLayer.clear();
      drawPheromoneTrail(this.pheromoneLayer, this.gm.pheromoneZones);

      // Royal control affordance (who you control + the active order).
      this.drawRoyalControl();
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
    g.lineStyle(selected ? 2.5 : 1.5, 0x60e0ff, selected ? 0.95 : 0.3);
    g.strokeEllipse(r.x + r.unitW / 2, getGroundY('land', r.lane), r.unitW * 1.1, r.unitW * 0.42);

    // Order markers only matter while she's under command.
    const order = r.order;
    if (!selected || !order) return;
    if (order.kind === 'move') {
      const my = getGroundY('land', r.lane);
      g.lineStyle(2, 0x60e0ff, 0.7);
      g.strokeEllipse(order.x, my, 14, 6);
      g.lineBetween(order.x, my - 11, order.x, my);
    } else if (!order.target.dead) {
      const t = order.target;
      g.lineStyle(2, 0xff5050, 0.9);
      g.strokeEllipse(t.x + t.unitW / 2, getGroundY('land', t.lane), t.unitW * 1.25, t.unitW * 0.5);
    }
  }

  private drawBackground(): void {
    // Shared biome landscape (sky → surface → underground) — the same 2.5D
    // cross-section the sandbox uses, so the real battle and the sandbox match.
    // Biome is α's Sun Carapace for now (runs are α-only); it'll derive from the
    // node/zone when the geneline picker lands.
    drawBiomeBackground(this, 'sunCarapace', this.worldW);
  }
}
