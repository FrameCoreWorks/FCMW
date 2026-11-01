# Adding a service to the catalog

The catalog lists services so agents can recognise and explain them. It is documentation, not an
integration: an entry never ships code, a key or a default that turns the service on.

1. **Look for an official server first.** Check the vendor's docs and GitHub for a hosted MCP URL
   or an official local server. Prefer, in this order: hosted with OAuth, hosted with a key entered
   at sign-in, official local server, a maintained community server, a plain HTTP API.
2. **Record the facts** in the pull request: repository or docs URL, licence, stars, date of the
   last push, whether it is archived. Flag GPL, custom or missing licences, and community servers
   that are not maintained (no push in the last 12 months).
3. **Add one entry** to `integrations/catalog.json`:

   | Field | Meaning |
   | --- | --- |
   | `id` | Short lowercase name; also the server name users are told to choose. |
   | `name`, `purpose` | Human name and one sentence on what it makes. |
   | `capabilities` | Any of `voice`, `music`, `sfx`, `image`, `video`, `transcription`. |
   | `kind` | `mcp-remote`, `mcp-local` or `api`. |
   | `endpoint` | Required for `mcp-remote`: the https URL. |
   | `command` | For `mcp-local`: how the agent starts it (`uvx ...`, `npx -y ...`). |
   | `auth` | `oauth`, `api-key` or `cloud-credentials`. |
   | `env` | Names of the environment variables it reads. Names only, never values. |
   | `tier` | `paid` when it bills the user, `restricted` for licence limits, `free` otherwise. |
   | `pricing_note` | How it bills, in one line. No prices that go stale. |
   | `license`, `upstream`, `notes` | Licence of the server code (or "Proprietary hosted service"), the source, caveats. |
   | `detect` | `names` (server names to recognise) and `match` (strings found in its config: URL host, package name). |
   | `status` | `listed` (documented from the vendor), `tested` (FCWM connected it and ran one generation), `deprecated`. |
   | `checked` | Date the licence, stars and activity were verified, `YYYY-MM-DD`. |

4. **If the setup differs from the patterns** in [hosts.md](hosts.md) (an unusual auth flow, a
   region-specific host), add a line to that file.
5. Run `npm run validate` and `npm test`. Validation rejects unknown values, a remote entry
   without an https endpoint, key-based auth without variable names, and anything in the repository
   that looks like a real API key.

Only mark an entry `tested` after a real connection and one generation, and say in the pull
request what was run.
