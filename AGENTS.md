# AGENTS.md

Instructions for any AI agent working in this repository or using it as a plugin
(Claude Code, Codex, Cursor, Gemini CLI, ChatGPT and any host that reads `AGENTS.md` or Agent Skills).

FCWM is an open motion graphics toolkit. An agent writes a film as code (2D, 3D and audio), and the
user's machine or GitHub Actions renders it. No AI model runs at render time: the computer replays the
code frame by frame, so the quality of the film is the quality of the code the agent writes.

> Status: 0.3.0. HyperFrames and motion-reel render end to end through `scripts/fcwm.mjs` (both
> experimental), also from a one-line installer (`scripts/install.sh`, `scripts/install.ps1`); Manim, Blender, Lottie and the brand kit are planned. Check a directory's `README.md`
> before relying on it, and never claim a feature works until it has been run.

## Ground rules

1. **The user sets the direction.** FCWM never imposes a brand, style, palette, typeface, tone or
   creative direction. When the brief is silent, ask or offer neutral options; do not fill the gap
   with a house style.
2. **No brand in the toolkit.** Nothing in this repository carries a company name, logo, colours or
   end card. A user's brand lives only in their own brand kit (`brand-kit/`), saved once and optional.
3. **Every tool is labelled.** Each engine, library and API carries exactly one tier:
   `free` (open source, no strings), `restricted` (free to use with licence limits, e.g. GPL, a
   company-size threshold or a no-compete clause) or `paid` (an API billed to the user's own key).
   Tell the user the tier before using anything that is not `free`. See `engines/catalog.json`.
4. **Look for existing solutions first.** Before adding an engine, library, template or tool, check
   GitHub, npm and PyPI for a maintained option. Record its licence, stars and last update in the PR.
   Prefer MIT, Apache-2.0 or BSD; flag GPL, custom or missing licences.
5. **Self-contained.** FCWM depends on no other plugin. Engines are installed by FCWM's own scripts.
6. **English in the repository.** Code, docs, skills and user-facing strings are in English. Talk to
   the user in their language.

## Render contract (all code-based engines)

Every film is a pure function of time: given `t`, the code paints exactly one frame, the same way
every time.

- No wall clock (`Date.now`, `performance.now`), no `setTimeout` or `requestAnimationFrame` driving
  the picture, no CSS transitions, no state carried from one frame to the next.
- Randomness only from seeded noise (a fixed seed per film), never `Math.random`.
- Frames may be rendered out of order and in parallel; any hidden state makes frames disagree.
- Time everything on the beat grid (`beats.json`) when the film has music, and list sound accents as
  hits so audio and picture stay in sync.
- The same frame rendered twice must produce the same image (checked by `qa/`).

## How a film is made

The entry skill is [`skills/fcwm`](skills/fcwm/SKILL.md). It asks the user for a mode and routes the
job to an engine:

- **Quick mode:** idea to finished film with one review at the end.
- **Full process:** brief, shot list, key frames, review rounds, render, delivery.

Quality gate (both modes): look at a contact sheet (one frame per beat) and a phone-size preview,
score hook, readability, motion quality, variety, brief fit and sound sync from 1 to 10, fix the three
weakest spots, and repeat until every category is 8 or more. Agents that cannot see images hand the
sheet to the user instead of scoring it themselves. Automated checks: -14 LUFS integrated and
-1 dBTP, constant fps, text inside the platform safe zone, no blank frames, deterministic frames.

An agent without a terminal (for example a chat app) hands the user one self-contained film folder,
asks for its path and gives one command to paste: `skills/fcwm/references/handoff.md`. Cloud renders
always run on the user's own GitHub account.

## Repository layout

| Path | Contents |
| --- | --- |
| `skills/` | Agent Skills (agentskills.io format), one directory per skill with a `SKILL.md`. Entry point: `skills/fcwm`. |
| `engines/` | Engine adapters and `catalog.json` (purpose, tier, licence, requirements, status per engine). |
| `lib/` | Reusable, tested motion building blocks (easing and springs, log-space zoom, point clouds, typography, cursor motion, transitions, audio synthesis). |
| `recipes/` | Complete annotated films: the code plus a "what happens here and why" walkthrough. |
| `knowledge/` | Craft lessons and checklists: what separated a finished film from a draft, and the fix. |
| `templates/` | Brand-neutral starting points and effects (transitions, title cards, captions). |
| `integrations/` | Optional external services (MCP servers, APIs) the user may connect for voice, music, images or video, with tier and setup. Nothing bundled; see `skills/connecting-services`. |
| `brand-kit/` | Schema for the optional user brand kit. Empty by default. |
| `qa/` | Automated quality checks and the scoring rubric. |
| `scripts/` | Cross-platform Node CLI (macOS, Windows, Linux): new film, render, validate. |
| `evals/` | Plugin test suite: the same tasks run on several models, results recorded per release. |
| `docs/` | Longer documentation. |
| `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `gemini-extension.json`, `plugin.json` | Host manifests. All point at `./skills/` and share one version. |

## Working on this repository

- Run `npm run validate` before every commit. It checks every `SKILL.md` against the Agent Skills
  spec, keeps all manifests on the same name and version, checks the engine catalog, and fails if a
  brand name slips into shipped files.
- Bump the version in every manifest and `package.json` together.
- Third-party code keeps its licence: add the upstream `LICENSE` next to it and a line in `NOTICE`.
- Keep `SKILL.md` files under about 500 lines; move detail into the skill's `references/`.
