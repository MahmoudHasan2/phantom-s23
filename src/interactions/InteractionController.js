import { PHONE_UI } from '../config/appConfig.js';
import { videoToScreen } from '../camera/videoTransform.js';
import { gestureConfigFromSettings } from '../tracking/GestureRecognizer.js';
import { VirtualCursor } from './VirtualCursor.js';

/**
 * Glue between input sources and the experience:
 *   hand tracking -> landmark mapping -> GestureRecognizer events
 *   mouse (development / calibration fallback)
 * and the targets: hologram lifecycle, phone UI (hover, press, click,
 * scroll, back, close) and on-screen feedback.
 */
export class InteractionController {
  constructor({ settings, status, recognizer, holo, holoScene, phone, compositor, feedback, sound, canvas }) {
    Object.assign(this, { settings, status, recognizer, holo, holoScene, phone, compositor, feedback, sound, canvas });
    this.cursor = new VirtualCursor();
    this.source = null; // 'hand' | 'mouse' | null
    this.lastMouseMove = -Infinity;
    this.mouse = null; // active mouse press
    this.mapped = [makePoints(), makePoints()];
    this.debugHands = []; // [{points, handedness, primary}]
    this.uiPt = { x: 0, y: 0, inside: false };
    this.tmp = { x: 0, y: 0 };
    this.cursorState = { visible: false, x: 0, y: 0, press: 0, hold: 0, gesture: 0, hover: false, size: 64 };
    this.handEl = null;
    this.applySettings();
    this.unsub = settings.subscribe(() => this.applySettings());
    this.bindMouse();
  }

  applySettings() {
    this.recognizer.configure(gestureConfigFromSettings(this.settings.state));
    this.cursor.lerp = this.settings.get('cursorLerp');
  }

  // ------------------------------------------------------------ tracking ---
  /** Called by HandTracker for every inference result (tracking rate). */
  onTrackingResult(hands, t) {
    const st = this.settings.state;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const tr = this.compositor.transform;
    this.debugHands.length = 0;
    let primary = null;
    for (let h = 0; h < Math.min(2, hands.length); h++) {
      const pts = this.mapped[h];
      const lm = hands[h].landmarks;
      // z (relative depth) is in units of image width; bring it to the same pixel scale as x.
      const zScale = W / tr.scaleX;
      for (let i = 0; i < 21; i++) {
        videoToScreen(tr, lm[i].x, lm[i].y, st.mirror, W, H, pts[i]);
        pts[i].z = lm[i].z * zScale;
      }
      // MediaPipe labels handedness assuming a mirrored selfie image; we feed
      // raw frames, so the label is swapped relative to the user's real hand.
      const userHand = hands[h].handedness === 'Left' ? 'right' : hands[h].handedness === 'Right' ? 'left' : '';
      const entry = { points: pts, handedness: userHand, score: hands[h].score, primary: false };
      this.debugHands.push(entry);
    }
    if (this.debugHands.length) {
      const pref = st.preferredHand;
      primary = (pref !== 'any' && this.debugHands.find((d) => d.handedness === pref)) || this.debugHands[0];
      primary.primary = true;
    }

    const events = this.recognizer.update(primary, t, {
      hologramHidden: this.holo.state === 'hidden',
      hologramActive: this.holo.interactive,
    });
    for (const e of events) this.handleGesture(e);

    const rs = this.recognizer.state;
    this.status.set({ hand: rs.tracked ? 'tracked' : this.status.get('hand') === 'none' ? 'none' : 'lost' });
    if (rs.tracked && performance.now() - this.lastMouseMove > 1500) {
      if (this.source !== 'hand') this.cursor.reset();
      this.source = 'hand';
      const p = rs.pinching && !rs.dragging ? rs.pinchAnchor : rs.cursor;
      this.cursor.setTarget(p.x, p.y);
    } else if (!rs.tracked && this.source === 'hand') {
      this.source = null;
    }
  }

  handleGesture(e) {
    const phone = this.phone;
    const active = this.holo.interactive;
    switch (e.type) {
      case 'trackingFound':
        this.feedback.show('HAND DETECTED', 'info');
        break;
      case 'trackingLost':
        this.feedback.show('TRACKING LOST', 'warn');
        phone.release();
        phone.endScroll(0);
        break;
      case 'summon':
        if (this.holo.state === 'hidden' || this.holo.state === 'dismissing') {
          this.summon();
        }
        break;
      case 'dismiss':
        if (active) this.dismiss();
        break;
      case 'pinchStart':
        if (!active) break;
        this.feedback.show('PINCH DETECTED');
        if (this.toUI(e.x, e.y).inside) phone.press(this.uiPt.x, this.uiPt.y);
        break;
      case 'pinchEnd':
        phone.release();
        break;
      case 'click': {
        if (!active) break;
        if (!this.toUI(e.x, e.y).inside) break;
        const id = phone.click(this.uiPt.x, this.uiPt.y);
        if (id && id.startsWith('home-')) this.feedback.show('APPLICATION OPENING');
        else if (id === 'keyboard') this.feedback.show('KEY PRESSED');
        else if (id) this.feedback.show('SELECTED');
        break;
      }
      case 'hold':
        if (!active) break;
        if (!phone.router.isHome) {
          this.feedback.show('CLOSING APPLICATION');
          phone.release();
          phone.home();
        }
        break;
      case 'dragStart':
      case 'scrollStart':
        if (!active) break;
        phone.release();
        this.toUI(this.cursor.x, this.cursor.y);
        phone.beginScroll(this.uiPt.x, this.uiPt.y);
        this.feedback.show('SCROLL ACTIVE');
        break;
      case 'drag':
      case 'scroll': {
        if (!active) break;
        const dy = e.dy * this.uiPerScreenPx() * this.settings.get('scrollSensitivity');
        phone.scrollBy(dy, this.settings.get('scrollMaxSpeed'));
        break;
      }
      case 'dragEnd':
      case 'scrollEnd': {
        if (!active) break;
        const v = (e.vy || 0) * this.uiPerScreenPx() * this.settings.get('scrollSensitivity');
        const max = this.settings.get('scrollMaxSpeed') * 60;
        phone.endScroll(Math.max(-max, Math.min(max, v)));
        break;
      }
      case 'back':
        if (!active) break;
        if (phone.back()) this.feedback.show(`BACK (${e.direction.toUpperCase()} SWIPE)`);
        break;
      default:
        break;
    }
  }

  /**
   * "Wink click" for the advert: an off-camera key (Space / presenter remote)
   * activates whatever the cursor is currently over, while the actor winks.
   */
  clickAtCursor() {
    if (!this.holo.interactive || !this.source) return false;
    this.toUI(this.cursor.x, this.cursor.y);
    if (!this.uiPt.inside) return false;
    this.phone.press(this.uiPt.x, this.uiPt.y);
    const id = this.phone.click(this.uiPt.x, this.uiPt.y);
    setTimeout(() => this.phone.release(), 120);
    this.cursorState.press = 1;
    if (id && id.startsWith('home-')) this.feedback.show('APPLICATION OPENING');
    else if (id) this.feedback.show('WINK SELECT');
    return !!id;
  }

  summon() {
    if (this.holo.summon()) {
      this.feedback.show('HOLOGRAM SUMMONED');
      this.sound.play('summon');
    }
  }

  dismiss() {
    this.phone.release();
    this.phone.endScroll(0);
    if (this.holo.dismiss()) {
      this.feedback.show('HOLOGRAM DISMISSED');
      this.sound.play('dismiss');
    }
  }

  // ------------------------------------------------------------- mapping ---
  /** UI pixels per screen pixel along the hologram's vertical axis. */
  uiPerScreenPx() {
    return PHONE_UI.height / this.holoScene.screenHeightPx();
  }

  zoneRect() {
    const c = this.holoScene.uiToScreen(PHONE_UI.width / 2, PHONE_UI.height / 2, this.tmp);
    const h = this.settings.get('zoneSize') * this.canvas.height;
    const w = h * (PHONE_UI.width / PHONE_UI.height);
    return { x: c.x - w / 2, y: c.y - h / 2, w, h };
  }

  /** Screen pixel -> phone UI (writes this.uiPt). */
  toUI(px, py) {
    if (this.settings.get('pointerMode') === 'zone' && this.source !== 'mouse') {
      const z = this.zoneRect();
      const u = (px - z.x) / z.w;
      const v = (py - z.y) / z.h;
      this.uiPt.x = Math.min(1, Math.max(0, u)) * PHONE_UI.width;
      this.uiPt.y = Math.min(1, Math.max(0, v)) * PHONE_UI.height;
      this.uiPt.inside = u >= -0.05 && u <= 1.05 && v >= -0.05 && v <= 1.05;
      return this.uiPt;
    }
    return this.holoScene.screenToUI(px, py, this.uiPt);
  }

  // ----------------------------------------------------------- per frame ---
  /** Render-rate update. Returns the cursor overlay state. */
  update(dt) {
    const c = this.cursorState;
    const st = this.settings.state;
    this.cursor.update(dt);
    const rs = this.recognizer.state;
    const handActive = this.source === 'hand' && rs.tracked;
    const mouseActive = this.source === 'mouse';
    const active = this.holo.interactive && (handActive || mouseActive);

    if (active) {
      this.toUI(this.cursor.x, this.cursor.y);
      this.phone.pointerMove(this.uiPt.x, this.uiPt.y, this.uiPt.inside);
      this.holoScene.hover.u = this.uiPt.x / PHONE_UI.width;
      this.holoScene.hover.v = 1 - this.uiPt.y / PHONE_UI.height;
      this.holoScene.hover.strength += ((this.uiPt.inside ? 1 : 0) - this.holoScene.hover.strength) * 0.2;
    } else {
      this.phone.pointerMove(-1, -1, false);
      this.holoScene.hover.strength *= 0.85;
    }

    // Mouse long-press closes the current app (mirrors pinch-and-hold).
    let mouseHold = 0;
    if (this.mouse && !this.mouse.dragging && !this.mouse.holdFired && this.holo.interactive && !this.phone.router.isHome) {
      const held = performance.now() - this.mouse.t;
      const startShow = st.clickMaxMs * 0.6;
      mouseHold = Math.max(0, Math.min(1, (held - startShow) / (st.holdMs - startShow)));
      if (held >= st.holdMs) {
        this.mouse.holdFired = true;
        this.feedback.show('CLOSING APPLICATION');
        this.phone.release();
        this.phone.home();
      }
    }

    // Cursor overlay (drawn into the recorded canvas).
    let dx = this.cursor.x;
    let dy = this.cursor.y;
    if (active && st.pointerMode === 'zone' && handActive) {
      const s = this.holoScene.uiToScreen(this.uiPt.x, this.uiPt.y, this.tmp);
      dx = s.x;
      dy = s.y;
    }
    c.visible = st.showCursor && (handActive || (mouseActive && this.holo.visible && !this.status.get('presentation')));
    c.x = dx;
    c.y = dy;
    c.press = (handActive && rs.pinching) || (mouseActive && this.mouse) ? 1 : 0;
    c.hold = handActive && this.holo.interactive && !this.phone.router.isHome && rs.pinching && !rs.dragging ? rs.holdProgress : mouseHold;
    c.gesture = handActive ? Math.max(rs.summonProgress, rs.dismissProgress) : 0;
    c.hover = active && this.phone.ui.hoverId !== null;
    c.size = Math.max(44, this.canvas.height * 0.07);
    return c;
  }

  // --------------------------------------------------------------- mouse ---
  bindMouse() {
    const cv = this.canvas;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * cv.width) / r.width, y: ((e.clientY - r.top) * cv.height) / r.height };
    };
    this.onPointerMove = (e) => {
      const p = pos(e);
      this.lastMouseMove = performance.now();
      if (this.source !== 'mouse') this.source = 'mouse';
      this.cursor.snap(p.x, p.y);
      const m = this.mouse;
      if (m && this.holo.interactive) {
        const dist = Math.hypot(p.x - m.x, p.y - m.y);
        if (!m.dragging && dist > 8) {
          m.dragging = true;
          this.phone.release();
          this.phone.beginScroll(m.ui.x, m.ui.y);
        }
        if (m.dragging) {
          const ddy = (p.y - m.lastY) * this.uiPerScreenPx();
          const now = performance.now();
          m.vy = (ddy / Math.max(1, now - m.lastT)) * 1000;
          m.lastT = now;
          this.phone.scrollBy(ddy, 200);
        }
        m.lastY = p.y;
      }
    };
    this.onPointerDown = (e) => {
      if (e.button !== 0) return;
      const p = pos(e);
      this.lastMouseMove = performance.now();
      this.source = 'mouse';
      this.cursor.snap(p.x, p.y);
      if (!this.holo.interactive) return;
      const ui = this.holoScene.screenToUI(p.x, p.y, { x: 0, y: 0, inside: false });
      this.mouse = { x: p.x, y: p.y, lastY: p.y, lastT: performance.now(), vy: 0, t: performance.now(), dragging: false, holdFired: false, ui };
      if (ui.inside) this.phone.press(ui.x, ui.y);
      cv.setPointerCapture?.(e.pointerId);
    };
    this.onPointerUp = (e) => {
      const m = this.mouse;
      this.mouse = null;
      this.phone.release();
      if (!m || !this.holo.interactive) return;
      if (m.dragging) {
        this.phone.endScroll(m.vy);
        return;
      }
      if (m.holdFired) return;
      const p = pos(e);
      const ui = this.holoScene.screenToUI(p.x, p.y, { x: 0, y: 0, inside: false });
      if (ui.inside) {
        const id = this.phone.click(ui.x, ui.y);
        if (id && id.startsWith('home-')) this.feedback.show('APPLICATION OPENING');
      }
    };
    this.onWheel = (e) => {
      if (!this.holo.interactive) return;
      const p = pos(e);
      const ui = this.holoScene.screenToUI(p.x, p.y, { x: 0, y: 0, inside: false });
      if (ui.inside) {
        e.preventDefault();
        this.phone.wheel(ui.x, ui.y, e.deltaY * 0.7);
      }
    };
    this.onContext = (e) => {
      e.preventDefault();
      if (this.holo.interactive) this.phone.back();
    };
    this.onLeave = () => {
      if (this.source === 'mouse') this.source = null;
    };
    cv.addEventListener('pointermove', this.onPointerMove);
    cv.addEventListener('pointerdown', this.onPointerDown);
    cv.addEventListener('pointerup', this.onPointerUp);
    cv.addEventListener('pointercancel', this.onPointerUp);
    cv.addEventListener('pointerleave', this.onLeave);
    cv.addEventListener('wheel', this.onWheel, { passive: false });
    cv.addEventListener('contextmenu', this.onContext);
  }

  /** Hand tracking stopped (camera off / model error): reset safely. */
  resetTracking() {
    this.recognizer.reset();
    this.phone.release();
    this.phone.endScroll(0);
    this.debugHands.length = 0;
    if (this.source === 'hand') this.source = null;
    this.status.set({ hand: 'none' });
  }

  dispose() {
    this.unsub?.();
    const cv = this.canvas;
    cv.removeEventListener('pointermove', this.onPointerMove);
    cv.removeEventListener('pointerdown', this.onPointerDown);
    cv.removeEventListener('pointerup', this.onPointerUp);
    cv.removeEventListener('pointercancel', this.onPointerUp);
    cv.removeEventListener('pointerleave', this.onLeave);
    cv.removeEventListener('wheel', this.onWheel);
    cv.removeEventListener('contextmenu', this.onContext);
  }
}

function makePoints() {
  return Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
}
