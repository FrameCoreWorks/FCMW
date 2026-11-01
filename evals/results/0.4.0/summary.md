# Summary, FCWM 0.4.0 (pre-release), 2026-11-01

Models: three Claude models of different size (opus, sonnet, haiku as served on 2026-11-01), each
making the same three tasks (promo-15s, chart-10s, lyric-beat) with FCWM 0.3.0 plus the eval harness.
Visual scores: one judge (a strong model looking at the contact and phone sheets), rubric in `qa/README.md`.
Automated checks: `node evals/run.mjs score`, re-rendered from the films the agents left.

| Model | Automated checks | Mean visual score | Below 8 most often |
| --- | --- | --- | --- |
| opus | 3 of 3 pass | 8.1 | hook and the first frame |
| sonnet | 3 of 3 pass | 7.2 | variety, hook |
| haiku | 3 of 3 pass | 6.4 | hook, variety, 9:16 composition |

What it shows:

- The engines and checks carry every model: all nine films render, pass QA (loudness, constant fps,
  no blank frames, size) and are deterministic. Weaker models fail on craft, not on mechanics.
- All three chose the same engines (HyperFrames for promo and chart, motion-reel for the lyric clip).
  None picked Manim for the chart.
- The common misses, in every model: an empty or half-built first frame, numbers shown while bars grow,
  type that leaves most of a 9:16 frame empty, ghosting between words, and repeats that look copied.
  Smaller models also skip the hook and reuse one layout.
- What models reported missing (fixed in 0.4.0, see CHANGELOG): block signatures, a chart block,
  fonts (empty `fonts/`, `system-ui`), a synthesized-score starter, which contact sheet to score,
  silent films in the gate, `--check` exit code 2, `--at` units, the motion-reel lib path.

Next run: the same tasks after the 0.4.0 skill changes, plus logo-sting and product-3d, and models
outside Claude (Codex, models through OpenRouter) on the user's own keys.
