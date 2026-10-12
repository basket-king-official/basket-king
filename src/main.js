import Phaser from 'phaser';
import { W, H, COLORS } from './theme.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultScene } from './scenes/ResultScene.js';

function startGame() {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: COLORS.bg,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
    scene: [BootScene, MenuScene, GameScene, ResultScene],
  });
}

// Wait for Poppins so canvas-drawn notes use it; never block the game for more than 1.5s.
Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).then(() => {
  window.__game = startGame();
});
