// Candy-Crush-style lives: failing a level costs one; one comes back every 20 minutes, up to 5.
// Stored on the device for V1 (moves to the player's account once login is added).
import { load, save } from './storage.js';

export const MAX_LIVES = 5;
export const REGEN_MS = 20 * 60 * 1000;

// { n: lives now, t: when the current refill countdown started }
function state() {
  const now = Date.now();
  const s = load('lives', null) ?? { n: MAX_LIVES, t: now };
  if (s.n >= MAX_LIVES) return { n: MAX_LIVES, t: now };
  const gained = Math.floor((now - s.t) / REGEN_MS);
  if (gained > 0) {
    s.n = Math.min(MAX_LIVES, s.n + gained);
    s.t = s.n >= MAX_LIVES ? now : s.t + gained * REGEN_MS;
    save('lives', s);
  }
  return s;
}

export function getLives() {
  return state().n;
}

export function msToNextLife() {
  const s = state();
  return s.n >= MAX_LIVES ? 0 : Math.max(0, REGEN_MS - (Date.now() - s.t));
}

export function loseLife() {
  const s = state();
  if (s.n >= MAX_LIVES) s.t = Date.now(); // countdown starts with the first lost life
  s.n = Math.max(0, s.n - 1);
  save('lives', s);
}

// For rewarded ads / shop refills later.
export function addLives(count = 1) {
  const s = state();
  s.n = Math.min(MAX_LIVES, s.n + count);
  if (s.n >= MAX_LIVES) s.t = Date.now();
  save('lives', s);
}

export function formatCountdown(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

export function heartsText(n) {
  return '♥'.repeat(n) + '♡'.repeat(MAX_LIVES - n);
}
