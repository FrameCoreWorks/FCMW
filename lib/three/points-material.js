// Shaded point sprites with depth of field, for clouds of 10k-500k points (three.js).
//
// Why points look "finished" here and "flat" elsewhere:
// - each point carries the surface normal it was sampled from, so the cloud is lit like a solid
//   object (lambert key + rim + specular + a coloured rim light), not a flat glow;
// - points facing away from the camera are darkened almost to nothing, which gives the cloud a
//   readable silhouette instead of a see-through smear;
// - circle-of-confusion grows with distance from the focus plane and alpha drops as the sprite
//   grows, which is real depth of field, cheap;
// - additive blending plus a modest bloom (0.4-0.5) gives sparkle. Keep exposure steady: pumping
//   bloom on every kick was rejected as "white pulses too much".
//
// Usage: const mat = pointsMaterial(THREE); geometry needs attributes position, color, size,
// nrm (normal, zero vector = unlit dust) and acc (accent/rim colour).

export function pointsMaterial(THREE, { focus = 10, aperture = 0.6, light = [-0.5, 0.6, 0.62], rimLight = [0.85, 0.15, -0.5], sizeScale = 26 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      focus: { value: focus },
      aper: { value: aperture },
      px: { value: 1 },
      L: { value: new THREE.Vector3(...light).normalize() },
      RL: { value: new THREE.Vector3(...rimLight).normalize() },
    },
    vertexShader: `
      attribute vec3 color, nrm, acc; attribute float size;
      varying vec3 vc; varying float va;
      uniform float focus, aper, px; uniform vec3 L, RL;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        float z = -mv.z;
        float coc = abs(z - focus) / z * aper * 14.;
        float s = size * px * (${sizeScale.toFixed(1)} / z);
        float ps = max(s, 1.0) + coc;
        gl_PointSize = ps;
        va = clamp((s * s) / (ps * ps), 0.02, 1.) * clamp(s, 0., 1.);
        vec3 c = color;
        if (dot(nrm, nrm) > 0.5) {
          vec3 n = normalize(normalMatrix * nrm); vec3 v = normalize(-mv.xyz); float nv = dot(n, v);
          float lam = max(0., dot(n, L)); float rim = pow(1. - abs(nv), 2.5);
          float sp = pow(max(0., dot(n, normalize(L + v))), 36.); float rl = pow(max(0., dot(n, RL)), 2.);
          c = color * (0.10 + lam) + acc * (rim * 0.9 + rl) + vec3(sp * 1.2);
          c *= nv < 0. ? 0.03 : 1.; c *= 0.85;
        }
        vc = c; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vc; varying float va;
      void main() { float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .28, d); gl_FragColor = vec4(vc * a * va, 1.); }`,
  });
}

/**
 * Occluder material: draw the sampled meshes with this (colour writes off, depth on, offset) so points
 * on the far side of a solid object are hidden. Without it a dense cloud reads as fog.
 */
export const occluderMaterial = (THREE) => new THREE.MeshBasicMaterial({
  colorWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 8,
});
