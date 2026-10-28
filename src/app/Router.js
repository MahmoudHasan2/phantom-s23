/**
 * Stack-based navigation for the simulated phone.
 *
 * A route is { app: string, view: string, params: object }.
 * The bottom of the stack is always the home screen.
 */
export const HOME = Object.freeze({ app: 'home', view: 'main', params: {} });

export const APP_IDS = [
  'facebook', 'whatsapp', 'youtube', 'instagram', 'phone',
  'messages', 'camera', 'gallery', 'settings',
];

export class Router {
  constructor() {
    this.stack = [HOME];
    this.listeners = new Set();
  }

  get current() {
    return this.stack[this.stack.length - 1];
  }

  get isHome() {
    return this.stack.length === 1;
  }

  get depth() {
    return this.stack.length;
  }

  /** Launch an app from the home screen. Re-launching resets that app to its root view. */
  openApp(app, view = 'main', params = {}) {
    if (!APP_IDS.includes(app)) throw new Error(`Unknown app: ${app}`);
    const from = this.current;
    this.stack = [HOME, { app, view, params }];
    this.emit('open', from);
    return this.current;
  }

  /** Navigate deeper inside the current app (e.g. chat list -> chat). */
  push(view, params = {}) {
    if (this.isHome) throw new Error('Cannot push a view on the home screen');
    const from = this.current;
    this.stack.push({ app: this.current.app, view, params });
    this.emit('push', from);
    return this.current;
  }

  /** Back one level. Returns false if already at home. */
  back() {
    if (this.isHome) return false;
    const from = this.current;
    this.stack.pop();
    this.emit(this.isHome ? 'close' : 'back', from);
    return true;
  }

  /** Close the current app entirely and return home. */
  home() {
    if (this.isHome) return false;
    const from = this.current;
    this.stack = [HOME];
    this.emit('close', from);
    return true;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, from) {
    for (const fn of [...this.listeners]) fn({ type, from, to: this.current });
  }
}
