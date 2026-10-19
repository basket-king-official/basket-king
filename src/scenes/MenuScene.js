import Phaser from 'phaser';
import { W, H, COLORS, VERSION, textStyle } from '../theme.js';
import { button, drawSky, toast } from '../ui.js';
import { handTracker } from '../input/handTracker.js';
import { load } from '../storage.js';
import { sfx } from '../sfx.js';
import { initOnline } from '../online.js';
import { HAND_MODE_ENABLED } from '../config/features.js';
import { getLives, msToNextLife, formatCountdown, heartsText, MAX_LIVES } from '../lives.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(data = {}) {
    this.level = load('level', 1);
    this.starting = false;

    drawSky(this);

    const logo = this.add.image(W / 2, 228, 'logo');
    const base = Math.min(1, (W - 50) / logo.width);
    logo.setScale(base);
    this.tweens.add({ targets: logo, scale: base * 1.04, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.levelText = this.add.text(W / 2, 445, `LEVEL ${this.level}`, textStyle(34, COLORS.gold)).setOrigin(0.5);

    // Lives: hearts + refill countdown, updated every second.
    this.livesText = this.add.text(W / 2, 490, '', textStyle(30, COLORS.danger)).setOrigin(0.5);
    this.livesTimer = this.add.text(W / 2, 524, '', textStyle(18)).setOrigin(0.5);
    this.updateLives();
    this.time.addEvent({ delay: 1000, loop: true, callback: this.updateLives, callbackScope: this });

    if (HAND_MODE_ENABLED) {
      button(this, W / 2, 598, 'PLAY WITH HAND ✊', () => this.startHand());
      button(this, W / 2, 690, 'PLAY WITH TOUCH 👆', () => this.startGame('touch'), { fill: 0x3ee07a, textColor: '#0f3a1c' });
    } else {
      button(this, W / 2, 630, '▶  PLAY', () => this.startGame('touch'), { width: 400, height: 104, fill: 0x3ee07a, textColor: '#0f3a1c' });
    }
    button(this, W / 2, 778, '🏆 LEADERBOARD', () => this.scene.start('Leaderboard'), {
      height: 68,
      fill: 0xffffff,
      textColor: '#1a1030',
    });

    this.status = this.add
      .text(W / 2, 830, HAND_MODE_ENABLED ? 'Point your back camera at your fist ✊\nand catch the money with the net!' : 'Drag your finger to move the net 👆\nCatch the money, dodge the bombs! 💣', {
        ...textStyle(17),
        align: 'center',
        wordWrap: { width: W - 60 },
      })
      .setOrigin(0.5, 0);
    this.add
      .text(W / 2, 893, HAND_MODE_ENABLED ? 'Virtual money only · No betting · Camera stays on your device' : 'Virtual money only · No betting', { ...textStyle(14), align: 'center' })
      .setOrigin(0.5);

    // Footer links (About / Privacy / Terms) + version label.
    const links = [
      ['About', '/about.html'],
      ['Privacy', '/privacy.html'],
      ['Terms', '/terms.html'],
    ];
    links.forEach(([label, href], i) => {
      const t = this.add
        .text(W / 2 + (i - 1) * 110, 930, label, textStyle(17, COLORS.gold))
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on('pointerup', () => {
        handTracker.stop();
        window.location.href = href;
      });
    });
    this.add.text(W - 10, H - 6, `v${VERSION}`, textStyle(13)).setOrigin(1, 1).setAlpha(0.8);

    if (data.message) toast(this, data.message);

    // Silent guest account for the leaderboard (does nothing if offline).
    initOnline().then(() => {
      if (this.scene.isActive()) this.levelText?.setText(`LEVEL ${(this.level = load('level', 1))}`);
    });
  }

  updateLives() {
    const n = getLives();
    this.livesText.setText(heartsText(n));
    if (n >= MAX_LIVES) this.livesTimer.setText('Lives full');
    else this.livesTimer.setText(`+1 life in ${formatCountdown(msToNextLife())}`);
  }

  // Returns true if the player may start a level; otherwise explains why not.
  hasLife() {
    if (getLives() > 0) return true;
    sfx.lose();
    toast(this, `No lives left! 💔\nNext life in ${formatCountdown(msToNextLife())}`);
    this.tweens.add({ targets: this.livesText, scale: 1.3, duration: 120, yoyo: true, repeat: 1 });
    return false;
  }

  async startHand() {
    if (this.starting || !this.hasLife()) return;
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
    if (!this.hasLife()) return;
    sfx.unlock();
    this.scene.start('Game', { level: this.level, mode });
  }
}
