import { h } from './dom.js';

/**
 * Subtle gesture-feedback labels ("PINCH DETECTED", "TRACKING LOST", …).
 * DOM only — never part of the recorded canvas. Hidden when disabled in
 * settings or while presentation mode is active.
 */
export class FeedbackToasts {
  constructor(root, settings, status) {
    this.settings = settings;
    this.status = status;
    this.el = h('div', { class: 'feedback', 'aria-live': 'polite' });
    root.appendChild(this.el);
    this.last = new Map();
  }

  get enabled() {
    return this.settings.get('showFeedback') && !this.status.get('presentation');
  }

  /** kind: 'ok' | 'info' | 'warn' */
  show(label, kind = 'ok') {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - (this.last.get(label) || 0) < 700) return;
    this.last.set(label, now);
    const item = h('div', { class: `feedback-item ${kind}` }, [h('span', { class: 'dot' }), label]);
    this.el.appendChild(item);
    while (this.el.children.length > 4) this.el.firstChild.remove();
    setTimeout(() => item.classList.add('out'), 1300);
    setTimeout(() => item.remove(), 1700);
  }

  /** Operator messages (not gesture feedback) — shown even in presentation mode. */
  notice(label, kind = 'info', ms = 3500) {
    const item = h('div', { class: `feedback-item notice ${kind}` }, [h('span', { class: 'dot' }), label]);
    this.el.appendChild(item);
    setTimeout(() => item.classList.add('out'), ms);
    setTimeout(() => item.remove(), ms + 400);
  }
}
