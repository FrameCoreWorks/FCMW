# Connecting an MCP server, per agent

Fill in `<name>`, `<url>`, `<command>` and the variable names from the service's entry in
`integrations/catalog.json`. Use a short lowercase `<name>` that matches the catalog `id`
(`elevenlabs`, `fal`, `replicate`, `runway`, `minimax`): `scripts/services.mjs` then recognises it.

Two shapes of server:

- **Remote** (`kind: mcp-remote`): a hosted URL. Nothing to install. Sign-in happens in the browser
  (OAuth), or the vendor's sign-in page asks for the key once. This is the preferred shape.
- **Local** (`kind: mcp-local`): a program on the user's machine, started by the agent. Usually
  `uvx <package>` (needs [uv](https://docs.astral.sh/uv/)) or `npx -y <package>` (needs Node). The
  key is read from an environment variable.

Menu names in desktop and web apps change often. If a step does not match what the user sees, send
them to the host's own MCP documentation rather than guessing.

## Claude Code

Remote, streamable HTTP, user-wide:

```
claude mcp add --transport http --scope user <name> <url>
```

Use `--transport sse` for URLs ending in `/sse` (Replicate). Then type `/mcp` in Claude Code and
sign in. `claude mcp list` shows what is configured.

Local, with the key kept out of any file: put the server in the project's `.mcp.json` and reference
the variable, which Claude Code expands at start-up from the user's environment:

```json
{
  "mcpServers": {
    "minimax": {
      "command": "uvx",
      "args": ["minimax-mcp", "-y"],
      "env": {
        "MINIMAX_API_KEY": "${MINIMAX_API_KEY}",
        "MINIMAX_API_HOST": "${MINIMAX_API_HOST:-https://api.minimax.io}"
      }
    }
  }
}
```

`claude mcp add <name> --scope user -e KEY=value -- <command>` also works, but stores the value in
`~/.claude.json` in plain text. Acceptable on a personal machine; never in a project file.

## Claude Desktop and claude.ai

Remote: Settings, Connectors, Add custom connector, paste the URL, then Connect and sign in. On
claude.ai this is the only option (it cannot start local programs). Custom connectors depend on
the user's plan.

Local (Desktop only): Settings, Developer, Edit Config opens `claude_desktop_config.json`:

| OS | Path |
| --- | --- |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "minimax": {
      "command": "uvx",
      "args": ["minimax-mcp", "-y"],
      "env": { "MINIMAX_API_KEY": "<your-api-key>", "MINIMAX_API_HOST": "https://api.minimax.io" }
    }
  }
}
```

This file holds the key in plain text and lives outside any repository: the user types the key in
themselves. Restart the app afterwards.

## Codex (CLI, IDE extension, app)

Codex keeps servers in `~/.codex/config.toml` (or `.codex/config.toml` in a trusted project).

Remote:

```
codex mcp add <name> --url <url>
```

```
codex mcp login <name>
```

Local, forwarding the key from the user's shell instead of storing it:

```
codex mcp add minimax --env MINIMAX_API_HOST=https://api.minimax.io -- uvx minimax-mcp -y
```

then add the forwarded variable to the same table in `config.toml`:

```toml
[mcp_servers.minimax]
command = "uvx"
args = ["minimax-mcp", "-y"]
env_vars = ["MINIMAX_API_KEY"]
```

For a remote server that takes a bearer token, `bearer_token_env_var = "NAME"` reads it from the
environment. `codex mcp list` shows what is configured.

## Cursor

`~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project). Cursor expands
`${env:NAME}`, so the file can be shared without the key:

```json
{
  "mcpServers": {
    "fal": { "url": "https://mcp.fal.ai/mcp-relay" },
    "minimax": {
      "command": "uvx",
      "args": ["minimax-mcp", "-y"],
      "env": { "MINIMAX_API_KEY": "${env:MINIMAX_API_KEY}", "MINIMAX_API_HOST": "https://api.minimax.io" }
    }
  }
}
```

Open Cursor's MCP settings to sign in to remote servers and switch servers on. Some vendors (fal,
Runway) also publish a Cursor plugin that adds the same server.

## Gemini CLI

`~/.gemini/settings.json` (user) or `.gemini/settings.json` (project).

```
gemini mcp add --scope user --transport http <name> <url>
```

Inside Gemini CLI, `/mcp auth <name>` signs in. In `settings.json`, `httpUrl` is a streamable HTTP
server, `url` an SSE server, `command` a local one; `env` values can reference `$NAME`:

```json
{
  "mcpServers": {
    "replicate": { "url": "https://mcp.replicate.com/sse" },
    "minimax": {
      "command": "uvx",
      "args": ["minimax-mcp", "-y"],
      "env": { "MINIMAX_API_KEY": "$MINIMAX_API_KEY", "MINIMAX_API_HOST": "https://api.minimax.io" }
    }
  }
}
```

## ChatGPT

Remote servers only. In ChatGPT settings, under apps and connectors, enable developer mode if the
plan requires it, create a connector with the server URL and sign in. Some vendors (fal) publish a
ready ChatGPT app, which is simpler. ChatGPT cannot run FCWM renders itself: finish with the command
the user pastes into a terminal.

## VS Code (Copilot agent mode)

`.vscode/mcp.json`. `inputs` prompts for the key once and stores it in VS Code, not in the file:

```json
{
  "inputs": [{ "type": "promptString", "id": "minimax-key", "description": "MiniMax API key", "password": true }],
  "servers": {
    "fal": { "type": "http", "url": "https://mcp.fal.ai/mcp-relay" },
    "minimax": {
      "type": "stdio",
      "command": "uvx",
      "args": ["minimax-mcp", "-y"],
      "env": { "MINIMAX_API_KEY": "${input:minimax-key}", "MINIMAX_API_HOST": "https://api.minimax.io" }
    }
  }
}
```

## A plain API, no MCP server

Some services only offer an HTTP API. Then the user sets the key as an environment variable (see
[keys.md](keys.md)), and you write a small script in the film folder that reads
`process.env.NAME` (or `os.environ["NAME"]`), makes one request, saves the file into `assets/` and
writes the manifest entry. The script fails with a clear message when the variable is missing. It
never prints the key and is never called from the film's frame code.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| `spawn uvx ENOENT` or `npx: command not found` | The agent cannot find uv or Node. Install it, or use the absolute path from `which uvx` (macOS, Linux) or `where uvx` (Windows) as `command`. |
| Server is configured but no tools appear | Restart the agent, then sign in (`/mcp`, `codex mcp login`, `/mcp auth`). Check the server is enabled in the host's MCP settings. |
| `invalid api key` | Wrong or expired key, or a regional mismatch (MiniMax: key and `MINIMAX_API_HOST` must be from the same region). The user creates a new key in the vendor's dashboard. |
| Variable shows `missing` in `services.mjs` | The variable is not exported in the shell that starts the agent. Desktop apps on macOS do not read `~/.zshrc`; put the key in the app's own config instead. |
| Sign-in page never returns | A browser blocker or a remote session without a local browser. Retry from a local terminal, or use the vendor's key-based local server. |
| Hosted server cannot read a local file | Remote servers only see uploads or public URLs. Use the server's upload tool, or a local server. |
| Too many tools slow the agent down | Turn off the tools you do not need in the host's MCP settings (`enabled_tools` in Codex, `includeTools` in Gemini CLI). |
| Unexpected charges | Set a spending limit in the vendor's dashboard. FCWM never retries paid calls on its own. |
