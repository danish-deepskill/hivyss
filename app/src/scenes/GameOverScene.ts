import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';

interface GameOverData {
  won: string;
  wavesCleared: number;
  kills: number;
  elapsed: number;
}

export class GameOverScene extends Phaser.Scene {
  private won!: string;
  private wavesCleared!: number;
  private kills!: number;
  private elapsed!: number;

  constructor() {
    super('GameOverScene');
  }

  init(data: GameOverData): void {
    this.won = data.won;
    this.wavesCleared = data.wavesCleared || 0;
    this.kills = data.kills || 0;
    this.elapsed = data.elapsed || 0;
  }

  create(): void {
    // Record result
    const save = new SaveManager();
    const points: number = save.recordGameResult(
      this.wavesCleared, this.kills, this.won === 'player', this.elapsed
    );

    // This scene is shown via the DOM overlay in BattleScene
    // But we can also show it as a standalone scene
    // For now, BattleScene handles the overlay directly
  }
}
