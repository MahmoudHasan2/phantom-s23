/**
 * One Euro Filter (Casiez et al., CHI 2012).
 *
 * An adaptive low-pass filter: at low speeds it smooths heavily (kills jitter
 * while the finger hovers over an icon), at high speeds the cutoff rises so the
 * cursor does not lag behind fast movements.
 *   minCutoff  - lower => smoother when still (Hz)
 *   beta       - higher => less lag when moving fast
 */
class LowPass {
  constructor() {
    this.initialized = false;
    this.value = 0;
  }
  filter(x, alpha) {
    if (!this.initialized) {
      this.initialized = true;
      this.value = x;
    } else {
      this.value = alpha * x + (1 - alpha) * this.value;
    }
    return this.value;
  }
}

function alphaFor(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.01, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }

  reset() {
    this.x = new LowPass();
    this.dx = new LowPass();
    this.lastTime = null;
    this.lastRaw = null;
  }

  /** @param {number} value  @param {number} t seconds */
  filter(value, t) {
    if (this.lastTime === null) {
      this.lastTime = t;
      this.lastRaw = value;
      this.dx.filter(0, 1);
      return this.x.filter(value, 1);
    }
    const dt = Math.max(1e-4, t - this.lastTime);
    this.lastTime = t;
    const rawDx = (value - this.lastRaw) / dt;
    this.lastRaw = value;
    const edx = this.dx.filter(rawDx, alphaFor(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, alphaFor(cutoff, dt));
  }
}

/** Convenience wrapper for 2-D points. */
export class OneEuroFilter2D {
  constructor(minCutoff, beta) {
    this.fx = new OneEuroFilter(minCutoff, beta);
    this.fy = new OneEuroFilter(minCutoff, beta);
  }
  configure(minCutoff, beta) {
    this.fx.minCutoff = this.fy.minCutoff = minCutoff;
    this.fx.beta = this.fy.beta = beta;
  }
  reset() {
    this.fx.reset();
    this.fy.reset();
  }
  filter(x, y, t, out = { x: 0, y: 0 }) {
    out.x = this.fx.filter(x, t);
    out.y = this.fy.filter(y, t);
    return out;
  }
}
