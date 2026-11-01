# Changelog

## 0.3.0 (unreleased)

- Manim engine (experimental): Manim Community 0.22.1 (MIT) through `uv run --with`, pinned, not
  vendored. `fcwm new <film> --engine manim` starts from a brand-neutral, LaTeX-free scene; films may
  list several formats (each rendered on its own canvas); `--alpha` delivers ProRes 4444 / WebM alpha.
  Contact sheets and stills are cut from a draft render with ffmpeg. `fcwm setup` installs Pango and
  Cairo headers on Linux. Skill `fcwm-manim`; Manim added to the smoke test.
- Extra delivery formats: `fcwm render <film> --export gif,webm,mov` (or `"exports"` in film.json)
  transcodes the delivered MP4 to GIF, WebM VP9 and ProRes 422 HQ. Transparency: `fcwm new <film>
  --alpha` starts a HyperFrames film on a transparent ground and renders `mov-alpha` (ProRes 4444) or
  `webm-alpha` (VP9 with alpha) straight from the engine. QA checks every export exists, has the right
  size, and that alpha exports really carry an alpha channel.
- No renders for pull requests from forks: the `smoke` and `install` jobs skip unless the pull request
  comes from a branch of this repository; fork pull requests get only `validate` (no browser, no ffmpeg).
  `npm run validate` fails if a rendering job loses that guard or any workflow uses
  `pull_request_target`. Maintainer settings to click: `docs/render-in-github-actions.md`.
- Path-traced 3-D quality mode on motion-reel (experimental): `fcwm new <film> --pathtrace` traces the
  same three.js sets with three-gpu-pathtracer 0.0.27 (MIT) for real reflections, glass, soft area
  light shadows and depth of field. Fixed samples per frame, seeded sequences, motion-blur sub-frames
  share the budget; `--spp`, `--pt-scale`, `--draft` on the renderer, low-sample contact sheets,
  one worker. Listed as a `modes` entry on motion-reel in `engines/catalog.json` (validated). A
  determinism and non-black test frame runs in the smoke workflow. Guide: `references/pathtrace.md`.
- The motion-reel renderer serves `/node_modules/` from the FCWM install when the films folder has
  none, so 3-D films need no npm step of their own (three, opentype.js and the path tracer are pinned in
  FCWM's `package.json`).
- Render hand-off for any agent: one self-contained film folder, its path, one command.
  `scripts/install.sh` (macOS, Linux) and `scripts/install.ps1` (Windows) install Node.js and FCWM only
  when missing, then `fcwm run <folder>` installs only the tools the film lacks and renders into
  `<folder>/render/`. Every run re-detects tools and records them in `~/.fcwm/state.json`; the run
  prints the short command for next time.
- `fcwm run`, `fcwm setup`, `fcwm command` (the exact line per OS, quoted for any path).
- `fcwm run --cloud`: renders in GitHub Actions on the user's own account (private `fcwm-renders`
  repository via the GitHub CLI) and downloads the result into the same folder. Workflow template
  `templates/cloud-render/fcwm-render.yml`; by-hand browser steps in `docs/render-in-github-actions.md`.
- motion-reel writes its intermediate files to `<film>/.fcwm/out` (`MOTION_REEL_OUT`), so nothing lands
  outside the film folder. Films record the FCWM version in `film.json` (`fcwm`).
- Skill reference `skills/fcwm/references/handoff.md`; docs `render-on-your-computer.md`.
- Workflow `install`: the installers on Linux, macOS and Windows in a path with a space, `&` and `'`.

## 0.2.0 (unreleased)

- `scripts/fcwm.mjs`: cross-platform CLI (`new`, `render --check/--at`, full render with mix and phone
  preview, `qa --determinism`, `doctor`, `engines`, `--dry-run`), replacing the zsh starter scripts.
- Engines: motion-reel 1.3.0 vendored (MIT) with an adapter; HyperFrames 0.8.226 through pinned npx with
  telemetry off and a brand-neutral, GSAP-free starter (`templates/hyperframes-blank`).
- Automated QA after every render (`qa/checks.mjs`): loudness and true peak, constant fps, canvas size,
  flat frames, byte-identical re-renders; report in `render/qa.json`.
- Skills: engine router and quick/full modes in `fcwm`, engine skills `fcwm-hyperframes` and
  `fcwm-motion-reel`, references copied into each skill (`scripts/sync-skill-refs.mjs`, checked by
  validate).
- Workflows: `smoke` (one film per engine on every PR), `render` (manual cloud render), Node 22.

## 0.1.0 (unreleased)

- Optional services: `integrations/catalog.json` (ElevenLabs, fal, Replicate, Runway, MiniMax,
  Google GenMedia, all `paid`), skill `connecting-services` with setup per agent, key safety and the
  asset manifest, read-only `npm run services` detection, and validation that rejects API keys in
  shipped files.
- Repository skeleton: licence, README, AGENTS.md, host manifests (Claude Code, Codex, Cursor,
  Gemini CLI, generic agent plugin), entry skill `fcwm`, engine catalog, directory contracts,
  `npm run validate` and its CI workflow.
