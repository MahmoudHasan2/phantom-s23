import { RecordingController } from '../recording/RecordingController.js';
import { formatBytes, formatClock, h } from './dom.js';

/**
 * Countdown, REC indicator + timer, pause/resume/stop, and the result dialog
 * (preview, actual format, Save / Discard). DOM only — not recorded.
 */
export class RecordingControls {
  constructor(root, recorder, settings, status, feedback) {
    this.recorder = recorder;
    this.settings = settings;
    this.status = status;
    this.feedback = feedback;
    this.countdownTimer = null;

    this.countdownEl = h('div', { class: 'countdown' });
    this.indicator = h('div', { class: 'rec-indicator' }, [
      h('span', { class: 'rec-dot' }),
      (this.timeEl = h('span', { class: 'rec-time', text: '00:00' })),
      (this.pauseBtn = h('button', { class: 'icon-btn small', title: 'Pause / resume', text: '❚❚', onclick: () => this.togglePause() })),
      h('button', { class: 'icon-btn small', title: 'Stop (R)', text: '■', onclick: () => this.stop() }),
    ]);
    this.dialog = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
    root.append(this.countdownEl, this.indicator, this.dialog);
    recorder.onStateChange = (s) => this.onState(s);
    recorder.onError = (err) => this.feedback.notice(err.message, 'warn', 6000);
    this.tick = setInterval(() => this.updateTimer(), 250);
  }

  get busy() {
    return ['countdown', 'recording', 'paused'].includes(this.status.get('recording'));
  }

  toggle() {
    if (this.status.get('recording') === 'countdown') return this.cancelCountdown();
    if (this.busy) return this.stop();
    return this.begin();
  }

  begin() {
    const sup = RecordingController.support();
    if (!sup.ok) {
      this.feedback.notice('Recording is not supported in this browser. Use the latest Chrome or Edge.', 'warn', 6000);
      return;
    }
    if (this.status.get('recording') === 'finished' || this.recorder.result) {
      if (!confirm('Discard the previous (unsaved) recording and start a new one?')) {
        this.reopen();
        return;
      }
      this.close();
    }
    let n = this.settings.get('recCountdown');
    this.status.set({ recording: 'countdown' });
    const step = () => {
      if (n <= 0) {
        this.countdownEl.classList.remove('show');
        this.countdownTimer = null;
        this.startNow();
        return;
      }
      this.countdownEl.textContent = String(n);
      this.countdownEl.classList.remove('show');
      void this.countdownEl.offsetWidth; // restart CSS animation
      this.countdownEl.classList.add('show');
      n--;
      this.countdownTimer = setTimeout(step, 1000);
    };
    step();
  }

  cancelCountdown() {
    clearTimeout(this.countdownTimer);
    this.countdownTimer = null;
    this.countdownEl.classList.remove('show');
    this.status.set({ recording: 'idle' });
  }

  async startNow() {
    const s = this.settings.state;
    try {
      await this.recorder.start({ fps: Number(s.recFps), bitrateMbps: s.recBitrate, prefer: s.recFormat, audio: s.recAudio });
      const c = this.recorder.choice;
      this.feedback.notice(`Recording ${c.mimeType}${c.fallback ? ` (preferred ${s.recFormat} unsupported)` : ''}`, 'info', 3000);
    } catch (err) {
      this.status.set({ recording: 'error' });
      this.feedback.notice(err.message, 'warn', 7000);
      this.status.set({ recording: 'idle' });
    }
  }

  togglePause() {
    if (this.status.get('recording') === 'recording') {
      if (!this.recorder.pause()) this.feedback.notice('Pause is not supported by this browser', 'warn');
    } else if (this.status.get('recording') === 'paused') this.recorder.resume();
  }

  async stop() {
    const res = await this.recorder.stop();
    if (res) this.showResult(res);
  }

  onState(s) {
    this.status.set({ recording: s });
    this.indicator.classList.toggle('show', s === 'recording' || s === 'paused');
    this.indicator.classList.toggle('paused', s === 'paused');
    this.pauseBtn.textContent = s === 'paused' ? '▶' : '❚❚';
    this.pauseBtn.style.display = RecordingController.support().pause ? '' : 'none';
  }

  updateTimer() {
    if (this.busy) this.timeEl.textContent = formatClock(this.recorder.elapsed);
  }

  showResult(res) {
    const video = h('video', { src: res.url, controls: true, playsinline: true, class: 'preview' });
    const isWebm = res.extension === 'webm';
    this.dialog.replaceChildren(
      h('div', { class: 'modal-card' }, [
        h('h2', { text: 'Recording finished' }),
        video,
        h('dl', { class: 'meta' }, [
          h('dt', { text: 'Format' }), h('dd', { text: res.format }),
          h('dt', { text: 'Duration' }), h('dd', { text: formatClock(res.duration) }),
          h('dt', { text: 'Size' }), h('dd', { text: formatBytes(res.size) }),
        ]),
        isWebm
          ? h('p', { class: 'help', html: 'WebM plays in Chrome, Edge, Firefox and VLC. For MP4 (e.g. for editing apps) convert locally with FFmpeg:<br><code>ffmpeg -i recording.webm -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac recording.mp4</code>' })
          : h('p', { class: 'help', text: 'MP4 (H.264) produced natively by the browser.' }),
        h('div', { class: 'btn-row' }, [
          h('button', { class: 'btn primary', text: `Save .${res.extension}`, onclick: () => this.recorder.save() }),
          h('button', { class: 'btn danger', text: 'Done / discard from memory', onclick: () => this.close() }),
          h('button', { class: 'btn', text: 'Close (keep in memory)', onclick: () => this.dialog.classList.remove('open') }),
        ]),
      ]),
    );
    this.dialog.classList.add('open');
  }

  /** Re-open the last unsaved result. */
  reopen() {
    if (this.recorder.result) this.dialog.classList.add('open');
  }

  close() {
    this.dialog.classList.remove('open');
    const v = this.dialog.querySelector('video');
    if (v) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
    this.dialog.replaceChildren();
    this.recorder.discard();
    this.status.set({ recording: 'idle' });
  }

  dispose() {
    clearInterval(this.tick);
    clearTimeout(this.countdownTimer);
  }
}
