// Hand tracking runs here, in a background worker, so the game never freezes while frames are analysed.
// Classic worker (not a module) because MediaPipe loads its wasm with importScripts().
//
// Speed: phones differ a lot — on some the GPU is much faster, on others the CPU is. On first run we
// try both for a few frames and keep the faster one; the page remembers the choice for next time.
self.exports = {};
self.module = { exports: self.exports };
importScripts('/mediapipe/vision_bundle.js');
const { FilesetResolver, HandLandmarker } = self.module.exports;

const TRIAL_WARMUP = 3; // first frames of each delegate are always slow — not counted
const TRIAL_FRAMES = 8;
const GPU_ABORT_MS = 150; // a GPU frame slower than this (after warm-up) ends the GPU trial at once
const GPU_TRIAL_MAX_MS = 3000;
const GPU_MUST_BE = 0.6; // GPU is only chosen if it takes at most 60% of the CPU time

let fileset = null;
let landmarkers = {}; // { GPU, CPU }
let active = null; // 'GPU' | 'CPU'
let phase = 'done'; // 'CPU' trial → 'GPU' trial → 'done' (CPU first: it never slows the game's graphics)
let gpuTrialStart = 0;
const trial = { GPU: { ms: [], found: 0 }, CPU: { ms: [], found: 0 } };

async function create(delegate) {
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: new URL('/models/hand_landmarker.task', self.location.origin).href,
      delegate,
    },
    // The GPU path needs its own canvas inside the worker.
    ...(delegate === 'GPU' ? { canvas: new OffscreenCanvas(1, 1) } : {}),
    runningMode: 'VIDEO',
    numHands: 1,
    // Slightly more forgiving than the defaults so the hand isn't dropped in average room lighting.
    minHandDetectionConfidence: 0.4,
    minHandPresenceConfidence: 0.4,
    minTrackingConfidence: 0.4,
  });
}

async function tryCreate(delegate) {
  try {
    landmarkers[delegate] = await create(delegate);
    return true;
  } catch (err) {
    return false;
  }
}

function median(list) {
  const s = [...list].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function finishTrial(gpuAborted = false) {
  const g = trial.GPU;
  const c = trial.CPU;
  const gMs = gpuAborted || g.ms.length <= TRIAL_WARMUP ? Infinity : median(g.ms.slice(TRIAL_WARMUP));
  const cMs = median(c.ms.slice(TRIAL_WARMUP));
  // GPU only if clearly faster — it shares the graphics chip with the game — and never a GPU that sees nothing.
  let pick = gMs <= cMs * GPU_MUST_BE ? 'GPU' : 'CPU';
  if (pick === 'GPU' && g.found === 0 && c.found > 0) pick = 'CPU';
  const other = pick === 'GPU' ? 'CPU' : 'GPU';
  landmarkers[other]?.close();
  delete landmarkers[other];
  active = pick;
  phase = 'done';
  self.postMessage({ type: 'chosen', delegate: pick, gpuMs: isFinite(gMs) ? Math.round(gMs) : null, cpuMs: Math.round(cMs) });
}

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      fileset = await FilesetResolver.forVisionTasks(new URL('/mediapipe/wasm', self.location.origin).href);
      const preferred = msg.preferred === 'GPU' || msg.preferred === 'CPU' ? msg.preferred : null;
      if (preferred) {
        // Choice remembered from an earlier run — no trial needed.
        if (await tryCreate(preferred)) active = preferred;
        else if (await tryCreate(preferred === 'GPU' ? 'CPU' : 'GPU')) active = preferred === 'GPU' ? 'CPU' : 'GPU';
      } else {
        const hasCpu = await tryCreate('CPU');
        const hasGpu = typeof OffscreenCanvas !== 'undefined' && (await tryCreate('GPU'));
        if (hasGpu && hasCpu) {
          active = 'CPU';
          phase = 'CPU';
        } else {
          active = hasGpu ? 'GPU' : hasCpu ? 'CPU' : null;
        }
      }
      if (!active) throw new Error('Hand tracking could not start on this device');
      self.postMessage({ type: 'ready', delegate: active, trial: phase !== 'done' });
    } catch (err) {
      self.postMessage({ type: 'error', message: String((err && err.message) || err) });
    }
    return;
  }

  if (msg.type === 'frame') {
    const { bitmap, ts } = msg;
    let landmarks = null;
    const used = active;
    const t0 = performance.now();
    const lm = landmarkers[used];
    if (lm) {
      try {
        const result = lm.detectForVideo(bitmap, ts);
        const hand = result.landmarks && result.landmarks[0];
        if (hand) landmarks = hand.map((p) => ({ x: p.x, y: p.y }));
      } catch (err) {
        /* skip this frame */
      }
    }
    bitmap.close();
    const ms = performance.now() - t0;

    if (phase === used) {
      const t = trial[used];
      t.ms.push(ms);
      if (landmarks) t.found += 1;
      if (used === 'GPU') {
        const tooSlow = t.ms.length > TRIAL_WARMUP && ms > GPU_ABORT_MS;
        const tooLong = performance.now() - gpuTrialStart > GPU_TRIAL_MAX_MS;
        if (tooSlow || tooLong) finishTrial(true);
        else if (t.ms.length >= TRIAL_WARMUP + TRIAL_FRAMES) finishTrial();
      } else if (t.ms.length >= TRIAL_WARMUP + TRIAL_FRAMES) {
        phase = 'GPU';
        active = 'GPU';
        gpuTrialStart = performance.now();
      }
    }

    self.postMessage({ type: 'result', ms, landmarks, delegate: used });
  }
};
