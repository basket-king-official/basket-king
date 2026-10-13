// Tiny synthesized sound effects (Web Audio) — no audio files to license or download.
let ctx = null;

function ac() {
  try {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, start, dur, { type = 'sine', gain = 0.12, slideTo } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, gain, cutoff) {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export const sfx = {
  unlock: () => ac(),
  coin: (big = false) => {
    tone(big ? 1568 : 1319, 0, 0.07, { type: 'square', gain: 0.05 });
    tone(big ? 2093 : 1760, 0.06, 0.16, { type: 'square', gain: 0.05 });
  },
  combo: () => [880, 1109, 1319, 1760].forEach((f, i) => tone(f, i * 0.05, 0.12, { type: 'triangle', gain: 0.08 })),
  bomb: () => {
    noise(0.5, 0.6, 700);
    tone(140, 0, 0.4, { type: 'sine', gain: 0.25, slideTo: 40 });
  },
  boost: () => tone(300, 0, 0.4, { type: 'sawtooth', gain: 0.06, slideTo: 1500 }),
  tick: () => tone(1000, 0, 0.05, { type: 'square', gain: 0.04 }),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, { type: 'triangle', gain: 0.12 })),
  lose: () => tone(420, 0, 0.7, { type: 'sawtooth', gain: 0.07, slideTo: 80 }),
};
