import { font, glyph, roundRectPath } from './draw.js';

/**
 * Original, simplified app-icon artwork drawn with canvas paths.
 * These are generic stand-ins (colour + simple glyph) created for this demo —
 * no proprietary icon files are copied or redistributed.
 */
export const APP_META = {
  facebook: { label: 'Facebook', colors: ['#3b8cff', '#1453c4'] },
  whatsapp: { label: 'WhatsApp', colors: ['#4fe07c', '#13a34a'] },
  youtube: { label: 'YouTube', colors: ['#ff4b4b', '#c20f0f'] },
  instagram: { label: 'Instagram', colors: ['#ffb347', '#d62f8a', '#6a3fd8'] },
  phone: { label: 'Phone', colors: ['#5fe3a1', '#1d9b62'] },
  messages: { label: 'Messages', colors: ['#62b6ff', '#2a6fe0'] },
  camera: { label: 'Camera', colors: ['#5d6a78', '#262e38'] },
  gallery: { label: 'Gallery', colors: ['#ff8fb1', '#b14bd1'] },
  settings: { label: 'Settings', colors: ['#8a97a6', '#46515e'] },
};

export function drawAppIcon(ctx, id, x, y, size) {
  const meta = APP_META[id];
  if (!meta) return;
  const r = size * 0.28;
  ctx.save();
  const g = ctx.createLinearGradient(x, y + size, x + size, y);
  meta.colors.forEach((c, i) => g.addColorStop(i / (meta.colors.length - 1), c));
  roundRectPath(ctx, x, y, size, size, r);
  ctx.fillStyle = g;
  ctx.fill();
  // Glass highlight
  const hl = ctx.createLinearGradient(x, y, x, y + size);
  hl.addColorStop(0, 'rgba(255,255,255,0.28)');
  hl.addColorStop(0.5, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = hl;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const cx = x + size / 2;
  const cy = y + size / 2;
  const s = size * 0.55;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  switch (id) {
    case 'facebook':
      ctx.font = font(size * 0.72, 800);
      ctx.textAlign = 'center';
      ctx.fillText('f', cx + size * 0.03, y + size * 0.86);
      break;
    case 'whatsapp':
      ctx.lineWidth = size * 0.06;
      ctx.beginPath();
      ctx.arc(cx, cy - size * 0.02, s * 0.5, Math.PI * 0.8, Math.PI * 2.55);
      ctx.lineTo(cx - s * 0.55, cy + s * 0.48);
      ctx.closePath();
      ctx.stroke();
      glyph(ctx, 'phone', cx, cy - size * 0.02, s * 0.5, '#fff', size * 0.035);
      break;
    case 'youtube':
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      roundRectPath(ctx, cx - s * 0.6, cy - s * 0.4, s * 1.2, s * 0.8, s * 0.22);
      ctx.fill();
      ctx.fillStyle = '#e01b1b';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.15, cy - s * 0.22);
      ctx.lineTo(cx + s * 0.25, cy);
      ctx.lineTo(cx - s * 0.15, cy + s * 0.22);
      ctx.closePath();
      ctx.fill();
      break;
    case 'instagram':
      ctx.lineWidth = size * 0.065;
      roundRectPath(ctx, cx - s * 0.5, cy - s * 0.5, s, s, s * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + s * 0.29, cy - s * 0.29, size * 0.035, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'phone':
      glyph(ctx, 'phone', cx, cy, s, '#fff', size * 0.05);
      break;
    case 'messages':
      ctx.beginPath();
      ctx.ellipse(cx, cy - size * 0.02, s * 0.55, s * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.3, cy + s * 0.25);
      ctx.lineTo(cx - s * 0.45, cy + s * 0.55);
      ctx.lineTo(cx - s * 0.05, cy + s * 0.35);
      ctx.fill();
      ctx.fillStyle = '#2a6fe0';
      for (const dx of [-0.22, 0, 0.22]) {
        ctx.beginPath();
        ctx.arc(cx + s * dx, cy - size * 0.02, size * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'camera':
      ctx.lineWidth = size * 0.05;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#7fd7ff';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx - s * 0.08, cy - s * 0.08, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'gallery':
      ctx.lineWidth = size * 0.05;
      roundRectPath(ctx, cx - s * 0.5, cy - s * 0.42, s, s * 0.84, s * 0.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.42, cy + s * 0.3);
      ctx.lineTo(cx - s * 0.12, cy - s * 0.05);
      ctx.lineTo(cx + s * 0.08, cy + s * 0.15);
      ctx.lineTo(cx + s * 0.22, cy);
      ctx.lineTo(cx + s * 0.42, cy + s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + s * 0.2, cy - s * 0.2, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'settings': {
      ctx.lineWidth = size * 0.05;
      const teeth = 8;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const rr = i % 2 ? s * 0.38 : s * 0.5;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#46515e';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.17, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}
