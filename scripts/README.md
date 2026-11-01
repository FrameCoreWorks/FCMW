# scripts/

Cross-platform Node scripts (macOS, Windows, Linux). No shell-specific code.

| Script | Status | Purpose |
| --- | --- | --- |
| `validate.mjs` | ready | Checks skills against the Agent Skills spec, manifest consistency, the engine catalog and the no-brand rule. Run with `npm run validate`. |
| `new.mjs` | planned | Create a new film from a template with a starting beat grid. |
| `render.mjs` | planned | One command: music, picture, sound effects, mix, MP4, preview, contact sheet. |

Render must run from a normal terminal: sandboxed agent sessions on macOS can block Chromium.
`TMPDIR` and `PLAYWRIGHT_BROWSERS_PATH` can point to another disk when the system disk is full.
