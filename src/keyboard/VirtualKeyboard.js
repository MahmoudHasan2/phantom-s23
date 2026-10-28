import { keyAt } from '../interactions/HitTesting.js';
import { C, fillRound, font, glyph, strokeRound } from '../uicanvas/draw.js';
import { KeyboardModel, layoutKeys } from './KeyboardModel.js';

/**
 * Holographic on-screen keyboard rendered into the phone UI canvas.
 *
 * The whole keyboard registers a single region; the key is resolved with
 * `keyAt` using an enlarged hitbox, which is more forgiving than per-key
 * regions when the tracked fingertip jitters. A key commits once per click
 * event (pinch release), so a finger resting on a key never auto-repeats.
 */
export class VirtualKeyboard {
  constructor({ layout = 'qwertz', onKey = null } = {}) {
    this.model = new KeyboardModel(layout);
    this.hitboxScale = 1.25;
    this.onKey = onKey; // (result, key) => void
    this.keys = [];
    this.cacheKey = '';
    this.flash = new Map(); // keyId -> time of last press
    this.pressedKey = null;
    this.rect = { x: 0, y: 0, w: 0, h: 0 };
    this.buffer = null;
  }

  static HEIGHT = 250;

  setLayout(layout) {
    if (layout !== this.model.layout) {
      this.model.setLayout(layout);
      this.cacheKey = '';
    }
  }

  attach(buffer) {
    this.buffer = buffer;
  }

  ensureLayout(x, y, w, h) {
    const key = `${this.model.layout}|${this.model.layer}|${this.model.shift || this.model.capsLock}|${x}|${y}|${w}|${h}`;
    if (key !== this.cacheKey) {
      this.cacheKey = key;
      this.keys = layoutKeys(this.model.rows(), x, y, w, h);
    }
  }

  /** Draw at (x, y, w, h) in the current UI coordinate space. */
  render(ui, x, y, w, h) {
    const ctx = ui.ctx;
    this.rect = { x, y, w, h };
    this.ensureLayout(x, y, w, h);
    fillRound(ctx, x, y, w, h + 30, 18, 'rgba(6, 18, 26, 0.82)');
    ctx.fillStyle = 'rgba(120,230,255,0.35)';
    ctx.fillRect(x + 20, y, w - 40, 1);

    // Hover key from pointer (absolute -> local is identical: keyboard is not inside a scroll view).
    const p = ui.pointer;
    const hover = ui.inputEnabled && p.inside ? keyAt(this.keys, p.x - ui.offsetX, p.y - ui.offsetY, this.hitboxScale) : null;

    // Key rects are local; regions/pointer are absolute. Remember the origin.
    this.originX = ui.offsetX;
    this.originY = ui.offsetY;
    ui.region('keyboard', x, y, w, h, {
      kind: 'keyboard',
      onPress: (ax, ay) => {
        this.pressedKey = keyAt(this.keys, ax - this.originX, ay - this.originY, this.hitboxScale);
      },
      onClick: (ax, ay) => this.clickAt(ax, ay, ui.time),
    });

    for (const k of this.keys) {
      const flashT = this.flash.get(k.id);
      const flashA = flashT !== undefined ? Math.max(0, 1 - (ui.time - flashT) / 0.28) : 0;
      const isHover = hover && hover.id === k.id;
      const isPressed = this.pressedKey && this.pressedKey.id === k.id;
      const special = k.type !== 'char';
      const active = k.type === 'shift' && (this.model.shift || this.model.capsLock);
      const pressScale = flashA > 0 ? 1 - 0.08 * flashA : isPressed ? 0.94 : 1;
      const kw = k.w * pressScale;
      const kh = k.h * pressScale;
      const kx = k.x + (k.w - kw) / 2;
      const ky = k.y + (k.h - kh) / 2;
      fillRound(ctx, kx, ky, kw, kh, 7, special ? 'rgba(40, 80, 100, 0.55)' : 'rgba(30, 60, 78, 0.5)');
      if (active) fillRound(ctx, kx, ky, kw, kh, 7, 'rgba(88,225,255,0.35)');
      if (isHover) fillRound(ctx, kx, ky, kw, kh, 7, C.hover);
      if (isPressed || flashA > 0) fillRound(ctx, kx, ky, kw, kh, 7, `rgba(150,240,255,${0.35 + 0.5 * Math.max(flashA, isPressed ? 0.6 : 0)})`);
      strokeRound(ctx, kx + 0.5, ky + 0.5, kw - 1, kh - 1, 7, isHover ? 'rgba(160,240,255,0.95)' : 'rgba(120,220,255,0.28)', isHover ? 1.4 : 1);
      const cx = kx + kw / 2;
      const cy = ky + kh / 2;
      if (k.type === 'backspace') glyph(ctx, 'backspace', cx, cy, 20, C.text, 1.6);
      else if (k.type === 'shift') glyph(ctx, 'shift', cx, cy, 18, active ? C.accent2 : C.text, 1.6);
      else if (k.type === 'enter') glyph(ctx, 'enter', cx, cy, 20, C.text, 1.6);
      else {
        const size = k.type === 'space' || k.type === 'layer' ? 12 : 19;
        ctx.font = font(size, k.type === 'char' ? 500 : 600);
        ctx.fillStyle = k.type === 'space' ? C.dim : C.text;
        ctx.textAlign = 'center';
        ctx.fillText(k.label, cx, cy + size * 0.36);
      }
      // Enlarged key preview above the hovered character key.
      if (isHover && k.type === 'char' && ky > y + 4) {
        fillRound(ctx, cx - 20, ky - 46, 40, 42, 9, 'rgba(20,70,90,0.92)');
        strokeRound(ctx, cx - 20, ky - 46, 40, 42, 9, 'rgba(160,240,255,0.8)', 1);
        ctx.font = font(24, 600);
        ctx.fillStyle = '#fff';
        ctx.fillText(k.label, cx, ky - 16);
      }
    }
  }

  /** Commit the key under an absolute UI point. */
  clickAt(ax, ay, now) {
    const k = keyAt(this.keys, ax - (this.originX || 0), ay - (this.originY || 0), this.hitboxScale);
    this.pressedKey = null;
    if (!k || !this.buffer) return null;
    const res = this.model.press(k, this.buffer, now * 1000);
    this.flash.set(k.id, now);
    this.onKey?.(res, k);
    return res;
  }

  releasePress() {
    this.pressedKey = null;
  }
}
