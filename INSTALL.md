# Installing FCWM

## For you (the person)

Paste this into your agent (ChatGPT Work, Codex, Claude, Cursor, Gemini or any agent that can read
GitHub):

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
| ChatGPT Work (web, desktop) | Your native installer: inspect this repository, install the plugin (or the seven skills) into the user's personal directory. If it needs a package, build it from `.codex-plugin/plugin.json` and `skills/`. |
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
