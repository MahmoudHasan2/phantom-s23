import { C, fillRound, text } from '../uicanvas/draw.js';
import { header } from '../uicanvas/chrome.js';
import { IMAGE_THEMES, sampleImage } from '../uicanvas/images.js';

const SAMPLE_COUNT = 18;

/** Gallery: in-memory captures from the Camera app + generated sample images. */
export class GalleryDemo {
  constructor(shell) {
    this.shell = shell;
  }

  items() {
    const captured = this.shell.services.gallery.photos.map((c) => ({ canvas: c, captured: true }));
    const samples = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) samples.push({ theme: IMAGE_THEMES[i % IMAGE_THEMES.length], seed: i + 50 });
    return [...captured, ...samples];
  }

  render(ui, route, area) {
    const ctx = ui.ctx;
    ctx.fillStyle = '#05090c';
    ctx.fillRect(area.x, area.y, area.w, area.h);
    if (route.view === 'photo') return this.renderPhoto(ui, route, area);

    const hh = header(ui, area, { id: 'gal', title: 'Gallery' });
    ui.beginScroll('gal-grid', area.x, area.y + hh, area.w, area.h - hh);
    const items = this.items();
    const gap = 3;
    const cell = (area.w - gap * 4) / 3;
    let y = 8;
    text(ctx, `${items.length} items · samples are generated, captures stay in memory`, 12, y + 12, 11.5, C.faint);
    y += 24;
    items.forEach((it, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = gap + col * (cell + gap);
      const cy = y + row * (cell + gap);
      if (!ui.visible(cy, cell)) return;
      const st = ui.region(`gal-${i}`, x, cy, cell, cell, { onClick: () => this.shell.router.push('photo', { index: i }) });
      const img = it.canvas || sampleImage(it.theme, 200, 200, it.seed);
      drawCover(ctx, img, x, cy, cell, cell);
      if (it.captured) {
        fillRound(ctx, x + 6, cy + 6, 38, 18, 9, 'rgba(0,0,0,0.6)');
        text(ctx, 'NEW', x + 25, cy + 19, 10, C.accent, 700, 'center');
      }
      if (st.hovered || st.pressed) {
        ctx.strokeStyle = st.pressed ? '#fff' : 'rgba(140,235,255,0.9)';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x + 1, cy + 1, cell - 2, cell - 2);
      }
    });
    y += Math.ceil(items.length / 3) * (cell + gap) + 20;
    ui.endScroll(y);
  }

  renderPhoto(ui, route, area) {
    const ctx = ui.ctx;
    const items = this.items();
    const it = items[route.params.index] || items[0];
    const hh = header(ui, area, { id: 'gal-photo', title: it.captured ? 'Captured photo' : 'Sample image', back: true, onBack: () => this.shell.back() });
    const img = it.canvas || sampleImage(it.theme, 450, 600, it.seed);
    const r = { x: area.x, y: area.y + hh + 20, w: area.w, h: area.h - hh - 110 };
    const s = Math.min(r.w / img.width, r.h / img.height);
    ctx.drawImage(img, r.x + (r.w - img.width * s) / 2, r.y + (r.h - img.height * s) / 2, img.width * s, img.height * s);
    text(ctx, it.captured ? 'Kept in memory only · not saved to disk' : `Generated sample · theme “${it.theme}”`, area.w / 2, area.y + area.h - 50, 12, C.dim, 400, 'center');
  }
}

function drawCover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}
