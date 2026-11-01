---
name: fcwm-manim
description: Build an FCWM film on the Manim engine (Manim Community, Python scenes rendered to video). Use when the fcwm skill routes a job here, for equations, graphs, plots, geometry, algorithms and technical or mathematical explainers, including transparent overlays of them.
license: Apache-2.0
compatibility: Needs the full FCWM repository (git clone), Node 22+, FFmpeg and uv. uv fetches Manim (pinned) and Python 3.12 on first use. Linux also needs Pango and Cairo headers (fcwm setup installs them). LaTeX only if the film uses MathTex or Tex.
metadata:
  version: "0.3.3"
---

# FCWM on Manim

`<repo>` is the FCWM root (two levels above this file). A film is a folder with `scene.py` (a Manim
`Scene` subclass named in film.json `"scene"`, default `Film`) and `film.json`. The render contract in
`references/render-contract.md` applies; `references/adapter.md` lists what each command runs.

## Commands

| Step | Command |
| --- | --- |
| New film | `node <repo>/scripts/fcwm.mjs new <film> --engine manim [--format 16x9] [--duration 10] [--alpha]` |
| Contact sheet (half-size draft render) | `node <repo>/scripts/fcwm.mjs render <film> --check` |
| Stills | `node <repo>/scripts/fcwm.mjs render <film> --at 2,5.5` |
| Full render and QA (`--preview` adds a small phone preview) | `node <repo>/scripts/fcwm.mjs render <film>` |
| Extra formats | `--export gif,webm,mov,mov-alpha,webm-alpha` (alpha needs `"alpha": true`) |

Unlike the browser engines, Manim films can list several formats: each is rendered on its own canvas
(the starter keeps 8 units of frame height, so the width follows the aspect). Check each format's
layout on its contact sheet.

## How to write the film

- Keep the starter's top: it reads `film.json`, sets the frame size per format and holds the last
  frame until `duration`, so the contact sheet, QA and the film agree. Update `duration` in film.json
  when the animations change length.
- Text: `Text` and `MarkupText` (Pango, no LaTeX). Equations: `MathTex` needs a LaTeX install
  (MacTeX or TeX Live); ask before relying on it, or set the formula with `Text`.
- Randomness: `np.random.default_rng(seed)`, never unseeded `random` or `np.random`.
- The first frame is the thumbnail: something meaningful is on screen at `t = 0` (`self.add(...)`
  before the first `self.play`).
- Colours, fonts and words are the user's. The starter's grey ground and white ink are placeholders.
- Transparent overlays: `fcwm new <film> --engine manim --alpha` (or `"alpha": true`); the film then
  delivers ProRes 4444 with alpha next to the MP4.
- Sound: `self.add_sound("audio/track.wav", time_offset=...)` places audio on the timeline; the delivered
  MP4 keeps it and QA checks -14 LUFS / -1 dBTP.

## Review

`fcwm render <film> --check` renders a half-size draft and cuts one frame per beat (or every 0.5 s
without `beats.json`) into `render/contact_<format>_p1.png` and a phone sheet. Score them as the fcwm
skill's quality gate says, fix the three weakest spots, repeat until every score is 8+. Then render and
report the QA lines as they are.
