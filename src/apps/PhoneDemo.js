import { C, fillRound, glyph, interactionGlow, strokeRound, text, textFit } from '../uicanvas/draw.js';
import { header } from '../uicanvas/chrome.js';

const KEYS = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
];

/**
 * Simulated dialler. It never places a real call: "Call" shows a clearly
 * labelled simulated call screen.
 */
export class PhoneDemo {
  constructor(shell) {
    this.shell = shell;
    this.number = '';
    this.tab = 'keypad';
    this.callStart = null;
  }

  animating() {
    return this.callStart !== null;
  }

  render(ui, route, area, t) {
    const ctx = ui.ctx;
    ctx.fillStyle = '#060d12';
    ctx.fillRect(area.x, area.y, area.w, area.h);
    if (this.callStart !== null) return this.renderCall(ui, area, t);
    const hh = header(ui, area, { id: 'ph', title: 'Phone' });
    // Tabs
    const tabs = ['keypad', 'recents'];
    const tw = area.w / 2;
    tabs.forEach((tb, i) => {
      const st = ui.region(`ph-tab-${tb}`, area.x + i * tw, area.y + hh, tw, 40, { onClick: () => (this.tab = tb) });
      interactionGlow(ctx, area.x + i * tw + 8, area.y + hh + 4, tw - 16, 32, 10, st);
      text(ctx, tb === 'keypad' ? 'Keypad' : 'Recents', area.x + i * tw + tw / 2, area.y + hh + 26, 14, this.tab === tb ? C.accent : C.dim, 600, 'center');
      if (this.tab === tb) {
        ctx.fillStyle = C.accent;
        ctx.fillRect(area.x + i * tw + 30, area.y + hh + 37, tw - 60, 2);
      }
    });
    const top = area.y + hh + 44;
    if (this.tab === 'recents') return this.renderRecents(ui, area, top);

    // Number display
    const disp = this.number || '';
    text(ctx, disp ? formatNumber(disp) : 'Enter number', area.w / 2, top + 70, disp ? 32 : 18, disp ? C.text : C.faint, 300, 'center');

    const kw = 96;
    const kh = 74;
    const gx = (area.w - kw * 3 - 24) / 2;
    const gy = top + 110;
    KEYS.forEach(([d, sub], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = gx + col * (kw + 12);
      const y = gy + row * (kh + 10);
      const st = ui.region(`ph-key-${d}`, x, y, kw, kh, { onClick: () => this.press(d) });
      fillRound(ctx, x, y, kw, kh, 37, st.pressed ? 'rgba(88,225,255,0.4)' : 'rgba(40, 80, 100, 0.35)');
      strokeRound(ctx, x + 0.5, y + 0.5, kw - 1, kh - 1, 37, st.hovered ? 'rgba(160,240,255,0.95)' : C.line, st.hovered ? 1.5 : 1);
      interactionGlow(ctx, x, y, kw, kh, 37, st);
      text(ctx, d, x + kw / 2, y + (sub ? 40 : 46), 30, C.text, 300, 'center');
      if (sub) text(ctx, sub, x + kw / 2, y + 60, 10, C.dim, 600, 'center');
    });
    const by = gy + 4 * (kh + 10) + 6;
    const cst = ui.region('ph-call', area.w / 2 - 36, by, 72, 72, { onClick: () => this.call(t) });
    ctx.beginPath();
    ctx.arc(area.w / 2, by + 36, 34, 0, Math.PI * 2);
    ctx.fillStyle = cst.pressed ? '#9fffd0' : '#22c55e';
    ctx.fill();
    if (cst.hovered) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    glyph(ctx, 'phone', area.w / 2, by + 36, 30, '#fff', 2);
    if (this.number) {
      const bst = ui.region('ph-del', area.w / 2 + 70, by + 12, 60, 48, { onClick: () => (this.number = this.number.slice(0, -1)) });
      interactionGlow(ctx, area.w / 2 + 72, by + 14, 56, 44, 14, bst);
      glyph(ctx, 'backspace', area.w / 2 + 100, by + 36, 24, C.text, 1.8);
    }
  }

  renderRecents(ui, area, top) {
    const ctx = ui.ctx;
    let y = top + 10;
    for (const r of this.shell.content.phone.recents) {
      const st = ui.region(`ph-rec-${r.name}`, 8, y, area.w - 16, 64, { onClick: () => { this.number = r.name.startsWith('+') ? r.name.replace(/\D/g, '') : '0301234567'; this.tab = 'keypad'; } });
      interactionGlow(ctx, 8, y, area.w - 16, 64, 12, st);
      textFit(ctx, r.name, 66, y + 28, area.w - 140, 16, r.type === 'missed' ? '#ff6b6b' : C.text, 600);
      text(ctx, `${r.type === 'in' ? '↙ Incoming' : r.type === 'out' ? '↗ Outgoing' : '✕ Missed'} · ${r.time}`, 66, y + 48, 12, C.dim);
      glyph(ctx, 'phone', 34, y + 32, 20, C.accent, 1.8);
      y += 70;
    }
    text(ctx, 'Simulated call log', area.w / 2, y + 30, 11, C.faint, 400, 'center');
  }

  renderCall(ui, area, t) {
    const ctx = ui.ctx;
    const el = t - this.callStart;
    const cx = area.w / 2;
    for (let i = 0; i < 3; i++) {
      const k = ((el * 0.6 + i / 3) % 1);
      ctx.beginPath();
      ctx.arc(cx, area.y + 260, 50 + k * 90, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(88,225,255,${(1 - k) * 0.5})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, area.y + 260, 50, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40,90,110,0.8)';
    ctx.fill();
    glyph(ctx, 'user', cx, area.y + 260, 44, C.text, 2);
    text(ctx, formatNumber(this.number) || 'Unknown', cx, area.y + 380, 26, C.text, 300, 'center');
    text(ctx, `Calling… ${Math.floor(el)}s`, cx, area.y + 412, 14, C.dim, 400, 'center');
    fillRound(ctx, cx - 120, area.y + 440, 240, 26, 13, 'rgba(255,210,120,0.14)');
    text(ctx, 'SIMULATED CALL — no call is placed', cx, area.y + 458, 11, '#ffd99a', 600, 'center');
    const st = ui.region('ph-end', cx - 38, area.y + area.h - 140, 76, 76, { onClick: () => (this.callStart = null) });
    ctx.beginPath();
    ctx.arc(cx, area.y + area.h - 102, 36, 0, Math.PI * 2);
    ctx.fillStyle = st.pressed ? '#ffb0b0' : '#ef4444';
    ctx.fill();
    if (st.hovered) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(cx, area.y + area.h - 102);
    ctx.rotate(Math.PI * 0.75);
    glyph(ctx, 'phone', 0, 0, 30, '#fff', 2);
    ctx.restore();
  }

  press(d) {
    if (this.number.length < 15) this.number += d;
    this.shell.sound?.play('key');
  }

  call(t) {
    if (!this.number) {
      this.shell.toast('Enter a number first');
      return;
    }
    this.callStart = t;
  }
}

function formatNumber(n) {
  return n.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}
