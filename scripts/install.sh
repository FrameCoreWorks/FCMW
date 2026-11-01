#!/usr/bin/env bash
# FCWM installer and renderer for macOS and Linux. One line, run from any folder:
#
#   curl -fsSL https://raw.githubusercontent.com/FrameCoreWorks/FCWM/main/scripts/install.sh | bash -s -- '<film folder>' [--cloud]
#
# 1. Checks Node.js 22+ (installs it with Homebrew on macOS when missing).
# 2. Downloads FCWM into ~/.fcwm/app, or updates it when a newer version is out (FCWM_HOME moves it).
# 3. Hands over to `fcwm run`, which installs only the tools this film still lacks and renders it
#    into '<film folder>/render/'. With --cloud it renders on the user's own GitHub account instead.
#
# Everything already installed is detected and skipped. Bash 3.2 compatible (the macOS default).
set -euo pipefail

# Everything runs inside main, called on the last line: a half-downloaded script runs nothing.
main() {

REF="${FCWM_REF:-main}"
REPO="FrameCoreWorks/FCWM"
HOME_DIR="${FCWM_HOME:-$HOME/.fcwm}"
APP="$HOME_DIR/app"

say() { printf 'fcwm: %s\n' "$*"; }
die() { printf 'fcwm: %s\n' "$*" >&2; exit 1; }

if [ "$#" -lt 1 ]; then die "usage: install.sh '<film folder>' [--cloud]"; fi

# --- Node.js 22+ ---------------------------------------------------------------------------
node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if ! command -v node >/dev/null 2>&1 || [ "$(node_major)" -lt 22 ]; then
  if [ "$(uname -s)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
    say "installing Node.js with Homebrew"
    brew install node </dev/null
    hash -r
  elif [ "$(uname -s)" = "Darwin" ]; then
    die "Node.js 22+ is missing. Install Homebrew (https://brew.sh) or Node.js 22 (https://nodejs.org), then run the same command again."
  else
    die "Node.js 22+ is missing. Install it (https://nodejs.org/en/download, or your package manager), then run the same command again."
  fi
else
  say "already installed, skipping: Node.js $(node -v)"
fi

# --- FCWM itself ---------------------------------------------------------------------------
remote_version() {
  curl -fsSL "https://raw.githubusercontent.com/$REPO/$REF/package.json" 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).version)}catch{console.log("")}})'
}
local_version() { [ -f "$APP/package.json" ] && node -p "require(process.argv[1]).version" "$APP/package.json" 2>/dev/null || echo ""; }

# FCWM_SRC=<local FCWM folder> installs from that folder instead of GitHub (tests, offline machines).
if [ -n "${FCWM_SRC:-}" ]; then WANT="$(node -p "require(process.argv[1]).version" "$FCWM_SRC/package.json")"; else WANT="$(remote_version || true)"; fi
HAVE="$(local_version)"
if [ -n "$HAVE" ] && { [ -z "$WANT" ] || [ "$WANT" = "$HAVE" ]; } && [ -d "$APP/node_modules" ]; then
  say "already installed, skipping: FCWM $HAVE ($APP)"
else
  say "downloading FCWM ${WANT:-$REF} into $APP"
  mkdir -p "$HOME_DIR"
  TMP="$(mktemp -d "$HOME_DIR/download.XXXXXX")"
  trap 'rm -rf "$TMP"' EXIT
  if [ -n "${FCWM_SRC:-}" ]; then
    (cd "$FCWM_SRC" && tar --exclude ./node_modules --exclude ./.git -cf - .) | tar -xf - -C "$TMP"
  else
    curl -fsSL "https://github.com/$REPO/archive/$REF.tar.gz" | tar -xz -C "$TMP" --strip-components 1
  fi
  (cd "$TMP" && npm ci --no-audit --no-fund --loglevel=error)
  rm -rf "$APP.old"
  if [ -d "$APP" ]; then mv "$APP" "$APP.old"; fi
  mv "$TMP" "$APP"
  rm -rf "$APP.old"
  trap - EXIT
fi

# Under `curl | bash` stdin is the script itself; give FCWM the keyboard back for prompts (sudo, gh login).
if [ ! -t 0 ] && [ -r /dev/tty ] && (exec </dev/tty) 2>/dev/null; then
  exec node "$APP/scripts/fcwm.mjs" run "$@" </dev/tty
fi
exec node "$APP/scripts/fcwm.mjs" run "$@"
}

main "$@"
