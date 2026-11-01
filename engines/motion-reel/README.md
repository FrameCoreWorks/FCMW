# motion-reel engine

[motion-reel](https://github.com/Aries-Spring/motion-reel) 1.3.0 by Aries Spring, MIT licence (`LICENSE`).
Vendored so FCWM works without any other plugin. Upstream files are unchanged; FCWM adds `adapter.mjs`
(the steps `scripts/fcwm.mjs` runs for each mode) and this README.

| Folder | Contents |
| --- | --- |
| `assets/lib/` | `motion.js` (film harness, springs, beat grid, per-glyph layout, seeded noise), `gl.js` (three.js sets) |
| `assets/template/` | the film template `fcwm new --engine motion-reel` starts from |
| `scripts/` | `render.mjs` (frame-exact render, contact sheets, stills), `sfx.mjs`, `mix.mjs`, `scaffold.mjs`, `gather.mjs`, `reference.mjs`; Python audio: `beats.py`, `dsp.py`, `sync.py`, `align.py`, `lyrics.py` (run with `uv run`) |
| `references/` | 3-D, shot list, style guide, voice-over and lyric-video guides; examples |
| `prompts/critique-pass.txt` | the scoring pass used in the critique loop |

How an agent uses it: `skills/fcwm-motion-reel/SKILL.md`.
