# FCWM in ChatGPT (Work, Business, Enterprise, Edu)

ChatGPT runs FCWM's skills; it does not render. It writes a self-contained film folder (or a zip of it)
and gives you one line to paste on your computer, or sets up a render in GitHub Actions on your own
GitHub account. Plugins and skills are available on ChatGPT Business, Enterprise, Healthcare and Edu,
subject to workspace settings.

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
git archive --format=zip -o fcwm-plugin.zip HEAD .claude-plugin .codex-plugin skills lib recipes templates knowledge brand-kit engines/catalog.json integrations qa/README.md AGENTS.md README.md LICENSE NOTICE
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
