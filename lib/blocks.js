// Film building blocks: transitions, title cards, lower thirds, captions and end cards.
// Pure functions of time (seconds) that return plain states; `css(state)` turns a state into a CSS
// string for DOM/SVG films (HyperFrames), and canvas or three.js films read the numbers directly.
// No colours, fonts or words are baked in: the film styles the elements, these blocks only move them.
//
//   import { transition, css } from './lib/fcwm/blocks.js';
//   const { out, in: inn } = transition(t, 4.0, { kind: 'wipe', dur: 0.6 });
//   sceneA.style.cssText = css(out);  sceneB.style.cssText = css(inn);
import { clamp, lerp, prog, ease, spring, SPRINGS } from './core.js';

// A state: { opacity, x, y (px or % string), scale, clip (CSS clip-path), visible }
const SHOWN = { opacity: 1, x: 0, y: 0, scale: 1, clip: 'none', visible: true };
const HIDDEN = { ...SHOWN, opacity: 0, visible: false };
const unit = (v) => (typeof v === 'number' ? `${v.toFixed(2)}px` : v);

export function css(s) {
  const parts = [`opacity:${(+s.opacity).toFixed(4)}`, `visibility:${s.visible === false ? 'hidden' : 'visible'}`];
  const tf = [];
  if (s.x || s.y) tf.push(`translate(${unit(s.x || 0)},${unit(s.y || 0)})`);
  if (s.scale !== undefined && s.scale !== 1) tf.push(`scale(${(+s.scale).toFixed(4)})`);
  parts.push(`transform:${tf.length ? tf.join(' ') : 'none'}`);
  parts.push(`clip-path:${s.clip || 'none'}`);
  return parts.join(';');
}

// Scene change at time `at` (the cut point is the middle of the transition), `dur` seconds long.
// kinds: cut, fade, dip (through the ground), wipe (left to right), push (both move), slide (new
// scene covers), zoom (old scales up and fades, new settles in), iris (circle opens from the centre).
// Returns { out, in } states for the outgoing and incoming scene, and p, the eased progress 0..1.
export function transition(t, at, { kind = 'fade', dur = 0.6, direction = 1 } = {}) {
  const p = kind === 'cut' ? (t < at ? 0 : 1) : ease.inOutCubic(prog(t, at - dur / 2, at + dur / 2));
  const done = p >= 1, before = p <= 0;
  const out = done ? { ...HIDDEN } : { ...SHOWN };
  const inn = before ? { ...HIDDEN } : { ...SHOWN };
  const d = direction >= 0 ? 1 : -1;
  switch (kind) {
    case 'cut': break;
    case 'fade': if (!before) inn.opacity = p; break;  // the new scene fades in over the old one
    case 'dip': if (!done) out.opacity = clamp(1 - 2 * p); if (!before) inn.opacity = clamp(2 * p - 1); break;
    case 'wipe': if (!before) inn.clip = d > 0 ? `inset(0 ${((1 - p) * 100).toFixed(3)}% 0 0)` : `inset(0 0 0 ${((1 - p) * 100).toFixed(3)}%)`; break;
    case 'push': if (!done) out.x = `${(-d * p * 100).toFixed(3)}%`; if (!before) inn.x = `${(d * (1 - p) * 100).toFixed(3)}%`; break;
    case 'slide': if (!before) inn.x = `${(d * (1 - p) * 100).toFixed(3)}%`; break;
    case 'zoom':
      if (!done) { out.scale = lerp(1, 1.25, p); out.opacity = clamp(1 - 1.6 * p); }
      if (!before) { inn.scale = lerp(0.92, 1, p); inn.opacity = clamp(p * 1.6 - 0.6); }
      break;
    case 'iris': if (!before) inn.clip = `circle(${(p * 75).toFixed(3)}% at 50% 50%)`; break;
    default: throw new Error(`transition: unknown kind "${kind}"`);
  }
  if (out.opacity <= 0) out.visible = false;
  if (inn.opacity <= 0) inn.visible = false;
  return { out, in: inn, p };
}

// Title card: title rises in with a spring, a rule draws under it, a subtitle follows, all leave together.
// Returns { title, rule: {..., width 0..1}, subtitle, on } with `on` false outside [start, start+hold].
export function titleCard(t, { start = 0, hold = 3, leave = 0.4, stagger = 0.18, cfg = SPRINGS.gentle } = {}) {
  const l = t - start;
  const end = hold;
  const exit = ease.inCubic(prog(l, end - leave, end));
  const enter = (delay) => clamp(spring(l - delay, cfg), 0, 1.2);
  const part = (delay, rise = 40) => {
    const e = enter(delay);
    return { ...SHOWN, opacity: clamp(e) * (1 - exit), y: (1 - e) * rise - exit * 20, visible: l >= delay && l < end };
  };
  return {
    title: part(0),
    rule: { ...part(stagger, 0), width: ease.outCubic(prog(l, stagger, stagger + 0.7)) * (1 - exit) },
    subtitle: part(stagger * 2, 24),
    on: l >= 0 && l < end,
  };
}

// Lower third: a bar extends, then name and role slide out of it; reverses on the way out.
// Returns { bar: {width 0..1}, name, role, on }. Hold is the time fully on screen.
export function lowerThird(t, { start = 0, hold = 3, inDur = 0.6, outDur = 0.4 } = {}) {
  const l = t - start;
  const total = inDur + hold + outDur;
  const inP = ease.outCubic(prog(l, 0, inDur));
  const outP = ease.inCubic(prog(l, inDur + hold, total));
  const on = l >= 0 && l < total;
  const text = (delay) => {
    const e = ease.outCubic(prog(l, delay, delay + inDur * 0.8));
    return { ...SHOWN, opacity: e * (1 - outP), x: (1 - e) * -30, clip: `inset(0 ${((1 - e) * 100).toFixed(3)}% 0 0)`, visible: on && l >= delay };
  };
  return { bar: { ...SHOWN, width: inP * (1 - outP), visible: on }, name: text(inDur * 0.3), role: text(inDur * 0.5), on };
}

// Captions from timed words, e.g. a speech-to-text transcript: [{ w: 'Hello', start: 0.1, end: 0.4 }, ...].
// Words are grouped into lines of at most maxChars (and a gap of more than `gap` seconds starts a new
// line); the line on screen at t is returned with each word's state for karaoke-style highlighting.
export function captionLines(words, { maxChars = 32, gap = 0.6 } = {}) {
  const lines = [];
  let cur = null;
  for (const w of words) {
    const len = cur ? cur.text.length + 1 + w.w.length : w.w.length;
    if (!cur || len > maxChars || w.start - cur.end > gap) {
      cur = { words: [], text: '', start: w.start, end: w.end };
      lines.push(cur);
    }
    cur.words.push(w);
    cur.text = cur.text ? `${cur.text} ${w.w}` : w.w;
    cur.end = w.end;
  }
  return lines;
}

export function caption(t, lines, { fade = 0.12, linger = 0.3 } = {}) {
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const next = lines[i + 1];
    const until = Math.min(L.end + linger, next ? next.start : Infinity);
    if (t < L.start - fade || t >= until) continue;
    const opacity = clamp((t - (L.start - fade)) / fade) * clamp((until - t) / fade);
    return {
      line: i, text: L.text, opacity,
      words: L.words.map((w) => ({ w: w.w, past: t >= w.end, active: t >= w.start && t < w.end,
        pop: spring(t - w.start, { stiffness: 420, damping: 16 }) })),  // 0 to 1 with a small overshoot
    };
  }
  return null;
}

// End card: logo settles in with a spring, then one line of text fades up under it.
export function endCard(t, { start = 0, cfg = SPRINGS.gentle, lineDelay = 0.4 } = {}) {
  const l = t - start;
  const s = clamp(spring(l, cfg), 0, 1.2);
  const lineE = ease.outCubic(prog(l, lineDelay, lineDelay + 0.5));
  return {
    logo: { ...SHOWN, opacity: clamp(l / 0.25), scale: lerp(0.86, 1, s), visible: l >= 0 },
    line: { ...SHOWN, opacity: lineE, y: (1 - lineE) * 16, visible: l >= lineDelay },
    on: l >= 0,
  };
}
