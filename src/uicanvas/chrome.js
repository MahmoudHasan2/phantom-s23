import { avatar, C, fillRound, font, glyph, interactionGlow, roundRectPath, strokeRound, text, textFit } from './draw.js';

/**
 * Shared app chrome: header bars, buttons, composers. Keeps every simulated
 * app visually consistent.
 */
export const HEADER_H = 56;

/**
 * @param opts { id, title, subtitle, tint, back:boolean, onBack, avatar:{name,color}, actions:[{id,icon,onClick}] }
 */
export function header(ui, area, opts) {
  const ctx = ui.ctx;
  const { x, y, w } = area;
  ctx.fillStyle = opts.tint || 'rgba(8, 26, 36, 0.85)';
  ctx.fillRect(x, y, w, HEADER_H);
  ctx.fillStyle = C.line;
  ctx.fillRect(x, y + HEADER_H - 1, w, 1);
  let tx = x + 18;
  if (opts.back) {
    const st = ui.region(`${opts.id}-back`, x + 4, y + 6, 44, 44, { onClick: opts.onBack });
    interactionGlow(ctx, x + 6, y + 8, 40, 40, 20, st);
    glyph(ctx, 'back', x + 26, y + HEADER_H / 2, 20, C.text, 2.2);
    tx = x + 52;
  }
  if (opts.avatar) {
    avatar(ctx, opts.avatar.name, tx + 18, y + HEADER_H / 2, 18, opts.avatar.color);
    tx += 46;
  }
  const actionsW = (opts.actions?.length || 0) * 42;
  if (opts.subtitle) {
    textFit(ctx, opts.title, tx, y + 25, w - tx - actionsW - 10, 17, opts.titleColor || C.text, 600);
    textFit(ctx, opts.subtitle, tx, y + 44, w - tx - actionsW - 10, 12, opts.subtitleColor || C.dim, 400);
  } else {
    textFit(ctx, opts.title, tx, y + 36, w - tx - actionsW - 10, opts.titleSize || 20, opts.titleColor || C.text, opts.titleWeight || 700);
  }
  (opts.actions || []).forEach((a, i) => {
    const ax = x + w - 24 - i * 42;
    const st = ui.region(`${opts.id}-act-${a.id}`, ax - 20, y + 8, 40, 40, { onClick: a.onClick });
    interactionGlow(ctx, ax - 18, y + 10, 36, 36, 18, st);
    glyph(ctx, a.icon, ax, y + HEADER_H / 2, 18, C.text, 1.8);
  });
  return HEADER_H;
}

/** Pill button. Returns its interaction state. */
export function button(ui, id, x, y, w, h, label, opts = {}) {
  const ctx = ui.ctx;
  const st = ui.region(id, x, y, w, h, { onClick: opts.onClick, disabled: opts.disabled });
  fillRound(ctx, x, y, w, h, opts.radius ?? h / 2, opts.fill || 'rgba(88, 225, 255, 0.16)');
  strokeRound(ctx, x + 0.5, y + 0.5, w - 1, h - 1, opts.radius ?? h / 2, opts.stroke || 'rgba(120, 230, 255, 0.55)', 1);
  interactionGlow(ctx, x, y, w, h, opts.radius ?? h / 2, st);
  if (opts.icon) {
    glyph(ctx, opts.icon, x + 22, y + h / 2, 16, opts.color || C.text, 1.8);
    text(ctx, label, x + 40, y + h / 2 + 5, opts.size || 14, opts.color || C.text, 600);
  } else {
    text(ctx, label, x + w / 2, y + h / 2 + 5, opts.size || 14, opts.color || C.text, 600, 'center');
  }
  return st;
}

/**
 * Message composer with a visible blinking caret.
 * Returns the composer height.
 */
export function composer(ui, shell, id, area, buffer, onSend, accent = C.accent) {
  const ctx = ui.ctx;
  const h = 58;
  const y = area.y + area.h - h - shell.keyboardInset;
  const x = area.x;
  const w = area.w;
  ctx.fillStyle = 'rgba(6, 20, 28, 0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = C.line;
  ctx.fillRect(x, y, w, 1);

  const fx = x + 12;
  const fw = w - 80;
  const focused = shell.keyboardShown && shell.composer?.buffer === buffer;
  const st = ui.region(`${id}-field`, fx, y + 9, fw, 40, { onClick: () => shell.focusComposer(buffer, onSend) });
  fillRound(ctx, fx, y + 9, fw, 40, 20, 'rgba(30, 64, 80, 0.6)');
  strokeRound(ctx, fx + 0.5, y + 9.5, fw - 1, 39, 20, focused ? 'rgba(120,230,255,0.9)' : C.line, focused ? 1.4 : 1);
  interactionGlow(ctx, fx, y + 9, fw, 40, 20, st);

  ctx.save();
  roundRectPath(ctx, fx + 14, y + 9, fw - 28, 40, 4);
  ctx.clip();
  ctx.font = font(15, 400);
  const before = buffer.beforeCaret;
  const full = buffer.text;
  const beforeW = ctx.measureText(before).width;
  // Keep the caret visible by shifting long text to the left.
  const shift = Math.max(0, beforeW - (fw - 40));
  if (full) text(ctx, full, fx + 16 - shift, y + 34, 15, C.text);
  else if (!focused) text(ctx, 'Message', fx + 16, y + 34, 15, C.faint);
  if (focused && Math.floor(ui.time * 2) % 2 === 0) {
    ctx.fillStyle = accent;
    ctx.fillRect(fx + 16 - shift + beforeW + 1, y + 18, 2, 22);
  }
  ctx.restore();

  const sx = x + w - 34;
  const sy = y + h / 2;
  const sst = ui.region(`${id}-send`, sx - 24, sy - 24, 48, 48, { onClick: onSend });
  ctx.beginPath();
  ctx.arc(sx, sy, 22, 0, Math.PI * 2);
  ctx.fillStyle = sst.pressed ? '#ffffff' : accent;
  ctx.fill();
  if (sst.hovered) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  glyph(ctx, full.trim() ? 'send' : 'mic', sx + (full.trim() ? 2 : 0), sy, 18, '#04202a', 2);
  return h + shell.keyboardInset;
}

/** Status ticks for outgoing messages. */
export function statusTicks(ctx, x, y, status, readColor = '#53bdeb') {
  const col = status === 'read' ? readColor : 'rgba(220,240,255,0.7)';
  if (status === 'sending') {
    glyph(ctx, 'clock', x, y, 11, col, 1.2);
    return;
  }
  glyph(ctx, 'check', x - (status === 'sent' ? 0 : 3), y, 11, col, 1.5);
  if (status === 'delivered' || status === 'read') glyph(ctx, 'check', x + 3, y, 11, col, 1.5);
}

/** Chat bubble; returns its height. */
export function bubble(ctx, wrapLinesFn, msg, x, w, y, opts) {
  const maxW = w * 0.74;
  const lines = wrapLinesFn(ctx, msg.text, maxW - 26, 15);
  ctx.font = font(15);
  let tw = 0;
  for (const l of lines) tw = Math.max(tw, ctx.measureText(l).width);
  const authorH = msg.author ? 17 : 0;
  const bw = Math.min(maxW, Math.max(tw + 26, 92));
  const bh = lines.length * 20 + 26 + authorH;
  const mine = msg.from === 'me';
  const bx = mine ? x + w - bw - 10 : x + 10;
  fillRound(ctx, bx, y, bw, bh, 14, mine ? opts.mine : opts.theirs);
  if (msg.author) text(ctx, msg.author, bx + 12, y + 17, 12, opts.author || C.accent, 600);
  for (let i = 0; i < lines.length; i++) text(ctx, lines[i], bx + 12, y + 22 + authorH + i * 20, 15, C.text);
  text(ctx, msg.time || '', bx + bw - (mine ? 30 : 10), y + bh - 7, 10, 'rgba(220,240,255,0.6)', 400, 'right');
  if (mine && msg.status) statusTicks(ctx, bx + bw - 16, y + bh - 11, msg.status, opts.read);
  return bh;
}
