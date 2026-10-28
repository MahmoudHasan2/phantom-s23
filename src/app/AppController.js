import * as THREE from 'three';
import { QUALITY_PRESETS, STORAGE_KEYS } from '../config/appConfig.js';
import { DEMO_CONTENT } from '../config/demoContent.js';
import { createStatusStore, safeLocalStorage, SettingsStore } from './AppState.js';
import { HologramStateMachine, HOLO } from './HologramStateMachine.js';
import { CameraManager } from '../camera/CameraManager.js';
import { CameraCompositor } from '../camera/CameraCompositor.js';
import { HandTracker } from '../tracking/HandTracker.js';
import { GestureRecognizer } from '../tracking/GestureRecognizer.js';
import { HologramScene } from '../hologram/HologramScene.js';
import { CursorOverlay } from '../hologram/CursorOverlay.js';
import { PhoneUI } from '../uicanvas/PhoneUI.js';
import { ChatStore } from '../apps/ChatStore.js';
import { InteractionController } from '../interactions/InteractionController.js';
import { RecordingController } from '../recording/RecordingController.js';
import { SoundEngine } from '../audio/SoundEngine.js';
import { FeedbackToasts } from '../ui/FeedbackToasts.js';
import { DebugOverlay } from '../ui/DebugOverlay.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { CalibrationPanel } from '../ui/CalibrationPanel.js';
import { RecordingControls } from '../ui/RecordingControls.js';
import { CameraControls } from '../ui/CameraControls.js';
import { ControlDock } from '../ui/ControlDock.js';
import { h } from '../ui/dom.js';

const QUALITY_ORDER = ['low', 'medium', 'high'];

/** Keys held for smooth hologram control: arrows move, WASD tilt, 1/2 zoom. */
const HELD_KEYS = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd', '1', '2']);

/**
 * Top-level orchestrator: builds every subsystem, runs the single render
 * loop, and manages camera/tracking lifecycle, quality, presentation mode,
 * keyboard shortcuts and cleanup.
 */
export class AppController {
  constructor(root) {
    this.root = root;
    this.settings = new SettingsStore();
    this.status = createStatusStore();
    this.sound = new SoundEngine();
    this.disposers = [];
    this.running = false;
    this.lastT = 0;
    this.activeQuality = this.settings.get('quality');
    this.perfWindow = { frames: 0, time: 0, slowFor: 0 };
    this.statusTimer = 0;
    this.startup = null; // { start, fadeDur, summonAt }
    this.heldKeys = new Set();
    this.frame = this.frame.bind(this);
  }

  init() {
    const st = this.settings.state;

    // --- DOM scaffolding --------------------------------------------------
    this.stage = h('div', { class: 'stage' });
    this.uiLayer = h('div', { class: 'ui-layer' });
    this.root.append(this.stage, this.uiLayer);
    this.video = h('video', { class: 'camera-video', muted: true, playsinline: true, autoplay: true });
    this.video.muted = true;
    this.stage.appendChild(this.video);

    // --- WebGL ------------------------------------------------------------
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (err) {
      this.root.appendChild(h('div', { class: 'fatal', text: `WebGL is not available: ${err.message}. Enable hardware acceleration in the browser settings.` }));
      throw err;
    }
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'gl-canvas';
    this.stage.appendChild(this.canvas);
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.feedback?.notice('Graphics context lost — reload the page if the view does not recover.', 'warn', 8000);
    });

    // --- Core systems -----------------------------------------------------
    this.camera = new CameraManager(this.video);
    this.compositor = new CameraCompositor(this.video);
    const storage = safeLocalStorage();
    this.chats = {
      whatsapp: new ChatStore({ chats: DEMO_CONTENT.whatsapp.chats, autoReplies: DEMO_CONTENT.whatsapp.autoReplies, storage, storageKey: `${STORAGE_KEYS.chats}.wa` }),
      messages: new ChatStore({ chats: DEMO_CONTENT.messages.chats, autoReplies: [], storage, storageKey: `${STORAGE_KEYS.chats}.sms` }),
    };
    this.gallery = {
      photos: [],
      add(c) {
        this.photos.unshift(c);
        if (this.photos.length > 24) this.photos.pop();
      },
    };
    this.phone = new PhoneUI({
      settings: this.settings,
      content: DEMO_CONTENT,
      sound: this.sound,
      video: this.video,
      services: {
        openExternal: (url) => this.openExternal(url),
        openPanel: () => this.openSettingsPanel(),
        chats: this.chats,
        gallery: this.gallery,
      },
    });
    const preset = QUALITY_PRESETS[this.activeQuality];
    this.holoScene = new HologramScene(this.phone.canvas, preset.particles * st.particleAmount);
    this.holoScene.screen.setAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    this.overlay = new CursorOverlay();
    this.holo = new HologramStateMachine();
    this.holo.onChange = (state) => this.onHologramState(state);
    this.recognizer = new GestureRecognizer();
    this.tracker = new HandTracker(this.video);
    this.tracker.fps = st.trackingFps;
    this.tracker.onResult = (hands, t) => this.interaction.onTrackingResult(hands, t);

    // --- UI -----------------------------------------------------------------
    this.feedback = new FeedbackToasts(this.uiLayer, this.settings, this.status);
    this.debug = new DebugOverlay(this.stage, this.canvas);
    this.debug.setVisible(st.debugOverlay);
    this.interaction = new InteractionController({
      settings: this.settings,
      status: this.status,
      recognizer: this.recognizer,
      holo: this.holo,
      holoScene: this.holoScene,
      phone: this.phone,
      compositor: this.compositor,
      feedback: this.feedback,
      sound: this.sound,
      canvas: this.canvas,
    });
    this.recorder = new RecordingController(this.canvas, this.sound);
    this.recordingControls = new RecordingControls(this.uiLayer, this.recorder, this.settings, this.status, this.feedback);
    this.settingsPanel = new SettingsPanel(this.uiLayer, this.settings, {
      onReloadModel: () => this.initTracking(true),
      onResetChats: () => {
        this.chats.whatsapp.reset();
        this.chats.messages.reset();
        this.feedback.notice('Demo conversations reset', 'info');
      },
      onCalibrate: () => this.calibration.toggle(true),
    });
    this.calibration = new CalibrationPanel(this.uiLayer, this.settings, this.recognizer);
    this.dock = new ControlDock(this.uiLayer, this.status, {
      onToggleHologram: () => this.toggleHologram(),
      onToggleCamera: () => (this.camera.active ? this.stopCamera() : this.startCamera(this.camera.deviceId)),
      onSwitchCamera: (id) => this.startCamera(id),
      onCalibrate: () => this.calibration.toggle(),
      onToggleDebug: () => this.settings.update('debugOverlay', !this.settings.get('debugOverlay')),
      onSettings: () => this.settingsPanel.toggle(),
      onRecord: () => this.recordingControls.toggle(),
      onPresent: () => this.togglePresentation(),
      onFullscreen: () => this.toggleFullscreen(),
    });
    this.startScreen = new CameraControls(this.uiLayer, {
      onStart: (id) => this.startCamera(id),
      onDemo: () => this.enterDemoMode(),
    });
    this.presentHint = h('div', { class: 'present-hint', text: 'Presentation mode · P exit · R record · H hologram · F fullscreen' });
    this.uiLayer.appendChild(this.presentHint);
    this.status.set({ quality: this.activeQuality });

    if (!CameraManager.isSupported()) this.startScreen.setError('This browser cannot access cameras. Use the latest Chrome or Edge on http://localhost.');
    this.camera.listCameras().then((list) => this.startScreen.setCameras(list)).catch(() => {});
    this.camera.onEnded = (err) => this.onCameraLost(err);
    this.camera.onDevicesChanged = () => this.refreshCameraList();

    // --- Wiring -------------------------------------------------------------
    this.sound.configure({ enabled: st.sound, volume: st.soundVolume });
    this.disposers.push(this.settings.subscribe((state, changed) => this.onSettingsChanged(changed)));
    this.bindGlobalEvents();
    this.applyQuality();
    this.resize();
    this.start();
    return this;
  }

  // ------------------------------------------------------------ settings ---
  onSettingsChanged(changed) {
    const st = this.settings.state;
    const has = (...k) => k.some((x) => changed.includes(x));
    if (has('quality')) {
      this.activeQuality = st.quality;
      this.perfWindow.slowFor = 0;
    }
    if (has('quality', 'particleAmount')) this.applyQuality();
    if (has('outputSize', 'renderScale', 'quality')) this.resize();
    if (has('trackingFps')) this.tracker.fps = st.trackingFps;
    if (has('numHands', 'minConfidence')) this.tracker.setOptions({ numHands: Number(st.numHands), minConfidence: st.minConfidence }).catch(() => {});
    if (has('delegate', 'modelUrl')) this.feedback.notice('Press “Reload tracking model” to apply the new backend / model URL.', 'info');
    if (has('sound', 'soundVolume')) this.sound.configure({ enabled: st.sound, volume: st.soundVolume });
    if (has('debugOverlay')) this.debug.setVisible(st.debugOverlay);
    if (has('keyboardLayout')) this.phone.keyboard.setLayout(st.keyboardLayout);
    if (has('camResolution') && this.camera.active) this.startCamera(this.camera.deviceId);
  }

  applyQuality() {
    const preset = QUALITY_PRESETS[this.activeQuality];
    this.holoScene.particles.setCount(preset.particles * this.settings.get('particleAmount'));
    this.phone.setScale(preset.uiScale);
    this.phone.maxFps = preset.uiFps;
    this.status.set({ quality: this.activeQuality });
  }

  resize() {
    const st = this.settings.state;
    const preset = QUALITY_PRESETS[this.activeQuality];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let w;
    let h2;
    let css;
    if (st.outputSize === 'window') {
      const pr = Math.min(window.devicePixelRatio || 1, preset.pixelRatioCap) * st.renderScale;
      w = Math.max(2, Math.round(vw * pr));
      h2 = Math.max(2, Math.round(vh * pr));
      css = { left: '0px', top: '0px', width: `${vw}px`, height: `${vh}px` };
    } else {
      [w, h2] = st.outputSize.split('x').map(Number);
      const s = Math.min(vw / w, vh / h2);
      css = { left: `${(vw - w * s) / 2}px`, top: `${(vh - h2 * s) / 2}px`, width: `${w * s}px`, height: `${h2 * s}px` };
    }
    // Width/height must be even for some video encoders.
    w -= w % 2;
    h2 -= h2 % 2;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h2, false);
    Object.assign(this.canvas.style, css);
    this.holoScene.resize(w, h2);
    this.overlay.resize(w, h2);
  }

  // ----------------------------------------------------------- render loop --
  start() {
    if (this.running) return; // never run two loops
    this.running = true;
    this.lastT = performance.now() / 1000;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  frame(nowMs) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const t = nowMs / 1000;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    const st = this.settings.state;
    const W = this.canvas.width;
    const H = this.canvas.height;

    this.trackPerformance(dt);
    this.applyHeldKeys(dt);
    this.holo.configure({ speed: st.animSpeed, skip: st.skipAnimations });
    this.holo.update(dt);
    const formation = this.holo.formation;

    if (this.holo.visible && this.phone.draw(t, dt, formation)) this.holoScene.screen.markTextureDirty();

    this.compositor.update(st, W, H, t);
    this.holoScene.update(st, t, formation, this.holo.state === HOLO.DISMISSING, QUALITY_PRESETS[this.activeQuality]);
    const cursor = this.interaction.update(dt);
    const fade = this.updateStartup(t);
    this.overlay.update(cursor, t, st.letterbox, fade);

    this.renderer.clear();
    this.compositor.render(this.renderer);
    this.holoScene.render(this.renderer);
    this.overlay.render(this.renderer);

    if (this.debug.visible) {
      this.debug.draw({
        hands: this.interaction.debugHands,
        recognizer: this.recognizer,
        holoScene: this.holoScene,
        interaction: this.interaction,
        settings: st,
        status: this.status.state,
        tracker: this.tracker,
      });
    }
    this.calibration.update();
  }

  /** Smooth keyboard control of position (arrows), tilt (WASD) and size (1/2). */
  applyHeldKeys(dt) {
    if (!this.heldKeys.size) return;
    const k = this.heldKeys;
    const st = this.settings.state;
    const patch = {};
    const move = 0.45 * dt;
    const tilt = 35 * dt;
    const zoom = 0.35 * dt;
    if (k.has('arrowleft')) patch.posX = st.posX - move;
    if (k.has('arrowright')) patch.posX = st.posX + move;
    if (k.has('arrowup')) patch.posY = st.posY + move;
    if (k.has('arrowdown')) patch.posY = st.posY - move;
    if (k.has('w')) patch.tiltX = st.tiltX - tilt;
    if (k.has('s')) patch.tiltX = st.tiltX + tilt;
    if (k.has('a')) patch.tiltY = st.tiltY - tilt;
    if (k.has('d')) patch.tiltY = st.tiltY + tilt;
    if (k.has('1')) patch.holoSize = st.holoSize + zoom;
    if (k.has('2')) patch.holoSize = st.holoSize - zoom;
    for (const [key, v] of Object.entries(patch)) this.settings.update(key, v);
  }

  trackPerformance(dt) {
    const p = this.perfWindow;
    p.frames++;
    p.time += dt;
    this.statusTimer += dt;
    if (p.time >= 1) {
      const fps = p.frames / p.time;
      p.frames = 0;
      p.time = 0;
      this.status.set({
        fps,
        trackFps: this.tracker.stats.rate,
        inferenceMs: this.tracker.stats.inferenceMs,
      });
      // Auto-quality: 4 consecutive slow seconds -> step down one preset.
      if (this.settings.get('autoQuality') && fps < 24 && !document.hidden) p.slowFor++;
      else p.slowFor = 0;
      if (p.slowFor >= 4) {
        p.slowFor = 0;
        const i = QUALITY_ORDER.indexOf(this.activeQuality);
        if (i > 0) {
          this.activeQuality = QUALITY_ORDER[i - 1];
          this.applyQuality();
          this.resize();
          this.feedback.notice(`Performance: switched to ${this.activeQuality} quality (${fps.toFixed(0)} FPS measured).`, 'warn', 5000);
        }
      }
    }
  }

  // --------------------------------------------------------------- camera ---
  async startCamera(deviceId = null) {
    const st = this.settings.state;
    this.startScreen.setBusy('Requesting camera access…');
    this.status.set({ camera: 'requesting', cameraError: '' });
    let info;
    try {
      info = await this.camera.start({ deviceId, resolution: st.camResolution });
    } catch (err) {
      this.status.set({ camera: 'error', cameraError: err.message });
      this.compositor.setVideoActive(false);
      this.startScreen.show(true);
      this.startScreen.setError(err.message);
      return false;
    }
    this.compositor.setVideoActive(true);
    this.status.set({ camera: 'live', cameraLabel: info.label, demoMode: false });
    this.startScreen.setIdle();
    this.startScreen.show(false);
    this.feedback.notice(`Camera: ${info.label} · ${info.width}×${info.height}`, 'info');
    this.refreshCameraList(info.deviceId);
    await this.initTracking(false);
    this.beginStartupSequence();
    return true;
  }

  async refreshCameraList(selected = this.camera.deviceId) {
    try {
      const list = await this.camera.listCameras();
      this.startScreen.setCameras(list, selected);
      this.dock.setCameras(list, selected);
    } catch {
      /* ignore */
    }
  }

  stopCamera() {
    this.tracker.stop();
    this.camera.stop();
    this.compositor.setVideoActive(false);
    this.interaction.resetTracking();
    this.status.set({ camera: 'stopped' });
    this.feedback.notice('Camera stopped. Mouse input remains available.', 'info');
  }

  onCameraLost(err) {
    this.tracker.stop();
    this.camera.stop();
    this.compositor.setVideoActive(false);
    this.interaction.resetTracking();
    this.status.set({ camera: 'error', cameraError: err.message });
    this.feedback.notice(err.message, 'warn', 8000);
    this.startScreen.show(true);
    this.startScreen.setError(err.message);
  }

  async initTracking(force) {
    const st = this.settings.state;
    if (this.tracker.ready && !force) {
      this.tracker.start();
      return;
    }
    this.tracker.stop();
    this.status.set({ tracking: 'loading', trackingError: '' });
    this.feedback.notice('Loading hand-tracking model…', 'info', 2500);
    try {
      const { backend } = await this.tracker.init({
        modelUrl: st.modelUrl,
        delegate: st.delegate,
        numHands: Number(st.numHands),
        minConfidence: st.minConfidence,
      });
      this.status.set({ tracking: 'ready', trackingBackend: backend });
      this.feedback.notice(`Hand tracking ready (${backend}). Show an open palm to summon the hologram.`, 'info', 4000);
      if (this.camera.active) this.tracker.start();
    } catch (err) {
      console.error(err);
      const msg = `Hand tracking failed to load: ${err.message || err}. Gestures are unavailable; mouse input still works. Run "npm run setup" and reload.`;
      this.status.set({ tracking: 'error', trackingError: msg });
      this.feedback.notice(msg, 'warn', 10000);
      this.interaction.resetTracking();
    }
  }

  enterDemoMode() {
    this.camera.stop();
    this.tracker.stop();
    this.compositor.setVideoActive(false);
    this.status.set({ demoMode: true, camera: 'idle' });
    this.startScreen.show(false);
    this.feedback.notice('DEMO MODE — simulated input: the mouse acts as your finger. No camera and no hand tracking are active.', 'warn', 6000);
    setTimeout(() => this.interaction.summon(), 500);
  }

  // ------------------------------------------------------------- hologram ---
  toggleHologram() {
    if (this.holo.visible && this.holo.state !== HOLO.DISMISSING) this.interaction.dismiss();
    else this.interaction.summon();
  }

  onHologramState(state) {
    this.status.set({ hologram: state });
    if (state === HOLO.HIDDEN) {
      // Next summon always starts on the home screen in a clean state.
      this.phone.resetToHome();
    }
  }

  // -------------------------------------------------------- presentation ---
  togglePresentation(force) {
    const on = force ?? !this.status.get('presentation');
    this.status.set({ presentation: on });
    document.body.classList.toggle('presentation', on);
    if (on) {
      this.settingsPanel.toggle(false);
      this.calibration.toggle(false);
      this.presentHint.classList.remove('show');
      void this.presentHint.offsetWidth;
      this.presentHint.classList.add('show');
      this.beginStartupSequence(true);
    }
  }

  /** Cinematic intro: fade from black, then optionally auto-summon. */
  beginStartupSequence(fromPresentation = false) {
    const st = this.settings.state;
    if (!st.startupSequence) return;
    if (!fromPresentation && !this.status.get('presentation')) return;
    const t = performance.now() / 1000;
    this.startup = { start: t, fadeDur: 2.2 / st.animSpeed, summonAt: t + 1.4 / st.animSpeed, summoned: false };
  }

  updateStartup(t) {
    const s = this.startup;
    if (!s) return 0;
    if (!s.summoned && t >= s.summonAt) {
      s.summoned = true;
      if (this.settings.get('autoSummon') && this.holo.state === HOLO.HIDDEN) this.interaction.summon();
    }
    const k = (t - s.start) / s.fadeDur;
    if (k >= 1 && s.summoned) this.startup = null;
    return Math.max(0, 1 - k * k);
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch((err) => this.feedback.notice(`Fullscreen unavailable: ${err.message}`, 'warn'));
  }

  openSettingsPanel() {
    if (this.status.get('presentation')) this.togglePresentation(false);
    this.settingsPanel.toggle(true);
  }

  /** Opens a URL in a normal tab. Returns false if the browser blocked it. */
  openExternal(url) {
    const w = window.open('about:blank', '_blank');
    if (!w) return false;
    w.opener = null;
    w.location.href = url;
    return true;
  }

  // --------------------------------------------------------------- events ---
  bindGlobalEvents() {
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this.disposers.push(() => target.removeEventListener(type, fn, opts));
    };
    let resizeRaf = 0;
    on(window, 'resize', () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => this.resize());
    });
    on(document, 'visibilitychange', () => {
      if (document.hidden) {
        if (this.recordingControls.busy) this.recordingHiddenWarning = true;
        this.stop();
        this.tracker.stop();
      } else {
        this.start();
        if (this.camera.active && this.tracker.ready) this.tracker.start();
        if (this.recordingHiddenWarning) {
          this.recordingHiddenWarning = false;
          this.feedback.notice('The tab was hidden while recording — that part of the video is frozen. Keep the tab visible while recording.', 'warn', 7000);
        }
      }
    });
    on(window, 'keydown', (e) => this.onKey(e));
    on(window, 'keyup', (e) => this.heldKeys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => this.heldKeys.clear());
    on(window, 'pagehide', () => this.dispose());
  }

  onKey(e) {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    // Held keys drive smooth movement/tilt/zoom in the render loop (see applyHeldKeys).
    if (HELD_KEYS.has(key)) {
      this.heldKeys.add(key);
      e.preventDefault();
      return;
    }
    switch (key) {
      case 'shift': {
        if (e.repeat) break;
        // Cycle transparency levels.
        const levels = [0.92, 0.65, 0.4];
        const cur = this.settings.get('opacity');
        const i = levels.findIndex((v) => Math.abs(v - cur) < 0.02);
        this.settings.update('opacity', levels[(i + 1) % levels.length]);
        break;
      }
      case ' ':
      case 'pagedown':
        // Wink click (Space or a presenter remote): select what the cursor points at.
        document.activeElement?.blur?.();
        this.interaction.clickAtCursor();
        break;
      case 'h':
        this.toggleHologram();
        break;
      case 'p':
        this.togglePresentation();
        break;
      case 'r':
        this.recordingControls.toggle();
        break;
      case 'f':
        this.toggleFullscreen();
        break;
      case 'o':
        if (this.status.get('presentation')) this.togglePresentation(false);
        this.settingsPanel.toggle();
        break;
      case 'g':
        this.settings.update('debugOverlay', !this.settings.get('debugOverlay'));
        break;
      case 'c':
        if (this.status.get('presentation')) this.togglePresentation(false);
        this.calibration.toggle();
        break;
      case 'escape':
        if (this.settingsPanel.open) this.settingsPanel.toggle(false);
        else if (this.calibration.open) this.calibration.toggle(false);
        else if (this.holo.interactive) this.phone.back();
        break;
      case 'home':
        if (this.holo.interactive) this.phone.home();
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    for (const d of this.disposers) d();
    this.recorder?.dispose();
    this.recordingControls?.dispose();
    this.tracker?.dispose();
    this.camera?.dispose();
    this.interaction?.dispose();
    this.dock?.dispose();
    this.settingsPanel?.dispose();
    this.holoScene?.dispose();
    this.compositor?.dispose();
    this.overlay?.dispose();
    this.phone?.dispose();
    this.sound?.dispose();
    this.renderer?.dispose();
    this.stage?.remove();
    this.uiLayer?.remove();
  }
}

