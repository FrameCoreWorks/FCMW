---
name: fcwm-hyperframes
description: Build an FCWM film on the HyperFrames engine (HTML and CSS composition rendered frame by frame to video). Use when the fcwm skill routes a job here, for 2-D type, UI and product stories, captions, layouts, slides and web-style motion; the FCWM default for 2-D.
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
| New film | `node <repo>/scripts/fcwm.mjs new <film> [--format 9x16] [--duration 15]` |
| Lint, layout check and contact sheet | `node <repo>/scripts/fcwm.mjs render <film> --check` |
| Stills | `node <repo>/scripts/fcwm.mjs render <film> --at 3.2,7.5` |
| Full render, preview, QA | `node <repo>/scripts/fcwm.mjs render <film>` |
| Determinism check | `node <repo>/scripts/fcwm.mjs qa <film> --determinism` |

Extra formats: `fcwm render <film> --export gif,webm,mov` (or `"exports"` in film.json). For a
transparent overlay start with `fcwm new <film> --alpha`: the ground is `transparent` and the film also
renders `mov-alpha` (ProRes 4444) or `webm-alpha`. Keep the ground transparent in such a film.

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
- Fonts: put the files in `assets/` and load them with `@font-face`; a missing font must not stop the
  render (HyperFrames times out and continues, check the log).
- Text stays inside the safe zone: 9x16 x 6-94 %, y 10-80 %; other formats 5 % margins.
- The first frame is the thumbnail on social players: something meaningful is on screen at `t = 0`.
- Sound: put a mastered track in `audio/` and add it with an `<audio>` element (see
  `npx hyperframes@<version> docs data-attributes`); `fcwm render` checks -14 LUFS / -1 dBTP. A
  synthesized score can be made with `<repo>/engines/motion-reel/scripts/dsp.py`.

## Review

`fcwm render <film> --check` runs HyperFrames' own check (lint, runtime errors, layout overflow, contrast)
and tiles one snapshot per beat into `render/contact_<format>_p1.png` and a half-size phone sheet. Score
them as the fcwm skill's quality gate says, fix the three weakest spots, repeat until every score is 8+.
Then `fcwm render <film>` and report the QA lines as they are.
