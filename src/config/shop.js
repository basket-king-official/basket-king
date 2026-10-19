// Net looks for the shop. Prices/names come from the server (shop_items table);
// these are only the visuals + fallback names. Keep the ids in sync with supabase/003_shop.sql.
export const NET_STYLES = {
  net_classic: {
    name: 'Classic Net',
    meshFill: 'rgba(255,255,255,0.22)',
    mesh: 'rgba(255,255,255,0.9)',
    hoop: '#ffd23f',
    glow: 'rgba(255,210,63,0.95)',
    handle: '#c98a3c',
    grip: '#6b3d14',
  },
  net_gold: {
    name: 'Golden Net',
    meshFill: 'rgba(255,215,90,0.35)',
    mesh: 'rgba(255,226,120,0.95)',
    hoop: '#ffe066',
    glow: 'rgba(255,200,40,1)',
    handle: '#e0b030',
    grip: '#8a6200',
  },
  net_royal: {
    name: 'Royal Net',
    meshFill: 'rgba(190,140,255,0.3)',
    mesh: 'rgba(225,200,255,0.95)',
    hoop: '#b46bff',
    glow: 'rgba(170,90,255,1)',
    handle: '#5b2a8c',
    grip: '#ffd23f',
  },
  net_fire: {
    name: 'Fire Net',
    meshFill: 'rgba(255,120,40,0.32)',
    mesh: 'rgba(255,190,90,0.95)',
    hoop: '#ff5a1f',
    glow: 'rgba(255,70,0,1)',
    handle: '#3a1a10',
    grip: '#ff9a1f',
  },
};

export const netTextureKey = (id) => (NET_STYLES[id] ? id : 'net_classic');

// Sky themes for the game background. sky_day is the free default.
// Colors are numbers (0xRRGGBB) for Phaser; keep ids in sync with supabase/003_shop.sql.
export const SKY_THEMES = {
  sky_day: {
    name: 'Sunny Day',
    top: 0x5fbfff,
    bottom: 0xfff6dc,
    body: { key: 'sun', x: 0.82, y: 60, scale: 1.2, tint: 0xffffff },
    rays: 0.9,
    cloud: { tint: 0xffffff, alpha: 0.95 },
    hills: [0x7fd65a, 0x5cc04a],
  },
  sky_sunset: {
    name: 'Sunset Sky',
    top: 0xff6f61,
    bottom: 0xffd28a,
    body: { key: 'sun', x: 0.5, y: 560, scale: 2.1, tint: 0xffb36b },
    rays: 0.35,
    cloud: { tint: 0xffc6b0, alpha: 0.85 },
    hills: [0x7a8f3a, 0x5f7a2e],
  },
  sky_night: {
    name: 'Night Sky',
    top: 0x070b26,
    bottom: 0x2e2c6e,
    body: { key: 'moon', x: 0.76, y: 290, scale: 1.1, tint: 0xffffff },
    rays: 0,
    stars: true,
    cloud: { tint: 0x8a90c8, alpha: 0.3 },
    hills: [0x1f4d3a, 0x163b2c],
  },
  sky_douala: {
    name: 'Douala Evening',
    top: 0x2d1b5e,
    bottom: 0xff9a5a,
    body: { key: 'sun', x: 0.28, y: 640, scale: 1.7, tint: 0xff8a3a },
    rays: 0.25,
    cloud: { tint: 0xffb08a, alpha: 0.6 },
    skyline: true,
  },
};

export const skyThemeId = (id) => (SKY_THEMES[id] ? id : 'sky_day');
