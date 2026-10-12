import { averageNoteValue } from './currency.js';

// All difficulty numbers live here so they are easy to tune after playtesting.
export function levelConfig(level, currency) {
  const n = Math.max(1, level);
  const catchesNeeded = 10 + Math.floor(n * 1.3);
  const minNote = currency.notes[0].value;
  const rawTarget = catchesNeeded * averageNoteValue(currency);

  return {
    level: n,
    timeLimit: Math.max(30, 45 - Math.floor(((n - 1) * 5) / 9)), // L1 45s, L10 40s, floor 30s
    target: Math.ceil(rawTarget / minNote) * minNote,
    lives: 3,
    fallSpeed: Math.min(900, 230 + n * 16), // px per second
    speedJitter: 0.15,
    spawnEveryMs: Math.max(260, 900 - n * 20),
    bombChance: Math.min(0.38, 0.12 + n * 0.007),
    boost2xChance: n >= 3 ? 0.035 : 0,
    boost3xChance: n >= 20 ? 0.02 : 0,
    boostDurationMs: 10000,
  };
}
