// Design sonore entièrement synthétisé : aucun fichier audio à charger.
// Chaîne : voix -> (sec + réverbération générée) -> compresseur -> sortie.

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let verb: ConvolverNode | null = null;
let enabled = true;
let haptics = true;

export function setSound(on: boolean, vib: boolean) {
  enabled = on;
  haptics = vib;
}

function init(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 3;
      out = ctx.createGain();
      out.gain.value = 0.9;
      out.connect(comp).connect(ctx.destination);
      // Réverbération : bruit stéréo à décroissance exponentielle.
      const len = Math.floor(ctx.sampleRate * 1.8);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      verb = ctx.createConvolver();
      verb.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      verb.connect(wet).connect(out);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function route(node: AudioNode, send = 0.5) {
  if (!ctx || !out) return;
  node.connect(out);
  if (verb && send > 0) {
    const g = ctx.createGain();
    g.gain.value = send;
    node.connect(g).connect(verb);
  }
}

/** Note boisée type marimba : fondamentale + partiel à 4x qui s'éteint vite. */
function marimba(freq: number, at = 0, vol = 0.22, send = 0.35) {
  const c = init();
  if (!c) return;
  const t = c.currentTime + at;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  const o1 = c.createOscillator();
  o1.frequency.value = freq;
  const o2 = c.createOscillator();
  o2.frequency.value = freq * 4;
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.35, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o1.connect(g);
  o2.connect(g2).connect(g);
  route(g, send);
  o1.start(t);
  o2.start(t);
  o1.stop(t + 0.6);
  o2.stop(t + 0.12);
}

/** Cloche FM : modulateur à 3,5x pour un timbre métallique doux. */
function bell(freq: number, at = 0, vol = 0.16, dur = 1.6, send = 0.6) {
  const c = init();
  if (!c) return;
  const t = c.currentTime + at;
  const car = c.createOscillator();
  car.frequency.value = freq;
  const mod = c.createOscillator();
  mod.frequency.value = freq * 3.5;
  const mg = c.createGain();
  mg.gain.setValueAtTime(freq * 1.6, t);
  mg.gain.exponentialRampToValueAtTime(1, t + dur);
  mod.connect(mg).connect(car.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  car.connect(g);
  route(g, send);
  car.start(t);
  mod.start(t);
  car.stop(t + dur + 0.05);
  mod.stop(t + dur + 0.05);
}

/** Clic mécanique : bruit filtré très court, comme une touche de machine. */
function click(at = 0, vol = 0.18, hp = 1800, dur = 0.028) {
  const c = init();
  if (!c) return;
  const t = c.currentTime + at;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g);
  route(g, 0.08);
  src.start(t);
}

function thud(at = 0) {
  const c = init();
  if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 0.22);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g);
  route(g, 0.1);
  o.start(t);
  o.stop(t + 0.32);
}

function pad(freqs: number[], at = 0, dur = 1.4, vol = 0.05) {
  const c = init();
  if (!c) return;
  const t = c.currentTime + at;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(600, t);
  f.frequency.exponentialRampToValueAtTime(2400, t + dur * 0.4);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g);
  route(g, 0.7);
  for (const fr of freqs) {
    for (const det of [-6, 6]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = fr;
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}

function buzz(ms: number | number[]) {
  if (haptics) navigator.vibrate?.(ms);
}

// Gamme pentatonique de do majeur : les combos montent sans jamais sonner faux.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
const note = (i: number) => PENTA[Math.min(PENTA.length - 1, Math.max(0, i))];

export const sfx = {
  key: () => click(0, 0.12, 2200, 0.02),
  tap: () => click(0, 0.08, 3000, 0.015),
  good: (combo = 0) => {
    click(0, 0.1);
    marimba(note(Math.floor(combo / 2)), 0.005);
    buzz(8);
  },
  bad: () => {
    click(0, 0.14, 900);
    thud(0.01);
    buzz(55);
  },
  word: (combo = 0) => {
    const b = Math.min(5, Math.floor(combo / 3));
    [0, 2, 4].forEach((k, i) => marimba(note(b + k), i * 0.07, 0.2, 0.5));
    buzz([10, 30, 14]);
  },
  combo: () => {
    bell(1567.98, 0, 0.08, 0.8);
    bell(2093, 0.06, 0.06, 0.8);
  },
  win: () => {
    pad([261.63, 329.63, 392], 0, 2.4, 0.045);
    [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) => bell(f, 0.05 + i * 0.09, 0.13, 1.8));
    buzz([18, 40, 18, 40, 30]);
  },
  fail: () => {
    thud(0);
    pad([220, 261.63, 329.63], 0.05, 1.6, 0.04);
    [440, 392, 329.63].forEach((f, i) => marimba(f, 0.1 + i * 0.16, 0.16, 0.6));
    buzz([90, 60, 140]);
  },
  tick: (urgent = false) => click(0, urgent ? 0.2 : 0.1, urgent ? 3500 : 2600, 0.012),
  unlock: () => [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => bell(f, i * 0.08, 0.1, 1.3)),
  coin: () => {
    bell(1318.51, 0, 0.09, 0.5, 0.3);
    bell(1975.53, 0.07, 0.08, 0.7, 0.3);
  },
  booster: () => {
    pad([392, 523.25], 0, 0.7, 0.04);
    bell(1046.5, 0.02, 0.1, 1);
  },
  open: () => click(0, 0.06, 1200, 0.03),
};
