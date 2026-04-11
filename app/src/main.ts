import Phaser from 'phaser';
import { GameConfig } from './config/GameConfig';

const game: Phaser.Game = new Phaser.Game(GameConfig);

// Debug console (dev only)
if (import.meta.env.DEV) {
  game.events.once('ready', () => {
    import('./systems/DebugConsole').then(({ createDebugOverlay }) => {
      createDebugOverlay(game.canvas.parentElement!);
    });
  });
}
