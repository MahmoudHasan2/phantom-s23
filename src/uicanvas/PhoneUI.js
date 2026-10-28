import { PHONE_UI } from '../config/appConfig.js';
import { Router } from '../app/Router.js';
import { UIRenderer } from './UIRenderer.js';
import { C, fillRound, font, glyph, interactionGlow, roundRectPath, text } from './draw.js';
import { VirtualKeyboard } from '../keyboard/VirtualKeyboard.js';
import { TextBuffer } from '../keyboard/KeyboardModel.js';
import { HomeScreen, homeIconRect } from '../apps/HomeScreen.js';
import { FacebookDemo } from '../apps/FacebookDemo.js';
import { WhatsAppDemo } from '../apps/WhatsAppDemo.js';
import { YouTubeDemo } from '../apps/YouTubeDemo.js';
import { InstagramDemo } from '../apps/InstagramDemo.js';
import { PhoneDemo } from '../apps/PhoneDemo.js';
import { MessagesDemo } from '../apps/MessagesDemo.js';
import { CameraDemo } from '../apps/CameraDemo.js';
import { GalleryDemo } from '../apps/GalleryDemo.js';
import { SettingsApp } from '../apps/SettingsApp.js';

export const STATUS_H = 34;
export const NAV_H = 46;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * The simulated phone: owns the UI canvas, router, apps, keyboard, transitions
 * and input dispatch. Coordinates passed in are phone-UI pixels.
 */
export class PhoneUI {
  constructor({ settings, content, sound, video, services }) {
    this.settings = settings; // SettingsStore
    this.content = content;
    this.sound = sound;
    this.video = video;
    this.services = services; // { openExternal(url), openPanel(), chats: {whatsapp, messages}, gallery }
    this.W = PHONE_UI.width;
    this.H = PHONE_UI.height;
    this.ui = new UIRenderer(this.W, this.H, 2);
    this.router = new Router();
    this.keyboard = new VirtualKeyboard({ layout: settings.get('keyboardLayout'), onKey: (res) => this.onKeyboard(res) });
    this.keyboardShown = false;
    this.keyboardAnim = 0;
    this.composer = null; // { buffer, onSend }
    this.transition = null;
    this.toasts = [];
    this.ripples = [];
    this.formation = 0;
    this.dirty = true;
    this.lastDraw = -1;
    this.maxFps = 30; // set from the quality preset
    this.dragScrollId = null;

    const shell = this;
    this.apps = {
      home: new HomeScreen(shell),
      facebook: new FacebookDemo(shell),
      whatsapp: new WhatsAppDemo(shell),
      youtube: new YouTubeDemo(shell),
      instagram: new InstagramDemo(shell),
      phone: new PhoneDemo(shell),
      messages: new MessagesDemo(shell),
      camera: new CameraDemo(shell),
      gallery: new GalleryDemo(shell),
      settings: new SettingsApp(shell),
    };

    this.router.subscribe((e) => this.onRoute(e));
  }

  get canvas() {
    return this.ui.canvas;
  }

  get contentArea() {
    return { x: 0, y: STATUS_H, w: this.W, h: this.H - STATUS_H - NAV_H };
  }

  setScale(scale) {
    if (Math.abs(scale - this.ui.scale) > 0.01) {
      this.ui.setScale(scale);
      this.dirty = true;
    }
  }

  // ------------------------------------------------------------- routing ----
  onRoute(e) {
    const now = this.ui.time;
    const speed = this.settings.get('animSpeed');
    const skip = this.settings.get('skipAnimations');
    this.hideKeyboard();
    this.dragScrollId = null;
    if (e.type === 'open') {
      this.apps[e.to.app].onEnter?.(e.to);
      this.sound?.play('open');
      if (!skip) this.transition = { type: 'launch', app: e.to.app, start: now, duration: 0.42 / speed };
    } else if (e.type === 'close') {
      this.sound?.play('close');
      if (!skip) this.transition = { type: 'close', app: e.from.app, fromRoute: e.from, start: now, duration: 0.36 / speed };
    } else if (e.type === 'push' || e.type === 'back') {
      this.apps[e.to.app].onEnter?.(e.to);
      this.sound?.play('tick');
      if (!skip) this.transition = { type: e.type, fromRoute: e.from, start: now, duration: 0.3 / speed };
    }
    this.dirty = true;
  }

  openApp(id) {
    this.router.openApp(id);
  }

  /** Silent reset (no transition) used when the hologram is dismissed. */
  resetToHome() {
    this.router.stack = [this.router.stack[0]];
    this.transition = null;
    this.keyboardShown = false;
    this.keyboardAnim = 0;
    this.dragScrollId = null;
    this.ui.pressId = null;
    this.dirty = true;
  }

  /** Back: closes the keyboard first, then navigates. */
  back() {
    if (this.transition) return false;
    if (this.keyboardShown) {
      this.hideKeyboard();
      return true;
    }
    return this.router.back();
  }

  home() {
    if (this.transition) return false;
    return this.router.home();
  }

  toast(msg, seconds = 2.2) {
    this.toasts.push({ text: msg, start: this.ui.time, until: this.ui.time + seconds });
    if (this.toasts.length > 3) this.toasts.shift();
    this.dirty = true;
  }

  // ------------------------------------------------------------- keyboard ---
  /** Focus a text composer and slide the keyboard in. */
  focusComposer(buffer, onSend) {
    this.composer = { buffer, onSend };
    this.keyboard.attach(buffer);
    this.keyboard.setLayout(this.settings.get('keyboardLayout'));
    this.keyboardShown = true;
    this.dirty = true;
  }

  hideKeyboard() {
    this.keyboardShown = false;
    this.keyboard.releasePress();
    this.dirty = true;
  }

  onKeyboard(res) {
    this.sound?.play('key');
    if (res.action === 'enter' && this.composer) this.composer.onSend?.();
    this.dirty = true;
  }

  createBuffer(text = '') {
    return new TextBuffer(text);
  }

  // ---------------------------------------------------------------- input ---
  pointerMove(x, y, inside) {
    const p = this.ui.pointer;
    if (p.inside !== inside || Math.abs(p.x - x) > 0.3 || Math.abs(p.y - y) > 0.3) this.dirty = true;
    this.ui.setPointer(x, y, inside);
  }

  /** Pinch closed / mouse down. */
  press(x, y) {
    if (this.transition) return;
    const r = this.ui.hitTest(x, y);
    this.ui.pressId = r ? r.id : null;
    r?.onPress?.(x, y);
    this.dirty = true;
  }

  release() {
    this.ui.pressId = null;
    this.keyboard.releasePress();
    this.dirty = true;
  }

  /** Activate whatever is under (x, y). Returns the region id or null. */
  click(x, y) {
    if (this.transition) return null;
    const r = this.ui.hitTest(x, y);
    this.ripples.push({ x, y, t: this.ui.time });
    this.dirty = true;
    if (!r || !r.onClick) return null;
    if (r.kind !== 'keyboard') this.sound?.play('click');
    r.onClick(x, y);
    return r.id;
  }

  beginScroll(x, y) {
    this.dragScrollId = this.ui.scrollTargetAt(x, y);
    if (this.dragScrollId) this.ui.scrollState(this.dragScrollId).startDrag();
  }

  /** Content follows the finger: finger moves up (dy<0) -> content scrolls down. */
  scrollBy(dy, maxStep) {
    if (this.transition) return;
    if (!this.dragScrollId) this.beginScroll(this.ui.pointer.x, this.ui.pointer.y);
    if (!this.dragScrollId) return;
    this.ui.scrollState(this.dragScrollId).applyDelta(-dy, maxStep);
    this.dirty = true;
  }

  endScroll(vy = 0) {
    if (this.dragScrollId) this.ui.scrollState(this.dragScrollId).release(-vy);
    this.dragScrollId = null;
    this.dirty = true;
  }

  /** Mouse-wheel style scrolling (no drag state). */
  wheel(x, y, dy) {
    const id = this.ui.scrollTargetAt(x, y);
    if (!id) return;
    const s = this.ui.scrollState(id);
    s.offset = Math.max(0, Math.min(s.max, s.offset + dy));
    this.dirty = true;
  }

  // ------------------------------------------------------------- drawing ----
  /**
   * Redraws the phone canvas if needed.
   * @returns {boolean} true if the canvas changed (texture must be re-uploaded)
   */
  draw(time, dt, formation) {
    const ui = this.ui;
    ui.time = time;
    if (formation !== this.formation) {
      this.formation = formation;
      this.dirty = true;
    }
    const chatsMoved = this.services.chats.whatsapp.update(time * 1000) | this.services.chats.messages.update(time * 1000);
    if (chatsMoved) this.dirty = true;
    if (ui.stepScrolls(dt)) this.dirty = true;
    const kbTarget = this.keyboardShown ? 1 : 0;
    if (this.keyboardAnim !== kbTarget) {
      const step = dt * 7 * this.settings.get('animSpeed');
      this.keyboardAnim = kbTarget > this.keyboardAnim ? Math.min(1, this.keyboardAnim + step) : Math.max(0, this.keyboardAnim - step);
      this.dirty = true;
    }
    if (this.transition || this.ripples.length || this.toasts.length) this.dirty = true;
    const current = this.apps[this.router.current.app];
    if (current.animating?.(time)) this.dirty = true;
    // Caret blink / clock: refresh at least twice per second.
    if (time - this.lastDraw > 0.5) this.dirty = true;
    if (!this.dirty) return false;
    // Rate-limit redraws: each one re-uploads the texture. Pending changes stay dirty.
    if (time - this.lastDraw < 1 / this.maxFps - 0.002) return false;
    this.dirty = false;
    this.lastDraw = time;

    ui.begin(time);
    const ctx = ui.ctx;
    this.keyboard.hitboxScale = this.settings.get('keyHitbox');

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, '#03141c');
    bg.addColorStop(0.55, '#020a10');
    bg.addColorStop(1, '#041820');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.W, this.H);

    const tr = this.transition;
    let tp = 0;
    if (tr) {
      tp = Math.min(1, (time - tr.start) / tr.duration);
      if (tp >= 1) this.transition = null;
    }
    ui.inputEnabled = !this.transition && formation >= 0.999;

    if (this.transition) this.drawTransition(this.transition, tp);
    else this.drawRoute(this.router.current, 0);

    this.drawKeyboardLayer();
    this.drawStatusBar();
    this.drawNavBar();
    this.drawRipples(time);
    this.drawToasts(time);
    ui.end();
    return true;
  }

  drawRoute(route, offsetX) {
    const area = this.contentArea;
    const app = this.apps[route.app];
    if (offsetX) this.ui.pushOffset(offsetX, 0);
    this.ui.pushClip(area.x, area.y, area.w, area.h);
    app.render(this.ui, route, area, this.ui.time);
    this.ui.popClip();
    if (offsetX) this.ui.popOffset();
  }

  drawTransition(tr, p) {
    const ctx = this.ui.ctx;
    if (tr.type === 'launch' || tr.type === 'close') {
      const k = tr.type === 'launch' ? easeOutCubic(p) : 1 - easeInOut(p);
      this.drawRoute({ app: 'home', view: 'main', params: {} }, 0);
      const icon = homeIconRect(tr.app, this.contentArea);
      const area = this.contentArea;
      const x = icon.x + (area.x - icon.x) * k;
      const y = icon.y + (area.y - icon.y) * k;
      const w = icon.w + (area.w - icon.w) * k;
      const h = icon.h + (area.h - icon.h) * k;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.6);
      roundRectPath(ctx, x, y, w, h, 26 * (1 - k) + 4);
      ctx.clip();
      ctx.translate(x, y);
      ctx.scale(w / area.w, h / area.h);
      ctx.translate(-area.x, -area.y);
      ctx.fillStyle = '#02090e';
      ctx.fillRect(area.x, area.y, area.w, area.h);
      const route = tr.type === 'launch' ? this.router.current : tr.fromRoute;
      this.apps[route.app].render(this.ui, route, area, this.ui.time);
      ctx.restore();
      // Light sweep along the expanding card edge.
      ctx.save();
      ctx.globalAlpha = (1 - Math.abs(k - 0.5) * 2) * 0.8;
      roundRectPath(ctx, x, y, w, h, 26 * (1 - k) + 4);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    } else {
      const dir = tr.type === 'push' ? 1 : -1;
      const k = easeOutCubic(p);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      this.drawRoute(tr.fromRoute, -dir * this.W * 0.3 * k);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.5);
      this.drawRoute(this.router.current, dir * this.W * (1 - k));
      ctx.restore();
    }
  }

  drawKeyboardLayer() {
    if (this.keyboardAnim <= 0) return;
    const h = VirtualKeyboard.HEIGHT;
    const y = this.H - NAV_H - h * easeOutCubic(this.keyboardAnim);
    this.ui.ctx.save();
    this.ui.ctx.globalAlpha = this.keyboardAnim;
    this.keyboard.render(this.ui, 4, y, this.W - 8, h);
    this.ui.ctx.restore();
  }

  /** Height currently occupied by the keyboard (apps lift their composer by this). */
  get keyboardInset() {
    return VirtualKeyboard.HEIGHT * easeOutCubic(this.keyboardAnim);
  }

  drawStatusBar() {
    const ctx = this.ui.ctx;
    const dev = this.content.device;
    ctx.fillStyle = 'rgba(2, 10, 14, 0.65)';
    ctx.fillRect(0, 0, this.W, STATUS_H);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    text(ctx, `${hh}:${mm}`, 22, 23, 14, C.text, 600);
    // Centre punch-hole camera
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(this.W / 2, 16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Signal bars
    let x = this.W - 112;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < dev.signal ? C.text : 'rgba(255,255,255,0.25)';
      ctx.fillRect(x + i * 5, 23 - (i + 1) * 3.2, 3, (i + 1) * 3.2);
    }
    x += 26;
    if (dev.wifi) {
      ctx.strokeStyle = C.text;
      ctx.lineWidth = 1.6;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(x + 8, 23, i * 3.6, Math.PI * 1.25, Math.PI * 1.75);
        ctx.stroke();
      }
    }
    x += 24;
    text(ctx, `${dev.battery}%`, x + 36, 22, 11, C.dim, 500, 'right');
    x += 40;
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, 13, 22, 11);
    ctx.fillStyle = C.text;
    ctx.fillRect(x + 22, 16, 2, 5);
    ctx.fillStyle = dev.battery > 20 ? C.accent : '#ff6b6b';
    ctx.fillRect(x + 1.5, 14.5, 19 * (dev.battery / 100), 8);
  }

  drawNavBar() {
    const ui = this.ui;
    const ctx = ui.ctx;
    const y = this.H - NAV_H;
    ctx.fillStyle = 'rgba(2, 10, 14, 0.7)';
    ctx.fillRect(0, y, this.W, NAV_H);
    ctx.fillStyle = C.line;
    ctx.fillRect(0, y, this.W, 1);
    const inApp = !this.router.isHome;
    const btns = [
      { id: 'nav-close', x: this.W * 0.2, icon: 'close', on: () => this.home(), enabled: inApp },
      { id: 'nav-home', x: this.W * 0.5, icon: 'homeRing', on: () => this.home(), enabled: inApp },
      { id: 'nav-back', x: this.W * 0.8, icon: 'back', on: () => this.back(), enabled: inApp || this.keyboardShown },
    ];
    for (const b of btns) {
      const st = ui.region(b.id, b.x - 40, y + 3, 80, NAV_H - 6, { onClick: b.on, disabled: !b.enabled });
      interactionGlow(ctx, b.x - 34, y + 6, 68, NAV_H - 12, 14, st);
      const col = b.enabled ? C.text : C.faint;
      if (b.icon === 'homeRing') {
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        roundRectPath(ctx, b.x - 9, y + NAV_H / 2 - 9, 18, 18, 6);
        ctx.stroke();
      } else {
        glyph(ctx, b.icon, b.x, y + NAV_H / 2, 18, col, 2);
      }
    }
  }

  drawRipples(time) {
    const ctx = this.ui.ctx;
    this.ripples = this.ripples.filter((r) => time - r.t < 0.5);
    for (const r of this.ripples) {
      const k = (time - r.t) / 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + k * 34, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(150,240,255,${(1 - k) * 0.8})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  drawToasts(time) {
    const ctx = this.ui.ctx;
    this.toasts = this.toasts.filter((t) => time < t.until);
    let y = this.H - NAV_H - 24 - this.keyboardInset;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      const a = Math.min(1, (time - t.start) * 6, (t.until - time) * 4);
      ctx.font = font(13, 500);
      const w = Math.min(this.W - 40, ctx.measureText(t.text).width + 36);
      ctx.save();
      ctx.globalAlpha = a;
      fillRound(ctx, (this.W - w) / 2, y - 34, w, 34, 17, 'rgba(14, 44, 58, 0.95)');
      ctx.strokeStyle = 'rgba(120,230,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      text(ctx, t.text, this.W / 2, y - 12, 13, C.text, 500, 'center');
      ctx.restore();
      y -= 42;
    }
  }

  dispose() {
    this.ui.dispose();
  }
}
