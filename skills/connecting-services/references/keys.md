# Keeping API keys safe

A key is the user's money. The agent never asks for it in the chat, never writes it into a file it
creates, and never prints it. The user puts it in one of these places themselves.

## Best: no key at all

Hosted servers with browser sign-in (OAuth) keep the credential inside the agent. Nothing to copy,
nothing to leak, and the user can revoke access in the vendor's dashboard.

## Environment variable in the user's shell

macOS and Linux (zsh or bash), added once to `~/.zshrc` or `~/.bashrc`:

```
export ELEVENLABS_API_KEY="<your-api-key>"
```

Windows (PowerShell), stored for the user account:

```
setx ELEVENLABS_API_KEY "<your-api-key>"
```

Open a new terminal afterwards. Desktop apps started from the Dock or Start menu may not see shell
variables; for those use the app's own MCP config.

## A `.env` file next to the film

For per-project keys: a `.env` or `.env.local` file in the film's folder, listed in `.gitignore`
(FCWM's own `.gitignore` already ignores both). `scripts/services.mjs` reports a variable found
there as `in .env` without reading its value. Scripts load it explicitly, for example with
`node --env-file=.env` (Node 20.6+).

Never commit it. If a key was committed or pasted anywhere public, revoke it in the vendor's
dashboard and create a new one; deleting the commit is not enough.

## GitHub Actions

Prefer committing the generated assets so CI needs no key. If CI must call a service, store the key
as a repository secret and pass it to the one step that needs it:

```
gh secret set ELEVENLABS_API_KEY
```

```yaml
- run: node assets/generate.mjs
  env:
    ELEVENLABS_API_KEY: ${{ secrets.ELEVENLABS_API_KEY }}
```

Secrets are not available to workflows triggered from forks; such runs must fall back to the
committed assets.

## Spending

Set a monthly limit or a low prepaid balance in each vendor's dashboard. Tell the user before every
paid call that is long or repeated.
