# Hand-off: the user renders on their own computer

Use this when the agent cannot run the render itself (a chat app, a phone, a sandbox without the
tools). The user ends up with one folder that holds everything, pastes one line into the Terminal, and
the finished film lands in that same folder. Always run these steps in order.

## 1. One self-contained film folder

Write every file the render needs into one folder named after the film (lowercase, digits, dashes),
the same layout `fcwm new` creates:

| File | Contents |
| --- | --- |
| `film.json` | `engine`, `duration`, `fps`, `formats`, and `"fcwm": "<version>"` (the FCWM version you wrote it for) |
| `index.html` (+ `film.js` for motion-reel) | the film |
| `beats.json` | motion-reel: the beat grid (a steady grid is fine for a silent film) |
| `lib/`, `assets/`, `audio/`, `fonts/` | only what the film uses; never a file from outside the folder. A HyperFrames film may import `./lib/fcwm/*.js` (FCWM's `lib/`) without including it: FCWM adds `lib/fcwm/` at render time |

Paths inside the film are relative (`assets/logo.svg`), never absolute, so the folder works wherever
the user puts it. Nothing else goes in it: no notes for the agent, no copies of FCWM.

Deliver the folder the way the host allows: a zip, a download, or files written into a folder the user
connected. Then tell the user, in their language, how to put it on their disk, for example: "Unzip
`<film>.zip` and move the `<film>` folder wherever you keep projects, on any disk or volume."

## 2. Ask for the folder's path

Ask once: "Where did you put the folder? Paste its full path." Tell them how to copy it:

- macOS: select the folder in Finder, press Option+Cmd+C (Copy as Pathname), or drag the folder into
  the Terminal window.
- Windows: Shift+right-click the folder > Copy as path.
- Linux: drag the folder into the terminal, or right-click > Copy path in the file manager.

Use the path exactly as given. Spaces, `&`, apostrophes and accented letters are fine: the command
generator quotes them. Strip only the surrounding quotes Windows adds when copying.

## 3. Give exactly one command

Pick the user's OS (ask if unknown) and whether FCWM already ran on that computer (step 4). The line
is produced by `fcwm command` (from `scripts/lib/handoff.mjs`); an agent without a shell builds it by
hand with the same rules:

macOS (Terminal, zsh) and Linux, first time on this computer:

```
curl -fsSL https://raw.githubusercontent.com/FrameCoreWorks/FCWM/main/scripts/install.sh | bash -s -- '<path>'
```

macOS and Linux, next times:

```
node ~/.fcwm/app/scripts/fcwm.mjs run '<path>'
```

Windows (PowerShell, not cmd), first time:

```
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/FrameCoreWorks/FCWM/main/scripts/install.ps1))) '<path>'
```

Windows, next times:

```
node "$HOME\.fcwm\app\scripts\fcwm.mjs" run '<path>'
```

`<path>` may be one film folder or a project folder whose subfolders are films (all of them render).

Quoting: wrap the path in single quotes. Inside the path, write a `'` as `'\''` on macOS and Linux and
as `''` on Windows. Add ` --check` at the end for contact sheets only (the quality gate), or
` --cloud` to render in GitHub Actions instead (step 5).

Give the command in its own code block, one command per block, and say what it does in two lines:
"It installs only what is missing (Node.js, FFmpeg, the engine), then renders into
`<path>/render/`. It can take a few minutes the first time."

What the first-time command does:

1. Checks Node.js 22+ and installs it when missing (Homebrew on macOS, winget on Windows; on Linux it
   says how).
2. Downloads FCWM into `~/.fcwm/app` (Windows: `%USERPROFILE%\.fcwm\app`), or updates it when a newer
   version is out. Skipped when it is already there.
3. Runs `fcwm run '<path>'`: detects the tools this film needs (FFmpeg; Chromium for motion-reel; uv
   for a Python score; HyperFrames downloads itself on first use), installs only the missing ones,
   renders and runs the automated QA.

## 4. Remembering what is installed

Tell the user, once, in their language: "FCWM keeps track of what is already installed on your
computer. Next time you get a short command without any installation; if something goes missing,
FCWM notices and installs only that."

How it works, so you answer questions correctly:

- Every run detects the tools again (this is the reliable part; nothing is reinstalled when present)
  and prints `already installed, skipping: ...`.
- The result is saved in `~/.fcwm/state.json` (tools, paths, FCWM and Node versions, date).
- At the end the run prints the exact short command for next time.
- You, the agent, remember it too: after the user reports a successful first run, note in your memory
  (or the project notes) "FCWM is installed on the user's <OS> computer" and give the "next times"
  command from then on. If you have no memory, ask "Have you rendered with FCWM on this computer
  before?" and pick the column from the answer. When in doubt, the first-time command is always safe:
  it skips everything already installed.
- If a film needs a newer FCWM than the one installed, the short command says so; give the first-time
  command again (it updates FCWM).

## 5. GitHub Actions instead (optional)

Offer it when the user has no suitable computer, or the film is long and 3-D. Say first:

- It runs on the user's OWN GitHub account: FCWM creates a private repository `fcwm-renders` there,
  pushes the film's source, runs the render on GitHub's machines and downloads the result into
  `<path>/render/`. Nothing runs on anyone else's account.
- Minutes count on their account: free and unlimited for public repositories; private repositories on
  the free plan include 2,000 minutes a month. GitHub's machines have no GPU, so 3-D renders are slow.
- The first time, a browser window opens to log in to GitHub (the GitHub CLI, `gh`, is installed if
  missing).

The command is the same as above with ` --cloud` at the end. Users without a terminal at all can do the
same in the browser: `docs/render-in-github-actions.md` in the FCWM repository, "By hand".

## 6. After the render

Ask the user to send back, or let you read, `<path>/render/qa.json` and the contact sheets
(`contact_*.png`). Score them as the quality gate says; if the user must score, give them the six
categories. Report every FAIL in `qa.json` as it is.
