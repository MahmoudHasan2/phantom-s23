import { describe, expect, it } from 'vitest';
import { describeMime, selectMimeType } from '../src/recording/mimeTypes.js';

const supports = (...types) => (t) => types.includes(t);

describe('Recording MIME-type selection', () => {
  it('prefers VP9 WebM for video-only recordings', () => {
    const r = selectMimeType(supports('video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'), { prefer: 'webm' });
    expect(r).toMatchObject({ mimeType: 'video/webm;codecs=vp9', container: 'webm', extension: 'webm', fallback: false });
  });

  it('selects an audio-capable codec when audio is requested', () => {
    const r = selectMimeType(supports('video/webm;codecs=vp8,opus', 'video/webm'), { audio: true });
    expect(r.mimeType).toBe('video/webm;codecs=vp8,opus');
  });

  it('uses MP4 when preferred and supported', () => {
    const r = selectMimeType(supports('video/webm', 'video/mp4;codecs=avc1.42E01E'), { prefer: 'mp4' });
    expect(r).toMatchObject({ container: 'mp4', extension: 'mp4', fallback: false });
  });

  it('falls back to WebM (flagged) when MP4 is preferred but unsupported', () => {
    const r = selectMimeType(supports('video/webm'), { prefer: 'mp4' });
    expect(r).toMatchObject({ mimeType: 'video/webm', fallback: true });
  });

  it('returns null when nothing is supported, and survives throwing probes', () => {
    expect(selectMimeType(() => false)).toBeNull();
    expect(selectMimeType(() => {
      throw new Error('boom');
    })).toBeNull();
  });

  it('describes formats for the UI', () => {
    expect(describeMime('video/webm;codecs=vp9,opus')).toBe('WebM (vp9,opus)');
    expect(describeMime('video/mp4;codecs=avc1.42E01E,mp4a.40.2')).toBe('MP4 (H.264,AAC)');
  });
});
