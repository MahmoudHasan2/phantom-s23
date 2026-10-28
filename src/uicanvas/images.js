/**
 * Procedurally generated sample imagery. Using generated pictures avoids
 * shipping third-party photos (no licensing questions) and works offline.
 * Each (theme, size, seed) image is rendered once and cached.
 */
const cache = new Map();

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function sampleImage(theme, w, h, seed = 0) {
  const key = `${theme}|${w}|${h}|${seed}`;
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const r = rng(hashStr(key));
  (PAINTERS[theme] || PAINTERS.abstract)(ctx, w, h, r);
  if (cache.size > 120) cache.delete(cache.keys().next().value);
  cache.set(key, c);
  return c;
}

function sky(ctx, w, h, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function ridge(ctx, w, h, r, baseY, amp, color, steps = 9) {
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, baseY);
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * w;
    const y = baseY - r() * amp + amp * 0.3;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

const PAINTERS = {
  sunset(ctx, w, h, r) {
    sky(ctx, w, h, ['#1b1d4a', '#6b2f6b', '#e0645a', '#f7b267']);
    ctx.fillStyle = 'rgba(255,220,150,0.95)';
    ctx.beginPath();
    ctx.arc(w * (0.3 + r() * 0.4), h * 0.62, h * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ridge(ctx, w, h, r, h * 0.72, h * 0.12, '#2a1830');
    ridge(ctx, w, h, r, h * 0.85, h * 0.08, '#120b18');
  },
  mountain(ctx, w, h, r) {
    sky(ctx, w, h, ['#8ec5ff', '#d9ecff', '#f2f6ff']);
    ridge(ctx, w, h, r, h * 0.55, h * 0.35, '#6c7fa6', 6);
    ridge(ctx, w, h, r, h * 0.7, h * 0.25, '#3c4f72', 8);
    ridge(ctx, w, h, r, h * 0.85, h * 0.12, '#1d2b3f', 12);
  },
  city(ctx, w, h, r) {
    sky(ctx, w, h, ['#0b1030', '#23205a', '#d35d6e']);
    for (let layer = 0; layer < 2; layer++) {
      let x = 0;
      while (x < w) {
        const bw = w * (0.05 + r() * 0.09);
        const bh = h * (0.25 + r() * (layer ? 0.35 : 0.5));
        ctx.fillStyle = layer ? '#0a0d1c' : '#1a1d38';
        ctx.fillRect(x, h - bh, bw, bh);
        ctx.fillStyle = layer ? 'rgba(255,214,120,0.85)' : 'rgba(120,200,255,0.5)';
        for (let wy = h - bh + 6; wy < h - 4; wy += 7) {
          for (let wx = x + 3; wx < x + bw - 3; wx += 6) if (r() > 0.55) ctx.fillRect(wx, wy, 2, 3);
        }
        x += bw + 1;
      }
    }
  },
  ocean(ctx, w, h, r) {
    sky(ctx, w, h, ['#8fd3f4', '#c9ecf7', '#2b86c5', '#0d3d6b']);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 26; i++) {
      const y = h * (0.55 + r() * 0.42);
      const x = r() * w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 12, y - 3, x + 24, y);
      ctx.stroke();
    }
  },
  forest(ctx, w, h, r) {
    sky(ctx, w, h, ['#cfe8d5', '#7fb59a', '#1f4733']);
    for (let i = 0; i < 40; i++) {
      const x = r() * w;
      const th = h * (0.25 + r() * 0.4);
      const base = h * (0.7 + r() * 0.3);
      ctx.fillStyle = `rgba(${15 + r() * 25},${50 + r() * 40},${30 + r() * 20},0.9)`;
      ctx.beginPath();
      ctx.moveTo(x, base - th);
      ctx.lineTo(x - th * 0.25, base);
      ctx.lineTo(x + th * 0.25, base);
      ctx.fill();
    }
  },
  aurora(ctx, w, h, r) {
    sky(ctx, w, h, ['#020814', '#06203a', '#0a2b3c']);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`;
      ctx.fillRect(r() * w, r() * h * 0.6, 1, 1);
    }
    for (let band = 0; band < 3; band++) {
      const g = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.7);
      g.addColorStop(0, 'rgba(80,255,170,0)');
      g.addColorStop(0.5, band === 1 ? 'rgba(140,90,255,0.45)' : 'rgba(80,255,170,0.5)');
      g.addColorStop(1, 'rgba(80,255,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      const off = r() * w * 0.3;
      ctx.moveTo(-20, h * 0.5);
      ctx.bezierCurveTo(w * 0.3 + off, h * 0.1, w * 0.6, h * 0.65, w + 20, h * 0.25);
      ctx.lineTo(w + 20, h * 0.45);
      ctx.bezierCurveTo(w * 0.6, h * 0.8, w * 0.3 + off, h * 0.3, -20, h * 0.7);
      ctx.fill();
    }
    ridge(ctx, w, h, r, h * 0.85, h * 0.15, '#01060c', 10);
  },
  desert(ctx, w, h, r) {
    sky(ctx, w, h, ['#f6d9a8', '#f0b27a', '#c97b4a']);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ['#d9965b', '#bf7942', '#9e5c2f', '#7d4421'][i];
      ctx.beginPath();
      const y = h * (0.55 + i * 0.12);
      ctx.moveTo(0, h);
      ctx.lineTo(0, y);
      ctx.quadraticCurveTo(w * (0.3 + r() * 0.4), y - h * 0.15, w, y + h * 0.04);
      ctx.lineTo(w, h);
      ctx.fill();
    }
  },
  food(ctx, w, h, r) {
    sky(ctx, w, h, ['#3b2a20', '#5a3d2b']);
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = '#efe6da';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.38, 0, Math.PI * 2);
    ctx.fill();
    const colors = ['#e74c3c', '#f1c40f', '#27ae60', '#e67e22', '#8e44ad'];
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = colors[i % colors.length];
      const a = r() * Math.PI * 2;
      const d = r() * Math.min(w, h) * 0.26;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 4 + r() * 9, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  tech(ctx, w, h, r) {
    sky(ctx, w, h, ['#03121c', '#06263a', '#0b3c55']);
    ctx.strokeStyle = 'rgba(90,220,255,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      let x = r() * w;
      let y = r() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        if (r() > 0.5) x += (r() - 0.5) * w * 0.4;
        else y += (r() - 0.5) * h * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(150,240,255,0.9)';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    // Stylised phone silhouette
    ctx.strokeStyle = 'rgba(160,240,255,0.9)';
    ctx.lineWidth = 2;
    const pw = Math.min(w, h) * 0.32;
    ctx.strokeRect(w / 2 - pw / 2, h / 2 - pw, pw, pw * 2);
  },
  abstract(ctx, w, h, r) {
    sky(ctx, w, h, ['#1d2b64', '#f8cdda']);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = `hsla(${Math.floor(r() * 360)},70%,60%,0.35)`;
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, (0.1 + r() * 0.3) * Math.min(w, h), 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

export const IMAGE_THEMES = Object.keys(PAINTERS);
