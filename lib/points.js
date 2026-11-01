// Point clouds that morph between shapes and read as one flowing stream.
//
// Lessons behind it:
// - A morph between two random point sets scatters into noise. Sort both sets along the same
//   space-filling curve (3-D Morton order) so point k of shape A lands where point k of shape B is:
//   neighbours stay neighbours and the morph flows.
// - Give every point the same count in every shape (pad with ambient dust), so indices line up.
// - Stagger arrival by a sweep (top to bottom) plus a little per-point noise: the shape "draws itself".
// - "Fog between products": the camera must never enter the cloud. Points travel as a tight readable
//   stream on an arc between shapes, with a short burst out of the old shape first.
//
// Data layout: Float32Array positions [x0, y0, z0, x1, ...]. Pure functions, no three.js needed.
import { clamp, ease, mulberry32 } from './core.js';

/** Interleave the low 10 bits of x, y, z (each 0..1023) into a 30-bit Morton code. */
export function morton3(x, y, z) {
  const sp = (v) => {
    v = Math.min(1023, Math.max(0, v | 0));
    v = (v | (v << 16)) & 0x030000ff;
    v = (v | (v << 8)) & 0x0300f00f;
    v = (v | (v << 4)) & 0x030c30c3;
    v = (v | (v << 2)) & 0x09249249;
    return v;
  };
  return sp(x) | (sp(y) << 1) | (sp(z) << 2);
}

/**
 * Reorder a point set along a Morton curve in its own bounding box (y flipped so order runs top-down).
 * Returns { pos, order, sweep }: reordered positions, the source index of each output point, and a
 * 0..1 sweep value per point (0 = top) for staggered arrival.
 */
export function mortonSort(pos) {
  const n = pos.length / 3;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) {
    const v = pos[i * 3 + c];
    if (v < lo[c]) lo[c] = v;
    if (v > hi[c]) hi[c] = v;
  }
  const q = (v, c) => ((v - lo[c]) / (hi[c] - lo[c] + 1e-9)) * 1023;
  const keys = new Array(n);
  for (let i = 0; i < n; i++) {
    keys[i] = [morton3(q(pos[i * 3], 0), 1023 - q(pos[i * 3 + 1], 1), q(pos[i * 3 + 2], 2)), i];
  }
  keys.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = new Float32Array(n * 3), order = new Int32Array(n), sweep = new Float32Array(n);
  keys.forEach(([, i], j) => {
    order[j] = i;
    for (let c = 0; c < 3; c++) out[j * 3 + c] = pos[i * 3 + c];
    sweep[j] = 1 - (pos[i * 3 + 1] - lo[1]) / (hi[1] - lo[1] + 1e-9);
  });
  return { pos: out, order, sweep };
}

/**
 * Resample a point set to exactly `count` points (seeded shuffle, repeats if short), so every shape
 * in a film has the same number of points.
 */
export function resample(pos, count, seed = 1) {
  const n = pos.length / 3, rnd = mulberry32(seed);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const out = new Float32Array(count * 3);
  for (let k = 0; k < count; k++) {
    const i = k < n ? idx[k] : idx[Math.floor(rnd() * n)];
    out[k * 3] = pos[i * 3]; out[k * 3 + 1] = pos[i * 3 + 1]; out[k * 3 + 2] = pos[i * 3 + 2];
  }
  return out;
}

/**
 * Sample points from a 2-D alpha mask (text, logo, silhouette rendered to an offscreen canvas).
 * alpha(x, y) -> 0..1 for integer pixel coords; points land on a plane of size `size` (world units,
 * width of the mask) centred at the origin, with a little depth jitter. Brighter pixels are denser.
 */
export function sampleMask(alpha, w, h, count, { size = 4, depth = 0.03, seed = 7, maxTries = 80 } = {}) {
  const rnd = mulberry32(seed), out = new Float32Array(count * 3), k = size / w;
  let i = 0, tries = 0;
  while (i < count && tries < count * maxTries) {
    tries++;
    const x = rnd() * w, y = rnd() * h, a = alpha(x | 0, y | 0);
    if (a < 0.15 || rnd() > a) continue;
    out[i * 3] = (x - w / 2) * k;
    out[i * 3 + 1] = -(y - h / 2) * k;
    out[i * 3 + 2] = (rnd() - 0.5) * depth;
    i++;
  }
  return i < count ? out.subarray(0, i * 3) : out;
}

/**
 * Per-point stagger in 0..1 from a sweep and seeded noise. weightSweep 0.65 for shape-to-shape morphs
 * (the shape fills in top-down), 0.25 for a first arrival from scatter (more random, like a rush).
 */
export function stagger(sweep, { weightSweep = 0.65, seed = 9 } = {}) {
  const rnd = mulberry32(seed), out = new Float32Array(sweep.length);
  for (let i = 0; i < sweep.length; i++) out[i] = (1 - weightSweep) * rnd() + weightSweep * sweep[i];
  return out;
}

/**
 * Morph from A to B at progress p (0..1), writing into `out`. Both sets must be the same length and
 * already in corresponding order (mortonSort each). spread = fraction of the window spent staggering.
 * burst: push points out of A's centre before the stream pulls them on. arc: [x, y] sideways offset
 * at mid-flight so the stream travels as a comet, not a straight smear.
 */
export function morph(A, B, p, st, out, { spread = 0.26, burst = 0.8, arc = [0, 1.6], centre = null, easing = ease.inOutSine } = {}) {
  const n = A.length / 3;
  let cx = 0, cy = 0, cz = 0;
  if (burst && !centre) {
    for (let i = 0; i < n; i++) { cx += A[i * 3]; cy += A[i * 3 + 1]; cz += A[i * 3 + 2]; }
    cx /= n; cy /= n; cz /= n;
  } else if (centre) [cx, cy, cz] = centre;
  const span = 1 - spread;
  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    const q = clamp((p - st[i] * spread) / span);
    const e = easing(q);
    let ox = 0, oy = 0, oz = 0;
    if (q > 0 && q < 1) {
      const sw = Math.sin(Math.PI * q);
      ox = arc[0] * sw; oy = arc[1] * sw;
      if (burst) {
        let dx = A[i3] - cx, dy = A[i3 + 1] - cy, dz = A[i3 + 2] - cz;
        const dn = Math.hypot(dx, dy, dz) + 1e-4, k = (1 - (1 - clamp(q * 3.2)) ** 3) * (1 - e) * burst;
        ox += (dx / dn) * k; oy += (dy / dn) * k; oz += (dz / dn) * k;
      }
    }
    out[i3] = A[i3] + (B[i3] - A[i3]) * e + ox;
    out[i3 + 1] = A[i3 + 1] + (B[i3 + 1] - A[i3 + 1]) * e + oy;
    out[i3 + 2] = A[i3 + 2] + (B[i3 + 2] - A[i3 + 2]) * e + oz;
  }
  return out;
}
