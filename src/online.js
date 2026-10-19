// Online features: silent guest account + daily/weekly leaderboard (Supabase).
// The game never depends on this: if anything fails (offline, server down) it keeps working.
import { createClient } from '@supabase/supabase-js';
import { load, save } from './storage.js';

// Public values — safe in the browser. Database rules (supabase/*.sql) protect the data.
const SUPABASE_URL = 'https://jwdhvkodpeqxoyrgenpc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0rNc2fdDBJbxhShyRO8YNg_fKWcPLQk';
const TIMEOUT_MS = 8000;

let client = null;
let profile = null;
let initPromise = null;

function withTimeout(promise, ms = TIMEOUT_MS) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('Network timeout')), ms))]);
}

function getClient() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bk_auth' },
    });
  }
  return client;
}

async function rpc(name, args) {
  const { data, error } = await withTimeout(getClient().rpc(name, args));
  if (error) throw new Error(error.message || 'Server error');
  return data;
}

// Signs in as a guest (once per device) and loads the profile. Safe to call many times.
export function initOnline() {
  if (!initPromise) {
    initPromise = (async () => {
      const sb = getClient();
      const { data } = await withTimeout(sb.auth.getSession());
      if (!data?.session) {
        const { error } = await withTimeout(sb.auth.signInAnonymously());
        if (error) throw error;
      }
      profile = await rpc('ensure_profile', { p_claim_level: load('level', 1) });
      // Same account on a new device: continue from the furthest level.
      if (profile?.max_level > load('level', 1)) save('level', profile.max_level);
      rpc('shop_state').then(setShopState).catch(() => {}); // warm the shop cache (coins, net, boosts)
      return profile;
    })().catch((err) => {
      console.warn('Online features unavailable:', err?.message || err);
      initPromise = null; // allow a retry later
      return null;
    });
  }
  return initPromise;
}

export function getProfile() {
  return profile;
}

// Points = money caught in units of the smallest coin (100F, ₦10, $1), so every currency ranks the same.
export function toPoints(score, currency) {
  return Math.round(score / currency.notes[0].value);
}

export function pointsToMoney(points, currency) {
  return currency.format(points * currency.notes[0].value);
}

// Fire-and-forget at the end of a level. Resolves to the updated profile, or null.
export async function submitRun({ level, points, won, mode }) {
  try {
    if (!(await initOnline())) return null;
    profile = await rpc('submit_run', { p_level: level, p_points: points, p_won: won, p_mode: mode });
    if (shopState) setShopState({ ...shopState, coins: profile.coins });
    return profile;
  } catch (err) {
    console.warn('Score not sent:', err.message);
    return null;
  }
}

// period: 'day' | 'week'. Returns [{rank, display_name, points, is_me}] or throws.
export async function fetchLeaderboard(period, limit = 50) {
  if (!(await initOnline())) throw new Error('offline');
  return rpc('get_leaderboard', { p_period: period, p_limit: limit });
}

// Returns the new profile, or throws with a player-friendly message.
export async function setDisplayName(name) {
  if (!(await initOnline())) throw new Error('You are offline');
  profile = await rpc('set_display_name', { p_name: name });
  return profile;
}

// Time until the board resets (Cameroon time, UTC+1, no daylight saving).
export function msUntilReset(period) {
  const OFFSET = 60 * 60 * 1000;
  const local = new Date(Date.now() + OFFSET); // read with getUTC* = Douala wall clock
  const next = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1));
  if (period === 'week') {
    const daysToMonday = (8 - next.getUTCDay()) % 7; // next is tomorrow; 0 if tomorrow is Monday
    next.setUTCDate(next.getUTCDate() + daysToMonday);
  }
  return next.getTime() - local.getTime();
}

export function formatDuration(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${m % 60}m`;
}

// ============ SHOP ============
// Shop state: { coins, equipped_net, items:[{id,kind,name,price}], inventory:{id:qty} }.
// The last known state is cached on the device so the game can show the equipped net and
// boosts even before the server answers (or when offline).
let shopState = load('shop', null);

function setShopState(state) {
  if (state) {
    shopState = state;
    save('shop', state);
    if (profile) profile = { ...profile, coins: state.coins, equipped_net: state.equipped_net };
  }
  return shopState;
}

export function getShopState() {
  return shopState;
}

export function coinsForRun(points, won) {
  return Math.floor(Math.max(points, 0) / 10) + (won ? 5 : 0); // same formula as coins_for_run() on the server
}

export async function refreshShop() {
  if (!(await initOnline())) throw new Error('You are offline');
  return setShopState(await rpc('shop_state'));
}

export async function buyItem(id) {
  if (!(await initOnline())) throw new Error('You are offline');
  return setShopState(await rpc('buy_item', { p_item: id }));
}

export async function equipSky(id) {
  if (!(await initOnline())) throw new Error('You are offline');
  return setShopState(await rpc('equip_sky', { p_item: id }));
}

export async function equipNet(id) {
  if (!(await initOnline())) throw new Error('You are offline');
  return setShopState(await rpc('equip_net', { p_item: id }));
}

// Boosts are used during a level: update the local count at once, confirm with the server in the background.
export function useBoost(id) {
  const left = shopState?.inventory?.[id] ?? 0;
  if (left <= 0) return false;
  setShopState({ ...shopState, inventory: { ...shopState.inventory, [id]: left - 1 } });
  initOnline()
    .then((ok) => ok && rpc('use_item', { p_item: id }))
    .then((state) => state && setShopState(state))
    .catch((err) => console.warn('Boost not synced:', err.message));
  return true;
}
