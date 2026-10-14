// Hand tracking runs here, in a background worker, so the game never freezes while frames are analysed.
// Classic worker (not a module) because MediaPipe loads its wasm with importScripts().
self.exports = {};
self.module = { exports: self.exports };
importScripts('/mediapipe/vision_bundle.js');
const { FilesetResolver, HandLandmarker } = self.module.exports;

let landmarker = null;

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      const fileset = await FilesetResolver.forVisionTasks(new URL('/mediapipe/wasm', self.location.origin).href);
      landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: new URL('/models/hand_landmarker.task', self.location.origin).href,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        // Slightly more forgiving than the defaults so the hand isn't dropped in average room lighting.
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: String((err && err.message) || err) });
    }
    return;
  }

  if (msg.type === 'frame') {
    const { bitmap, ts } = msg;
    let landmarks = null;
    const t0 = performance.now();
    if (landmarker) {
      try {
        const result = landmarker.detectForVideo(bitmap, ts);
        const lm = result.landmarks && result.landmarks[0];
        if (lm) landmarks = lm.map((p) => ({ x: p.x, y: p.y }));
      } catch (err) {
        /* skip this frame */
      }
    }
    bitmap.close();
    self.postMessage({ type: 'result', ms: performance.now() - t0, landmarks });
  }
};
