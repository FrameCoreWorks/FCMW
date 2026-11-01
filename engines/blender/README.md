# Blender adapter

[Blender](https://www.blender.org) (GPL-3.0-or-later, 21k stars on the GitHub mirror, active) renders
photoreal 3-D with Cycles. Tier **restricted**: free to use and the renders belong to the user, but
Blender and any code linked to it (a film's `scene.py` imports `bpy`) are GPL, so that code is
share-alike if it is distributed. Tell the user before building on it.

FCWM does not vendor or install the Blender app. `adapter.mjs` runs the official Blender Python module
from PyPI headless: `uv run --python 3.13 --with bpy==5.2.3 python engines/blender/render.py -- ...`
(bpy 5.2.3 is Blender 5.2 LTS; the wheel is 250-400 MB and Python 3.13 is fetched by uv, both once, into
uv's cache). Wheels exist for macOS arm64, Linux x86_64 and Windows x64/arm64; Intel Macs are not
covered by this bpy release.

A film is `scene.py` with `build(scene, film)` plus `film.json`. `render.py` starts from an empty factory
scene, applies size, frame rate and render settings, calls `build()` and writes one PNG per frame. The film
animates only with keyframes and drivers, so every frame is computed from its frame number.

| FCWM command | What runs |
| --- | --- |
| `fcwm new <name> --engine blender [--alpha]` | copies `templates/blender-blank` (`scene.py`, `film.json`) |
| `fcwm render <film> --check` | the beat-grid frames only, half size, 8 samples, tiled into contact sheets |
| `fcwm render <film> --at 1,2` | those frames at full size and the film's samples, into `render/stills/` |
| `fcwm render <film>` | every frame into `<film>/.blender/<format>/`, encoded to H.264 yuv420p (CRF 16, faststart), preview, QA |
| `--export mov-alpha` / `webm-alpha` | the same RGBA frames (film.json `"alpha": true`) to ProRes 4444 / VP9 with alpha |

Render settings (film.json): `samples` (64), `seed` (1), `denoise` (true), `gpu` (true: Metal, OptiX,
CUDA, HIP or oneAPI when present, else CPU), `motionBlur` (false), `audio` (a track to mux, path in the
film folder). Cycles runs with a fixed seed and adaptive sampling off, so a frame renders the same twice
on the same machine and device. Different devices (CPU vs GPU) give slightly different noise.

Cost: on a CPU, a 1080p frame at 64 samples takes tens of seconds, so a 15 s film (450 frames) is hours;
an Apple-silicon or NVIDIA GPU is many times faster. Say the estimate before a full render. EEVEE is
not used: it needs a GPU context and does not run headless on CI.

To upgrade: change `BPY_VERSION` (and `PYTHON` if the wheels move), run `npm test` and
`node scripts/smoke.mjs --only blender`, update `engines/catalog.json`.
