import Phaser from 'phaser';
import { UNIT_DEFS } from '../units/registry';
import { SaveManager } from '../systems/SaveManager';
import { WorldScene } from './WorldScene';
import { ModalScene } from './ModalScene';

interface BattleSceneData {
  deck?: string[];
  startWave?: number;
  worldW?: number;
}

export class BattleScene extends Phaser.Scene {
  private worldScene!: WorldScene;
  private gameOverTriggered = false;

  constructor() {
    super('BattleScene');
  }

  create(data?: BattleSceneData): void {
    this.gameOverTriggered = false;

    // Load deck from scene data or save
    const save: SaveManager = new SaveManager();
    let deckKeys: string[] = (data && data.deck) || save.getDeck();
    if (!deckKeys.length) deckKeys = Object.keys(UNIT_DEFS).filter(k => !UNIT_DEFS[k].unlock).slice(0, 10);

    // Check for start wave from scene data or URL param (?wave=30)
    const urlWave = new URLSearchParams(window.location.search).get('wave');
    const startWave = (data && data.startWave) || (urlWave ? parseInt(urlWave, 10) : 1);

    const worldW = data?.worldW;

    // Launch WorldScene (owns game logic, rendering, camera)
    this.scene.launch('WorldScene', { deck: deckKeys, startWave, worldW });
    this.scene.launch('HUDScene');
    this.worldScene = this.scene.get('WorldScene') as WorldScene;

    // Launch MenuUIScene after WorldScene is ready (needs registry data)
    this.worldScene.events.once('create', () => {
      this.scene.launch('MenuUIScene');
    });

    // Clean up on shutdown
    this.events.once('shutdown', () => {
      this.scene.stop('WorldScene');
      this.scene.stop('HUDScene');
      this.scene.stop('MenuUIScene');
      this.scene.stop('ModalScene');
    });
  }

  update(): void {
    if (!this.worldScene?.gm) return;
    const gm = this.worldScene.gm;

    if (!gm.running && gm.won && !this.gameOverTriggered) {
      this.gameOverTriggered = true;
      this.time.delayedCall(400, () => this.showGameOver());
    }
  }

  private showGameOver(): void {
    const gm = this.worldScene.gm;
    const points = gm.saveAndGetPoints();
    const data = gm.getGameOverData();

    this.scene.launch('ModalScene', {
      wavesCleared: data.wavesCleared,
      kills: data.kills,
      elapsed: data.elapsed,
      points,
    });

    const modal = this.scene.get('ModalScene') as ModalScene;
    modal.events.once('restart', () => {
      this.scene.restart();
    });
  }
}
