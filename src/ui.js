import { W, H, COLORS, textStyle } from './theme.js';
import { SKY_THEMES, skyThemeId } from './config/shop.js';

// Sky background. theme = one of SKY_THEMES (sky_day is the free default).
export function drawSky(scene, { hills = true, theme = 'sky_day' } = {}) {
  const t = SKY_THEMES[skyThemeId(theme)];
  const g = scene.add.graphics();
  g.fillGradientStyle(t.top, t.top, t.bottom, t.bottom, 1);
  g.fillRect(0, 0, W, H);

  if (t.stars) {
    for (let i = 0; i < 46; i++) {
      const x = (i * 137.5) % W;
      const y = 20 + ((i * 89) % 560);
      const star = scene.add.circle(x, y, i % 5 === 0 ? 2.6 : 1.6, 0xffffff, 0.9);
      scene.tweens.add({ targets: star, alpha: 0.2, duration: 900 + (i % 7) * 260, yoyo: true, repeat: -1, delay: (i % 9) * 150 });
    }
  }
  if (t.rays > 0) {
    const rays = scene.add.image(W * t.body.x, t.body.y, 'rays').setAlpha(t.rays).setTint(t.body.tint);
    scene.tweens.add({ targets: rays, angle: 360, duration: 70000, repeat: -1 });
  }
  scene.add.image(W * t.body.x, t.body.y, t.body.key).setScale(t.body.scale).setTint(t.body.tint);

  for (let i = 0; i < 4; i++) {
    const cloud = scene.add
      .image(-200 + i * 220, 170 + ((i * 97) % 260), 'cloud')
      .setScale(0.55 + (i % 3) * 0.2)
      .setAlpha(t.cloud.alpha)
      .setTint(t.cloud.tint);
    scene.tweens.add({
      targets: cloud,
      x: W + 200,
      duration: 40000 + i * 9000,
      repeat: -1,
      onRepeat: () => (cloud.x = -200),
    });
  }

  if (t.skyline) {
    scene.add.image(W / 2, H, 'skyline').setOrigin(0.5, 1);
  } else if (hills) {
    const h = scene.add.graphics();
    h.fillStyle(t.hills[0], 1);
    h.fillEllipse(110, H + 30, 520, 260);
    h.fillStyle(t.hills[1], 1);
    h.fillEllipse(440, H + 50, 560, 280);
  }
}

export function button(scene, x, y, label, onClick, { width = 380, height = 82, fill = 0xffd23f, textColor = '#3a1d00' } = {}) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.25);
  g.fillRoundedRect(-width / 2 + 3, -height / 2 + 8, width, height, 24);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(-width / 2, -height / 2, width, height, 24);
  g.fillStyle(0xffffff, 0.35);
  g.fillRoundedRect(-width / 2 + 10, -height / 2 + 7, width - 20, height * 0.36, 16);
  g.lineStyle(5, 0x1a1030, 1);
  g.strokeRoundedRect(-width / 2, -height / 2, width, height, 24);
  const txt = scene.add.text(0, 2, label, textStyle(30, textColor, { strokeThickness: 0 })).setOrigin(0.5);
  const c = scene.add.container(x, y, [g, txt]).setSize(width, height).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => c.setScale(0.95));
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => {
    c.setScale(1);
    onClick();
  });
  return c;
}

export function toast(scene, message, ms = 2600) {
  scene._toast?.destroy(); // only one message at a time
  const t = (scene._toast = scene.add
    .text(W / 2, H - 170, message, {
      ...textStyle(21),
      backgroundColor: 'rgba(20,10,40,0.95)',
      padding: { x: 16, y: 10 },
      align: 'center',
      wordWrap: { width: W - 60 },
    })
    .setOrigin(0.5)
    .setDepth(1000));
  scene.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 400, onComplete: () => t.destroy() });
}
