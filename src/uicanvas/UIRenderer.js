import { hitTestRegions, intersectRect, pointInRect } from '../interactions/HitTesting.js';
import { ScrollPhysics } from '../interactions/ScrollPhysics.js';

/**
 * Immediate-mode 2-D UI renderer for the simulated phone.
 *
 * Apps draw into an offscreen canvas every time the UI is dirty and register
 * interactive regions while drawing. That canvas becomes the texture of the
 * holographic screen, so the phone UI is part of the recorded WebGL frame.
 *
 * Coordinates are logical phone pixels (PHONE_UI.width x height); the backing
 * canvas is scaled by `scale` for crisp text.
 */
export class UIRenderer {
  constructor(width, height, scale = 2) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.setScale(scale);

    this.regions = [];
    this.prevRegions = [];
    this.offsetX = 0;
    this.offsetY = 0;
    this.offsetStack = [];
    this.clip = null;
    this.clipStack = [];
    this.scrollStack = [];
    this.scrolls = new Map(); // id -> ScrollPhysics
    this.scrollViewports = []; // [{id, rect}] registered this frame
    this.prevScrollViewports = [];
    this.inputEnabled = true;

    this.pointer = { x: -1, y: -1, inside: false, down: false };
    this.hoverId = null;
    this.pressId = null;
    this.time = 0;
  }

  setScale(scale) {
    this.scale = scale;
    this.canvas.width = Math.round(this.width * scale);
    this.canvas.height = Math.round(this.height * scale);
  }

  // ---------------------------------------------------------------- frame ----
  begin(time) {
    this.time = time;
    this.prevRegions = this.regions;
    this.regions = [];
    this.prevScrollViewports = this.scrollViewports;
    this.scrollViewports = [];
    this.offsetX = this.offsetY = 0;
    this.offsetStack.length = 0;
    this.clip = null;
    this.clipStack.length = 0;
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }

  end() {
    // Hover is resolved against this frame's regions for use in the next frame.
    const hit = this.pointer.inside ? hitTestRegions(this.regions, this.pointer.x, this.pointer.y) : null;
    this.hoverId = hit ? hit.id : null;
  }

  // ------------------------------------------------------------ transform ----
  pushOffset(dx, dy) {
    this.offsetStack.push(this.offsetX, this.offsetY);
    this.offsetX += dx;
    this.offsetY += dy;
    this.ctx.save();
    this.ctx.translate(dx, dy);
  }

  popOffset() {
    this.ctx.restore();
    this.offsetY = this.offsetStack.pop();
    this.offsetX = this.offsetStack.pop();
  }

  pushClip(x, y, w, h) {
    const abs = { x: x + this.offsetX, y: y + this.offsetY, w, h };
    this.clipStack.push(this.clip);
    this.clip = intersectRect(this.clip, abs);
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  }

  popClip() {
    this.ctx.restore();
    this.clip = this.clipStack.pop();
  }

  // -------------------------------------------------------------- regions ----
  /**
   * Register an interactive region. Returns a small state object for styling.
   * opts: { onClick, kind, data, disabled }
   */
  region(id, x, y, w, h, opts = {}) {
    const r = {
      id,
      x: x + this.offsetX,
      y: y + this.offsetY,
      w,
      h,
      clip: this.clip,
      onClick: opts.onClick || null,
      onPress: opts.onPress || null,
      kind: opts.kind || 'button',
      disabled: !this.inputEnabled || !!opts.disabled,
    };
    this.regions.push(r);
    return { hovered: this.inputEnabled && this.hoverId === id, pressed: this.inputEnabled && this.pressId === id };
  }

  isHovered(id) {
    return this.inputEnabled && this.hoverId === id;
  }

  isPressed(id) {
    return this.inputEnabled && this.pressId === id;
  }

  // --------------------------------------------------------------- scroll ----
  scrollState(id) {
    let s = this.scrolls.get(id);
    if (!s) {
      s = new ScrollPhysics();
      this.scrolls.set(id, s);
    }
    return s;
  }

  resetScroll(id) {
    this.scrolls.delete(id);
  }

  /**
   * Begin a vertically scrolling viewport. Content is drawn in local
   * coordinates starting at y=0; returns the current scroll offset.
   */
  beginScroll(id, x, y, w, h) {
    const s = this.scrollState(id);
    this.scrollViewports.push({ id, x: x + this.offsetX, y: y + this.offsetY, w, h, clip: this.clip });
    this.pushClip(x, y, w, h);
    this.pushOffset(x, y - s.offset);
    this.scrollStack.push({ id, h, offset: s.offset });
    return s.offset;
  }

  /** Close the viewport, recording the measured content height for bounds. */
  endScroll(contentHeight) {
    const top = this.scrollStack.pop();
    this.popOffset();
    this.popClip();
    this.scrollState(top.id).setBounds(contentHeight, top.h);
  }

  /** True if a band [y, y+h) in current scroll-local coords is on screen. Used for culling. */
  visible(y, h) {
    const top = this.scrollStack[this.scrollStack.length - 1];
    if (!top) return true;
    return y + h >= top.offset - 40 && y <= top.offset + top.h + 40;
  }

  /** Scroll viewport under a point, else the largest viewport of the last frame. */
  scrollTargetAt(x, y) {
    const list = this.scrollViewports.length ? this.scrollViewports : this.prevScrollViewports;
    for (let i = list.length - 1; i >= 0; i--) {
      const v = list[i];
      if (pointInRect(x, y, v) && (!v.clip || pointInRect(x, y, v.clip))) return v.id;
    }
    let best = null;
    for (const v of list) if (!best || v.w * v.h > best.w * best.h) best = v;
    return best ? best.id : null;
  }

  /** Steps all scroll physics; returns true if anything is moving. */
  stepScrolls(dt) {
    let moving = false;
    for (const s of this.scrolls.values()) moving = s.step(dt) || moving;
    return moving;
  }

  // ---------------------------------------------------------------- input ----
  setPointer(x, y, inside) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.inside = inside;
  }

  hitTest(x, y) {
    return hitTestRegions(this.regions.length ? this.regions : this.prevRegions, x, y);
  }

  dispose() {
    this.canvas.width = this.canvas.height = 0;
    this.scrolls.clear();
  }
}
