/**
 * Synthetic 21-point hand landmarks for unit tests (screen pixels).
 * Units are "hand sizes" (wrist -> middle MCP = 1), y grows downward, the hand
 * points up. Poses: open, point, pinch, fist, victory.
 */
const BASE = {
  0: [0, 0],
  1: [-0.35, -0.25], 2: [-0.55, -0.42], 3: [-0.78, -0.6], 4: [-0.95, -0.7], // thumb extended
  5: [-0.3, -0.95], 6: [-0.35, -1.35], 7: [-0.37, -1.6], 8: [-0.38, -1.85], // index
  9: [0, -1.0], 10: [0, -1.45], 11: [0, -1.72], 12: [0, -1.98], // middle
  13: [0.25, -0.93], 14: [0.28, -1.3], 15: [0.3, -1.55], 16: [0.31, -1.78], // ring
  17: [0.45, -0.8], 18: [0.52, -1.1], 19: [0.55, -1.3], 20: [0.58, -1.48], // pinky
};

const CURLED = {
  index: { 6: [-0.33, -1.15], 7: [-0.32, -0.95], 8: [-0.3, -0.75] },
  middle: { 10: [0, -1.2], 11: [0, -1.0], 12: [0, -0.8] },
  ring: { 14: [0.26, -1.1], 15: [0.25, -0.92], 16: [0.24, -0.74] },
  pinky: { 18: [0.48, -0.95], 19: [0.47, -0.8], 20: [0.45, -0.65] },
  thumb: { 3: [-0.3, -0.55], 4: [-0.1, -0.7] },
};

export function hand(pose = 'open', { cx = 640, cy = 600, s = 120, pinch = 0.05 } = {}) {
  const u = { ...BASE };
  const curl = (...fingers) => fingers.forEach((f) => Object.assign(u, CURLED[f]));
  switch (pose) {
    case 'open':
      break;
    case 'point':
      curl('middle', 'ring', 'pinky');
      break;
    case 'victory':
      curl('ring', 'pinky', 'thumb');
      break;
    case 'fist':
      curl('index', 'middle', 'ring', 'pinky', 'thumb');
      break;
    case 'pinch': {
      // Index slightly bent; thumb tip `pinch` hand-sizes to the left of the index tip.
      curl('middle', 'ring', 'pinky');
      u[7] = [-0.4, -1.45];
      u[8] = [-0.42, -1.55];
      u[4] = [-0.42 - pinch, -1.55];
      u[3] = [-0.42 - pinch - 0.15, -1.3];
      break;
    }
    default:
      throw new Error(`unknown pose ${pose}`);
  }
  const points = [];
  for (let i = 0; i < 21; i++) points.push({ x: cx + u[i][0] * s, y: cy + u[i][1] * s, z: 0 });
  return { points, score: 0.95, handedness: 'right' };
}

/** Feed frames to a recognizer; returns all emitted events (copied). */
export function run(recognizer, frames, { start = 0, step = 33, ctx = {} } = {}) {
  const events = [];
  let t = start;
  for (const f of frames) {
    for (const e of recognizer.update(f, t, ctx)) events.push({ ...e, t });
    t += step;
  }
  return { events, t };
}

export function repeat(frame, n) {
  return Array.from({ length: n }, () => (typeof frame === 'function' ? frame() : frame));
}

export const types = (events) => events.map((e) => e.type);
