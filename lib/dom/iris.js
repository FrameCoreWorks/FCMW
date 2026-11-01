// Camera-iris (aperture) transition: n blades around a polygonal opening, as SVG path data.
//
// Why: a transition should pass through a logical detail of the film (a shutter in a photo film,
// the ring of a can, the 9 on a watch). A camera iris is the logical detail for anything about
// photos or cameras. Opening radius a goes from 0 (closed) to R / cos(PI / n) (fully open).
// Pure geometry: returns strings, works in DOM, SVG, or canvas (new Path2D(d)).

/**
 * @param cx, cy  centre; R  outer radius (the circle the blades live in);
 * @param a  inner opening radius (polygon circumradius); rot  rotation of the whole iris (radians)
 * @returns [{ d }] one closed path per blade, or [] when fully open.
 */
export function irisBlades(cx, cy, R, a, rot = 0, n = 6) {
  a = Math.max(0.5, a);
  if (a >= R / Math.cos(Math.PI / n)) return [];
  const V = Array.from({ length: n }, (_, k) => {
    const t = rot + (k * 2 * Math.PI) / n;
    return [a * Math.cos(t), a * Math.sin(t)];
  });
  const norm = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
  // ray from p in direction d to the circle of radius R
  const ray = (p, d) => {
    const b = p[0] * d[0] + p[1] * d[1], c = p[0] * p[0] + p[1] * p[1] - R * R, t = -b + Math.sqrt(b * b - c);
    return [p[0] + d[0] * t, p[1] + d[1] * t];
  };
  const f = (v) => `${(cx + v[0]).toFixed(2)} ${(cy + v[1]).toFixed(2)}`;
  const out = [];
  for (let k = 0; k < n; k++) {
    const A = V[k], B = V[(k + 1) % n], P = V[(k + n - 1) % n];
    const Q = ray(A, norm([A[0] - P[0], A[1] - P[1]]));
    const E = ray(B, norm([B[0] - A[0], B[1] - A[1]]));
    let a1 = Math.atan2(E[1], E[0]), a2 = Math.atan2(Q[1], Q[0]), da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    out.push({ d: `M${f(A)} L${f(B)} L${f(E)} A${R} ${R} 0 0 ${da > 0 ? 1 : 0} ${f(Q)} Z` });
  }
  return out;
}

/** Fully-open opening radius for n blades in a circle of radius R. */
export const irisOpen = (R, n = 6) => R / Math.cos(Math.PI / n);
