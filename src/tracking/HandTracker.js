import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { MODEL_CONFIG } from '../config/appConfig.js';

/**
 * Wraps MediaPipe Hand Landmarker.
 *
 * Inference runs on its own throttled schedule (requestVideoFrameCallback when
 * available, otherwise setTimeout) — never inside the render loop — so a slow
 * detection frame cannot stall the hologram animation. Results are delivered
 * through `onResult(hands, timestampMs)`.
 *
 * There is no fake fallback: if the model or runtime fails to load, `init`
 * throws and the UI reports the error.
 */
export class HandTracker {
  constructor(video) {
    this.video = video;
    this.landmarker = null;
    this.running = false;
    this.loading = null;
    this.fps = 30;
    this.onResult = null;
    this.lastVideoTime = -1;
    this.lastRun = 0;
    this.handle = null;
    this.backend = '';
    this.stats = { inferenceMs: 0, rate: 0 };
    this.rateWindow = [];
    this.tick = this.tick.bind(this);
  }

  get ready() {
    return !!this.landmarker;
  }

  /**
   * @param {{modelUrl?:string, delegate?:'GPU'|'CPU', numHands?:number, minConfidence?:number}} opts
   */
  init(opts = {}) {
    if (this.loading) return this.loading;
    this.loading = this.initInternal(opts).finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  async initInternal({ modelUrl = MODEL_CONFIG.localModelUrl, delegate = 'GPU', numHands = 1, minConfidence = 0.6 } = {}) {
    this.disposeLandmarker();
    const fileset = await resolveFileset();
    const resolvedModel = await resolveModelUrl(modelUrl);
    const options = (d) => ({
      baseOptions: { modelAssetPath: resolvedModel, delegate: d },
      runningMode: 'VIDEO',
      numHands,
      minHandDetectionConfidence: minConfidence,
      minHandPresenceConfidence: minConfidence,
      minTrackingConfidence: 0.5,
    });
    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, options(delegate));
      this.backend = delegate;
    } catch (err) {
      if (delegate !== 'GPU') throw err;
      // WebGL inference can be unavailable (blocklisted driver); CPU is a real, slower backend.
      console.warn('[HandTracker] GPU delegate failed, retrying on CPU:', err);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, options('CPU'));
      this.backend = 'CPU (GPU unavailable)';
    }
    this.modelUrl = resolvedModel;
    return { backend: this.backend, modelUrl: resolvedModel };
  }

  async setOptions({ numHands, minConfidence }) {
    if (!this.landmarker) return;
    await this.landmarker.setOptions({
      numHands,
      minHandDetectionConfidence: minConfidence,
      minHandPresenceConfidence: minConfidence,
    });
  }

  start() {
    if (this.running || !this.landmarker) return;
    this.running = true;
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.handle !== null) {
      clearTimeout(this.handle.id);
      this.handle = null;
    }
  }

  /**
   * Self-pacing timer at the configured tracking rate. (requestVideoFrameCallback
   * is not used: Chrome may throttle it for a video element that is never
   * composited on screen, which is the case here — the video only feeds WebGL.)
   */
  schedule() {
    if (!this.running) return;
    const interval = 1000 / Math.max(1, this.fps);
    const wait = Math.max(4, interval - (performance.now() - this.lastRun));
    this.handle = { kind: 'timeout', id: setTimeout(this.tick, wait) };
  }

  tick() {
    this.handle = null;
    if (!this.running) return;
    const now = performance.now();
    const minInterval = 1000 / Math.max(1, this.fps);
    if (now - this.lastRun >= minInterval - 2 && this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
      this.lastRun = now;
      this.lastVideoTime = this.video.currentTime;
      let result = null;
      const t0 = performance.now();
      try {
        result = this.landmarker.detectForVideo(this.video, now);
      } catch (err) {
        console.error('[HandTracker] detection failed', err);
      }
      const t1 = performance.now();
      this.stats.inferenceMs = this.stats.inferenceMs * 0.85 + (t1 - t0) * 0.15;
      this.rateWindow.push(t1);
      while (this.rateWindow.length && t1 - this.rateWindow[0] > 1000) this.rateWindow.shift();
      this.stats.rate = this.rateWindow.length;
      if (result) this.onResult?.(toHands(result), now);
    }
    this.schedule();
  }

  disposeLandmarker() {
    try {
      this.landmarker?.close();
    } catch {
      /* ignore */
    }
    this.landmarker = null;
  }

  dispose() {
    this.stop();
    this.disposeLandmarker();
  }
}

function toHands(result) {
  const hands = [];
  const lms = result.landmarks || [];
  for (let i = 0; i < lms.length; i++) {
    const cat = (result.handednesses || result.handedness || [])[i]?.[0];
    hands.push({
      landmarks: lms[i], // normalised video coords, unmirrored
      handedness: cat?.categoryName || '',
      score: cat?.score ?? 1,
    });
  }
  return hands;
}

async function urlExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    // Vite's SPA fallback answers unknown paths with index.html — not a model.
    return res.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}

async function resolveFileset() {
  const local = MODEL_CONFIG.localWasmBase;
  if (await urlExists(`${local}/vision_wasm_internal.js`)) return FilesetResolver.forVisionTasks(local);
  console.warn('[HandTracker] Local WASM runtime missing; using CDN', MODEL_CONFIG.remoteWasmBase);
  return FilesetResolver.forVisionTasks(MODEL_CONFIG.remoteWasmBase);
}

async function resolveModelUrl(url) {
  // Cross-origin URLs are passed straight to MediaPipe (a HEAD probe may be blocked by CORS).
  const absolute = new URL(url, location.href);
  if (absolute.origin !== location.origin) return absolute.href;
  if (await urlExists(url)) return url;
  if (url !== MODEL_CONFIG.remoteModelUrl) {
    console.warn(`[HandTracker] Model not found at ${url}; using ${MODEL_CONFIG.remoteModelUrl}`);
    return MODEL_CONFIG.remoteModelUrl;
  }
  throw new Error(`Hand model not reachable at ${url}. Run "npm run setup" to download it locally.`);
}
