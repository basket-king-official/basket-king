import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// Keep the wasm version in sync with the npm package version.
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const MIN_INTERVAL_MS = 45; // at most ~22 detections per second
const BUSY_FACTOR = 1.5; // wait 1.5× the last detection time, so tracking never uses more than ~40% of the frame budget
const DETECT_WIDTH = 256; // frames are shrunk to this width before tracking (the camera display stays full quality)
const SLOW_SAMPLE_SIZE = 30;
const SLOW_AVG_MS = 220; // only give up on hand mode if the phone is really too slow

/**
 * Tracks one hand from the camera.
 * - x, y: palm centre in 0..1 of the video frame, already flipped to match what is shown on screen
 * - fist: true while the hand is closed
 * Uses the rear camera on phones (pointing away from the player) and the webcam on laptops.
 * Frames are processed on the device only and never stored or uploaded.
 */
class HandTracker {
  constructor() {
    this.x = 0.5;
    this.y = 0.7;
    this.visible = false;
    this.fist = false;
    this.ready = false;
    this.running = false;
    this.mirrored = false;
    this.facing = 'environment';
    this.onSlow = null;
    this._fistScore = 0;
    this._timings = [];
    this._lastRun = 0;
    this._lastVideoTime = -1;
    this._interval = MIN_INTERVAL_MS;
  }

  async start(videoEl) {
    this.video = videoEl;
    if (!this.ready) {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported on this browser');
      await this._openCamera(this.facing);
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const create = (delegate) =>
        HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      // CPU first: on phones the GPU is busy drawing the game and the camera, and sharing it causes freezes.
      try {
        this.landmarker = await create('CPU');
      } catch {
        this.landmarker = await create('GPU');
      }
      this._canvas = document.createElement('canvas');
      this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
      this.ready = true;
    } else if (!this.stream) {
      await this._openCamera(this.facing);
    }
    this.running = true;
    cancelAnimationFrame(this._raf);
    this._loop();
  }

  async _openCamera(facing) {
    this.stream?.getTracks().forEach((t) => t.stop());
    const size = { width: { ideal: 640 }, height: { ideal: 480 } };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { ...size, facingMode: { exact: facing } }, audio: false });
    } catch {
      // Laptops have no rear camera — take whatever camera exists.
      stream = await navigator.mediaDevices.getUserMedia({ video: { ...size, facingMode: facing }, audio: false });
    }
    this.stream = stream;
    const settings = stream.getVideoTracks()[0]?.getSettings?.() ?? {};
    // Laptop webcams usually report no facingMode; treat them as selfie cameras (mirrored).
    this.facing = settings.facingMode || 'user';
    this.mirrored = this.facing !== 'environment';
    this.video.srcObject = stream;
    this.video.classList.toggle('mirrored', this.mirrored);
    await this.video.play();
    this._lastVideoTime = -1;
    this.visible = false;
  }

  async switchCamera() {
    await this._openCamera(this.facing === 'environment' ? 'user' : 'environment');
  }

  _loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const v = this.video;
    if (now - this._lastRun >= this._interval && v.readyState >= 2 && v.videoWidth && v.currentTime !== this._lastVideoTime) {
      this._lastRun = now;
      this._lastVideoTime = v.currentTime;
      const t0 = performance.now();
      // Track on a small copy of the frame (same aspect ratio, so positions stay the same).
      const w = DETECT_WIDTH;
      const h = Math.round((v.videoHeight / v.videoWidth) * w);
      if (this._canvas.width !== w || this._canvas.height !== h) {
        this._canvas.width = w;
        this._canvas.height = h;
      }
      this._ctx.drawImage(v, 0, 0, w, h);
      const result = this.landmarker.detectForVideo(this._canvas, now);
      const took = performance.now() - t0;
      this._interval = Math.max(MIN_INTERVAL_MS, took * BUSY_FACTOR);
      this._recordTiming(took);

      const lm = result.landmarks?.[0];
      if (lm) {
        // Palm centre: wrist + base of index, middle and little fingers.
        const px = (lm[0].x + lm[5].x + lm[9].x + lm[17].x) / 4;
        const py = (lm[0].y + lm[5].y + lm[9].y + lm[17].y) / 4;
        this.x = this.mirrored ? 1 - px : px;
        this.y = py;
        this.visible = true;
        this._updateFist(lm);
      } else {
        this.visible = false;
        this._fistScore *= 0.5;
        this.fist = this._fistScore > 0.5;
      }
    }
    this._raf = requestAnimationFrame(this._loop);
  };

  // A finger counts as curled when its tip is closer to the wrist than its middle joint.
  _updateFist(lm) {
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const wrist = lm[0];
    let curled = 0;
    for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
      if (d(lm[tip], wrist) < d(lm[pip], wrist)) curled++;
    }
    // Smooth over a few frames so the net does not flicker.
    this._fistScore = this._fistScore * 0.55 + (curled >= 3 ? 1 : 0) * 0.45;
    this.fist = this._fistScore > 0.5;
  }

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
    this.stream = null;
    this.visible = false;
    this.fist = false;
  }
}

export const handTracker = new HandTracker();
