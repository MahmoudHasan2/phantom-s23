import * as THREE from 'three';
import { haloFragment, outlineFragment, outlineVertex, screenFragment, screenVertex } from './HologramShaders.js';

/**
 * The dotted display surface (UI canvas texture), its soft halo, and the
 * progressively drawn contour ribbon. Local units: height = 1, width = aspect.
 */
export class HologramScreen {
  constructor(uiCanvas, aspect, radius = 0.035) {
    this.aspect = aspect;
    this.radius = radius;
    this.group = new THREE.Group();

    this.texture = new THREE.CanvasTexture(uiCanvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    this.uniforms = {
      uTex: { value: this.texture },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uDissolve: { value: 0 },
      uOpacity: { value: 1 },
      uBrightness: { value: 1 },
      uGlow: { value: 0.6 },
      uDotDensity: { value: 190 },
      uDotStrength: { value: 0.7 },
      uScan: { value: 1 },
      uScanSpeed: { value: 0.35 },
      uFlicker: { value: 0.06 },
      uColorKeep: { value: 0.38 },
      uTint: { value: new THREE.Color(0.35, 0.92, 1) },
      uBackdrop: { value: 0.34 },
      uAspect: { value: aspect },
      uRadius: { value: radius },
      uHover: { value: new THREE.Vector3(0.5, 0.5, 0) },
      uGlowEnabled: { value: 1 },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: screenVertex,
      fragmentShader: screenFragment,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(aspect, 1), this.material);
    this.mesh.renderOrder = 2;

    // Halo: larger plane behind the screen with an additive soft glow.
    const haloScale = 1.25;
    this.haloUniforms = {
      uAspect: { value: aspect },
      uRadius: { value: radius },
      uScaleOut: { value: haloScale },
      uTint: { value: this.uniforms.uTint.value },
      uStrength: { value: 0.3 },
    };
    this.halo = new THREE.Mesh(
      new THREE.PlaneGeometry(aspect * haloScale, haloScale),
      new THREE.ShaderMaterial({
        vertexShader: screenVertex,
        fragmentShader: haloFragment,
        uniforms: this.haloUniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.halo.position.z = -0.01;
    this.halo.renderOrder = 1;

    this.outlineUniforms = {
      uDraw: { value: 0 },
      uTime: { value: 0 },
      uTint: { value: this.uniforms.uTint.value },
      uOpacity: { value: 1 },
      uGlow: { value: 0.6 },
    };
    this.outline = new THREE.Mesh(
      buildOutlineGeometry(aspect, radius, 0.014),
      new THREE.ShaderMaterial({
        vertexShader: outlineVertex,
        fragmentShader: outlineFragment,
        uniforms: this.outlineUniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.outline.position.z = 0.002;
    this.outline.renderOrder = 3;

    this.group.add(this.halo, this.mesh, this.outline);
  }

  setAnisotropy(n) {
    this.texture.anisotropy = n;
  }

  markTextureDirty() {
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    for (const m of [this.mesh, this.halo, this.outline]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}

/** Rounded-rect perimeter points starting at bottom centre, counter-clockwise. */
export function roundedRectPerimeter(aspect, radius, segmentsPerCorner = 14) {
  const hw = aspect / 2;
  const hh = 0.5;
  const r = radius;
  const pts = [];
  pts.push([0, -hh]);
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= segmentsPerCorner; i++) {
      const a = a0 + (i / segmentsPerCorner) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(hw - r, -hh + r, -Math.PI / 2); // bottom-right
  corner(hw - r, hh - r, 0); // top-right
  corner(-hw + r, hh - r, Math.PI / 2); // top-left
  corner(-hw + r, -hh + r, Math.PI); // bottom-left
  pts.push([0, -hh]);
  return pts;
}

function buildOutlineGeometry(aspect, radius, width) {
  const pts = roundedRectPerimeter(aspect, radius);
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = lengths[lengths.length - 1];
  const pos = [];
  const aT = [];
  const aSide = [];
  const idx = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let tx = next[0] - prev[0];
    let ty = next[1] - prev[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const nx = ty;
    const ny = -tx; // outward normal for CCW order
    for (const side of [-1, 1]) {
      pos.push(pts[i][0] + nx * width * side, pts[i][1] + ny * width * side, 0);
      aT.push(lengths[i] / total);
      aSide.push(side);
    }
    if (i < pts.length - 1) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(aSide, 1));
  g.setIndex(idx);
  return g;
}
