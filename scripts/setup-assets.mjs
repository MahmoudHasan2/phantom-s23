#!/usr/bin/env node
/**
 * Prepares local runtime assets so the app can run fully offline after setup.
 *
 *  1. Copies the MediaPipe Tasks Vision WASM runtime from node_modules
 *     into public/mediapipe/wasm (served by Vite at /mediapipe/wasm).
 *  2. Downloads the Hand Landmarker model (float16, ~7.5 MB) into
 *     public/models/hand_landmarker.task (served at /models/hand_landmarker.task).
 *
 * Usage:
 *   node scripts/setup-assets.mjs              -> wasm + model
 *   node scripts/setup-assets.mjs --wasm-only  -> wasm only (used by postinstall)
 *   node scripts/setup-assets.mjs --force      -> re-download model
 *
 * Model source (Apache-2.0, Google MediaPipe):
 *   https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
 */
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));

const MODEL_URL =
  process.env.HAND_MODEL_URL ||
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

async function copyWasm() {
  const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
  const dest = join(root, 'public', 'mediapipe', 'wasm');
  if (!existsSync(src)) {
    console.warn('[setup] MediaPipe wasm folder not found (run npm install first):', src);
    return false;
  }
  await mkdir(dest, { recursive: true });
  await cp(src, dest, { recursive: true });
  console.log('[setup] Copied MediaPipe WASM runtime ->', dest);
  return true;
}

async function downloadModel() {
  const dest = join(root, 'public', 'models', 'hand_landmarker.task');
  if (existsSync(dest) && !args.has('--force')) {
    const { size } = await stat(dest);
    if (size > 1_000_000) {
      console.log(`[setup] Model already present (${(size / 1e6).toFixed(1)} MB) ->`, dest);
      return true;
    }
  }
  console.log('[setup] Downloading hand landmarker model from', MODEL_URL);
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  console.log(`[setup] Saved model (${(buf.length / 1e6).toFixed(1)} MB) ->`, dest);
  return true;
}

try {
  await copyWasm();
  if (!args.has('--wasm-only')) await downloadModel();
} catch (err) {
  console.error('[setup] ' + err.message);
  console.error('[setup] The app can still load the model from the remote URL configured in src/config/appConfig.js.');
  // Never fail npm install because of an optional asset step.
  process.exitCode = args.has('--wasm-only') ? 0 : 1;
}
