import { describe, expect, it } from 'vitest';
import { GestureRecognizer } from '../src/tracking/GestureRecognizer.js';
import { classifyPose, fingerStates, pinchRatio } from '../src/tracking/handGeometry.js';
import { hand, repeat, run, types } from './helpers/syntheticHand.js';

const fresh = (cfg = {}) => new GestureRecognizer({ poseStableMs: 60, ...cfg });

describe('hand geometry', () => {
  it('classifies synthetic poses', () => {
    expect(classifyPose(fingerStates(hand('open').points))).toBe('openPalm');
    expect(classifyPose(fingerStates(hand('fist').points))).toBe('fist');
    expect(classifyPose(fingerStates(hand('point').points))).toBe('point');
    expect(classifyPose(fingerStates(hand('victory').points))).toBe('victory');
  });

  it('pinch ratio is scale invariant', () => {
    const a = pinchRatio(hand('pinch', { pinch: 0.2, s: 80 }).points);
    const b = pinchRatio(hand('pinch', { pinch: 0.2, s: 240 }).points);
    expect(a).toBeCloseTo(0.2, 5);
    expect(b).toBeCloseTo(0.2, 5);
  });
});

describe('pinch thresholds and hysteresis', () => {
  it('starts a pinch below pinchOn and releases only above pinchOff', () => {
    const g = fresh({ pinchOn: 0.33, pinchOff: 0.48 });
    const { events } = run(g, [
      ...repeat(hand('pinch', { pinch: 0.6 }), 3), // open-ish: no pinch
      ...repeat(hand('pinch', { pinch: 0.2 }), 2), // closes -> pinchStart
      ...repeat(hand('pinch', { pinch: 0.4 }), 3), // between thresholds -> still pinching
    ]);
    expect(types(events).filter((t) => t === 'pinchStart')).toHaveLength(1);
    expect(types(events)).not.toContain('pinchEnd');
    expect(g.state.pinching).toBe(true);

    const r2 = run(g, repeat(hand('pinch', { pinch: 0.55 }), 2), { start: 1000 });
    expect(types(r2.events)).toContain('pinchEnd');
    expect(g.state.pinching).toBe(false);
  });

  it('does not flicker when the ratio oscillates inside the hysteresis band', () => {
    const g = fresh();
    const frames = [hand('pinch', { pinch: 0.1 })];
    for (let i = 0; i < 20; i++) frames.push(hand('pinch', { pinch: i % 2 ? 0.3 : 0.45 }));
    const { events } = run(g, frames);
    expect(types(events).filter((t) => t === 'pinchStart')).toHaveLength(1);
    expect(types(events)).not.toContain('pinchEnd');
  });

  it('a pinch collapsing into a fist is cancelled, not clicked', () => {
    const g = fresh();
    const { events } = run(g, [...repeat(hand('pinch', { pinch: 0.05 }), 3), ...repeat(hand('fist'), 3)]);
    const end = events.find((e) => e.type === 'pinchEnd');
    expect(end.cancelled).toBe(true);
    expect(types(events)).not.toContain('click');
  });

  it('a fist never starts a pinch even though thumb and index are close', () => {
    const g = fresh();
    const { events } = run(g, repeat(hand('fist'), 10));
    expect(types(events)).not.toContain('pinchStart');
  });
});

describe('click debouncing', () => {
  it('emits exactly one click per short pinch cycle', () => {
    const g = fresh();
    const { events } = run(g, [
      ...repeat(hand('pinch', { pinch: 0.8 }), 3),
      ...repeat(hand('pinch', { pinch: 0.05 }), 5), // ~165 ms closed
      ...repeat(hand('pinch', { pinch: 0.8 }), 10), // released and resting
    ]);
    expect(types(events).filter((t) => t === 'click')).toHaveLength(1);
  });

  it('a pinch closing from a wide-open thumb is a click, not a drag', () => {
    // Regression: the thumb snapping to the index finger must not count as hand movement.
    const g = fresh();
    const { events } = run(g, [...repeat(hand('open'), 6), ...repeat(hand('pinch', { pinch: 0.05 }), 4), ...repeat(hand('open'), 4)]);
    expect(types(events)).not.toContain('dragStart');
    expect(types(events).filter((t) => t === 'click')).toHaveLength(1);
  });

  it('holding the finger still over a target does not repeat clicks', () => {
    const g = fresh();
    const { events } = run(g, repeat(hand('point'), 60));
    expect(types(events)).not.toContain('click');
  });

  it('respects the click cooldown between rapid pinches', () => {
    const g = fresh({ clickCooldownMs: 300 });
    const P = hand('pinch', { pinch: 0.05 });
    const O = hand('pinch', { pinch: 0.8 });
    const { events } = run(g, [O, P, P, O, P, O, ...repeat(O, 12), P, P, O]);
    // cycle 1 clicks, cycle 2 is inside the cooldown, cycle 3 clicks again
    expect(types(events).filter((t) => t === 'click')).toHaveLength(2);
  });

  it('a long pinch emits hold once and no click', () => {
    const g = fresh({ holdMs: 900 });
    const { events } = run(g, [...repeat(hand('pinch', { pinch: 0.05 }), 40), ...repeat(hand('pinch', { pinch: 0.8 }), 3)]);
    expect(types(events).filter((t) => t === 'hold')).toHaveLength(1);
    expect(types(events)).not.toContain('click');
  });

  it('clicks at the position from before the pinch closed (look-back)', () => {
    const g = fresh({ lookbackMs: 90 });
    const frames = [];
    for (let i = 0; i < 10; i++) frames.push(hand('pinch', { pinch: 0.8, cx: 600 }));
    // While closing, the hand jerks 40 px right — the click should stay near the old spot.
    frames.push(hand('pinch', { pinch: 0.05, cx: 640 }));
    frames.push(hand('pinch', { pinch: 0.05, cx: 640 }));
    frames.push(hand('pinch', { pinch: 0.8, cx: 640 }));
    const { events } = run(g, frames);
    const click = events.find((e) => e.type === 'click');
    expect(click).toBeTruthy();
    const restingTipX = hand('pinch', { pinch: 0.8, cx: 600 }).points[8].x;
    expect(Math.abs(click.x - restingTipX)).toBeLessThan(15);
  });
});

describe('scrolling', () => {
  it('pinch-and-drag becomes a drag (no click) with the correct direction', () => {
    const g = fresh({ dragThreshold: 0.2 });
    const frames = [...repeat(hand('pinch', { pinch: 0.05, cy: 600 }), 3)];
    for (let i = 1; i <= 12; i++) frames.push(hand('pinch', { pinch: 0.05, cy: 600 - i * 15 })); // move UP
    frames.push(hand('pinch', { pinch: 0.8, cy: 420 }));
    const { events } = run(g, frames);
    expect(types(events)).toContain('dragStart');
    const drags = events.filter((e) => e.type === 'drag');
    expect(drags.length).toBeGreaterThan(3);
    const total = drags.reduce((a, e) => a + e.dy, 0);
    expect(total).toBeLessThan(0); // finger moved up
    expect(types(events)).toContain('dragEnd');
    expect(types(events)).not.toContain('click');
  });

  it('small jitter during a pinch does not start a drag', () => {
    const g = fresh({ dragThreshold: 0.25 });
    const frames = [];
    for (let i = 0; i < 6; i++) frames.push(hand('pinch', { pinch: 0.05, cy: 600 + (i % 2 ? 4 : -4) }));
    frames.push(hand('pinch', { pinch: 0.8 }));
    const { events } = run(g, frames);
    expect(types(events)).not.toContain('dragStart');
    expect(types(events)).toContain('click');
  });

  it('two-finger (V) pose scrolls; moving down yields positive dy', () => {
    const g = fresh();
    const frames = [...repeat(hand('victory', { cy: 500 }), 4)];
    for (let i = 1; i <= 8; i++) frames.push(hand('victory', { cy: 500 + i * 10 }));
    frames.push(...repeat(hand('point', { cy: 580 }), 4));
    const { events } = run(g, frames);
    expect(types(events)).toContain('scrollStart');
    const total = events.filter((e) => e.type === 'scroll').reduce((a, e) => a + e.dy, 0);
    expect(total).toBeGreaterThan(0);
    expect(types(events)).toContain('scrollEnd');
  });

  it('two-finger scroll can be disabled', () => {
    const g = fresh({ twoFingerScroll: false });
    const { events } = run(g, repeat(hand('victory'), 10));
    expect(types(events)).not.toContain('scrollStart');
  });
});

describe('tracking loss', () => {
  it('keeps state during the grace period, then resets safely', () => {
    const g = fresh({ lostGraceMs: 200 });
    let r = run(g, repeat(hand('pinch', { pinch: 0.05 }), 4));
    expect(g.state.pinching).toBe(true);
    r = run(g, repeat(null, 5), { start: r.t }); // 165 ms gap: still inside grace
    expect(r.events).toHaveLength(0);
    expect(g.state.pinching).toBe(true);
    r = run(g, repeat(null, 3), { start: r.t });
    const ty = types(r.events);
    expect(ty).toContain('trackingLost');
    expect(r.events.find((e) => e.type === 'pinchEnd').cancelled).toBe(true);
    expect(ty).not.toContain('click');
    expect(g.state.pinching).toBe(false);
    expect(g.state.tracked).toBe(false);
  });

  it('re-acquiring the hand emits trackingFound', () => {
    const g = fresh({ lostGraceMs: 50 });
    let r = run(g, [hand('point')]);
    r = run(g, repeat(null, 4), { start: r.t });
    r = run(g, [hand('point')], { start: r.t });
    expect(types(r.events)).toContain('trackingFound');
  });
});

describe('summon / dismiss / back', () => {
  it('open palm held still summons once; repeatable after a pose change', () => {
    const g = fresh({ summonHoldMs: 500 });
    const ctx = { hologramHidden: true, hologramActive: false };
    let r = run(g, repeat(hand('open'), 40), { ctx });
    expect(types(r.events).filter((t) => t === 'summon')).toHaveLength(1);
    r = run(g, [...repeat(hand('fist'), 5), ...repeat(hand('open'), 30)], { start: r.t, ctx });
    expect(types(r.events).filter((t) => t === 'summon')).toHaveLength(1);
  });

  it('open palm does not summon while the hologram is already visible', () => {
    const g = fresh({ summonHoldMs: 300 });
    const { events } = run(g, repeat(hand('open'), 30), { ctx: { hologramHidden: false, hologramActive: true } });
    expect(types(events)).not.toContain('summon');
  });

  it('fist held dismisses an active hologram', () => {
    const g = fresh({ dismissHoldMs: 600 });
    const { events } = run(g, repeat(hand('fist'), 30), { ctx: { hologramHidden: false, hologramActive: true } });
    expect(types(events).filter((t) => t === 'dismiss')).toHaveLength(1);
  });

  it('fast horizontal open-hand swipe emits back with direction', () => {
    const g = fresh({ swipeSpeed: 4 });
    const frames = [...repeat(hand('open', { cx: 900 }), 4)];
    for (let i = 1; i <= 6; i++) frames.push(hand('open', { cx: 900 - i * 45 })); // ~11 hand sizes/s
    const { events } = run(g, frames, { ctx: { hologramHidden: false, hologramActive: true } });
    const back = events.filter((e) => e.type === 'back');
    expect(back).toHaveLength(1);
    expect(back[0].direction).toBe('left');
  });

  it('slow horizontal movement is not a swipe', () => {
    const g = fresh({ swipeSpeed: 4 });
    const frames = [];
    for (let i = 0; i < 30; i++) frames.push(hand('open', { cx: 900 - i * 3 }));
    const { events } = run(g, frames);
    expect(types(events)).not.toContain('back');
  });
});
