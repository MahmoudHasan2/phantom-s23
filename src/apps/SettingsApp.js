import { C, fillRound, interactionGlow, text } from '../uicanvas/draw.js';
import { header } from '../uicanvas/chrome.js';

/**
 * In-hologram Settings: quick access to the experience's own hologram,
 * gesture, camera and presentation settings (the full set lives in the
 * developer control panel).
 */
export class SettingsApp {
  constructor(shell) {
    this.shell = shell;
  }

  rows() {
    const s = this.shell.settings;
    const step = (key, delta, digits = 2) => ({
      kind: 'stepper',
      key,
      value: Number(s.get(key)).toFixed(digits),
      dec: () => s.update(key, +(s.get(key) - delta).toFixed(4)),
      inc: () => s.update(key, +(s.get(key) + delta).toFixed(4)),
    });
    const toggle = (key) => ({ kind: 'toggle', key, value: s.get(key), on: () => s.update(key, !s.get(key)) });
    return [
      { kind: 'section', label: 'Hologram' },
      { label: 'Scan lines', ...toggle('scanLines') },
      { label: 'Particle drift', ...toggle('particleAnim') },
      { label: 'Glow', ...step('glow', 0.1, 1) },
      { label: 'Opacity', ...step('opacity', 0.05) },
      { label: 'Backdrop dimming', ...step('backdrop', 0.05) },
      { label: 'Dot density', ...step('dotDensity', 20, 0) },
      { kind: 'section', label: 'Interaction' },
      { label: 'Keyboard layout', kind: 'choice', value: s.get('keyboardLayout').toUpperCase(), on: () => s.update('keyboardLayout', s.get('keyboardLayout') === 'qwertz' ? 'qwerty' : 'qwertz') },
      { label: 'Key hitbox', ...step('keyHitbox', 0.1, 1) },
      { label: 'Two-finger scroll', ...toggle('twoFingerScroll') },
      { kind: 'section', label: 'Camera & presentation' },
      { label: 'Mirror camera', ...toggle('mirror') },
      { label: 'Show cursor', ...toggle('showCursor') },
      { label: 'Gesture labels', ...toggle('showFeedback') },
      { label: 'Sound effects', ...toggle('sound') },
      { kind: 'section', label: 'Demo' },
      { label: 'Reset demo conversations', kind: 'action', on: () => { this.shell.services.chats.whatsapp.reset(); this.shell.services.chats.messages.reset(); this.shell.toast('Demo conversations reset'); } },
      { label: 'Open full control panel', kind: 'action', on: () => this.shell.services.openPanel() },
      { kind: 'note', label: 'Fictional demo device. Not affiliated with Samsung, Meta, WhatsApp, Google/YouTube or Instagram.' },
    ];
  }

  render(ui, route, area) {
    const ctx = ui.ctx;
    ctx.fillStyle = '#060b10';
    ctx.fillRect(area.x, area.y, area.w, area.h);
    const hh = header(ui, area, { id: 'set', title: 'Settings' });
    ui.beginScroll('set-list', area.x, area.y + hh, area.w, area.h - hh);
    let y = 6;
    for (const r of this.rows()) {
      if (r.kind === 'section') {
        text(ctx, r.label.toUpperCase(), 20, y + 30, 12, C.accent, 700);
        y += 40;
        continue;
      }
      if (r.kind === 'note') {
        text(ctx, r.label, 20, y + 24, 11, C.faint);
        y += 40;
        continue;
      }
      const h = 54;
      fillRound(ctx, 10, y, area.w - 20, h - 4, 12, 'rgba(255,255,255,0.04)');
      text(ctx, r.label, 26, y + 31, 15, C.text, 500);
      if (r.kind === 'toggle' || r.kind === 'action' || r.kind === 'choice') {
        const st = ui.region(`set-${r.label}`, 10, y, area.w - 20, h - 4, { onClick: r.on });
        interactionGlow(ctx, 10, y, area.w - 20, h - 4, 12, st);
        if (r.kind === 'toggle') {
          const tx = area.w - 74;
          fillRound(ctx, tx, y + 14, 46, 24, 12, r.value ? C.accent : 'rgba(255,255,255,0.2)');
          ctx.beginPath();
          ctx.arc(r.value ? tx + 34 : tx + 12, y + 26, 9, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
        } else if (r.kind === 'choice') {
          text(ctx, r.value, area.w - 30, y + 31, 14, C.accent, 600, 'right');
        } else {
          text(ctx, '›', area.w - 30, y + 33, 22, C.dim, 400, 'right');
        }
      } else if (r.kind === 'stepper') {
        const bx = area.w - 150;
        const dst = ui.region(`set-${r.key}-dec`, bx, y + 8, 38, 34, { onClick: r.dec });
        const ist = ui.region(`set-${r.key}-inc`, bx + 98, y + 8, 38, 34, { onClick: r.inc });
        fillRound(ctx, bx, y + 8, 38, 34, 10, 'rgba(88,225,255,0.14)');
        fillRound(ctx, bx + 98, y + 8, 38, 34, 10, 'rgba(88,225,255,0.14)');
        interactionGlow(ctx, bx, y + 8, 38, 34, 10, dst);
        interactionGlow(ctx, bx + 98, y + 8, 38, 34, 10, ist);
        text(ctx, '−', bx + 19, y + 32, 20, C.text, 500, 'center');
        text(ctx, '+', bx + 117, y + 32, 20, C.text, 500, 'center');
        text(ctx, r.value, bx + 68, y + 31, 14, C.text, 600, 'center');
      }
      y += h;
    }
    ui.endScroll(y + 20);
  }
}
