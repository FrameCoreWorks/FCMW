# FCWM

Open motion graphics toolkit for AI agents. Your agent writes the film as code (2D, 3D and audio),
and your own machine or GitHub Actions renders it.

FCWM works with any agent that supports [Agent Skills](https://agentskills.io): Claude Code and the
Claude apps, Codex, ChatGPT, Cursor, Gemini CLI and others. It brings no brand and no house style.
You set the direction; FCWM brings the workshop: engines, a production method, quality control and
rendering.

> **Status: 0.3.0.** Established open engines render end to end: HyperFrames (the default: 2-D, 3-D with
> three.js, synthesized music, Lottie and animated SVG), Manim (equations, graphs, technical
> explainers) and Blender (photoreal 3-D with Cycles; GPL, tier restricted), driven by one
> cross-platform command with automated quality checks, extra formats (GIF, WebM, ProRes, transparent
> ProRes 4444 / WebM), optional brand kits, tested film blocks (transitions, titles, lower thirds,
> captions, end cards) and a one-line installer that sets up the whole render toolkit and renders a film
> folder on any computer. Tested end to end on Linux (CI), Windows (CI) and an Apple M4 Mac; path-traced
> 3-D (through the vendored motion-reel toolkit, on request only) is the one experimental mode.

## Why code

No AI model runs at render time. The computer replays the code frame by frame, so every frame is
exact, repeatable and editable. The quality of the film is the quality of the code, which is why
FCWM ships the method, tested building blocks, annotated example films and lessons from real
productions: so that smaller models can make films close to what the strongest models make.

## What it will do

- **Picks the engine for the job** (HyperFrames with three.js, Manim, Blender, Lottie/SVG, audio
  synthesis and more) and tells you its licence tier first.
- **Two ways to work:** quick mode (idea to film) or the full process (brief, shot list, key frames,
  review rounds, render).
- **Every format:** any aspect ratio with its own composition per format, transparent video
  (ProRes 4444, WebM with alpha), GIF, Lottie, animated SVG.
- **Quality control:** a scored review of contact sheets (every category 8/10 or more) plus automated
  checks for loudness, frame rate, safe zones, blank frames and determinism.
- **Render anywhere:** one command on macOS, Windows or Linux, or a GitHub Actions workflow.
- **Optional brand kit:** save your logo, colours, fonts and end card once. Off by default.

## Licence tiers

Every engine and tool is labelled so you know what you are agreeing to:

| Tier | Meaning |
| --- | --- |
| `free` | Open source, free for any use (MIT, Apache-2.0, BSD and similar). |
| `restricted` | Free to use with licence limits, e.g. GPL, a company-size threshold or custom terms. |
| `paid` | A paid API billed to your own key. Never required. |

The current list is in [`engines/catalog.json`](engines/catalog.json).

## Install

ChatGPT Work: in a new chat pick **Plugin Creator** from the `@` menu and paste

```text
@Plugin Creator Install the FCWM plugin from https://github.com/FrameCoreWorks/FCWM for me. Read INSTALL.md in that repository first (the ChatGPT Work section), then follow it step by step.
```

Any other agent that can read GitHub (Codex, Claude, Cursor, Gemini): paste

```text
Install the FCWM plugin from https://github.com/FrameCoreWorks/FCWM for me. Follow INSTALL.md in that
repository. Prefer your native plugin or skill installer.
```

The agent follows [INSTALL.md](INSTALL.md). Or install it yourself.

Any agent, via the [skills](https://github.com/vercel-labs/skills) installer:

```sh
npx skills add FrameCoreWorks/FCWM
```

Claude Code, as a plugin:

```text
/plugin marketplace add FrameCoreWorks/FCWM
/plugin install fcwm@fcwm
```

Gemini CLI, as an extension:

```sh
gemini extensions install https://github.com/FrameCoreWorks/FCWM
```

Codex and Cursor read the manifests in `.codex-plugin/` and `.cursor-plugin/`; agents that only read
`AGENTS.md` get the same instructions from the repository root.

ChatGPT (Work, Business, Enterprise, Edu): paste the Plugin Creator prompt above into a chat, or (workspace admins)
import the repository as a plugin marketplace, or upload a plugin ZIP: [FCWM in ChatGPT](docs/install-chatgpt.md).

## Render a film

The skills tell the agent what to run; rendering needs the full repository on your machine:

```sh
git clone https://github.com/FrameCoreWorks/FCWM
cd FCWM
npm install
npx playwright install chromium
node scripts/fcwm.mjs doctor
```

Then, from any folder (Node 22+ and FFmpeg required; `uv` only for synthesized scores in Python):

```sh
node <path-to-FCWM>/scripts/fcwm.mjs new my-film              # HyperFrames, 9:16, 15 s
node <path-to-FCWM>/scripts/fcwm.mjs new my-3d --3d --score     # three.js scene + synthesized score
node <path-to-FCWM>/scripts/fcwm.mjs render my-film --check   # contact sheets in my-film/render/
node <path-to-FCWM>/scripts/fcwm.mjs render my-film           # MP4, phone preview, QA report
```

Your agent has no terminal? It hands you one film folder and one line to paste, which installs only
what is missing and renders into that folder: [render on your computer](docs/render-on-your-computer.md).
No GPU or a phone only: [render in GitHub Actions](docs/render-in-github-actions.md) on your own GitHub account.

## Repository layout

See [`AGENTS.md`](AGENTS.md#repository-layout). In short: `skills/` (Agent Skills), `engines/`,
`lib/` (building blocks), `recipes/` (annotated films), `knowledge/`, `templates/`, `brand-kit/`,
`qa/`, `scripts/`, `evals/`, `docs/`.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Run `npm run validate` before opening a pull request.

## Licence

[Apache License 2.0](LICENSE). Third-party components keep their own licences, listed in
[`NOTICE`](NOTICE).
