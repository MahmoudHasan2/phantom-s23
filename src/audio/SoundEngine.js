/**
 * Synthesised UI sound effects (Web Audio, no audio files). Disabled by
 * default. When recording with audio, effects are also routed into the
 * recording mix.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.volume = 0.5;
    this.recordTargets = new Set();
    this.lastPlay = new Map();
  }

  context() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  configure({ enabled, volume }) {
    this.enabled = !!enabled;
    this.volume = volume;
    if (this.master) this.master.gain.value = volume;
  }

  connectRecording(dest) {
    this.context();
    this.master.connect(dest);
    this.recordTargets.add(dest);
  }

  disconnectRecording(dest) {
    if (!this.master || !this.recordTargets.has(dest)) return;
    try {
      this.master.disconnect(dest);
    } catch {
      /* ignore */
    }
    this.recordTargets.delete(dest);
  }

  play(name) {
    if (!this.enabled) return;
    // Rate-limit identical sounds (e.g. rapid hover/click bursts).
    const now = performance.now();
    if (now - (this.lastPlay.get(name) || 0) < 45) return;
    this.lastPlay.set(name, now);
    const ctx = this.context();
    const t = ctx.currentTime;
    switch (name) {
      case 'summon':
        this.sweep(t, 180, 1400, 1.1, 'sine', 0.22);
        this.sweep(t + 0.1, 600, 2400, 0.9, 'triangle', 0.06);
        this.noise(t, 1.0, 2400, 0.05);
        break;
      case 'dismiss':
        this.sweep(t, 1200, 140, 0.8, 'sine', 0.2);
        this.noise(t, 0.7, 1200, 0.05);
        break;
      case 'click':
        this.blip(t, 1500, 0.06, 0.12);
        break;
      case 'key':
        this.blip(t, 2200, 0.035, 0.08);
        break;
      case 'tick':
        this.blip(t, 900, 0.05, 0.08);
        break;
      case 'open':
        this.sweep(t, 500, 1100, 0.18, 'sine', 0.12);
        break;
      case 'close':
        this.sweep(t, 1000, 420, 0.18, 'sine', 0.12);
        break;
      case 'send':
        this.sweep(t, 700, 1800, 0.16, 'triangle', 0.1);
        break;
      case 'shutter':
        this.noise(t, 0.08, 4000, 0.25);
        break;
      default:
        break;
    }
  }

  blip(t, freq, dur, gain) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  sweep(t, f0, f1, dur, type, gain) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(t, dur, cutoff, gain) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  dispose() {
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
