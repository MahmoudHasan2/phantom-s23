# PHANTOM S23 — Interactive Holographic Smartphone Experience

🇬🇧 English · [🇩🇪 Deutsch](README.de.md)

![three.js](https://img.shields.io/badge/three.js-0.169-000?logo=threedotjs)
![MediaPipe](https://img.shields.io/badge/MediaPipe-hand%20tracking-0097A7?logo=google&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tests](https://img.shields.io/badge/tests-60%20unit%20%2B%2028%20e2e-2ea44f)

A real-time, **camera-composited** holographic phone for recording a tech advertisement: live webcam video + a dotted Three.js hologram + MediaPipe hand tracking + simulated Android-style apps + built-in recording. Everything runs locally in the browser — no backend, no API keys, no cloud AI, no analytics.

> This is a visual effect composited onto the camera image, not an optical hologram. The hologram sits at a fixed, user-adjustable screen position; it is **not** anchored to your hand or the real phone.

## Prerequisites (Windows 10/11)
- Node.js 18+ (LTS recommended): `winget install OpenJS.NodeJS.LTS`
- Current Chrome or Edge, a webcam, hardware acceleration enabled in the browser.

## Install & run
```powershell
cd mobile
npm install          # also copies the MediaPipe WASM runtime to public/mediapipe/wasm
npm run setup        # downloads the hand model (7.8 MB) to public/models/ — once
npm run dev          # opens http://localhost:5173
```
Production: `npm run build` then `npm run preview` (http://localhost:4173). Always use `localhost` — the camera does not work from `file://`.

| Script | Purpose |
|---|---|
| `npm test` | Unit tests (Vitest): gestures, navigation, keyboard, messaging, recording MIME selection |
| `npm run build` | Production build into `dist/` |
| `npm run test:smoke` | Headless browser end-to-end test with Chrome's fake camera (needs Chrome/Edge installed, run `build` first) |
| `npm run test:all` | All of the above |

## Camera permission
Click **Enable camera** on the start screen; the browser asks for permission only then. If denied: click the camera icon in the address bar → *Allow* → **Retry**. Also check *Windows Settings → Privacy → Camera → Let desktop apps access your camera*. Close Teams/Zoom/Camera if the device is busy. Use the selector to switch cameras.

## Hand-tracking model (offline use)
- Model: MediaPipe Hand Landmarker float16 (Apache-2.0), from `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
- Stored locally at `public/models/hand_landmarker.task` (by `npm run setup`), served as `/models/hand_landmarker.task`.
- WASM runtime: copied from `node_modules/@mediapipe/tasks-vision/wasm` to `public/mediapipe/wasm`.
- After setup the app works fully offline. If the local model is missing, the Google URL above is used. The URL is editable under *Settings → Tracking → Model URL* (then *Reload tracking model*).
- If tracking cannot load, the app says so — it never fakes tracking. **Demo mode** (start screen) is clearly labelled "simulated input": the mouse acts as your finger.

## Gestures
| Gesture | Action |
|---|---|
| Open palm, held still ~0.7 s | Summon hologram (repeatable) |
| Fist, held ~1 s | Dismiss hologram |
| Index finger | Move cursor / hover |
| Short thumb–index pinch | Tap (once per pinch, debounced) |
| Pinch and move up/down | Scroll (content follows your hand) |
| Index + middle "V", move up/down | Scroll (optional) |
| Pinch and hold still ~1.1 s (ring fills) | Close app → home |
| Fast horizontal swipe, open hand | Back |
| Pinch on keyboard keys | Type |

Mouse fallback: move = cursor, click = tap, drag/wheel = scroll, long-press = close app, right-click = back.
Keyboard: **H** hologram · **P** presentation · **R** record · **F** fullscreen · **S** settings · **D** debug overlay · **C** calibration · **Esc** back · **Home** close app. Backup buttons (✕ ○ ‹) are on the hologram's nav bar.

## Calibration
Press **C**: record an open hand (2 s), then a pinch (2 s), then *Apply* — sets pinch start/release thresholds with hysteresis. **D** shows the landmark skeleton, hologram bounds, pinch meter, FPS and inference time. Other useful settings: *Cursor mapping = zone* (a comfortable hand area maps onto the whole hologram), smoothing, key hitbox, scroll sensitivity.

## Recording the advertisement
1. Place the hologram (*Settings → Hologram*, or a position preset). Set *Recording → Output resolution* (e.g. 1920×1080).
2. **P** for presentation mode (hides all controls; optional cinematic fade/letterbox).
3. **R** → countdown → recording. **R** again to stop (pause is available on the REC indicator).
4. Preview → **Save** downloads the file. Nothing is saved without that click.

The recording captures the single WebGL canvas, i.e. camera + hologram + cursor (cursor can be hidden in settings). Developer UI and feedback labels are HTML and are never recorded. Keep the tab visible while recording.

**Formats:** WebM (VP9/VP8, + Opus with microphone audio) by default — plays in Chrome, Edge, Firefox, VLC. MP4 (H.264) only if chosen and supported by the browser; the dialog shows the actual format. Convert with:
```
ffmpeg -i recording.webm -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac recording.mp4
```

## Facebook
The configured profile `https://www.facebook.com/mahmoud.hasan.428535` opens in a **normal browser tab** ("Open live profile" button, or *Settings → Open Facebook profile*). Facebook forbids embedding, so it is never embedded or scraped. Inside the hologram a local **presentation simulation** is shown, with editable name/bio/posts in `src/config/demoContent.js`; posts carry a "SAMPLE" tag (configurable). If a pinch-triggered tab is blocked by the popup blocker, use the settings-panel link (a real click) or allow popups for localhost.

## Troubleshooting
- **Black screen / "camera in use"**: close other camera apps, Retry; try another camera or lower capture resolution.
- **Hand not detected**: more front light, avoid backlight, hand 40–80 cm from the camera, palm toward it.
- **Clicks unreliable**: run calibration; raise *Max click duration*; try zone mapping.
- **Low FPS**: quality *low*, render resolution scale 0.75, tracking 20 Hz. Auto-quality steps down by itself.
- **Model fails to load**: `npm run setup`, then *Reload tracking model*.
- **Seeking in WebM is slow in some players**: `ffmpeg -i in.webm -c copy out.webm` or convert to MP4.

## Known limitations
- Hologram is screen-anchored, not tracked to the real phone; no hand/hologram occlusion.
- Gesture accuracy depends on lighting, camera and hand pose; calibrate per setup.
- Apps are simulations: no real messaging, calls, Facebook/YouTube content or video playback inside the hologram.
- `npm audit` reports advisories only in **dev tooling** (Vite dev server/esbuild, Vitest, puppeteer-core's proxy deps); production dependencies report 0. The dev server binds to localhost only.

## Privacy & licensing
- Camera frames, hand landmarks, audio and messages never leave the browser. No telemetry. Settings and demo chats live in `localStorage`; Camera-app captures are in memory only.
- Camera/microphone are requested only when you start the camera / enable audio recording.
- Third-party: Three.js (MIT), MediaPipe Tasks Vision + Hand Landmarker model (Apache-2.0). All icons and images are original, drawn procedurally in code. App names only label simulations; not affiliated with Samsung, Meta, WhatsApp, Google/YouTube or Instagram.

## Architecture
```
src/app          AppController (orchestration, render loop), AppState, Router, HologramStateMachine
src/camera       CameraManager, CameraCompositor (video → WebGL), videoTransform (shared math)
src/tracking     HandTracker (own timer loop), handGeometry, OneEuroFilter, GestureRecognizer, GestureCalibration
src/hologram     HologramScene, HologramScreen, ParticleSystem, HologramShaders, HologramAnimations, CursorOverlay
src/interactions InteractionController, VirtualCursor, ScrollPhysics, HitTesting
src/uicanvas     UIRenderer (immediate-mode canvas UI), PhoneUI shell, draw/icons/images/chrome helpers
src/apps         Home, Facebook, WhatsApp, YouTube, Instagram, Phone, Messages, Camera, Gallery, Settings, ChatStore
src/keyboard     KeyboardModel (pure), VirtualKeyboard
src/recording    RecordingController, mimeTypes · src/audio SoundEngine · src/ui DOM panels · src/config
```
The phone UI is drawn on an offscreen canvas used as the hologram texture, so the apps are part of the recorded frame.
