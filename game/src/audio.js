// Sunset Vaults — sound, synthesized in the browser. One job: every
// beep, ding and hum, made with WebAudio oscillators so the game ships
// no audio files at all. Silent until the first key or click.
let ctx = null;
let padOn = false;

export function ensureAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    startPad();
  } catch { /* no audio is fine; the game stays playable */ }
}

function tone(freq, dur, type, gain, slideTo) {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch { /* ignore */ }
}

function startPad() {
  if (padOn || !ctx) return;
  padOn = true;
  try {
    const g = ctx.createGain();
    g.gain.value = 0.035;
    g.connect(ctx.destination);
    for (const f of [110, 164.8, 220.5]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 6;
      o.connect(g);
      o.start();
    }
  } catch { /* ignore */ }
}

export const sfx = {
  coin() { tone(1568, 0.12, 'sine', 0.10); setTimeout(() => tone(2093, 0.22, 'sine', 0.09), 70); },
  pickup() { tone(880, 0.10, 'triangle', 0.09); setTimeout(() => tone(1318, 0.18, 'triangle', 0.08), 80); },
  step() { tone(90 + Math.random() * 30, 0.05, 'square', 0.02); },
  suspicious() { tone(660, 0.16, 'sawtooth', 0.05, 440); },
  alarm() { tone(520, 0.22, 'square', 0.06, 780); setTimeout(() => tone(780, 0.22, 'square', 0.06, 520), 240); },
  laser() { tone(1200, 0.14, 'sawtooth', 0.07, 300); },
  caught() { tone(220, 0.5, 'sawtooth', 0.09, 110); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.09), i * 110)); },
  click() { tone(440, 0.06, 'sine', 0.05); },
};
