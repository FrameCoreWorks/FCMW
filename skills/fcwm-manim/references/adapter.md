<!-- Copied from engines/manim/README.md by scripts/sync-skill-refs.mjs. Edit the source, then run it again. -->
# Manim adapter

[Manim Community](https://github.com/ManimCommunity/manim) (MIT, 42k stars, active) renders Python scenes:
equations, plots, geometry, algorithms. FCWM does not vendor it: `adapter.mjs` runs
`uv run --python 3.12 --with manim==0.22.1 manim render ...`, so uv fetches the pinned version once and
caches it. Linux needs Pango and Cairo headers for ManimPango (`fcwm setup` installs `libpango1.0-dev
libcairo2-dev pkg-config`); macOS and Windows use prebuilt wheels. LaTeX is only needed for `MathTex`.

| FCWM command | What runs |
| --- | --- |
| `fcwm new <name> --engine manim` | copies `templates/manim-blank` (`scene.py`, `film.json`) |
| `fcwm render <film> --check` | half-size draft render, ffmpeg cuts one frame per beat, tiled into contact sheets |
| `fcwm render <film> --at 1,2` | full-size render, frames cut at those times into `render/stills/` |
| `fcwm render <film>` | one render per format, re-encoded to H.264 yuv420p (CRF 16, faststart), preview, QA |
| `--export mov-alpha` | `--transparent --format mov` (QuickTime Animation), transcoded to ProRes 4444 `yuva444p10le` |
| `--export webm-alpha` | `--transparent --format webm` (VP9 with alpha), copied as is |

Intermediate files live in `<film>/.manim/` (ignored by git). To upgrade: change `MANIM_VERSION`, run
`npm test` and `node scripts/smoke.mjs --only manim`, update `engines/catalog.json`.
