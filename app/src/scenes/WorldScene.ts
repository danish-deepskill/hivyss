import Phaser from 'phaser';
import { DEFAULT_WORLD_W } from '../config/Constants';
import { drawBiomeBackground } from './BiomeBackground';
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

  constructor() {
    super('WorldScene');
  }

  create(data: WorldSceneData): void {
    this.worldW = data.worldW ?? DEFAULT_WORLD_W;

    this.drawBackground();

    // Create game manager (owns all systems, entities, and game state)
    this.gm = new GameManager(this, data.deck, data.startWave, this.worldW, data.customWaves, data.runBuffs, data.hiveProfile, data.hiveSeed);

    // Store shared data on registry for HUDScene + MenuUIScene
    this.registry.set('worldW', this.worldW);
    this.registry.set('deckKeys', data.deck);
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
    const onPheromone = (evt: { kind: PheromoneKind }) => {
      const result = this.gm.castPheromone(evt.kind);
      if (result.message) this.gm.events.emit('logMessage', { message: result.message });
    };
    this.gm.events.on('deployUnit', onDeploy);
    this.gm.events.on('useAbility', onAbility);
    this.gm.events.on('cancelIncubation', onCancel);
    this.gm.events.on('triggerSignature', onSignature);
    this.gm.events.on('castPheromone', onPheromone);

    // Cleanup on shutdown
    this.events.once('shutdown', () => {
      this.gm.cleanupDebugCommands();
      this.gm.events.off('deployUnit', onDeploy);
      this.gm.events.off('useAbility', onAbility);
      this.gm.events.off('cancelIncubation', onCancel);
      this.gm.events.off('triggerSignature', onSignature);
      this.gm.events.off('castPheromone', onPheromone);
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

    // Suppress browser right-click menu so right-drag pan fires
    // cleanly on the canvas.
    this.input.mouse?.disableContextMenu();

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
    }

    if (!this.gm.running) return;

    // Tick game logic
    this.gm.tick(dt);
  }

  private drawBackground(): void {
    // Shared biome landscape (sky → surface → underground) — the same 2.5D
    // cross-section the sandbox uses, so the real battle and the sandbox match.
    // Biome is α's Sun Carapace for now (runs are α-only); it'll derive from the
    // node/zone when the geneline picker lands.
    drawBiomeBackground(this, 'sunCarapace', this.worldW);
  }
}
