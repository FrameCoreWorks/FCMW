# Changelog

## 0.1.0 (unreleased)

- Optional services: `integrations/catalog.json` (ElevenLabs, fal, Replicate, Runway, MiniMax,
  Google GenMedia, all `paid`), skill `connecting-services` with setup per agent, key safety and the
  asset manifest, read-only `npm run services` detection, and validation that rejects API keys in
  shipped files.
- Repository skeleton: licence, README, AGENTS.md, host manifests (Claude Code, Codex, Cursor,
  Gemini CLI, generic agent plugin), entry skill `fcwm`, engine catalog, directory contracts,
  `npm run validate` and its CI workflow.
