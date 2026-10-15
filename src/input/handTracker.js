// Hand tracking runs in a background worker (public/hand-worker.js) so the game never freezes.
// This file opens the camera, sends small frames to the worker and turns its answers into
// a hand position + fist state the game can read every frame.
import { load, save } from '../storage.js';

const DETECT_WIDTH = 320; // tracking frame width (the model works at 192–224px internally; the camera display stays full quality)
const LOST_GRACE_MS = 500; // keep the last hand position this long before deciding the hand is gone (no flicker)
const WARMUP_FRAMES = 5; // the first detections are always slow; ignore them for the speed check
const SLOW_SAMPLE_SIZE = 20;
const SLOW_MEDIAN_MS = 700; // only give up on hand mode if tracking is below ~1.5 updates per second
// Smooth motion between tracking updates: the net plays back the hand's path a little behind real time,
// gliding between the last two known positions (like online games do), so it never stops and jumps.
// Tuned in simulation at 5–15 updates/s: ~3× smoother than jumping, with little extra lag.
const INTERP_FACTOR = 0.8; // play back this many 'update gaps' behind real time
const INTERP_MIN_MS = 40;
const INTERP_MAX_MS = 250;
const EXTRAPOLATE_MAX_MS = 60; // if the next update is late, keep moving along the last direction this long
const SAMPLES_KEPT = 6;
const INIT_TIMEOUT_MS = 45000;

/**
 * Tracks one hand from the camera.
 * - position(): palm centre in 0..1 of the video frame, flipped to match the screen, with smoothing/prediction
 * - visible / fist: whether a hand is seen and whether it is closed
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
    this.lastMs = 0;
    this._fistScore = 0;
    this._busy = false;
    this._results = 0;
    this._timings = [];
    this._lastUpdate = 0;
    this._lastSeen = 0;
    this._samples = [];
  }

  async start(videoEl) {
    this.video = videoEl;
    if (!this.ready) {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported on this browser');
      if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') throw new Error('Browser too old for hand mode');
      await this._openCamera(this.facing);
      await this._initWorker();
      this.ready = true;
    } else if (!this.stream) {
      await this._openCamera(this.facing);
    }
    this.running = true;
    this._busy = false;
    cancelAnimationFrame(this._raf);
    this._pump();
  }

  _initWorker() {
    return new Promise((resolve, reject) => {
      const worker = new Worker('/hand-worker.js');
      this.worker = worker;
      const timer = setTimeout(() => reject(new Error('Hand tracking took too long to load')), INIT_TIMEOUT_MS);
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'ready') {
          clearTimeout(timer);
          this.delegate = m.delegate;
          this._trialDone = !m.trial;
          resolve();
        } else if (m.type === 'chosen') {
          // The worker measured GPU vs CPU on this phone — remember the faster one for next time.
          this.delegate = m.delegate;
          this._trialDone = true;
          if (!this._forced) save('delegate', m.delegate);
        } else if (m.type === 'error') {
          clearTimeout(timer);
          reject(new Error(m.message));
        } else if (m.type === 'result') {
          this._onResult(m);
        }
      };
      worker.onerror = (e) => {
        clearTimeout(timer);
        reject(new Error(e.message || 'Hand tracking worker failed'));
      };
      // ?track=cpu or ?track=gpu forces one (for testing); otherwise use the remembered choice, if any.
      const forced = new URLSearchParams(window.location.search).get('track')?.toUpperCase();
      this._forced = forced === 'CPU' || forced === 'GPU' ? forced : null;
      worker.postMessage({ type: 'init', preferred: this._forced ?? load('delegate', null) });
    });
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
    this.visible = false;
  }

  async switchCamera() {
    await this._openCamera(this.facing === 'environment' ? 'user' : 'environment');
  }

  // Sends one frame at a time: the next frame goes only after the worker answered,
  // so a slow phone never builds up a queue.
  _pump = async () => {
    if (!this.running) return;
    const v = this.video;
    if (!this._busy && this.worker && v.readyState >= 2 && v.videoWidth) {
      this._busy = true;
      try {
        const bitmap = await this._grabFrame(v);
        this.worker.postMessage({ type: 'frame', bitmap, ts: performance.now() }, [bitmap]);
      } catch {
        this._busy = false;
      }
    }
    this._raf = requestAnimationFrame(this._pump);
  };

  async _grabFrame(v) {
    const w = DETECT_WIDTH;
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    try {
      return await createImageBitmap(v, { resizeWidth: w, resizeHeight: h, resizeQuality: 'low' });
    } catch {
      // Older browsers can't resize while grabbing — shrink through a canvas instead.
      if (!this._canvas) {
        this._canvas = document.createElement('canvas');
        this._ctx = this._canvas.getContext('2d');
      }
      this._canvas.width = w;
      this._canvas.height = h;
      this._ctx.drawImage(v, 0, 0, w, h);
      return createImageBitmap(this._canvas);
    }
  }

  _onResult({ ms, landmarks, delegate }) {
    this._busy = false;
    this.lastMs = ms;
    if (delegate) this.delegate = delegate;
    // Simple stats for the ?debug readout.
    this._statFrames = (this._statFrames || 0) + 1;
    if (landmarks) this._statHands = (this._statHands || 0) + 1;
    const t = performance.now();
    if (!this._statStart) this._statStart = t;
    if (t - this._statStart >= 1000) {
      this.ratePerSec = Math.round((this._statFrames * 1000) / (t - this._statStart));
      this.handPct = Math.round((100 * (this._statHands || 0)) / this._statFrames);
      this._statFrames = 0;
      this._statHands = 0;
      this._statStart = t;
    }
    this._checkSpeed(ms);
    const now = performance.now();
    const lm = landmarks;
    if (lm) {
      // Palm centre: wrist + base of index, middle and little fingers.
      const px = (lm[0].x + lm[5].x + lm[9].x + lm[17].x) / 4;
      const py = (lm[0].y + lm[5].y + lm[9].y + lm[17].y) / 4;
      const x = this.mirrored ? 1 - px : px;
      if (!this.visible) this._samples = []; // hand just reappeared — don't glide from its old spot
      this._samples.push({ t: now, x, y: py });
      if (this._samples.length > SAMPLES_KEPT) this._samples.shift();
      this.x = x;
      this.y = py;
      this.visible = true;
      this._updateFist(lm);
      this._lastSeen = now;
    } else if (now - this._lastSeen > LOST_GRACE_MS) {
      this.visible = false;
      this._samples = [];
      this._fistScore *= 0.5;
      this.fist = this._fistScore > 0.5;
    }
    // (A single missed frame inside the grace period changes nothing: the net keeps gliding.)
    this._lastUpdate = now;
  }

  // Smooth hand position for this frame: interpolated between tracking updates, one update behind.
  position() {
    const s = this._samples;
    if (s.length < 2) return { x: this.x, y: this.y };
    const gap = (s[s.length - 1].t - s[0].t) / (s.length - 1); // average time between updates
    const delay = Math.min(INTERP_MAX_MS, Math.max(INTERP_MIN_MS, gap * INTERP_FACTOR));
    const t = performance.now() - delay;
    if (t <= s[0].t) return { x: s[0].x, y: s[0].y };
    for (let i = s.length - 1; i > 0; i--) {
      const a = s[i - 1];
      const b = s[i];
      if (t >= a.t) {
        if (t >= b.t) {
          const ahead = Math.min(EXTRAPOLATE_MAX_MS, t - b.t) / (b.t - a.t);
          return {
            x: Math.min(1, Math.max(0, b.x + (b.x - a.x) * ahead)),
            y: Math.min(1, Math.max(0, b.y + (b.y - a.y) * ahead)),
          };
        }
        const k = (t - a.t) / (b.t - a.t);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    return { x: this.x, y: this.y };
  }

  // A finger counts as curled when its tip is closer to the wrist than its middle joint.
  _updateFist(lm) {
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const wrist = lm[0];
    let curled = 0;
    for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
      if (d(lm[tip], wrist) < d(lm[pip], wrist)) curled++;
    }
    // Smooth over a few updates so the net does not flicker.
    this._fistScore = this._fistScore * 0.5 + (curled >= 3 ? 1 : 0) * 0.5;
    this.fist = this._fistScore > 0.5;
  }

  _checkSpeed(ms) {
    if (!this._trialDone) return; // GPU/CPU trial still running — its timings don't count
    this._results += 1;
    if (this._results <= WARMUP_FRAMES || this._timings.length >= SLOW_SAMPLE_SIZE) return;
    this._timings.push(ms);
    if (this._timings.length === SLOW_SAMPLE_SIZE) {
      const sorted = [...this._timings].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      if (median > SLOW_MEDIAN_MS && this.onSlow) this.onSlow(median);
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
