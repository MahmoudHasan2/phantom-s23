/**
 * 1-D scroll physics: direct manipulation while dragging, inertia with
 * exponential friction after release, and a soft rubber-band at the edges.
 * Units are phone-UI pixels; positive offset = content moved up (scrolled down).
 */
export class ScrollPhysics {
  constructor() {
    this.offset = 0;
    this.velocity = 0; // px / s
    this.max = 0; // max offset (contentHeight - viewportHeight)
    this.dragging = false;
    this.friction = 4.2; // 1/s decay constant
  }

  setBounds(contentHeight, viewportHeight) {
    this.max = Math.max(0, contentHeight - viewportHeight);
  }

  /**
   * Apply a finger delta (px). `maxStep` clamps a single step so a tracking
   * glitch cannot fling the list.
   */
  applyDelta(delta, maxStep = Infinity) {
    const d = Math.max(-maxStep, Math.min(maxStep, delta));
    // Resistance when pulling past an edge.
    const over = this.offset < 0 || this.offset > this.max;
    this.offset += over ? d * 0.35 : d;
    return d;
  }

  startDrag() {
    this.dragging = true;
    this.velocity = 0;
  }

  /** Release with a fling velocity (px/s). */
  release(velocity = 0, maxVelocity = 4000) {
    this.dragging = false;
    this.velocity = Math.max(-maxVelocity, Math.min(maxVelocity, velocity));
  }

  /** @returns {boolean} true while still moving */
  step(dt) {
    if (this.dragging) return false;
    let moving = false;
    if (Math.abs(this.velocity) > 5) {
      this.offset += this.velocity * dt;
      this.velocity *= Math.exp(-this.friction * dt);
      moving = true;
    } else {
      this.velocity = 0;
    }
    // Spring back into range.
    if (this.offset < 0) {
      this.offset += (0 - this.offset) * Math.min(1, dt * 12);
      if (this.offset > -0.5) this.offset = 0;
      this.velocity *= 0.5;
      moving = true;
    } else if (this.offset > this.max) {
      this.offset += (this.max - this.offset) * Math.min(1, dt * 12);
      if (this.offset - this.max < 0.5) this.offset = this.max;
      this.velocity *= 0.5;
      moving = true;
    }
    return moving;
  }

  scrollTo(offset) {
    this.offset = Math.max(0, Math.min(this.max, offset));
    this.velocity = 0;
  }
}
