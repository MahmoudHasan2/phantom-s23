import { GestureCalibration } from '../tracking/GestureCalibration.js';
import { h } from './dom.js';

/**
 * Guided pinch calibration + live gesture readout. Records the pinch ratio
 * with the hand open and pinched, then recommends hysteresis thresholds.
 */
export class CalibrationPanel {
  constructor(root, settings, recognizer) {
    this.settings = settings;
    this.recognizer = recognizer;
    this.cal = new GestureCalibration();
    this.el = h('aside', { class: 'panel calibration-panel', 'aria-label': 'Gesture calibration' });
    this.build();
    root.appendChild(this.el);
  }

  get open() {
    return this.el.classList.contains('open');
  }

  toggle(force) {
    this.el.classList.toggle('open', force ?? !this.open);
  }

  build() {
    this.meter = h('div', { class: 'meter' }, [
      (this.fill = h('div', { class: 'meter-fill' })),
      (this.onMark = h('div', { class: 'meter-mark on', title: 'pinch start' })),
      (this.offMark = h('div', { class: 'meter-mark off', title: 'pinch release' })),
    ]);
    this.readout = h('pre', { class: 'readout' });
    this.result = h('div', { class: 'cal-result' });
    this.openBtn = h('button', { class: 'btn', text: '1 · Record OPEN hand (2 s)', onclick: () => this.record('open') });
    this.pinchBtn = h('button', { class: 'btn', text: '2 · Record PINCH (2 s)', onclick: () => this.record('pinch') });
    this.applyBtn = h('button', { class: 'btn primary', text: '3 · Apply thresholds', disabled: true, onclick: () => this.apply() });
    this.el.append(
      h('div', { class: 'panel-header' }, [h('h2', { text: 'Gesture calibration' }), h('button', { class: 'icon-btn', text: '✕', onclick: () => this.toggle(false) })]),
      h('div', { class: 'panel-body' }, [
        h('p', { class: 'help', text: 'Stand where you will record, hold your hand toward the camera at a natural distance. Record a relaxed pointing hand, then a firm thumb–index pinch. Keep lighting as it will be during the shoot.' }),
        h('div', { class: 'field-label', text: 'Live pinch ratio (thumb–index ÷ hand size)' }),
        this.meter,
        this.readout,
        h('div', { class: 'btn-col' }, [this.openBtn, this.pinchBtn, this.applyBtn]),
        this.result,
        h('p', { class: 'help', text: 'Other tips: raise “Smoothing: min cutoff” for a snappier cursor or lower it for steadier hovering; increase “Keyboard hitbox scale” if keys are hard to hit.' }),
      ]),
    );
  }

  record(kind) {
    if (!this.recognizer.state.tracked) {
      this.result.textContent = 'No hand detected — make sure your hand is visible to the camera.';
      return;
    }
    this.cal.begin(kind, performance.now(), 2000);
    this.result.textContent = `Recording ${kind}…`;
  }

  apply() {
    const rec = this.cal.recommend();
    if (!rec || rec.pinchOn === null) return;
    this.settings.set({ pinchOn: rec.pinchOn, pinchOff: rec.pinchOff });
    this.result.textContent = `Applied: start < ${rec.pinchOn}, release > ${rec.pinchOff}`;
  }

  /** Called every render frame while open. */
  update() {
    if (!this.open) return;
    const rs = this.recognizer.state;
    const cfg = this.recognizer.config;
    const pct = (v) => `${Math.min(100, (v / 1.2) * 100)}%`;
    this.fill.style.width = rs.tracked ? pct(rs.pinchRatio) : '0%';
    this.fill.classList.toggle('active', rs.pinching);
    this.onMark.style.left = pct(cfg.pinchOn);
    this.offMark.style.left = pct(cfg.pinchOff);
    this.readout.textContent = rs.tracked
      ? `ratio ${rs.pinchRatio.toFixed(2)}   pose ${rs.pose}   ${rs.pinching ? 'PINCHING' : ''}\n` +
        `index ${rs.fingers.index}  middle ${rs.fingers.middle}  ring ${rs.fingers.ring}  pinky ${rs.fingers.pinky}  thumb ${rs.fingers.thumb}\n` +
        `confidence ${(rs.confidence * 100).toFixed(0)}%  movement ${rs.direction}`
      : 'No hand tracked';

    const now = performance.now();
    if (this.cal.active) {
      const kind = this.cal.active;
      if (!this.cal.addSample(rs.tracked ? rs.pinchRatio : NaN, now)) {
        this.result.textContent = `${kind === 'open' ? 'Open' : 'Pinch'} samples: ${this.cal.samples[kind].length}`;
        this.showRecommendation();
      }
    }
  }

  showRecommendation() {
    const rec = this.cal.recommend();
    if (!rec) {
      this.applyBtn.disabled = true;
      return;
    }
    if (rec.pinchOn === null) {
      this.result.textContent = `Open and pinch ranges overlap (gap ${rec.separation.toFixed(2)}). Improve lighting, face the palm to the camera, and record again.`;
      this.applyBtn.disabled = true;
      return;
    }
    this.result.textContent = `Recommended: start < ${rec.pinchOn}, release > ${rec.pinchOff} (separation ${rec.separation})`;
    this.applyBtn.disabled = false;
  }
}
