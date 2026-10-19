import { averageNoteValue } from './currency.js';

// All difficulty numbers live here so they are easy to tune after playtesting.
export function levelConfig(level, currency) {
  const n = Math.max(1, level);
  // Grows 2 per level, stops at Level 40 so endless levels stay beatable (speed/bombs keep them hard).
  // Keep in sync with level_target_points() in supabase/002_level_rules.sql.
  const catchesNeeded = Math.min(100, 20 + n * 2);
  const step = currency.notes[0].value * 5;
  const target = Math.ceil((catchesNeeded * averageNoteValue(currency)) / step) * step; // L1 ≈ 10 000F

  return {
    level: n,
    timeLimit: Math.min(60, 45 + 5 * Math.floor((n - 1) / 10)), // L1-10 45s, +5s every 10 levels, max 60s from L31
    target,
    lives: 3,
    startSpeed: Math.min(700, 240 + n * 14), // px/s when an item appears
    gravity: Math.min(1100, 420 + n * 18), // px/s² — items accelerate as they fall
    spawnEveryMs: Math.max(230, 600 - n * 12), // L1 every 0.6s
    bombChance: Math.min(0.4, 0.18 + n * 0.006),
    cometChance: Math.min(0.65, 0.25 + n * 0.02), // share of items flying in at an angle from the sides
    boost2xChance: n >= 2 ? 0.03 : 0,
    boost3xChance: n >= 15 ? 0.02 : 0,
    boostDurationMs: 10000,
  };
}
