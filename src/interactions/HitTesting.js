/**
 * Pure hit-testing helpers used by the phone UI and the virtual keyboard.
 */

export function pointInRect(x, y, r) {
  return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
}

/** Intersection of two rects (or null). */
export function intersectRect(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const bt = Math.min(a.y + a.h, b.y + b.h);
  if (r <= x || bt <= y) return { x, y, w: 0, h: 0 };
  return { x, y, w: r - x, h: bt - y };
}

/**
 * Topmost region containing the point. Regions are in draw order, so later
 * entries are on top. A region may carry a `clip` rect (e.g. scroll viewport)
 * outside which it cannot be hit.
 */
export function hitTestRegions(regions, x, y) {
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i];
    if (r.disabled) continue;
    if (r.clip && !pointInRect(x, y, r.clip)) continue;
    if (pointInRect(x, y, r)) return r;
  }
  return null;
}

/**
 * Keyboard hit-test tolerant of imperfect tracking: each key's hitbox is
 * scaled around its centre by `hitboxScale`. When the enlarged boxes overlap,
 * the key whose centre is closest (normalised by key size) wins.
 */
export function keyAt(keys, x, y, hitboxScale = 1) {
  let best = null;
  let bestScore = Infinity;
  for (const k of keys) {
    const cx = k.x + k.w / 2;
    const cy = k.y + k.h / 2;
    const hw = (k.w * hitboxScale) / 2;
    const hh = (k.h * hitboxScale) / 2;
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    if (dx > hw || dy > hh) continue;
    const score = (dx / (k.w / 2)) ** 2 + (dy / (k.h / 2)) ** 2;
    if (score < bestScore) {
      bestScore = score;
      best = k;
    }
  }
  return best;
}
