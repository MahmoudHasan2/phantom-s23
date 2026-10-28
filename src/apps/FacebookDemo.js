import { avatar, C, drawLines, fillRound, glyph, interactionGlow, text, wrapLines } from '../uicanvas/draw.js';
import { button, header } from '../uicanvas/chrome.js';
import { sampleImage } from '../uicanvas/images.js';

const FB_BLUE = '#2d88ff';

/**
 * Facebook-inspired profile, two modes:
 *  A) "Open live profile": opens the configured public URL in a normal browser
 *     tab. Facebook forbids iframe embedding (X-Frame-Options / CSP) and the
 *     hologram is a WebGL texture, so the real site is never embedded.
 *  B) Presentation simulation: a local, clearly labelled sample profile.
 */
export class FacebookDemo {
  constructor(shell) {
    this.shell = shell;
    this.liked = new Set();
    this.extraLikes = new Map();
  }

  onEnter() {
    this.shell.ui.resetScroll('fb-feed');
  }

  render(ui, route, area) {
    const ctx = ui.ctx;
    const fb = this.shell.content.facebook;
    ctx.fillStyle = '#0a1218';
    ctx.fillRect(area.x, area.y, area.w, area.h);

    const hh = header(ui, area, {
      id: 'fb',
      title: 'facebook',
      titleColor: FB_BLUE,
      titleSize: 26,
      titleWeight: 800,
      actions: [
        { id: 'open', icon: 'external', onClick: () => this.openLive() },
        { id: 'search', icon: 'search', onClick: () => this.shell.toast('Search is not part of the demo') },
      ],
    });

    const vx = area.x;
    const vy = area.y + hh;
    const vw = area.w;
    const vh = area.h - hh;
    ui.beginScroll('fb-feed', vx, vy, vw, vh);
    let y = 0;

    // Cover + avatar
    if (ui.visible(y, 290)) {
      ctx.drawImage(sampleImage('aurora', 450, 170, 7), 0, 0, vw, 170);
      const g = ctx.createLinearGradient(0, 100, 0, 170);
      g.addColorStop(0, 'rgba(10,18,24,0)');
      g.addColorStop(1, 'rgba(10,18,24,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 100, vw, 70);
      ctx.beginPath();
      ctx.arc(80, 170, 62, 0, Math.PI * 2);
      ctx.fillStyle = '#0a1218';
      ctx.fill();
      avatar(ctx, fb.displayName, 80, 170, 56, '#3d6fb5');
      text(ctx, fb.displayName, 18, 262, 24, C.text, 700);
      text(ctx, fb.friendsLabel, 18, 286, 14, C.dim, 500);
    }
    y = 300;
    if (ui.visible(y, 120)) {
      text(ctx, fb.subtitle, 18, y + 8, 13, C.faint);
      const lines = wrapLines(ctx, fb.bio, vw - 36, 14);
      drawLines(ctx, lines, 18, y + 32, 19, 14, C.text);
    }
    y += 40 + wrapLines(ctx, fb.bio, vw - 36, 14).length * 19;

    // Mode A: live profile button
    button(ui, 'fb-live', 18, y, vw * 0.56, 40, 'Open live profile', { icon: 'external', fill: 'rgba(45,136,255,0.85)', stroke: 'rgba(160,210,255,0.8)', onClick: () => this.openLive() });
    button(ui, 'fb-msg', 18 + vw * 0.56 + 10, y, vw - 46 - vw * 0.56, 40, 'Message', { onClick: () => this.shell.openApp('whatsapp') });
    y += 56;

    for (const d of fb.details) {
      if (ui.visible(y, 24)) {
        glyph(ctx, 'home', 30, y + 8, 14, C.dim, 1.5);
        text(ctx, d, 48, y + 13, 14, C.dim);
      }
      y += 26;
    }
    y += 10;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, y, vw, 8);
    y += 18;
    text(ctx, 'Posts', 18, y + 16, 18, C.text, 700);
    y += 34;

    fb.posts.forEach((post, i) => {
      y += this.renderPost(ui, post, i, y, vw) + 10;
    });
    text(ctx, 'End of sample posts', vw / 2, y + 24, 12, C.faint, 400, 'center');
    y += 60;
    ui.endScroll(y);
  }

  renderPost(ui, post, i, y, vw) {
    const ctx = ui.ctx;
    const fb = this.shell.content.facebook;
    const lines = wrapLines(ctx, post.text, vw - 36, 15);
    const imgH = post.img ? 230 : 0;
    const h = 66 + lines.length * 20 + (imgH ? imgH + 10 : 0) + 84;
    if (!ui.visible(y, h)) return h;
    fillRound(ctx, 8, y, vw - 16, h, 12, 'rgba(255,255,255,0.045)');
    avatar(ctx, fb.displayName, 34, y + 30, 18, '#3d6fb5');
    text(ctx, fb.displayName, 62, y + 26, 15, C.text, 600);
    text(ctx, post.time, 62, y + 45, 12, C.faint);
    if (fb.showSampleBadge) {
      fillRound(ctx, vw - 86, y + 16, 64, 20, 10, 'rgba(255,200,80,0.18)');
      text(ctx, 'SAMPLE', vw - 54, y + 30, 10, '#ffd480', 700, 'center');
    }
    let cy = y + 66;
    drawLines(ctx, lines, 18, cy + 4, 20, 15, C.text);
    cy += lines.length * 20 + 6;
    if (imgH) {
      ctx.drawImage(sampleImage(post.img, 440, 230, i), 8, cy, vw - 16, imgH);
      cy += imgH + 10;
    }
    const liked = this.liked.has(i);
    const likes = post.likes + (liked ? 1 : 0);
    ctx.beginPath();
    ctx.arc(28, cy + 10, 9, 0, Math.PI * 2);
    ctx.fillStyle = FB_BLUE;
    ctx.fill();
    glyph(ctx, 'like', 28, cy + 10, 10, '#fff', 1.4);
    text(ctx, `${likes}`, 44, cy + 15, 13, C.dim);
    text(ctx, `${post.comments} comments · ${post.shares} shares`, vw - 20, cy + 15, 13, C.dim, 400, 'right');
    cy += 30;
    ctx.fillStyle = C.line;
    ctx.fillRect(18, cy, vw - 36, 1);
    const bw = (vw - 16) / 3;
    const actions = [
      { id: 'like', label: 'Like', icon: 'like', on: () => this.toggleLike(i), active: liked },
      { id: 'comment', label: 'Comment', icon: 'comment', on: () => this.shell.toast('Comments are simulated') },
      { id: 'share', label: 'Share', icon: 'share', on: () => this.shell.toast('Sharing is simulated — nothing was posted') },
    ];
    actions.forEach((a, k) => {
      const bx = 8 + k * bw;
      const st = ui.region(`fb-${a.id}-${i}`, bx + 4, cy + 4, bw - 8, 40, { onClick: a.on });
      interactionGlow(ctx, bx + 4, cy + 4, bw - 8, 40, 10, st);
      const col = a.active ? FB_BLUE : C.dim;
      glyph(ctx, a.icon, bx + bw / 2 - 30, cy + 24, 16, col, 1.7);
      text(ctx, a.label, bx + bw / 2 - 16, cy + 29, 14, col, 600);
    });
    return h;
  }

  toggleLike(i) {
    if (this.liked.has(i)) this.liked.delete(i);
    else this.liked.add(i);
  }

  openLive() {
    const url = this.shell.content.facebook.profileUrl;
    const ok = this.shell.services.openExternal(url);
    this.shell.toast(ok ? 'Opened profile in a new browser tab' : 'Popup blocked — use “Open Facebook profile” in the control panel');
  }
}

