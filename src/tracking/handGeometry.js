/**
 * Pure geometric features derived from the 21 MediaPipe hand landmarks.
 *
 * Landmark indices:
 *   0 wrist | thumb 1 CMC, 2 MCP, 3 IP, 4 TIP
 *   index 5 MCP, 6 PIP, 7 DIP, 8 TIP | middle 9-12 | ring 13-16 | pinky 17-20
 *
 * All measures are normalised by "hand size" (wrist -> middle-finger MCP), so
 * thresholds work regardless of how far the hand is from the camera.
 */
export const LM = {
  WRIST: 0,
  THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_TIP: 20,
};

export const FINGERS = [
  { name: 'index', mcp: 5, tip: 8 },
  { name: 'middle', mcp: 9, tip: 12 },
  { name: 'ring', mcp: 13, tip: 16 },
  { name: 'pinky', mcp: 17, tip: 20 },
];

export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function handSize(p) {
  return Math.max(1e-6, dist(p[LM.WRIST], p[LM.MIDDLE_MCP]));
}

/** Thumb-tip to index-tip distance in hand sizes. ~0.1-0.25 pinched, ~0.8+ open. */
export function pinchRatio(p) {
  return dist(p[LM.THUMB_TIP], p[LM.INDEX_TIP]) / handSize(p);
}

/**
 * Extension of a finger: distance wrist->tip relative to wrist->MCP.
 * Straight finger ~1.8-2.1, fully curled ~0.9-1.1.
 */
export function fingerExtension(p, finger) {
  return dist(p[LM.WRIST], p[finger.tip]) / Math.max(1e-6, dist(p[LM.WRIST], p[finger.mcp]));
}

export const EXTENDED_RATIO = 1.55;
export const CURLED_RATIO = 1.3;

/** Returns 'extended' | 'curled' | 'partial' for each finger + thumb. */
export function fingerStates(p) {
  const out = {};
  for (const f of FINGERS) {
    const r = fingerExtension(p, f);
    out[f.name] = r > EXTENDED_RATIO ? 'extended' : r < CURLED_RATIO ? 'curled' : 'partial';
  }
  // Thumb: how far the tip sits from the index MCP, in hand sizes.
  const t = dist(p[LM.THUMB_TIP], p[LM.INDEX_MCP]) / handSize(p);
  out.thumb = t > 0.55 ? 'extended' : t < 0.35 ? 'curled' : 'partial';
  return out;
}

export function palmCenter(p, out = { x: 0, y: 0 }) {
  const ids = [0, 5, 9, 13, 17];
  let x = 0;
  let y = 0;
  for (const i of ids) {
    x += p[i].x;
    y += p[i].y;
  }
  out.x = x / ids.length;
  out.y = y / ids.length;
  return out;
}

/**
 * Static hand pose: 'openPalm' | 'fist' | 'point' | 'victory' | 'other'.
 * Pinch is handled separately (continuous ratio with hysteresis).
 */
export function classifyPose(states) {
  const { index, middle, ring, pinky, thumb } = states;
  const ext = [index, middle, ring, pinky].filter((s) => s === 'extended').length;
  const curled = [index, middle, ring, pinky].filter((s) => s === 'curled').length;
  if (ext === 4 && thumb !== 'curled') return 'openPalm';
  if (curled === 4) return 'fist';
  if (index === 'extended' && middle === 'extended' && ring !== 'extended' && pinky !== 'extended') return 'victory';
  if (index === 'extended' && middle !== 'extended' && ring !== 'extended' && pinky !== 'extended') return 'point';
  return 'other';
}
