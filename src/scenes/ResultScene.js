import Phaser from 'phaser';
import { W, COLORS, textStyle } from '../theme.js';
import { button, drawSky } from '../ui.js';
import { handTracker } from '../input/handTracker.js';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(d) {
    drawSky(this);

    const panel = this.add.graphics();
    panel.fillStyle(0x1a1030, 0.72);
    panel.fillRoundedRect(40, 170, W - 80, 330, 28);
    panel.lineStyle(5, 0xffd23f, 1);
    panel.strokeRoundedRect(40, 170, W - 80, 330, 28);

    const title = d.won ? 'LEVEL CLEARED!' : d.reason === 'boom' ? 'BOOM! 💣' : "TIME'S UP!";
    const t = this.add.text(W / 2, 250, title, textStyle(50, d.won ? COLORS.gold : COLORS.danger)).setOrigin(0.5).setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 450, ease: 'Back.out' });
    this.add.text(W / 2, 340, `Level ${d.level}`, textStyle(32)).setOrigin(0.5);
    this.add.text(W / 2, 410, `${d.score} / ${d.target}`, textStyle(30, d.won ? COLORS.green : COLORS.text)).setOrigin(0.5);
    if (d.bestCombo >= 5) this.add.text(W / 2, 460, `Best combo x${d.bestCombo}`, textStyle(22, COLORS.gold)).setOrigin(0.5);

    const nextLevel = d.won ? d.level + 1 : d.level;
    // TODO (ads): on a loss, offer "Watch ad for +15 sec" here once the ad network is approved.
    button(this, W / 2, 590, d.won ? 'NEXT LEVEL ▶' : 'TRY AGAIN ↻', () =>
      this.scene.start('Game', { level: nextLevel, mode: d.mode }),
    );
    button(
      this,
      W / 2,
      700,
      'MENU',
      () => {
        handTracker.stop();
        this.scene.start('Menu');
      },
      { fill: 0xffffff, textColor: '#1a1030' },
    );
  }
}
