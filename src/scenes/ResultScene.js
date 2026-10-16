import Phaser from 'phaser';
import { W, COLORS, textStyle } from '../theme.js';
import { button, drawSky, toast } from '../ui.js';
import { handTracker } from '../input/handTracker.js';
import { getLives, msToNextLife, formatCountdown, heartsText } from '../lives.js';
import { shareOnWhatsApp } from '../share.js';
import { sfx } from '../sfx.js';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(d) {
    drawSky(this);

    const panel = this.add.graphics();
    panel.fillStyle(0x1a1030, 0.72);
    panel.fillRoundedRect(40, 150, W - 80, 370, 28);
    panel.lineStyle(5, 0xffd23f, 1);
    panel.strokeRoundedRect(40, 150, W - 80, 370, 28);

    const title = d.won ? 'LEVEL CLEARED!' : d.reason === 'boom' ? 'BOOM! 💣' : "TIME'S UP!";
    const t = this.add.text(W / 2, 222, title, textStyle(50, d.won ? COLORS.gold : COLORS.danger)).setOrigin(0.5).setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 450, ease: 'Back.out' });
    this.add.text(W / 2, 300, `Level ${d.level}`, textStyle(32)).setOrigin(0.5);
    this.add.text(W / 2, 358, `${d.score} / ${d.target}`, textStyle(30, d.won ? COLORS.green : COLORS.text)).setOrigin(0.5);
    if (d.bestCombo >= 5) this.add.text(W / 2, 405, `Best combo x${d.bestCombo}`, textStyle(22, COLORS.gold)).setOrigin(0.5);

    // Lives left (failing a level costs one).
    const lives = getLives();
    this.add.text(W / 2, 455, heartsText(lives), textStyle(30, COLORS.danger)).setOrigin(0.5);
    if (!d.won) this.add.text(W / 2, 492, '-1 life', textStyle(18, COLORS.danger)).setOrigin(0.5);

    const nextLevel = d.won ? d.level + 1 : d.level;
    // TODO (ads): on a loss, offer "Watch ad for +15 sec / +1 life" here once the ad network is approved.
    button(this, W / 2, 590, d.won ? 'NEXT LEVEL ▶' : 'TRY AGAIN ↻', () => {
      if (getLives() <= 0) {
        sfx.lose();
        toast(this, `No lives left! 💔\nNext life in ${formatCountdown(msToNextLife())}`);
        return;
      }
      this.scene.start('Game', { level: nextLevel, mode: d.mode });
    });
    button(this, W / 2, 692, 'SHARE ON WHATSAPP', () => shareOnWhatsApp({ score: d.score, level: d.level, won: d.won }), {
      fill: 0x25d366,
      textColor: '#ffffff',
    });
    button(
      this,
      W / 2,
      794,
      'MENU',
      () => {
        handTracker.stop();
        this.scene.start('Menu');
      },
      { fill: 0xffffff, textColor: '#1a1030' },
    );
  }
}
