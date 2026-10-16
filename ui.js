import { W, H, COLORS, textStyle } from './theme.js';

// Bright sky with slowly turning sun rays, drifting clouds and green hills.
export function drawSky(scene, { hills = true } = {}) {
  const g = scene.add.graphics();
  g.fillGradientStyle(COLORS.skyTop, COLORS.skyTop, COLORS.skyBottom, COLORS.skyBottom, 1);
  g.fillRect(0, 0, W, H);

  const rays = scene.add.image(W * 0.82, 60, 'rays').setAlpha(0.9);
  scene.tweens.add({ targets: rays, angle: 360, duration: 70000, repeat: -1 });
  scene.add.image(W * 0.82, 60, 'sun').setScale(1.2);

  for (let i = 0; i < 4; i++) {
    const cloud = scene.add.image(-200 + i * 220, 170 + ((i * 97) % 260), 'cloud').setScale(0.55 + (i % 3) * 0.2).setAlpha(0.95);
    scene.tweens.add({
      targets: cloud,
      x: W + 200,
      duration: 40000 + i * 9000,
      repeat: -1,
      onRepeat: () => (cloud.x = -200),
    });
  }

  if (hills) {
    const h = scene.add.graphics();
    h.fillStyle(0x7fd65a, 1);
    h.fillEllipse(110, H + 30, 520, 260);
    h.fillStyle(0x5cc04a, 1);
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
  const t = scene.add
    .text(W / 2, H - 170, message, {
      ...textStyle(21),
      backgroundColor: 'rgba(20,10,40,0.95)',
      padding: { x: 16, y: 10 },
      align: 'center',
      wordWrap: { width: W - 60 },
    })
    .setOrigin(0.5)
    .setDepth(1000);
  scene.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 400, onComplete: () => t.destroy() });
}
