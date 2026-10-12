import Phaser from 'phaser';
import { W, H, COLORS, textStyle } from '../theme.js';
import { button, toast } from '../ui.js';
import { handTracker } from '../input/handTracker.js';
import { load } from '../storage.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(data = {}) {
    this.level = load('level', 1);
    this.starting = false;

    this.add.text(W / 2, 190, 'BASKET', textStyle(76, COLORS.gold)).setOrigin(0.5);
    this.add.text(W / 2, 270, 'KING', textStyle(96, COLORS.gold)).setOrigin(0.5);
    this.add.image(W / 2, 400, 'basket').setScale(1.2);
    this.add.text(W / 2, 480, `Level ${this.level}`, textStyle(30)).setOrigin(0.5);

    button(this, W / 2, 600, 'PLAY WITH HAND ✊', () => this.startHand());
    button(this, W / 2, 700, 'PLAY WITH TOUCH 👆', () => this.startGame('touch'), {
      color: 0x3a2a66,
      textColor: COLORS.text,
    });

    this.status = this.add
      .text(W / 2, 800, 'Move your hand left and right to catch the money.\nYour camera stays on your device, nothing is recorded.', {
        ...textStyle(17, COLORS.muted),
        fontStyle: '600',
        align: 'center',
        wordWrap: { width: W - 80 },
      })
      .setOrigin(0.5, 0);

    if (data.message) toast(this, data.message);
  }

  async startHand() {
    if (this.starting) return;
    this.starting = true;
    this.status.setText('Starting camera…');
    try {
      await handTracker.start(document.getElementById('cam'));
      this.startGame('hand');
    } catch (err) {
      console.warn('Hand tracking unavailable, using touch mode:', err);
      this.starting = false;
      this.status.setText('Camera not available on this device.\nSwitched to touch mode.');
      this.time.delayedCall(1200, () => this.startGame('touch'));
    }
  }

  startGame(mode) {
    this.scene.start('Game', { level: this.level, mode });
  }
}
