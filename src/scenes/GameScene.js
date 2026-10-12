import Phaser from 'phaser';
import { W, H, COLORS, textStyle } from '../theme.js';
import { CURRENCIES, DEFAULT_CURRENCY } from '../config/currency.js';
import { levelConfig } from '../config/levels.js';
import { handTracker } from '../input/handTracker.js';
import { load, save } from '../storage.js';
import { toast } from '../ui.js';

const BASKET_Y = H - 150;
const RIM_OFFSET = 30; // distance from basket centre up to the rim line
const CATCH_HALF_WIDTH = 64;
const BASKET_FOLLOW = 14; // higher = snappier basket, lower = smoother

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.mode = data.mode === 'hand' ? 'hand' : 'touch';
    this.levelNum = data.level ?? 1;
    this.currency = CURRENCIES[load('currency', DEFAULT_CURRENCY)] ?? CURRENCIES[DEFAULT_CURRENCY];
    this.cfg = levelConfig(this.levelNum, this.currency);
    // A seed makes the rain reproducible, which live 1v1 will need later (same rain for both players).
    this.rng = new Phaser.Math.RandomDataGenerator([String(data.seed ?? Date.now())]);
    this.score = 0;
    this.lives = this.cfg.lives;
    this.timeLeft = this.cfg.timeLimit;
    this.multiplier = 1;
    this.multiplierUntil = 0;
    this.items = [];
    this.over = false;
  }

  create() {
    this.drawBackground();

    this.basket = this.add.image(W / 2, BASKET_Y, 'basket').setDepth(5);
    this.targetX = W / 2;
    this.rimY = BASKET_Y - RIM_OFFSET;

    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 120, max: 320 },
      angle: { min: 200, max: 340 },
      lifespan: 550,
      gravityY: 500,
      scale: { start: 0.9, end: 0 },
      emitting: false,
    }).setDepth(6);

    this.createHud();
    this.setupInput();

    this.spawnTimer = this.time.addEvent({ delay: this.cfg.spawnEveryMs, loop: true, callback: this.spawn, callbackScope: this });
    this.clockTimer = this.time.addEvent({ delay: 1000, loop: true, callback: this.tick, callbackScope: this });

    this.events.once('shutdown', () => {
      document.getElementById('cam').style.display = 'none';
      handTracker.onSlow = null;
      handTracker.pause();
    });
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x2a1659, 0x2a1659, 0x12092a, 0x12092a, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(0x3a2a66, 1);
    g.fillRect(0, H - 90, W, 90);
  }

  createHud() {
    this.levelText = this.add.text(24, 24, `LEVEL ${this.levelNum}`, textStyle(24, COLORS.gold)).setDepth(10);
    this.timeText = this.add.text(W - 24, 24, '', textStyle(30)).setOrigin(1, 0).setDepth(10);
    this.livesText = this.add.text(24, 62, '', textStyle(28, COLORS.danger)).setDepth(10);

    this.add.rectangle(W / 2, 120, W - 48, 30, 0x000000, 0.35).setDepth(10);
    this.progressBar = this.add.rectangle(24, 120, 0, 30, 0x3fbf6f).setOrigin(0, 0.5).setDepth(10);
    this.scoreText = this.add.text(W / 2, 120, '', textStyle(18)).setOrigin(0.5).setDepth(11);

    this.boostText = this.add.text(W / 2, 168, '', textStyle(26, COLORS.text)).setOrigin(0.5).setDepth(10).setVisible(false);
    this.handHint = this.add
      .text(W / 2, H / 2, 'Show your hand ✋', { ...textStyle(30), backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 18, y: 12 } })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);

    this.updateHud();
  }

  setupInput() {
    const cam = document.getElementById('cam');
    // Touch / mouse drag always works in touch mode, and is ignored in hand mode.
    const follow = (p) => {
      if (this.mode === 'touch') this.targetX = p.x;
    };
    this.input.on('pointerdown', follow);
    this.input.on('pointermove', follow);

    if (this.mode === 'hand') {
      cam.style.display = 'block';
      handTracker.onSlow = () => this.switchToTouch('Your phone is a bit slow for hand mode.\nSwitched to touch mode.');
      handTracker.start(cam).catch(() => this.switchToTouch('Camera stopped. Switched to touch mode.'));
    }
  }

  switchToTouch(message) {
    if (this.mode === 'touch') return;
    this.mode = 'touch';
    document.getElementById('cam').style.display = 'none';
    this.handHint.setVisible(false);
    handTracker.pause();
    toast(this, message);
  }

  spawn() {
    if (this.over) return;
    const c = this.cfg;
    const r = this.rng.frac();
    let type = 'money';
    if (r < c.bombChance) type = 'bomb';
    else if (r < c.bombChance + c.boost3xChance) type = 'boost3x';
    else if (r < c.bombChance + c.boost3xChance + c.boost2xChance) type = 'boost2x';

    let key = type;
    let value = 0;
    if (type === 'money') {
      const note = this.pickNote();
      value = note.value;
      key = `note_${this.currency.code}_${note.value}`;
    }

    const x = this.rng.between(50, W - 50);
    const sprite = this.add.image(x, -40, key).setDepth(4);
    const speed = c.fallSpeed * (1 + this.rng.realInRange(-c.speedJitter, c.speedJitter));
    const spin = type === 'money' ? this.rng.realInRange(-1.5, 1.5) : 0;
    this.items.push({ sprite, type, value, speed, spin });
  }

  pickNote() {
    const notes = this.currency.notes;
    const total = notes.reduce((s, n) => s + n.weight, 0);
    let roll = this.rng.frac() * total;
    for (const n of notes) {
      roll -= n.weight;
      if (roll < 0) return n;
    }
    return notes[notes.length - 1];
  }

  update(_, delta) {
    if (this.over) return;
    const dt = delta / 1000;

    if (this.mode === 'hand') {
      if (handTracker.visible) this.targetX = handTracker.x * W;
      this.handHint.setVisible(handTracker.ready && !handTracker.visible);
    }
    const half = this.basket.width / 2;
    this.targetX = Phaser.Math.Clamp(this.targetX, half, W - half);
    this.basket.x += (this.targetX - this.basket.x) * Math.min(1, dt * BASKET_FOLLOW);

    if (this.multiplier > 1 && this.time.now > this.multiplierUntil) {
      this.multiplier = 1;
      this.boostText.setVisible(false);
    } else if (this.multiplier > 1) {
      const secs = Math.ceil((this.multiplierUntil - this.time.now) / 1000);
      this.boostText.setText(`${this.multiplier}X MONEY · ${secs}s`);
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const prevY = it.sprite.y;
      it.sprite.y += it.speed * dt;
      it.sprite.rotation += it.spin * dt;

      // Catch when the item crosses the rim line this frame while above the basket opening.
      const crossedRim = prevY < this.rimY && it.sprite.y >= this.rimY;
      if (crossedRim && Math.abs(it.sprite.x - this.basket.x) < CATCH_HALF_WIDTH) {
        this.items.splice(i, 1);
        this.onCatch(it);
        if (this.over) return;
      } else if (it.sprite.y > H + 60) {
        it.sprite.destroy();
        this.items.splice(i, 1);
      }
    }
  }

  onCatch(item) {
    const { x } = item.sprite;
    item.sprite.destroy();

    if (item.type === 'bomb') {
      this.lives -= 1;
      this.cameras.main.shake(250, 0.015);
      this.cameras.main.flash(150, 255, 60, 60);
      this.sparks.setParticleTint(0xff5a3c);
      this.sparks.explode(18, x, this.rimY);
      this.updateHud();
      if (this.lives <= 0) this.finish(false, 'boom');
      return;
    }

    if (item.type === 'boost2x' || item.type === 'boost3x') {
      const m = item.type === 'boost3x' ? 3 : 2;
      this.multiplier = Math.max(this.multiplier, m);
      this.multiplierUntil = this.time.now + this.cfg.boostDurationMs;
      this.boostText.setColor(m === 3 ? COLORS.boost3x : COLORS.boost2x).setVisible(true);
      this.sparks.setParticleTint(m === 3 ? 0xa64dff : 0x2f8cff);
      this.sparks.explode(20, x, this.rimY);
      return;
    }

    const gained = item.value * this.multiplier;
    this.score += gained;
    this.sparks.setParticleTint(0xffd54a);
    this.sparks.explode(12, x, this.rimY);
    this.floatText(x, this.rimY - 30, `+${this.currency.format(gained)}`);
    this.updateHud();
    if (this.score >= this.cfg.target) this.finish(true);
  }

  floatText(x, y, msg) {
    const t = this.add.text(x, y, msg, textStyle(24, COLORS.gold)).setOrigin(0.5).setDepth(12);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  tick() {
    if (this.over) return;
    this.timeLeft -= 1;
    this.updateHud();
    if (this.timeLeft <= 0) this.finish(false, 'time');
  }

  updateHud() {
    this.timeText.setText(`${Math.max(0, this.timeLeft)}s`).setColor(this.timeLeft <= 5 ? COLORS.danger : COLORS.text);
    this.livesText.setText('♥'.repeat(Math.max(0, this.lives)) + '♡'.repeat(Math.max(0, this.cfg.lives - this.lives)));
    const pct = Math.min(1, this.score / this.cfg.target);
    this.progressBar.width = (W - 48) * pct;
    this.scoreText.setText(`${this.currency.format(this.score)} / ${this.currency.format(this.cfg.target)}`);
  }

  finish(won, reason) {
    this.over = true;
    this.spawnTimer.remove();
    this.clockTimer.remove();
    if (won) save('level', Math.max(load('level', 1), this.levelNum + 1));
    this.time.delayedCall(won ? 500 : 800, () =>
      this.scene.start('Result', {
        won,
        reason,
        level: this.levelNum,
        mode: this.mode,
        score: this.currency.format(this.score),
        target: this.currency.format(this.cfg.target),
      }),
    );
  }
}
