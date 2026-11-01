// Characters that walk, turn, breathe and talk, driven only by time.
//
// Lessons behind it:
// - Drive the walk cycle from distance travelled, not from time: feet then never slide, and a
//   character that stops stops mid-stride naturally.
// - Turns use minimum-jerk on the shortest angle, finishing before the walk does (heads lead bodies).
// - Idle life is cheap and essential: breathing, a slow head drift, blinks, a nod while talking.
// - "Two pairs of hands", "arm has a step": build limbs as one continuous piece (same section, same
//   axis) and check every character in 2-3x crops before showing anything.
// - Hands sit just outside a held object's edges; never through it.
import { clamp, lerp, lerpAngle, ease } from './core.js';

/**
 * Keyed walk: keys = [[t, x, z, ry], ...]. Returns { x, z, ry, dist, moving } at t, where dist is the
 * path length walked so far (feed it to gait()) and moving is 0..1 (0 at rest, peaks mid-segment).
 */
export function walkTrack(t, keys) {
  if (t <= keys[0][0]) return { x: keys[0][1], z: keys[0][2], ry: keys[0][3], dist: 0, moving: 0 };
  let dist = 0;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i], L = Math.hypot(b[1] - a[1], b[2] - a[2]);
    if (t < b[0]) {
      const f = (t - a[0]) / (b[0] - a[0]), e = ease.inOutSine(f);
      return {
        x: lerp(a[1], b[1], e), z: lerp(a[2], b[2], e),
        ry: lerpAngle(a[3], b[3], ease.minimumJerk(f * 1.6)),
        dist: dist + L * e, moving: L > 0.05 ? Math.sin(Math.PI * f) : 0,
      };
    }
    dist += L;
  }
  const z = keys[keys.length - 1];
  return { x: z[1], z: z[2], ry: z[3], dist, moving: 0 };
}

/** Heading (ry) that faces from (x0, z0) toward (x1, z1). */
export const faceToward = (x0, z0, x1, z1) => Math.atan2(x1 - x0, z1 - z0);

/**
 * Gait and idle life from a walkTrack state. Returns rotations/offsets to apply to a rig:
 * legSwing (rad, +left/-right), bob (up), roll (body z-rotation), breathe, headPitch, headRoll.
 * stride = radians of leg phase per unit of distance; talk = 0..1 from dialogue.talking().
 */
export function gait(t, st, { stride = 1.25, swing = 0.6, bobAmp = 0.16, seed = 1, talk = 0 } = {}) {
  const ph = st.dist * stride, m = clamp(st.moving * 3);
  const tk = talk ? Math.sin(t * 17 + seed) * 0.5 + 0.5 : 0;
  return {
    legSwing: Math.sin(ph) * swing * m,
    bob: Math.abs(Math.cos(ph)) * bobAmp * m,
    roll: Math.sin(ph) * 0.04 * m,
    breathe: Math.sin(t * 2.1 + seed) * 0.03,
    headPitch: -0.06 * tk + Math.sin(t * 1.3 + seed) * 0.02,
    headRoll: Math.sin(t * 0.9 + seed * 2) * 0.03,
    headLift: tk * 0.08,
  };
}
