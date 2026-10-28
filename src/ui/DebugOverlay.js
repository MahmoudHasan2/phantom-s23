import { PHONE_UI } from '../config/appConfig.js';

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

/**
 * Tracking debug overlay (DOM canvas, not recorded): landmark skeletons,
 * hologram bounds, zone rectangle, pinch meter and performance numbers.
 */
export class DebugOverlay {
  constructor(root, glCanvas) {
    this.glCanvas = glCanvas;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'debug-overlay';
    root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.visible = false;
  }

  setVisible(v) {
    this.visible = v;
    this.canvas.style.display = v ? 'block' : 'none';
    if (!v) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  syncLayout() {
    const g = this.glCanvas;
    if (this.canvas.width !== g.width || this.canvas.height !== g.height) {
      this.canvas.width = g.width;
      this.canvas.height = g.height;
    }
    const s = this.canvas.style;
    s.left = g.style.left;
    s.top = g.style.top;
    s.width = g.style.width;
    s.height = g.style.height;
  }

  draw({ hands, recognizer, holoScene, interaction, settings, status, tracker }) {
    if (!this.visible) return;
    this.syncLayout();
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const k = H / 1080;
    ctx.clearRect(0, 0, W, H);

    // Hologram bounds (projected corners)
    if (holoScene.root.visible) {
      const corners = [[0, 0], [PHONE_UI.width, 0], [PHONE_UI.width, PHONE_UI.height], [0, PHONE_UI.height]].map(([x, y]) => holoScene.uiToScreen(x, y, { x: 0, y: 0 }));
      ctx.strokeStyle = 'rgba(255, 220, 0, 0.7)';
      ctx.setLineDash([8 * k, 6 * k]);
      ctx.lineWidth = 1.5 * k;
      ctx.beginPath();
      corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      if (settings.pointerMode === 'zone') {
        const z = interaction.zoneRect();
        ctx.strokeStyle = 'rgba(255, 120, 220, 0.8)';
        ctx.strokeRect(z.x, z.y, z.w, z.h);
        ctx.fillStyle = 'rgba(255, 120, 220, 0.9)';
        ctx.font = `${12 * k}px monospace`;
        ctx.fillText('interaction zone', z.x + 4, z.y - 6);
      }
    }

    // Skeletons
    for (const hand of hands) {
      const p = hand.points;
      ctx.strokeStyle = hand.primary ? 'rgba(0, 255, 170, 0.9)' : 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2 * k;
      ctx.beginPath();
      for (const [a, b] of BONES) {
        ctx.moveTo(p[a].x, p[a].y);
        ctx.lineTo(p[b].x, p[b].y);
      }
      ctx.stroke();
      for (let i = 0; i < 21; i++) {
        ctx.fillStyle = i === 4 || i === 8 ? '#ff4d6d' : '#ffffff';
        ctx.beginPath();
        ctx.arc(p[i].x, p[i].y, (i === 4 || i === 8 ? 5 : 3) * k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#00ffaa';
      ctx.font = `${13 * k}px monospace`;
      ctx.fillText(`${hand.handedness || '?'} ${(hand.score * 100).toFixed(0)}%`, p[0].x + 10 * k, p[0].y + 20 * k);
    }

    // Stats panel
    const rs = recognizer.state;
    const cfg = recognizer.config;
    const lines = [
      `render ${status.fps.toFixed(0)} fps | tracking ${status.trackFps} Hz | inference ${status.inferenceMs.toFixed(1)} ms`,
      `backend ${tracker?.backend || '-'} | quality ${status.quality}`,
      `hand ${rs.tracked ? 'TRACKED' : 'none'} | conf ${(rs.confidence * 100).toFixed(0)}% | pose ${rs.pose}`,
      `fingers T:${rs.fingers.thumb[0]} I:${rs.fingers.index[0]} M:${rs.fingers.middle[0]} R:${rs.fingers.ring[0]} P:${rs.fingers.pinky[0]}`,
      `pinch ${rs.pinchRatio.toFixed(2)} (on<${cfg.pinchOn.toFixed(2)} off>${cfg.pinchOff.toFixed(2)}) ${rs.pinching ? 'PINCH' : ''}${rs.dragging ? ' DRAG' : ''}${rs.scrolling ? ' SCROLL' : ''}`,
      `dir ${rs.direction} | hand ${rs.handSizePx.toFixed(0)} px | hold ${(rs.holdProgress * 100).toFixed(0)}%`,
    ];
    const pad = 10 * k;
    const lh = 17 * k;
    ctx.font = `${12.5 * k}px monospace`;
    const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2;
    const bx = pad;
    const by = H - lines.length * lh - pad * 3 - 22 * k;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(bx, by, bw, lines.length * lh + pad * 2 + 22 * k);
    ctx.fillStyle = '#9ff3ff';
    lines.forEach((l, i) => ctx.fillText(l, bx + pad, by + pad + (i + 0.8) * lh));
    // Pinch meter with thresholds
    const mx = bx + pad;
    const my = by + pad + lines.length * lh + 6 * k;
    const mw = bw - pad * 2;
    const scale = (v) => mx + Math.min(1, v / 1.2) * mw;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(mx, my, mw, 10 * k);
    ctx.fillStyle = rs.pinching ? '#ff4d6d' : '#58e1ff';
    ctx.fillRect(mx, my, scale(rs.pinchRatio) - mx, 10 * k);
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(scale(cfg.pinchOn) - 1, my - 3 * k, 2, 16 * k);
    ctx.fillStyle = '#ff9f1c';
    ctx.fillRect(scale(cfg.pinchOff) - 1, my - 3 * k, 2, 16 * k);
  }
}
