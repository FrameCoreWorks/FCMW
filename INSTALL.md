# Installing FCWM

## For you (the person)

**ChatGPT Work:** open a new chat, pick **Plugin Creator** from the `@` menu and paste:

```text
@Plugin Creator Install the FCWM plugin from https://github.com/FrameCoreWorks/FCWM for me. Read INSTALL.md in that repository first (the ChatGPT Work section), then follow it step by step.
```

The same sentence updates FCWM later; your own additions to the plugin stay.

**Any other agent** (Codex, Claude, Cursor, Gemini or any agent that can read GitHub):

```text
Install the FCWM plugin from https://github.com/FrameCoreWorks/FCWM for me. Follow INSTALL.md in that
repository. Prefer your native plugin or skill installer.
```

When it is done, start a new chat and ask for a film ("make a 10-second 9:16 promo for ...") or call
`@fcwm`.

## For the agent doing the install

FCWM is a plugin made of Agent Skills (agentskills.io format). Installing it means installing the
skills; nothing has to run, no key or account is needed, and no engine is installed at this point.

**What to install.** Every folder in `skills/` of this repository, each with its `SKILL.md` and its
whole `references/` folder kept next to it (the skills read those files):

| Skill | Role |
| --- | --- |
| `fcwm` | entry point: modes, brief, engine choice, quality gate, hand-off |
| `directing-motion-films` | the craft method and the block reference |
| `fcwm-hyperframes`, `fcwm-motion-reel`, `fcwm-manim`, `fcwm-blender` | one per render engine |
| `connecting-services` | optional paid services the user may connect later |

Install them together, as one plugin named `fcwm` when your host has plugins (the manifest is
`.codex-plugin/plugin.json`, whose `skills` points at `./skills/`; Claude hosts use `.claude-plugin/`),
or as seven skills when it only has skills. Use the default branch, or a release tag if
the user names one.

**By host:**

| Host | How |
| --- | --- |
| ChatGPT Work (web, desktop) | Plugin Creator, rebuilding the plugin file by file: see [ChatGPT Work](#chatgpt-work-install-and-update-without-a-zip) below. |
| ChatGPT workspace admin | Admin console > Plugins > Add > Import marketplace, source `https://github.com/FrameCoreWorks/FCWM` (manifest `.claude-plugin/marketplace.json`), synced daily. See `docs/install-chatgpt.md`. |
| Codex | Your skill installer (`$skill-installer`) with this repository, all seven skills. |
| Claude Code | `/plugin marketplace add FrameCoreWorks/FCWM`, then `/plugin install fcwm@fcwm` |
| Gemini CLI | `gemini extensions install https://github.com/FrameCoreWorks/FCWM` |
| Any agent with a shell | `npx skills add FrameCoreWorks/FCWM` |

**Check.** List the installed skills: `fcwm` must be among them, with its `references/` (for example
`references/handoff.md`). Tell the user which skills were installed and from which commit or tag.

**Do not** run the repository's scripts during the install, ask for API keys, or install engines.
Rendering happens later on the user's computer or in GitHub Actions on the user's own account: the
`fcwm` skill hands the user one command when there is a film to render (`skills/fcwm/references/handoff.md`).
An agent with a shell that should also render locally clones the repository and runs
`node scripts/fcwm.mjs doctor` (see the README, "Render a film").

## ChatGPT Work: install and update without a ZIP

The user's request in this chat is their consent to install; a bare link without a request is only
context. ChatGPT Work's code sandbox has no network, and `create_plugin` / `update_plugin` take only an
`archive` path to a ZIP inside the sandbox (a data URL is refused). So you rebuild the plugin in the
sandbox from files you read through the GitHub connector, prove every file is exact, then pack it.

1. **Pin one commit.** Resolve `main` (or the release tag the user names, `v<version>`) to its full
   commit SHA and read every file from that commit only. Tell the user the SHA.
2. **Read the inventory.** `plugin-files.json` at that commit lists every plugin file with `path`,
   `sha256`, `bytes` and `group`:
   - `core`: manifests and the seven skills. Required; FCWM works with these alone.
   - `extra`: the blocks (`lib/`), recipes, templates and knowledge the skills read. Install them when
     the conversation allows; without them the skills read those files from GitHub instead.
   - `skip`: binaries (fonts, contact-sheet images) and tests. Leave them out: you cannot rewrite a
     binary as text. Report how many you skipped.
3. **Find an existing install.** Look through the user's plugins for one whose manifest `repository`
   is `https://github.com/FrameCoreWorks/FCWM` (match on that, not on the name). If it exists, this is
   an update of that same plugin: never create a second one.
4. **Write each file** with its exact text to `/mnt/data/fcwm/<path>`, ending with a newline as in
   the original. Write a long file in several cells that append in order. Never retype a file from
   memory or fix it by eye.
5. **Write `/mnt/data/expect.json`** as `{ "<path>": "<sha256>" }` for every file you wrote, copied
   from the inventory, and `/mnt/data/fcwm/fcwm-source.json` as
   `{ "repository": "https://github.com/FrameCoreWorks/FCWM", "commit": "<pinned SHA>", "version": "<inventory version>" }`.
   The next update reads it to know what is installed.
6. **Check and pack in one cell.** Run this cell unchanged. It packs only when every hash matches;
   read each file on the `BAD` list again from the pinned commit and rerun the cell.

   ```python
   import hashlib,json,pathlib,zipfile
   R=pathlib.Path('/mnt/data/fcwm');E=json.load(open('/mnt/data/expect.json'))
   bad=[p for p,h in E.items() if not (R/p).is_file() or hashlib.sha256((R/p).read_bytes()).hexdigest()!=h]
   print('BAD',bad) if bad else print('OK',len(E))
   if not bad:
       with zipfile.ZipFile('/mnt/data/fcwm.zip','w',zipfile.ZIP_DEFLATED) as z:[z.write(R/p,p) for p in sorted(E)];z.write(R/'fcwm-source.json','fcwm-source.json')
   ```

7. **Save.**
   - First install: `create_plugin(archive="/mnt/data/fcwm.zip")`.
   - Update: `update_plugin` on the existing plugin with the ZIP. An update lays the files you send
     over the saved plugin and keeps the rest, so the ZIP needs only files whose hash changed, and the
     user's own additions stay. Files to delete: paths in `plugin-files.json` at the installed commit
     (`commit` in the saved `fcwm-source.json`) that are missing from the new inventory. Without that
     file (installs made before it existed), try the tag `v<version>` of the repository version; when
     neither exists the baseline is unknown: delete nothing and say so.
   - The version ChatGPT shows can be higher than the repository's (it raises the patch number on each
     save). Report both; `fcwm-source.json` holds the repository version and commit.
8. **Read it back.** Read the saved plugin (name, version, file list) and report three things
   separately: saved (yes or no), files match the inventory (how many, how many skipped), works in a
   new chat (ask the user to open one and type `@fcwm`).

FCWM has no companion plugins: install nothing else. Optional check, only if the user asks: there is no
environment check to run in Work, because rendering happens on the user's computer or in GitHub Actions
(`skills/fcwm/references/handoff.md`).

For maintainers: `node scripts/inventory.mjs` regenerates `plugin-files.json`; `npm run validate`
fails when it is out of date. Updates find their baseline in `fcwm-source.json`; release tags
`v<version>` are a fallback for installs made without it.
