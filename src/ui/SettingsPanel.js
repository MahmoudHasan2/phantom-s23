import { POSITION_PRESETS, SETTINGS_SCHEMA } from '../config/appConfig.js';
import { DEMO_CONTENT } from '../config/demoContent.js';
import { h } from './dom.js';

/**
 * Developer / operator settings drawer, generated from SETTINGS_SCHEMA.
 * Two-way bound: changes made elsewhere (in-hologram Settings app,
 * calibration) are reflected here.
 */
export class SettingsPanel {
  constructor(root, settings, actions) {
    this.settings = settings;
    this.actions = actions; // { onReloadModel, onResetChats, onCalibrate, onClose }
    this.inputs = new Map();
    this.el = h('aside', { class: 'panel settings-panel', 'aria-label': 'Settings' });
    this.build();
    root.appendChild(this.el);
    this.unsub = settings.subscribe((state, changed) => this.reflect(changed));
  }

  get open() {
    return this.el.classList.contains('open');
  }

  toggle(force) {
    this.el.classList.toggle('open', force ?? !this.open);
  }

  build() {
    const header = h('div', { class: 'panel-header' }, [
      h('h2', { text: 'Settings' }),
      h('button', { class: 'icon-btn', title: 'Close (O)', onclick: () => this.toggle(false), text: '✕' }),
    ]);
    const body = h('div', { class: 'panel-body' });

    // Quick actions
    const presets = h('div', { class: 'chip-row' }, Object.keys(POSITION_PRESETS).map((name) =>
      h('button', { class: 'chip', text: name.replace(/([A-Z])/g, ' $1').toLowerCase(), onclick: () => this.settings.set(POSITION_PRESETS[name]) }),
    ));
    body.appendChild(section('Quick actions', [
      h('div', { class: 'field-label', text: 'Hologram position presets' }),
      presets,
      h('div', { class: 'btn-row' }, [
        h('button', { class: 'btn', text: 'Calibrate gestures', onclick: () => this.actions.onCalibrate() }),
        h('button', { class: 'btn', text: 'Reset demo chats', onclick: () => this.actions.onResetChats() }),
      ]),
      h('div', { class: 'btn-row' }, [
        // A real link: opening from a user click is never popup-blocked.
        h('a', { class: 'btn link', href: DEMO_CONTENT.facebook.profileUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Open Facebook profile ↗' }),
        h('button', { class: 'btn danger', text: 'Reset all settings', onclick: () => confirm('Reset all settings to defaults?') && this.settings.reset() }),
      ]),
    ], true));

    const sections = new Map();
    for (const def of SETTINGS_SCHEMA) {
      if (!sections.has(def.section)) sections.set(def.section, []);
      sections.get(def.section).push(this.control(def));
    }
    for (const [name, controls] of sections) {
      if (name === 'Tracking') {
        controls.push(h('div', { class: 'btn-row' }, [h('button', { class: 'btn', text: 'Reload tracking model', onclick: () => this.actions.onReloadModel() })]));
      }
      body.appendChild(section(name, controls, name === 'Hologram'));
    }
    body.appendChild(h('p', { class: 'fine-print', text: 'Settings are stored in this browser only (localStorage). Shortcuts: arrows move · W/A/S/D tilt · 1/2 bigger/smaller · Shift transparency · Space wink-click · H hologram · P presentation · R record · F fullscreen · O settings · G debug · C calibrate · Esc back · Home close app.' }));
    this.el.append(header, body);
  }

  control(def) {
    const value = this.settings.get(def.key);
    const id = `set-${def.key}`;
    let input;
    let out = null;
    if (def.type === 'range') {
      input = h('input', { type: 'range', id, min: def.min, max: def.max, step: def.step, value });
      out = h('output', { for: id, text: fmt(value, def.step) });
      input.addEventListener('input', () => {
        out.textContent = fmt(Number(input.value), def.step);
        this.settings.update(def.key, Number(input.value));
      });
    } else if (def.type === 'toggle') {
      input = h('input', { type: 'checkbox', id, role: 'switch' });
      input.checked = !!value;
      input.addEventListener('change', () => this.settings.update(def.key, input.checked));
    } else if (def.type === 'select') {
      input = h('select', { id }, def.options.map((o) => h('option', { value: o, text: o })));
      input.value = value;
      input.addEventListener('change', () => this.settings.update(def.key, input.value));
    } else {
      input = h('input', { type: 'text', id, value, spellcheck: 'false' });
      input.addEventListener('change', () => this.settings.update(def.key, input.value));
    }
    this.inputs.set(def.key, { input, out, def });
    return h('div', { class: `field field-${def.type}` }, [
      h('label', { for: id, text: def.label }),
      h('div', { class: 'field-input' }, [input, out]),
      def.help ? h('div', { class: 'help', text: def.help }) : null,
    ]);
  }

  reflect(changed) {
    for (const key of changed) {
      const entry = this.inputs.get(key);
      if (!entry) continue;
      const v = this.settings.get(key);
      const { input, out, def } = entry;
      if (def.type === 'toggle') input.checked = !!v;
      else if (document.activeElement !== input) input.value = v;
      if (out) out.textContent = fmt(v, def.step);
    }
  }

  dispose() {
    this.unsub();
    this.el.remove();
  }
}

function section(title, children, open = false) {
  const d = h('details', { class: 'section', open }, [h('summary', { text: title }), ...children]);
  return d;
}

function fmt(v, step) {
  const decimals = step >= 1 ? 0 : Math.min(3, String(step).split('.')[1]?.length || 2);
  return Number(v).toFixed(decimals);
}
