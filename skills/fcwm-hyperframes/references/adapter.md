<!-- Copied from engines/hyperframes/README.md by scripts/sync-skill-refs.mjs. Edit the source, then run it again. -->
# HyperFrames adapter

[HyperFrames](https://github.com/heygen-com/hyperframes) (Apache-2.0) renders HTML compositions to video.
FCWM does not vendor it: `adapter.mjs` runs `npx -y hyperframes@<pinned version>` so the user gets the
exact version FCWM was tested with. Telemetry is off for every call (`HYPERFRAMES_NO_TELEMETRY=1`,
`DO_NOT_TRACK=1`) and HyperFrames' own skill installer is skipped (`HYPERFRAMES_SKIP_SKILLS=1`).

| FCWM command | HyperFrames call |
| --- | --- |
| `fcwm new <name>` | none: copies `templates/hyperframes-blank` and FCWM's `lib/` into `<name>/lib/fcwm/` |
| `fcwm render <film> --check` | `check` (lint, runtime, layout, contrast), then `snapshot --at <beats>`, tiled into contact sheets |
| `fcwm render <film> --at 1,2` | `snapshot --at 1,2` into `<film>/render/stills/` |
| `fcwm render <film>` | `render -q delivery --strict`, then FCWM's mix and QA (phone preview only with `--preview`) |
| `--export mov-alpha` / `webm-alpha` | `render --format mov` (ProRes 4444) / `--format webm` (VP9 alpha) |

The FCWM starter drives the picture through HyperFrames' `hf-seek` event (`renderAt(t)`), which is
FCWM's render contract, and marks the root `data-no-timeline`. GSAP is never required; a film that
loads it is flagged as `restricted` (GSAP Standard licence).

A HyperFrames film is composed for one canvas size, so it ships in one format. For a second format,
make a second film (`fcwm new name-16x9 --format 16x9`) and share code through `lib/`.

Not used by FCWM: HyperFrames cloud, Lambda and Cloud Run renders, `publish`, `auth`, `billing` and
`--describe` (sends frames to a paid vision API). They need accounts and may cost money; they are the
user's choice to set up.

To upgrade: change `HYPERFRAMES_VERSION`, run `npm test` and the smoke workflow, and update
`engines/catalog.json` (`version`, `checked`).
