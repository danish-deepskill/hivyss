import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { BattleScene } from '../scenes/BattleScene';

import { GameOverScene } from '../scenes/GameOverScene';
import { DeckScene } from '../scenes/DeckScene';
import { SandboxScene } from '../scenes/SandboxScene';
import { WorldScene } from '../scenes/WorldScene';
import { HUDScene } from '../scenes/HUDScene';
import { MenuUIScene } from '../scenes/MenuUIScene';
import { ModalScene } from '../scenes/ModalScene';
import { PauseScene } from '../scenes/PauseScene';

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
  scene: [BootScene, PreloadScene, MainMenuScene, DeckScene, BattleScene, WorldScene, HUDScene, MenuUIScene, ModalScene, PauseScene, GameOverScene, SandboxScene],
  dom: { createContainer: true },
  banner: false,
};
