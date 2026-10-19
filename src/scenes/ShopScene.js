import Phaser from 'phaser';
import { W, COLORS, textStyle } from '../theme.js';
import { button, drawSky, toast } from '../ui.js';
import { sfx } from '../sfx.js';
import { NET_STYLES, SKY_THEMES } from '../config/shop.js';
import { getShopState, refreshShop, buyItem, equipNet, equipSky } from '../online.js';
import { getLives, addLives, MAX_LIVES } from '../lives.js';
import { load, save } from '../storage.js';

const NET_IDS = ['net_classic', 'net_gold', 'net_royal', 'net_fire'];
const SKY_IDS = ['sky_day', 'sky_sunset', 'sky_night', 'sky_douala'];
const FREE = { net: 'net_classic', sky: 'sky_day' };
const CARD = { w: 236, h: 236 };
const GRID = [
  [W / 2 - 124, 360],
  [W / 2 + 124, 360],
  [W / 2 - 124, 610],
  [W / 2 + 124, 610],
];
const TABS = [
  ['net', 'NETS'],
  ['sky', 'SKIES'],
  ['power', 'POWER-UPS'],
];

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create(data = {}) {
    this.back = data.back ?? 'Menu';
    this.busy = false;
    this.tab = data.tab ?? load('shopTab', 'net');
    drawSky(this, { hills: false, theme: getShopState()?.equipped_sky });

    this.add.text(W / 2, 50, '🛒 SHOP', textStyle(42, COLORS.gold)).setOrigin(0.5);
    const pill = this.add.graphics();
    pill.fillStyle(0x1a1030, 0.85);
    pill.fillRoundedRect(W / 2 - 120, 88, 240, 50, 25);
    pill.lineStyle(4, 0xffd23f, 1);
    pill.strokeRoundedRect(W / 2 - 120, 88, 240, 50, 25);
    this.coinsText = this.add.text(W / 2, 114, '', textStyle(27, COLORS.gold)).setOrigin(0.5);
    this.add.text(W / 2, 158, 'Earn coins in every level 🪙', textStyle(16)).setOrigin(0.5);

    this.tabButtons = TABS.map(([id, label], i) => {
      const x = W / 2 + (i - 1) * 168;
      const g = this.add.graphics();
      const t = this.add.text(0, 1, label, textStyle(19, '#ffffff', { strokeThickness: 0 })).setOrigin(0.5);
      const c = this.add.container(x, 206, [g, t]).setSize(158, 48).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        this.tab = id;
        save('shopTab', id);
        this.render(this.offline);
      });
      return { id, g, t };
    });

    this.content = this.add.container(0, 0);
    button(this, W / 2, 904, 'BACK', () => this.scene.start(this.back), { width: 300, height: 76 });

    if (getShopState()) this.render();
    else this.content.add(this.add.text(W / 2, 460, 'Loading shop…', textStyle(24)).setOrigin(0.5));

    refreshShop()
      .then(() => this.scene.isActive() && this.render())
      .catch(() => {
        if (!this.scene.isActive()) return;
        if (getShopState()) this.render(true);
        else {
          this.content.removeAll(true);
          this.content.add(
            this.add.text(W / 2, 460, 'Could not load the shop.\nCheck your internet.', { ...textStyle(22), align: 'center' }).setOrigin(0.5),
          );
        }
      });
  }

  drawTabs() {
    for (const { id, g, t } of this.tabButtons) {
      const on = id === this.tab;
      g.clear();
      g.fillStyle(on ? 0xffd23f : 0x1a1030, on ? 1 : 0.7);
      g.fillRoundedRect(-79, -24, 158, 48, 16);
      t.setColor(on ? '#3a1d00' : '#ffffff');
    }
  }

  render(offline = false) {
    this.offline = offline;
    const st = getShopState();
    if (!st) return;
    this.drawTabs();
    this.content.removeAll(true);
    this.coinsText.setText(`🪙 ${st.coins.toLocaleString('fr-FR')}`);
    const items = Object.fromEntries((st.items ?? []).map((i) => [i.id, i]));
    const owned = st.inventory ?? {};

    if (this.tab === 'net' || this.tab === 'sky') {
      const kind = this.tab;
      const ids = kind === 'net' ? NET_IDS : SKY_IDS;
      const equippedId = (kind === 'net' ? st.equipped_net : st.equipped_sky) ?? FREE[kind];
      let slot = 0;
      ids.forEach((id) => {
        const isOwned = id === FREE[kind] || owned[id] > 0;
        if (!isOwned && !items[id]) return; // removed from the shop by the admin
        this.card(GRID[slot++], kind, id, items[id], isOwned, equippedId === id, offline);
      });
      return;
    }

    if (items.boost_2x) {
      this.rowCard(330, '⚡', items.boost_2x.name, `Tap ⚡ during a level: 2X money for 10s.\nYou have ${owned.boost_2x ?? 0}.`, items.boost_2x, offline);
    }
    if (items.life_refill) {
      const full = getLives() >= MAX_LIVES;
      this.rowCard(460, '❤️', items.life_refill.name, full ? 'Your lives are full.' : `Refill all ${MAX_LIVES} lives now.`, items.life_refill, offline || full);
    }
  }

  card([x, y], kind, id, item, isOwned, equipped, offline) {
    const name = item?.name ?? (kind === 'net' ? NET_STYLES[id].name : SKY_THEMES[id].name);
    const g = this.add.graphics();
    g.fillStyle(0x1a1030, 0.85);
    g.fillRoundedRect(x - CARD.w / 2, y - CARD.h / 2, CARD.w, CARD.h, 20);
    g.lineStyle(4, equipped ? 0x3ee07a : 0xffd23f, 1);
    g.strokeRoundedRect(x - CARD.w / 2, y - CARD.h / 2, CARD.w, CARD.h, 20);
    const pic = kind === 'net' ? this.add.image(x, y - 40, id).setScale(0.38) : this.add.image(x, y - 42, `prev_${id}`);
    this.content.add([g, pic, this.add.text(x, y + 46, name, textStyle(19)).setOrigin(0.5)]);

    let label;
    let fill;
    let action = null;
    if (equipped) {
      label = '✓ USING';
      fill = 0x3ee07a;
    } else if (isOwned) {
      label = 'USE';
      fill = 0xffffff;
      action = () => this.run(() => (kind === 'net' ? equipNet(id) : equipSky(id)), `${name} equipped ✅`);
    } else {
      label = `🪙 ${item.price}`;
      fill = 0xffd23f;
      action = () => this.confirmBuy(item);
    }
    const b = button(this, x, y + 88, label, () => action?.(), { width: 190, height: 50, fill, textColor: '#1a1030' });
    b.list[1].setFontSize(21);
    if (!action || offline) b.disableInteractive().setAlpha(action ? 0.5 : 1);
    this.content.add(b);
  }

  rowCard(y, icon, title, sub, item, disabled) {
    const g = this.add.graphics();
    g.fillStyle(0x1a1030, 0.85);
    g.fillRoundedRect(28, y - 52, W - 56, 104, 20);
    g.lineStyle(4, 0xffd23f, 1);
    g.strokeRoundedRect(28, y - 52, W - 56, 104, 20);
    this.content.add([
      g,
      this.add.text(70, y, icon, textStyle(38)).setOrigin(0.5),
      this.add.text(106, y - 22, title, textStyle(23)).setOrigin(0, 0.5),
      this.add.text(106, y + 16, sub, textStyle(15, '#e6e0f5', { wordWrap: { width: 250 } })).setOrigin(0, 0.5),
    ]);
    const b = button(this, W - 100, y, `🪙 ${item.price}`, () => this.confirmBuy(item), { width: 124, height: 54, textColor: '#1a1030' });
    b.list[1].setFontSize(21);
    if (disabled) b.disableInteractive().setAlpha(0.5);
    this.content.add(b);
  }

  confirmBuy(item) {
    const st = getShopState();
    if (st.coins < item.price) {
      sfx.lose();
      toast(this, `Not enough coins 🪙\nYou need ${item.price - st.coins} more. Play levels to earn coins!`);
      return;
    }
    const done =
      item.kind === 'life' ? 'Lives refilled ❤️' : item.kind === 'boost' ? '2X Boost added ⚡' : `${item.name} unlocked! Tap USE to equip it ✨`;
    this.run(
      async () => {
        if (item.kind === 'life' && getLives() >= MAX_LIVES) throw new Error('Your lives are already full');
        await buyItem(item.id);
        if (item.kind === 'life') addLives(MAX_LIVES);
      },
      done,
      true,
    );
  }

  async run(fn, okMessage, purchase = false) {
    if (this.busy) return;
    this.busy = true;
    try {
      await fn();
      if (purchase) sfx.win();
      else sfx.coin(false);
      if (this.scene.isActive()) {
        // A new sky shows straight away in the shop background.
        if (okMessage.includes('equipped') && this.tab === 'sky') return this.scene.restart({ back: this.back, tab: 'sky' });
        this.render();
        toast(this, okMessage);
      }
    } catch (err) {
      sfx.lose();
      if (this.scene.isActive()) toast(this, err.message || 'Something went wrong');
    } finally {
      this.busy = false;
    }
  }
}
