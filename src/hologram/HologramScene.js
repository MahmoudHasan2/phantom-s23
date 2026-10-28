import * as THREE from 'three';
import { HOLOGRAM_TINTS, PHONE_UI } from '../config/appConfig.js';
import { HologramScreen } from './HologramScreen.js';
import { ParticleSystem } from './ParticleSystem.js';
import { timeline } from './HologramAnimations.js';

const FOV = 35;
const CAM_Z = 10;

/**
 * 3-D hologram: perspective camera, the screen group (screen + halo + contour)
 * and particles, positioned/tilted from settings. Also provides the
 * screen-pixel <-> phone-UI mapping used for interaction (ray casting handles
 * tilt and perspective correctly).
 */
export class HologramScene {
  constructor(uiCanvas, particleCount) {
    this.aspect = PHONE_UI.width / PHONE_UI.height;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 100);
    this.camera.position.set(0, 0, CAM_Z);
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.screen = new HologramScreen(uiCanvas, this.aspect);
    this.particles = new ParticleSystem(this.aspect, this.screen.radius, particleCount);
    this.root.add(this.screen.group, this.particles.points);

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.tmpV = new THREE.Vector3();
    this.width = 1;
    this.height = 1;
    this.visibleHeight = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.tint = new THREE.Color();
    this.hover = { u: 0.5, v: 0.5, strength: 0 };
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Place/tilt from settings and drive the animation layers from `formation`. */
  update(st, time, formation, dismissing, quality) {
    const vh = this.visibleHeight;
    const vw = vh * this.camera.aspect;
    const size = st.holoSize * vh;
    this.root.scale.setScalar(size);
    this.root.position.set((st.posX * vw) / 2, (st.posY * vh) / 2, 0);
    // Gentle hover bob when settled.
    this.root.position.y += Math.sin(time * 0.9) * 0.012 * size * (formation >= 1 ? 1 : 0);
    this.root.rotation.set(THREE.MathUtils.degToRad(st.tiltX), THREE.MathUtils.degToRad(st.tiltY), THREE.MathUtils.degToRad(st.tiltZ));
    this.root.updateMatrixWorld(true);

    const tint = HOLOGRAM_TINTS[st.hue] || HOLOGRAM_TINTS.cyan;
    this.tint.setRGB(tint[0], tint[1], tint[2]);

    const tl = timeline(formation, dismissing);
    const visible = formation > 0.0001;
    this.root.visible = visible;
    if (!visible) return tl;

    const su = this.screen.uniforms;
    su.uTime.value = time;
    su.uReveal.value = tl.screen;
    su.uDissolve.value = tl.dissolve;
    su.uOpacity.value = st.opacity;
    su.uBrightness.value = st.brightness;
    su.uGlow.value = st.glow;
    su.uGlowEnabled.value = quality.glowTaps > 0 && st.glow > 0.01 ? 1 : 0;
    su.uDotDensity.value = st.dotDensity;
    su.uDotStrength.value = st.dotStrength;
    su.uScan.value = st.scanLines ? 1 : 0;
    su.uScanSpeed.value = st.scanSpeed;
    su.uFlicker.value = st.flicker;
    su.uColorKeep.value = st.colorKeep;
    su.uBackdrop.value = st.backdrop;
    su.uTint.value.copy(this.tint);
    su.uHover.value.set(this.hover.u, this.hover.v, this.hover.strength);
    this.screen.mesh.visible = tl.screen > 0;
    this.screen.haloUniforms.uStrength.value = 0.25 * st.glow * tl.screen * st.opacity * (1 - tl.dissolve);
    this.screen.outlineUniforms.uDraw.value = tl.outline;
    this.screen.outlineUniforms.uTime.value = time;
    this.screen.outlineUniforms.uOpacity.value = st.opacity * st.brightness;
    this.screen.outlineUniforms.uGlow.value = st.glow;

    const pu = this.particles.uniforms;
    pu.uExpand.value = tl.expand;
    pu.uCluster.value = tl.cluster;
    pu.uDisperse.value = tl.disperse;
    pu.uSettle.value = tl.settle;
    pu.uTime.value = time;
    pu.uDrift.value = st.particleAnim ? 1 : 0;
    pu.uOpacity.value = st.brightness * Math.min(1, st.opacity + 0.2);
    pu.uTint.value.copy(this.tint);
    // Keep point size proportional to output resolution.
    pu.uPointScale.value = 26 * (this.height / 1080) * (size / 4.6);
    return tl;
  }

  render(renderer) {
    if (this.root.visible) renderer.render(this.scene, this.camera);
  }

  /**
   * Screen pixel -> phone UI coordinates via ray casting onto the tilted plane.
   * Returns null when the ray misses the screen plane.
   */
  screenToUI(px, py, out = { x: 0, y: 0, inside: false }) {
    this.ndc.set((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.screen.mesh, false)[0];
    if (!hit || !hit.uv) {
      out.inside = false;
      return out;
    }
    out.x = hit.uv.x * PHONE_UI.width;
    out.y = (1 - hit.uv.y) * PHONE_UI.height;
    out.inside = true;
    return out;
  }

  /** Phone UI coordinates -> screen pixel (used by zone mapping & debug). */
  uiToScreen(ux, uy, out = { x: 0, y: 0 }) {
    this.tmpV.set((ux / PHONE_UI.width - 0.5) * this.aspect, 0.5 - uy / PHONE_UI.height, 0);
    this.tmpV.applyMatrix4(this.screen.mesh.matrixWorld).project(this.camera);
    out.x = (this.tmpV.x * 0.5 + 0.5) * this.width;
    out.y = (-this.tmpV.y * 0.5 + 0.5) * this.height;
    return out;
  }

  /** Approximate on-screen height of the hologram in pixels. */
  screenHeightPx() {
    const a = this.uiToScreen(PHONE_UI.width / 2, 0, { x: 0, y: 0 });
    const b = this.uiToScreen(PHONE_UI.width / 2, PHONE_UI.height, { x: 0, y: 0 });
    return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
  }

  dispose() {
    this.screen.dispose();
    this.particles.dispose();
  }
}
