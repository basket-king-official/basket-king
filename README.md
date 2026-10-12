# Basket King

Catch the falling money with your hand, avoid the bombs. Browser game (V1).

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints. Camera needs `localhost` or HTTPS — to test on a phone, deploy to Netlify or use the HTTPS preview.

## Build / deploy

Netlify builds automatically from this repo (`netlify.toml`): `npm run build` → `dist/`.

## Structure

- `src/input/handTracker.js` — MediaPipe hand tracking (on-device only, nothing recorded). Falls back to touch mode if the camera fails or the phone is slow.
- `src/config/levels.js` — all difficulty numbers (time, target, speed, bombs, boosts).
- `src/config/currency.js` — stylized notes per currency (FCFA default, Naira, USD).
- `src/scenes/` — Boot (draws art), Menu, Game, Result.
