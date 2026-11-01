# qa/

Automated quality checks that run without a model, plus the scoring rubric for the visual review.

Planned checks:

| Check | Pass condition |
| --- | --- |
| Loudness | -14 LUFS integrated, true peak at or below -1 dBTP |
| Frame rate | Constant, matches the film's declared fps |
| Safe zone | All text inside the target platform's safe area |
| Blank frames | No empty or single-colour frames outside intentional ones |
| Determinism | The same frame rendered twice gives the same image |
| 3D z-fighting | No coplanar faces flickering in three.js scenes |

Rubric for the visual review (score 1 to 10, every category 8 or more): hook, readability at phone
size, motion quality, variety, brief fit, sound sync.
