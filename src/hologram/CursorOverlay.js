import * as THREE from 'three';

/**
 * Screen-space overlay rendered last into the WebGL canvas (therefore
 * recorded): fingertip cursor with pinch / hold-progress rings, cinematic
 * letterbox bars and the fade used by the startup sequence.
 * Uses a pixel-space orthographic camera (x right, y down).
 */
const cursorFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uPress;     // 0..1 pinch closed
  uniform float uHold;      // 0..1 hold progress (close app)
  uniform float uGesture;   // 0..1 summon/dismiss progress
  uniform float uHover;     // 0..1 over an interactive target
  uniform float uAlpha;
  uniform float uTime;
  uniform vec3 uTint;
  const float PI = 3.14159265;
  float ring(float d, float r, float w) { return exp(-pow((d - r) / w, 2.0)); }
  float arc(vec2 p, float r, float w, float prog) {
    float a = atan(p.x, -p.y) / (2.0 * PI) + 0.5;  // 0 at top, clockwise
    float d = length(p);
    return ring(d, r, w) * step(a, prog) * step(0.001, prog);
  }
  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p);
    float rOuter = mix(0.2, 0.12, uPress) + 0.02 * uHover * sin(uTime * 6.0);
    float a = ring(d, rOuter, 0.012) * 0.9;
    a += smoothstep(0.035, 0.0, d) * (0.8 + 0.2 * uPress);
    a += exp(-d * d * 60.0) * 0.25 * (0.4 + uHover);
    a += ring(d, 0.08, 0.04) * uPress * 0.6;
    vec3 col = uTint * a;
    float hold = arc(p, 0.3, 0.014, uHold);
    col += vec3(1.0, 0.85, 0.45) * hold * 1.3;
    float gest = arc(p, 0.36, 0.012, uGesture);
    col += uTint * gest * 1.4;
    gl_FragColor = vec4(col * uAlpha, 0.0);
  }
`;

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export class CursorOverlay {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1, 1);
    this.uniforms = {
      uPress: { value: 0 },
      uHold: { value: 0 },
      uGesture: { value: 0 },
      uHover: { value: 0 },
      uAlpha: { value: 0 },
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(0.55, 0.95, 1) },
    };
    this.cursor = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: quadVert,
        fragmentShader: cursorFrag,
        uniforms: this.uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide, // y-down projection flips triangle winding
      }),
    );
    this.cursor.renderOrder = 10;

    const black = () => new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 1, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    this.barTop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), black());
    this.barBottom = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), black());
    this.fade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), black());
    this.barTop.renderOrder = this.barBottom.renderOrder = 11;
    this.fade.renderOrder = 12;
    this.scene.add(this.cursor, this.barTop, this.barBottom, this.fade);
    this.letterbox = 0;
    this.fadeAmount = 0;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    // top=0, bottom=h with y pointing down: pass top/bottom inverted.
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = 0;
    this.camera.bottom = h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * @param c { visible, x, y, press, hold, gesture, hover, size }
   */
  update(c, time, letterboxTarget, fadeAmount) {
    const u = this.uniforms;
    const target = c.visible ? 1 : 0;
    u.uAlpha.value += (target - u.uAlpha.value) * 0.25;
    u.uPress.value += (c.press - u.uPress.value) * 0.35;
    u.uHold.value = c.hold;
    u.uGesture.value = c.gesture;
    u.uHover.value += ((c.hover ? 1 : 0) - u.uHover.value) * 0.3;
    u.uTime.value = time;
    this.cursor.visible = u.uAlpha.value > 0.01;
    this.cursor.position.set(c.x, c.y, 0);
    this.cursor.scale.set(c.size, c.size, 1);

    this.letterbox += (letterboxTarget - this.letterbox) * 0.08;
    const bh = this.letterbox * this.h;
    this.barTop.visible = this.barBottom.visible = bh > 0.5;
    this.barTop.scale.set(this.w, bh, 1);
    this.barTop.position.set(this.w / 2, bh / 2, 0);
    this.barBottom.scale.set(this.w, bh, 1);
    this.barBottom.position.set(this.w / 2, this.h - bh / 2, 0);

    this.fade.visible = fadeAmount > 0.001;
    this.fade.material.opacity = fadeAmount;
    this.fade.scale.set(this.w, this.h, 1);
    this.fade.position.set(this.w / 2, this.h / 2, 0);
  }

  render(renderer) {
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    for (const m of [this.cursor, this.barTop, this.barBottom, this.fade]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}
