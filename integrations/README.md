# integrations/

Optional external services that generate assets for a film: voice-over, music, sound effects,
images, video. **None of them is required, bundled or switched on by default.** FCWM makes complete
films from code alone; a service is something the user may add to their own agent, with their own
account and key.

- [`catalog.json`](catalog.json): known services with `tier` (almost always `paid`), `kind`
  (`mcp-remote`, `mcp-local`, `api`), `auth`, endpoint or start command, the environment variable
  names they read, licence, upstream and the date these were checked. It holds no keys and no code.
- [`../scripts/services.mjs`](../scripts/services.mjs): shows which services are configured in the
  user's agents and which variables are set. Read-only, prints names only.

  ```
  npm run services
  ```

- [`../skills/connecting-services`](../skills/connecting-services/SKILL.md): how an agent checks,
  explains the cost, helps the user connect a service in Claude Code, Claude Desktop, claude.ai,
  Codex, Cursor, Gemini CLI, ChatGPT or VS Code, and keeps generated files inside the render
  contract.

Rules that apply to every entry:

1. The user decides. Agents offer the free, code-based path first and name the tier before a paid
   call.
2. Keys never enter the repository, a film folder, a log or the chat. Hosted servers with browser
   sign-in are preferred because no key exists in any file. `npm run validate` fails if something
   shaped like a real API key appears in a shipped file.
3. Generated assets are made once, saved under the film's `assets/` with a manifest entry, and read
   as files. No service is called while frames render, locally or in GitHub Actions.

## Checked on 2026-11-01

| Service | Server | Licence | Stars | Last push | Note |
| --- | --- | --- | --- | --- | --- |
| ElevenLabs | hosted `api.elevenlabs.io/v1/mcp` | proprietary service | n/a | n/a | Local `elevenlabs/elevenlabs-mcp` (MIT, 1.5k) is archived and points to the hosted server. |
| fal | hosted `mcp.fal.ai/mcp-relay` | proprietary service | n/a | n/a | Server free, runs billed per model. |
| Replicate | hosted `mcp.replicate.com` or npm `replicate-mcp` | Apache-2.0 (npm) | n/a | npm 2025-12-18 | Token entered in the sign-in page. |
| Runway | hosted `mcp.runwayml.com/mcp` | proprietary; plugin `runwayml/runway-mcp-plugin` MIT | 4 | 2026-09-11 | Old `runway-api-mcp-server` archived. |
| MiniMax | `MiniMax-AI/MiniMax-MCP` (`uvx minimax-mcp`) | MIT | 1.6k | 2026-08-20 | Key and host must match region. |
| Google GenMedia | `GoogleCloudPlatform/genmedia-creative-studio` (experiments) | Apache-2.0 | 1.2k | 2026-10-31 | Veo, Lyria, Chirp, Gemini image; Vertex AI billing. |

Considered and left out: `lumalabs/luma-api-mcp` (MIT, 26 stars, no push since 2025-04), community
Replicate and fal servers (the vendors now run official hosted ones). Add others with
[the checklist](../skills/connecting-services/references/adding-a-service.md).
