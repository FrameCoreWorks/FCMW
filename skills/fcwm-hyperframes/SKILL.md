---
name: fcwm-hyperframes
description: Build an FCWM film on the HyperFrames engine (HTML, CSS and WebGL composition rendered frame by frame to video). Use when the fcwm skill routes a job here, for 2-D type, UI and product stories, captions, layouts, slides, web-style motion, 3-D with three.js and music-driven films with a synthesized score; the FCWM default.
license: Apache-2.0
compatibility: Needs the full FCWM repository (git clone), Node 22+ and FFmpeg. HyperFrames itself runs through npx at a pinned version and downloads its own Chrome on first use; no account is needed.
metadata:
  version: "0.3.0"
---

# FCWM on HyperFrames

`<repo>` is the FCWM root (two levels above this file). A film is a folder with `index.html` (the
composition), `film.json` and `lib/fcwm/` (FCWM's motion blocks, copied in by `fcwm new`). The render
contract in `references/render-contract.md` applies; `references/adapter.md` lists what each FCWM command
runs.

## Commands

| Step | Command |
| --- | --- |
| New film | `node <repo>/scripts/fcwm.mjs new <film> [--format 9x16] [--duration 15] [--3d] [--score [--bpm 120]]` |
| Lint, layout check and contact sheet | `node <repo>/scripts/fcwm.mjs render <film> --check` |
| Stills | `node <repo>/scripts/fcwm.mjs render <film> --at 3.2,7.5` |
| Full render, preview, QA | `node <repo>/scripts/fcwm.mjs render <film>` |
| Determinism check | `node <repo>/scripts/fcwm.mjs qa <film> --determinism` |

Extra formats: `fcwm render <film> --export gif,webm,mov` (or `"exports"` in film.json). For a
transparent overlay start with `fcwm new <film> --alpha`: the ground is `transparent` and the film also
renders `mov-alpha` (ProRes 4444) or `webm-alpha`. Keep the ground transparent in such a film.

Title cards, transitions, lower thirds, word-timed captions and end cards: use `lib/fcwm/blocks.js`
(already in the film) and the `recipes/film-blocks` walkthrough instead of writing them from scratch.

Lottie or animated SVG: `fcwm new <film> --lottie [animation.lottie|.json]` plays a Lottie file seeked by
HyperFrames; SVG is animated from `renderAt(t)`. Read `references/lottie-svg.md` first.

3-D: `fcwm new <film> --3d` starts from a three.js scene (`lib/three/three.module.js`, MIT, copied in;
FCWM adds it at render time when a film imports it without carrying it). Pose the scene and call
`renderer.render()` inside `renderAt(t)`; keep `preserveDrawingBuffer: true` and pixel ratio 1, as the
starter does. DOM type sits over the canvas and can be cut, masked or moved with the 3-D objects.
three.js blocks: `lib/fcwm/three/` (point clouds, voxels), camera moves in `lib/fcwm/camera.js`.

Sound: `--score` adds `beats.json` (the beat grid, `--bpm`) and `audio/score.py`, a synthesized score
(kick and pad placeholder; voices for drums, bass, risers, impacts and pads in
`<repo>/engines/motion-reel/scripts/dsp.py`, MIT). `fcwm render` runs it (uv), then mixes whatever is in
`audio/` (`music.wav`, `sfx.wav`, `vo.wav`) to -14 LUFS / -1 dBTP and puts it under the picture. Put
hits (impacts, whooshes) on the same beats the picture cuts on; read times from `beats.json`. Do not add
an `<audio>` element for these files: FCWM's mix replaces the video's sound.

One film is one canvas size. For another aspect ratio make a second film and recompose it for that shape;
never crop.

## How to write the film

- Paint every frame in `renderAt(t)` from `t` alone, called from the `hf-seek` event the starter already
  wires up. Build DOM nodes once, then only set styles from `t`. The root keeps `data-no-timeline`.
- Use the blocks in `lib/fcwm/`: `core.js` (eases, closed-form springs, log-space zoom, seeded noise,
  beat grid), `type.js` (per-glyph entrances, reading time), `cursor.js` (natural cursor between clicks),
  `dom/iris.js` and `dom/glass.js` (camera-iris cut, liquid glass without backdrop-filter). The recipe
  `<repo>/recipes/ui-cursor-story/` is a full DOM film built this way.
- CSS transitions, `requestAnimationFrame`, timers and `Math.random` break the contract. CSS
  `@keyframes` with finite iterations are allowed (HyperFrames seeks them) but springs from `core.js`
  usually look better.
- GSAP is optional and "restricted" (GSAP Standard licence, custom terms with a no-compete clause). Use it
  only if the user agrees after hearing that; the CLI repeats the note whenever a film loads it.
- Fonts: `fcwm new` puts a neutral placeholder face (Inter, OFL) in `fonts/` as the family `Display`;
  replace the files or add the user's own with `@font-face` (a brand kit does this for you). Never rely
  on `system-ui` (it differs per machine) or on a web font fetched at render time (it can change or fail
  offline). A missing font must not stop the render (HyperFrames times out and continues, check the log).
- Charts: `lib/fcwm/chart.js` (`bars`, `niceTicks`, `countUp`, `drawOn`); the axis and labels are DOM or SVG.
- Text stays inside the safe zone: 9x16 x 6-94 %, y 10-80 %; other formats 5 % margins.
- The first frame is the thumbnail on social players: something meaningful is on screen at `t = 0`.
- Sound: `audio/music.wav`, `sfx.wav`, `vo.wav` (or `audio/score.py` that writes them) are mixed and
  mastered by `fcwm render`; `fcwm render` checks -14 LUFS / -1 dBTP.

## Review

`fcwm render <film> --check` runs HyperFrames' own check (lint, runtime errors, layout overflow, contrast)
and tiles one snapshot per beat into `render/contact_<format>_p1.png` and a half-size phone sheet. Score
them as the fcwm skill's quality gate says, fix the three weakest spots, repeat until every score is 8+.
Then `fcwm render <film>` and report the QA lines as they are.

Reading the check: it exits with code 2 and writes no sheet when text overlaps or overflows, or when text
stays off the frame (`text_off_frame`: shorten the line, make it smaller or wrap it; the starter title
shrinks to fit by itself). The full report is `render/check.json`. The message names the element by selector (give important elements an `id` so you can find them). Mark a deliberate
overlap with `data-layout-allow-overlap` on the element. `canvas_overflow` notes during a push or slide
transition are expected (the scenes are meant to be off canvas). Warnings that point at `motion.md` or
`look.md` refer to HyperFrames' own docs (`npx hyperframes@<version> docs`); the same advice is in the
`directing-motion-films` skill.
