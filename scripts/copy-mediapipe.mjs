// Copies MediaPipe's runtime files from node_modules into public/mediapipe so the game
// hosts them itself (no CDN needed). Runs automatically after `npm install` / `npm ci`.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision');
const dest = join(root, 'public', 'mediapipe');

mkdirSync(join(dest, 'wasm'), { recursive: true });
// The worker is a classic script, so it loads the CommonJS build; .js extension keeps the MIME type valid.
// Drop the source-map reference (the .map file isn't shipped, so browsers would log a 404).
const bundle = readFileSync(join(src, 'vision_bundle.cjs'), 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, '');
writeFileSync(join(dest, 'vision_bundle.js'), bundle);
cpSync(join(src, 'wasm'), join(dest, 'wasm'), { recursive: true });
console.log('MediaPipe files copied to public/mediapipe');
