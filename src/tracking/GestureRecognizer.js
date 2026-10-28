import { OneEuroFilter2D } from './OneEuroFilter.js';
import { classifyPose, fingerExtension, fingerStates, FINGERS, handSize, LM, palmCenter, pinchRatio } from './handGeometry.js';

/**
 * Gesture recognition engine — pure logic, no DOM, no rendering.
 *
 * Feed it one hand per tracking frame (landmarks already mapped to screen
 * pixels) via update(hand, tMs, context). It returns an array of discrete
 * events and keeps a continuous `state` for cursors / feedback UI.
 *
 * Events:
 *   trackingFound | trackingLost
 *   pinchStart {x,y} | pinchEnd {cancelled}
 *   click {x,y}               short pinch, once per pinch cycle, debounced
 *   hold {x,y}                pinch held still for holdMs (used to close apps)
 *   dragStart {x,y} | drag {dx,dy} | dragEnd {vx,vy}      pinch + move
 *   scrollStart | scroll {dy} | scrollEnd {vy}            two-finger "V" pose
 *   summon | dismiss          open palm hold / fist hold (latched per pose)
 *   back {direction}          fast horizontal swipe with an open hand
 *   poseChange {pose}
 */
export const DEFAULT_GESTURE_CONFIG = {
  pinchOn: 0.33,
  pinchOff: 0.48,
  clickMaxMs: 550,
  clickCooldownMs: 220,
  holdMs: 1100,
  dragThreshold: 0.22, // hand sizes
  twoFingerScroll: true,
  summonGesture: 'openPalmHold',
  summonHoldMs: 700,
  dismissGesture: 'fistHold',
  dismissHoldMs: 1000,
  backGesture: 'swipeEither',
  swipeSpeed: 4.5, // hand sizes per second
  lostGraceMs: 280,
  smoothMinCutoff: 1.4,
  smoothBeta: 0.012,
  poseStableMs: 90,
  lookbackMs: 90,
  backCooldownMs: 900,
  swipeWindowMs: 220,
  stillSpeed: 1.2, // hand sizes per second considered "holding still"
};

const HISTORY = 24;

export class GestureRecognizer {
  constructor(config = {}) {
    this.config = { ...DEFAULT_GESTURE_CONFIG, ...config };
    this.cursorFilter = new OneEuroFilter2D(this.config.smoothMinCutoff, this.config.smoothBeta);
    this.pinchFilter = new OneEuroFilter2D(this.config.smoothMinCutoff, this.config.smoothBeta);
    // Ring buffers of recent filtered cursor + palm positions for look-back and swipe velocity.
    this.hist = Array.from({ length: HISTORY }, () => ({ t: -1, x: 0, y: 0, px: 0, py: 0, hs: 1 }));
    this.histIndex = 0;
    this.tmpPalm = { x: 0, y: 0 };
    this.tmpCursor = { x: 0, y: 0 };
    this.tmpPinch = { x: 0, y: 0 };
    this.events = [];
    this.lastClickTime = -Infinity;
    this.lastBackTime = -Infinity;
    this.state = this.freshState();
  }

  configure(partial) {
    Object.assign(this.config, partial);
    this.cursorFilter.configure(this.config.smoothMinCutoff, this.config.smoothBeta);
    this.pinchFilter.configure(this.config.smoothMinCutoff, this.config.smoothBeta);
  }

  freshState() {
    return {
      tracked: false,
      lastSeen: -Infinity,
      handedness: '',
      score: 0,
      confidence: 0,
      cursor: { x: 0, y: 0 },
      palm: { x: 0, y: 0 },
      handSizePx: 0,
      pinchRatio: 1,
      fingers: { index: 'partial', middle: 'partial', ring: 'partial', pinky: 'partial', thumb: 'partial' },
      pose: 'none',
      candidatePose: 'none',
      candidateSince: 0,
      poseSince: 0,
      poseLatched: false, // summon/dismiss already fired for the current pose
      direction: 'still',
      velocity: { x: 0, y: 0 }, // px/s of palm
      // pinch
      pinching: false,
      pinchStart: 0,
      pinchAnchor: { x: 0, y: 0 },
      pinchMidStart: { x: 0, y: 0 },
      pinchMidLast: { x: 0, y: 0 },
      dragging: false,
      holdFired: false,
      holdProgress: 0,
      // two-finger scroll
      scrolling: false,
      scrollLastY: 0,
      scrollVel: 0,
      // progress indicators (0..1)
      summonProgress: 0,
      dismissProgress: 0,
      trackedFrames: 0,
      totalFrames: 0,
    };
  }

  /**
   * @param {null|{points:Array<{x,y,z}>, score:number, handedness:string}} hand  landmarks in screen px
   * @param {number} t   timestamp in ms (monotonic)
   * @param {{hologramHidden?:boolean, hologramActive?:boolean}} ctx
   * @returns {Array<object>} events emitted this frame (array is reused; copy if you keep it)
   */
  update(hand, t, ctx = {}) {
    const ev = this.events;
    ev.length = 0;
    const s = this.state;
    s.totalFrames++;

    if (!hand || !hand.points || hand.points.length < 21) {
      if (s.tracked && t - s.lastSeen > this.config.lostGraceMs) this.loseTracking(t);
      return ev;
    }

    if (!s.tracked) {
      s.tracked = true;
      this.cursorFilter.reset();
      this.pinchFilter.reset();
      ev.push({ type: 'trackingFound' });
    }
    s.lastSeen = t;
    s.trackedFrames++;
    s.score = hand.score ?? 1;
    s.handedness = hand.handedness || '';

    const p = hand.points;
    const hs = handSize(p);
    s.handSizePx = hs;
    const sec = t / 1000;

    // --- Continuous features ---------------------------------------------------
    const tip = p[LM.INDEX_TIP];
    this.cursorFilter.filter(tip.x, tip.y, sec, s.cursor);
    palmCenter(p, this.tmpPalm);
    s.palm.x = this.tmpPalm.x;
    s.palm.y = this.tmpPalm.y;
    // Drag reference: the palm centre moves with the hand but not with finger
    // articulation, so closing the pinch itself never registers as a drag.
    this.pinchFilter.filter(s.palm.x, s.palm.y, sec, this.tmpPinch);
    s.pinchRatio = pinchRatio(p);
    s.fingers = fingerStates(p);
    const indexCurled = fingerExtension(p, FINGERS[0]) < 1.25;

    this.pushHistory(t, s.cursor.x, s.cursor.y, s.palm.x, s.palm.y, hs);
    this.computeVelocity(t, hs);

    // Confidence = detector score blended with recent tracking continuity.
    const continuity = Math.min(1, s.trackedFrames / Math.max(1, s.totalFrames));
    s.confidence = s.score * (0.6 + 0.4 * continuity);

    // --- Pose with temporal stability -----------------------------------------
    const raw = classifyPose(s.fingers);
    if (raw !== s.candidatePose) {
      s.candidatePose = raw;
      s.candidateSince = t;
    }
    if (s.candidatePose !== s.pose && t - s.candidateSince >= this.config.poseStableMs) {
      s.pose = s.candidatePose;
      s.poseSince = t;
      s.poseLatched = false;
      ev.push({ type: 'poseChange', pose: s.pose });
    }

    // --- Pinch / click / hold / drag (hysteresis) ------------------------------
    this.updatePinch(t, hs, indexCurled);

    // --- Two-finger scroll -----------------------------------------------------
    this.updateTwoFingerScroll(p, t);

    // --- Summon / dismiss holds ------------------------------------------------
    this.updatePoseHolds(t, ctx);

    // --- Swipe back ------------------------------------------------------------
    this.updateSwipe(t, hs);

    return ev;
  }

  updatePinch(t, hs, indexCurled) {
    const s = this.state;
    const c = this.config;
    const ev = this.events;
    if (!s.pinching) {
      s.holdProgress = 0;
      if (s.pinchRatio < c.pinchOn && !indexCurled && !s.scrolling) {
        s.pinching = true;
        s.pinchStart = t;
        s.dragging = false;
        s.holdFired = false;
        // The index tip drifts toward the thumb while pinching; use where the
        // cursor was a moment *before* the pinch closed as the click target.
        const back = this.lookback(t - c.lookbackMs);
        s.pinchAnchor.x = back.x;
        s.pinchAnchor.y = back.y;
        // Restart the drag filter at the current palm position (no lag carried over).
        this.pinchFilter.reset();
        this.pinchFilter.filter(s.palm.x, s.palm.y, t / 1000, this.tmpPinch);
        s.pinchMidStart.x = s.pinchMidLast.x = this.tmpPinch.x;
        s.pinchMidStart.y = s.pinchMidLast.y = this.tmpPinch.y;
        ev.push({ type: 'pinchStart', x: s.pinchAnchor.x, y: s.pinchAnchor.y });
      }
      return;
    }

    // Pinch collapsing into a fist is not a click.
    if (indexCurled) {
      this.endPinch(true);
      return;
    }

    const duration = t - s.pinchStart;
    if (s.pinchRatio > c.pinchOff) {
      if (!s.dragging && !s.holdFired && duration <= c.clickMaxMs && t - this.lastClickTime >= c.clickCooldownMs) {
        this.lastClickTime = t;
        ev.push({ type: 'click', x: s.pinchAnchor.x, y: s.pinchAnchor.y });
      }
      this.endPinch(false);
      return;
    }

    const mx = this.tmpPinch.x;
    const my = this.tmpPinch.y;
    if (!s.dragging && !s.holdFired) {
      const moved = Math.hypot(mx - s.pinchMidStart.x, my - s.pinchMidStart.y);
      if (moved > c.dragThreshold * hs) {
        s.dragging = true;
        s.holdProgress = 0;
        s.pinchMidLast.x = mx;
        s.pinchMidLast.y = my;
        ev.push({ type: 'dragStart', x: s.pinchAnchor.x, y: s.pinchAnchor.y });
      }
    }
    if (s.dragging) {
      const dx = mx - s.pinchMidLast.x;
      const dy = my - s.pinchMidLast.y;
      s.pinchMidLast.x = mx;
      s.pinchMidLast.y = my;
      if (dx || dy) ev.push({ type: 'drag', dx, dy });
      return;
    }
    if (!s.holdFired) {
      const startShow = c.clickMaxMs * 0.6;
      s.holdProgress = clamp01((duration - startShow) / Math.max(1, c.holdMs - startShow));
      if (duration >= c.holdMs) {
        s.holdFired = true;
        s.holdProgress = 1;
        ev.push({ type: 'hold', x: s.pinchAnchor.x, y: s.pinchAnchor.y });
      }
    }
  }

  endPinch(cancelled) {
    const s = this.state;
    if (!s.pinching) return;
    if (s.dragging) this.events.push({ type: 'dragEnd', vx: cancelled ? 0 : s.velocity.x, vy: cancelled ? 0 : s.velocity.y });
    s.pinching = false;
    s.dragging = false;
    s.holdFired = false;
    s.holdProgress = 0;
    this.events.push({ type: 'pinchEnd', cancelled });
  }

  updateTwoFingerScroll(p, t) {
    const s = this.state;
    const ev = this.events;
    const active = this.config.twoFingerScroll && s.pose === 'victory' && !s.pinching;
    const y = (p[LM.INDEX_TIP].y + p[LM.MIDDLE_TIP].y) / 2;
    if (active && !s.scrolling) {
      s.scrolling = true;
      s.scrollLastY = y;
      s.scrollVel = 0;
      ev.push({ type: 'scrollStart' });
    } else if (active && s.scrolling) {
      const dy = y - s.scrollLastY;
      s.scrollLastY = y;
      s.scrollVel = s.velocity.y;
      if (dy) ev.push({ type: 'scroll', dy });
    } else if (!active && s.scrolling) {
      s.scrolling = false;
      ev.push({ type: 'scrollEnd', vy: s.scrollVel });
    }
  }

  updatePoseHolds(t, ctx) {
    const s = this.state;
    const c = this.config;
    const held = t - s.poseSince;
    const still = Math.hypot(s.velocity.x, s.velocity.y) < c.stillSpeed * s.handSizePx;

    s.summonProgress = 0;
    s.dismissProgress = 0;
    if (s.poseLatched || s.pinching) return;

    if (c.summonGesture === 'openPalmHold' && s.pose === 'openPalm' && ctx.hologramHidden !== false) {
      if (!still) s.poseSince = t; // restart the hold while the hand is moving
      s.summonProgress = clamp01(held / c.summonHoldMs);
      if (still && held >= c.summonHoldMs) {
        s.poseLatched = true;
        s.summonProgress = 1;
        this.events.push({ type: 'summon' });
      }
    }
    if (c.dismissGesture === 'fistHold' && s.pose === 'fist' && ctx.hologramActive !== false) {
      s.dismissProgress = clamp01(held / c.dismissHoldMs);
      if (held >= c.dismissHoldMs) {
        s.poseLatched = true;
        s.dismissProgress = 1;
        this.events.push({ type: 'dismiss' });
      }
    }
  }

  updateSwipe(t, hs) {
    const s = this.state;
    const c = this.config;
    if (c.backGesture === 'off' || s.pinching || s.scrolling) return;
    if (t - this.lastBackTime < c.backCooldownMs) return;
    const openish = ['index', 'middle', 'ring', 'pinky'].filter((f) => s.fingers[f] === 'extended').length >= 3;
    if (!openish) return;
    const past = this.lookback(t - c.swipeWindowMs);
    if (past.t < 0) return;
    const dt = Math.max(1, t - past.t) / 1000;
    const dx = s.palm.x - past.px;
    const dy = s.palm.y - past.py;
    const speed = Math.abs(dx) / dt / hs;
    if (speed < c.swipeSpeed || Math.abs(dx) < 0.6 * hs || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const direction = dx < 0 ? 'left' : 'right';
    if (c.backGesture === 'swipeLeft' && direction !== 'left') return;
    if (c.backGesture === 'swipeRight' && direction !== 'right') return;
    this.lastBackTime = t;
    // A swipe must not also count toward an open-palm summon.
    s.poseSince = t;
    this.events.push({ type: 'back', direction });
  }

  loseTracking() {
    const s = this.state;
    if (s.pinching) this.endPinch(true);
    if (s.scrolling) {
      s.scrolling = false;
      this.events.push({ type: 'scrollEnd', vy: 0 });
    }
    const keep = { lastSeen: s.lastSeen, totalFrames: s.totalFrames, trackedFrames: s.trackedFrames };
    this.state = Object.assign(this.freshState(), keep);
    this.cursorFilter.reset();
    this.pinchFilter.reset();
    for (const h of this.hist) h.t = -1;
    this.events.push({ type: 'trackingLost' });
  }

  /** Force-reset everything (e.g. tracking stopped). Emits nothing. */
  reset() {
    this.state = this.freshState();
    this.cursorFilter.reset();
    this.pinchFilter.reset();
    for (const h of this.hist) h.t = -1;
  }

  pushHistory(t, x, y, px, py, hs) {
    const h = this.hist[this.histIndex];
    h.t = t;
    h.x = x;
    h.y = y;
    h.px = px;
    h.py = py;
    h.hs = hs;
    this.histIndex = (this.histIndex + 1) % HISTORY;
  }

  /** Most recent history sample at or before time `target` (falls back to the oldest). */
  lookback(target) {
    let best = null;
    let oldest = null;
    for (const h of this.hist) {
      if (h.t < 0) continue;
      if (!oldest || h.t < oldest.t) oldest = h;
      if (h.t <= target && (!best || h.t > best.t)) best = h;
    }
    return best || oldest || { t: -1, x: this.state.cursor.x, y: this.state.cursor.y, px: this.state.palm.x, py: this.state.palm.y };
  }

  computeVelocity(t, hs) {
    const s = this.state;
    const past = this.lookback(t - 100);
    if (past.t < 0 || past.t === t) {
      s.velocity.x = s.velocity.y = 0;
    } else {
      const dt = (t - past.t) / 1000;
      // EMA keeps the velocity readout stable for inertia / direction labels.
      s.velocity.x = 0.5 * s.velocity.x + 0.5 * ((s.palm.x - past.px) / dt);
      s.velocity.y = 0.5 * s.velocity.y + 0.5 * ((s.palm.y - past.py) / dt);
    }
    const sp = Math.hypot(s.velocity.x, s.velocity.y) / hs;
    if (sp < 0.6) s.direction = 'still';
    else if (Math.abs(s.velocity.x) > Math.abs(s.velocity.y)) s.direction = s.velocity.x > 0 ? 'right' : 'left';
    else s.direction = s.velocity.y > 0 ? 'down' : 'up';
  }
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Extracts the recognizer config subset from the app settings object. */
export function gestureConfigFromSettings(st) {
  return {
    pinchOn: st.pinchOn,
    pinchOff: Math.max(st.pinchOff, st.pinchOn + 0.03), // enforce hysteresis gap
    clickMaxMs: st.clickMaxMs,
    clickCooldownMs: st.clickCooldownMs,
    holdMs: st.holdMs,
    dragThreshold: st.dragThreshold,
    twoFingerScroll: st.twoFingerScroll,
    summonGesture: st.summonGesture,
    summonHoldMs: st.summonHoldMs,
    dismissGesture: st.dismissGesture,
    dismissHoldMs: st.dismissHoldMs,
    backGesture: st.backGesture,
    swipeSpeed: st.swipeSpeed,
    lostGraceMs: st.lostGraceMs,
    smoothMinCutoff: st.smoothMinCutoff,
    smoothBeta: st.smoothBeta,
  };
}
