# Stage 2: core and two engines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One cross-platform command (`node scripts/fcwm.mjs`) creates, renders and checks a film on either
engine: HyperFrames (default for 2-D) or motion-reel (3-D, generative, synthesized audio).

**Architecture:** motion-reel is vendored (MIT) under `engines/motion-reel/` because FCWM must work without
other plugins and the engine is small (about 3,200 lines). HyperFrames is not vendored: it is a large,
fast-moving Apache-2.0 CLI, so the adapter runs a pinned version through `npx`. Each engine exposes the
same adapter interface; the CLI picks the adapter from `film.json` (`"engine"`), then runs the shared QA
checks on the output.

**Tech Stack:** Node 22 (ES modules, `node:test`), Playwright (motion-reel frames), ffmpeg/ffprobe,
`hyperframes@0.8.226` via npx, Python 3 with `uv` (motion-reel audio scripts).

**Spec:** `/mnt/project-files/docs/handover-wtyczka-fcwm-motion.md` (steps 2-5) and the stage 2 scope
approved on 2026-11-01: core, render contract, quick/full modes, engine router with licence tiers,
automated QA (LUFS, fps, blank frames, determinism), GitHub Actions render.

## Existing solutions checked (2026-11-01)

| Option | Licence | Stars | Last update | Decision |
| --- | --- | --- | --- | --- |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) (npm `hyperframes` 0.8.226) | Apache-2.0 | 76.7k | 2026-11-01 | Use as is, pinned, via adapter. Needs Node >= 22. Telemetry off via `HYPERFRAMES_NO_TELEMETRY=1`, `DO_NOT_TRACK=1`. |
| GSAP (npm `gsap` 3.15.0) | GSAP Standard "no charge" licence (custom, no-compete clause) | 30k | 2026-04-13 | Tier `restricted`. Only used when a HyperFrames film imports it; warn first. |
| motion-reel (starter `engine/`) | MIT (Aries Spring) | n/a | 2026 | Vendor, keep LICENSE, add NOTICE line. Its `render.mjs` is already Node + Playwright + ffmpeg, so only the zsh wrapper needs porting. |
| [tungs/timecut](https://github.com/tungs/timecut) | BSD-3-Clause | 655 | 2023-07 | Not used: virtual-time capture is for wall-clock pages; our films are pure `seek(t)`. Stale. |
| puppeteer-capture | MIT | 22 | 2026-10 | Not used, same reason; too small. |
| @remotion/renderer | Remotion licence (company-size threshold) | n/a | 2026-10 | Not used in stage 2; would be `restricted`. |

## Global Constraints

- Node `>=22` in `package.json` `engines` and in every workflow (`actions/setup-node` `node-version: 22`).
- No runtime dependency added to the repo root except `playwright` (devDependency) and `three` (optional peer for 3-D films); HyperFrames runs through `npx -y hyperframes@0.8.226`.
- Pin `HYPERFRAMES_VERSION = '0.8.226'` in one place: `engines/hyperframes/adapter.mjs`.
- Every engine in `engines/catalog.json` has `tier` in `free | restricted | paid`; CLI prints the tier of any non-`free` tool before running it.
- QA thresholds: integrated loudness `-14 LUFS ± 1`, true peak `<= -1.0 dBTP`, constant frame rate (every frame duration equal to `1/fps` within 1 %), no frame with mean luma `< 2` (0-255) unless the film declares it in `film.json` `"allowBlank": [[a, b], ...]` seconds, determinism: the same frame rendered twice has identical PNG bytes.
- Safe zone (9x16): text boxes inside x 6 %-94 %, y 10 %-80 % of the frame (platform UI). 16x9 and 1x1: 5 % margin.
- No brand names in shipped files (`npm run validate`). English in repo.
- Never `Date.now`, `Math.random` in films or templates.

## Review Focus

1. Paths with spaces (macOS volume `/Volumes/Codex&Claude/...`, Windows `C:\Users\Jan Kowalski\`): every child process uses `spawn(cmd, argsArray)` without `shell: true` except `npx` on Windows, which uses `shell: true` with each argument quoted. Test: `buildCommand` quotes a path with a space and an `&`.
2. Missing tool (no ffmpeg, no uv, no Chromium): `fcwm doctor` and every command fail with one line naming the missing tool and the install command for the current OS, exit code 2, never a stack trace. Test: `checkTools` with an empty PATH.
3. A film whose fonts or images fail to load must still render (readiness times out after 10 s with a warning). Test lives in Task 2 smoke (template with a missing font file).
4. A silent film (no `audio/`) must pass QA: loudness check reports `skipped: no audio` instead of failing. Test in Task 4.
5. Re-running `fcwm new` on an existing directory refuses and changes nothing. Test in Task 3.

---

### Task 1: Vendor motion-reel and move CI to Node 22

**Files:**
- Create: `engines/motion-reel/` (copy of starter `engine/`: `assets/`, `scripts/`, `references/`, `prompts/`, `LICENSE`, `README.md` from the engine SKILL.md body), minus `__pycache__`
- Create: `skills/fcwm-motion-reel/SKILL.md` (engine skill, adapted from the starter `engine/SKILL.md`, paths pointing at `../../engines/motion-reel/`)
- Modify: `NOTICE` (one line: motion-reel, MIT, Aries Spring), `engines/catalog.json` (`motion-reel` status `available`), `package.json` (`engines.node >=22`, devDependency `playwright`), `.github/workflows/validate.yml` (node 22)
- Move: starter `narzedzia/audit-zfight.mjs` → `qa/audit-zfight.mjs`

- [ ] Copy, strip any brand string, run `npm run validate` → passes.
- [ ] `node engines/motion-reel/scripts/scaffold.mjs demo` in a temp dir creates `demo/index.html` → confirmed.
- [ ] Commit `feat(engines): vendor motion-reel (MIT)`.

### Task 2: Engine adapter interface and motion-reel adapter

**Files:**
- Create: `scripts/lib/proc.mjs`, `scripts/lib/tools.mjs`, `engines/motion-reel/adapter.mjs`, `scripts/test/adapters.test.mjs`

**Interfaces (Produces):**
- `run(cmd: string, args: string[], {cwd, env}) -> Promise<{code, stdout, stderr}>` and `buildCommand(cmd, args, platform) -> {file, args, shell}` in `proc.mjs`.
- `checkTools(names: string[], {path}) -> {ok: boolean, missing: {name, hint}[]}` in `tools.mjs` (hints per `process.platform`: brew / winget / apt).
- Adapter shape (both engines): `{ id, tier, requires: string[], scaffold(dir, opts) , plan(film, mode, opts) -> Step[] }` where `Step = {label, cmd, args, cwd, env?}`. `mode` is `full | check | at | preview`. The CLI executes steps; adapters only describe them, so they are testable without rendering.

- [ ] Tests: `buildCommand('npx', ['x', '/a b&c'], 'win32')` quotes the path; motion-reel `plan(film,'check')` is `[score (if audio/score.py), render --contact]`; `plan(film,'full')` is `[score, render --video-only, sfx, mix, preview]`, matching the old `render.sh` order; `checkTools(['ffmpeg'], {path: ''})` returns missing with a hint.
- [ ] Implement until `npm test` passes.
- [ ] Commit.

### Task 3: CLI `scripts/fcwm.mjs`

**Files:** Create `scripts/fcwm.mjs`, `scripts/lib/args.mjs`, `scripts/lib/film.mjs`, `scripts/test/cli.test.mjs`; modify `package.json` (`"bin": {"fcwm": "scripts/fcwm.mjs"}`, `"test"` runs `lib/test` and `scripts/test`).

Commands: `new <slug> [--engine hyperframes|motion-reel] [--format 9x16|16x9|1x1] [--duration s]`,
`render <film> [--check | --at 3.2,7.5 | --preview] [--format]`, `qa <film|video.mp4>`, `doctor`,
`engines` (prints catalog with tiers). Default engine `hyperframes`; `--3d` implies `motion-reel`.
Outputs land in `<film>/render/` (`<film>-<format>.mp4`, `<film>-preview.mp4`, `contact_p*.png`).

- [ ] Tests: `parseArgs`; `loadFilm` reads `film.json` (`engine` default `hyperframes`, `formats` default `['9x16']`); `new` refuses an existing dir (Review Focus 5); `--dry-run` prints the step list.
- [ ] Implement; `node scripts/fcwm.mjs new demo --engine motion-reel && node scripts/fcwm.mjs render demo --check` produces `demo/render/contact_p1.png` locally.
- [ ] Commit.

### Task 4: QA checks

**Files:** Create `qa/checks.mjs`, `qa/test/checks.test.mjs`; modify `qa/README.md`.

**Produces:** `loudness(file) -> {lufs, truePeak, pass, skipped?}` (ffmpeg `ebur128=peak=true`), `frameRate(file, fps) -> {pass, worstDelta}` (ffprobe `-show_entries frame=pts_time`), `blankFrames(file, allow) -> {pass, spans}` (ffmpeg `signalstats` YAVG), `determinism(adapter, film, times) -> {pass, diffs}` (renders `--at` twice, compares bytes), `safeZone(boxes, format) -> {pass, offenders}` (boxes from the page's `window.FILM_TEXT_BOXES` if exported, else skipped), `runAll(film) -> report` written to `<film>/render/qa.json`.

- [ ] Tests with ffmpeg lavfi fixtures generated in a temp dir: a -14 LUFS tone passes, a -6 LUFS tone fails, a silent video reports `skipped`, a 1 s black segment is reported, a VFR file fails. Tests skip with a printed reason when ffmpeg is absent (Windows/macOS runners), never silently.
- [ ] Wire `fcwm qa` and run QA at the end of `fcwm render` (full mode).
- [ ] Commit.

### Task 5: HyperFrames adapter

**Files:** Create `engines/hyperframes/adapter.mjs`, `engines/hyperframes/README.md`, `skills/fcwm-hyperframes/SKILL.md`, `templates/hyperframes-blank/` (brand-neutral starter: `index.html` with `data-fps`, `film.json` `{engine: "hyperframes"}`), extend `scripts/test/adapters.test.mjs`.

- `scaffold` copies `templates/hyperframes-blank` (no network). `plan('full')` → `npx -y hyperframes@0.8.226 render <dir> -o <film>/render/<film>-<format>.mp4 -q delivery --strict`; `check` → `hyperframes check` then `snapshot`; env always has `HYPERFRAMES_NO_TELEMETRY=1`, `DO_NOT_TRACK=1`.
- Skill states the render contract for HyperFrames (seekable timeline, no wall clock), marks GSAP `restricted`, and points at `lib/dom/*` for cursor/iris/glass blocks.

- [ ] Tests: env contains both opt-outs; version pinned; plan args exact.
- [ ] Smoke: `fcwm new hf-demo && fcwm render hf-demo` produces an MP4 that passes `fcwm qa` (fps, blank).
- [ ] Commit.

### Task 6: Entry skill: router, modes, packaging

**Files:** Modify `skills/fcwm/SKILL.md`; create `skills/fcwm/references/engines.md`, `scripts/sync-skill-refs.mjs`; modify `scripts/validate.mjs` (fails when synced copies drift).

- Router: 2-D type, UI, captions, slides → `hyperframes`; 3-D, point clouds, voxel characters, generative, synthesized score → `motion-reel`; anything else asks the user with both options and their tiers.
- Paid tools and MCP servers (for example voice or image APIs) are never built in. The catalog schema
  does not list them: optional services live in `integrations/catalog.json` (another thread); the router only offers such a tool
  when the user has configured it, and says it bills their own key. How to connect them is documented
  by a separate thread, not here.
- Quick mode (one review at the end) and full mode (brief → shot list → key frames → review rounds → render → delivery), both ending in the quality gate and `fcwm qa`.
- Packaging: `sync-skill-refs.mjs` copies `knowledge/*.md` into `skills/directing-motion-films/references/` and the render contract into each engine skill, so a skill installed alone with `npx skills add` still has its references; skills say the CLI needs the full repo (`git clone`).

- [ ] `npm run validate` passes; drift check fails when a copy is edited by hand.
- [ ] Commit.

### Task 7: GitHub Actions render

**Files:** Create `.github/workflows/render.yml`, `.github/workflows/smoke.yml`; add `docs/render-in-github-actions.md`.

- `render.yml`: `workflow_dispatch` with input `film` (path); ubuntu, node 22, ffmpeg, `npx playwright install --with-deps chromium`, `uv`, runs `node scripts/fcwm.mjs render $film`, uploads `<film>/render/` as artifact.
- `smoke.yml` on PR: scaffold one film per engine, render `--check` (motion-reel) and a 2 s full render (HyperFrames), run QA.

- [ ] Both workflows green on the PR.
- [ ] Commit, open PR "Stage 2: core and two engines".
