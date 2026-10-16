// WhatsApp share after a level: opens WhatsApp (app on phones, web on laptops) with a ready message.
export function shareOnWhatsApp({ score, level, won }) {
  const url = window.location.origin;
  const line = won
    ? `👑 I caught ${score} and cleared Level ${level} in BASKET MONEY KING! Can you beat me?`
    : `👑 I caught ${score} on Level ${level} in BASKET MONEY KING! Can you beat me?`;
  const text = `${line} 👉 ${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
