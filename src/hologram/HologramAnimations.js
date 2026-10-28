/**
 * Maps hologram formation progress (0..1) to the individual animation layers.
 *
 * Entrance (formation rising):
 *   cluster  0.00-0.12  a small cluster of particles appears
 *   expand   0.06-0.50  particles fly out and align into the phone surface
 *   outline  0.28-0.66  the contour is drawn progressively
 *   screen   0.48-0.82  the dotted display scans in from the top
 *   icons    0.55-1.00  app icons materialise (staggered, see HomeScreen)
 *   settle   0.82-1.00  surface particles hand over to the screen shader
 *
 * Exit (formation falling, `dismissing`): icons fade first, then the screen
 * dissolves with noise, the contour retracts and particles disperse outward.
 */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (f, a, b) => clamp01((f - a) / (b - a));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export function timeline(f, dismissing = false) {
  const out = {
    cluster: seg(f, 0, 0.12),
    expand: seg(f, 0.06, 0.5),
    outline: easeOutCubic(seg(f, 0.28, 0.66)),
    screen: easeOutCubic(seg(f, 0.48, 0.82)),
    settle: seg(f, 0.82, 1),
    dissolve: 0,
    disperse: dismissing ? 1 : 0,
  };
  if (dismissing) {
    // Screen stays fully revealed but dissolves away instead of un-scanning.
    const s = seg(f, 0.4, 0.85);
    out.screen = s > 0 ? 1 : 0;
    out.dissolve = 1 - s;
    out.expand = seg(f, 0.0, 0.55);
    out.cluster = seg(f, 0, 0.3);
  }
  return out;
}
