import { describeMime, selectMimeType } from './mimeTypes.js';

/**
 * Records the composited WebGL canvas (camera + hologram + cursor) with
 * MediaRecorder. Optional microphone audio is mixed through Web Audio together
 * with the app's sound effects. Nothing is saved until the user clicks Save.
 */
export class RecordingController {
  constructor(canvas, sound) {
    this.canvas = canvas;
    this.sound = sound;
    this.recorder = null;
    this.stream = null;
    this.micStream = null;
    this.audioDest = null;
    this.chunks = [];
    this.state = 'idle';
    this.startedAt = 0;
    this.pausedTotal = 0;
    this.pausedAt = 0;
    this.result = null;
    this.onStateChange = null;
    this.onError = null;
  }

  static support() {
    const hasRecorder = typeof window.MediaRecorder === 'function';
    const hasCapture = typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
    return { ok: hasRecorder && hasCapture, hasRecorder, hasCapture, pause: hasRecorder && typeof MediaRecorder.prototype.pause === 'function' };
  }

  get elapsed() {
    if (this.state === 'idle' || !this.startedAt) return 0;
    const now = this.state === 'paused' ? this.pausedAt : performance.now();
    return (now - this.startedAt - this.pausedTotal) / 1000;
  }

  setState(s) {
    this.state = s;
    this.onStateChange?.(s);
  }

  /**
   * @param {{fps:number, bitrateMbps:number, prefer:'webm'|'mp4', audio:boolean}} opts
   */
  async start({ fps = 30, bitrateMbps = 10, prefer = 'webm', audio = false } = {}) {
    if (this.state === 'recording' || this.state === 'paused') return;
    const sup = RecordingController.support();
    if (!sup.ok) throw new Error('Recording is not supported in this browser (MediaRecorder / canvas.captureStream missing). Use current Chrome or Edge.');
    this.discard();

    const videoStream = this.canvas.captureStream(fps);
    const tracks = [...videoStream.getVideoTracks()];
    if (audio) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      } catch (err) {
        videoStream.getTracks().forEach((t) => t.stop());
        throw new Error(`Microphone unavailable (${err.name || err.message}). Disable "Record microphone audio" or allow the microphone.`);
      }
      const ctx = this.sound.context();
      this.audioDest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(this.micStream).connect(this.audioDest);
      this.sound.connectRecording(this.audioDest);
      tracks.push(...this.audioDest.stream.getAudioTracks());
    }
    this.stream = new MediaStream(tracks);

    const choice = selectMimeType((t) => MediaRecorder.isTypeSupported(t), { prefer, audio });
    if (!choice) {
      this.cleanupStreams();
      throw new Error('No supported recording format was found in this browser.');
    }
    this.choice = choice;
    this.chunks = [];
    try {
      this.recorder = new MediaRecorder(this.stream, {
        mimeType: choice.mimeType,
        videoBitsPerSecond: Math.round(bitrateMbps * 1e6),
        audioBitsPerSecond: audio ? 160000 : undefined,
      });
    } catch (err) {
      this.cleanupStreams();
      throw new Error(`Recorder could not start: ${err.message}`);
    }
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) this.chunks.push(e.data);
    };
    this.recorder.onerror = (e) => {
      this.onError?.(new Error(`Recording failed: ${e.error?.message || 'unknown error'}`));
      this.cleanupStreams();
      this.setState('error');
    };
    this.recorder.start(1000);
    this.startedAt = performance.now();
    this.pausedTotal = 0;
    this.setState('recording');
  }

  pause() {
    if (this.state !== 'recording' || !RecordingController.support().pause) return false;
    this.recorder.pause();
    this.pausedAt = performance.now();
    this.setState('paused');
    return true;
  }

  resume() {
    if (this.state !== 'paused') return false;
    this.recorder.resume();
    this.pausedTotal += performance.now() - this.pausedAt;
    this.setState('recording');
    return true;
  }

  /** Stops and resolves with { url, blob, mimeType, format, size, duration }. */
  stop() {
    if (!this.recorder || (this.state !== 'recording' && this.state !== 'paused')) return Promise.resolve(null);
    const duration = this.elapsed;
    return new Promise((resolve) => {
      this.recorder.onstop = () => {
        const type = this.recorder.mimeType || this.choice.mimeType;
        const blob = new Blob(this.chunks, { type: type.split(';')[0] });
        this.chunks = [];
        this.cleanupStreams();
        if (!blob.size) {
          this.setState('error');
          this.onError?.(new Error('The recording is empty. Make sure the tab stays visible while recording.'));
          resolve(null);
          return;
        }
        this.result = {
          blob,
          url: URL.createObjectURL(blob),
          mimeType: type,
          format: describeMime(type),
          extension: this.choice.extension,
          size: blob.size,
          duration,
        };
        this.setState('finished');
        resolve(this.result);
      };
      this.recorder.stop();
    });
  }

  /** Explicit user action: trigger a download of the finished recording. */
  save(filename) {
    if (!this.result) return false;
    const a = document.createElement('a');
    a.href = this.result.url;
    a.download = filename || `phantom-s23-${timestamp()}.${this.result.extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }

  discard() {
    if (this.result) URL.revokeObjectURL(this.result.url);
    this.result = null;
    if (this.state === 'finished' || this.state === 'error') this.setState('idle');
  }

  cleanupStreams() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.micStream?.getTracks().forEach((t) => t.stop());
    if (this.audioDest) this.sound.disconnectRecording(this.audioDest);
    this.stream = null;
    this.micStream = null;
    this.audioDest = null;
  }

  dispose() {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        /* ignore */
      }
    }
    this.cleanupStreams();
    this.discard();
  }
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
