import * as THREE from 'three';
import { particleFragment, particleVertex } from './HologramShaders.js';
import { roundedRectPerimeter } from './HologramScreen.js';

/**
 * GPU particle system for summon/dismiss and ambient sparkle. All motion is
 * computed in the vertex shader from static attributes, so there are no
 * per-frame CPU allocations or buffer uploads.
 *
 * Particle kinds: 70% surface (fill the screen), 15% edge (trace the contour),
 * 15% ambient (float around the device after it settles).
 */
export class ParticleSystem {
  constructor(aspect, radius, count) {
    this.aspect = aspect;
    this.radius = radius;
    this.uniforms = {
      uExpand: { value: 0 },
      uCluster: { value: 0 },
      uDisperse: { value: 0 },
      uSettle: { value: 0 },
      uTime: { value: 0 },
      uDrift: { value: 1 },
      uPointScale: { value: 60 },
      uOpacity: { value: 1 },
      uTint: { value: new THREE.Color(0.35, 0.92, 1) },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(new THREE.BufferGeometry(), this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.count = 0;
    this.setCount(count);
  }

  setCount(count) {
    count = Math.max(500, Math.round(count));
    if (count === this.count) return;
    this.count = count;
    this.points.geometry.dispose();
    this.points.geometry = buildGeometry(this.aspect, this.radius, count);
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

function buildGeometry(aspect, radius, count) {
  const pos = new Float32Array(count * 3);
  const cluster = new Float32Array(count * 3);
  const disperse = new Float32Array(count * 3);
  const rand = new Float32Array(count * 4);
  const hw = aspect / 2;
  const hh = 0.5;
  const perimeter = roundedRectPerimeter(aspect, radius, 10);
  const nSurface = Math.floor(count * 0.7);
  const nEdge = Math.floor(count * 0.15);

  for (let i = 0; i < count; i++) {
    let x;
    let y;
    let z = 0;
    let kind;
    if (i < nSurface) {
      kind = 0;
      // Rejection-sample inside the rounded rectangle.
      for (;;) {
        x = (Math.random() * 2 - 1) * hw;
        y = (Math.random() * 2 - 1) * hh;
        const qx = Math.abs(x) - (hw - radius);
        const qy = Math.abs(y) - (hh - radius);
        if (qx <= 0 || qy <= 0 || qx * qx + qy * qy <= radius * radius) break;
      }
      z = (Math.random() - 0.5) * 0.01;
    } else if (i < nSurface + nEdge) {
      kind = 1;
      const seg = Math.floor(Math.random() * (perimeter.length - 1));
      const t = Math.random();
      const a = perimeter[seg];
      const b = perimeter[seg + 1];
      x = a[0] + (b[0] - a[0]) * t + (Math.random() - 0.5) * 0.006;
      y = a[1] + (b[1] - a[1]) * t + (Math.random() - 0.5) * 0.006;
      z = (Math.random() - 0.5) * 0.01;
    } else {
      kind = 2;
      // Ambient motes in a shell around the device.
      x = (Math.random() * 2 - 1) * hw * 1.5;
      y = (Math.random() * 2 - 1) * hh * 1.15;
      z = (Math.random() - 0.5) * 0.25;
    }
    pos.set([x, y, z], i * 3);

    // Cluster: tight sphere near the bottom-centre (where the hand "pulls" from).
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(2 * Math.random() - 1);
    const r = 0.03 * Math.cbrt(Math.random());
    cluster.set([r * Math.sin(v) * Math.cos(u), -0.38 + r * Math.cos(v), r * Math.sin(v) * Math.sin(u)], i * 3);

    // Disperse: pushed outward from the centre with some upward drift.
    const dirLen = Math.hypot(x, y) || 1;
    const push = 0.25 + Math.random() * 0.6;
    disperse.set([x + (x / dirLen) * push, y + (y / dirLen) * push + 0.15 * Math.random(), z + (Math.random() - 0.5) * 0.8], i * 3);

    // Delay grows with distance from the centre so the surface "unfolds".
    const delay = Math.min(1, Math.hypot(x / hw, y / hh) * 0.7 + Math.random() * 0.3);
    rand.set([delay, Math.random(), Math.random(), kind], i * 4);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aCluster', new THREE.BufferAttribute(cluster, 3));
  g.setAttribute('aDisperse', new THREE.BufferAttribute(disperse, 3));
  g.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));
  return g;
}
