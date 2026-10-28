# Development Status

## Completed
- Vite + Three.js + MediaPipe project; local assets via `npm run setup` (offline afterwards).
- Camera: explicit start, selector, loading/error/retry, mirroring, crop/zoom/pan, stop & track cleanup, device-loss handling.
- Single-canvas compositing (camera + hologram + cursor + letterbox/fade); fixed output resolutions.
- Hand tracking on its own timer loop (configurable Hz, GPU→CPU fallback, 1–2 hands).
- Gesture engine: One Euro smoothing, pose stability, pinch hysteresis, look-back click position, debounce/cooldown, pinch-hold close, pinch-drag & V-scroll with inertia, palm summon, fist dismiss, swipe back, tracking-loss reset, calibration tool, debug overlay.
- Hologram: dot-matrix shader, scan lines, flicker, glow, contour, halo, GPU particles; staged entrance/exit; speed & skip options.
- Apps: Home, Facebook (live tab + simulation), WhatsApp, Messages, YouTube, Instagram, Phone, Camera (live viewfinder, in-memory capture), Gallery, Settings.
- Virtual keyboard: QWERTZ/QWERTY, umlauts, symbols, shift/caps, hitbox scale, caret.
- Presentation mode, startup sequence, position presets, optional sound, auto-quality, shortcuts.
- Recording: MediaRecorder on the composited canvas, MIME detection, countdown, timer, pause, preview, explicit Save, optional mic.

## Tested automatically
- `npm test` — 60 unit tests (gestures, hysteresis, debounce, hold, drag vs. jitter, scroll direction, tracking loss, summon/dismiss, swipe, navigation, close-to-home, state machine, settings, scroll physics, video transform, calibration, hit-testing, keyboard entry, messaging/sending, MIME selection). All pass.
- `npm run test:smoke` — 28 headless-Chrome checks using Chromium's **fake camera** (camera start/stop, real model load, ~23 Hz tracking loop, mouse clicks on all 9 apps, keyboard typing + send, back/close, scrolling, synthetic landmarks through the full hand pipeline, 3 s recording that decodes and contains composited content, presentation mode, no page errors). All pass.
- `npm run build` passes.

## Requires manual webcam testing (not done — no physical webcam was accessed)
See `MANUAL_TEST_CHECKLIST.md`: real-hand detection in your lighting, thresholds, targeting accuracy, scroll feel, typing comfort, real-hardware FPS, recording playback on the target laptop.

## Known limitations
- Screen-anchored hologram; no real-world anchoring or occlusion.
- Headless FPS (software GPU) is not representative — measure on the target laptop (D).
- MP4 only where the browser supports it; otherwise WebM + FFmpeg.
- Recording freezes while the tab is hidden (warning shown).
- `npm audit` advisories exist only in dev tooling; production deps have none.
