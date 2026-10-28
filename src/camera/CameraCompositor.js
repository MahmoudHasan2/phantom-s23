import * as THREE from 'three';
import { computeVideoTransform } from './videoTransform.js';

/**
 * Draws the live camera image as the first layer of the single WebGL canvas.
 * Because the camera, hologram and cursor all live in that one canvas, the
 * recorder captures exactly what is on screen.
 *
 * The fragment shader performs cover-cropping, zoom/pan, mirroring and a light
 * cinematic grade (cool shadows, vignette). With no camera (demo mode) a dark
 * studio gradient is drawn instead.
 */
const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const frag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVideo;
  uniform float uHasVideo;
  uniform vec2 uScale;
  uniform vec2 uOffset;
  uniform float uMirror;
  uniform float uBrightness;
  uniform float uGrade;
  uniform float uVignette;
  uniform float uTime;
  uniform vec2 uResolution;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec2 s = vec2(vUv.x, 1.0 - vUv.y);            // top-left origin, matches videoTransform.js
    vec2 v = s * uScale + uOffset;
    if (uMirror > 0.5) v.x = 1.0 - v.x;
    vec3 col;
    if (uHasVideo > 0.5) {
      col = texture2D(uVideo, vec2(v.x, 1.0 - v.y)).rgb;
    } else {
      // Demo backdrop: charcoal studio gradient with a soft cool key light.
      float d = distance(vUv, vec2(0.62, 0.55));
      col = mix(vec3(0.05, 0.07, 0.09), vec3(0.01, 0.012, 0.016), smoothstep(0.0, 0.9, d));
    }
    col *= uBrightness;
    // Cinematic grade: slight desaturation + teal shadows / neutral highlights.
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 graded = mix(vec3(l), col, 0.82);
    graded = graded * vec3(0.86, 1.0, 1.08) + vec3(0.0, 0.01, 0.025) * (1.0 - l);
    col = mix(col, graded, uGrade);
    // Vignette
    vec2 q = vUv - 0.5;
    q.x *= uResolution.x / uResolution.y;
    float vig = smoothstep(1.05, 0.25, length(q));
    col *= mix(1.0, vig, uVignette);
    // Subtle film grain avoids banding in dark areas of the recording.
    col += (hash(vUv * uResolution + fract(uTime)) - 0.5) * 0.012;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class CameraCompositor {
  constructor(videoEl) {
    this.video = videoEl;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.texture = null;
    this.uniforms = {
      uVideo: { value: null },
      uHasVideo: { value: 0 },
      uScale: { value: new THREE.Vector2(1, 1) },
      uOffset: { value: new THREE.Vector2(0, 0) },
      uMirror: { value: 1 },
      uBrightness: { value: 1 },
      uGrade: { value: 0.35 },
      uVignette: { value: 0.45 },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.transform = computeVideoTransform(1, 1, 1, 1);
  }

  /** Call when a camera stream starts or stops. */
  setVideoActive(active) {
    if (active && !this.texture) {
      this.texture = new THREE.VideoTexture(this.video);
      // Keep raw sRGB values: our ShaderMaterials pass colours straight through.
      this.texture.colorSpace = THREE.NoColorSpace;
      this.texture.minFilter = THREE.LinearFilter;
      this.texture.magFilter = THREE.LinearFilter;
      this.texture.generateMipmaps = false;
      this.uniforms.uVideo.value = this.texture;
    }
    if (!active && this.texture) {
      this.texture.dispose();
      this.texture = null;
      this.uniforms.uVideo.value = null;
    }
    this.uniforms.uHasVideo.value = active ? 1 : 0;
  }

  update(settings, width, height, time) {
    const vw = this.video.videoWidth || width;
    const vh = this.video.videoHeight || height;
    this.transform = computeVideoTransform(width, height, vw, vh, settings.camZoom, settings.camPanX, settings.camPanY);
    const u = this.uniforms;
    u.uScale.value.set(this.transform.scaleX, this.transform.scaleY);
    u.uOffset.value.set(this.transform.offsetX, this.transform.offsetY);
    u.uMirror.value = settings.mirror ? 1 : 0;
    u.uBrightness.value = settings.camBrightness;
    u.uGrade.value = settings.camGrade;
    u.uVignette.value = settings.vignette;
    u.uTime.value = time;
    u.uResolution.value.set(width, height);
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.setVideoActive(false);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
