import Phaser from 'phaser';
import { W, COLORS, textStyle } from '../theme.js';
import { button, drawSky, toast } from '../ui.js';
import { handTracker } from '../input/handTracker.js';
import { load } from '../storage.js';
import { sfx } from '../sfx.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(data = {}) {
    this.level = load('level', 1);
    this.starting = false;

    drawSky(this);

    const logo = this.add.image(W / 2, 250, 'logo');
    const base = Math.min(1, (W - 50) / logo.width);
    logo.setScale(base);
    this.tweens.add({ targets: logo, scale: base * 1.04, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.add.text(W / 2, 478, `LEVEL ${this.level}`, textStyle(36, COLORS.gold)).setOrigin(0.5);

    button(this, W / 2, 585, 'PLAY WITH HAND ✊', () => this.startHand());
    button(this, W / 2, 695, 'PLAY WITH TOUCH 👆', () => this.startGame('touch'), { fill: 0x3ee07a, textColor: '#0f3a1c' });

    this.status = this.add
      .text(W / 2, 790, 'Point your back camera at your fist ✊\nand catch the money with the net!', {
        ...textStyle(20),
        align: 'center',
        wordWrap: { width: W - 60 },
      })
      .setOrigin(0.5, 0);
    this.add
      .text(W / 2, 900, 'Your camera stays on your device. Nothing is recorded.', { ...textStyle(15), align: 'center' })
      .setOrigin(0.5);

    if (data.message) toast(this, data.message);
  }

  async startHand() {
    if (this.starting) return;
    this.starting = true;
    sfx.unlock();
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
    sfx.unlock();
    this.scene.start('Game', { level: this.level, mode });
  }
}
