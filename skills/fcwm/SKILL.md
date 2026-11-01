---
name: fcwm
description: Entry point for making motion graphics as code with FCWM. Use whenever the user asks for a motion graphics video, animated logo, explainer, promo or ad, social cut, lyric or music video, animated chart or diagram, title sequence, 3D product shot, transparent overlay, GIF, Lottie or animated SVG, even if they never say "motion graphics". Asks for quick mode or the full process, collects the brief, picks the engine and tells the user its licence tier before building.
license: Apache-2.0
compatibility: Any agent that reads Agent Skills. Rendering needs a shell with Node 18+ and FFmpeg; engines install their own extras. Agents without a shell hand the user a command to run.
metadata:
  version: "0.1.0"
---

# FCWM

Make a film as code: the agent writes it, the user's machine or GitHub Actions renders it. This skill
runs the conversation and the routing. Engine specifics live in the engine adapters under
`<repo>/engines/`, where `<repo>` is the plugin root (two levels above this file).

The user sets the creative direction. Never add a brand, palette, typeface or style the user did not
ask for. If the brief is silent on look, ask, or offer two or three neutral options and let them pick.

## 1. Choose the mode

Ask once, at the start:

- **Quick mode**: idea to finished film. Confirm the one-line idea, format and length, then build,
  run the quality gate and deliver. One review, at the end.
- **Full process**: brief, shot list on the beat grid (user signs off), key frames (user signs off),
  build, review rounds, render, delivery in every requested format.

If the user does not choose, use quick mode for films up to 15 seconds and the full process above that.

## 2. Collect the brief

Ask only for what is missing:

| Item | Default when the user has no preference |
| --- | --- |
| The idea in one sentence | none, always ask |
| Duration | 15 s |
| Aspect ratios | 16:9; every extra ratio gets its own composition, not a crop |
| Output formats | MP4 (H.264); on request ProRes 4444 or WebM with alpha, GIF, Lottie, animated SVG |
| Look and tone | ask; never invent one |
| Brand kit | none; use `brand-kit/` only if the user has saved one or provides assets |
| Sound | synthesized score and effects on the beat grid, or the user's own track; or silent |
| Paid tools | not used unless the user agrees and supplies their own API key |

## 3. Pick the engine

Read `<repo>/engines/catalog.json`. Match the job to an engine by its `purpose`, then check `status`:
only engines marked `ready` can be used. Before building, tell the user the engine, its `tier`
(`free`, `restricted` or `paid`) and, for anything other than `free`, the licence limit in one line.

Typical routing (the catalog is the source of truth):

| Job | Engine |
| --- | --- |
| Kinetic type, UI and product motion, 2D and three.js 3D with synthesized sound | motion-reel |
| HTML and CSS layouts, web-style motion, captions | HyperFrames |
| Equations, graphs, mathematical and technical diagrams | Manim |
| Physical simulation, photoreal 3D, complex scenes | Blender |
| Lightweight vector animation for web and apps | Lottie / animated SVG |

If no `ready` engine fits, say so plainly and name the closest option. Do not fake a capability.

## 4. Build, check, deliver

1. Follow the engine adapter's own instructions and the render contract in `<repo>/AGENTS.md`:
   every frame is a pure function of time, randomness only from seeded noise.
2. Build from the building blocks in `<repo>/lib/` and the annotated films in `<repo>/recipes/`
   before writing anything from scratch.
3. Quality gate, both modes: contact sheet (one frame per beat) and a phone-size preview. Score hook,
   readability, motion quality, variety, brief fit and sound sync from 1 to 10. Fix the three weakest
   spots and repeat until every score is 8 or more. If you cannot see images, give the sheet to the
   user and ask them to score it.
4. Run the automated checks in `<repo>/qa/` (loudness -14 LUFS / -1 dBTP, constant fps, safe zone,
   blank frames, determinism) and report any failure as it is.
5. Deliver every requested format, give the full output paths, and state what was not checked.

Without a shell, finish with the exact command the user should paste into their terminal.
