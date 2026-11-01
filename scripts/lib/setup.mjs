// What a film needs on this computer, what is already there, and how to install only what is missing.
// Detection runs every time (it is cheap and never stale); the result is also saved to the state file
// (~/.fcwm/state.json, or $FCWM_HOME/state.json) so agents and the user can see what is installed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { which } from './tools.mjs';
import { run } from './proc.mjs';

export const fcwmHome = (env = process.env) => env.FCWM_HOME || path.join(os.homedir(), '.fcwm');
export const statePath = (env = process.env) => path.join(fcwmHome(env), 'state.json');

// Tools by film. Node itself is checked by the install script before FCWM can run at all.
export function requirementsFor(film) {
  const need = ['ffmpeg'];
  if (film.engine === 'motion-reel') {
    need.push('chromium');
    if (fs.existsSync(path.join(film.dir, 'audio', 'score.py'))) need.push('uv');
  }
  if (film.engine === 'hyperframes') need.push('hyperframes');
  return need;
}

// Playwright's own Chromium build, resolved from the FCWM install (or a film project).
export function chromiumPath(fromDirs) {
  for (const base of fromDirs) {
    try {
      const req = createRequire(path.join(base, 'noop.js'));
      const exe = req('playwright').chromium.executablePath();
      if (exe && fs.existsSync(exe)) return exe;
    } catch { /* next */ }
  }
  return null;
}

export function detect(names, { repo, platform = process.platform, envPath } = {}) {
  const found = {};
  for (const n of names) {
    if (n === 'ffmpeg') {
      const a = which('ffmpeg', { path: envPath, platform }), b = which('ffprobe', { path: envPath, platform });
      found.ffmpeg = a && b ? a : null;
    } else if (n === 'chromium') found.chromium = chromiumPath([repo]);
    else if (n === 'hyperframes') found.hyperframes = which('npx', { path: envPath, platform }); // CLI and its Chrome arrive via npx on first render
    else found[n] = which(n, { path: envPath, platform });
  }
  return found;
}

const has = (bin, platform) => !!which(bin, { platform });

// The install command for one tool on this OS, or a manual instruction when no package manager fits.
export function installPlan(name, { platform = process.platform, repo, hasBin = (b) => has(b, platform) } = {}) {
  const npx = { cmd: 'npx', cwd: repo };
  if (name === 'chromium') {
    return { ...npx, args: ['playwright', 'install', ...(platform === 'linux' ? ['--with-deps'] : []), 'chromium'], label: 'Chromium for Playwright' };
  }
  if (name === 'hyperframes') return { note: 'HyperFrames and its Chrome download themselves on the first render (cached afterwards).' };
  const pkgs = {
    ffmpeg: { brew: 'ffmpeg', winget: 'Gyan.FFmpeg', apt: 'ffmpeg', dnf: 'ffmpeg', pacman: 'ffmpeg' },
    uv: { brew: 'uv', winget: 'astral-sh.uv' },
    gh: { brew: 'gh', winget: 'GitHub.cli', apt: 'gh', dnf: 'gh', pacman: 'github-cli' },
    git: { brew: 'git', winget: 'Git.Git', apt: 'git', dnf: 'git', pacman: 'git' },
  }[name];
  if (!pkgs) return { manual: `install ${name} and make sure it is on PATH` };
  if (platform === 'darwin') {
    if (hasBin('brew')) return { cmd: 'brew', args: ['install', pkgs.brew], label: name };
    return { manual: `Homebrew is missing. Install it from https://brew.sh, then run the same command again.` };
  }
  if (platform === 'win32') {
    if (hasBin('winget')) return { cmd: 'winget', args: ['install', '--id', pkgs.winget, '-e', '--accept-source-agreements', '--accept-package-agreements'], label: name, newPath: true };
    return { manual: `winget is missing (App Installer from the Microsoft Store). Install ${name} by hand and run the same command again.` };
  }
  if (name === 'uv') return { cmd: 'sh', args: ['-c', 'curl -LsSf https://astral.sh/uv/install.sh | sh'], label: 'uv', addPath: path.join(os.homedir(), '.local', 'bin') };
  if (hasBin('apt-get')) return { cmd: 'sh', args: ['-c', `sudo apt-get update && sudo apt-get install -y --no-install-recommends ${pkgs.apt}`], label: name };
  if (hasBin('dnf')) return { cmd: 'sudo', args: ['dnf', 'install', '-y', pkgs.dnf], label: name };
  if (hasBin('pacman')) return { cmd: 'sudo', args: ['pacman', '-S', '--noconfirm', pkgs.pacman], label: name };
  return { manual: `install ${name} with your package manager and run the same command again` };
}

// winget puts command shims here and only new terminals see the PATH change; make this one see it too.
function refreshWindowsPath() {
  const links = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links');
  if (fs.existsSync(links) && !(process.env.PATH || '').includes(links)) process.env.PATH = `${links};${process.env.PATH}`;
}

export function readState(env = process.env) {
  try { return JSON.parse(fs.readFileSync(statePath(env), 'utf8')); } catch { return null; }
}

export function writeState(found, { version, env = process.env } = {}) {
  const prev = readState(env) || {};
  const tools = { ...(prev.tools || {}) };
  for (const [k, v] of Object.entries(found)) tools[k] = v ? { path: v } : null;
  const state = { fcwm: version, os: process.platform, arch: process.arch, node: process.versions.node, checked: new Date().toISOString(), tools };
  fs.mkdirSync(fcwmHome(env), { recursive: true });
  fs.writeFileSync(statePath(env), JSON.stringify(state, null, 2) + '\n');
  return state;
}

// Check, install what is missing (unless dryRun), check again. Returns { ok, installed, already, missing }.
export async function ensure(names, { repo, version, log = console.log, dryRun = false, install = true } = {}) {
  const before = detect(names, { repo });
  const already = names.filter((n) => before[n]);
  const missing = names.filter((n) => !before[n]);
  if (already.length) log(`already installed, skipping: ${already.join(', ')}`);
  if (!missing.length) log('nothing to install');
  const installed = [], manual = [];
  for (const n of missing) {
    const p = installPlan(n, { repo });
    if (p.note) { log(`note: ${p.note}`); continue; }
    if (p.manual) { manual.push(`${n}: ${p.manual}`); continue; }
    log(`install ${p.label}: ${[p.cmd, ...p.args].join(' ')}`);
    if (dryRun || !install) continue;
    const { code } = await run(p.cmd, p.args, { cwd: p.cwd });
    if (code !== 0) { manual.push(`${n}: "${[p.cmd, ...p.args].join(' ')}" failed with exit code ${code}`); continue; }
    if (p.newPath && process.platform === 'win32') refreshWindowsPath();
    if (p.addPath) process.env.PATH = `${p.addPath}${path.delimiter}${process.env.PATH}`;
    installed.push(n);
  }
  if (dryRun || !install) return { ok: !missing.length, installed, already, missing, manual };
  const after = detect(names, { repo });
  const still = names.filter((n) => !after[n] && n !== 'hyperframes');
  writeState(after, { version });
  for (const m of manual) log(`cannot install automatically: ${m}`);
  return { ok: still.length === 0, installed, already, missing: still, manual };
}
