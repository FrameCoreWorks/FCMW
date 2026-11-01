# evals/

The plugin test suite: the same reference tasks, made by several models with nothing but FCWM, scored
the same way. The gap between a strong and a weaker model shows which knowledge the plugin still lacks;
every release records its results here.

## Tasks

`tasks/<id>.md`: front matter (`id`, expected `engine`, `format`, `duration`) and the brief, written the
way a user would. The briefs use fictional names only.

| Task | Format | Tests |
| --- | --- | --- |
| `promo-15s` | 9:16, 15 s | hook, three beats, end card, palette choice (HyperFrames) |
| `chart-10s` | 16:9, 10 s | data accuracy, readable values, highlight (Manim or HyperFrames) |
| `lyric-beat` | 9:16, 12 s | synthesized score, words on the beat grid, loudness (HyperFrames `--score`) |
| `logo-sting` | 1:1, 4 s | mark reveal, transparent ProRes 4444 next to the MP4 |
| `product-3d` | 16:9, 6 s | 3-D object, studio light, camera move (HyperFrames `--3d` or Blender) |

## Running a model

1. Give the agent (any host, any model) the same prompt: the plugin path, its films folder, "quick
   mode, nobody will answer questions", the brief, and "make the film in a folder named after the task
   id, check, review the contact sheet, render, run the determinism check". The prompt used for a release
   is stored in `results/<release>/prompt.md`.
2. Score what it made, without a model:

   ```sh
   node evals/run.mjs score <films-folder> --model <name> [--release 0.4.0] [--tasks promo-15s,chart-10s]
   ```

   For each task this renders the film, runs QA and the determinism check, compares format and duration
   with the brief and counts the film's own lines of code. It writes `results/<release>/<model>.json`.
3. Visual scores: a judge (a person, or a model that can see images) scores each contact sheet with the
   rubric in `qa/README.md` (hook, readability, motion, variety, briefFit, soundSync; 1-10) and adds them
   with `--visual scores.json` (`{ "<task>": { "hook": 8, ... } }`). Notes go in `"notes"`.
4. `node evals/run.mjs report [--release x.y.z]` writes the comparison table to `results/<release>/README.md`.

Agents that cannot see images say so; their self-scores are not used.
