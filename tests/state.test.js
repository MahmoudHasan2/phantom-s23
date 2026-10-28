import { describe, expect, it } from 'vitest';
import { Router } from '../src/app/Router.js';
import { HologramStateMachine, HOLO } from '../src/app/HologramStateMachine.js';
import { SettingsStore, sanitizeSetting } from '../src/app/AppState.js';
import { ScrollPhysics } from '../src/interactions/ScrollPhysics.js';
import { computeVideoTransform, screenToVideo, videoToScreen } from '../src/camera/videoTransform.js';
import { timeline } from '../src/hologram/HologramAnimations.js';
import { recommendThresholds } from '../src/tracking/GestureCalibration.js';
import { hitTestRegions } from '../src/interactions/HitTesting.js';

describe('Router / application navigation', () => {
  it('opens apps, navigates deeper, goes back and closes to home', () => {
    const r = new Router();
    const log = [];
    r.subscribe((e) => log.push(`${e.type}:${e.to.app}/${e.to.view}`));
    expect(r.isHome).toBe(true);
    r.openApp('whatsapp');
    expect(r.current).toMatchObject({ app: 'whatsapp', view: 'main' });
    r.push('chat', { id: 'wa-lena' });
    expect(r.current.params.id).toBe('wa-lena');
    expect(r.back()).toBe(true);
    expect(r.current.view).toBe('main');
    expect(r.back()).toBe(true);
    expect(r.isHome).toBe(true);
    expect(r.back()).toBe(false);
    expect(log).toEqual(['open:whatsapp/main', 'push:whatsapp/chat', 'back:whatsapp/main', 'close:home/main']);
  });

  it('closing an app from a nested view returns straight home', () => {
    const r = new Router();
    r.openApp('youtube');
    r.push('video', { index: 2 });
    r.push('video', { index: 3 });
    expect(r.home()).toBe(true);
    expect(r.isHome).toBe(true);
    expect(r.depth).toBe(1);
  });

  it('switching apps replaces the previous app', () => {
    const r = new Router();
    r.openApp('facebook');
    r.openApp('instagram');
    expect(r.depth).toBe(2);
    expect(r.current.app).toBe('instagram');
  });

  it('rejects unknown apps and pushing on home', () => {
    const r = new Router();
    expect(() => r.openApp('nope')).toThrow();
    expect(() => r.push('x')).toThrow();
  });
});

describe('Hologram state machine', () => {
  it('summons, becomes interactive, dismisses and hides', () => {
    const m = new HologramStateMachine({ summonDuration: 1, dismissDuration: 0.5 });
    expect(m.interactive).toBe(false);
    m.summon();
    expect(m.state).toBe(HOLO.SUMMONING);
    m.update(0.5);
    expect(m.formation).toBeCloseTo(0.5);
    expect(m.interactive).toBe(false);
    m.update(0.6);
    expect(m.state).toBe(HOLO.ACTIVE);
    expect(m.interactive).toBe(true);
    m.dismiss();
    m.update(1);
    expect(m.state).toBe(HOLO.HIDDEN);
    expect(m.summon()).toBe(true); // can be summoned again
  });

  it('skip mode jumps straight to the final state', () => {
    const m = new HologramStateMachine();
    m.configure({ skip: true });
    m.summon();
    expect(m.state).toBe(HOLO.ACTIVE);
    m.dismiss();
    expect(m.state).toBe(HOLO.HIDDEN);
  });

  it('reversing mid-animation continues from the current formation', () => {
    const m = new HologramStateMachine({ summonDuration: 1, dismissDuration: 1 });
    m.summon();
    m.update(0.7);
    m.dismiss();
    expect(m.formation).toBeCloseTo(0.7);
    m.summon();
    expect(m.formation).toBeCloseTo(0.7);
  });

  it('animation speed scales progress and always completes', () => {
    const m = new HologramStateMachine({ summonDuration: 2 });
    m.configure({ speed: 4 });
    m.summon();
    m.update(0.5);
    expect(m.state).toBe(HOLO.ACTIVE);
  });

  it('timeline layers are ordered and complete at formation 1', () => {
    const a = timeline(0.3);
    expect(a.expand).toBeGreaterThan(a.screen);
    const b = timeline(1);
    expect(b).toMatchObject({ cluster: 1, expand: 1, outline: 1, screen: 1, settle: 1, dissolve: 0 });
    const d = timeline(0.6, true);
    expect(d.disperse).toBe(1);
    expect(d.dissolve).toBeGreaterThan(0);
  });
});

describe('Settings store', () => {
  const mem = () => {
    const m = new Map();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  };

  it('sanitizes and clamps values', () => {
    expect(sanitizeSetting('opacity', 5)).toBe(1);
    expect(sanitizeSetting('opacity', 'abc')).toBe(0.92);
    expect(sanitizeSetting('quality', 'ultra')).toBe('medium');
    expect(sanitizeSetting('mirror', 0)).toBe(false);
    expect(sanitizeSetting('unknownKey', 1)).toBeUndefined();
  });

  it('persists and reloads settings', () => {
    const storage = mem();
    const a = new SettingsStore(storage);
    a.update('glow', 1.5);
    a.update('keyboardLayout', 'qwerty');
    const b = new SettingsStore(storage);
    expect(b.get('glow')).toBe(1.5);
    expect(b.get('keyboardLayout')).toBe('qwerty');
  });

  it('survives corrupt storage', () => {
    const storage = mem();
    storage.setItem('phantom.settings.v1', '{not json');
    expect(() => new SettingsStore(storage)).not.toThrow();
  });
});

describe('Scroll physics', () => {
  it('follows deltas, flings with decay, and springs back inside bounds', () => {
    const s = new ScrollPhysics();
    s.setBounds(2000, 800);
    s.startDrag();
    s.applyDelta(100);
    expect(s.offset).toBe(100);
    s.release(1000);
    for (let i = 0; i < 120; i++) s.step(1 / 60);
    expect(s.offset).toBeGreaterThan(100);
    expect(s.offset).toBeLessThanOrEqual(1200);
    s.scrollTo(0);
    s.startDrag();
    s.applyDelta(-100);
    s.release(0);
    for (let i = 0; i < 120; i++) s.step(1 / 60);
    expect(s.offset).toBe(0);
  });

  it('clamps a single step to the max speed', () => {
    const s = new ScrollPhysics();
    s.setBounds(5000, 800);
    s.applyDelta(500, 70);
    expect(s.offset).toBe(70);
  });
});

describe('Video transform', () => {
  it('round-trips screen <-> video coordinates with mirroring, zoom and pan', () => {
    const t = computeVideoTransform(1920, 1080, 1280, 720, 1.4, 0.2, -0.1);
    for (const mirror of [true, false]) {
      const s = videoToScreen(t, 0.3, 0.6, mirror, 1920, 1080);
      const v = screenToVideo(t, s.x, s.y, mirror, 1920, 1080);
      expect(v.x).toBeCloseTo(0.3);
      expect(v.y).toBeCloseTo(0.6);
    }
  });

  it('cover-crops a 4:3 camera on a 16:9 screen vertically', () => {
    const t = computeVideoTransform(1600, 900, 640, 480);
    expect(t.scaleX).toBe(1);
    expect(t.scaleY).toBeCloseTo(0.75);
    // Mirroring flips x: left video edge maps to the right screen edge.
    expect(videoToScreen(t, 0, 0.5, true, 1600, 900).x).toBeCloseTo(1600);
  });
});

describe('Calibration', () => {
  it('places thresholds between open and pinch distributions', () => {
    const open = [0.9, 1.0, 0.85, 1.1, 0.95, 0.88, 1.05, 0.92];
    const pinch = [0.08, 0.12, 0.1, 0.15, 0.09, 0.11, 0.13, 0.1];
    const r = recommendThresholds(open, pinch);
    expect(r.pinchOn).toBeGreaterThan(0.15);
    expect(r.pinchOff).toBeGreaterThan(r.pinchOn);
    expect(r.pinchOff).toBeLessThan(0.86);
  });

  it('refuses overlapping distributions', () => {
    const r = recommendThresholds([0.3, 0.32, 0.31], [0.3, 0.29, 0.31]);
    expect(r.pinchOn).toBeNull();
  });
});

describe('Region hit testing', () => {
  it('returns the topmost region and honours clip rects', () => {
    const regions = [
      { id: 'list', x: 0, y: 0, w: 100, h: 1000, clip: { x: 0, y: 0, w: 100, h: 300 } },
      { id: 'button', x: 10, y: 10, w: 40, h: 40 },
    ];
    expect(hitTestRegions(regions, 20, 20).id).toBe('button');
    expect(hitTestRegions(regions, 80, 200).id).toBe('list');
    expect(hitTestRegions(regions, 80, 500)).toBeNull(); // scrolled out of view
  });
});
