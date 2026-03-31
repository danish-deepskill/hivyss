import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { BattleScene } from '../scenes/BattleScene';
import { UpgradeScene } from '../scenes/UpgradeScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { DeckScene } from '../scenes/DeckScene';
import { SandboxScene } from '../scenes/SandboxScene';
import { WorldScene } from '../scenes/WorldScene';
import { HUDScene } from '../scenes/HUDScene';
import { MenuUIScene } from '../scenes/MenuUIScene';
import { ModalScene } from '../scenes/ModalScene';

export const GameConfig = {
  type: Phaser.CANVAS,
  width: 1280,
  height: 720,
  parent: 'game-canvas',
  backgroundColor: '#111018',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PreloadScene, MainMenuScene, DeckScene, BattleScene, WorldScene, HUDScene, MenuUIScene, ModalScene, UpgradeScene, GameOverScene, SandboxScene],
  dom: { createContainer: true },
  banner: false,
};
