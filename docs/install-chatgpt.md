# FCWM in ChatGPT (Work, Business, Enterprise, Edu)

> **Agents installing FCWM: follow [INSTALL.md](../INSTALL.md), section "ChatGPT Work: install and
> update without a ZIP".** This page is for people; the admin import and ZIP upload below are only for
> workspace admins who ask for them.

ChatGPT runs FCWM's skills; it does not render. It writes a self-contained film folder (or a zip of it)
and gives you one line to paste on your computer, or sets up a render in GitHub Actions on your own
GitHub account. Plugins and skills are available on ChatGPT Business, Enterprise, Healthcare and Edu,
subject to workspace settings.

## Easiest: paste the link in a chat (any member)

Start a new chat in ChatGPT Work, pick **Plugin Creator** from the `@` menu and paste:

```text
@Plugin Creator Install the FCWM plugin from https://github.com/FrameCoreWorks/FCWM for me. Read INSTALL.md in that repository first (the ChatGPT Work section), then follow it step by step.
```

Plugin Creator reads [INSTALL.md](../INSTALL.md), pins one commit, rebuilds the plugin in its sandbox
file by file, checks every file against the SHA-256 list in `plugin-files.json` and saves the plugin
only when all of them match. It then reports three things: saved, files match, works in a new chat.
Check: Settings > Plugins, FCWM is listed; in a new chat type `@fcwm`. To update later, paste the same
prompt again: it updates the same plugin and keeps your own additions.

## Option A: import from GitHub (workspace owner or admin, keeps itself up to date)

1. Open the [Admin console](https://admin.openai.com/), choose your ChatGPT workspace, open **Plugins**.
2. **Add** > **Import marketplace**.
3. **Source:** `https://github.com/FrameCoreWorks/FCWM`. Leave **Path** empty (the marketplace manifest
   is `.claude-plugin/marketplace.json` at the root). Leave **Branch** empty for the default branch, or
   enter a release tag to stay on it.
4. **Import marketplace**, authorize GitHub when asked, then open the imported `fcwm` plugin and set its
   installation policy (for example "Available").
5. In ChatGPT: sidebar **Plugins** > find **FCWM** > **Install plugin**.

The workspace syncs the plugin daily from the repository.

## Option B: upload a ZIP (owner, admin, or a member with upload permission)

Build the ZIP from a clone (manifests and skills at the ZIP root, plus the blocks, recipes and
templates the skills point to):

```sh
git archive --format=zip -o fcwm-plugin.zip HEAD .claude-plugin .codex-plugin skills lib recipes templates knowledge brand-kit engines/catalog.json integrations qa/README.md AGENTS.md README.md INSTALL.md LICENSE NOTICE plugin.json plugin-files.json
```

Admin console > your workspace > **Plugins** > **Add** > **Upload plugin**, choose `fcwm-plugin.zip`,
then install it from the plugin directory as above.

## Using it

Start a chat, mention FCWM or just ask for a motion graphics film. ChatGPT follows the hand-off
(`skills/fcwm/references/handoff.md`):

1. It writes the film folder and offers it as a zip. Unzip it wherever you keep projects.
2. It asks for the folder's path, and gives one command for your OS. The first run installs only what
   is missing (Node.js, FFmpeg, the engine) and renders into `<folder>/render/`.
3. Or, for a cloud render, it explains how to push the folder to your own GitHub repository with the
   FCWM render workflow ([render in GitHub Actions](render-in-github-actions.md)).

ChatGPT cannot see the render on your computer: send it the contact sheet
(`render/contact_*_p1.png`) if you want it to review and improve the film.
