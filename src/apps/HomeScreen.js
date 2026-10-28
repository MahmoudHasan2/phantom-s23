import { APP_META, drawAppIcon } from '../uicanvas/icons.js';
import { C, fillRound, glyph, interactionGlow, strokeRound, text } from '../uicanvas/draw.js';

const GRID = ['facebook', 'whatsapp', 'youtube', 'instagram', 'gallery', 'settings'];
const DOCK = ['phone', 'messages', 'camera'];
const ICON = 64;

/** Deterministic icon geometry (also used by the launch/close zoom transition). */
export function homeIconRect(id, area) {
  const gi = GRID.indexOf(id);
  if (gi >= 0) {
    const cols = 4;
    const cellW = (area.w - 40) / cols;
    const col = gi % cols;
    const row = Math.floor(gi / cols);
    return { x: area.x + 20 + col * cellW + (cellW - ICON) / 2, y: area.y + 300 + row * 112, w: ICON, h: ICON };
  }
  const di = DOCK.indexOf(id);
  if (di >= 0) {
    return { x: area.x + (area.w * (di + 1)) / (DOCK.length + 1) - ICON / 2, y: area.y + area.h - 96, w: ICON, h: ICON };
  }
  return { x: area.x + area.w / 2 - ICON / 2, y: area.y + area.h / 2, w: ICON, h: ICON };
}

export class HomeScreen {
  constructor(shell) {
    this.shell = shell;
  }

  render(ui, route, area, t) {
    const ctx = ui.ctx;
    const formation = this.shell.formation;
    const locale = this.shell.content.device.locale || 'de-DE';
    const now = new Date();

    // Wallpaper: subtle concentric rings + grid, evocative but low-contrast.
    ctx.save();
    const cx = area.x + area.w / 2;
    const cy = area.y + area.h * 0.42;
    const rg = ctx.createRadialGradient(cx, cy, 10, cx, cy, area.h * 0.7);
    rg.addColorStop(0, 'rgba(40, 160, 200, 0.22)');
    rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rg;
    ctx.fillRect(area.x, area.y, area.w, area.h);
    ctx.strokeStyle = 'rgba(100, 220, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let r = 60; r < area.h; r += 70) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + ((t * 12) % 70), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Clock widget
    const appear = (i) => clamp01((formation - 0.55 - i * 0.035) / 0.14);
    const wA = appear(0);
    ctx.save();
    ctx.globalAlpha *= wA;
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    text(ctx, time, area.x + area.w / 2, area.y + 120, 78, C.text, 200, 'center');
    const date = now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    text(ctx, date, area.x + area.w / 2, area.y + 154, 16, C.dim, 400, 'center');
    text(ctx, '☁  14°  ·  ' + this.shell.content.device.name, area.x + area.w / 2, area.y + 182, 13, C.faint, 400, 'center');

    // Search pill
    const sp = { x: area.x + 34, y: area.y + 212, w: area.w - 68, h: 42 };
    fillRound(ctx, sp.x, sp.y, sp.w, sp.h, 21, 'rgba(30, 70, 90, 0.45)');
    strokeRound(ctx, sp.x, sp.y, sp.w, sp.h, 21, C.line, 1);
    glyph(ctx, 'search', sp.x + 24, sp.y + sp.h / 2, 16, C.dim, 1.8);
    text(ctx, 'Search', sp.x + 46, sp.y + 27, 14, C.faint);
    ctx.restore();

    // App icons
    const all = [...GRID, ...DOCK];
    // Dock panel
    const dockY = area.y + area.h - 112;
    ctx.save();
    ctx.globalAlpha *= appear(2);
    fillRound(ctx, area.x + 14, dockY, area.w - 28, 100, 28, 'rgba(20, 60, 80, 0.32)');
    strokeRound(ctx, area.x + 14, dockY, area.w - 28, 100, 28, C.line, 1);
    // Page dots
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 0 ? C.accent : 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(area.x + area.w / 2 + (i - 1) * 12, dockY - 16, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    all.forEach((id, i) => {
      const r = homeIconRect(id, area);
      const a = appear(i + 1);
      if (a <= 0) {
        this.drawMaterializeSeed(ctx, r, t, i);
        return;
      }
      const e = 1 - Math.pow(1 - a, 3);
      const s = 0.55 + 0.45 * e;
      const st = ui.region(`home-${id}`, r.x - 14, r.y - 8, r.w + 28, r.h + 34, {
        onClick: () => this.shell.openApp(id),
      });
      ctx.save();
      ctx.globalAlpha *= e;
      const lift = st.hovered ? -3 : 0;
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2 + lift);
      const hs = st.pressed ? 0.92 : st.hovered ? 1.07 : 1;
      ctx.scale(s * hs, s * hs);
      if (st.hovered || st.pressed) {
        ctx.shadowColor = 'rgba(100, 230, 255, 0.9)';
        ctx.shadowBlur = 22;
      }
      drawAppIcon(ctx, id, -r.w / 2, -r.h / 2, r.w);
      ctx.restore();
      if (st.hovered) {
        interactionGlow(ctx, r.x - 10, r.y - 6, r.w + 20, r.h + 30, 18, st);
      }
      if (DOCK.indexOf(id) < 0) {
        ctx.save();
        ctx.globalAlpha *= e;
        text(ctx, APP_META[id].label, r.x + r.w / 2, r.y + r.h + 20, 12.5, C.text, 500, 'center');
        ctx.restore();
      }
      // Materialisation sparkle while the icon is forming.
      if (a < 1) {
        ctx.save();
        ctx.globalAlpha *= 1 - a;
        ctx.fillStyle = C.accent2;
        for (let k = 0; k < 10; k++) {
          const ang = k * 2.4 + i;
          const rad = (1 - a) * 40 + 6;
          ctx.fillRect(r.x + r.w / 2 + Math.cos(ang) * rad, r.y + r.h / 2 + Math.sin(ang) * rad, 2, 2);
        }
        ctx.restore();
      }
    });
  }

  /** Before an icon materialises, a faint pulsing dot marks its spot. */
  drawMaterializeSeed(ctx, r, t, i) {
    if (this.shell.formation < 0.35) return;
    ctx.save();
    ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(t * 8 + i);
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, r.y + r.h / 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
