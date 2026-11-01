// Core motion math. Every function is a pure function of its arguments: no clock, no hidden state,
// no Math.random. Works in any JS engine (canvas, DOM/HyperFrames, three.js, Node for tests).
//
// Why this exists: a film is rendered by seeking frames out of order, often in parallel pages.
// Anything that remembers the previous frame makes frames disagree. Build every value from t.

export const TAU = Math.PI * 2;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Progress of x through [a, b], clamped to 0..1. The workhorse for "this happens between a and b". */
export const prog = (x, a, b) => clamp((x - a) / (b - a));
/** Smooth pulse: 1 at c, 0 at distance >= w. */
export const bump = (x, c, w) => {
  const k = (x - c) / w;
  return Math.abs(k) >= 1 ? 0 : Math.cos((k * Math.PI) / 2) ** 2;
};
/** Shortest-path angle interpolation (radians). Use for turning characters and cameras. */
export const lerpAngle = (a, b, t) => {
  const d = ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return a + d * t;
};

// ------------------------------------------------------------------ easing
export const ease = {
  linear: (t) => t,
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outQuint: (t) => 1 - (1 - t) ** 5,
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  smoothstep: (t) => t * t * (3 - 2 * t),
  /**
   * Minimum-jerk profile (10t^3 - 15t^4 + 6t^5): how a human hand moves between two points.
   * Zero velocity and zero acceleration at both ends. Use for cursors, hands, characters turning.
   */
  minimumJerk: (t) => {
    const x = clamp(t);
    return x * x * x * (10 - 15 * x + 6 * x * x);
  },
};

// ------------------------------------------------------------------ springs
/**
 * Closed-form damped spring step response: 0 before the step, settles at 1, overshoots when
 * underdamped. t in SECONDS since the step. A pure function of time, unlike a simulated spring.
 */
export function spring(t, { stiffness = 170, damping = 18, mass = 1, velocity = 0 } = {}) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const z = damping / (2 * Math.sqrt(stiffness * mass));
  if (z < 1) {
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0 - velocity) / wd) * Math.sin(wd * t));
  }
  if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + (w0 - velocity) * t);
  const s = Math.sqrt(z * z - 1), r1 = -w0 * (z - s), r2 = -w0 * (z + s);
  const c2 = (-velocity - r1) / (r2 - r1), c1 = 1 - c2;
  return 1 - (c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t));
}

/** Spring presets named by feel. Pick by what the object is, not by taste of the day. */
export const SPRINGS = {
  snappy: { stiffness: 380, damping: 30 }, // UI chrome: fast, a hair of overshoot
  bouncy: { stiffness: 260, damping: 13 }, // pops, characters, letters landing
  gentle: { stiffness: 120, damping: 20 }, // cameras, large type
  wobbly: { stiffness: 180, damping: 8 }, // jelly, secondary motion
  grow: { stiffness: 60, damping: 9 }, // organic growth (letters growing from the ground)
};

/**
 * Keyed spring: keys = [[t, value], ...] with value a number or an array. Each key is a step the
 * spring chases; steps superpose, so a move interrupted mid-flight still looks physical.
 */
export function springKeys(t, keys, cfg = SPRINGS.gentle) {
  const isArr = Array.isArray(keys[0][1]);
  let v = isArr ? keys[0][1].slice() : keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k = spring(t - keys[i][0], cfg);
    if (k === 0) break;
    if (isArr) v = v.map((x, j) => x + (keys[i][1][j] - keys[i - 1][1][j]) * k);
    else v += (keys[i][1] - keys[i - 1][1]) * k;
  }
  return v;
}

/** Eased keyframes: [[t, value], ...], value a number or an array. */
export function keyframes(t, keys, fn = ease.inOutCubic) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, a] = keys[i - 1], [t1, b] = keys[i];
      const p = fn((t - t0) / (t1 - t0));
      return Array.isArray(a) ? a.map((x, j) => lerp(x, b[j], p)) : lerp(a, b, p);
    }
  }
  return keys[keys.length - 1][1];
}

/** Damped oscillation starting at 1 (squash-and-settle after an impact). t in seconds. */
export const wobble = (t, freq = 2.2, damp = 5) => (t < 0 ? 0 : Math.exp(-damp * t) * Math.cos(TAU * freq * t));

// ------------------------------------------------------------------ hits and zooms
/**
 * Multiplicative scale punch on a list of hit times: returns 1 between hits, briefly 1 + amp after
 * each hit, decaying with time constant dec. Use as a camera zoom on kicks: z = punch(t, kicks, 0.025).
 * Keep amp small (0.02-0.06). Energy comes from motion, not from pumping brightness.
 */
export const punch = (t, hits, amp, dec = 0.18) =>
  hits.reduce((z, h) => z * (t >= h ? 1 + amp * Math.exp(-(t - h) / dec) : 1), 1);

/**
 * Zoom in log space: scale goes from a to b at a constant perceived rate. A linear scale lerp
 * lingers when big and rushes when small; this reads as a steady dolly. p in 0..1.
 */
export const logZoom = (a, b, p) => a * (b / a) ** p;

/**
 * Infinite zoom: given a constant rate (zoom levels per second) and the scale factor between two
 * nested worlds, returns which world level is in front and its local scale. Draw `level`, `level+1`
 * (and `level+2` if visible) at scale, scale/factor, scale/factor^2: 2-3 levels on screen at once,
 * never braking to zero between them.
 */
export function infiniteZoom(t, { rate = 0.5, factor = 8, start = 0 } = {}) {
  const z = Math.max(0, (t - start) * rate);
  const level = Math.floor(z);
  return { level, scale: factor ** (z - level), depth: z };
}

// ------------------------------------------------------------------ seeded randomness
/** Seeded PRNG (mulberry32). Same seed, same sequence, every frame and every machine. */
export function mulberry32(seed) {
  let a = seed | 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Hash of an integer to 0..1. Stateless: hash01(i) is the same no matter which frame asks. */
export const hash01 = (i, seed = 1) => mulberry32((i * 374761393 + seed * 668265263) | 0)();
/** 1-D value noise in [-1, 1]. Smooth, seeded, stateless. */
export function noise1(x, seed = 1) {
  const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
  return lerp(hash01(i, seed), hash01(i + 1, seed), s) * 2 - 1;
}
/** Decaying 2-D shake offset after an impact at t0. Returns [dx, dy] in pixels. */
export function shake(t, t0, amp, { seed = 3, decay = 0.06, freq = 48 } = {}) {
  if (t < t0) return [0, 0];
  const a = amp * Math.exp(-(t - t0) / decay);
  if (a < 0.05) return [0, 0];
  return [a * noise1(t * freq, seed), a * noise1(t * freq, seed + 9)];
}

// ------------------------------------------------------------------ beat grid
/**
 * Beat grid helpers. Time every accent in beats, never in loose seconds, so picture and sound
 * cannot drift. grid = { period, offset } as in beats.json.
 */
export const beatGrid = ({ period, offset = 0 }) => ({
  toBeats: (t) => (t - offset) / period,
  toSeconds: (u) => offset + u * period,
  /** Exponential envelope that fires on every whole beat in `which(u)`; for kick-synced pulses. */
  pulse: (u, decay = 0.16, which = () => true) => {
    const b = Math.floor(u);
    return u >= 0 && which(b) ? Math.exp(-(u - b) / decay) : 0;
  },
});
