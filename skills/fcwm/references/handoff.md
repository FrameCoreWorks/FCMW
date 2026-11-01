# Hand-off: the user renders on their own computer

Use this when the agent cannot run the render itself (a chat app, a phone, a sandbox without the
tools). The user ends up with one folder that holds everything, pastes one line into the Terminal, and
the finished film lands in that same folder. Always run these steps in order.

**In a chat app's code sandbox (ChatGPT, Claude.ai and similar) never try to render.** Do not launch a
browser or Chromium, install engines, take snapshots or run `fcwm`: the sandbox cannot render, and a
failed attempt only wastes the user's time. Do not report that you could not render; rendering on the
user's computer or in their GitHub Actions is the plan, not a fallback. Check the film by reading its
code (timing, text, the render contract), then go straight to step 1. The visual review happens after
the user's render: ask them to send the contact sheet (`render/contact_*.png`) and score it then.

**Two replies, never one.** Reply 1: the ZIP as a direct download link, how to unzip it, and two
questions (their operating system if you do not know it, and the full path of the unzipped folder).
No render command, no guessed path (not `~/Downloads/...`, not "put it in Downloads") in reply 1:
stop and wait. Reply 2, only after the user pasted the real path: the two commands built from exactly
that path. If you do not know that FCWM already ran on that computer, give the first-time command (it
is always safe; the short `node ~/.fcwm/...` line fails on a computer without FCWM).

**Deliver every format asked for.** A HyperFrames film has one format, so 9:16, 1:1 and 16:9 are
three film folders (`<film>-9x16`, `<film>-1x1`, `<film>-16x9`), each composed for its frame, in one
ZIP under one parent folder; the command takes the parent folder and renders all of them. Never deliver
fewer formats than the brief asked for without saying so first.

**Never assume the user's operating system.** Ask which one they use (macOS, Windows or Linux) before
giving path tips or a command, or give all three plus the GitHub Actions variant. Remember the answer
for the rest of the conversation.

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
connected. In a chat app with a code sandbox (ChatGPT, Claude.ai), write `<film>.zip` in the sandbox
(in ChatGPT: `/mnt/data/<film>.zip`) and give it as a direct download link in your reply (in ChatGPT a
`sandbox:/mnt/data/<film>.zip` link), never as a pointer to a library, a project file list or "the
files panel". The user must be able to click once and get the ZIP. Then tell the user, in their language, how to put it on their disk, for example: "Unzip
`<film>.zip` and move the `<film>` folder wherever you keep projects, on any disk or volume."

## 2. Ask for the folder's path

Ask once: "Where did you put the folder? Paste its full path." Tell them how to copy it on their
system (all three if you do not know it yet):

- macOS: select the folder in Finder, press Option+Cmd+C (Copy as Pathname), or drag the folder into
  the Terminal window.
- Windows: Shift+right-click the folder > Copy as path.
- Linux: drag the folder into the terminal, or right-click > Copy path in the file manager.

Use the path exactly as given. Spaces, `&`, apostrophes and accented letters are fine: the command
generator quotes them. Strip only the surrounding quotes Windows adds when copying.

## 3. Give two commands: local render and GitHub Actions

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

Always give two separate commands, each in its own code block, labelled for the user's system
(Terminal on macOS and Linux, PowerShell on Windows): **render on this computer** (the line above) and
**render in GitHub Actions** (the same line with ` --cloud`, step 5). Under them, in a few lines: the
first run installs whatever is missing; the GitHub variant needs a GitHub login in the browser the first
time and uses the user's own Actions minutes in a temporary repository that is deleted after the
download (private by default, ` --public` for free minutes; step 5). For the local command, say what it does
in two lines:
"The first time it sets up the whole render toolkit (Node.js, FFmpeg and every FCWM engine), so any
film renders later without another download, then renders into `<path>/render/`. The first run takes a
while (about 1 GB, mostly Blender); later runs skip everything already installed."

What the first-time command does:

1. Checks Node.js 22+ and installs it when missing (Homebrew on macOS, winget on Windows; on Linux it
   says how).
2. Downloads FCWM into `~/.fcwm/app` (Windows: `%USERPROFILE%\.fcwm\app`), or updates it when a newer
   version is out. Skipped when it is already there.
3. Runs `fcwm run --full '<path>'`: detects the whole render toolkit (FFmpeg, uv, Chromium for
   motion-reel, HyperFrames and its Chrome, Manim, Blender's bpy module; Pango on Linux), installs only
   the missing pieces, renders and runs the automated QA. `fcwm setup` does the same without a film.

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

## 5. GitHub Actions (the second command)

Recommend it when the user has no suitable computer, or the film is long and 3-D. Say first:

- It runs on the user's OWN GitHub account: FCWM creates a temporary repository there
  (`fcwm-render-<film>-<time>`), pushes the film's source, runs the render on GitHub's machines,
  downloads the result into `<path>/render/` and then deletes the repository, so nothing is left behind.
  Nothing runs on anyone else's account. If the render fails, the repository stays so its log can be
  read, and FCWM prints the line that deletes it.
- The first time, the browser opens twice at most: to log in to GitHub, and to allow FCWM to delete
  repositories (GitHub permission `delete_repo`), so the clean-up works. The GitHub CLI (`gh`) is
  installed if missing.
- Minutes and privacy, ask the user which they want:
  - **Private (default):** only they can see the film; GitHub Free includes 2,000 Actions minutes a
    month (Pro and Team 3,000). A 2-D film takes about 1-3 minutes, a 3-D film 5-10 or more.
  - **Public (` --cloud --public`):** Actions minutes are free and unlimited on GitHub's standard
    machines, but anyone can see the film's files and the render for the few minutes the repository
    exists. Not for unreleased client work.
- GitHub's machines have no GPU, so 3-D renders are slow there.
- Advanced: ` --repo <name>` uses (or creates) one named repository and keeps it; FCWM then deletes only
  the run's download package, which would otherwise count toward the account's 500 MB storage.

The command is the same as above with ` --cloud` at the end. Users without a terminal at all can do the
same in the browser: `docs/render-in-github-actions.md` in the FCWM repository, "By hand".

## 6. After the render

Every `fcwm run` ends with a short block between `----- FCWM summary: copy from here into the chat -----`
and `----- end of summary -----`: the FCWM version and system, each film's QA result with every failed
check, where the files are, the error if the run stopped, and the next step. Ask the user to copy that
block (or, for a beginner, everything the window shows if they cannot find it) and paste it into the
chat. Read it as `skills/fcwm` section 1 says ("Pasted Terminal output").

Ask the user to send back, or let you read, `<path>/render/qa.json` and the contact sheets
(`contact_*.png`). Score them as the quality gate says; if the user must score, give them the six
categories. Report every FAIL in `qa.json` as it is.
