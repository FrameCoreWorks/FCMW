// Chart blocks: bars that grow, axis ticks on round numbers, lines that draw on.
// Pure functions of time (seconds) that return numbers; the film draws the bars (DOM, SVG or canvas).
// Data honesty on a still frame: a value label always shows the bar's final value and appears only as
// its bar lands, so no frame shows a wrong number. A count-up, when wanted, uses countUp() with the
// same progress as the bar height, so the number and the bar agree on every frame.
//
//   import { bars, niceTicks } from './lib/fcwm/chart.js';
//   const axis = niceTicks(Math.max(...values));           // { max: 10, ticks: [0, 2.5, 5, 7.5, 10] }
//   bars(t, values, { start: 0.4, max: axis.max }).forEach((b, i) => {
//     el[i].style.transform = `scaleY(${b.height})`; label[i].style.opacity = b.label;
//   });
import { clamp, prog, ease } from './core.js';

// One state per value: { value, height 0..1 of max, grow 0..1, label 0..1 opacity, landed }.
// Bars start one after another (`stagger` seconds apart), each growing for `dur` seconds without
// overshoot (an overshoot reads as a wrong value). `order` changes which bar starts first.
export function bars(t, values, { start = 0, stagger = 0.15, dur = 0.7, max, order } = {}) {
  const top = max ?? Math.max(...values.map(Math.abs), 1e-9);
  const rank = order ? Object.fromEntries(order.map((i, k) => [i, k])) : null;
  return values.map((value, i) => {
    const s = start + (rank ? rank[i] : i) * stagger;
    const grow = ease.outCubic(prog(t, s, s + dur));
    return { value, grow, height: clamp(Math.abs(value) / top) * grow,
      label: ease.outCubic(prog(t, s + dur, s + dur + 0.2)), landed: grow >= 1 };
  });
}

// Round axis ticks: the smallest "nice" maximum >= max split into about `count` steps (1, 2, 2.5, 5 x 10^n).
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return { max: 1, step: 1, ticks: [0, 1] };
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw - 1e-12);
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(+v.toFixed(10));
  return { max: top, step, ticks };
}

// A number counted with the bar's own progress (grow from bars()), so the label matches the bar.
export const countUp = (grow, value, decimals = 0) => (value * clamp(grow)).toFixed(decimals);

// Line or outline drawn on from `start` over `dur`: returns the visible fraction 0..1.
// SVG: path.style.strokeDasharray = len; path.style.strokeDashoffset = len * (1 - drawOn(t, 1, 1.5)).
export const drawOn = (t, start, dur, fn = ease.inOutCubic) => fn(prog(t, start, start + dur));
