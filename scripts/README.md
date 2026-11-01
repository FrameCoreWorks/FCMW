# scripts/

Cross-platform Node scripts (macOS, Windows, Linux). No shell-specific code; child processes get their
arguments as arrays, so paths with spaces or `&` work.

| Script | Purpose |
| --- | --- |
| `fcwm.mjs` | The CLI: `new`, `render` (`--check`, `--at`, full), `qa` (`--determinism`), `doctor`, `engines`. Every command takes `--dry-run`. Exit codes: 0 ok, 1 failed, 2 missing tool. |
| `smoke.mjs` | End-to-end test: one short film per engine, created, rendered and checked. |
| `sync-skill-refs.mjs` | Copies `knowledge/`, engine references and the render contract into each skill's `references/` (`--check` reports drift; `validate` runs it). |
| `validate.mjs` | Skills against the Agent Skills spec, manifest versions, the engine catalog, the no-brand rule, reference drift. `npm run validate`. |
| `lib/` | `args`, `proc` (cross-platform spawn), `tools` (find ffmpeg/uv and install hints), `film` (read `film.json`), `pipeline` (run adapter steps), `contact` (contact sheets). |
| `test/` | `node:test` suites, run with `npm test`. |

Render from a normal terminal: sandboxed agent sessions on macOS can block Chromium.
`TMPDIR` and `PLAYWRIGHT_BROWSERS_PATH` can point to another disk when the system disk is full.
