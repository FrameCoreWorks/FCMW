# Changelog

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
