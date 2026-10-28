/**
 * Pinch-threshold calibration (pure logic).
 *
 * The operator records two short samples: hand relaxed/open (pointing) and
 * fingers pinched. Thresholds are placed between the two distributions using
 * robust percentiles, leaving a hysteresis gap so the pinch cannot flicker.
 */
export class GestureCalibration {
  constructor() {
    this.samples = { open: [], pinch: [] };
    this.active = null; // 'open' | 'pinch' | null
    this.until = 0;
  }

  begin(kind, now, durationMs = 2000) {
    if (kind !== 'open' && kind !== 'pinch') throw new Error('kind must be open|pinch');
    this.samples[kind] = [];
    this.active = kind;
    this.until = now + durationMs;
  }

  /** Feed the current pinch ratio. Returns true while still collecting. */
  addSample(ratio, now) {
    if (!this.active) return false;
    if (now > this.until) {
      this.active = null;
      return false;
    }
    if (Number.isFinite(ratio)) this.samples[this.active].push(ratio);
    return true;
  }

  get ready() {
    return this.samples.open.length >= 8 && this.samples.pinch.length >= 8;
  }

  /** @returns {{pinchOn:number, pinchOff:number, separation:number} | null} */
  recommend() {
    return recommendThresholds(this.samples.open, this.samples.pinch);
  }
}

export function percentile(values, q) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function recommendThresholds(openSamples, pinchSamples) {
  if (openSamples.length < 3 || pinchSamples.length < 3) return null;
  const pinchHigh = percentile(pinchSamples, 0.9); // worst-case "closed" value
  const openLow = percentile(openSamples, 0.1); // worst-case "open" value
  const gap = openLow - pinchHigh;
  if (gap <= 0.04) return { pinchOn: null, pinchOff: null, separation: gap };
  const round = (v) => Math.round(v * 100) / 100;
  return {
    pinchOn: round(pinchHigh + gap * 0.3),
    pinchOff: round(pinchHigh + gap * 0.62),
    separation: round(gap),
  };
}
