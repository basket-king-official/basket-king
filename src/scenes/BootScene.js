import Phaser from 'phaser';
import { CURRENCIES, noteKey } from '../config/currency.js';
import { FONT, COLORS } from '../theme.js';
import { NET_STYLES, SKY_THEMES } from '../config/shop.js';

// Net geometry inside the 'net' texture (used by GameScene for catching).
export const NET = { w: 180, h: 320, hoopX: 90, hoopY: 42, hoopRX: 72, hoopRY: 24, gripY: 312 };

// All art is drawn in code, so there are no third-party assets to license.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('logo', 'logo.png');
  }

  create() {
    Object.entries(NET_STYLES).forEach(([key, style]) => this.makeNet(key, style));
    this.makeBomb();
    this.makeGlow('glowRed', 'rgba(255,40,40,0.95)');
    this.makeGlow('glowGold', 'rgba(255,215,60,0.95)');
    this.makeBoost('boost2x', '2X', COLORS.boost2x);
    this.makeBoost('boost3x', '3X', COLORS.boost3x);
    this.makeSpark();
    this.makeStar();
    this.makeSmoke();
    this.makeShield();
    this.makeSun();
    this.makeRays();
    this.makeCloud();
    this.makeMoon();
    this.makeSkyline();
    Object.entries(SKY_THEMES).forEach(([key, t]) => this.makeSkyPreview(key, t));
    Object.values(CURRENCIES).forEach((c) =>
      c.notes.forEach((n) => (n.kind === 'coin' ? this.makeCoin(c, n) : this.makeBill(c, n))),
    );
    this.scene.start('Menu');
  }

  canvas(key, w, h, draw) {
    const tex = this.textures.createCanvas(key, w, h);
    draw(tex.getContext(), w, h);
    tex.refresh();
  }

  makeNet(key, st) {
    const { w, h, hoopX, hoopY, hoopRX, hoopRY, gripY } = NET;
    this.canvas(key, w, h, (ctx) => {
      // Mesh bag hanging under the hoop.
      const tipX = hoopX + 10;
      const tipY = hoopY + 150;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(hoopX - hoopRX, hoopY);
      ctx.quadraticCurveTo(hoopX - hoopRX + 6, hoopY + 110, tipX, tipY);
      ctx.quadraticCurveTo(hoopX + hoopRX - 2, hoopY + 105, hoopX + hoopRX, hoopY);
      ctx.closePath();
      ctx.fillStyle = st.meshFill;
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = st.mesh;
      ctx.lineWidth = 2;
      for (let i = -12; i < 20; i++) {
        ctx.beginPath();
        ctx.moveTo(hoopX - hoopRX + i * 14, hoopY - 10);
        ctx.lineTo(hoopX - hoopRX + i * 14 + 120, tipY + 20);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(hoopX + hoopRX - i * 14, hoopY - 10);
        ctx.lineTo(hoopX + hoopRX - i * 14 - 120, tipY + 20);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#1a1030';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hoopX - hoopRX, hoopY);
      ctx.quadraticCurveTo(hoopX - hoopRX + 6, hoopY + 110, tipX, tipY);
      ctx.quadraticCurveTo(hoopX + hoopRX - 2, hoopY + 105, hoopX + hoopRX, hoopY);
      ctx.stroke();

      // Wooden handle from the hoop down to the grip.
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1a1030';
      ctx.lineWidth = 16;
      line(ctx, hoopX, hoopY + hoopRY - 4, hoopX, gripY);
      ctx.strokeStyle = st.handle;
      ctx.lineWidth = 10;
      line(ctx, hoopX, hoopY + hoopRY - 4, hoopX, gripY);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      line(ctx, hoopX - 2, hoopY + hoopRY, hoopX - 2, gripY - 50);
      ctx.strokeStyle = st.grip;
      ctx.lineWidth = 12;
      line(ctx, hoopX, gripY - 48, hoopX, gripY - 2);

      // Glowing gold hoop.
      ctx.save();
      ctx.shadowColor = st.glow;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#1a1030';
      ctx.lineWidth = 11;
      ellipse(ctx, hoopX, hoopY, hoopRX, hoopRY);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = st.hoop;
      ctx.lineWidth = 6;
      ellipse(ctx, hoopX, hoopY, hoopRX, hoopRY);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(hoopX, hoopY - 2, hoopRX - 4, hoopRY - 4, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    });
  }

  makeCoin(currency, note) {
    const s = 82;
    this.canvas(noteKey(currency, note), s, s, (ctx) => {
      const c = s / 2;
      const r = 32;
      withShadow(ctx, () => {
        ctx.fillStyle = '#ffffff';
        circle(ctx, c, c, r + 4);
        ctx.fill();
      });
      ctx.fillStyle = note.dark;
      circle(ctx, c, c, r);
      ctx.fill();
      ctx.fillStyle = note.ring ?? note.color;
      circle(ctx, c, c, r - 3);
      ctx.fill();
      const g = ctx.createRadialGradient(c - 10, c - 12, 4, c, c, r);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.35, note.color);
      g.addColorStop(1, note.dark);
      ctx.fillStyle = g;
      circle(ctx, c, c, r - 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      circle(ctx, c, c, r - 8);
      ctx.stroke();
      label(ctx, currency.format(note.value), c, c + 1, 17, '#ffffff');
    });
  }

  makeBill(currency, note) {
    const w = 122;
    const h = 70;
    this.canvas(noteKey(currency, note), w, h, (ctx) => {
      const x = 6;
      const y = 5;
      const bw = w - 12;
      const bh = h - 14;
      withShadow(ctx, () => {
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, x - 4, y - 4, bw + 8, bh + 8, 10);
        ctx.fill();
      });
      const g = ctx.createLinearGradient(x, y, x + bw, y + bh);
      g.addColorStop(0, lighten(note.color));
      g.addColorStop(0.5, note.color);
      g.addColorStop(1, note.dark);
      ctx.fillStyle = g;
      roundRect(ctx, x, y, bw, bh, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      roundRect(ctx, x + 5, y + 5, bw - 10, bh - 10, 5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      circle(ctx, x + 24, y + bh / 2, 13);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.stroke();
      // Diagonal shine.
      ctx.save();
      roundRect(ctx, x, y, bw, bh, 7);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.moveTo(x + 50, y);
      ctx.lineTo(x + 72, y);
      ctx.lineTo(x + 40, y + bh);
      ctx.lineTo(x + 18, y + bh);
      ctx.fill();
      ctx.restore();
      label(ctx, currency.format(note.value), x + bw / 2 + 12, y + bh / 2 + 1, 21, '#ffffff');
    });
  }

  makeBomb() {
    this.canvas('bomb', 90, 98, (ctx) => {
      const cx = 45;
      const cy = 56;
      withShadow(ctx, () => {
        ctx.fillStyle = '#ffffff';
        circle(ctx, cx, cy, 34);
        ctx.fill();
      });
      const g = ctx.createRadialGradient(cx - 12, cy - 14, 3, cx, cy, 31);
      g.addColorStop(0, '#6a6a7a');
      g.addColorStop(0.4, '#26262e');
      g.addColorStop(1, '#050507');
      ctx.fillStyle = g;
      circle(ctx, cx, cy, 31);
      ctx.fill();
      ctx.fillStyle = '#3a3a44';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      roundRect(ctx, cx - 10, cy - 41, 20, 13, 3);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#c9a26b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 41);
      ctx.quadraticCurveTo(cx + 10, cy - 56, cx + 22, cy - 50);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      circle(ctx, cx - 11, cy - 11, 7);
      ctx.fill();
    });
  }

  makeGlow(key, color) {
    this.canvas(key, 140, 140, (ctx) => {
      const g = ctx.createRadialGradient(70, 70, 4, 70, 70, 70);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 140, 140);
    });
  }

  makeBoost(key, text, color) {
    this.canvas(key, 84, 84, (ctx) => {
      withShadow(ctx, () => {
        ctx.fillStyle = '#ffffff';
        circle(ctx, 42, 42, 36);
        ctx.fill();
      });
      const g = ctx.createRadialGradient(32, 30, 4, 42, 42, 32);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.3, color);
      g.addColorStop(1, '#0b1a4a');
      ctx.fillStyle = g;
      circle(ctx, 42, 42, 32);
      ctx.fill();
      label(ctx, text, 42, 44, 28, '#ffffff');
    });
  }

  makeSpark() {
    this.canvas('spark', 14, 14, (ctx) => {
      ctx.fillStyle = '#ffffff';
      circle(ctx, 7, 7, 7);
      ctx.fill();
    });
  }

  makeStar() {
    this.canvas('star', 24, 24, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? 12 : 3.5;
        const a = (i * Math.PI) / 4;
        ctx.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    });
  }

  makeSmoke() {
    this.canvas('smoke', 48, 48, (ctx) => {
      const g = ctx.createRadialGradient(24, 24, 2, 24, 24, 24);
      g.addColorStop(0, 'rgba(60,60,70,0.9)');
      g.addColorStop(1, 'rgba(60,60,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 48, 48);
    });
  }

  // In-level protection (3 bomb hits). Hearts are only used for lives, so players don't mix them up.
  makeShield() {
    this.canvas('shield', 44, 50, (ctx) => {
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(22, 4);
        ctx.lineTo(40, 10);
        ctx.quadraticCurveTo(40, 34, 22, 46);
        ctx.quadraticCurveTo(4, 34, 4, 10);
        ctx.closePath();
      };
      withShadow(ctx, () => {
        path();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      });
      ctx.save();
      ctx.translate(22, 25);
      ctx.scale(0.82, 0.82);
      ctx.translate(-22, -25);
      path();
      const g = ctx.createLinearGradient(0, 4, 0, 46);
      g.addColorStop(0, '#7fd0ff');
      g.addColorStop(1, '#1f5fa8');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(22, 10);
      ctx.lineTo(33, 14);
      ctx.quadraticCurveTo(33, 22, 22, 26);
      ctx.closePath();
      ctx.fill();
    });
  }

  makeSun() {
    this.canvas('sun', 180, 180, (ctx) => {
      const g = ctx.createRadialGradient(90, 90, 10, 90, 90, 90);
      g.addColorStop(0, 'rgba(255,255,230,1)');
      g.addColorStop(0.45, 'rgba(255,236,140,1)');
      g.addColorStop(0.55, 'rgba(255,220,100,0.6)');
      g.addColorStop(1, 'rgba(255,220,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 180, 180);
    });
  }

  makeRays() {
    const s = 1100;
    this.canvas('rays', s, s, (ctx) => {
      const c = s / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.lineTo(c + Math.cos(a - 0.09) * c, c + Math.sin(a - 0.09) * c);
        ctx.lineTo(c + Math.cos(a + 0.09) * c, c + Math.sin(a + 0.09) * c);
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  makeMoon() {
    this.canvas('moon', 160, 160, (ctx) => {
      const glow = ctx.createRadialGradient(80, 80, 30, 80, 80, 80);
      glow.addColorStop(0, 'rgba(255,250,220,0.55)');
      glow.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 160, 160);
      ctx.fillStyle = '#fff6d5';
      circle(ctx, 80, 80, 40);
      ctx.fill();
      ctx.fillStyle = 'rgba(200,190,150,0.45)';
      [[66, 70, 8], [92, 92, 6], [88, 64, 4], [70, 96, 5]].forEach(([x, y, r]) => {
        circle(ctx, x, y, r);
        ctx.fill();
      });
    });
  }

  // Original city skyline (generic buildings + palms), drawn in code.
  makeSkyline() {
    const w = 540;
    const h = 300;
    this.canvas('skyline', w, h, (ctx) => {
      const base = '#24123f';
      const buildings = [
        [0, 150, 60], [55, 110, 48], [100, 175, 70], [165, 95, 40], [200, 205, 62],
        [258, 130, 54], [308, 240, 46], [350, 160, 66], [412, 120, 44], [452, 185, 58], [505, 140, 40],
      ];
      ctx.fillStyle = base;
      buildings.forEach(([x, bh, bw]) => ctx.fillRect(x, h - bh, bw, bh));
      // antenna on the tallest tower
      ctx.fillRect(329, h - 275, 4, 36);
      // lit windows
      buildings.forEach(([x, bh, bw], i) => {
        for (let wy = h - bh + 14; wy < h - 16; wy += 20) {
          for (let wx = x + 8; wx < x + bw - 10; wx += 14) {
            if ((wx * 7 + wy * 3 + i) % 5 < 2) continue;
            ctx.fillStyle = (wx + wy) % 3 === 0 ? 'rgba(255,214,110,0.95)' : 'rgba(255,180,80,0.7)';
            ctx.fillRect(wx, wy, 6, 8);
          }
        }
      });
      // palm trees in front
      const palm = (px, ph) => {
        ctx.strokeStyle = '#140a26';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px, h);
        ctx.quadraticCurveTo(px + 12, h - ph / 2, px + 6, h - ph);
        ctx.stroke();
        ctx.fillStyle = '#140a26';
        for (let a = 0; a < 6; a++) {
          const ang = -Math.PI / 2 + (a - 2.5) * 0.55;
          ctx.beginPath();
          ctx.ellipse(px + 6 + Math.cos(ang) * 26, h - ph + Math.sin(ang) * 14 + 6, 30, 7, ang, 0, Math.PI * 2);
          ctx.fill();
        }
      };
      palm(40, 170);
      palm(480, 150);
      // ground strip
      ctx.fillStyle = '#140a26';
      ctx.fillRect(0, h - 14, w, 14);
    });
  }

  // Small picture of each sky for the shop cards.
  makeSkyPreview(key, t) {
    const w = 200;
    const h = 120;
    const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
    this.canvas(`prev_${key}`, w, h, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, hex(t.top));
      g.addColorStop(1, hex(t.bottom));
      ctx.fillStyle = g;
      roundRect(ctx, 0, 0, w, h, 14);
      ctx.fill();
      ctx.save();
      roundRect(ctx, 0, 0, w, h, 14);
      ctx.clip();
      if (t.stars) {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 22; i++) ctx.fillRect((i * 37) % w, (i * 23) % 70, 2, 2);
      }
      const bx = w * t.body.x;
      const by = Math.min(h - 30, (t.body.y / 960) * h * 1.6 + 14);
      ctx.fillStyle = t.body.key === 'moon' ? '#fff6d5' : hex(t.body.tint === 0xffffff ? 0xffe066 : t.body.tint);
      circle(ctx, bx, by, t.body.key === 'moon' ? 13 : 17);
      ctx.fill();
      if (t.skyline) {
        ctx.fillStyle = '#24123f';
        [[0, 30, 22], [20, 46, 18], [40, 26, 26], [64, 54, 16], [80, 36, 24], [104, 62, 18], [122, 40, 26], [148, 50, 20], [168, 32, 32]]
          .forEach(([x, bh, bw]) => ctx.fillRect(x, h - bh, bw, bh));
        ctx.fillStyle = 'rgba(255,214,110,0.9)';
        for (let i = 0; i < 24; i++) ctx.fillRect(4 + ((i * 31) % 190), h - 8 - ((i * 13) % 34), 3, 4);
      } else {
        ctx.fillStyle = hex(t.hills[0]);
        ctx.beginPath();
        ctx.ellipse(50, h + 8, 110, 34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hex(t.hills[1]);
        ctx.beginPath();
        ctx.ellipse(160, h + 12, 120, 36, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  makeCloud() {
    this.canvas('cloud', 240, 120, (ctx) => {
      const puffs = [
        [60, 74, 34],
        [104, 56, 44],
        [152, 62, 38],
        [190, 80, 28],
        [120, 86, 36],
      ];
      ctx.fillStyle = 'rgba(160,190,220,0.45)';
      puffs.forEach(([x, y, r]) => {
        circle(ctx, x + 4, y + 8, r);
        ctx.fill();
      });
      ctx.fillStyle = '#ffffff';
      puffs.forEach(([x, y, r]) => {
        circle(ctx, x, y, r);
        ctx.fill();
      });
    });
  }
}

function withShadow(ctx, draw) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 4;
  draw();
  ctx.restore();
}

function label(ctx, text, x, y, size, color) {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(20,10,40,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v) => Math.min(255, Math.round(v + (255 - v) * 0.4));
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}
