// Find the external tools a render needs and say how to install a missing one on this OS.
import { existsSync } from 'node:fs';
import path from 'node:path';

const HINTS = {
  ffmpeg: { darwin: 'brew install ffmpeg', win32: 'winget install Gyan.FFmpeg', linux: 'sudo apt install ffmpeg' },
  ffprobe: { darwin: 'brew install ffmpeg', win32: 'winget install Gyan.FFmpeg', linux: 'sudo apt install ffmpeg' },
  uv: { darwin: 'brew install uv', win32: 'winget install astral-sh.uv', linux: 'curl -LsSf https://astral.sh/uv/install.sh | sh' },
  npx: { darwin: 'install Node.js 22+ from https://nodejs.org', win32: 'winget install OpenJS.NodeJS.LTS', linux: 'install Node.js 22+ from https://nodejs.org' },
};

export function which(name, { path: envPath = process.env.PATH || '', platform = process.platform } = {}) {
  const sep = platform === 'win32' ? ';' : ':';
  const exts = platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of envPath.split(sep).filter(Boolean)) {
    for (const ext of exts) {
      const full = path.join(dir, name + ext.toLowerCase());
      const fullUpper = path.join(dir, name + ext);
      if (existsSync(full)) return full;
      if (existsSync(fullUpper)) return fullUpper;
    }
  }
  return null;
}

export function hint(name, platform = process.platform) {
  const h = HINTS[name];
  return h ? (h[platform] || h.linux) : `install ${name} and make sure it is on PATH`;
}

export function checkTools(names, opts = {}) {
  const platform = opts.platform || process.platform;
  const missing = names.filter((n) => !which(n, opts)).map((n) => ({ name: n, hint: hint(n, platform) }));
  return { ok: missing.length === 0, missing };
}

// Playwright is a node module, not a binary: resolve it from the film project or from FCWM itself.
export async function hasPlaywright(fromDirs) {
  const { createRequire } = await import('node:module');
  for (const base of fromDirs) {
    try { createRequire(path.join(base, 'noop.js')).resolve('playwright'); return true; } catch { /* next */ }
  }
  return false;
}
