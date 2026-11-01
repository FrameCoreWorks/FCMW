# FCWM

Open motion graphics toolkit for AI agents. Your agent writes the film as code (2D, 3D and audio),
and your own machine or GitHub Actions renders it.

FCWM works with any agent that supports [Agent Skills](https://agentskills.io): Claude Code and the
Claude apps, Codex, ChatGPT, Cursor, Gemini CLI and others. It brings no brand and no house style.
You set the direction; FCWM brings the workshop: engines, a production method, quality control and
rendering.

> **Status: 0.1.0, skeleton.** The structure, manifests and entry skill are in place. Engines, the
> building block library, recipes, quality checks and the render CLI are being built. Nothing in
> this repository renders a film yet.

## Why code

No AI model runs at render time. The computer replays the code frame by frame, so every frame is
exact, repeatable and editable. The quality of the film is the quality of the code, which is why
FCWM ships the method, tested building blocks, annotated example films and lessons from real
productions: so that smaller models can make films close to what the strongest models make.

## What it will do

- **Picks the engine for the job** (motion-reel, HyperFrames, Manim, Blender, Lottie/SVG, audio
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

Any agent, via the [skills](https://github.com/vercel-labs/skills) installer:

```sh
npx skills add FrameCoreWorks/FCMW
```

Claude Code, as a plugin:

```text
/plugin marketplace add FrameCoreWorks/FCMW
/plugin install fcwm@fcwm
```

Gemini CLI, as an extension:

```sh
gemini extensions install https://github.com/FrameCoreWorks/FCMW
```

Codex and Cursor read the manifests in `.codex-plugin/` and `.cursor-plugin/`; agents that only read
`AGENTS.md` get the same instructions from the repository root.

## Repository layout

See [`AGENTS.md`](AGENTS.md#repository-layout). In short: `skills/` (Agent Skills), `engines/`,
`lib/` (building blocks), `recipes/` (annotated films), `knowledge/`, `templates/`, `brand-kit/`,
`qa/`, `scripts/`, `evals/`, `docs/`.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Run `npm run validate` before opening a pull request.

## Licence

[Apache License 2.0](LICENSE). Third-party components keep their own licences, listed in
[`NOTICE`](NOTICE).
