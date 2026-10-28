/**
 * Central configuration and the settings schema.
 *
 * Every user-adjustable value lives in SETTINGS_SCHEMA. The SettingsPanel UI is
 * generated from this schema, AppState persists the values to localStorage, and
 * every subsystem reads them at runtime — nothing needs a source edit to tune.
 */

export const APP_NAME = 'PHANTOM S23';

/** Logical resolution of the simulated phone UI (Galaxy S23 Ultra ~ 1440x3088 => 0.4663). */
export const PHONE_UI = { width: 450, height: 965 };

export const MODEL_CONFIG = {
  /** Local copy created by `npm run setup` (public/models/hand_landmarker.task). */
  localModelUrl: '/models/hand_landmarker.task',
  /** Official Google-hosted model, used only if the local copy is missing. */
  remoteModelUrl:
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  /** WASM runtime copied from node_modules by the postinstall script. */
  localWasmBase: '/mediapipe/wasm',
  remoteWasmBase: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm',
};

/**
 * Graphics presets. `particles` = particle count, `uiScale` = phone UI canvas
 * pixel ratio, `uiFps` = max redraw/upload rate of the phone UI texture.
 */
export const QUALITY_PRESETS = {
  low: { particles: 5000, uiScale: 1.25, pixelRatioCap: 1, glowTaps: 0, uiFps: 24 },
  medium: { particles: 11000, uiScale: 1.75, pixelRatioCap: 1.5, glowTaps: 1, uiFps: 30 },
  high: { particles: 20000, uiScale: 2.25, pixelRatioCap: 2, glowTaps: 1, uiFps: 60 },
};

export const POSITION_PRESETS = {
  center: { posX: 0, posY: 0.02 },
  leftThird: { posX: -0.33, posY: 0.02 },
  rightThird: { posX: 0.33, posY: 0.02 },
  lowerRight: { posX: 0.3, posY: -0.08 },
  lowerLeft: { posX: -0.3, posY: -0.08 },
};

/**
 * Schema entries: { key, label, type: 'range'|'toggle'|'select', default, min, max, step, options, section, help }
 */
export const SETTINGS_SCHEMA = [
  // ---- Hologram -------------------------------------------------------------
  { section: 'Hologram', key: 'holoSize', label: 'Size (screen height)', type: 'range', default: 0.74, min: 0.3, max: 1.0, step: 0.01 },
  { section: 'Hologram', key: 'posX', label: 'Horizontal position', type: 'range', default: 0.3, min: -0.7, max: 0.7, step: 0.01 },
  { section: 'Hologram', key: 'posY', label: 'Vertical position', type: 'range', default: 0.0, min: -0.5, max: 0.5, step: 0.01 },
  { section: 'Hologram', key: 'tiltX', label: 'Tilt forward/back (°)', type: 'range', default: -6, min: -35, max: 35, step: 1 },
  { section: 'Hologram', key: 'tiltY', label: 'Turn left/right (°)', type: 'range', default: -10, min: -45, max: 45, step: 1 },
  { section: 'Hologram', key: 'tiltZ', label: 'Roll (°)', type: 'range', default: 0, min: -20, max: 20, step: 1 },
  { section: 'Hologram', key: 'opacity', label: 'Opacity', type: 'range', default: 0.92, min: 0.1, max: 1, step: 0.01 },
  { section: 'Hologram', key: 'backdrop', label: 'Backdrop dimming', type: 'range', default: 0.34, min: 0, max: 0.9, step: 0.01, help: 'Darkens the camera image behind the screen for legibility. 0 = fully transparent.' },
  { section: 'Hologram', key: 'brightness', label: 'Brightness', type: 'range', default: 1.0, min: 0.4, max: 2.0, step: 0.05 },
  { section: 'Hologram', key: 'colorKeep', label: 'App colour retention', type: 'range', default: 0.38, min: 0, max: 1, step: 0.01, help: '0 = monochrome cyan hologram, 1 = original app colours.' },
  { section: 'Hologram', key: 'hue', label: 'Hologram tint', type: 'select', default: 'cyan', options: ['cyan', 'ice', 'blue', 'teal'] },

  // ---- Effects --------------------------------------------------------------
  { section: 'Effects', key: 'quality', label: 'Visual quality preset', type: 'select', default: 'medium', options: ['low', 'medium', 'high'] },
  { section: 'Effects', key: 'autoQuality', label: 'Auto-reduce quality when slow', type: 'toggle', default: true },
  { section: 'Effects', key: 'dotDensity', label: 'Dot density (dots across)', type: 'range', default: 190, min: 60, max: 360, step: 5 },
  { section: 'Effects', key: 'dotStrength', label: 'Dot pattern strength', type: 'range', default: 0.7, min: 0, max: 1, step: 0.01 },
  { section: 'Effects', key: 'glow', label: 'Glow intensity', type: 'range', default: 0.6, min: 0, max: 2, step: 0.05 },
  { section: 'Effects', key: 'scanSpeed', label: 'Scan-line speed', type: 'range', default: 0.35, min: 0, max: 2, step: 0.05 },
  { section: 'Effects', key: 'scanLines', label: 'Scan lines', type: 'toggle', default: true },
  { section: 'Effects', key: 'flicker', label: 'Flicker amount', type: 'range', default: 0.06, min: 0, max: 0.4, step: 0.01 },
  { section: 'Effects', key: 'particleAnim', label: 'Ambient particle drift', type: 'toggle', default: true },
  { section: 'Effects', key: 'particleAmount', label: 'Particle amount', type: 'range', default: 1, min: 0.2, max: 1.5, step: 0.05 },
  { section: 'Effects', key: 'renderScale', label: 'Render resolution scale', type: 'range', default: 1, min: 0.5, max: 1, step: 0.05 },

  // ---- Camera ---------------------------------------------------------------
  { section: 'Camera', key: 'mirror', label: 'Mirror camera', type: 'toggle', default: true },
  { section: 'Camera', key: 'camResolution', label: 'Capture resolution', type: 'select', default: '1280x720', options: ['640x480', '1280x720', '1920x1080'] },
  { section: 'Camera', key: 'camZoom', label: 'Crop / zoom', type: 'range', default: 1, min: 1, max: 2.5, step: 0.01 },
  { section: 'Camera', key: 'camPanX', label: 'Crop pan X', type: 'range', default: 0, min: -0.5, max: 0.5, step: 0.01 },
  { section: 'Camera', key: 'camPanY', label: 'Crop pan Y', type: 'range', default: 0, min: -0.5, max: 0.5, step: 0.01 },
  { section: 'Camera', key: 'camBrightness', label: 'Camera brightness', type: 'range', default: 0.95, min: 0.3, max: 1.6, step: 0.01 },
  { section: 'Camera', key: 'camGrade', label: 'Cinematic grade (cool tone)', type: 'range', default: 0.35, min: 0, max: 1, step: 0.01 },
  { section: 'Camera', key: 'vignette', label: 'Vignette', type: 'range', default: 0.45, min: 0, max: 1, step: 0.01 },

  // ---- Gestures -------------------------------------------------------------
  { section: 'Gestures', key: 'pointerMode', label: 'Cursor mapping', type: 'select', default: 'direct', options: ['direct', 'zone'], help: 'direct: the cursor sits on your fingertip. zone: a comfortable hand area is mapped onto the whole hologram.' },
  { section: 'Gestures', key: 'zoneSize', label: 'Zone size (zone mode)', type: 'range', default: 0.45, min: 0.2, max: 0.9, step: 0.01 },
  { section: 'Gestures', key: 'pinchOn', label: 'Pinch start threshold', type: 'range', default: 0.33, min: 0.1, max: 0.8, step: 0.01, help: 'Thumb–index distance ÷ hand size that starts a pinch.' },
  { section: 'Gestures', key: 'pinchOff', label: 'Pinch release threshold', type: 'range', default: 0.48, min: 0.15, max: 1.0, step: 0.01, help: 'Must be larger than the start threshold (hysteresis).' },
  { section: 'Gestures', key: 'clickMaxMs', label: 'Max click duration (ms)', type: 'range', default: 550, min: 150, max: 1200, step: 10 },
  { section: 'Gestures', key: 'clickCooldownMs', label: 'Click cooldown (ms)', type: 'range', default: 220, min: 0, max: 1000, step: 10 },
  { section: 'Gestures', key: 'holdMs', label: 'Pinch-hold to close app (ms)', type: 'range', default: 1100, min: 500, max: 3000, step: 50 },
  { section: 'Gestures', key: 'dragThreshold', label: 'Drag start distance (hand sizes)', type: 'range', default: 0.22, min: 0.05, max: 0.8, step: 0.01 },
  { section: 'Gestures', key: 'scrollSensitivity', label: 'Scroll sensitivity', type: 'range', default: 1.4, min: 0.3, max: 4, step: 0.05 },
  { section: 'Gestures', key: 'scrollMaxSpeed', label: 'Max scroll speed (px/frame)', type: 'range', default: 70, min: 10, max: 200, step: 5 },
  { section: 'Gestures', key: 'twoFingerScroll', label: 'Two-finger (V) scroll', type: 'toggle', default: true },
  { section: 'Gestures', key: 'summonGesture', label: 'Summon gesture', type: 'select', default: 'openPalmHold', options: ['openPalmHold', 'off'] },
  { section: 'Gestures', key: 'summonHoldMs', label: 'Summon hold time (ms)', type: 'range', default: 700, min: 200, max: 2000, step: 50 },
  { section: 'Gestures', key: 'dismissGesture', label: 'Dismiss gesture', type: 'select', default: 'off', options: ['fistHold', 'off'] },
  { section: 'Gestures', key: 'dismissHoldMs', label: 'Dismiss hold time (ms)', type: 'range', default: 1000, min: 300, max: 3000, step: 50 },
  { section: 'Gestures', key: 'backGesture', label: 'Back gesture', type: 'select', default: 'swipeEither', options: ['swipeEither', 'swipeLeft', 'swipeRight', 'off'] },
  { section: 'Gestures', key: 'swipeSpeed', label: 'Swipe-back speed (hand sizes/s)', type: 'range', default: 4.5, min: 1.5, max: 12, step: 0.1 },
  { section: 'Gestures', key: 'keyHitbox', label: 'Keyboard hitbox scale', type: 'range', default: 1.25, min: 1, max: 2, step: 0.05 },
  { section: 'Gestures', key: 'keyboardLayout', label: 'Keyboard layout', type: 'select', default: 'qwertz', options: ['qwertz', 'qwerty'] },

  // ---- Tracking -------------------------------------------------------------
  { section: 'Tracking', key: 'trackingFps', label: 'Tracking rate (Hz)', type: 'range', default: 30, min: 8, max: 60, step: 1 },
  { section: 'Tracking', key: 'numHands', label: 'Max hands', type: 'select', default: '1', options: ['1', '2'] },
  { section: 'Tracking', key: 'preferredHand', label: 'Preferred hand (2-hand mode)', type: 'select', default: 'any', options: ['any', 'right', 'left'] },
  { section: 'Tracking', key: 'delegate', label: 'Inference backend', type: 'select', default: 'GPU', options: ['GPU', 'CPU'] },
  { section: 'Tracking', key: 'minConfidence', label: 'Min detection confidence', type: 'range', default: 0.6, min: 0.2, max: 0.95, step: 0.01 },
  { section: 'Tracking', key: 'smoothMinCutoff', label: 'Smoothing: min cutoff (lower = smoother)', type: 'range', default: 1.4, min: 0.1, max: 6, step: 0.05 },
  { section: 'Tracking', key: 'smoothBeta', label: 'Smoothing: speed response', type: 'range', default: 0.012, min: 0, max: 0.1, step: 0.001 },
  { section: 'Tracking', key: 'cursorLerp', label: 'Render-rate cursor easing', type: 'range', default: 0.45, min: 0.05, max: 1, step: 0.01 },
  { section: 'Tracking', key: 'lostGraceMs', label: 'Tracking-lost grace (ms)', type: 'range', default: 280, min: 50, max: 1500, step: 10 },
  { section: 'Tracking', key: 'modelUrl', label: 'Model URL', type: 'text', default: MODEL_CONFIG.localModelUrl },
  { section: 'Tracking', key: 'debugOverlay', label: 'Tracking debug overlay', type: 'toggle', default: false },

  // ---- Presentation ---------------------------------------------------------
  { section: 'Presentation', key: 'showCursor', label: 'Show tracking cursor', type: 'toggle', default: true },
  { section: 'Presentation', key: 'showFeedback', label: 'Gesture feedback labels', type: 'toggle', default: true },
  { section: 'Presentation', key: 'animSpeed', label: 'Animation speed', type: 'range', default: 1, min: 0.25, max: 3, step: 0.05 },
  { section: 'Presentation', key: 'skipAnimations', label: 'Skip entrance/exit animations', type: 'toggle', default: false },
  { section: 'Presentation', key: 'letterbox', label: 'Cinematic letterbox', type: 'range', default: 0, min: 0, max: 0.15, step: 0.005 },
  { section: 'Presentation', key: 'startupSequence', label: 'Cinematic startup sequence', type: 'toggle', default: true },
  { section: 'Presentation', key: 'autoSummon', label: 'Auto-summon after startup', type: 'toggle', default: false },
  { section: 'Presentation', key: 'sound', label: 'Sound effects', type: 'toggle', default: false },
  { section: 'Presentation', key: 'soundVolume', label: 'Sound volume', type: 'range', default: 0.5, min: 0, max: 1, step: 0.01 },

  // ---- Recording ------------------------------------------------------------
  { section: 'Recording', key: 'recFps', label: 'Recording frame rate', type: 'select', default: '30', options: ['24', '30', '60'] },
  { section: 'Recording', key: 'recBitrate', label: 'Video bitrate (Mbit/s)', type: 'range', default: 10, min: 2, max: 40, step: 1 },
  { section: 'Recording', key: 'recFormat', label: 'Preferred container', type: 'select', default: 'webm', options: ['webm', 'mp4'] },
  { section: 'Recording', key: 'recCountdown', label: 'Countdown (s)', type: 'range', default: 3, min: 0, max: 10, step: 1 },
  { section: 'Recording', key: 'recAudio', label: 'Record microphone audio', type: 'toggle', default: false },
  { section: 'Recording', key: 'outputSize', label: 'Output resolution', type: 'select', default: 'window', options: ['window', '1280x720', '1920x1080', '1080x1920'] },
];

export function defaultSettings() {
  const out = {};
  for (const s of SETTINGS_SCHEMA) out[s.key] = s.default;
  return out;
}

export const HOLOGRAM_TINTS = {
  cyan: [0.35, 0.92, 1.0],
  ice: [0.75, 0.93, 1.0],
  blue: [0.35, 0.6, 1.0],
  teal: [0.3, 1.0, 0.85],
};

export const STORAGE_KEYS = {
  settings: 'phantom.settings.v1',
  chats: 'phantom.chats.v1',
};
