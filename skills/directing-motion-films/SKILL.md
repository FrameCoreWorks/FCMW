---
name: directing-motion-films
description: Use when making any motion graphics film from code (promo, reel, explainer, lyric video, logo animation, social cut, 2-D or 3-D), from the first idea through the final render, in any engine, and whenever a film looks like a sketch, a template, or "made by AI".
---

# Directing motion films

## Overview

The render runs no model: the machine replays your code frame by frame. All quality is in the code
and in the order of work. This is the method that produced finished films, written down so any model
can follow it. Direction (brand, palette, tone) always comes from the user; this skill is the craft.

Files referenced below live in the plugin root: `knowledge/` (lessons, checklist, critique rubric),
`lib/` (tested motion building blocks), `recipes/` (four annotated films).

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
5. **Quality loop, three rounds minimum.** Contact sheet (one frame per beat), the same sheet at
   phone size, strips across transitions. Score with `knowledge/critique.md`; fix the worst three;
   repeat until every category is >= 8 and round >= 3.
6. **Render, check, deliver.** -14 LUFS / -1 dBTP, constant fps, duration, a frame pulled from the
   encoded file, determinism (same frame twice = same image). Run `knowledge/checklist.md`.

## Quick reference: block for the job

| Need | Block |
| --- | --- |
| Springs, eases, minimum-jerk, log zoom, camera punch, seeded noise | `lib/core.js` |
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
| Empty bottom in 9:16 | Compose each format for its shape |
| Captions too fast | `readingTime` (>= 1.5 s), one at a time |
| Flicker between faces | Offset decals, audit coplanar faces |
| A whoosh on every move | Sound energy matches the film |

Full table and rhythm rules: `knowledge/lessons.md`. Worked examples: `recipes/`.
