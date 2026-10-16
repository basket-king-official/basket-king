import Phaser from 'phaser';
import { W, H } from './theme.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { LeaderboardScene } from './scenes/LeaderboardScene.js';

function startGame() {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    transparent: true, // lets the full-screen camera show through in hand mode
    fps: { target: 60 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
    scene: [BootScene, MenuScene, GameScene, ResultScene, LeaderboardScene],
  });
}

// Wait for Poppins so canvas-drawn money uses it; never block the game for more than 1.5s.
Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).then(() => {
  window.__game = startGame();
});
