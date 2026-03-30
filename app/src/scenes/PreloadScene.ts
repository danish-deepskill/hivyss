import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    // Audio assets will be loaded here in Phase 9
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }
}
