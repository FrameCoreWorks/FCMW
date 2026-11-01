# Render in GitHub Actions

Use this when your own machine is slow (3-D without a GPU) or you work from a phone or a chat app.

**It always runs on your own GitHub account.** You render in a repository you own, on GitHub minutes
counted on your account. Nobody else can start a run there, and FCWM's own repository never renders
your films.

Costs: GitHub Actions minutes are free and unlimited for public repositories. Private repositories on
the free plan include 2,000 Linux minutes a month (more on paid plans); beyond that GitHub bills only
within a budget you set (check Settings > Billing). GitHub's Linux machines have no GPU, so 3-D films render in
software WebGL (much slower): keep 3-D renders short, or render them on a computer with a GPU.

## With one command (recommended)

Needs a terminal on any computer; it does not need the render tools, only Node.js (installed for you
when missing). Use the same command as a local render with `--cloud` at the end:

```
curl -fsSL https://raw.githubusercontent.com/FrameCoreWorks/FCWM/main/scripts/install.sh | bash -s -- '/path/to/my-film' --cloud
```

Windows (PowerShell):

```
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/FrameCoreWorks/FCWM/main/scripts/install.ps1))) 'D:\path\to\my-film' --cloud
```

What happens:

1. FCWM installs `git` and the GitHub CLI (`gh`) if they are missing.
2. The first time, `gh auth login` opens your browser: log in with **your** GitHub account. The login
   stays on your computer (in `gh`); FCWM stores no token.
3. FCWM creates the private repository `<you>/fcwm-renders` if it does not exist (`--repo <name>` picks
   another name), copies the film's source into `films/<film>/` (not `render/` or `.fcwm/`), adds the
   workflow `.github/workflows/fcwm-render.yml` and pushes.
4. It starts the workflow, shows its progress, and when it finishes downloads the MP4s, the phone
   preview, contact sheets and `qa.json` into your film folder's `render/`.

Next time, the short command with `--cloud` does the same without any setup:

```
node ~/.fcwm/app/scripts/fcwm.mjs run '/path/to/my-film' --cloud
```

## By hand, in the browser (no terminal at all)

1. Create a GitHub account at https://github.com/signup if you do not have one.
2. Create a repository: https://github.com/new, name it for example `fcwm-renders`, choose Private or
   Public, tick "Add a README file", click Create repository.
3. Add the workflow: in the repository click Add file > Create new file, name it
   `.github/workflows/fcwm-render.yml`, paste the contents of
   [`templates/cloud-render/fcwm-render.yml`](../templates/cloud-render/fcwm-render.yml), click Commit changes.
4. Upload the film: Add file > Upload files, drag your film folder in (the folder itself, so the
   repository gets `my-film/film.json`, `my-film/index.html` and so on; leave out `render/`), Commit changes.
5. Run it: Actions tab > fcwm-render > Run workflow, enter the folder name (`my-film`), pick `full`
   (video) or `check` (contact sheets only), Run workflow.
6. When the run shows a green tick, open it and download the artifact `my-film-render` (a zip with the
   MP4s, preview, contact sheets and `qa.json`). Unzip it into your film folder's `render/`.

For the next film, repeat steps 4 to 6 in the same repository.

## For maintainers of a public FCWM copy

The `render` workflow in this repository only starts by hand (`workflow_dispatch`), which GitHub allows
only to people with write access. Pull requests from forks run only the light checks (`validate`,
`smoke` with 3-second films, `install` when the installer changes). Recommended setting:
Settings > Actions > General > "Fork pull request workflows from outside collaborators" >
**Require approval for all outside collaborators**, so even those checks start only after you approve.
