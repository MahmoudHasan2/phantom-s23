import { avatar, C, drawLines, font, glyph, interactionGlow, text, wrapLines } from '../uicanvas/draw.js';
import { header } from '../uicanvas/chrome.js';
import { sampleImage } from '../uicanvas/images.js';

/** Instagram-inspired feed with sample images, stories and simulated reactions. */
export class InstagramDemo {
  constructor(shell) {
    this.shell = shell;
    this.liked = new Set();
    this.saved = new Set();
    this.heartBurst = new Map(); // post -> time
  }

  animating(t) {
    for (const v of this.heartBurst.values()) if (t - v < 0.8) return true;
    return false;
  }

  render(ui, route, area, t) {
    const ctx = ui.ctx;
    const ig = this.shell.content.instagram;
    ctx.fillStyle = '#000';
    ctx.fillRect(area.x, area.y, area.w, area.h);
    const hh = header(ui, area, {
      id: 'ig',
      title: '',
      tint: 'rgba(0,0,0,0.95)',
      actions: [
        { id: 'dm', icon: 'send', onClick: () => this.shell.toast('Direct messages not simulated') },
        { id: 'like', icon: 'heart', onClick: () => this.shell.toast('Notifications not simulated') },
      ],
    });
    ctx.font = font(26, 700).replace('700', 'italic 700');
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText('Instagram', area.x + 16, area.y + 38);

    ui.beginScroll('ig-feed', area.x, area.y + hh, area.w, area.h - hh);
    let y = 10;
    // Stories
    ig.stories.forEach((s, i) => {
      const cx = 46 + i * 78;
      if (cx > area.w + 40) return;
      const g = ctx.createLinearGradient(cx - 32, y + 64, cx + 32, y);
      g.addColorStop(0, '#feda75');
      g.addColorStop(0.5, '#d62976');
      g.addColorStop(1, '#4f5bd5');
      ctx.beginPath();
      ctx.arc(cx, y + 34, 33, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#333' : g;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, y + 34, 30, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      avatar(ctx, s, cx, y + 34, 27, ['#7a5af8', '#e0645a', '#2bb3a3', '#d6a12b', '#3b82f6', '#e64a8b'][i % 6]);
      text(ctx, i === 0 ? 'Your story' : s, cx, y + 84, 11.5, C.text, 400, 'center');
    });
    y += 100;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, y, area.w, 1);
    y += 6;

    ig.posts.forEach((p, i) => {
      const capLines = wrapLines(ctx, `${p.user}  ${p.caption}`, area.w - 28, 14);
      const h = 56 + area.w + 52 + capLines.length * 19 + 34;
      if (ui.visible(y, h)) this.renderPost(ui, p, i, y, area.w, capLines, t);
      y += h;
    });
    ui.endScroll(y + 10);
  }

  renderPost(ui, p, i, y, w, capLines, t) {
    const ctx = ui.ctx;
    avatar(ctx, p.user, 30, y + 28, 17, '#c13584');
    text(ctx, p.user, 56, y + 25, 14, '#fff', 600);
    text(ctx, p.place, 56, y + 42, 12, C.dim);
    glyph(ctx, 'dots', w - 22, y + 28, 14, '#fff');
    y += 56;
    const img = sampleImage(p.img, 450, 450, i + 31);
    ctx.drawImage(img, 0, y, w, w);
    const st = ui.region(`ig-img-${i}`, 0, y, w, w, { onClick: () => this.like(i, true) });
    if (st.hovered) {
      ctx.strokeStyle = 'rgba(140,235,255,0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, y + 1, w - 2, w - 2);
    }
    const burst = this.heartBurst.get(i);
    if (burst !== undefined && t - burst < 0.8) {
      const k = (t - burst) / 0.8;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      glyph(ctx, 'heartFill', w / 2, y + w / 2, 90 + 40 * Math.sin(k * Math.PI), '#ffffff');
      ctx.restore();
    }
    y += w;
    const liked = this.liked.has(i);
    const acts = [
      { id: 'like', icon: liked ? 'heartFill' : 'heart', col: liked ? '#ff3040' : '#fff', on: () => this.like(i, false) },
      { id: 'comment', icon: 'comment', col: '#fff', on: () => this.shell.toast('Comments are simulated') },
      { id: 'share', icon: 'send', col: '#fff', on: () => this.shell.toast('Sharing is simulated') },
    ];
    acts.forEach((a, k) => {
      const ax = 26 + k * 44;
      const ast = ui.region(`ig-${a.id}-${i}`, ax - 20, y + 6, 40, 40, { onClick: a.on });
      interactionGlow(ctx, ax - 18, y + 8, 36, 36, 18, ast);
      glyph(ctx, a.icon, ax, y + 26, 22, a.col, 2);
    });
    const saved = this.saved.has(i);
    const sst = ui.region(`ig-save-${i}`, w - 46, y + 6, 40, 40, { onClick: () => (saved ? this.saved.delete(i) : this.saved.add(i)) });
    interactionGlow(ctx, w - 44, y + 8, 36, 36, 18, sst);
    glyph(ctx, 'bookmark', w - 26, y + 26, 20, saved ? C.accent : '#fff', 2);
    y += 48;
    text(ctx, `${(p.likes + (liked ? 1 : 0)).toLocaleString('en-US')} likes`, 14, y + 4, 14, '#fff', 600);
    y += 22;
    drawLines(ctx, capLines, 14, y + 4, 19, 14, '#f5f5f5');
    y += capLines.length * 19;
    text(ctx, 'View all comments', 14, y + 10, 13, C.faint);
  }

  like(i, fromImage) {
    if (fromImage) {
      this.liked.add(i);
      this.heartBurst.set(i, this.shell.ui.time);
    } else if (this.liked.has(i)) this.liked.delete(i);
    else this.liked.add(i);
  }
}
