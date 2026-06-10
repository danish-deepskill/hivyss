import Phaser from 'phaser';
import { GameConfig } from './config/GameConfig';

// Wait for Press Start 2P so canvas text paints with correct metrics on first load.
// The <link rel="preload"> in index.html has already started the fetch; this just
// blocks Phaser from booting until it's ready.
document.fonts.load('16px "Press Start 2P"').finally(() => {
  const game: Phaser.Game = new Phaser.Game(GameConfig);

  // Debug console (dev only)
  if (import.meta.env.DEV) {
    // Dev-only handle for poking game state from the browser console /
    // automated checks (window.__game.scene.getScene('WorldScene').gm ...).
    (window as unknown as { __game: Phaser.Game }).__game = game;
    game.events.once('ready', () => {
      import('./systems/DebugConsole').then(({ createDebugOverlay }) => {
        createDebugOverlay(game.canvas.parentElement!);
      });
    });
  }
});
