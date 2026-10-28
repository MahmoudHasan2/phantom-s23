/**
 * Pure math shared by the background shader and the hand-landmark mapping, so
 * the fingertip drawn in the video and the cursor always agree.
 *
 * Coordinates are top-left-origin normalised [0..1].
 *   videoUV = screenUV * scale + offset            (then x is mirrored if enabled)
 *
 * The base scale implements "object-fit: cover"; zoom crops further in; pan
 * shifts the crop window (clamped so the frame never shows empty borders).
 */
export function computeVideoTransform(canvasW, canvasH, videoW, videoH, zoom = 1, panX = 0, panY = 0) {
  const ac = canvasW / Math.max(1, canvasH);
  const av = videoW > 0 && videoH > 0 ? videoW / videoH : ac;
  let sx = 1;
  let sy = 1;
  if (av > ac) sx = ac / av; // video wider than canvas: crop left/right
  else sy = av / ac; // video taller: crop top/bottom
  const z = Math.max(1, zoom);
  sx /= z;
  sy /= z;
  // Pan range is limited to the remaining slack on each axis.
  const slackX = (1 - sx) / 2;
  const slackY = (1 - sy) / 2;
  const ox = slackX + clamp(panX, -1, 1) * slackX * 2;
  const oy = slackY + clamp(panY, -1, 1) * slackY * 2;
  return { scaleX: sx, scaleY: sy, offsetX: clamp(ox, 0, 1 - sx), offsetY: clamp(oy, 0, 1 - sy) };
}

/** Raw video landmark (as returned by MediaPipe, unmirrored) -> screen pixel. */
export function videoToScreen(t, vx, vy, mirror, canvasW, canvasH, out = { x: 0, y: 0 }) {
  const x = mirror ? 1 - vx : vx;
  out.x = ((x - t.offsetX) / t.scaleX) * canvasW;
  out.y = ((vy - t.offsetY) / t.scaleY) * canvasH;
  return out;
}

/** Inverse: screen pixel -> raw video coordinate. */
export function screenToVideo(t, sx, sy, mirror, canvasW, canvasH, out = { x: 0, y: 0 }) {
  const x = (sx / canvasW) * t.scaleX + t.offsetX;
  out.x = mirror ? 1 - x : x;
  out.y = (sy / canvasH) * t.scaleY + t.offsetY;
  return out;
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}
