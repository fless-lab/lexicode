// Petits sons synthétisés (pas de fichiers audio) et vibrations.

let ctx: AudioContext | null = null;
let enabled = true;
let haptics = true;

export function setSound(on: boolean, vib: boolean) {
  enabled = on;
  haptics = vib;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', delay = 0, vol = 0.08) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  } catch {
    /* audio indisponible */
  }
}

function buzz(ms: number | number[]) {
  if (haptics) navigator.vibrate?.(ms);
}

export const sfx = {
  tap: () => tone(660, 0.05, 'triangle', 0, 0.04),
  good: () => tone(880, 0.08, 'triangle'),
  bad: () => {
    tone(180, 0.18, 'square', 0, 0.05);
    buzz(60);
  },
  word: () => {
    tone(660, 0.1, 'triangle');
    tone(990, 0.14, 'triangle', 0.08);
  },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', i * 0.1));
    buzz([30, 40, 30]);
  },
  fail: () => {
    [392, 330, 262].forEach((f, i) => tone(f, 0.28, 'sawtooth', i * 0.15, 0.05));
    buzz([80, 60, 120]);
  },
  tick: () => tone(1200, 0.03, 'square', 0, 0.03),
  unlock: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.15, 'sine', i * 0.07)),
  coin: () => {
    tone(988, 0.06, 'square', 0, 0.04);
    tone(1319, 0.12, 'square', 0.06, 0.04);
  },
};
