---
name: fcwm-motion-reel
description: Build an FCWM film on the motion-reel engine (canvas film as a pure function of time, 2-D and three.js 3-D, synthesized score and sound effects, frame-exact render). Use when the fcwm skill routes a job here, for 3-D scenes, point clouds, voxel characters, generative motion, a synthesized score, or a music or lyric video on the user's own track.
license: Apache-2.0 (engine code MIT, Aries Spring)
compatibility: Needs the full FCWM repository (git clone), Node 22+, FFmpeg, Playwright with Chromium (npm install && npx playwright install chromium in the FCWM folder) and uv for Python audio scripts. A GPU is strongly recommended for 3-D.
metadata:
  version: "0.3.3"
---

# FCWM on motion-reel

A film is a folder `<film>/` holding a canvas film whose every frame is `window.seek(t)`. `<repo>` is the
FCWM root (two levels above this file); the engine lives in `<repo>/engines/motion-reel/` (`<engine>`).
Run commands from the folder that holds the films. The render contract is in
`references/render-contract.md` and applies throughout.

```
<film>/film.json   title, duration, formats (first = primary), poster, engine: "motion-reel", allowBlank
<film>/index.html  fonts + canvas;  film.js  the film;  lib/motion.js  harness + springs
<film>/beats.json  the grid everything is timed on (fcwm new writes a steady 120 BPM grid)
<film>/audio/      score.py (optional), music.wav, sfx.wav, mix.wav
<film>/render/     delivered files: <film>-<format>.mp4, contact sheets, qa.json (<film>-preview.mp4 with --preview)
```

## Commands

| Step | Command |
| --- | --- |
| New film | `node <repo>/scripts/fcwm.mjs new <film> --engine motion-reel [--3d \| --pathtrace] [--format 9x16,16x9] [--duration 15] [--bpm 120]` |
| Contact sheet, one frame per beat | `node <repo>/scripts/fcwm.mjs render <film> --check` |
| Stills | `node <repo>/scripts/fcwm.mjs render <film> --at 3.2,7.5` |
| Full render, mix and QA (`--preview` adds a phone preview) | `node <repo>/scripts/fcwm.mjs render <film>` |
| Determinism check | `node <repo>/scripts/fcwm.mjs qa <film> --determinism` |

Engine scripts for finer work (run from the films folder): `node <engine>/scripts/render.mjs --film <film>`
with `--strip a:b:8 --name <cut>` (frames across a transition), `--range a:b` (a short clip), `--hits`
(the visual hit list), `--poster [t]`. `node <engine>/scripts/sfx.mjs --list` prints the sound palette.

## Pipeline

1. **Inputs.** Idea, duration, formats, look (the user's; never invent a brand), reference, music
   (a supplied track or a synthesized score) and whether there is a voice. No voice is the default.
   A generated voice needs a paid API the user connects themselves; never ask for a key in chat.
2. **Assets.** `node <engine>/scripts/gather.mjs <url> <film>` pulls screenshots, fonts, colours and the
   site's own words from the user's product URL when there is one. Never invent product screens.
3. **Reference style.** `node <engine>/scripts/reference.mjs <video|folder> <film>`, then write
   `docs/style_guide.md` from `references/style_guide.md`. Take motion and composition from the reference;
   colours and type stay the user's.
4. **Music and grid.** `uv run <engine>/scripts/beats.py <film> --track song.mp3` (or `--full` for a
   music video, or `--synth --flavor house|tabla|lofi`). A bespoke score: `<film>/audio/score.py` on top
   of `<engine>/scripts/dsp.py`, writing `music.wav` and `beats.json`; `fcwm render` runs it with
   `MOTION_REEL_SKILL` set to `<engine>` (the folder with `scripts/dsp.py`; set it yourself to run a score
by hand). Start a score from `<repo>/templates/motion-reel-score/score.py` (a kick on every beat and a
soft pad on the film's grid; copy it to `<film>/audio/score.py`). Lyric videos on the user's song:
`references/lyrics.md`; a lyric clip on a synthesized score needs no transcription: put the words in
`film.js` as `[beat, word]` pairs and land each word with a `lib/fcwm/type.js` style (timing in
`<repo>/skills/directing-motion-films/references/lib-api.md`). Voice-over: `references/voiceover.md`.
5. **Shot list.** Full process only: `docs/shotlist.md` on the beat grid (`references/shotlist.md`), one
   row per shot. Stop for the user's OK. Show a model sheet first if the film has a character.
6. **Build `film.js`.** Time everything in beats (`u`). Springs: `springU`, `springKeys`, `SPRING`
   presets; `kf` for eased keys, `wobble`, `shake`. Layout per format: `FORMAT.pick`, `FORMAT.safe`.
   Per-glyph type: `layout`, `glyph`. Real screenshots: `cover`, `crop`. 3-D: `--3d`, `lib/gl.js` and
   `references/3d.md`; physically based light (path traced, slow, offer it first): `--pathtrace`,
   `lib/pathtrace.js` and `references/pathtrace.md`. Grain and glitch go in `post()`, after the motion-blur average.
   List every accent in `HITS` as `[beat, label, sfx, opts]` so sound and picture share one source.
   FCWM's tested blocks are copied into the film as `lib/fcwm/` (kinetic type, transitions, captions,
   charts, cursor paths, point-cloud morphs, cameras, dialogue timing, characters): `import { rise } from
   './lib/fcwm/type.js'` in `film.js`. The template `film.js` is a sample scene set: replace its scenes
   with the film's own. `fonts/` holds a placeholder face (Inter, OFL) under the names `index.html` loads
   (`display`, `ui`); replace the files with the user's typeface.
7. **Critique loop, at least three rounds.** `fcwm render <film> --check`, look at the contact and phone
   sheets, strips across each cut, then score with `prompts/critique-pass.txt` (in `<engine>`): hook,
   readability at phone size, motion quality, variety, brief fit, sound sync. Fix the worst three, append
   the round to `docs/critique.md`, repeat until every score is 8 or more.
8. **Render and deliver.** `fcwm render <film>` renders every format, adds sound effects, masters to
   -14 LUFS / -1 dBTP, and runs QA. Report the QA result as it is, give the
   paths in `<film>/render/` and the last scores, and name the next improvements concretely.

## Rules that bite

- Frame 0 of every cut shows the new image. A deliberate flat frame (an end on black) goes in
  `film.json` `allowBlank: [[from, to]]`, or QA fails it.
- Zooms in log space (`s = a * (b / a) ** p`); whips keep both shots on screen.
- Check every non-Latin character exists in both faces (opentype.js `charToGlyphIndex`).
- A path-traced film: render one still (`--at`) and quote its measured time before a full render; check
  sheets use `pathtrace.checkSpp`; GitHub Actions has no GPU, so only low-sample test frames there.
- Software WebGL (SwiftShader, printed at render start) is about 80x slower for 3-D. On a machine without
  a GPU, render 3-D in short ranges or on a GPU machine.
