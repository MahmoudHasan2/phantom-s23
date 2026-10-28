/**
 * Render-rate cursor smoothing. Tracking updates arrive at ~15-30 Hz; the
 * cursor is eased toward the latest target every render frame (60 Hz) so it
 * glides instead of stepping. Frame-rate independent exponential easing.
 */
export class VirtualCursor {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.tx = 0;
    this.ty = 0;
    this.initialized = false;
    this.lerp = 0.45; // fraction per 60 Hz frame
  }

  setTarget(x, y) {
    this.tx = x;
    this.ty = y;
    if (!this.initialized) {
      this.x = x;
      this.y = y;
      this.initialized = true;
    }
  }

  /** Jump immediately (e.g. when tracking resumes far away). */
  snap(x, y) {
    this.x = this.tx = x;
    this.y = this.ty = y;
    this.initialized = true;
  }

  update(dt) {
    const k = 1 - Math.pow(1 - Math.min(0.999, this.lerp), dt * 60);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
  }

  reset() {
    this.initialized = false;
  }
}
