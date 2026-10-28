/**
 * Canvas drawing helpers shared by all simulated apps.
 */
export const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"';

export const C = {
  bg: '#05080c',
  panel: 'rgba(20, 40, 52, 0.55)',
  panelHi: 'rgba(60, 200, 255, 0.16)',
  line: 'rgba(130, 220, 255, 0.18)',
  text: '#eaf8ff',
  dim: 'rgba(200, 235, 255, 0.62)',
  faint: 'rgba(200, 235, 255, 0.38)',
  accent: '#58e1ff',
  accent2: '#9ff3ff',
  hover: 'rgba(88, 225, 255, 0.22)',
  press: 'rgba(88, 225, 255, 0.42)',
};

export function font(size, weight = 400) {
  return `${weight} ${size}px ${FONT}, ${EMOJI_FONT}`;
}

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillRound(ctx, x, y, w, h, r, fill) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeRound(ctx, x, y, w, h, r, stroke, lw = 1) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

export function text(ctx, str, x, y, size = 14, color = C.text, weight = 400, align = 'left') {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}

const ellipsisCache = new Map();
/** Single-line text truncated with an ellipsis to maxW (cached per string/width/font). */
export function textFit(ctx, str, x, y, maxW, size = 14, color = C.text, weight = 400, align = 'left') {
  ctx.font = font(size, weight);
  const key = `${size}|${weight}|${maxW}|${str}`;
  let s = ellipsisCache.get(key);
  if (s === undefined) {
    s = str;
    if (ctx.measureText(s).width > maxW) {
      while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
      s += '…';
    }
    if (ellipsisCache.size > 2000) ellipsisCache.clear();
    ellipsisCache.set(key, s);
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
}

const wrapCache = new Map();
/** Word-wraps text into lines that fit maxW. Cached. */
export function wrapLines(ctx, str, maxW, size = 14, weight = 400) {
  const key = `${size}|${weight}|${maxW}|${str}`;
  const hit = wrapCache.get(key);
  if (hit) return hit;
  ctx.font = font(size, weight);
  const lines = [];
  for (const para of String(str).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  if (wrapCache.size > 1000) wrapCache.clear();
  wrapCache.set(key, lines);
  return lines;
}

export function drawLines(ctx, lines, x, y, lineH, size, color, weight = 400, align = 'left') {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y + i * lineH);
}

export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function avatar(ctx, name, cx, cy, r, color = '#3a7bd5') {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, color);
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  text(ctx, initials(name), cx, cy + r * 0.36, r * 0.9, '#ffffff', 600, 'center');
}

/** Lighten (amt>0) or darken (amt<0) a #rrggbb colour. */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

/** Highlight overlay for hovered / pressed interactive regions. */
export function interactionGlow(ctx, x, y, w, h, r, state) {
  if (!state.hovered && !state.pressed) return;
  fillRound(ctx, x, y, w, h, r, state.pressed ? C.press : C.hover);
  strokeRound(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r, state.pressed ? 'rgba(160,240,255,0.9)' : 'rgba(120,230,255,0.55)', 1.2);
}

/** Simple vector glyphs used across apps. */
export function glyph(ctx, name, x, y, s, color = C.text, lw = 1.8) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const h = s / 2;
  switch (name) {
    case 'back':
      ctx.moveTo(h * 0.4, -h * 0.7);
      ctx.lineTo(-h * 0.4, 0);
      ctx.lineTo(h * 0.4, h * 0.7);
      ctx.stroke();
      break;
    case 'chevron':
      ctx.moveTo(-h * 0.25, -h * 0.5);
      ctx.lineTo(h * 0.25, 0);
      ctx.lineTo(-h * 0.25, h * 0.5);
      ctx.stroke();
      break;
    case 'search':
      ctx.arc(-h * 0.15, -h * 0.15, h * 0.5, 0, Math.PI * 2);
      ctx.moveTo(h * 0.22, h * 0.22);
      ctx.lineTo(h * 0.7, h * 0.7);
      ctx.stroke();
      break;
    case 'dots':
      for (const dy of [-h * 0.6, 0, h * 0.6]) {
        ctx.moveTo(0, dy);
        ctx.arc(0, dy, lw * 0.9, 0, Math.PI * 2);
      }
      ctx.fill();
      break;
    case 'send':
      ctx.moveTo(-h * 0.7, -h * 0.7);
      ctx.lineTo(h * 0.8, 0);
      ctx.lineTo(-h * 0.7, h * 0.7);
      ctx.lineTo(-h * 0.35, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case 'heart':
      ctx.moveTo(0, h * 0.7);
      ctx.bezierCurveTo(-h * 1.2, -h * 0.1, -h * 0.5, -h * 1.0, 0, -h * 0.35);
      ctx.bezierCurveTo(h * 0.5, -h * 1.0, h * 1.2, -h * 0.1, 0, h * 0.7);
      ctx.stroke();
      break;
    case 'heartFill':
      ctx.moveTo(0, h * 0.7);
      ctx.bezierCurveTo(-h * 1.2, -h * 0.1, -h * 0.5, -h * 1.0, 0, -h * 0.35);
      ctx.bezierCurveTo(h * 0.5, -h * 1.0, h * 1.2, -h * 0.1, 0, h * 0.7);
      ctx.fill();
      break;
    case 'like':
      ctx.moveTo(-h * 0.8, -h * 0.05);
      ctx.lineTo(-h * 0.8, h * 0.75);
      ctx.moveTo(-h * 0.45, h * 0.75);
      ctx.lineTo(h * 0.55, h * 0.75);
      ctx.quadraticCurveTo(h * 0.8, h * 0.75, h * 0.8, h * 0.45);
      ctx.lineTo(h * 0.8, 0);
      ctx.quadraticCurveTo(h * 0.8, -h * 0.25, h * 0.5, -h * 0.25);
      ctx.lineTo(h * 0.05, -h * 0.25);
      ctx.lineTo(h * 0.15, -h * 0.75);
      ctx.quadraticCurveTo(0, -h * 0.95, -h * 0.2, -h * 0.65);
      ctx.lineTo(-h * 0.45, -h * 0.05);
      ctx.lineTo(-h * 0.45, h * 0.75);
      ctx.stroke();
      break;
    case 'comment':
      ctx.moveTo(-h * 0.8, -h * 0.6);
      ctx.lineTo(h * 0.8, -h * 0.6);
      ctx.lineTo(h * 0.8, h * 0.35);
      ctx.lineTo(-h * 0.1, h * 0.35);
      ctx.lineTo(-h * 0.5, h * 0.8);
      ctx.lineTo(-h * 0.5, h * 0.35);
      ctx.lineTo(-h * 0.8, h * 0.35);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'share':
      ctx.moveTo(h * 0.8, -h * 0.1);
      ctx.lineTo(h * 0.1, -h * 0.75);
      ctx.lineTo(h * 0.1, -h * 0.4);
      ctx.quadraticCurveTo(-h * 0.8, -h * 0.35, -h * 0.8, h * 0.7);
      ctx.quadraticCurveTo(-h * 0.4, h * 0.05, h * 0.1, h * 0.15);
      ctx.lineTo(h * 0.1, h * 0.55);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'play':
      ctx.moveTo(-h * 0.5, -h * 0.7);
      ctx.lineTo(h * 0.7, 0);
      ctx.lineTo(-h * 0.5, h * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case 'external':
      ctx.moveTo(h * 0.1, -h * 0.8);
      ctx.lineTo(h * 0.8, -h * 0.8);
      ctx.lineTo(h * 0.8, -h * 0.1);
      ctx.moveTo(h * 0.8, -h * 0.8);
      ctx.lineTo(-h * 0.1, h * 0.1);
      ctx.moveTo(h * 0.5, h * 0.3);
      ctx.lineTo(h * 0.5, h * 0.8);
      ctx.lineTo(-h * 0.8, h * 0.8);
      ctx.lineTo(-h * 0.8, -h * 0.5);
      ctx.lineTo(-h * 0.3, -h * 0.5);
      ctx.stroke();
      break;
    case 'phone':
      // Stylised handset: two ear/mouth pieces joined by an arc.
      ctx.lineWidth = lw * 1.6;
      ctx.arc(h * 0.15, -h * 0.15, h * 0.75, Math.PI * 0.62, Math.PI * 1.38, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.lineWidth = lw * 2.6;
      ctx.moveTo(-h * 0.62, -h * 0.55);
      ctx.lineTo(-h * 0.35, -h * 0.85);
      ctx.moveTo(-h * 0.25, h * 0.45);
      ctx.lineTo(h * 0.1, h * 0.6);
      ctx.stroke();
      break;
    case 'camera':
      ctx.moveTo(-h * 0.85, -h * 0.4);
      ctx.lineTo(-h * 0.35, -h * 0.4);
      ctx.lineTo(-h * 0.2, -h * 0.65);
      ctx.lineTo(h * 0.2, -h * 0.65);
      ctx.lineTo(h * 0.35, -h * 0.4);
      ctx.lineTo(h * 0.85, -h * 0.4);
      ctx.lineTo(h * 0.85, h * 0.6);
      ctx.lineTo(-h * 0.85, h * 0.6);
      ctx.closePath();
      ctx.moveTo(h * 0.33, h * 0.08);
      ctx.arc(0, h * 0.08, h * 0.33, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'check':
      ctx.moveTo(-h * 0.6, 0);
      ctx.lineTo(-h * 0.15, h * 0.45);
      ctx.lineTo(h * 0.7, -h * 0.5);
      ctx.stroke();
      break;
    case 'clock':
      ctx.arc(0, 0, h * 0.7, 0, Math.PI * 2);
      ctx.moveTo(0, -h * 0.4);
      ctx.lineTo(0, 0);
      ctx.lineTo(h * 0.3, h * 0.2);
      ctx.stroke();
      break;
    case 'plus':
      ctx.moveTo(-h * 0.6, 0);
      ctx.lineTo(h * 0.6, 0);
      ctx.moveTo(0, -h * 0.6);
      ctx.lineTo(0, h * 0.6);
      ctx.stroke();
      break;
    case 'close':
      ctx.moveTo(-h * 0.5, -h * 0.5);
      ctx.lineTo(h * 0.5, h * 0.5);
      ctx.moveTo(h * 0.5, -h * 0.5);
      ctx.lineTo(-h * 0.5, h * 0.5);
      ctx.stroke();
      break;
    case 'backspace':
      ctx.moveTo(-h * 0.9, 0);
      ctx.lineTo(-h * 0.45, -h * 0.55);
      ctx.lineTo(h * 0.9, -h * 0.55);
      ctx.lineTo(h * 0.9, h * 0.55);
      ctx.lineTo(-h * 0.45, h * 0.55);
      ctx.closePath();
      ctx.moveTo(-h * 0.05, -h * 0.25);
      ctx.lineTo(h * 0.45, h * 0.25);
      ctx.moveTo(h * 0.45, -h * 0.25);
      ctx.lineTo(-h * 0.05, h * 0.25);
      ctx.stroke();
      break;
    case 'shift':
      ctx.moveTo(0, -h * 0.8);
      ctx.lineTo(h * 0.75, 0);
      ctx.lineTo(h * 0.35, 0);
      ctx.lineTo(h * 0.35, h * 0.7);
      ctx.lineTo(-h * 0.35, h * 0.7);
      ctx.lineTo(-h * 0.35, 0);
      ctx.lineTo(-h * 0.75, 0);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'enter':
      ctx.moveTo(h * 0.7, -h * 0.6);
      ctx.lineTo(h * 0.7, h * 0.2);
      ctx.lineTo(-h * 0.6, h * 0.2);
      ctx.moveTo(-h * 0.25, -h * 0.15);
      ctx.lineTo(-h * 0.6, h * 0.2);
      ctx.lineTo(-h * 0.25, h * 0.55);
      ctx.stroke();
      break;
    case 'mic':
      ctx.moveTo(h * 0.28, -h * 0.25);
      ctx.arc(0, -h * 0.25, h * 0.28, 0, Math.PI, true);
      ctx.lineTo(-h * 0.28, h * 0.1);
      ctx.arc(0, h * 0.1, h * 0.28, Math.PI, 0, true);
      ctx.closePath();
      ctx.moveTo(-h * 0.55, h * 0.05);
      ctx.quadraticCurveTo(-h * 0.55, h * 0.6, 0, h * 0.6);
      ctx.quadraticCurveTo(h * 0.55, h * 0.6, h * 0.55, h * 0.05);
      ctx.moveTo(0, h * 0.6);
      ctx.lineTo(0, h * 0.85);
      ctx.stroke();
      break;
    case 'video':
      ctx.moveTo(-h * 0.85, -h * 0.45);
      ctx.lineTo(h * 0.35, -h * 0.45);
      ctx.lineTo(h * 0.35, h * 0.45);
      ctx.lineTo(-h * 0.85, h * 0.45);
      ctx.closePath();
      ctx.moveTo(h * 0.35, -h * 0.1);
      ctx.lineTo(h * 0.85, -h * 0.4);
      ctx.lineTo(h * 0.85, h * 0.4);
      ctx.lineTo(h * 0.35, h * 0.1);
      ctx.stroke();
      break;
    case 'home':
      ctx.moveTo(-h * 0.75, -h * 0.05);
      ctx.lineTo(0, -h * 0.75);
      ctx.lineTo(h * 0.75, -h * 0.05);
      ctx.moveTo(-h * 0.5, -h * 0.25);
      ctx.lineTo(-h * 0.5, h * 0.7);
      ctx.lineTo(h * 0.5, h * 0.7);
      ctx.lineTo(h * 0.5, -h * 0.25);
      ctx.stroke();
      break;
    case 'bookmark':
      ctx.moveTo(-h * 0.5, -h * 0.75);
      ctx.lineTo(h * 0.5, -h * 0.75);
      ctx.lineTo(h * 0.5, h * 0.75);
      ctx.lineTo(0, h * 0.35);
      ctx.lineTo(-h * 0.5, h * 0.75);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'user':
      ctx.arc(0, -h * 0.3, h * 0.35, 0, Math.PI * 2);
      ctx.moveTo(-h * 0.7, h * 0.8);
      ctx.quadraticCurveTo(-h * 0.7, h * 0.1, 0, h * 0.1);
      ctx.quadraticCurveTo(h * 0.7, h * 0.1, h * 0.7, h * 0.8);
      ctx.stroke();
      break;
    case 'flip':
      ctx.arc(0, 0, h * 0.6, Math.PI * 0.15, Math.PI * 0.95);
      ctx.moveTo(-h * 0.6, h * 0.05);
      ctx.lineTo(-h * 0.8, -h * 0.25);
      ctx.moveTo(-h * 0.6, h * 0.05);
      ctx.lineTo(-h * 0.3, -h * 0.15);
      ctx.moveTo(h * 0.6, -h * 0.05);
      ctx.arc(0, 0, h * 0.6, Math.PI * 1.15, Math.PI * 1.95);
      ctx.stroke();
      break;
    default:
      ctx.arc(0, 0, h * 0.5, 0, Math.PI * 2);
      ctx.stroke();
  }
  ctx.restore();
}
