/**
 * Owns the webcam MediaStream and the <video> element it plays in.
 * Guards against duplicate initialisation and maps getUserMedia errors to
 * operator-friendly messages.
 */
export class CameraManager {
  constructor(videoEl) {
    this.video = videoEl;
    this.stream = null;
    this.deviceId = null;
    this.pending = null;
    this.onEnded = null; // called when the device disappears / is taken
    this.onDevicesChanged = null;
    this.handleDeviceChange = () => this.onDevicesChanged?.();
    navigator.mediaDevices?.addEventListener?.('devicechange', this.handleDeviceChange);
  }

  static isSupported() {
    return !!navigator.mediaDevices?.getUserMedia;
  }

  get active() {
    return !!this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live');
  }

  async listCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
  }

  /**
   * Start (or switch) the camera. Concurrent calls share one in-flight request
   * so the camera is never initialised twice.
   */
  start({ deviceId = null, resolution = '1280x720' } = {}) {
    if (this.pending) return this.pending;
    this.pending = this.startInternal(deviceId, resolution).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  async startInternal(deviceId, resolution) {
    if (!CameraManager.isSupported()) {
      throw new CameraError('unsupported', 'This browser does not support camera access (getUserMedia). Use a current Chrome or Edge.');
    }
    if (!window.isSecureContext) {
      throw new CameraError('insecure', 'Camera access requires a secure context. Open the app via http://localhost (npm run dev), not file://.');
    }
    this.stop();
    const [w, h] = resolution.split('x').map(Number);
    const video = { width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30, max: 60 } };
    if (deviceId) video.deviceId = { exact: deviceId };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (err) {
      // A stale deviceId or unsupported resolution: retry with loose constraints once.
      if (err?.name === 'OverconstrainedError' || err?.name === 'ConstraintNotSatisfiedError') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId } : true, audio: false });
        } catch (err2) {
          throw mapCameraError(err2);
        }
      } else {
        throw mapCameraError(err);
      }
    }

    this.stream = stream;
    const track = stream.getVideoTracks()[0];
    this.deviceId = track?.getSettings?.().deviceId ?? deviceId;
    track?.addEventListener('ended', () => {
      if (this.stream === stream) this.onEnded?.(new CameraError('ended', 'The camera stopped delivering video (disconnected or taken by another application).'));
    });

    this.video.srcObject = stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await waitForMetadata(this.video);
    try {
      await this.video.play();
    } catch (err) {
      this.stop();
      throw new CameraError('play', `The video element could not start playback: ${err.message}`);
    }
    return {
      label: track?.label || 'Camera',
      width: this.video.videoWidth,
      height: this.video.videoHeight,
      deviceId: this.deviceId,
    };
  }

  stop() {
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
    }
    this.stream = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
  }

  dispose() {
    this.stop();
    navigator.mediaDevices?.removeEventListener?.('devicechange', this.handleDeviceChange);
  }
}

export class CameraError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function mapCameraError(err) {
  const name = err?.name || '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return new CameraError('denied', 'Camera permission was denied. Click the camera icon in the address bar, allow access for localhost, then press Retry.');
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new CameraError('notfound', 'No camera was found. Connect a webcam and press Retry.');
    case 'NotReadableError':
    case 'TrackStartError':
      return new CameraError('busy', 'The camera is in use by another application (Teams, Zoom, Camera app…) or blocked by Windows privacy settings. Close the other app and press Retry.');
    case 'AbortError':
      return new CameraError('aborted', 'Camera start was aborted by the system. Press Retry.');
    case 'SecurityError':
      return new CameraError('insecure', 'Camera access is blocked by browser security settings. Use http://localhost.');
    default:
      return new CameraError('unknown', `Camera error: ${err?.message || name || 'unknown error'}`);
  }
}

function waitForMetadata(video) {
  if (video.readyState >= 1 && video.videoWidth) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new CameraError('timeout', 'The camera did not deliver video within 10 seconds.'));
    }, 10000);
    const ok = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', ok);
    };
    video.addEventListener('loadedmetadata', ok);
  });
}
