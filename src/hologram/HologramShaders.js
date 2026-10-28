/**
 * GLSL for the holographic display.
 *
 * Blending model (used by the screen): premultiplied "light + dim":
 *   out = src.rgb + dst.rgb * (1 - src.a)
 * src.rgb is emitted light (added on top of the camera image, so black UI
 * areas stay see-through) and src.a is the optional backdrop dimming, which
 * darkens the camera behind the screen for legibility.
 */

export const SDF_ROUND_RECT = /* glsl */ `
  // Signed distance to a rounded rectangle centred at the origin.
  float sdRoundRect(vec2 p, vec2 halfSize, float r) {
    vec2 q = abs(p) - halfSize + vec2(r);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
`;

export const NOISE = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
`;

export const screenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const screenFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uReveal;      // 0..1 scan-in from the top
  uniform float uDissolve;    // 0..1 noise dissolve (exit)
  uniform float uOpacity;
  uniform float uBrightness;
  uniform float uGlow;
  uniform float uDotDensity;  // dots across the width
  uniform float uDotStrength;
  uniform float uScan;        // scan lines on/off
  uniform float uScanSpeed;
  uniform float uFlicker;
  uniform float uColorKeep;
  uniform vec3 uTint;
  uniform float uBackdrop;
  uniform float uAspect;      // width / height
  uniform float uRadius;
  uniform vec3 uHover;        // xy = uv, z = strength
  uniform float uGlowEnabled;
  ${SDF_ROUND_RECT}
  ${NOISE}

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
    float d = sdRoundRect(p, vec2(uAspect, 1.0) * 0.5, uRadius);
    float inside = 1.0 - smoothstep(-0.0015, 0.0015, d);

    // Tiny horizontal tearing during flicker spikes sells the projected look.
    float spike = step(0.985, hash12(vec2(floor(uTime * 24.0), 3.0))) * uFlicker;
    uv.x += spike * 0.004 * sin(uv.y * 80.0 + uTime * 50.0);

    vec3 c = texture2D(uTex, uv).rgb;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    // Hologram colour mapping: luminance -> tint, highlights burn towards white.
    vec3 holo = uTint * lum * 1.35 + vec3(pow(lum, 3.0) * 0.55);
    vec3 col = mix(holo, c * 1.15, uColorKeep);

    // Dot-matrix surface: round emitters on a grid. Strength 0 = solid image.
    vec2 grid = vec2(uDotDensity, uDotDensity / uAspect);
    vec2 cell = fract(uv * grid) - 0.5;
    float dotMask = 1.0 - smoothstep(0.30, 0.5, length(cell));
    col *= mix(1.0, 0.25 + dotMask * 1.05, uDotStrength);

    // Scan lines: fine static lines + slow travelling bright band.
    float fine = 0.9 + 0.1 * sin(uv.y * 1400.0);
    float band = exp(-pow((fract(uv.y + uTime * uScanSpeed * 0.18) - 0.5) * 14.0, 2.0));
    col *= mix(1.0, fine, uScan);
    col += uTint * band * 0.10 * uScan;

    // Flicker: low-frequency breathing + rare dips.
    float fl = 1.0 - uFlicker * (0.35 * (0.5 + 0.5 * sin(uTime * 3.1)) + 0.65 * spike * 8.0);
    col *= clamp(fl, 0.0, 1.2);

    // Bloom-like glow sampled from a blurred mip level of the UI texture.
    if (uGlowEnabled > 0.5) {
      vec3 blur = texture2D(uTex, vUv, 4.0).rgb;
      col += mix(uTint, blur, uColorKeep) * dot(blur, vec3(0.333)) * uGlow * 0.9;
    }

    // Fingertip proximity glow on the surface.
    vec2 hd = (vUv - uHover.xy) * vec2(uAspect, 1.0);
    col += uTint * exp(-dot(hd, hd) * 900.0) * 0.35 * uHover.z;

    // Edge contour.
    float edge = exp(-abs(d) * 260.0) * 0.9 + exp(-abs(d) * 45.0) * 0.18;
    col += uTint * edge * (0.55 + 0.45 * uGlow);

    // Entrance: rows below the reveal line are hidden; the line itself glows.
    float yTop = 1.0 - vUv.y;
    float line = uReveal * 1.08;
    float rev = 1.0 - smoothstep(line - 0.05, line, yTop);
    float revEdge = exp(-pow((yTop - line) * 70.0, 2.0)) * (1.0 - step(0.999, uReveal));

    // Exit: noise dissolve with a hot rim.
    float n = vnoise(vUv * vec2(38.0, 82.0)) * 0.75 + hash12(vUv * 900.0) * 0.25;
    float dis = smoothstep(uDissolve - 0.04, uDissolve, n);
    float disEdge = (1.0 - smoothstep(0.0, 0.06, abs(n - uDissolve))) * step(0.001, uDissolve);

    float vis = inside * rev * (uDissolve > 0.0 ? dis : 1.0);
    vec3 light = col * uBrightness * vis * uOpacity;
    light += uTint * 1.4 * (revEdge + disEdge) * inside;
    float alpha = uBackdrop * vis * uOpacity;
    gl_FragColor = vec4(light, alpha);
  }
`;

/** Soft outer halo around the screen (additive). */
export const haloFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uAspect;
  uniform float uRadius;
  uniform float uScaleOut;   // halo plane size / screen size
  uniform vec3 uTint;
  uniform float uStrength;
  ${SDF_ROUND_RECT}
  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * uScaleOut;
    float d = sdRoundRect(p, vec2(uAspect, 1.0) * 0.5, uRadius);
    float g = exp(-max(d, 0.0) * 22.0) * step(0.0, d) + (1.0 - step(0.0, d)) * 0.08;
    gl_FragColor = vec4(uTint * g * uStrength, 0.0);
  }
`;

export const outlineVertex = /* glsl */ `
  attribute float aT;     // 0..1 along the perimeter (0 = bottom centre)
  attribute float aSide;  // -1..1 across the ribbon
  varying float vT;
  varying float vSide;
  void main() {
    vT = aT;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const outlineFragment = /* glsl */ `
  precision highp float;
  varying float vT;
  varying float vSide;
  uniform float uDraw;    // 0..1 progress of the stroke
  uniform float uTime;
  uniform vec3 uTint;
  uniform float uOpacity;
  uniform float uGlow;
  void main() {
    // Stroke grows symmetrically from the bottom centre toward the top.
    float s = min(vT, 1.0 - vT) * 2.0;
    float drawn = 1.0 - smoothstep(uDraw - 0.01, uDraw, s);
    float head = exp(-pow((s - uDraw) * 40.0, 2.0)) * (1.0 - step(0.999, uDraw));
    float core = exp(-vSide * vSide * 90.0);
    float glow = exp(-vSide * vSide * 6.0) * 0.35 * uGlow;
    // A travelling highlight once complete.
    float runner = exp(-pow(fract(vT - uTime * 0.07) - 0.5, 2.0) * 900.0) * step(0.999, uDraw);
    float a = (core * 0.9 + glow) * drawn + head * (core + glow) * 2.0 + runner * core * 1.6;
    gl_FragColor = vec4(uTint * a * uOpacity, 0.0);
  }
`;

export const particleVertex = /* glsl */ `
  attribute vec3 aCluster;
  attribute vec3 aDisperse;
  attribute vec4 aRand;   // x delay, y size, z phase, w kind (0 surface, 1 edge, 2 ambient)
  uniform float uExpand;
  uniform float uCluster;
  uniform float uDisperse; // 0 = forming from cluster, 1 = leaving outward
  uniform float uSettle;
  uniform float uTime;
  uniform float uDrift;
  uniform float uPointScale;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vKind;

  float easeInOut(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }

  void main() {
    float kind = aRand.w;
    float k = easeInOut(clamp((uExpand - aRand.x * 0.4) / 0.6, 0.0, 1.0));
    vec3 origin = mix(aCluster, aDisperse, uDisperse);
    vec3 pos = mix(origin, position, k);
    // Swirl while in flight.
    float flight = k * (1.0 - k) * 4.0;
    pos += vec3(sin(aRand.z * 6.28 + uTime * 2.0), cos(aRand.z * 5.1 + uTime * 1.7), sin(aRand.z * 3.3)) * 0.06 * flight;
    // Ambient drift.
    float drift = uDrift * (kind > 1.5 ? 1.0 : 0.25);
    pos += vec3(sin(uTime * 0.6 + aRand.z * 20.0), cos(uTime * 0.5 + aRand.z * 13.0), sin(uTime * 0.4 + aRand.z * 7.0)) * 0.006 * drift;
    if (kind > 1.5) pos.y += mod(uTime * 0.01 * (0.5 + aRand.y) + aRand.z, 0.12) * drift;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = (kind > 0.5 && kind < 1.5) ? 1.6 : 1.0;
    gl_PointSize = uPointScale * (0.6 + aRand.y) * size / -mv.z;

    // Surface particles dim after settling (the screen shader takes over);
    // edge particles keep tracing the contour; ambient ones twinkle.
    float settled = kind < 0.5 ? mix(1.0, 0.1, uSettle) : kind < 1.5 ? mix(1.0, 0.75, uSettle) : 0.35 + 0.35 * sin(uTime * 2.0 + aRand.z * 30.0);
    float appear = kind > 1.5 ? uSettle : 1.0;
    vAlpha = uCluster * settled * appear * uOpacity;
    vKind = kind;
  }
`;

export const particleFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uTint;
  varying float vAlpha;
  varying float vKind;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a;
    vec3 col = mix(uTint, vec3(1.0), smoothstep(0.25, 0.0, d) * 0.6);
    gl_FragColor = vec4(col * a * vAlpha, 0.0);
  }
`;
