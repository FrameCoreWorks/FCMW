// Dialogue and caption timelines written as a script, timed from reading speed.
//
// Lessons behind it:
// - Durations come from text length, not from a guess: readingTime() (>= 1.5 s, ~0.7 s + 0.04 s/char).
// - One bubble at a time. Two live bubbles split attention and both go unread on a phone.
// - Mouth movement ("talking") runs only for the first part of a line, roughly the time it takes to
//   say it, then the character listens while the viewer finishes reading.
//
// Usage:
//   const tl = script(({ scene, say, wait, mark }) => {
//     scene('intro', () => { wait(1.2); say('anna', 'Is this the queue?'); mark('door'); });
//   });
//   tl.lineAt(t)   tl.scenes.intro.t0   tl.events.door   tl.duration
import { readingTime } from './type.js';

export function script(write, { gap = 0.12, reading = {} } = {}) {
  let T = 0;
  const scenes = {}, lines = [], events = {};
  const api = {
    scene(name, fn) { const t0 = T; fn(); scenes[name] = { t0, t1: T }; },
    say(who, text, o = {}) {
      const d = o.d ?? readingTime(text, reading);
      lines.push({ t0: T, t1: T + d, who, text, ...o });
      T += d + (o.gap ?? gap);
    },
    wait(d) { T += d; },
    mark(name) { events[name] = T; },
    now: () => T,
  };
  write(api);
  return {
    scenes, lines, events, duration: T,
    /** The single line on screen at t (one at a time by construction), or null. */
    lineAt: (t) => lines.find((l) => t >= l.t0 && t < l.t1) || null,
    /** 1 while `who` is speaking the line (speech length ~0.5 s + 0.03 s/char), else 0. */
    talking(t, who) {
      const l = lines.find((x) => x.who === who && t >= x.t0 && t < x.t1);
      return l && t < l.t0 + Math.min(l.t1 - l.t0, 0.5 + l.text.length * 0.03) ? 1 : 0;
    },
    inScene: (t, name) => t >= scenes[name].t0 && t < scenes[name].t1,
  };
}

/** Periodic blink amount (1 open, ~0.12 closed) with a per-character seed so the cast never blinks in sync. */
export function blink(t, seed = 1) {
  const per = 3.1 + seed * 0.37;
  const ph = (((t + seed * 1.13) % per) + per) % per;
  return ph < 0.14 ? 1 - Math.sin((Math.PI * ph) / 0.14) * 0.88 : 1;
}

/** Wrap text to lines no wider than maxW, given a measure(text) -> width function. */
export function wrap(text, maxW, measure) {
  const words = text.split(' '), out = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (measure(t) > maxW && cur) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}
