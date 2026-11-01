// Camera as data: a list of shots, each a slow eased move between two keys.
//
// Lessons behind it:
// - Every shot keeps moving a little (a 3-8 % push or drift). A frozen camera reads as a slide.
// - Each shot names its focus point; depth of field follows it, so the eye knows where to look.
// - Cut on the beat: a shot change is a hard switch at t0, never a dissolve through grey.
// - Never fly the camera into a particle cloud; frame the stream from outside.
//
// Renderer-agnostic: returns plain numbers/arrays. Apply to a three.js camera, a 2-D canvas
// transform, or CSS.
import { clamp, lerp, ease } from './core.js';

const mix3 = (a, b, f) => a.map((v, i) => lerp(v, b[i], f));

/**
 * shots: [{ name, t0, t1, from: {pos, target, focus?, fov?}, to: {...}, aperture? }]
 * Returns at(t) -> { name, pos, target, focus, fov, aperture, f } for the shot active at t.
 */
export function shotTrack(shots, { easing = ease.inOutSine, fov = 28, aperture = 0.0022 } = {}) {
  const S = [...shots].sort((a, b) => a.t0 - b.t0);
  return function at(t) {
    let s = S[0];
    for (const x of S) if (t >= x.t0) s = x;
    const f = easing(clamp((t - s.t0) / (s.t1 - s.t0)));
    const A = s.from, B = s.to || s.from;
    const target = mix3(A.target, B.target, f);
    return {
      name: s.name,
      f,
      pos: mix3(A.pos, B.pos, f),
      target,
      focus: A.focus ? mix3(A.focus, B.focus || A.focus, f) : target,
      fov: lerp(A.fov ?? fov, B.fov ?? A.fov ?? fov, f),
      aperture: s.aperture ?? aperture,
    };
  };
}

/** Field of view that keeps a subject the same size while the camera dollies (the "vertigo" move). */
export const dollyZoomFov = (fov0, d0, d) => (2 * Math.atan(Math.tan((fov0 * Math.PI) / 360) * (d0 / d)) * 180) / Math.PI;

/**
 * 2-D camera for canvas films: returns a transform (translate, rotate, scale about a focus point).
 * Apply as ctx.translate(fx + x, fy + y); ctx.rotate(r); ctx.scale(z, z); ctx.translate(-fx, -fy).
 */
export const camera2d = ({ x = 0, y = 0, z = 1, r = 0, fx = 0, fy = 0 } = {}) => ({ x, y, z, r, fx, fy });
