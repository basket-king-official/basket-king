import Phaser from 'phaser';
import { W, COLORS, textStyle } from '../theme.js';
import { button } from '../ui.js';
import { handTracker } from '../input/handTracker.js';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(d) {
    const title = d.won ? 'LEVEL CLEARED!' : d.reason === 'boom' ? 'BOOM! 💣' : "TIME'S UP!";
    this.add.text(W / 2, 260, title, textStyle(52, d.won ? COLORS.gold : COLORS.danger)).setOrigin(0.5);
    this.add.text(W / 2, 350, `Level ${d.level}`, textStyle(28)).setOrigin(0.5);
    this.add.text(W / 2, 410, `${d.score} / ${d.target}`, textStyle(26, COLORS.muted)).setOrigin(0.5);

    const nextLevel = d.won ? d.level + 1 : d.level;
    // TODO (ads): on a loss, offer "Watch ad for +15 sec" here once the ad network is approved.
    button(this, W / 2, 560, d.won ? 'NEXT LEVEL ▶' : 'TRY AGAIN ↻', () =>
      this.scene.start('Game', { level: nextLevel, mode: d.mode }),
    );
    button(
      this,
      W / 2,
      660,
      'MENU',
      () => {
        handTracker.stop();
        this.scene.start('Menu');
      },
      { color: 0x3a2a66, textColor: COLORS.text },
    );
  }
}
