#!/usr/bin/env bash
# FCWM installer and renderer for macOS and Linux. One line, run from any folder:
#
#   curl -fsSL https://raw.githubusercontent.com/FrameCoreWorks/FCWM/main/scripts/install.sh | bash -s -- '<film folder>' [--cloud [--public]]
#
# 1. Checks Node.js 22+; when missing, puts the official build into ~/.fcwm/node (no admin rights).
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

if [ "$#" -lt 1 ]; then die "usage: install.sh '<film folder>' [--cloud [--public]]"; fi

# --- Node.js 22+ ---------------------------------------------------------------------------
# Missing or too old: the official Node.js 22 build from nodejs.org goes into ~/.fcwm/node (checksum
# verified). No Homebrew, no administrator password, nothing outside ~/.fcwm except one PATH line in
# the shell profile, so `node` also works in the next Terminal window.
BIN="$HOME_DIR/bin"
case ":$PATH:" in *":$BIN:"*) ;; *) PATH="$BIN:$PATH"; export PATH ;; esac
node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
sha256() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }
persist_path() {
  line="export PATH=\"$BIN:\$PATH\"  # FCWM: node and render tools"
  if [ "$(uname -s)" = "Darwin" ]; then files="$HOME/.zprofile $HOME/.bash_profile"; else files="$HOME/.profile $HOME/.bashrc"; fi
  for f in $files; do
    case "$f" in */.bash_profile) [ -f "$f" ] || continue ;; esac
    if ! grep -qs "# FCWM: node and render tools" "$f"; then printf '\n%s\n' "$line" >> "$f"; say "added $BIN to PATH in $f"; fi
  done
}
install_node() {
  case "$(uname -s)" in Darwin) os=darwin ;; Linux) os=linux ;; *) die "unsupported system $(uname -s)" ;; esac
  case "$(uname -m)" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; *) die "unsupported processor $(uname -m)" ;; esac
  base="https://nodejs.org/dist/latest-v22.x"
  sums="$(curl -fsSL "$base/SHASUMS256.txt")" || die "cannot reach nodejs.org; check the internet connection and run the same command again"
  entry="$(printf '%s\n' "$sums" | grep -- "-$os-$arch.tar.gz\$" | head -1)"
  [ -n "$entry" ] || die "no Node.js 22 build for $os-$arch on nodejs.org"
  want="${entry%% *}"; file="${entry##* }"
  say "installing Node.js ${file%-$os-$arch.tar.gz} into $HOME_DIR/node (no administrator password needed)"
  mkdir -p "$HOME_DIR" "$BIN"
  tmp="$(mktemp -d "$HOME_DIR/node-download.XXXXXX")"
  curl -fsSL "$base/$file" -o "$tmp/$file" || { rm -rf "$tmp"; die "Node.js download failed; run the same command again"; }
  if [ "$(sha256 "$tmp/$file")" != "$want" ]; then rm -rf "$tmp"; die "Node.js download is damaged (checksum mismatch); run the same command again"; fi
  tar -xzf "$tmp/$file" -C "$tmp"
  rm -rf "$HOME_DIR/node"
  mv "$tmp/${file%.tar.gz}" "$HOME_DIR/node"
  rm -rf "$tmp"
  for b in node npm npx; do ln -sf "$HOME_DIR/node/bin/$b" "$BIN/$b"; done
  hash -r
  persist_path
}
if ! command -v node >/dev/null 2>&1 || [ "$(node_major)" -lt 22 ]; then
  install_node
  [ "$(node_major)" -ge 22 ] || die "Node.js was installed into $HOME_DIR/node but does not start; send this output to the chat"
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
  (cd "$TMP" && npm ci --no-audit --no-fund --no-update-notifier --loglevel=error)
  rm -rf "$APP.old"
  if [ -d "$APP" ]; then mv "$APP" "$APP.old"; fi
  mv "$TMP" "$APP"
  rm -rf "$APP.old"
  trap - EXIT
fi

# Under `curl | bash` stdin is the script itself; give FCWM the keyboard back for prompts (sudo, gh login).
if [ ! -t 0 ] && [ -r /dev/tty ] && (exec </dev/tty) 2>/dev/null; then
  exec node "$APP/scripts/fcwm.mjs" run --full "$@" </dev/tty
fi
exec node "$APP/scripts/fcwm.mjs" run --full "$@"
}

main "$@"
