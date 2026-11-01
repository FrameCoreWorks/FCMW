// Kinetic type: per-glyph entrance styles as pure data.
//
// Each style returns one state per glyph for local time l (seconds since the word's entrance).
// The renderer (canvas, DOM, SVG, three.js) measures glyph rest positions and applies the state:
//   x = restX + dx * size, y = baseline + dy * size, scale (sx, sy) about the baseline centre,
//   rotate rot (radians), skew (horizontal shear), alpha, and draw `ch` (may differ from the source
//   character while it scrambles or flaps). `clip: true` means: clip the glyph to above its baseline,
//   so it rises out of an invisible slot instead of fading in.
//
// Lesson behind it: "letters look like a draft" came from bare fills, centred, with a simple
// fade or pop. Every style here gives each letter its own timing, weight and a reason to move,
// and none of them fades the whole word in at once. The look (font, colour, material) stays yours.
import { lerp, prog, ease, spring, SPRINGS, wobble, hash01, TAU } from './core.js';

const base = (ch, i) => ({ i, ch, dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, skew: 0, alpha: 1, visible: true, clip: false });
const chars = (str) => [...str];

/** Rise out of the baseline, letter by letter (slow, wide: luxury, editorial). */
export function rise(l, str, { stagger = 0.13, dur = 0.85, delay = 0.25 } = {}) {
  return chars(str).map((ch, i) => {
    const s = base(ch, i);
    const p = ease.outQuint(prog(l, delay + stagger * i, delay + stagger * i + dur));
    s.visible = p > 0;
    s.dy = (1 - p) * 0.8;
    s.clip = true;
    return s;
  });
}

/** Left-to-right wipe progress for a fill or a colour change sweeping across a word. */
export const wipe = (l, a, b) => ease.inOutCubic(prog(l, a, b));

/** Tracking that tightens as the word settles: returns extra letter-spacing in em. */
export const settleTracking = (l, from = 0.36, to = 0.2, dur = 3) => lerp(from, to, ease.outCubic(prog(l, 0, dur)));

/**
 * Scramble then resolve (technical, digital): each glyph cycles through junk characters until its
 * resolve time, then locks. Returns states plus `locked` (how many glyphs are final), for a caret.
 */
export function scramble(l, str, { start = 0.15, step = 0.2, rate = 8, junk = '01<>/#%[]=+XZ7', seed = 11 } = {}) {
  const tick = Math.floor(l * rate);
  const out = chars(str).map((c0, i) => {
    const s = base(c0, i);
    const res = start + step * i;
    s.visible = l >= res - 0.3;
    if (l < res && c0 !== ' ') s.ch = junk[Math.floor(hash01(tick * 7 + i, seed) * junk.length)];
    return s;
  });
  out.locked = out.filter((_, i) => l >= start + step * i).length;
  return out;
}

/** Glitch slices for a scramble: n horizontal strips with seeded x-offsets (em), changing at `rate`. */
export function glitchStrips(l, { n = 9, amount = 0.5, rate = 16, seed = 3 } = {}) {
  const tick = Math.floor(l * rate);
  return Array.from({ length: n }, (_, k) => ({ k, top: k / n, height: 1 / n, dx: (hash01(tick * 13 + k, seed) - 0.5) * amount }));
}

/** Drop from above, squash on landing, settle with a wobble (playful). */
export function drop(l, str, { step = 0.25, fall = 0.22, height = 4 } = {}) {
  return chars(str).map((ch, i) => {
    const s = base(ch, i);
    const d = step * i;
    s.visible = l >= d - fall;
    if (l < d) {
      const p = prog(l, d - fall, d) ** 2;
      s.dy = -(1 - p) * height;
      s.sy = 1 + 0.25 * p;
      s.sx = 1 - 0.12 * p;
    } else {
      const q = 0.32 * wobble(l - d, 4.8, 12);
      s.sx = 1 + q;
      s.sy = 1 - q;
    }
    return s;
  });
}

/** Continuous hop for a word at rest: alternate letters bounce with squash on the ground. */
export function hop(l, str, { rate = 2, height = 0.26, lag = 0.18, ramp = 0.3 } = {}) {
  const r = ease.outCubic(prog(l, 0, ramp));
  return chars(str).map((ch, i) => {
    const s = base(ch, i);
    const ph = l * rate - i * lag;
    const h = Math.abs(Math.sin(Math.PI * ph)) * r;
    const ground = (1 - h) ** 6 * r;
    s.dy = -h * height;
    s.sx = 1 + 0.16 * ground;
    s.sy = 1 - 0.16 * ground;
    s.rot = Math.sin(Math.PI * ph) * 0.12 * r * (i % 2 ? 1 : -1);
    return s;
  });
}

/**
 * Slam in from the side with trailing echoes (sport, energy). Returns { word, echoes }: word is the
 * glyph list, echoes = [{dx, alpha}] copies to draw behind it in an accent colour.
 * width = frame width in em (how far off-screen the word starts). Hits = times of kicks that push
 * the echoes out again.
 */
export function slam(l, str, { width = 8, skew = 0.3, hits = [0], echoAlpha = [0.55, 0.28, 0.12] } = {}) {
  const x = (t) => (1 - ease.outExpo(prog(t, -0.14, 0.06))) * width;
  const kick = hits.reduce((a, h) => a + (l >= h ? Math.exp(-(l - h) / 0.15) : 0), 0);
  const word = chars(str).map((ch, i) => ({ ...base(ch, i), dx: x(l), skew }));
  const echoes = echoAlpha.map((alpha, j) => ({ dx: x(l - 0.03 * (j + 1)) + (j + 1) * (0.2 + 0.22 * Math.min(kick, 1.5)), alpha, skew }));
  return { word, echoes };
}

/** Grow from the ground on a soft spring and sway (organic, wellness). */
export function grow(l, str, { step = 0.15, cfg = SPRINGS.grow, sway = 0.07 } = {}) {
  return chars(str).map((ch, i) => {
    const s = base(ch, i);
    const t0 = step * i - 0.06;
    s.visible = l >= t0;
    const g = spring(l - t0, cfg);
    const br = 1 + 0.03 * Math.sin(TAU * l * 0.5 + i);
    s.sx = lerp(0.6, 1, Math.min(g, 1.2)) * br;
    s.sy = g * br;
    s.rot = Math.sin(TAU * l * 0.64 + i * 0.8) * sway * ease.outCubic(prog(l, t0, t0 + 0.75));
    return s;
  });
}

/**
 * Split-flap board (finance, travel): each tile flips through characters until its set time.
 * flip = 0..1 phase of the top flap falling (draw the previous char on the falling half).
 */
export function flap(l, str, { start = 0.25, step = 0.11, rate = 12, set = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', seed = 31 } = {}) {
  const tick = Math.floor(l * rate);
  return chars(str).map((c0, i) => {
    const s = base(c0, i);
    const until = start + step * i;
    s.appear = prog(l, 0.02 * i - 0.12, 0.02 * i - 0.02);
    s.visible = s.appear > 0;
    s.flipping = l < until;
    s.flip = s.flipping ? (l * rate) % 1 : 1;
    if (s.flipping) {
      s.ch = set[Math.floor(hash01(tick * 5 + i, seed) * set.length)];
      s.prev = set[Math.floor(hash01((tick - 1) * 5 + i, seed) * set.length)];
    }
    return s;
  });
}

/** Typewriter: number of characters shown between a and b. */
export const typed = (l, a, b, str) => Math.ceil(prog(l, a, b) * [...str].length);

/**
 * Two-sided converge (hook lines): words of a line fly in from opposite sides and lock on their beat.
 * groups: [[startIndex, endIndex, time], ...]; even groups come from the left, odd from the right.
 */
export function converge(l, str, groups, { distance = 6, lead = 0.06, land = 0.1 } = {}) {
  return chars(str).map((ch, i) => {
    const s = base(ch, i);
    const gi = groups.findIndex(([a, b]) => i >= a && i < b);
    if (gi < 0) return s;
    const t0 = groups[gi][2];
    const p = ease.outExpo(prog(l, t0 - lead, t0 + land));
    s.visible = l >= t0 - lead;
    s.dx = (gi % 2 ? 1 : -1) * (1 - p) * distance;
    return s;
  });
}

/**
 * Reading time for on-screen text (captions, speech bubbles), in seconds.
 * Lesson: 0.45 s + 0.03 s/char read as "changes too fast". Use at least 1.5 s, ~0.7 s + 0.04 s/char,
 * and show one bubble at a time.
 */
export const readingTime = (text, { min = 1.5, base: b = 0.7, perChar = 0.04 } = {}) => Math.max(min, b + perChar * [...text].length);
