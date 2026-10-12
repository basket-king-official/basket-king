import Phaser from 'phaser';
import { CURRENCIES, noteLabel } from '../config/currency.js';
import { FONT, COLORS } from '../theme.js';

// All art is drawn in code for now, so there are no third-party assets to license.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeBasket();
    this.makeBomb();
    this.makeBoost('boost2x', '2X', COLORS.boost2x);
    this.makeBoost('boost3x', '3X', COLORS.boost3x);
    this.makeSpark();
    Object.values(CURRENCIES).forEach((c) => c.notes.forEach((n) => this.makeNote(c, n)));
    this.scene.start('Menu');
  }

  canvas(key, w, h, draw) {
    const tex = this.textures.createCanvas(key, w, h);
    draw(tex.getContext(), w, h);
    tex.refresh();
  }

  makeBasket() {
    this.canvas('basket', 150, 90, (ctx, w, h) => {
      // Woven panier: trapezoid body, weave lines, thick rim.
      ctx.fillStyle = '#b8742f';
      ctx.beginPath();
      ctx.moveTo(6, 16);
      ctx.lineTo(w - 6, 16);
      ctx.lineTo(w - 22, h - 4);
      ctx.lineTo(22, h - 4);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = '#8a5220';
      ctx.lineWidth = 3;
      for (let y = 28; y < h; y += 13) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let x = -40; x < w + 40; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 16);
        ctx.lineTo(x + 18, h);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = '#e0a050';
      ctx.fillRect(0, 8, w, 14);
      ctx.strokeStyle = '#8a5220';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 9.5, w - 3, 11);
    });
  }

  makeNote(currency, note) {
    const key = `note_${currency.code}_${note.value}`;
    this.canvas(key, 96, 52, (ctx, w, h) => {
      ctx.fillStyle = note.color;
      roundRect(ctx, 2, 2, w - 4, h - 4, 7);
      ctx.fill();
      ctx.strokeStyle = note.dark;
      ctx.lineWidth = 3;
      roundRect(ctx, 6, 6, w - 12, h - 12, 5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(20, h / 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 17px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(noteLabel(currency, note.value), w / 2 + 8, h / 2 + 1);
    });
  }

  makeBomb() {
    this.canvas('bomb', 64, 72, (ctx) => {
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(32, 42, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#555';
      ctx.fillRect(25, 10, 14, 10);
      ctx.strokeStyle = '#c9a26b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(32, 10);
      ctx.quadraticCurveTo(40, 0, 48, 6);
      ctx.stroke();
      ctx.fillStyle = '#ffb000';
      ctx.beginPath();
      ctx.arc(49, 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(23, 33, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  makeBoost(key, label, color) {
    this.canvas(key, 64, 64, (ctx) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(32, 32, 29, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 24px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 32, 34);
    });
  }

  makeSpark() {
    this.canvas('spark', 12, 12, (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(6, 6, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  }
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
