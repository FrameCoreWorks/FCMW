# FCWM lib: what each block takes and returns

Every block is a pure function of time. `fcwm new` copies `lib/` into each film as `lib/fcwm/`
(HyperFrames and motion-reel), so a film imports `./lib/fcwm/<file>.js`. In the FCWM repository the
same files are `lib/<file>.js`. Times are seconds unless a line says beats; `l` means local time
(seconds since the element's own start), so pass `t - start`.

## core.js: math, easing, springs, noise, beat grid

| Export | Signature | Returns |
| --- | --- | --- |
| `clamp`, `lerp` | `clamp(x, a=0, b=1)`, `lerp(a, b, p)` | number |
| `prog` | `prog(t, a, b)` | 0..1 progress of t between a and b, clamped |
| `bump` | `bump(x, centre, width)` | 0..1..0 hump |
| `ease.*` | `linear, inCubic, outCubic, inOutCubic, outQuint, outExpo, inExpo, inOutSine, smoothstep, minimumJerk` | eased 0..1 from 0..1 |
| `spring` | `spring(t, {stiffness=170, damping=18, mass=1, velocity=0})` | 0 before t=0, settles at 1 (overshoots when underdamped) |
| `SPRINGS` | `snappy, bouncy, gentle, wobbly, grow` | configs for `spring` |
| `springKeys` | `springKeys(t, [[t0, value], ...], cfg)` | value (number or array) chasing each key |
| `keyframes` | `keyframes(t, [[t0, value], ...], easing)` | eased value between keys |
| `wobble` | `wobble(t, freq=2.2, damp=5)` | decaying oscillation, 0 before t=0 |
| `punch` | `punch(t, hitTimes, amp, decay=0.18)` | scale offset on hits (use 0.02 to 0.06) |
| `logZoom`, `infiniteZoom` | `logZoom(a, b, p)`; `infiniteZoom(t, {rate, factor, start})` | zoom that moves evenly in log space |
| `mulberry32`, `hash01`, `noise1` | `mulberry32(seed)()`, `hash01(i, seed)`, `noise1(x, seed)` | seeded random and noise (never `Math.random`) |
| `shake` | `shake(t, t0, amp, {seed, decay, freq})` | `[dx, dy]` |
| `beatGrid` | `beatGrid({period, offset})` | `{ toBeats(t), toSeconds(u), pulse(u, decay, which) }` |

## type.js: kinetic type, one state per glyph

Styles: `rise`, `drop`, `hop`, `slam`, `grow`, `flap`, `scramble`, `converge(l, str, groups)`. Each is
`style(l, str, opts)` and returns `[{ i, ch, dx, dy, sx, sy, rot, skew, alpha, visible, clip }]` per
glyph: offsets are in units of the font size, `clip: true` means clip to above the baseline. Helpers:
`wipe(l, a, b)`, `settleTracking(l)`, `typed(l, a, b, str)` (characters shown), `readingTime(text)`
(seconds a line needs on screen, at least 1.5).

A word that lands on a beat: most styles start each glyph after a `delay` and `stagger`, so pass
`l = t - (beatTime - landing)` where `landing` is when the last glyph settles, for example
`delay + stagger * (letters - 1) + dur * 0.6` for `rise`; or set `delay: 0` and a short `stagger` so
the word reads on the beat itself.

## blocks.js: transitions, title card, lower third, captions, end card

States are `{ opacity, x, y, scale, clip, visible }`; `css(state)` turns one into a CSS string.

| Export | Signature | Returns |
| --- | --- | --- |
| `transition` | `transition(t, at, {kind, dur=0.6, direction=1})`, kind `cut, fade, dip, wipe, push, slide, zoom, iris`; `at` is the middle | `{ out, in, p }` |
| `titleCard` | `titleCard(t, {start, hold=3, leave=0.4, stagger})` | `{ title, rule: {width}, subtitle, on }` |
| `lowerThird` | `lowerThird(t, {start, hold=3, inDur, outDur})` | `{ bar: {width}, name, role, on }` |
| `captionLines` | `captionLines([{w, start, end}], {maxChars=32, gap=0.6})` | lines for `caption` |
| `caption` | `caption(t, lines, {fade, linger})` | `{ line, text, opacity, words: [{w, past, active, pop}] }` or null |
| `endCard` | `endCard(t, {start, lineDelay=0.4})` | `{ logo, line, on }` |

## chart.js: bars, ticks, lines

| Export | Signature | Returns |
| --- | --- | --- |
| `bars` | `bars(t, values, {start, stagger=0.15, dur=0.7, max, order})` | `[{ value, height 0..1, grow, label 0..1, landed }]` |
| `niceTicks` | `niceTicks(max, count=4)` | `{ max, step, ticks }` on round numbers |
| `countUp` | `countUp(grow, value, decimals)` | the number that matches the bar's height |
| `drawOn` | `drawOn(t, start, dur)` | 0..1 visible fraction of a line (SVG dash offset) |

Labels show the final value and appear as the bar lands, so a still never shows a wrong number.

## The rest

| File | Main exports |
| --- | --- |
| `cursor.js` | `cursorPath(waypoints, {frameWidth, holds, drift, arrive, leave})` returns `{ at(t) -> {x, y, scale, press}, ripples, clicks }` |
| `dialogue.js` | `script(({scene, say, wait, mark}) => ..., {gap, reading})` returns `{ lineAt(t), scenes, events, duration }`, `blink(t, seed)`, `wrap(text, maxW, measure)` |
| `camera.js` | `shotTrack(shots, {easing, fov, aperture})`, `dollyZoomFov(fov0, d0, d)`, `camera2d({x, y, z, r})` |
| `points.js` | `resample`, `sampleMask`, `mortonSort`, `stagger`, `morph(A, B, p, st, out, opts)` (point-cloud morphs) |
| `character.js` | `walkTrack(t, keys)`, `gait(t, st, opts)`, `faceToward(...)` |
| `dom/iris.js`, `dom/glass.js` | `irisBlades`, `irisOpen`; `ensureGlassFilter`, `displacementMap` |
| `three/points-material.js`, `three/voxel.js` | `pointsMaterial(THREE, opts)`, `voxelBuilder(THREE, opts)` |

Read a file's header comment for the full options; every export has a test in `lib/test/`.
