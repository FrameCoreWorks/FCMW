---
name: fcwm
description: Entry point for making motion graphics as code with FCWM. Use whenever the user asks for a motion graphics video, animated logo, explainer, promo or ad, social cut, lyric or music video, animated chart or diagram, title sequence, 3D product shot, transparent overlay, GIF, Lottie or animated SVG, even if they never say "motion graphics". Asks for quick mode or the full process, collects the brief, picks the engine and tells the user its licence tier before building.
license: Apache-2.0
compatibility: Any agent that reads Agent Skills. Rendering needs the full FCWM repository (git clone), a shell with Node 22+ and FFmpeg; `node scripts/fcwm.mjs doctor` lists anything missing. Agents without a shell hand the user a command to run.
metadata:
  version: "0.3.0"
---

# FCWM

Make a film as code: the agent writes it, the user's machine or GitHub Actions renders it. This skill
runs the conversation and the routing; the engine skills (`fcwm-hyperframes`, `fcwm-motion-reel`) hold
the engine specifics. `<repo>` is the FCWM root, two levels above this file. Every command below is
`node <repo>/scripts/fcwm.mjs ...` (shortened to `fcwm ...`), run from the folder that holds the films.

The user sets the creative direction. Never add a brand, palette, typeface or style the user did not
ask for. If the brief is silent on look, ask, or offer two or three neutral options and let them pick.

## 1. Choose the mode

Ask once, at the start:

- **Quick mode**: idea to finished film. Confirm the one-line idea, format and length, then build,
  run the quality gate yourself (as many rounds as it takes) and deliver. The user reviews once, at the end.
- **Full process**: brief, shot list on the beat grid (user signs off), key frames from
  `fcwm render <film> --at ...` (user signs off), build, review rounds, render, delivery in every
  requested format.

If the user does not choose, use quick mode for films up to 15 seconds and the full process above that.

## 2. Collect the brief

Ask only for what is missing, in one round:

| Item | Default when the user has no preference |
| --- | --- |
| The idea in one sentence | none, always ask |
| Duration | 15 s |
| Aspect ratios | 9:16; every extra ratio gets its own composition, not a crop |
| Output formats | MP4 (H.264); on request GIF, WebM, ProRes (`--export gif,webm,mov`); transparent overlays as ProRes 4444 or WebM with alpha (`mov-alpha`, `webm-alpha`, HyperFrames, Manim or Blender films started with `--alpha`) |
| Look and tone | ask; never invent one |
| Brand kit | none; only if the user saved one (`fcwm brand list`) or wants to: `fcwm brand init <kit>`, then `fcwm new <film> --brand <kit>`; see `<repo>/brand-kit/README.md` |
| Sound | the user's own track, a synthesized score and effects on the beat grid, or silent |
| Paid tools | not used unless the user agrees and connects their own account; see `<repo>/skills/connecting-services` |

## 3. Pick the engine

`fcwm engines` prints `<repo>/engines/catalog.json`: each engine's purpose, tier, status and licence.
Use only engines with status `ready` or `experimental` (for `experimental`, say once that it is new).
Before building,
tell the user the engine and its tier; for anything other than `free`, add the licence limit in one line.

FCWM uses established, open tools and never presents an engine as its own. Default to the first row
that fits:

| Job | Engine | Tier |
| --- | --- | --- |
| 2-D type, UI and product stories, captions, layouts, slides, web-style motion (default) | HyperFrames (HeyGen) | free (GSAP inside a film: restricted) |
| 3-D in motion: objects, rings, logos, cameras through space, point clouds, generative forms, type meeting 3-D | HyperFrames + three.js (`--3d`) | free (three.js, MIT) |
| Music-driven films: lyric and beat videos, promos cut to a synthesized score | HyperFrames (`--score`, with `--3d` when it has 3-D) | free |
| Equations, graphs, plots, geometry, algorithms, technical explainers | Manim | free |
| Business charts (bars, lines, numbers that grow) with designed type and layout | HyperFrames with `lib/chart.js` (Manim when the chart is mathematical: axes, functions, a plotted curve) | free |
| Lottie playback (the user's .lottie or .json) and animated SVG, delivered as video | HyperFrames (`--lottie`) | free (dotlottie-web, MIT) |
| Photoreal 3-D: product shots, glass, metal, materials and light, physics-ready sets | Blender (Cycles) | restricted (GPL-3.0; renders are the user's) |

**3-D quality.** HyperFrames + three.js rasterises in real time: fast, sharp, good for graphic 3-D.
When the shot is about materials and light (glass, metal, liquid, a product on a table, soft shadows,
depth of field), offer Blender (Cycles) next to it, one line each: Blender looks physically real but
is slower (minutes per second of film on a CPU) and its tier is restricted (GPL). Let the user choose.

**motion-reel** (a small MIT canvas toolkit by Aries Spring, vendored in `engines/motion-reel`) is not
offered: use it only when the user asks for it by name, or for its experimental path-traced mode
(`--pathtrace`) when the user wants it after hearing it is slow and experimental. Never call it an FCWM
engine.

When a job fits two engines (for example a chart: HyperFrames or Manim), offer both with one line
each and recommend one. Then load the engine skill and follow it:

- HyperFrames: `fcwm new <film>` (`--3d` for three.js, `--score` for a synthesized score on a beat grid,
  `--lottie [file]` for a Lottie animation) and `skills/fcwm-hyperframes/SKILL.md`
- Manim: `fcwm new <film> --engine manim` and `skills/fcwm-manim/SKILL.md`
- Blender: `fcwm new <film> --engine blender` and `skills/fcwm-blender/SKILL.md`
- motion-reel, only on request: `fcwm new <film> --engine motion-reel` (`--3d`, `--pathtrace`) and `skills/fcwm-motion-reel/SKILL.md`

## Paid APIs and MCP servers

FCWM ships nothing that needs an account or bills money. Optional services (voice, music, images,
video, as an API or an MCP server) are listed in `<repo>/integrations/catalog.json`, almost all
`tier: "paid"`. Offer one only when the user wants it, say it bills their own account, never ask for a
key in chat, and follow `<repo>/skills/connecting-services`.

## 4. Build, check, deliver

1. Follow the engine skill and the render contract in `<repo>/AGENTS.md`: every frame is a pure function
   of time, randomness only from seeded noise.
2. Build from the blocks in `<repo>/lib/`, the craft rules in the `directing-motion-films` skill and the
   annotated films in `<repo>/recipes/` before writing anything from scratch. The first draft already
   follows five rules, each checked by `fcwm render` (QA fails without them):
   - **Hook on frame 0:** the first frame shows the film's main thing, not an empty ground (`firstFrame`).
   - **9:16 fills the frame:** content spans the middle 60 % of the height, type at least 7 % of the
     width (`fill`). A short line in the upper third of an empty frame is the most common miss.
   - **Every scene new:** its own layout, scale and entrance; never the same block with other words
     (`repeats`, and the variety score).
   - **Always moving:** something moves in every second; no hold over 1.5 s before the end card
     (`motion`). Fading between still text slides is a slideshow, not motion graphics.
   - **Sound:** a film for social media has music and hits on the cuts unless the brief says silent.
   Counters and charts only through `lib/chart.js` (the number lands with its bar, never before).
   Deliberate exceptions go in `film.json`: `allowEmptyStart`, `allowRepeats`, `allowStill`.
3. Quality gate, both modes: `fcwm render <film> --check` writes the contact sheet (one frame per beat)
   and a phone-size sheet into `<film>/render/`: score `contact_<format>_p1.png` and
   `phone_<format>_p1.png` (an engine's own sheets, such as HyperFrames' `snaps/`, are working files).
   Score hook, readability, motion quality, variety, brief fit and sound sync from 1 to 10 (a silent film
   has no sound-sync score). Fix the three weakest spots and repeat until every score is 8 or more. The
   common misses are in the `directing-motion-films` skill's "Common mistakes": first frame, hook, 9:16
   composition, honest numbers. If `--check` exits with code 2 it found a layout problem (text overlap
   or overflow) and wrote no sheet: fix what it names and run it again. If you cannot see images, give
   the sheets to the user and ask them to score.
   `--at` takes seconds (`--at 0,2.5,7`); convert beats with `beats.json` (`offset + beat * period`).
4. `fcwm render <film>` renders, mixes, writes `<film>-preview.mp4` and runs the automated checks:
   -14 LUFS / -1 dBTP, constant fps, canvas size, no blank frames, and the composition checks above
   (each FAIL prints its fix). Fix composition FAILs before scoring taste. `fcwm qa <film> --determinism` also
   renders three frames twice and compares them. Report every FAIL as it is; never call a film done
   while QA fails.
5. Deliver: full paths of the files in `<film>/render/`, the last scores, and what was not checked
   (for example the safe zone, which is still a manual check).

## 5. When the user renders (no shell here, or the user's own computer)

A chat app's code sandbox (ChatGPT, Claude.ai) counts as "no shell" for rendering: never try to render,
start Chromium or install engines there, and never report a failed attempt. Ask the user's operating
system; never assume one. Follow `references/handoff.md` step by step:

1. Write every file into one self-contained film folder (one per format asked for), deliver it as a
   ZIP with a direct download link (never a library or file-panel pointer) and tell the user to
   download and unzip it.
2. Ask for their operating system (if unknown) and the folder's full path, with how to copy a path on
   that system (spaces, `&` and accents are fine). Then stop: no command and no guessed path until the
   user pasted the real one.
3. Only then give two separate commands for their system (Terminal on macOS and Linux, PowerShell on Windows):
   render on this computer, and render in GitHub Actions (` --cloud`, or ` --cloud --public` for free
   minutes in a public repository). `fcwm command <folder> --os macos|windows|linux [--next] [--cloud
   [--public]]` prints the exact lines. The first-time local line sets up the
   whole render toolkit (Node.js, FFmpeg, every engine; only what is missing); later the short `fcwm run`
   line.
4. Say what happens on the first run (missing tools are installed), that the GitHub variant asks for a
   GitHub login once and runs on the user's own account in a temporary repository that is deleted after
   the download (private uses Actions minutes, public is free but visible while it runs), and that
   FCWM remembers what is installed (`~/.fcwm/state.json`), so later commands install nothing.
