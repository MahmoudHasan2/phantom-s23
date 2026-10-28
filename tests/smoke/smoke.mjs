#!/usr/bin/env node
/**
 * End-to-end browser smoke test (no physical webcam required).
 *
 * Builds nothing itself: run `npm run build` first. Serves dist/ with Vite
 * preview, launches the locally installed Chrome or Edge (puppeteer-core does
 * not download a browser) with Chromium's synthetic fake camera, then:
 *   - enables the camera and loads the real MediaPipe model
 *   - summons the hologram, opens apps with real mouse clicks (ray-cast path)
 *   - types on the virtual keyboard and sends a WhatsApp message
 *   - injects synthetic hand landmarks through the full tracking pipeline
 *     (mapping -> gesture recognizer -> phone UI)
 *   - records 3 s of the composited canvas and verifies the file decodes
 * Screenshots are written to ./smoke-output (or $SMOKE_OUT).
 *
 * NOTE: the fake camera shows a test pattern, not a hand, so this does NOT
 * validate real-world hand-tracking accuracy — that needs the manual checklist.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';

const OUT = resolve(process.env.SMOKE_OUT || 'smoke-output');
const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome/Edge found. Set CHROME_PATH.');
  process.exit(2);
}
if (!existsSync('dist/index.html')) {
  console.error('dist/ missing — run "npm run build" first.');
  process.exit(2);
}
await mkdir(OUT, { recursive: true });

const server = await preview({ preview: { port: 4179, strictPort: true, open: false }, logLevel: 'silent' });
const url = 'http://localhost:4179/';
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--window-size=1600,900',
  ],
  defaultViewport: { width: 1600, height: 900 },
});

const errors = [];
let page;
try {
  page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(url, { waitUntil: 'networkidle0' });
  check('app boots', await page.evaluate(() => !!window.__phantom && !!document.querySelector('.gl-canvas')));
  await page.screenshot({ path: join(OUT, '01-start.png') });

  // Speed things up for the test (persisted settings are per-profile; this profile is temporary).
  await page.evaluate(() => {
    const s = window.__phantom.settings;
    s.set({ recCountdown: 0, autoQuality: false, showFeedback: true, animSpeed: 1.5, dismissGesture: 'fistHold' });
  });

  // --- Camera ---------------------------------------------------------------
  await page.click('.start-screen .btn.primary');
  await page.waitForFunction(() => window.__phantom.status.get('camera') !== 'requesting', { timeout: 15000 });
  const cam = await page.evaluate(() => ({ s: window.__phantom.status.get('camera'), w: window.__phantom.video.videoWidth, label: window.__phantom.status.get('cameraLabel'), err: window.__phantom.status.get('cameraError') }));
  check('camera starts (fake device)', cam.s === 'live' && cam.w > 0, `${cam.label} ${cam.w}px ${cam.err}`);

  // --- Model ------------------------------------------------------------------
  await page.waitForFunction(() => ['ready', 'error'].includes(window.__phantom.status.get('tracking')), { timeout: 60000 });
  const tr = await page.evaluate(() => ({ s: window.__phantom.status.get('tracking'), b: window.__phantom.status.get('trackingBackend'), e: window.__phantom.status.get('trackingError') }));
  check('hand landmarker model loads', tr.s === 'ready', tr.s === 'ready' ? `backend ${tr.b}` : tr.e);
  await sleep(4000); // first GPU inferences compile shaders; measure steady state
  const ts = await page.evaluate(() => ({ ...window.__phantom.tracker.stats }));
  check('tracking loop runs independently of rendering', ts.rate > 0, `${ts.rate} inferences/s, ${ts.inferenceMs.toFixed(1)} ms each (software GPU in headless mode)`);

  // --- Summon -------------------------------------------------------------------
  await page.keyboard.press('h');
  await page.waitForFunction(() => window.__phantom.holo.state === 'active', { timeout: 10000 });
  check('hologram summons (keyboard)', true);
  await sleep(600);
  await page.screenshot({ path: join(OUT, '02-home.png') });

  // Helper: CSS-pixel position of a phone-UI coordinate.
  const uiToCss = (x, y) =>
    page.evaluate(
      (x, y) => {
        const app = window.__phantom;
        const p = app.holoScene.uiToScreen(x, y, { x: 0, y: 0 });
        const r = app.canvas.getBoundingClientRect();
        return { x: r.left + (p.x * r.width) / app.canvas.width, y: r.top + (p.y * r.height) / app.canvas.height };
      },
      x,
      y,
    );
  const clickUI = async (x, y) => {
    const p = await uiToCss(x, y);
    await page.mouse.move(p.x, p.y);
    await sleep(60);
    await page.mouse.click(p.x, p.y);
    await sleep(80);
  };
  const regionCenter = (id) =>
    page.evaluate((id) => {
      const r = window.__phantom.phone.ui.regions.find((g) => g.id === id);
      return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
    }, id);
  const route = () => page.evaluate(() => ({ ...window.__phantom.phone.router.current }));
  const waitIdle = () => page.waitForFunction(() => !window.__phantom.phone.transition, { timeout: 5000 });

  // --- Open WhatsApp by clicking its icon -------------------------------------------
  let c = await regionCenter('home-whatsapp');
  await clickUI(c.x, c.y);
  await waitIdle();
  check('clicking the WhatsApp icon opens WhatsApp', (await route()).app === 'whatsapp');
  await sleep(300);
  c = await regionCenter('whatsapp-row-wa-lena');
  await clickUI(c.x, c.y);
  await waitIdle();
  check('opening a conversation', (await route()).view === 'chat');
  c = await regionCenter('whatsapp-composer-field');
  await clickUI(c.x, c.y);
  await sleep(500);
  check('composer focus shows the virtual keyboard', await page.evaluate(() => window.__phantom.phone.keyboardShown));

  // Type "Hallo" by clicking virtual keys.
  for (const ch of ['H', 'a', 'l', 'l', 'o']) {
    const k = await page.evaluate((ch) => {
      const kb = window.__phantom.phone.keyboard;
      const key = kb.keys.find((k) => k.value === ch);
      return key ? { x: key.x + key.w / 2 + kb.originX, y: key.y + key.h / 2 + kb.originY } : null;
    }, ch);
    if (!k) {
      check(`key ${ch} exists`, false);
      continue;
    }
    await clickUI(k.x, k.y);
  }
  const typed = await page.evaluate(() => window.__phantom.phone.composer.buffer.text);
  check('virtual keyboard typing updates the composer', typed === 'Hallo', `"${typed}"`);
  await page.screenshot({ path: join(OUT, '03-whatsapp-typing.png') });
  c = await regionCenter('whatsapp-composer-send');
  await clickUI(c.x, c.y);
  await sleep(300);
  const sent = await page.evaluate(() => {
    const chat = window.__phantom.chats.whatsapp.getChat('wa-lena');
    return { last: chat.messages.at(-1), buf: window.__phantom.phone.composer.buffer.text };
  });
  check('send appends a simulated message and clears the composer', sent.last.text === 'Hallo' && sent.last.from === 'me' && sent.buf === '', JSON.stringify(sent.last));
  await sleep(2800);
  const status = await page.evaluate(() => window.__phantom.chats.whatsapp.getChat('wa-lena').messages.find((m) => m.text === 'Hallo').status);
  check('delivery animation advances', status === 'read', status);

  // Back (Esc closes keyboard first, then navigates), then close app.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await waitIdle();
  check('back navigation returns to the chat list', (await route()).view === 'main');
  await page.keyboard.press('Home');
  await waitIdle();
  check('closing the app returns home', (await route()).app === 'home');

  // --- Facebook + scrolling ------------------------------------------------------
  c = await regionCenter('home-facebook');
  await clickUI(c.x, c.y);
  await waitIdle();
  check('Facebook opens', (await route()).app === 'facebook');
  const mid = await uiToCss(225, 600);
  await page.mouse.move(mid.x, mid.y);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel({ deltaY: 120 });
    await sleep(40);
  }
  await sleep(300);
  const off = await page.evaluate(() => window.__phantom.phone.ui.scrollState('fb-feed').offset);
  check('scrolling the Facebook feed', off > 50, `offset ${off.toFixed(0)}`);
  await page.screenshot({ path: join(OUT, '04-facebook.png') });
  await page.keyboard.press('Home');
  await waitIdle();

  // --- Every app icon opens its app -------------------------------------------------
  const apps = ['facebook', 'whatsapp', 'youtube', 'instagram', 'phone', 'messages', 'camera', 'gallery', 'settings'];
  const opened = [];
  for (const id of apps) {
    const rc = await regionCenter(`home-${id}`);
    if (!rc) continue;
    await clickUI(rc.x, rc.y);
    await waitIdle();
    if ((await route()).app === id) opened.push(id);
    if (id === 'youtube' || id === 'camera') await page.screenshot({ path: join(OUT, `05-${id}.png`) });
    await page.keyboard.press('Home');
    await waitIdle();
  }
  check('all 9 app icons open the correct app', opened.length === apps.length, opened.join(','));

  // --- Synthetic hands through the real tracking pipeline -------------------------
  // Stop real inference (fake camera has no hands) and feed MediaPipe-shaped results.
  const pipe = await page.evaluate(async () => {
    const app = window.__phantom;
    app.tracker.stop();
    const base = { 0: [0, 0], 1: [-0.35, -0.25], 2: [-0.55, -0.42], 3: [-0.78, -0.6], 4: [-0.95, -0.7], 5: [-0.3, -0.95], 6: [-0.35, -1.35], 7: [-0.37, -1.6], 8: [-0.38, -1.85], 9: [0, -1], 10: [0, -1.45], 11: [0, -1.72], 12: [0, -1.98], 13: [0.25, -0.93], 14: [0.28, -1.3], 15: [0.3, -1.55], 16: [0.31, -1.78], 17: [0.45, -0.8], 18: [0.52, -1.1], 19: [0.55, -1.3], 20: [0.58, -1.48] };
    const fist = { 6: [-0.33, -1.15], 7: [-0.32, -0.95], 8: [-0.3, -0.75], 10: [0, -1.2], 11: [0, -1], 12: [0, -0.8], 14: [0.26, -1.1], 15: [0.25, -0.92], 16: [0.24, -0.74], 18: [0.48, -0.95], 19: [0.47, -0.8], 20: [0.45, -0.65], 3: [-0.3, -0.55], 4: [-0.1, -0.7] };
    // Normalised video coords; the hand sits so its index tip lands where we want on screen.
    const mk = (pose, tipScreen) => {
      const u = { ...base, ...(pose === 'fist' ? fist : {}) };
      if (pose === 'pinch') Object.assign(u, { 10: fist[10], 11: fist[11], 12: fist[12], 14: fist[14], 15: fist[15], 16: fist[16], 18: fist[18], 19: fist[19], 20: fist[20], 7: [-0.4, -1.45], 8: [-0.42, -1.55], 4: [-0.47, -1.55], 3: [-0.6, -1.3] });
      const s = 0.12;
      // Find video coords of the desired index-tip screen point.
      const t = app.compositor.transform;
      const W = app.canvas.width;
      const H = app.canvas.height;
      const sx = (tipScreen.x / W) * t.scaleX + t.offsetX;
      const vx = app.settings.get('mirror') ? 1 - sx : sx;
      const vy = (tipScreen.y / H) * t.scaleY + t.offsetY;
      const tipU = u[8];
      const dirX = app.settings.get('mirror') ? -1 : 1; // mirrored video flips x
      const lm = [];
      // Equal on-screen scale on both axes: dx_screen = dy_screen = du * s * H / scaleY.
      const kx = s * (H / W) * (t.scaleX / t.scaleY);
      for (let i = 0; i < 21; i++) lm.push({ x: vx + dirX * (u[i][0] - tipU[0]) * kx, y: vy + (u[i][1] - tipU[1]) * s, z: 0 });
      return [{ landmarks: lm, handedness: 'Left', score: 0.97 }];
    };
    let t = performance.now();
    const feed = async (pose, target, n) => {
      for (let i = 0; i < n; i++) {
        t += 33;
        app.interaction.onTrackingResult(mk(pose, typeof target === 'function' ? target(i) : target), t);
        await new Promise((r) => requestAnimationFrame(r));
      }
    };
    const out = { events: [] };
    const orig = app.interaction.handleGesture.bind(app.interaction);
    app.interaction.handleGesture = (e) => {
      if (e.type !== 'drag' && e.type !== 'poseChange') out.events.push(e.type);
      orig(e);
    };
    const icon = app.phone.ui.regions.find((r) => r.id === 'home-youtube');
    const target = app.holoScene.uiToScreen(icon.x + icon.w / 2, icon.y + icon.h / 2, { x: 0, y: 0 });
    // Hover, pinch, release -> click opens YouTube.
    await feed('open', target, 4);
    await feed('pinch', target, 4);
    await feed('open', target, 6);
    await new Promise((r) => setTimeout(r, 800));
    out.pinchOpened = app.phone.router.current.app;
    // Pinch-and-hold closes the app.
    const mid = app.holoScene.uiToScreen(225, 500, { x: 0, y: 0 });
    await feed('open', mid, 4);
    await feed('pinch', mid, 45);
    await feed('open', mid, 4);
    await new Promise((r) => setTimeout(r, 600));
    out.holdClosed = app.phone.router.current.app;
    // Fist hold dismisses, open palm hold summons again.
    await feed('fist', mid, 45);
    await new Promise((r) => setTimeout(r, 1800));
    out.afterFist = app.holo.state;
    await feed('open', mid, 40);
    await new Promise((r) => setTimeout(r, 2500));
    out.afterPalm = app.holo.state;
    // Tracking loss resets gesture state.
    await feed('pinch', mid, 3);
    for (let i = 0; i < 15; i++) {
      t += 33;
      app.interaction.onTrackingResult([], t);
    }
    out.afterLoss = { pinching: app.recognizer.state.pinching, tracked: app.recognizer.state.tracked };
    app.interaction.handleGesture = orig;
    out.events = out.events.join(',');
    app.tracker.start();
    return out;
  });
  check('hand pipeline: pinch-click on an icon opens the app', pipe.pinchOpened === 'youtube', `${pipe.pinchOpened} | events: ${pipe.events}`);
  check('hand pipeline: pinch-and-hold closes the app', pipe.holdClosed === 'home', pipe.holdClosed);
  check('hand pipeline: fist hold dismisses', pipe.afterFist === 'hidden', pipe.afterFist);
  check('hand pipeline: open palm summons again', pipe.afterPalm === 'active', pipe.afterPalm);
  check('hand pipeline: tracking loss resets state', !pipe.afterLoss.pinching && !pipe.afterLoss.tracked, JSON.stringify(pipe.afterLoss));

  // --- Recording ----------------------------------------------------------------------
  await page.keyboard.press('r');
  await page.waitForFunction(() => window.__phantom.status.get('recording') === 'recording', { timeout: 5000 });
  const mime = await page.evaluate(() => window.__phantom.recorder.choice.mimeType);
  await sleep(3000);
  await page.keyboard.press('r');
  await page.waitForFunction(() => !!window.__phantom.recorder.result, { timeout: 10000 });
  const rec = await page.evaluate(async () => {
    const r = window.__phantom.recorder.result;
    const v = document.createElement('video');
    v.muted = true;
    v.src = r.url;
    const meta = await new Promise((res) => {
      // WebM from MediaRecorder has no duration index; play briefly and sample a later frame.
      v.onloadeddata = () => {
        v.play().catch(() => {});
        setTimeout(() => res({ w: v.videoWidth, h: v.videoHeight, at: v.currentTime }), 1500);
      };
      v.onerror = () => res({ error: v.error?.message || 'decode error' });
      setTimeout(() => res({ error: 'timeout' }), 8000);
    });
    // Sample the decoded first frame: it must not be blank (camera + hologram composited).
    let lit = 0;
    if (meta.w) {
      const c = document.createElement('canvas');
      c.width = 160;
      c.height = 90;
      const ctx = c.getContext('2d');
      ctx.drawImage(v, 0, 0, 160, 90);
      const d = ctx.getImageData(0, 0, 160, 90).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
    }
    const buf = await r.blob.arrayBuffer();
    return { size: r.size, mime: r.mimeType, format: r.format, duration: r.duration, meta, lit, head: Array.from(new Uint8Array(buf.slice(0, 4))) };
  });
  check('recording produces a non-empty file', rec.size > 10000, `${(rec.size / 1024).toFixed(0)} KB, ${rec.format}, ${rec.duration.toFixed(1)} s, selected ${mime}`);
  check('recorded file decodes in the browser', !!rec.meta.w, JSON.stringify(rec.meta));
  check('recorded frame contains composited content', rec.lit > 200, `${rec.lit} lit pixels of 14400`);
  const isWebm = rec.head[0] === 0x1a && rec.head[1] === 0x45 && rec.head[2] === 0xdf && rec.head[3] === 0xa3;
  check('container signature matches', rec.mime.includes('webm') ? isWebm : true, rec.head.map((b) => b.toString(16)).join(' '));
  await page.screenshot({ path: join(OUT, '06-recording-dialog.png') });
  await page.evaluate(() => window.__phantom.recordingControls.close());

  // --- Presentation mode ---------------------------------------------------------
  await page.keyboard.press('p');
  await sleep(2600);
  const pres = await page.evaluate(() => getComputedStyle(document.querySelector('.dock')).display);
  check('presentation mode hides developer controls', pres === 'none');
  await page.screenshot({ path: join(OUT, '07-presentation.png') });
  await page.keyboard.press('p');

  // --- Stop camera cleans up tracks ----------------------------------------------------
  const stopped = await page.evaluate(() => {
    const app = window.__phantom;
    const tracks = app.camera.stream.getTracks();
    app.stopCamera();
    return tracks.every((t) => t.readyState === 'ended') && !app.video.srcObject;
  });
  check('stopping the camera ends all media tracks', stopped);

  const fps = await page.evaluate(() => window.__phantom.status.get('fps'));
  console.log(`info  render FPS in headless/SwiftShader: ${fps.toFixed(1)} (not representative of real hardware)`);
} catch (err) {
  check('smoke run completed without exceptions', false, err.stack || err.message);
  if (page) await page.screenshot({ path: join(OUT, 'zz-failure.png') }).catch(() => {});
} finally {
  const relevant = errors.filter((e) => !/favicon|DevTools/.test(e));
  check('no uncaught page errors', relevant.length === 0, relevant.slice(0, 5).join(' | '));
  await writeFile(join(OUT, 'results.json'), JSON.stringify({ browser: executablePath, results, errors }, null, 2));
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots: ${OUT}`);
  process.exit(failed ? 1 : 0);
}
