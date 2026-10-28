import { defaultSettings, SETTINGS_SCHEMA, STORAGE_KEYS } from '../config/appConfig.js';

/** Minimal observable store. Listeners receive (state, changedKeys). */
export class Store {
  constructor(initial = {}) {
    this.state = { ...initial };
    this.listeners = new Set();
  }

  get(key) {
    return key === undefined ? this.state : this.state[key];
  }

  set(patch) {
    const changed = [];
    for (const [k, v] of Object.entries(patch)) {
      if (this.state[k] !== v) {
        this.state[k] = v;
        changed.push(k);
      }
    }
    if (changed.length) for (const fn of [...this.listeners]) fn(this.state, changed);
    return changed;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

/** Coerces a raw value to the schema type and clamps ranges. Unknown keys are dropped. */
export function sanitizeSetting(key, value) {
  const def = SETTINGS_SCHEMA.find((s) => s.key === key);
  if (!def) return undefined;
  switch (def.type) {
    case 'range': {
      const n = Number(value);
      if (!Number.isFinite(n)) return def.default;
      return Math.min(def.max, Math.max(def.min, n));
    }
    case 'toggle':
      return Boolean(value);
    case 'select':
      return def.options.includes(String(value)) ? String(value) : def.default;
    case 'text':
      return typeof value === 'string' && value.trim() ? value.trim() : def.default;
    default:
      return def.default;
  }
}

/** Settings store persisted to localStorage (or any Storage-like object). */
export class SettingsStore extends Store {
  constructor(storage = safeLocalStorage()) {
    super(defaultSettings());
    this.storage = storage;
    this.load();
    this.subscribe(() => this.save());
  }

  load() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.settings);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      for (const [k, v] of Object.entries(parsed)) {
        const clean = sanitizeSetting(k, v);
        if (clean !== undefined) this.state[k] = clean;
      }
    } catch {
      /* corrupt storage -> keep defaults */
    }
  }

  save() {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEYS.settings, JSON.stringify(this.state));
    } catch {
      /* quota / private mode -> ignore */
    }
  }

  update(key, value) {
    const clean = sanitizeSetting(key, value);
    if (clean === undefined) return;
    this.set({ [key]: clean });
  }

  reset() {
    this.set(defaultSettings());
  }
}

export function safeLocalStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__phantom_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

/** Runtime (non-persisted) status shown by the UI. */
export function createStatusStore() {
  return new Store({
    camera: 'idle', // idle | requesting | starting | live | error | stopped
    cameraError: '',
    cameraLabel: '',
    tracking: 'off', // off | loading | ready | error
    trackingError: '',
    trackingBackend: '',
    hand: 'none', // none | tracked | lost
    demoMode: false,
    presentation: false,
    recording: 'idle', // idle | countdown | recording | paused | finished | error
    fps: 0,
    trackFps: 0,
    inferenceMs: 0,
    quality: 'medium',
    hologram: 'hidden',
  });
}
