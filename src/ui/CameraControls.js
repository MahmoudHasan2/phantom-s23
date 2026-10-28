import { APP_NAME } from '../config/appConfig.js';
import { h } from './dom.js';

/**
 * Start screen (explicit permission step), camera selector, loading state and
 * error/retry handling. The webcam is never activated before the operator
 * clicks "Enable camera".
 */
export class CameraControls {
  constructor(root, actions) {
    this.actions = actions; // { onStart(deviceId), onDemo() }
    this.select = h('select', { class: 'camera-select', 'aria-label': 'Camera' }, [h('option', { value: '', text: 'Default camera' })]);
    this.statusEl = h('div', { class: 'start-status', role: 'status' });
    this.startBtn = h('button', { class: 'btn primary big', text: 'Enable camera', onclick: () => this.actions.onStart(this.select.value || null) });
    this.demoBtn = h('button', { class: 'btn big ghost', text: 'Demo mode (no camera)', onclick: () => this.actions.onDemo() });
    this.el = h('div', { class: 'start-screen' }, [
      h('div', { class: 'start-card' }, [
        h('div', { class: 'brand' }, [h('span', { class: 'brand-mark' }), APP_NAME]),
        h('p', { class: 'tagline', text: 'Interactive holographic smartphone experience' }),
        h('ol', { class: 'steps' }, [
          h('li', { text: 'Enable the webcam (permission is requested only now).' }),
          h('li', { text: 'Hold an open palm toward the camera to summon the hologram.' }),
          h('li', { text: 'Point with your index finger, pinch to tap, pinch-and-drag to scroll.' }),
        ]),
        h('label', { class: 'field-label', text: 'Camera' }),
        this.select,
        h('div', { class: 'btn-row' }, [this.startBtn, this.demoBtn]),
        this.statusEl,
        h('p', { class: 'fine-print', text: 'This is a camera-composited visual effect for video production, not an optical hologram. Video and hand data are processed locally in your browser and are never uploaded. Fictional demo — not affiliated with Samsung, Meta, Google or their apps.' }),
      ]),
    ]);
    root.appendChild(this.el);
  }

  setCameras(list, selectedId) {
    const prev = selectedId ?? this.select.value;
    this.select.replaceChildren(...(list.length ? list : [{ deviceId: '', label: 'Default camera' }]).map((c) => h('option', { value: c.deviceId, text: c.label })));
    if (prev && list.some((c) => c.deviceId === prev)) this.select.value = prev;
  }

  setBusy(text) {
    this.startBtn.disabled = true;
    this.demoBtn.disabled = true;
    this.statusEl.className = 'start-status busy';
    this.statusEl.replaceChildren(h('span', { class: 'spinner' }), text);
  }

  setError(message) {
    this.startBtn.disabled = false;
    this.demoBtn.disabled = false;
    this.startBtn.textContent = 'Retry';
    this.statusEl.className = 'start-status error';
    this.statusEl.textContent = message;
  }

  setIdle() {
    this.startBtn.disabled = false;
    this.demoBtn.disabled = false;
    this.statusEl.className = 'start-status';
    this.statusEl.textContent = '';
  }

  show(v) {
    this.el.classList.toggle('hidden', !v);
    if (v) this.startBtn.textContent = 'Enable camera';
  }
}
