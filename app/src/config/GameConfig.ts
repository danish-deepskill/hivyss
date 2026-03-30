import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { BattleScene } from '../scenes/BattleScene';
import { UpgradeScene } from '../scenes/UpgradeScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { DeckScene } from '../scenes/DeckScene';
import { SandboxScene } from '../scenes/SandboxScene';

export const GameConfig = {
  type: Phaser.AUTO,
  width: Math.max(900, window.innerWidth),
  height: 400,
  parent: 'game-canvas',
  backgroundColor: '#111018',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.NONE,
  },
  scene: [BootScene, PreloadScene, MainMenuScene, DeckScene, BattleScene, UpgradeScene, GameOverScene, SandboxScene],
  banner: false,
};
