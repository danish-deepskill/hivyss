import Phaser from 'phaser';
import { W, H } from '../config/Constants';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  create(): void {
    // Dim overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(0, 0, W, H);

    const cy = H * 0.4;

    this.add.text(W / 2, cy, 'PAUSED', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '28px',
      color: '#f0c040',
    }).setOrigin(0.5);

    this.add.text(W / 2, cy + 50, 'ESC  Resume', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#888',
    }).setOrigin(0.5);

    const quitBtn = this.add.text(W / 2, cy + 85, 'Q  Quit to Menu', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '14px',
      color: '#888',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    quitBtn.on('pointerover', () => quitBtn.setColor('#ccc'));
    quitBtn.on('pointerout', () => quitBtn.setColor('#888'));
    quitBtn.on('pointerdown', () => this.quitToMenu());

    // Q key to quit
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q).on('down', () => {
      this.quitToMenu();
    });

    // ESC to resume (handled by WorldScene, but also catch here in case)
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      this.scene.resume('WorldScene');
      this.scene.stop();
    });
  }

  private quitToMenu(): void {
    this.scene.stop();
    this.scene.get('BattleScene').scene.start('MainMenuScene');
  }
}
