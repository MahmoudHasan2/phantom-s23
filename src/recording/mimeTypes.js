/**
 * MediaRecorder MIME-type selection (pure; `isSupported` is injected so the
 * logic can be unit-tested without a browser).
 *
 * Chromium reliably records WebM (VP9/VP8). Recent Chrome/Edge versions can
 * also record MP4 (H.264) — we only offer MP4 when the browser reports support.
 */
export const WEBM_VIDEO_ONLY = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
export const WEBM_WITH_AUDIO = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
export const MP4_VIDEO_ONLY = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'];
export const MP4_WITH_AUDIO = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'];

/**
 * @param {(type:string)=>boolean} isSupported  e.g. MediaRecorder.isTypeSupported
 * @param {{prefer?:'webm'|'mp4', audio?:boolean}} opts
 * @returns {{mimeType:string, container:'webm'|'mp4', extension:string, fallback:boolean} | null}
 */
export function selectMimeType(isSupported, { prefer = 'webm', audio = false } = {}) {
  const webm = audio ? WEBM_WITH_AUDIO : WEBM_VIDEO_ONLY;
  const mp4 = audio ? MP4_WITH_AUDIO : MP4_VIDEO_ONLY;
  const order = prefer === 'mp4' ? [mp4, webm] : [webm, mp4];
  for (let i = 0; i < order.length; i++) {
    for (const type of order[i]) {
      let ok = false;
      try {
        ok = !!isSupported(type);
      } catch {
        ok = false;
      }
      if (ok) {
        const container = type.startsWith('video/mp4') ? 'mp4' : 'webm';
        return { mimeType: type, container, extension: container, fallback: i > 0 };
      }
    }
  }
  return null;
}

export function describeMime(mime) {
  if (!mime) return 'unknown';
  const codecs = /codecs=([^;]+)/.exec(mime)?.[1] || 'default codecs';
  const container = mime.startsWith('video/mp4') ? 'MP4' : 'WebM';
  return `${container} (${codecs.replace(/avc1[.\w]*/, 'H.264').replace('mp4a.40.2', 'AAC')})`;
}
