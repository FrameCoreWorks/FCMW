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
  run the quality gate and deliver. One review, at the end.
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
| Output formats | MP4 (H.264); on request GIF, WebM, ProRes (`--export gif,webm,mov`); transparent overlays as ProRes 4444 or WebM with alpha (`mov-alpha`, `webm-alpha`, HyperFrames or Manim films started with `--alpha`) |
| Look and tone | ask; never invent one |
| Brand kit | none; use `brand-kit/` only if the user has saved one or provides assets |
| Sound | the user's own track, a synthesized score and effects on the beat grid, or silent |
| Paid tools | not used unless the user agrees and connects their own account; see `<repo>/skills/connecting-services` |

## 3. Pick the engine

`fcwm engines` prints `<repo>/engines/catalog.json`: each engine's purpose, tier, status and licence.
Use only engines with status `ready` or `experimental` (say "experimental" out loud). Before building,
tell the user the engine and its tier; for anything other than `free`, add the licence limit in one line.

| Job | Engine | Tier |
| --- | --- | --- |
| 2-D type, UI and product stories, captions, layouts, slides, web-style motion (default) | HyperFrames | free (GSAP inside a film: restricted) |
| 3-D scenes, point clouds, voxel characters, generative motion, synthesized score, music and lyric videos | motion-reel | free |
| Equations, graphs, plots, geometry, algorithms, technical explainers | Manim | free |
| Physical simulation, photoreal 3-D scenes, Lottie or animated SVG | Blender, Lottie (planned) | say they are not available yet; offer the closest engine above |

**3-D quality mode.** For a 3-D shot about materials and light (glass, metal, liquid, a product on a
table, soft shadows, depth of field), offer path tracing on motion-reel next to the default rasteriser,
with one line each: rasterised is fast; path traced looks physically real but takes seconds per frame
on a GPU (hours for a long film) and is experimental. Let the user choose; never switch it on silently.
Details: `catalog.json` motion-reel `modes`, and `references/pathtrace.md` in the motion-reel skill.

When a job fits both (for example 2-D kinetic type with a synthesized score), offer both with one line
each and recommend one. Then load the engine skill and follow it:

- HyperFrames: `fcwm new <film>` and `skills/fcwm-hyperframes/SKILL.md`
- Manim: `fcwm new <film> --engine manim` and `skills/fcwm-manim/SKILL.md`
- motion-reel: `fcwm new <film> --engine motion-reel` (`--3d` for three.js, `--pathtrace` for the path-traced mode) and `skills/fcwm-motion-reel/SKILL.md`

## Paid APIs and MCP servers

FCWM ships nothing that needs an account or bills money. Optional services (voice, music, images,
video, as an API or an MCP server) are listed in `<repo>/integrations/catalog.json`, almost all
`tier: "paid"`. Offer one only when the user wants it, say it bills their own account, never ask for a
key in chat, and follow `<repo>/skills/connecting-services`.

## 4. Build, check, deliver

1. Follow the engine skill and the render contract in `<repo>/AGENTS.md`: every frame is a pure function
   of time, randomness only from seeded noise.
2. Build from the blocks in `<repo>/lib/`, the craft rules in the `directing-motion-films` skill and the
   annotated films in `<repo>/recipes/` before writing anything from scratch.
3. Quality gate, both modes: `fcwm render <film> --check` writes the contact sheet (one frame per beat)
   and a phone-size sheet into `<film>/render/`. Score hook, readability, motion quality, variety, brief
   fit and sound sync from 1 to 10. Fix the three weakest spots and repeat until every score is 8 or
   more. If you cannot see images, give the sheets to the user and ask them to score.
4. `fcwm render <film>` renders, mixes, writes `<film>-preview.mp4` and runs the automated checks:
   -14 LUFS / -1 dBTP, constant fps, canvas size, no blank frames. `fcwm qa <film> --determinism` also
   renders three frames twice and compares them. Report every FAIL as it is; never call a film done
   while QA fails.
5. Deliver: full paths of the files in `<film>/render/`, the last scores, and what was not checked
   (for example the safe zone, which is still a manual check).

## 5. When the user renders (no shell here, or the user's own computer)

Follow `references/handoff.md` step by step:

1. Write every file into one self-contained film folder and tell the user how to put it on their disk.
2. Ask for the folder's full path on their disk or volume (spaces, `&` and accents are fine).
3. Give one command for their OS: the first-time line installs only what is missing (Node.js, FFmpeg,
   engines), then renders into `<folder>/render/`; later the short `fcwm run` line. `fcwm command
   <folder> --os macos|windows|linux [--next] [--cloud]` prints the exact line.
4. Tell the user that FCWM tracks what is installed (`~/.fcwm/state.json`, re-checked on every run), so
   later commands contain no installation.
5. Offer GitHub Actions (`--cloud`) as the alternative: it runs on the user's own GitHub account and
   minutes.
