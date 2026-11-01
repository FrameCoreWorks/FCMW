// Run: npm test (from the repository root)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../core.js';
import { cursorPath } from '../cursor.js';
import * as T from '../type.js';
import * as P from '../points.js';
import { shotTrack, dollyZoomFov } from '../camera.js';
import { script, blink, wrap } from '../dialogue.js';
import { walkTrack, gait } from '../character.js';
import { irisBlades, irisOpen } from '../dom/iris.js';
import { displacementMap, glassFilter } from '../dom/glass.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('spring: 0 before the step, settles at 1, bouncy overshoots, gentle does not much', () => {
  assert.equal(C.spring(-1), 0);
  assert.equal(C.spring(0), 0);
  near(C.spring(5, C.SPRINGS.gentle), 1, 1e-3);
  let peak = 0;
  for (let t = 0; t < 2; t += 0.005) peak = Math.max(peak, C.spring(t, C.SPRINGS.bouncy));
  assert.ok(peak > 1.05, 'bouncy should overshoot');
  near(C.spring(3, { stiffness: 100, damping: 20 }), 1, 1e-3); // critically damped branch
  near(C.spring(6, { stiffness: 100, damping: 40 }), 1, 1e-3); // overdamped branch
});

test('minimum jerk: endpoints, midpoint, flat ends', () => {
  near(C.ease.minimumJerk(0), 0);
  near(C.ease.minimumJerk(1), 1);
  near(C.ease.minimumJerk(0.5), 0.5);
  assert.ok(C.ease.minimumJerk(0.02) < 0.001);
  assert.equal(C.ease.minimumJerk(2), 1);
});

test('logZoom reads as a constant-rate dolly (equal ratios per equal step)', () => {
  const r1 = C.logZoom(1, 64, 0.5) / C.logZoom(1, 64, 0.25);
  const r2 = C.logZoom(1, 64, 0.75) / C.logZoom(1, 64, 0.5);
  near(r1, r2, 1e-9);
  near(C.logZoom(2, 32, 1), 32, 1e-9);
});

test('infiniteZoom: continuous depth, scale wraps within [1, factor)', () => {
  let prev = -1;
  for (let t = 0; t < 10; t += 0.1) {
    const z = C.infiniteZoom(t, { rate: 0.7, factor: 6 });
    assert.ok(z.depth >= prev);
    assert.ok(z.scale >= 1 && z.scale < 6);
    prev = z.depth;
  }
});

test('punch is 1 before hits and decays back to 1', () => {
  assert.equal(C.punch(0.5, [1, 2], 0.05), 1);
  near(C.punch(1, [1], 0.05), 1.05);
  near(C.punch(10, [1], 0.05), 1, 1e-9);
});

test('seeded randomness is deterministic and in range', () => {
  const a = C.mulberry32(42), b = C.mulberry32(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
  for (let i = 0; i < 500; i++) {
    const h = C.hash01(i, 3);
    assert.ok(h >= 0 && h < 1);
    const n = C.noise1(i * 0.37, 2);
    assert.ok(n >= -1 && n <= 1);
  }
  assert.deepEqual(C.shake(0.5, 1, 10), [0, 0]);
});

test('keyframes and springKeys hit their keys', () => {
  const k = [[0, 0], [1, 10], [2, 20]];
  near(C.keyframes(1, k), 10);
  near(C.keyframes(5, k), 20);
  near(C.springKeys(10, [[0, 0], [1, 5]], C.SPRINGS.snappy), 5, 1e-3);
  assert.deepEqual(C.keyframes(0.5, [[0, [0, 0]], [1, [2, 4]]]).map((v) => +v.toFixed(3)), [1, 2]);
});

test('beat grid converts both ways', () => {
  const g = C.beatGrid({ period: 0.5, offset: 0.14 });
  near(g.toSeconds(g.toBeats(3.3)), 3.3);
  near(g.pulse(4, 0.16), 1);
  assert.equal(g.pulse(-0.5), 0);
});

test('cursor: arrives before the click, presses on it, and is a pure function of t', () => {
  const c = cursorPath([
    { t: 0, x: 900, y: 1500 },
    { t: 2, x: 600, y: 1000, kind: 'click' },
    { t: 3.4, x: 700, y: 1200 },
  ], { drift: 0 });
  const p = c.at(2 - 0.12);
  near(p.x, 600, 1e-6); near(p.y, 1000, 1e-6);
  assert.ok(c.at(2).press > 0.99);
  assert.ok(c.at(1.0).press < 0.01);
  assert.deepEqual(c.at(1.7), c.at(1.7));
  // the glide lasts at most 0.7 s: still at the start 0.8 s before arrival
  near(c.at(2 - 0.12 - 0.75).x, 900, 1e-6);
  assert.equal(c.ripples(2.2).length, 1);
});

test('type styles end at rest with the source characters', () => {
  const str = 'MOTION';
  for (const fn of [T.rise, T.drop, T.grow, T.scramble, T.flap]) {
    const s = fn(30, str);
    assert.equal(s.length, str.length);
    s.forEach((g, i) => {
      assert.equal(g.ch, str[i], `${fn.name} char ${i}`);
      assert.ok(Math.abs(g.dy) < 1e-3, `${fn.name} dy`);
      assert.ok(g.visible);
    });
  }
  const sc = T.scramble(0, str);
  assert.equal(sc.locked, 0);
  assert.equal(T.scramble(30, str).locked, str.length);
  const sl = T.slam(10, str);
  assert.ok(Math.abs(sl.word[0].dx) < 1e-6);
  assert.equal(sl.echoes.length, 3);
  assert.equal(T.typed(0.5, 0, 1, 'abcd'), 2);
  const cv = T.converge(5, 'HOW DOES', [[0, 3, 0], [4, 8, 0.5]]);
  assert.ok(cv.every((g) => Math.abs(g.dx) < 1e-6));
});

test('readingTime: never under 1.5 s, grows with length', () => {
  assert.equal(T.readingTime('Hi'), 1.5);
  near(T.readingTime('x'.repeat(50)), 0.7 + 0.04 * 50);
});

test('morton order and morph correspondence', () => {
  assert.ok(P.morton3(1, 0, 0) < P.morton3(0, 1, 0));
  const rnd = C.mulberry32(1);
  const A = new Float32Array(300).map(() => rnd() * 4 - 2);
  const B = new Float32Array(300).map(() => rnd() * 4 - 2);
  const sa = P.mortonSort(A), sb = P.mortonSort(B);
  assert.deepEqual([...sa.order].sort((x, y) => x - y), Array.from({ length: 100 }, (_, i) => i));
  const st = P.stagger(sb.sweep);
  const out = new Float32Array(300);
  P.morph(sa.pos, sb.pos, 0, st, out);
  out.forEach((v, i) => near(v, sa.pos[i], 1e-6));
  P.morph(sa.pos, sb.pos, 1, st, out);
  out.forEach((v, i) => near(v, sb.pos[i], 1e-6));
  assert.equal(P.resample(A, 250, 3).length, 750);
});

test('sampleMask puts points inside the mask', () => {
  const w = 100, h = 50;
  const alpha = (x, y) => (x >= 40 && x < 60 ? 1 : 0);
  const pts = P.sampleMask(alpha, w, h, 200, { size: 10 });
  assert.equal(pts.length, 600);
  for (let i = 0; i < 200; i++) assert.ok(pts[i * 3] >= -1.01 && pts[i * 3] <= 1.01);
});

test('camera shot track switches shots on t0 and eases inside', () => {
  const at = shotTrack([
    { name: 'a', t0: 0, t1: 2, from: { pos: [0, 0, 10], target: [0, 0, 0] }, to: { pos: [0, 0, 8], target: [0, 0, 0] } },
    { name: 'b', t0: 2, t1: 4, from: { pos: [5, 0, 5], target: [0, 1, 0], fov: 35 } },
  ]);
  assert.equal(at(1).name, 'a');
  near(at(1).pos[2], 9);
  assert.equal(at(2).name, 'b');
  near(at(3).fov, 35);
  near(dollyZoomFov(30, 10, 10), 30, 1e-9);
});

test('dialogue: one line at a time, readable durations, talking only while speaking', () => {
  const tl = script(({ scene, say, wait, mark }) => {
    scene('a', () => { wait(1); say('ann', 'Is this the queue for the counter?'); mark('x'); say('bob', 'Yes.'); });
  });
  assert.ok(tl.lines.every((l) => l.t1 - l.t0 >= 1.5 - 1e-9));
  for (let t = 0; t < tl.duration; t += 0.05) {
    const live = tl.lines.filter((l) => t >= l.t0 && t < l.t1);
    assert.ok(live.length <= 1);
  }
  assert.equal(tl.talking(1.1, 'ann'), 1);
  assert.equal(tl.talking(tl.lines[0].t1 - 0.01, 'ann'), 0);
  assert.ok(tl.events.x > 1);
  assert.ok(blink(0.05, 0) < 1 && blink(1, 0) === 1);
  assert.deepEqual(wrap('aa bb cc', 5, (s) => s.length), ['aa bb', 'cc']);
});

test('walk: distance-driven gait, rests at the end', () => {
  const keys = [[0, 0, 0, 0], [2, 0, 4, 0], [3, 3, 4, Math.PI / 2]];
  const end = walkTrack(10, keys);
  near(end.dist, 7);
  assert.equal(end.moving, 0);
  near(gait(10, end).legSwing, 0);
  assert.ok(walkTrack(1, keys).moving > 0.9);
});

test('iris: six blades while closing, none when open', () => {
  assert.equal(irisBlades(0, 0, 100, 20).length, 6);
  assert.equal(irisBlades(0, 0, 100, irisOpen(100) + 1).length, 0);
  assert.match(irisBlades(0, 0, 100, 20)[0].d, /^M.* Z$/);
});

test('glass displacement map: neutral in the middle, pushed at the edges', () => {
  const m = displacementMap(64, 64, 16, 16);
  const at = (x, y) => [m[(y * 64 + x) * 4], m[(y * 64 + x) * 4 + 1]];
  assert.deepEqual(at(32, 32), [128, 128]);
  assert.ok(at(1, 32)[0] < 60);
  assert.match(glassFilter('g', 'data:', 64, 64), /^<filter id="g"/);
});
