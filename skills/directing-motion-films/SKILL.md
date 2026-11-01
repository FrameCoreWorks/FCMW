---
name: directing-motion-films
description: Use when making any motion graphics film from code (promo, reel, explainer, lyric video, logo animation, social cut, 2-D or 3-D), from the first idea through the final render, in any engine, and whenever a film looks like a sketch, a template, or "made by AI".
---

# Directing motion films

## Overview

The render runs no model: the machine replays your code frame by frame. All quality is in the code
and in the order of work. This is the method that produced finished films, written down so any model
can follow it. Direction (brand, palette, tone) always comes from the user; this skill is the craft.

The lessons, checklist, critique rubric and render contract are copied into this skill's `references/`
(`lessons.md`, `checklist.md`, `critique.md`, `render-contract.md`). Paths below starting with
`knowledge/` mean those copies. `lib/` (tested motion building blocks) and `recipes/` (four annotated
films) live in the FCWM repository root, two levels above this file.

## The method

1. **Idea in one sentence.** What transforms into what, and why it is worth watching. Prefer the
   medium as the story mechanic (dots that become the products) over decoration.
2. **Beat grid first.** Measure the supplied track or synthesize the score; save `beats.json`
   (`period`, `offset`, `beats`). Time every accent in beats with `lib/core.js` `beatGrid`.
3. **Shot list on the grid**, one row per shot: beats, image, motion, transition, sound, per-format
   notes. In full-process mode, stop and get the user's OK. In quick mode, continue.
4. **Build.** One pure function of time (`seek(t)` paints frame t). Build geometry, samples and
   layouts once at load; each frame only reads them. Seeded noise only. Compose from `lib/` blocks
   instead of writing motion math from scratch. List every accent once as a hit `[beat, label, sfx]`
   so sound is generated from the same data as picture.
5. **Quality loop.** Contact sheet (one frame per beat), the same sheet at phone size, strips across
   transitions. Score with `knowledge/critique.md`; fix the worst three; repeat until every category is
   >= 8. Full process: at least three rounds, each shown to the user. Quick mode: as many rounds as it
   takes (they are yours, not the user's), then one review with the user at the end. A silent film
   leaves sound sync out of the scores; without `beats.json` its contact sheet steps every 0.5 s.
6. **Render, check, deliver.** -14 LUFS / -1 dBTP, constant fps, duration, a frame pulled from the
   encoded file, determinism (same frame twice = same image). Run `knowledge/checklist.md`.

## Quick reference: block for the job

| Need | Block |
| --- | --- |
| Signatures and return values of every block below | `references/lib-api.md` |
| Springs, eases, minimum-jerk, log zoom, camera punch, seeded noise | `lib/core.js` |
| Transitions, title card, lower third, word-timed captions, end card | `lib/blocks.js` |
| Bar charts, round axis ticks, lines that draw on, honest value labels | `lib/chart.js` |
| Kinetic type (rise, scramble, drop, hop, slam, grow, flap, converge), reading time | `lib/type.js` |
| A cursor that moves like a hand, click press, ripples | `lib/cursor.js` |
| Point clouds morphing shape to shape | `lib/points.js` + `lib/three/points-material.js` |
| Shot list as data, dolly zoom | `lib/camera.js` |
| Dialogue/captions timed by reading speed, blinks | `lib/dialogue.js` |
| Walk cycles and idle life | `lib/character.js` |
| Voxel sets and characters | `lib/three/voxel.js` |
| Camera iris, liquid glass (DOM/SVG) | `lib/dom/iris.js`, `lib/dom/glass.js` |

## Common mistakes (each was a real rejection)

| Looks like | Fix |
| --- | --- |
| Flat 3-D, cards on walls, top-down | Solids at an angle, key + rim light, depth of field |
| Letters "like a draft" | Per-letter timing and a style from `lib/type.js`; light, shadow, kerning |
| Same layout every scene | A new composition per scene |
| Zoom brakes every bar | `logZoom` / `infiniteZoom`, 2-3 levels visible |
| Brightness pumping on kicks | Steady exposure; `punch` scale of 2-6 % instead |
| Camera inside a particle cloud | Stream on an arc, camera outside |
| Robotic cursor | `cursorPath`: short glides, arrive 0.12 s early |
| Empty bottom in 9:16 | Compose each format for its shape: the subject fills the middle band (about 30-70 % of the height) and at least 70 % of the width; type that would fit a 16:9 frame is too small for 9:16 |
| Empty or half-built first frame | Frame 0 is the thumbnail: the title or subject is already readable at t = 0 (start entrances a few tenths of a second before 0, as `recipes/film-blocks` does) |
| No hook | The first second shows the film's strongest image or claim (the payoff, a bold word, a striking shape), not a logo, a dot or a slow build |
| A slideshow: still text that fades between scenes | Something moves every second (type, camera, a shape, light); cuts and entrances on the beat; QA `motion` fails a still stretch of 1.5 s |
| Silent social film | Music and hits on the cuts (`fcwm new --score`) unless the brief says silent |
| A still shows a wrong number | Value labels show the final value and appear as the bar lands (`lib/chart.js`); a count-up uses the bar's own progress |
| Ghost words overlapping | The outgoing element is gone (or clipped) before the incoming one reaches the same spot |
| A repeated section looks copy-pasted | Each repeat gets a new composition or entrance; same words, new picture |
| Captions too fast | `readingTime` (>= 1.5 s), one at a time |
| Flicker between faces | Offset decals, audit coplanar faces |
| A whoosh on every move | Sound energy matches the film |

Full table and rhythm rules: `knowledge/lessons.md`. Worked examples: `recipes/`.
