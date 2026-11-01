# Render on your computer

One folder holds the film; one line in the Terminal installs what is missing and renders the film into
that same folder. Works on macOS, Windows and Linux, from any disk or volume, with any folder name
(spaces, `&`, apostrophes and accents included).

## 1. Put the film folder on your disk

Your agent gives you the film as one folder (or a zip of it). Unzip it if needed and move the folder
anywhere, for example `/Volumes/Work/projects/my-film`. It contains `film.json`, the film code and its
assets. Everything FCWM writes goes inside it: the finished files in `render/`, temporary files in
`.fcwm/`.

## 2. Copy the folder's path

- macOS: select the folder in Finder and press Option+Cmd+C, or drag the folder into the Terminal window.
- Windows: Shift+right-click the folder > Copy as path.
- Linux: drag the folder into the terminal window.

## 3. Paste one command

Put the path between single quotes. If the path itself contains a `'`, write it as `'\''` (macOS,
Linux) or `''` (Windows); `fcwm command` and the agent do this for you.

macOS (Terminal) and Linux, the first time:

```
curl -fsSL https://raw.githubusercontent.com/FrameCoreWorks/FCWM/main/scripts/install.sh | bash -s -- '/Volumes/Work/projects/my-film'
```

Windows (PowerShell), the first time:

```
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/FrameCoreWorks/FCWM/main/scripts/install.ps1))) 'D:\projects\my-film'
```

It:

1. checks Node.js 22+ and installs it if missing (Homebrew on macOS, winget on Windows; on Linux it
   tells you how);
2. downloads FCWM into `~/.fcwm/app` (Windows: `%USERPROFILE%\.fcwm\app`), or updates it when a newer
   version is out;
3. checks what this film needs (FFmpeg; Chromium for 3-D and canvas films; uv for a Python score;
   HyperFrames fetches itself), installs only what is missing, renders, and runs the quality checks.

The finished files are in `my-film/render/`: one MP4 per format, `my-film-preview.mp4` for the phone,
and `qa.json` with the automated checks. Add `--check` at the end of the command to make only the
contact sheets (`contact_*.png`) for review.

The folder may also be a project folder whose subfolders are films; each of them renders.

## Next times

FCWM remembers what is installed. Every run checks the tools again, skips what is there
(`already installed, skipping: ...`) and saves the result in `~/.fcwm/state.json`. So after the first
time you only need the short command, which the first run prints at the end:

```
node ~/.fcwm/app/scripts/fcwm.mjs run '/Volumes/Work/projects/my-film'
```

Windows:

```
node "$HOME\.fcwm\app\scripts\fcwm.mjs" run 'D:\projects\my-film'
```

If something went missing in the meantime (say FFmpeg was uninstalled), the short command notices and
installs only that. If a film needs a newer FCWM, it says so: run the first-time command again to update.

## Troubleshooting

- `node scripts/fcwm.mjs setup '<folder>'` (in `~/.fcwm/app`) lists what is installed and what the film
  still needs.
- macOS: render from the Terminal app, not from inside a sandboxed agent session, which can block Chromium.
- Windows: use PowerShell, not cmd. After winget installs Node.js, open a new PowerShell window if asked.
- Linux: installing FFmpeg uses `sudo` (apt, dnf or pacman) and asks for your password.
- Change where FCWM lives with the environment variable `FCWM_HOME`.

No suitable computer: [render in GitHub Actions](render-in-github-actions.md) on your own GitHub account.
