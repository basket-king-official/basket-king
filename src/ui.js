import { COLORS, textStyle } from './theme.js';

export function button(scene, x, y, label, onClick, { width = 360, color = 0xffd54a, textColor = '#1b1033' } = {}) {
  const bg = scene.add.rectangle(0, 0, width, 76, color).setStrokeStyle(4, 0xffffff, 0.25);
  const txt = scene.add.text(0, 0, label, textStyle(28, textColor)).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, txt]).setSize(width, 76).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => c.setScale(0.96));
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => {
    c.setScale(1);
    onClick();
  });
  return c;
}

export function toast(scene, message, ms = 2600) {
  const t = scene.add
    .text(scene.scale.width / 2, scene.scale.height - 140, message, {
      ...textStyle(20, COLORS.text),
      backgroundColor: 'rgba(0,0,0,0.75)',
      padding: { x: 16, y: 10 },
      align: 'center',
      wordWrap: { width: scene.scale.width - 60 },
    })
    .setOrigin(0.5)
    .setDepth(1000);
  scene.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 400, onComplete: () => t.destroy() });
}
