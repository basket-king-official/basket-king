import Phaser from 'phaser';
import { W, H, COLORS, textStyle } from '../theme.js';
import { button, drawSky, toast } from '../ui.js';
import { load } from '../storage.js';
import { askName } from '../nameDialog.js';
import { CURRENCIES, DEFAULT_CURRENCY } from '../config/currency.js';
import { fetchLeaderboard, getProfile, initOnline, setDisplayName, pointsToMoney, msUntilReset, formatDuration } from '../online.js';

const TOP_ROWS = 10;
const ROW_H = 46;
const LIST_Y = 268;

export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('Leaderboard');
  }

  create(data = {}) {
    this.period = data.period === 'week' ? 'week' : 'day';
    this.back = data.back ?? 'Menu';
    this.backData = data.backData ?? {};
    this.currency = CURRENCIES[load('currency', DEFAULT_CURRENCY)] ?? CURRENCIES[DEFAULT_CURRENCY];

    drawSky(this, { hills: false });

    const panel = this.add.graphics();
    panel.fillStyle(0x1a1030, 0.82);
    panel.fillRoundedRect(20, 60, W - 40, 740, 28);
    panel.lineStyle(5, 0xffd23f, 1);
    panel.strokeRoundedRect(20, 60, W - 40, 740, 28);

    this.add.text(W / 2, 112, '🏆 LEADERBOARD', textStyle(40, COLORS.gold)).setOrigin(0.5);

    this.tabs = {
      day: this.makeTab(W / 2 - 115, 'TODAY', 'day'),
      week: this.makeTab(W / 2 + 115, 'THIS WEEK', 'week'),
    };
    this.resetText = this.add.text(W / 2, 236, '', textStyle(16)).setOrigin(0.5);

    this.list = this.add.container(0, 0);
    this.myName = this.add.text(W / 2, 780, '', textStyle(18)).setOrigin(0.5);

    button(this, W / 2 - 122, 868, '✏️ MY NAME', () => this.changeName(), {
      width: 228,
      height: 72,
      fill: 0xffffff,
      textColor: '#1a1030',
    });
    button(this, W / 2 + 122, 868, 'BACK', () => this.scene.start(this.back, this.backData), { width: 228, height: 72 });

    this.time.addEvent({ delay: 30000, loop: true, callback: this.updateReset, callbackScope: this });
    this.select(this.period);
  }

  makeTab(x, label, period) {
    const g = this.add.graphics();
    const t = this.add.text(0, 2, label, textStyle(22, '#ffffff', { strokeThickness: 0 })).setOrigin(0.5);
    const c = this.add.container(x, 180, [g, t]).setSize(210, 56).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => this.select(period));
    return { g, t };
  }

  drawTabs() {
    for (const [period, { g, t }] of Object.entries(this.tabs)) {
      const on = period === this.period;
      g.clear();
      g.fillStyle(on ? 0xffd23f : 0xffffff, on ? 1 : 0.12);
      g.fillRoundedRect(-105, -28, 210, 56, 18);
      t.setColor(on ? '#3a1d00' : '#ffffff');
    }
  }

  updateReset() {
    const label = this.period === 'week' ? 'Weekly board resets in' : 'Daily board resets in';
    this.resetText.setText(`${label} ${formatDuration(msUntilReset(this.period))}`);
  }

  async select(period) {
    this.period = period;
    this.drawTabs();
    this.updateReset();
    this.list.removeAll(true);
    const loading = this.add.text(W / 2, LIST_Y + 120, 'Loading…', textStyle(22));
    loading.setOrigin(0.5);
    this.list.add(loading);
    const requestId = (this.requestId = (this.requestId ?? 0) + 1);

    let rows;
    try {
      rows = await fetchLeaderboard(period, TOP_ROWS);
    } catch {
      rows = null;
    }
    if (!this.scene.isActive() || requestId !== this.requestId) return; // left the screen or switched tab

    this.list.removeAll(true);
    this.showMyName();
    if (!rows) {
      this.list.add(this.add.text(W / 2, LIST_Y + 120, 'Could not load the leaderboard.\nCheck your internet.', { ...textStyle(20), align: 'center' }).setOrigin(0.5));
      return;
    }
    if (rows.length === 0) {
      const msg = period === 'week' ? 'No scores this week yet.' : 'No scores today yet.';
      this.list.add(this.add.text(W / 2, LIST_Y + 120, `${msg}\nPlay a level to be number 1! 👑`, { ...textStyle(20), align: 'center' }).setOrigin(0.5));
      return;
    }

    const top = rows.filter((r) => r.rank <= TOP_ROWS);
    const me = rows.find((r) => r.is_me && r.rank > TOP_ROWS);
    top.forEach((r, i) => this.drawRow(r, LIST_Y + i * ROW_H));
    if (me) {
      this.list.add(this.add.text(W / 2, LIST_Y + TOP_ROWS * ROW_H - 8, '• • •', textStyle(16)).setOrigin(0.5));
      this.drawRow(me, LIST_Y + TOP_ROWS * ROW_H + 14);
    }
  }

  drawRow(r, y) {
    const medal = { 1: '🥇', 2: '🥈', 3: '🥉' }[r.rank];
    const bg = this.add.graphics();
    bg.fillStyle(r.is_me ? 0x3ee07a : 0xffffff, r.is_me ? 0.35 : r.rank % 2 ? 0.08 : 0.03);
    bg.fillRoundedRect(36, y - 20, W - 72, 40, 12);
    const color = r.is_me ? '#ffffff' : r.rank <= 3 ? COLORS.gold : '#ffffff';
    this.list.add([
      bg,
      this.add.text(70, y, medal ?? `${r.rank}`, textStyle(medal ? 24 : 20, color)).setOrigin(0.5),
      this.add.text(104, y, r.display_name + (r.is_me ? ' (you)' : ''), textStyle(20, color)).setOrigin(0, 0.5),
      this.add.text(W - 50, y, pointsToMoney(Number(r.points), this.currency), textStyle(20, color)).setOrigin(1, 0.5),
    ]);
  }

  showMyName() {
    const p = getProfile();
    this.myName.setText(p ? `You play as: ${p.display_name}` : '');
  }

  async changeName() {
    if (this.naming) return;
    this.naming = true;
    const name = await askName({
      current: getProfile()?.display_name ?? '',
      onSubmit: async (n) => {
        await initOnline();
        await setDisplayName(n);
      },
    });
    this.naming = false;
    if (name && this.scene.isActive()) {
      toast(this, 'Name saved ✅');
      this.select(this.period);
    }
  }
}
