# Render in GitHub Actions

Use this when your own machine is slow (3-D without a GPU) or you are working from a phone or a chat app.

1. Fork FCWM (or use your own copy) and commit the film folder, for example `films/my-film/`.
   Commit the source only; `render/` and `out/` are build output.
2. On GitHub: **Actions > render > Run workflow**. Enter `films/my-film`, pick `full` or `check`.
3. When the run finishes, download the artifact `my-film-render`: the MP4 per format, the phone preview,
   contact sheets and `qa.json`.

Costs: GitHub Actions minutes are free for public repositories; private repositories use the account's
included minutes and are billed beyond them. GitHub's Linux runners have no GPU, so 3-D films render in
software WebGL (much slower); keep 3-D renders short or render them on a machine with a GPU.

The `smoke` workflow runs on every pull request: it creates, renders and checks one short film per engine,
so a broken engine shows up before it is merged.
