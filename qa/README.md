# qa/

Automated quality checks that run without a model (`checks.mjs`), plus the scoring rubric for the visual
review. `fcwm render <film>` runs them on every delivered file and writes `<film>/render/qa.json`;
`fcwm qa <film|video.mp4>` runs them on their own.

| Check | Pass condition | Status |
| --- | --- | --- |
| Loudness | -14 LUFS ±1 integrated, true peak at or below -1 dBTP; a film with no audio stream is skipped | automatic |
| Frame rate | Constant, matches the film's fps (every frame step within 1 %) | automatic |
| Canvas size | Matches the format (9x16 1080x1920, 16x9 1920x1080, 1x1 1080x1080) | automatic |
| Blank frames | No flat frame (luma range 3 or less) outside `film.json` `allowBlank: [[from, to]]` | automatic |
| Determinism | Three frames rendered twice are byte-identical | `fcwm qa <film> --determinism` |
| Safe zone | All text inside the platform's safe area (9x16: x 6-94 %, y 10-80 %) | `safeZone()` exists; not yet wired to a film, check by eye |
| 3D z-fighting | No coplanar faces flickering in three.js scenes | `audit-zfight.mjs`, manual |

Rubric for the visual review (score 1 to 10, every category 8 or more): hook, readability at phone
size, motion quality, variety, brief fit, sound sync.
