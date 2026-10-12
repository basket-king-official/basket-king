import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// Keep the wasm version in sync with the npm package version.
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const DETECT_INTERVAL_MS = 50; // ~20 detections per second is plenty for one X position
const SLOW_SAMPLE_SIZE = 30;
const SLOW_AVG_MS = 120; // slower than this on average → suggest touch mode

/**
 * Tracks one hand and exposes its horizontal position as `x` in 0..1
 * (already mirrored so moving your hand right moves the basket right).
 * Camera frames are processed on the device only and never stored or uploaded.
 */
class HandTracker {
  constructor() {
    this.x = 0.5;
    this.visible = false;
    this.ready = false;
    this.running = false;
    this.onSlow = null;
    this._timings = [];
    this._lastRun = 0;
    this._lastVideoTime = -1;
  }

  async start(videoEl) {
    if (this.ready) {
      this.running = true;
      this._loop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported on this browser');

    this.video = videoEl;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    const create = (delegate) =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    try {
      this.landmarker = await create('GPU');
    } catch {
      this.landmarker = await create('CPU');
    }

    this.ready = true;
    this.running = true;
    this._loop();
  }

  _loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const v = this.video;
    if (now - this._lastRun >= DETECT_INTERVAL_MS && v.readyState >= 2 && v.currentTime !== this._lastVideoTime) {
      this._lastRun = now;
      this._lastVideoTime = v.currentTime;
      const t0 = performance.now();
      const result = this.landmarker.detectForVideo(v, now);
      this._recordTiming(performance.now() - t0);

      const lm = result.landmarks?.[0];
      if (lm) {
        // Palm centre: wrist + base of index, middle and little fingers. Works with fist or open hand.
        const palmX = (lm[0].x + lm[5].x + lm[9].x + lm[17].x) / 4;
        const mirrored = 1 - palmX;
        // Hands rarely reach the frame edges, so map the middle 70% of the frame to the full screen.
        this.x = Math.min(1, Math.max(0, (mirrored - 0.15) / 0.7));
        this.visible = true;
      } else {
        this.visible = false;
      }
    }
    this._raf = requestAnimationFrame(this._loop);
  };

  _recordTiming(ms) {
    if (this._timings.length >= SLOW_SAMPLE_SIZE) return;
    this._timings.push(ms);
    if (this._timings.length === SLOW_SAMPLE_SIZE) {
      const avg = this._timings.reduce((a, b) => a + b, 0) / SLOW_SAMPLE_SIZE;
      if (avg > SLOW_AVG_MS && this.onSlow) this.onSlow(avg);
    }
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  stop() {
    this.pause();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.landmarker?.close();
    this.ready = false;
    this.visible = false;
  }
}

export const handTracker = new HandTracker();
