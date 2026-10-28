/**
 * Lifecycle of the hologram: hidden -> summoning -> active -> dismissing -> hidden.
 *
 * Progress is time-driven (not event-driven) so an animation can never get
 * "stuck": every transitional state always completes after its duration.
 * Interaction is only allowed in the `active` state.
 */
export const HOLO = Object.freeze({
  HIDDEN: 'hidden',
  SUMMONING: 'summoning',
  ACTIVE: 'active',
  DISMISSING: 'dismissing',
});

export class HologramStateMachine {
  constructor({ summonDuration = 2.6, dismissDuration = 1.6 } = {}) {
    this.state = HOLO.HIDDEN;
    this.progress = 0; // 0..1 within the current transitional state
    this.summonDuration = summonDuration;
    this.dismissDuration = dismissDuration;
    this.speed = 1;
    this.skip = false;
    this.onChange = null;
  }

  configure({ speed, skip }) {
    if (speed !== undefined) this.speed = Math.max(0.05, speed);
    if (skip !== undefined) this.skip = !!skip;
  }

  get interactive() {
    return this.state === HOLO.ACTIVE;
  }

  get visible() {
    return this.state !== HOLO.HIDDEN;
  }

  summon() {
    if (this.state === HOLO.ACTIVE || this.state === HOLO.SUMMONING) return false;
    // Summoning while dismissing reverses smoothly from the current point.
    const start = this.state === HOLO.DISMISSING ? 1 - this.progress : 0;
    this.setState(HOLO.SUMMONING, start);
    if (this.skip) this.setState(HOLO.ACTIVE, 1);
    return true;
  }

  dismiss() {
    if (this.state === HOLO.HIDDEN || this.state === HOLO.DISMISSING) return false;
    const start = this.state === HOLO.SUMMONING ? 1 - this.progress : 0;
    this.setState(HOLO.DISMISSING, start);
    if (this.skip) this.setState(HOLO.HIDDEN, 0);
    return true;
  }

  toggle() {
    return this.visible && this.state !== HOLO.DISMISSING ? this.dismiss() : this.summon();
  }

  /** Advance by dt seconds. */
  update(dt) {
    if (this.state === HOLO.SUMMONING) {
      this.progress += (dt * this.speed) / this.summonDuration;
      if (this.progress >= 1) this.setState(HOLO.ACTIVE, 1);
    } else if (this.state === HOLO.DISMISSING) {
      this.progress += (dt * this.speed) / this.dismissDuration;
      if (this.progress >= 1) this.setState(HOLO.HIDDEN, 0);
    }
  }

  /** 0 = nothing, 1 = fully formed. Continuous across summon/dismiss for rendering. */
  get formation() {
    switch (this.state) {
      case HOLO.HIDDEN: return 0;
      case HOLO.ACTIVE: return 1;
      case HOLO.SUMMONING: return this.progress;
      case HOLO.DISMISSING: return 1 - this.progress;
      default: return 0;
    }
  }

  setState(state, progress) {
    const prev = this.state;
    this.state = state;
    this.progress = progress;
    if (prev !== state && this.onChange) this.onChange(state, prev);
  }
}
