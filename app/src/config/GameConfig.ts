import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { BattleScene } from '../scenes/BattleScene';

import { GameOverScene } from '../scenes/GameOverScene';
import { BroodScene } from '../scenes/BroodScene';
import { SandboxScene } from '../scenes/SandboxScene';
import { SandboxHUDScene } from '../scenes/SandboxHUDScene';
import { WorldScene } from '../scenes/WorldScene';
import { HUDScene } from '../scenes/HUDScene';
import { MenuUIScene } from '../scenes/MenuUIScene';
import { ModalScene } from '../scenes/ModalScene';
import { PauseScene } from '../scenes/PauseScene';
import { NodeMapScene } from '../scenes/NodeMapScene';
import { RewardScene } from '../scenes/RewardScene';

export const GameConfig = {
  type: Phaser.CANVAS,
  width: 1280,
  height: 720,
  parent: "game-canvas",
  backgroundColor: "#111018",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    BroodScene,
    BattleScene,
    WorldScene,
    HUDScene,
    MenuUIScene,
    ModalScene,
    PauseScene,
    NodeMapScene,
    RewardScene,
    GameOverScene,
    SandboxScene,
    SandboxHUDScene,
  ],
  dom: { createContainer: true },
  banner: false,
  render: { pixelArt: true },
};
