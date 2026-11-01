---
name: connecting-services
description: Use when a film needs an asset FCWM cannot write as code (voice-over, a cloned or designed voice, generated music or sound effects, a photoreal image or video clip), or when the user asks to connect ElevenLabs, fal, Replicate, Runway, MiniMax, Google Veo or Lyria, any other MCP server or an API key. Checks what is already connected, states the cost tier, walks the user through setup in their own agent without ever handling the key, and keeps generated assets inside the render contract.
license: Apache-2.0
compatibility: Any agent that reads Agent Skills. The detection script needs Node 18+; without a shell, ask the user and check your own tool list.
metadata:
  version: "0.1.0"
---

# Connecting optional services

FCWM makes films from code and needs no account or key. External services (MCP servers and APIs
that generate voice, music, sound effects, images or video) are an option the user can add to their
own agent. FCWM never bundles, installs or hard-codes one. This skill tells you how to check what the
user already has, how they connect something new, and how to use the result without breaking the
render contract.

`<repo>` below is the plugin root, two levels above this file. The list of known services, with
tier, licence, endpoint, auth and the environment variables each one reads, is
`<repo>/integrations/catalog.json`.

## Rules

1. **Optional, always.** Offer the free path first: synthesized score and effects, code-drawn
   images, the user's own files. Suggest a service only when the brief needs something code cannot
   make well (a human-sounding voice-over, a photoreal shot), and let the user decide.
2. **Say the tier before use.** Almost every service is `paid`: it bills the user's account. Name
   the service, what it bills (credits, per run, per second) and, if the server can report a price,
   the estimate. Wait for a yes before the first paid call in a session.
3. **Never touch a key.** Never ask the user to paste a key into the chat, never write one into a
   file in the repository, a film folder, a commit, a log or a message. Keys live in the user's agent
   config, their shell environment or an untracked `.env`, set by the user (see
   [references/keys.md](references/keys.md)). Prefer services that sign in through the browser
   (OAuth): then no key exists in any file.
4. **One call per take.** Do not retry a failed or disappointing generation on your own: each call
   costs money. Report the result and ask. Ask again before anything long or expensive (video,
   long music, many variations).
5. **Nothing paid at render time.** Generated assets are not a pure function of time. Generate
   them once, before the build, save them as files and let the film read the files (see section 4).

## 1. Check what is connected

Do these in order and stop when you have the answer:

1. **Your own tool list.** If the service's tools are already available to you (for example tool
   names containing `elevenlabs`, `fal`, `replicate`, `runway`, `minimax`, `veo`), it is connected.
   Web connectors (claude.ai, ChatGPT) are only visible this way.
2. **The detection script**, if you have a shell. It reads the MCP entries in the user's agent
   config files and the environment variable names, and prints only names and yes or no, never a
   value:

   ```
   node <repo>/scripts/services.mjs --json
   ```

   A service listed under `configuredIn` is set up in that agent; the agent may need a restart or a
   sign-in (`/mcp` in Claude Code, `codex mcp login <name>`, `/mcp auth <name>` in Gemini CLI)
   before its tools appear. `env` says `set`, `in .env` or `missing` for each variable.
3. **Ask the user** which services they use, if neither of the above answers it.

Tell the user in one line what you found, for example: "ElevenLabs is connected (paid, your
credits); nothing for video is connected."

## 2. Choose a service

Match the need to `capabilities` in the catalog (`voice`, `music`, `sfx`, `image`, `video`,
`transcription`). Prefer, in this order:

1. one the user already has connected;
2. `mcp-remote` with `auth: oauth` (hosted, browser sign-in, no key in a file);
3. `mcp-remote` with a key entered in the vendor's sign-in page;
4. `mcp-local` with a key in an environment variable.

Skip entries with `status: deprecated` unless the user already runs them. `status: listed` means the
setup is written from the vendor's documentation and FCWM has not run it end to end: say so if the
user hits a problem. The user can pick any service that is not in the catalog; treat it the same way.

## 3. Help the user connect it

Give the steps for the user's agent from [references/hosts.md](references/hosts.md): Claude Code,
Claude Desktop and claude.ai, Codex, Cursor, Gemini CLI, ChatGPT, VS Code. Put each command the user
pastes in its own code block, with the server name and URL from the catalog filled in and the key
left as a placeholder or read from an environment variable. If you have a shell and the user asks
you to, you may run the `mcp add` command yourself, but only with an environment variable reference,
never a key value you were given.

After the user has connected it, run step 1 again to confirm, then continue the film.

## 4. Use generated assets in a film

1. Generate before the build, never inside the film's code and never in a render or CI job.
2. Save each kept take under the film's `assets/` folder with a plain name
   (`assets/vo-line-03.mp3`, `assets/shot-07-sky.mp4`).
3. Record it in `assets/manifest.json`, one entry per file:

   ```json
   {
     "file": "assets/vo-line-03.mp3",
     "service": "elevenlabs",
     "model": "model id as reported by the service",
     "prompt": "the exact text or prompt sent",
     "settings": { "voice": "voice id or name", "seed": 1234 },
     "created": "2026-11-01",
     "cost": "as reported, or unknown",
     "terms": "who owns the output and any attribution the service requires"
   }
   ```

4. The film loads the file like any other asset. Frames stay a pure function of time, so a
   re-render gives the same film without calling the service again.
5. Run the usual checks: generated audio goes through the loudness check (-14 LUFS, -1 dBTP) with
   the rest of the mix; generated video is conformed to the film's fps and size before use.
6. Tell the user where each file is, what it cost if known, and that the service's own terms apply
   to commercial use.

For GitHub Actions renders, commit the asset files (or fetch them from the user's storage) so CI
never needs a key. If the user insists on generating in CI, the key goes into the repository's
Actions secrets, never into the workflow file.

## 5. Add a service to the catalog

Follow [references/adding-a-service.md](references/adding-a-service.md): check for an official
server first, record licence, stars and last update, add one entry, run `npm run validate`.

## Problems

See the troubleshooting section of [references/hosts.md](references/hosts.md#troubleshooting). If a
service fails, say what failed in plain words, do not retry a paid call, and offer the free path.
