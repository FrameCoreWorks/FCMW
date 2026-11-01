// A cursor that moves like a hand, not like a tween.
//
// Lesson behind it: a cursor on long, slow, linear moves reads as "stop, go, stop" and looks robotic.
// What fixed it: short minimum-jerk glides (0.38-0.7 s) on a slight arc, arriving ~0.12 s BEFORE the
// click so the eye sees it settle, a tiny hand drift while idle, and a visible press on every click.
//
// Renderer-agnostic: cursorPath() returns positions; draw them with canvas, DOM or SVG.
import { clamp, lerp, prog, ease, spring } from './core.js';

/**
 * @param {Array<{t:number,x:number,y:number,scale?:number,kind?:'click'|'drag'|'move'}>} waypoints
 *   Points where the cursor acts, in time order. kind 'click' = arrive here and click at t;
 *   'drag' = the segment ending here is a drag (follows content exactly, no arc); 'move' = just pass.
 * @param {object} o
 *   frameWidth: used to scale distances (defaults to 1080, the frame the timings were tuned on).
 *   holds: [[t0, t1], ...] press-and-hold intervals (long-press, drag).
 *   drift: idle hand drift amplitude in px at frameWidth 1080 (0 disables).
 */
export function cursorPath(waypoints, { frameWidth = 1080, holds = [], drift = 7, arrive = 0.12, leave = 0.08 } = {}) {
  const k = frameWidth / 1080;
  const W = waypoints.map((p) => ({ scale: 1, kind: 'move', ...p }));
  const clicks = W.filter((p) => p.kind === 'click').map((p) => p.t);

  function at(t) {
    let i = 0;
    while (i < W.length - 1 && W[i + 1].t <= t) i++;
    const a = W[i], b = W[Math.min(i + 1, W.length - 1)];
    let x = a.x, y = a.y, scale = a.scale;
    if (b !== a) {
      let u;
      if (b.kind === 'drag') u = ease.smoothstep(prog(t, a.t, b.t));
      else {
        const L = Math.hypot(b.x - a.x, b.y - a.y) / k;
        const t1 = b.t - (b.kind === 'click' ? arrive : 0);
        const dur = clamp(0.32 + L / 2600, 0.38, 0.7);
        const t0 = Math.max(a.t + (a.kind === 'click' ? leave : 0), t1 - dur);
        u = ease.minimumJerk(prog(t, t0, t1));
      }
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      const arc = b.kind === 'drag' ? 0 : Math.min(60 * k, L * 0.07) * Math.sin(Math.PI * u);
      x = a.x + dx * u + (-dy / L) * arc;
      y = a.y + dy * u + (dx / L) * arc;
      scale = lerp(a.scale, b.scale, u);
    }
    // idle drift: faded out around every click and during holds, so actions land exactly
    let A = 1;
    for (const c of clicks) A = Math.min(A, clamp((Math.abs(t - c) - 0.08) / 0.35));
    for (const [p, q] of holds) A = Math.min(A, clamp((Math.max(p - t, t - q, 0) - 0.08) / 0.35));
    A = ease.smoothstep(A) * drift * k / 7;
    x += A * (7 * Math.sin(t * 1.1) + 4 * Math.sin(t * 2.3 + 1.3));
    y += A * (6 * Math.sin(t * 0.9 + 2) + 3 * Math.sin(t * 1.9));
    // press: a short dip on each click, a held dip during holds
    let press = 0;
    for (const c of clicks) press = Math.max(press, Math.exp(-(((t - c) / 0.075) ** 2)));
    const HOLD = { stiffness: 900, damping: 48 };
    for (const [p, q] of holds) press = Math.max(press, spring(t - p + 0.05, HOLD) - spring(t - q, HOLD));
    return { x, y, scale: scale * (1 - 0.2 * press), press };
  }

  /** Click ripples alive at time t: [{x, y, k}] with k 0..1 through the ripple's 0.42 s life. */
  function ripples(t, life = 0.42) {
    const out = [];
    for (const c of [...clicks, ...holds.map((h) => h[0])]) {
      if (t < c - 0.01 || t > c + life) continue;
      const p = at(c);
      out.push({ x: p.x, y: p.y, k: prog(t, c, c + life) });
    }
    return out;
  }

  return { at, ripples, clicks };
}
