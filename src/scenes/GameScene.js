import Phaser from 'phaser';
import { W, H, COLORS, textStyle } from '../theme.js';
import { CURRENCIES, DEFAULT_CURRENCY, noteKey } from '../config/currency.js';
import { levelConfig } from '../config/levels.js';
import { handTracker } from '../input/handTracker.js';
import { load, save } from '../storage.js';
import { drawSky, toast } from '../ui.js';
import { sfx } from '../sfx.js';
import { NET } from './BootScene.js';
import { loseLife } from '../lives.js';
import { submitRun, toPoints, getShopState, useBoost, coinsForRun } from '../online.js';
import { netTextureKey } from '../config/shop.js';

const NET_SCALE = 1.1;
const GRIP_TO_MOUTH = (NET.gripY - NET.hoopY) * NET_SCALE; // distance from fist (grip) up to the net opening
const MOUTH_HALF_W = NET.hoopRX * NET_SCALE * 0.9;
const TOUCH_MOUTH_Y = H - 250;
const MOUTH_Y_MIN = 300;
const MOUTH_Y_MAX = H - 140;
const NET_FOLLOW = 16; // touch: higher = snappier net, lower = smoother
const NET_FOLLOW_HAND = 30; // hand: the tracker already delivers a smooth path, so follow it closely
// Hand mode is a little more forgiving to make up for the camera's small delay.
const HAND_CATCH_BONUS = 1.25; // wider net opening
const HAND_SPEED = 0.85; // slightly slower rain
const REQUIRE_FIST = true; // hand mode: the net only works while the hand is a closed fist
const BAR = { x: 24, y: 128, w: W - 48, h: 30 };

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
    this.combo = 0;
    this.bestCombo = 0;
    this.items = [];
    this.over = false;
    this.started = false;
  }

  create() {
    this.video = document.getElementById('cam');

    if (this.mode === 'hand') {
      this.video.style.display = 'block';
      // Dark fade at the top only, so the HUD stays readable over the camera.
      const g = this.add.graphics();
      g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
      g.fillRect(0, 0, W, 240);
    } else {
      drawSky(this, { theme: getShopState()?.equipped_sky });
    }

    this.createEffects();

    this.net = this.add
      .image(W / 2, TOUCH_MOUTH_Y + GRIP_TO_MOUTH, netTextureKey(getShopState()?.equipped_net))
      .setOrigin(NET.hoopX / NET.w, NET.gripY / NET.h)
      .setScale(NET_SCALE)
      .setDepth(5);
    this.netTarget = { x: this.net.x, y: this.net.y };
    this.netActive = this.mode === 'touch';

    this.createHud();
    this.setupInput();
    this.showLevelBanner();

    this.events.once('shutdown', () => {
      this.video.style.display = 'none';
      handTracker.onSlow = null;
      handTracker.pause();
    });
  }

  createEffects() {
    this.burst = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 160, max: 440 },
        angle: { min: 0, max: 360 },
        lifespan: 650,
        gravityY: 700,
        scale: { start: 1, end: 0 },
        emitting: false,
      })
      .setDepth(8);
    this.stars = this.add
      .particles(0, 0, 'star', {
        speed: { min: 20, max: 90 },
        lifespan: 520,
        scale: { start: 0.8, end: 0 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        emitting: false,
      })
      .setDepth(3);
    this.smoke = this.add
      .particles(0, 0, 'smoke', {
        speed: { min: 40, max: 170 },
        lifespan: 900,
        scale: { start: 0.8, end: 2.4 },
        alpha: { start: 0.8, end: 0 },
        emitting: false,
      })
      .setDepth(8);
    this.fuse = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 30, max: 100 },
        lifespan: 260,
        scale: { start: 0.55, end: 0 },
        tint: [0xffd23f, 0xff7a00, 0xffffff],
        emitting: false,
      })
      .setDepth(4);
  }

  createHud() {
    this.levelText = this.add.text(20, 16, `LEVEL ${this.levelNum}`, textStyle(28, COLORS.gold)).setDepth(20);
    // Shields = bomb hits left in this level (hearts are only for lives).
    this.shields = Array.from({ length: this.cfg.lives }, (_, i) => this.add.image(40 + i * 46, 82, 'shield').setDepth(20));
    this.timeText = this.add.text(W - 20, 10, '', textStyle(48)).setOrigin(1, 0).setDepth(20);

    const frame = this.add.graphics().setDepth(20);
    frame.fillStyle(0x1a1030, 0.6);
    frame.fillRoundedRect(BAR.x, BAR.y - BAR.h / 2, BAR.w, BAR.h, 15);
    this.barFill = this.add.graphics().setDepth(20);
    this.barMask = this.make.graphics();
    this.shine = this.add.rectangle(BAR.x - 40, BAR.y, 26, 60, 0xffffff, 0.55).setAngle(20).setDepth(21);
    this.shine.setMask(this.barMask.createGeometryMask());
    this.tweens.add({ targets: this.shine, x: BAR.x + BAR.w + 40, duration: 1300, repeat: -1, repeatDelay: 700 });
    const outline = this.add.graphics().setDepth(22);
    outline.lineStyle(4, 0xffffff, 1);
    outline.strokeRoundedRect(BAR.x, BAR.y - BAR.h / 2, BAR.w, BAR.h, 15);
    this.scoreText = this.add.text(W / 2, BAR.y, '', textStyle(19)).setOrigin(0.5).setDepth(23);

    this.boostText = this.add.text(W / 2, 182, '', textStyle(28)).setOrigin(0.5).setDepth(20).setVisible(false);
    this.createBoostButton();
    this.hint = this.add
      .text(W / 2, H * 0.42, '', { ...textStyle(30), align: 'center', backgroundColor: 'rgba(20,10,40,0.55)', padding: { x: 18, y: 12 } })
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false);

    // Add ?debug to the link to see live tracking stats at the bottom of the screen.
    if (new URLSearchParams(window.location.search).has('debug')) {
      this.debugText = this.add
        .text(10, H - 12, '', { ...textStyle(16), backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 6, y: 4 }, wordWrap: { width: W - 20 } })
        .setOrigin(0, 1)
        .setDepth(50);
    }

    if (this.mode === 'hand') {
      this.flipBtn = this.add
        .text(W - 20, 74, '🔄 FLIP CAMERA', textStyle(16))
        .setOrigin(1, 0)
        .setDepth(20)
        .setInteractive({ useHandCursor: true });
      this.flipBtn.on('pointerup', () => handTracker.switchCamera().catch(() => toast(this, 'Could not switch camera')));
    }

    this.updateHud();
  }

  // Shop boost: tap to get 2X money for a few seconds (only shown if the player owns some).
  createBoostButton() {
    const left = () => getShopState()?.inventory?.boost_2x ?? 0;
    if (left() <= 0) return;
    const g = this.add.graphics();
    g.fillStyle(0x2f8cff, 1);
    g.fillRoundedRect(-62, -28, 124, 56, 18);
    g.lineStyle(4, 0x1a1030, 1);
    g.strokeRoundedRect(-62, -28, 124, 56, 18);
    const t = this.add.text(0, 1, '', textStyle(22, '#ffffff')).setOrigin(0.5);
    const btn = this.add.container(W - 82, 92, [g, t]).setDepth(25).setSize(124, 56).setInteractive({ useHandCursor: true });
    const refresh = () => {
      t.setText(`⚡2X ×${left()}`);
      if (left() <= 0) btn.destroy();
    };
    refresh();
    btn.on('pointerup', () => {
      if (!this.started || this.over || this.multiplier > 1) return;
      if (!useBoost('boost_2x')) return;
      sfx.boost();
      this.multiplier = 2;
      this.multiplierUntil = this.time.now + this.cfg.boostDurationMs;
      this.boostText.setColor(COLORS.boost2x).setVisible(true);
      this.popText(W / 2, H * 0.4, '2X MONEY!', 64, COLORS.boost2x, 0);
      refresh();
    });
  }

  setupInput() {
    // Touch / mouse drag moves the net in touch mode; ignored in hand mode.
    const follow = (p) => {
      if (this.mode === 'touch' && p.y > 140) this.netTarget.x = p.x;
    };
    this.input.on('pointerdown', follow);
    this.input.on('pointermove', follow);

    if (this.mode === 'hand') {
      handTracker.onSlow = () => this.switchToTouch('Your phone is a bit slow for hand mode.\nSwitched to touch mode.');
      handTracker.start(this.video).catch(() => this.switchToTouch('Camera stopped. Switched to touch mode.'));
    }
  }

  switchToTouch(message) {
    if (this.mode === 'touch') return;
    this.mode = 'touch';
    this.video.style.display = 'none';
    this.hint.setVisible(false);
    this.flipBtn?.setVisible(false);
    handTracker.pause();
    toast(this, message);
  }

  showLevelBanner() {
    const title = this.add.text(W / 2, H * 0.4, `LEVEL ${this.levelNum}`, textStyle(70, COLORS.gold)).setOrigin(0.5).setDepth(40).setScale(0);
    const goal = this.add
      .text(W / 2, H * 0.4 + 80, `Catch ${this.currency.format(this.cfg.target)} in ${this.cfg.timeLimit}s!`, textStyle(28))
      .setOrigin(0.5)
      .setDepth(40)
      .setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, duration: 420, ease: 'Back.out' });
    this.tweens.add({ targets: goal, alpha: 1, duration: 300, delay: 250 });
    this.time.delayedCall(1500, () => {
      title.destroy();
      goal.destroy();
      this.popText(W / 2, H * 0.42, 'GO!', 90, COLORS.green, 0);
      this.startRain();
    });
  }

  startRain() {
    this.started = true;
    this.spawnTimer = this.time.addEvent({ delay: this.cfg.spawnEveryMs, loop: true, callback: this.spawn, callbackScope: this });
    this.clockTimer = this.time.addEvent({ delay: 1000, loop: true, callback: this.tick, callbackScope: this });
    this.spawn();
  }

  speedK() {
    return this.mode === 'hand' ? HAND_SPEED : 1;
  }

  // ---------- spawning ----------

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
    let kind = type;
    if (type === 'money') {
      const note = this.pickNote();
      value = note.value;
      kind = note.kind;
      key = noteKey(this.currency, note);
    }

    const g = c.gravity * this.speedK();
    const vy = c.startSpeed * this.speedK() * (0.85 + this.rng.frac() * 0.3);
    const comet = this.rng.frac() < c.cometChance;
    let x;
    let y;
    let vx;
    if (comet) {
      // Flies in at an angle from a side, aimed so it can still be caught somewhere on screen.
      const fromLeft = this.rng.frac() < 0.5;
      x = fromLeft ? -50 : W + 50;
      y = this.rng.between(-40, 260);
      const landX = this.rng.between(70, W - 70);
      const aimY = this.mode === 'hand' ? H * 0.62 : TOUCH_MOUTH_Y;
      const t = (-vy + Math.sqrt(vy * vy + 2 * g * (aimY - y))) / g;
      vx = (landX - x) / t;
    } else {
      x = this.rng.between(50, W - 50);
      y = -50;
      vx = this.rng.realInRange(-50, 50);
    }

    const sprite = this.add.image(x, y, key).setDepth(4);
    let glow = null;
    if (type === 'bomb' || type.startsWith('boost')) {
      glow = this.add
        .image(x, y, type === 'bomb' ? 'glowRed' : 'glowGold')
        .setDepth(3)
        .setAlpha(0.45);
      this.tweens.add({ targets: glow, alpha: 0.95, scale: 1.25, duration: 280, yoyo: true, repeat: -1 });
    }
    const spin = kind === 'coin' ? this.rng.realInRange(-7, 7) : kind === 'bill' ? this.rng.realInRange(-4, 4) : this.rng.realInRange(-2, 2);
    this.items.push({ sprite, glow, type, value, vx, vy, spin, comet });
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

  // ---------- frame loop ----------

  update(_, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.updateNet(dt);
    if (this.over || !this.started) return;

    if (this.multiplier > 1 && this.time.now > this.multiplierUntil) {
      this.multiplier = 1;
      this.boostText.setVisible(false);
    } else if (this.multiplier > 1) {
      this.boostText.setText(`${this.multiplier}X MONEY · ${Math.ceil((this.multiplierUntil - this.time.now) / 1000)}s`);
    }

    const mouthX = this.net.x;
    const mouthY = this.net.y - GRIP_TO_MOUTH;
    const g = this.cfg.gravity * this.speedK();
    const halfW = MOUTH_HALF_W * (this.mode === 'hand' ? HAND_CATCH_BONUS : 1);

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const s = it.sprite;
      it.vy += g * dt;
      s.x += it.vx * dt;
      s.y += it.vy * dt;
      s.rotation += it.spin * dt;
      if (it.glow) it.glow.setPosition(s.x, s.y);
      this.emitTrail(it);

      const inMouth = Math.abs(s.x - mouthX) < halfW && s.y > mouthY - 36 && s.y < mouthY + 26;
      if (this.netActive && it.vy > 0 && inMouth) {
        this.items.splice(i, 1);
        this.onCatch(it, mouthX, mouthY);
        if (this.over) return;
      } else if (s.y > H + 90 || s.x < -150 || s.x > W + 150) {
        this.removeItem(it);
        this.items.splice(i, 1);
      }
    }
  }

  updateNet(dt) {
    if (this.debugText) {
      const t = handTracker;
      this.debugText.setText(
        `game ${Math.round(this.game.loop.actualFps)}fps | ${t.delegate ?? '?'} ${Math.round(t.lastMs)}ms ${t.ratePerSec ?? 0}/s | hand ${t.handPct ?? 0}% | ${t.visible ? 'SEEN' : 'LOST'} ${t.fist ? 'FIST' : 'OPEN'} | cam ${this.video.videoWidth}x${this.video.videoHeight} ${t.facing}`,
      );
    }
    if (this.mode === 'hand') {
      if (handTracker.visible) {
        const hp = handTracker.position();
        const p = this.videoToGame(hp.x, hp.y);
        if (p) {
          this.netTarget.x = p.x;
          this.netTarget.y = p.y;
        }
      }
      this.netActive = handTracker.visible && (!REQUIRE_FIST || handTracker.fist);
      if (!handTracker.ready || this.over) this.hint.setVisible(false);
      else if (!handTracker.visible) this.hint.setText('Show your fist ✊\nto the camera').setVisible(true);
      else if (!this.netActive) this.hint.setText('Close your hand ✊\nto hold the net').setVisible(true);
      else this.hint.setVisible(false);
    } else {
      this.netTarget.y = TOUCH_MOUTH_Y + GRIP_TO_MOUTH;
      this.netActive = true;
    }

    const tx = Phaser.Math.Clamp(this.netTarget.x, MOUTH_HALF_W, W - MOUTH_HALF_W);
    const ty = Phaser.Math.Clamp(this.netTarget.y, MOUTH_Y_MIN + GRIP_TO_MOUTH, MOUTH_Y_MAX + GRIP_TO_MOUTH);
    const k = Math.min(1, dt * (this.mode === 'hand' ? NET_FOLLOW_HAND : NET_FOLLOW));
    this.net.x += (tx - this.net.x) * k;
    this.net.y += (ty - this.net.y) * k;
    this.net.alpha += ((this.netActive ? 1 : 0.25) - this.net.alpha) * Math.min(1, dt * 10);
  }

  // Converts a camera position (0..1 of the video frame) into game coordinates,
  // matching how the full-screen video is cropped (object-fit: cover).
  videoToGame(nx, ny) {
    const v = this.video;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    if (!vw || !vh) return null;
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const s = Math.max(ww / vw, wh / vh);
    const px = (ww - vw * s) / 2 + nx * vw * s;
    const py = (wh - vh * s) / 2 + ny * vh * s;
    const r = this.game.canvas.getBoundingClientRect();
    return { x: ((px - r.left) * W) / r.width, y: ((py - r.top) * H) / r.height };
  }

  emitTrail(it) {
    const s = it.sprite;
    if (it.type === 'bomb') {
      const a = s.rotation;
      const fx = s.x + 22 * Math.cos(a) + 43 * Math.sin(a);
      const fy = s.y + 22 * Math.sin(a) - 43 * Math.cos(a);
      this.fuse.emitParticleAt(fx, fy, 1);
    } else if (it.comet || Math.random() < 0.3) {
      this.stars.setParticleTint(it.type === 'money' ? 0xffe066 : 0x9fd0ff);
      this.stars.emitParticleAt(s.x, s.y, 1);
    }
  }

  removeItem(it) {
    if (it.glow) {
      this.tweens.killTweensOf(it.glow);
      it.glow.destroy();
    }
    it.sprite.destroy();
  }

  // ---------- catching ----------

  onCatch(it, mx, my) {
    this.removeItem(it);
    this.bounceNet();

    if (it.type === 'bomb') {
      this.lives -= 1;
      this.combo = 0;
      sfx.bomb();
      this.cameras.main.shake(320, 0.02);
      this.cameras.main.flash(160, 255, 40, 40);
      this.smoke.explode(10, mx, my);
      this.burst.setParticleTint(0xff7a00);
      this.burst.explode(22, mx, my);
      this.popText(mx, my - 40, 'BOOM!', 48, COLORS.danger);
      const lost = this.shields[this.lives - 1];
      if (lost) this.tweens.add({ targets: lost, scale: 1.5, duration: 120, yoyo: true });
      this.updateHud();
      if (this.lives <= 0) this.finish(false, 'boom');
      return;
    }

    if (it.type === 'boost2x' || it.type === 'boost3x') {
      const m = it.type === 'boost3x' ? 3 : 2;
      sfx.boost();
      this.multiplier = Math.max(this.multiplier, m);
      this.multiplierUntil = this.time.now + this.cfg.boostDurationMs;
      const color = m === 3 ? COLORS.boost3x : COLORS.boost2x;
      this.boostText.setColor(color).setVisible(true);
      this.burst.setParticleTint(m === 3 ? 0xb44dff : 0x2f8cff);
      this.burst.explode(26, mx, my);
      this.popText(W / 2, H * 0.4, `${m}X MONEY!`, 64, color, 0);
      return;
    }

    const gained = it.value * this.multiplier;
    this.score += gained;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    sfx.coin(gained >= 1000);
    this.burst.setParticleTint(0xffd23f);
    this.burst.explode(14, mx, my);
    this.stars.setParticleTint(0xffffff);
    this.stars.explode(8, mx, my);
    this.popText(mx, my - 50, `+${this.currency.format(gained)}`, gained >= 1000 ? 46 : 38, COLORS.gold);
    if (this.combo % 5 === 0) {
      sfx.combo();
      this.popText(W / 2, H * 0.33, `COMBO x${this.combo}!`, 54, COLORS.green, 0);
    }
    this.updateHud();
    if (this.score >= this.cfg.target) this.finish(true);
  }

  bounceNet() {
    this.tweens.killTweensOf(this.net);
    this.net.setScale(NET_SCALE);
    this.tweens.add({ targets: this.net, scaleX: NET_SCALE * 1.1, scaleY: NET_SCALE * 0.88, duration: 70, yoyo: true });
  }

  popText(x, y, msg, size, color, rise = 70) {
    const t = this.add.text(x, y, msg, textStyle(size, color)).setOrigin(0.5).setDepth(35).setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.out' });
    this.tweens.add({ targets: t, y: y - rise, alpha: 0, delay: 380, duration: 450, onComplete: () => t.destroy() });
  }

  // ---------- clock & HUD ----------

  tick() {
    if (this.over) return;
    this.timeLeft -= 1;
    if (this.timeLeft <= 5 && this.timeLeft > 0) {
      sfx.tick();
      this.tweens.add({ targets: this.timeText, scale: 1.25, duration: 120, yoyo: true });
    }
    this.updateHud();
    if (this.timeLeft <= 0) this.finish(false, 'time');
  }

  updateHud() {
    this.timeText.setText(`${Math.max(0, this.timeLeft)}s`).setColor(this.timeLeft <= 5 ? COLORS.danger : COLORS.text);
    this.shields.forEach((s, i) => {
      if (i < this.lives) s.clearTint().setAlpha(1);
      else s.setTint(0x555566).setAlpha(0.45);
    });
    const pct = Math.min(1, this.score / this.cfg.target);
    const fw = Math.max(0, BAR.w * pct);
    this.barFill.clear();
    this.barMask.clear();
    if (fw > 4) {
      this.barFill.fillGradientStyle(0x3ee07a, 0xffd23f, 0x3ee07a, 0xffd23f, 1);
      this.barFill.fillRoundedRect(BAR.x, BAR.y - BAR.h / 2, Math.max(fw, 30), BAR.h, 15);
      this.barMask.fillStyle(0xffffff);
      this.barMask.fillRect(BAR.x, BAR.y - BAR.h / 2, fw, BAR.h);
    }
    this.scoreText.setText(`${this.currency.format(this.score)} / ${this.currency.format(this.cfg.target)}`);
  }

  finish(won, reason) {
    this.over = true;
    this.spawnTimer?.remove();
    this.clockTimer?.remove();
    this.hint.setVisible(false);
    if (won) {
      sfx.win();
      save('level', Math.max(load('level', 1), this.levelNum + 1));
    } else {
      sfx.lose();
      loseLife(); // failing a level costs one life (Candy Crush style)
    }
    // Leaderboard: every level counts, won or lost (sent in the background).
    const points = toPoints(this.score, this.currency);
    if (points > 0) submitRun({ level: this.levelNum, points, won, mode: this.mode });
    this.time.delayedCall(won ? 700 : 900, () =>
      this.scene.start('Result', {
        won,
        reason,
        level: this.levelNum,
        mode: this.mode,
        bestCombo: this.bestCombo,
        score: this.currency.format(this.score),
        target: this.currency.format(this.cfg.target),
        points,
        coins: coinsForRun(points, won),
      }),
    );
  }
}
