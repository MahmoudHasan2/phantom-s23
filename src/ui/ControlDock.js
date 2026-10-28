import { h } from './dom.js';

/**
 * Floating control dock (hidden in presentation mode) with live status chips.
 */
export class ControlDock {
  constructor(root, status, actions) {
    this.status = status;
    this.actions = actions;
    const btn = (id, label, title, fn) => {
      const b = h('button', { class: 'dock-btn', 'data-id': id, title, onclick: fn }, [label]);
      return b;
    };
    this.camSelect = h('select', { class: 'dock-select', title: 'Switch camera', onchange: () => actions.onSwitchCamera(this.camSelect.value) });
    this.buttons = {
      holo: btn('holo', '◈ Hologram', 'Summon / dismiss (H)', actions.onToggleHologram),
      camera: btn('camera', '● Camera', 'Start / stop camera', actions.onToggleCamera),
      calibrate: btn('calibrate', '✋ Calibrate', 'Gesture calibration (C)', actions.onCalibrate),
      debug: btn('debug', '⌗ Debug', 'Tracking debug overlay (G)', actions.onToggleDebug),
      settings: btn('settings', '⚙ Settings', 'Settings (O)', actions.onSettings),
      record: btn('record', '⏺ Record', 'Record (R)', actions.onRecord),
      present: btn('present', '▶ Present', 'Presentation mode (P)', actions.onPresent),
      full: btn('full', '⛶', 'Fullscreen (F)', actions.onFullscreen),
    };
    this.chips = {
      camera: h('span', { class: 'chip-status' }),
      tracking: h('span', { class: 'chip-status' }),
      hand: h('span', { class: 'chip-status' }),
      perf: h('span', { class: 'chip-status' }),
    };
    this.el = h('div', { class: 'dock' }, [
      h('div', { class: 'dock-row' }, [...Object.values(this.buttons)]),
      h('div', { class: 'dock-row status-row' }, [...Object.values(this.chips), this.camSelect]),
    ]);
    root.appendChild(this.el);
    this.unsub = status.subscribe(() => this.render());
    this.render();
  }

  setCameras(list, selected) {
    this.camSelect.replaceChildren(...list.map((c) => h('option', { value: c.deviceId, text: c.label })));
    if (selected) this.camSelect.value = selected;
    this.camSelect.style.display = list.length > 1 ? '' : 'none';
  }

  render() {
    const s = this.status.state;
    const set = (chip, text, cls) => {
      chip.textContent = text;
      chip.className = `chip-status ${cls}`;
    };
    const camText = s.demoMode ? 'DEMO · simulated input' : `CAM ${s.camera}`;
    set(this.chips.camera, camText, s.demoMode ? 'warn' : s.camera === 'live' ? 'ok' : s.camera === 'error' ? 'bad' : '');
    set(this.chips.tracking, `TRACK ${s.tracking}${s.trackingBackend ? ` (${s.trackingBackend})` : ''}`, s.tracking === 'ready' ? 'ok' : s.tracking === 'error' ? 'bad' : '');
    set(this.chips.hand, `HAND ${s.hand}`, s.hand === 'tracked' ? 'ok' : s.hand === 'lost' ? 'warn' : '');
    set(this.chips.perf, `${s.fps.toFixed(0)} FPS · ${s.quality}`, s.fps < 24 && s.fps > 0 ? 'warn' : '');
    this.buttons.holo.classList.toggle('active', s.hologram !== 'hidden');
    this.buttons.camera.classList.toggle('active', s.camera === 'live');
    const rec = s.recording === 'recording' || s.recording === 'paused' || s.recording === 'countdown';
    this.buttons.record.classList.toggle('recording', rec);
    this.buttons.record.textContent = rec ? '■ Stop' : '⏺ Record';
  }

  setActive(id, on) {
    this.buttons[id]?.classList.toggle('active', on);
  }

  dispose() {
    this.unsub();
  }
}
