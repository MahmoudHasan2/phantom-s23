import { avatar, drawLines, fillRound, glyph, interactionGlow, roundRectPath, text, textFit, wrapLines } from '../uicanvas/draw.js';
import { button, header } from '../uicanvas/chrome.js';
import { sampleImage } from '../uicanvas/images.js';

const RED = '#ff3b3b';
const CHIPS = ['All', 'Tech', 'Travel', 'Music', 'Live', 'Food'];

/**
 * YouTube-inspired feed and video-detail view. There is no video stream inside
 * the hologram; the "player" is a simulated preview with a progress bar, and a
 * button opens the real site in a normal browser tab.
 */
export class YouTubeDemo {
  constructor(shell) {
    this.shell = shell;
    this.chip = 0;
    this.playing = false;
    this.playStart = 0;
    this.playOffset = 0;
    this.liked = new Set();
  }

  onEnter(route) {
    if (route.view === 'video') {
      this.playing = false;
      this.playOffset = 0;
      this.shell.ui.resetScroll('yt-video');
    }
  }

  animating() {
    return this.playing && this.shell.router.current.view === 'video';
  }

  render(ui, route, area, t) {
    const ctx = ui.ctx;
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(area.x, area.y, area.w, area.h);
    if (route.view === 'video') this.renderVideo(ui, route, area, t);
    else this.renderFeed(ui, area);
  }

  drawLogo(ctx, x, y) {
    fillRound(ctx, x, y - 13, 30, 21, 6, RED);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(x + 12, y - 7);
    ctx.lineTo(x + 20, y - 2.5);
    ctx.lineTo(x + 12, y + 2);
    ctx.closePath();
    ctx.fill();
    text(ctx, 'YouTube', x + 36, y + 3, 19, '#fff', 700);
  }

  renderFeed(ui, area) {
    const ctx = ui.ctx;
    const yt = this.shell.content.youtube;
    const hh = header(ui, area, {
      id: 'yt',
      title: '',
      tint: 'rgba(15,15,15,0.96)',
      actions: [{ id: 'search', icon: 'search', onClick: () => this.shell.toast('Search not simulated') }],
    });
    this.drawLogo(ctx, area.x + 16, area.y + 32);

    // Category chips
    const cy = area.y + hh;
    let cx = 12;
    CHIPS.forEach((c, i) => {
      ctx.font = '600 13px sans-serif';
      const w = ctx.measureText(c).width + 26;
      const st = ui.region(`yt-chip-${i}`, cx, cy + 8, w, 30, { onClick: () => (this.chip = i) });
      fillRound(ctx, cx, cy + 8, w, 30, 9, i === this.chip ? '#f1f1f1' : 'rgba(255,255,255,0.1)');
      interactionGlow(ctx, cx, cy + 8, w, 30, 9, st);
      text(ctx, c, cx + w / 2, cy + 28, 13, i === this.chip ? '#0f0f0f' : '#f1f1f1', 600, 'center');
      cx += w + 8;
    });

    const top = cy + 46;
    ui.beginScroll('yt-feed', area.x, top, area.w, area.y + area.h - top);
    let y = 0;
    const thumbH = Math.round((area.w * 9) / 16);
    yt.videos.forEach((v, i) => {
      const itemH = thumbH + 96;
      if (ui.visible(y, itemH)) {
        const st = ui.region(`yt-v-${i}`, 0, y, area.w, itemH, { onClick: () => this.shell.router.push('video', { index: i }) });
        ctx.drawImage(sampleImage(v.img, 450, thumbH, i + 11), 0, y, area.w, thumbH);
        if (st.hovered || st.pressed) {
          ctx.strokeStyle = 'rgba(140,235,255,0.9)';
          ctx.lineWidth = 2;
          ctx.strokeRect(1, y + 1, area.w - 2, thumbH - 2);
        }
        ctx.font = '600 12px sans-serif';
        const dw = ctx.measureText(v.duration).width + 12;
        fillRound(ctx, area.w - dw - 8, y + thumbH - 26, dw, 19, 4, 'rgba(0,0,0,0.8)');
        text(ctx, v.duration, area.w - dw / 2 - 8, y + thumbH - 12, 12, '#fff', 600, 'center');
        avatar(ctx, v.channel, 30, y + thumbH + 30, 18, '#b23b3b');
        const lines = wrapLines(ctx, v.title, area.w - 80, 15, 500).slice(0, 2);
        drawLines(ctx, lines, 60, y + thumbH + 28, 20, 15, '#f1f1f1', 500);
        textFit(ctx, `${v.channel} · ${v.views} · ${v.age}`, 60, y + thumbH + 30 + lines.length * 20, area.w - 80, 12.5, '#aaaaaa');
      }
      y += thumbH + 96;
    });
    ui.endScroll(y + 20);
  }

  renderVideo(ui, route, area, t) {
    const ctx = ui.ctx;
    const yt = this.shell.content.youtube;
    const i = route.params.index ?? 0;
    const v = yt.videos[i];
    const thumbH = Math.round((area.w * 9) / 16);
    const py = area.y;

    // Simulated player
    ctx.drawImage(sampleImage(v.img, 450, thumbH, i + 11), area.x, py, area.w, thumbH);
    const dur = parseDuration(v.duration);
    const elapsed = this.playing ? this.playOffset + (t - this.playStart) : this.playOffset;
    const prog = Math.min(1, elapsed / dur);
    if (this.playing) {
      // Gentle light sweep suggests motion without pretending to be real video.
      const sx = ((t * 80) % (area.w + 200)) - 100;
      const g = ctx.createLinearGradient(sx - 80, 0, sx + 80, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(area.x, py, area.w, thumbH);
    }
    const st = ui.region('yt-player', area.x, py, area.w, thumbH, { onClick: () => this.togglePlay(t) });
    if (!this.playing || st.hovered) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(area.w / 2, py + thumbH / 2, 34, 0, Math.PI * 2);
      ctx.fill();
      if (this.playing) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(area.w / 2 - 10, py + thumbH / 2 - 13, 7, 26);
        ctx.fillRect(area.w / 2 + 3, py + thumbH / 2 - 13, 7, 26);
      } else {
        glyph(ctx, 'play', area.w / 2 + 3, py + thumbH / 2, 34, '#fff');
      }
    }
    fillRound(ctx, area.x + 8, py + 8, 150, 20, 10, 'rgba(0,0,0,0.6)');
    text(ctx, 'Simulated preview', area.x + 83, py + 22, 11, '#ffd99a', 600, 'center');
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(area.x, py + thumbH - 3, area.w, 3);
    ctx.fillStyle = RED;
    ctx.fillRect(area.x, py + thumbH - 3, area.w * prog, 3);
    ctx.beginPath();
    ctx.arc(area.x + area.w * prog, py + thumbH - 1.5, 6, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, `${fmt(elapsed)} / ${v.duration}`, area.x + 10, py + thumbH - 12, 11, '#fff', 500);

    // Back button overlay
    const bst = ui.region('yt-back', area.x + area.w - 48, py + 6, 42, 32, { onClick: () => this.shell.back() });
    fillRound(ctx, area.x + area.w - 46, py + 6, 38, 30, 15, bst.hovered ? 'rgba(88,225,255,0.5)' : 'rgba(0,0,0,0.55)');
    glyph(ctx, 'close', area.x + area.w - 27, py + 21, 14, '#fff', 2);

    const top = py + thumbH;
    ui.beginScroll('yt-video', area.x, top, area.w, area.h - thumbH);
    let y = 14;
    const lines = wrapLines(ctx, v.title, area.w - 32, 18, 600);
    drawLines(ctx, lines, 16, y + 18, 24, 18, '#f1f1f1', 600);
    y += lines.length * 24 + 10;
    text(ctx, `${v.views} · ${v.age}`, 16, y + 10, 12.5, '#aaaaaa');
    y += 26;
    avatar(ctx, v.channel, 34, y + 22, 18, '#b23b3b');
    text(ctx, v.channel, 62, y + 27, 15, '#f1f1f1', 600);
    button(ui, 'yt-sub', area.w - 124, y + 6, 108, 34, 'Subscribe', { fill: '#f1f1f1', color: '#0f0f0f', stroke: 'rgba(255,255,255,0.6)', onClick: () => this.shell.toast('Subscriptions are simulated') });
    y += 56;
    const liked = this.liked.has(i);
    button(ui, 'yt-like', 16, y, 110, 34, liked ? 'Liked' : 'Like', { icon: 'like', fill: liked ? 'rgba(255,59,59,0.35)' : 'rgba(255,255,255,0.1)', stroke: 'rgba(255,255,255,0.2)', onClick: () => (liked ? this.liked.delete(i) : this.liked.add(i)) });
    button(ui, 'yt-share', 134, y, 110, 34, 'Share', { icon: 'share', fill: 'rgba(255,255,255,0.1)', stroke: 'rgba(255,255,255,0.2)', onClick: () => this.shell.toast('Sharing is simulated') });
    button(ui, 'yt-ext', 252, y, area.w - 268, 34, 'Open YouTube', { icon: 'external', fill: 'rgba(255,59,59,0.25)', stroke: 'rgba(255,120,120,0.6)', onClick: () => this.openExternal() });
    y += 52;
    text(ctx, 'Up next', 16, y + 14, 16, '#f1f1f1', 700);
    y += 28;
    yt.videos.forEach((nv, k) => {
      if (k === i) return;
      const h = 92;
      if (ui.visible(y, h)) {
        const rst = ui.region(`yt-next-${k}`, 8, y, area.w - 16, h - 6, { onClick: () => this.shell.router.push('video', { index: k }) });
        interactionGlow(ctx, 8, y, area.w - 16, h - 6, 10, rst);
        ctx.save();
        roundRectPath(ctx, 16, y + 6, 136, 76, 8);
        ctx.clip();
        ctx.drawImage(sampleImage(nv.img, 450, thumbH, k + 11), 16, y + 6, 136, 76);
        ctx.restore();
        const tl = wrapLines(ctx, nv.title, area.w - 186, 14, 500).slice(0, 2);
        drawLines(ctx, tl, 164, y + 24, 18, 14, '#f1f1f1', 500);
        textFit(ctx, nv.channel, 164, y + 28 + tl.length * 18, area.w - 186, 12, '#aaaaaa');
      }
      y += h;
    });
    ui.endScroll(y + 20);
  }

  togglePlay(t) {
    if (this.playing) {
      this.playOffset += t - this.playStart;
      this.playing = false;
    } else {
      this.playStart = t;
      this.playing = true;
    }
  }

  openExternal() {
    const ok = this.shell.services.openExternal(this.shell.content.youtube.externalUrl);
    this.shell.toast(ok ? 'Opened YouTube in a new browser tab' : 'Popup blocked by the browser');
  }
}

function parseDuration(s) {
  return s.split(':').map(Number).reduce((a, b) => a * 60 + b, 0) || 60;
}

function fmt(sec) {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
