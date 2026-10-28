import { C, fillRound, glyph, interactionGlow, text } from '../uicanvas/draw.js';

const MODES = ['PORTRAIT', 'PHOTO', 'VIDEO', 'MORE'];

/**
 * Camera app. The viewfinder shows the webcam stream that is already running
 * (permission was granted for the experience). The shutter copies the current
 * frame into the in-memory Gallery only — nothing is written to disk or
 * uploaded. In demo mode (no camera) it says so instead of faking a picture.
 */
export class CameraDemo {
  constructor(shell) {
    this.shell = shell;
    this.mode = 1;
    this.flashAt = -10;
  }

  get hasVideo() {
    const v = this.shell.video;
    return !!(v && v.srcObject && v.readyState >= 2 && v.videoWidth);
  }

  animating() {
    return this.shell.router.current.app === 'camera';
  }

  render(ui, route, area, t) {
    const ctx = ui.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(area.x, area.y, area.w, area.h);
    const vf = { x: area.x, y: area.y + 50, w: area.w, h: area.h - 230 };
    if (this.hasVideo) {
      this.drawVideoCover(ctx, vf);
      // Rule-of-thirds grid
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(vf.x + (vf.w * i) / 3, vf.y);
        ctx.lineTo(vf.x + (vf.w * i) / 3, vf.y + vf.h);
        ctx.moveTo(vf.x, vf.y + (vf.h * i) / 3);
        ctx.lineTo(vf.x + vf.w, vf.y + (vf.h * i) / 3);
        ctx.stroke();
      }
    } else {
      fillRound(ctx, vf.x + 10, vf.y + 10, vf.w - 20, vf.h - 20, 16, 'rgba(30,50,60,0.4)');
      glyph(ctx, 'camera', area.w / 2, vf.y + vf.h / 2 - 20, 54, C.dim, 2);
      text(ctx, 'No live camera feed', area.w / 2, vf.y + vf.h / 2 + 40, 16, C.text, 600, 'center');
      text(ctx, 'Demo mode — start the webcam to use the viewfinder', area.w / 2, vf.y + vf.h / 2 + 64, 12, C.dim, 400, 'center');
    }
    // Top bar
    text(ctx, '⚡ Auto', area.x + 22, area.y + 32, 13, C.text, 600);
    text(ctx, '4:3', area.w / 2, area.y + 32, 13, C.text, 600, 'center');
    text(ctx, '200 MP', area.w - 22, area.y + 32, 13, C.text, 600, 'right');

    // Flash feedback
    const fk = 1 - (t - this.flashAt) / 0.35;
    if (fk > 0) {
      ctx.fillStyle = `rgba(255,255,255,${fk * 0.85})`;
      ctx.fillRect(vf.x, vf.y, vf.w, vf.h);
    }

    // Modes
    const my = area.y + area.h - 160;
    MODES.forEach((m, i) => {
      const mx = area.w / 2 + (i - this.mode) * 96;
      const st = ui.region(`cam-mode-${i}`, mx - 44, my - 18, 88, 30, { onClick: () => this.setMode(i) });
      interactionGlow(ctx, mx - 44, my - 18, 88, 28, 14, st);
      text(ctx, m, mx, my + 2, 13, i === this.mode ? '#ffd76a' : C.text, 700, 'center');
    });

    // Shutter row
    const sy = area.y + area.h - 78;
    const gallery = this.shell.services.gallery;
    const thumb = gallery.photos[0];
    const gst = ui.region('cam-gallery', 40, sy - 26, 52, 52, { onClick: () => this.shell.openApp('gallery') });
    fillRound(ctx, 40, sy - 26, 52, 52, 12, 'rgba(255,255,255,0.12)');
    if (thumb) ctx.drawImage(thumb, 40, sy - 26, 52, 52);
    interactionGlow(ctx, 40, sy - 26, 52, 52, 12, gst);

    const sst = ui.region('cam-shutter', area.w / 2 - 40, sy - 40, 80, 80, { onClick: () => this.capture(t) });
    ctx.beginPath();
    ctx.arc(area.w / 2, sy, 36, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(area.w / 2, sy, sst.pressed ? 24 : 29, 0, Math.PI * 2);
    ctx.fillStyle = this.mode === 2 ? '#ef4444' : sst.hovered ? '#bff6ff' : '#fff';
    ctx.fill();

    const fst = ui.region('cam-flip', area.w - 92, sy - 26, 52, 52, { onClick: () => this.shell.toast('Only one camera stream is used in the demo') });
    ctx.beginPath();
    ctx.arc(area.w - 66, sy, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    interactionGlow(ctx, area.w - 90, sy - 24, 48, 48, 24, fst);
    glyph(ctx, 'flip', area.w - 66, sy, 24, '#fff', 2);
  }

  drawVideoCover(ctx, r) {
    const v = this.shell.video;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const scale = Math.max(r.w / vw, r.h / vh);
    const sw = r.w / scale;
    const sh = r.h / scale;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;
    ctx.save();
    if (this.shell.settings.get('mirror')) {
      ctx.translate(r.x + r.w, r.y);
      ctx.scale(-1, 1);
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, r.w, r.h);
    } else {
      ctx.drawImage(v, sx, sy, sw, sh, r.x, r.y, r.w, r.h);
    }
    ctx.restore();
  }

  setMode(i) {
    this.mode = i;
    if (MODES[i] === 'VIDEO') this.shell.toast('Video capture is not simulated — use the main Record button');
    if (MODES[i] === 'MORE') this.shell.toast('More modes are not part of the demo');
  }

  capture(t) {
    if (!this.hasVideo) {
      this.shell.toast('No camera feed — start the webcam first');
      return;
    }
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 800;
    this.drawVideoCover(c.getContext('2d'), { x: 0, y: 0, w: 600, h: 800 });
    this.shell.services.gallery.add(c);
    this.flashAt = t;
    this.shell.sound?.play('shutter');
    this.shell.toast('Photo kept in the in-app Gallery (memory only)');
  }
}
