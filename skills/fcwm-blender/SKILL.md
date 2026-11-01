---
name: fcwm-blender
description: Build an FCWM film on the Blender engine (bpy scenes rendered with Cycles). Use when the fcwm skill routes a job here, for photoreal 3-D, product shots, materials and light, glass, metal, physics-ready sets and transparent 3-D overlays. Blender is GPL (tier restricted); say so before building.
license: Apache-2.0
compatibility: Needs the full FCWM repository (git clone), Node 22+, FFmpeg and uv. uv fetches the Blender Python module (bpy, pinned, 250-400 MB) and Python 3.13 once. macOS on Apple silicon, Linux x86_64, Windows. A GPU makes full renders practical.
metadata:
  version: "0.3.3"
---

# FCWM on Blender

`<repo>` is the FCWM root (two levels above this file). A film is a folder with `scene.py` (a function
`build(scene, film)`) and `film.json`. The render contract in `references/render-contract.md` applies;
`references/adapter.md` lists what each command runs and the render settings.

Before building, tell the user in one line: Blender is free and the renders are theirs, but it is GPL
(tier restricted), and full renders are slow without a GPU (estimate: frames x seconds per frame).

## Commands

| Step | Command |
| --- | --- |
| New film | `node <repo>/scripts/fcwm.mjs new <film> --engine blender [--format 16x9] [--duration 10] [--alpha]` |
| Contact sheet (draft frames on the beat grid) | `node <repo>/scripts/fcwm.mjs render <film> --check` |
| Stills at full quality | `node <repo>/scripts/fcwm.mjs render <film> --at 2,5.5` |
| Full render and QA (`--preview` adds a small phone preview) | `node <repo>/scripts/fcwm.mjs render <film>` |
| Extra formats | `--export gif,webm,mov,mov-alpha,webm-alpha` (alpha needs `"alpha": true`) |

A Blender film may list several formats; each renders through its own camera framing (`film["width"]`,
`film["height"]` in `build`). Check each format's contact sheet.

## How to write the film

- Build everything in `build()` from an empty scene: meshes, materials, lights, world, camera. Do not
  load the user's `.blend` unless they provide one (`bpy.ops.wm.append` from `assets/`).
- Animate only with keyframes (`obj.keyframe_insert`) or drivers, so Blender computes any frame from its
  number; frames render in any order. No frame-change handlers that keep state, no clock, no unseeded
  randomness (`random.Random(seed)`).
- Frame 1 is the thumbnail: the subject is on screen and lit at frame 1.
- Time in frames: frame = round(t x fps) + 1. With music, key on the beat grid from `beats.json`.
- Look comes from light and materials: one soft key area light, a dim fill, a ground that catches
  shadows. Colours, materials and words are the user's; the starter's greys are placeholders.
- Transparent overlays: `--alpha` (or `"alpha": true`) makes the world transparent and the floor a
  shadow catcher; the film also delivers ProRes 4444 with alpha.
- Quality vs time: `"samples"` (default 64, denoised). The contact sheet always uses 8 samples at half
  size; judge layout and motion there, and light and materials on `--at` stills.
- Physics (rigid body, cloth): bake it inside `build()` (`bpy.ops.ptcache.bake_all`) so every frame
  reads the baked cache; never simulate frame by frame during the render.

## Review

`fcwm render <film> --check` renders the beat-grid frames into `render/contact_<format>_p1.png` and a
phone sheet. Score them as the fcwm skill's quality gate says, fix the three weakest spots, repeat until
every score is 8+. Check light and materials on two or three `--at` stills before the full render. Then
render and report the QA lines as they are.
