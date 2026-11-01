// Per-user installs into ~/.fcwm/bin for computers without a package manager (a Mac without
// Homebrew is the common case). No administrator password; every download is checked against the
// publisher's SHA-256 before it is used. fcwm.mjs puts ~/.fcwm/bin first on PATH, and the one-line
// installer adds it to the shell profile, so the tools work in later Terminal windows too.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const binDir = (home) => path.join(home, 'bin');

// FFmpeg 9.0 for macOS, signed builds from Martin Riedl's build server (GPL; ffmpeg.martin-riedl.de),
// pinned so every Mac gets the same encoder. Each file has a .sha256 next to it.
export const FFMPEG_MAC = {
  arm64: 'https://ffmpeg.martin-riedl.de/download/macos/arm64/1785863997_9.0',
  x64: 'https://ffmpeg.martin-riedl.de/download/macos/amd64/1785871427_9.0',
};

// FFmpeg for Windows without winget: BtbN's GPL builds on GitHub (rolling), with a checksum list.
export const FFMPEG_WIN = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest';

// What can be installed this way here, or null.
export function portableFor(name, { platform = process.platform, arch = process.arch } = {}) {
  if (name === 'ffmpeg' && platform === 'darwin' && FFMPEG_MAC[arch]) return { label: 'FFmpeg 9.0 (per-user, no Homebrew)', size: '~80 MB' };
  if (name === 'ffmpeg' && platform === 'win32' && ['arm64', 'x64'].includes(arch)) return { label: 'FFmpeg (per-user, no winget)', size: '~200 MB' };
  if (name === 'gh' && (platform === 'darwin' || platform === 'linux') && ['arm64', 'x64'].includes(arch)) return { label: 'GitHub CLI (per-user)', size: '~40 MB' };
  return null;
}

async function download(url, file) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`download failed (${r.status}): ${url}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}
async function text(url) {
  const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'fcwm' } });
  if (!r.ok) throw new Error(`download failed (${r.status}): ${url}`);
  return r.text();
}
export const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function verify(file, want) {
  const have = sha256(file);
  if (!want || have !== want.toLowerCase()) throw new Error(`${path.basename(file)} is damaged or changed (SHA-256 ${have}, expected ${want}); run the same command again`);
}
function unpack(archive, dest) {
  fs.mkdirSync(dest, { recursive: true });
  // bsdtar (macOS, Windows) reads zip and tar.gz; GNU tar on Linux only tar.gz, so zips go to unzip there
  const zip = archive.endsWith('.zip');
  const r = zip && process.platform === 'linux'
    ? spawnSync('unzip', ['-q', '-o', archive, '-d', dest], { stdio: 'inherit' })
    : spawnSync('tar', ['-xf', archive, '-C', dest], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`cannot unpack ${path.basename(archive)}`);
}
function find(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const f = find(p, name); if (f) return f; } else if (e.name === name) return p;
  }
  return null;
}
function place(src, bin, name) {
  fs.mkdirSync(bin, { recursive: true });
  const dest = path.join(bin, name);
  fs.rmSync(dest, { force: true });
  fs.copyFileSync(src, dest);
  fs.chmodSync(dest, 0o755);
  return dest;
}

// Download, verify, unpack and put the tool's binaries into <home>/bin. Returns the installed paths.
export async function installPortable(name, { home, log = console.log, arch = process.arch, platform = process.platform } = {}) {
  const bin = binDir(home);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `fcwm-${name}-`));
  try {
    if (name === 'ffmpeg' && platform === 'win32') {
      const file = `ffmpeg-master-latest-${arch === 'arm64' ? 'winarm64' : 'win64'}-gpl.zip`;
      const sums = await text(`${FFMPEG_WIN}/checksums.sha256`);
      const want = (sums.split('\n').find((l) => l.trim().endsWith(file)) || '').split(/\s+/)[0];
      log(`downloading ${file} from github.com/BtbN/FFmpeg-Builds`);
      const zip = path.join(tmp, file);
      await download(`${FFMPEG_WIN}/${file}`, zip);
      verify(zip, want);
      unpack(zip, path.join(tmp, 'ff'));
      return ['ffmpeg.exe', 'ffprobe.exe'].map((exe) => {
        const src = find(path.join(tmp, 'ff'), exe);
        if (!src) throw new Error(`${exe} not found in the download`);
        return place(src, bin, exe);
      });
    }
    if (name === 'ffmpeg') {
      const base = FFMPEG_MAC[arch];
      const out = [];
      for (const tool of ['ffmpeg', 'ffprobe']) {
        const zip = path.join(tmp, `${tool}.zip`);
        log(`downloading ${tool} from ffmpeg.martin-riedl.de`);
        await download(`${base}/${tool}.zip`, zip);
        verify(zip, (await text(`${base}/${tool}.zip.sha256`)).trim().split(/\s+/)[0]);
        unpack(zip, path.join(tmp, tool));
        const exe = find(path.join(tmp, tool), tool);
        if (!exe) throw new Error(`${tool} not found in the download`);
        out.push(place(exe, bin, tool));
      }
      return out;
    }
    if (name === 'gh') {
      // the latest-release page redirects to .../tag/v<version> (no API call, so no rate limit)
      const r = await fetch('https://github.com/cli/cli/releases/latest', { redirect: 'manual' });
      const v = ((r.headers.get('location') || '').match(/\/tag\/v([\w.-]+)$/) || [])[1];
      if (!v) throw new Error('cannot find the latest GitHub CLI release');
      const a = arch === 'arm64' ? 'arm64' : 'amd64';
      const file = platform === 'darwin' ? `gh_${v}_macOS_${a}.zip` : `gh_${v}_linux_${a}.tar.gz`;
      const base = `https://github.com/cli/cli/releases/download/v${v}`;
      const sums = await text(`${base}/gh_${v}_checksums.txt`);
      const want = (sums.split('\n').find((l) => l.trim().endsWith(` ${file}`)) || '').split(/\s+/)[0];
      log(`downloading GitHub CLI ${v}`);
      const archive = path.join(tmp, file);
      await download(`${base}/${file}`, archive);
      verify(archive, want);
      unpack(archive, path.join(tmp, 'gh'));
      const exe = find(path.join(tmp, 'gh'), 'gh');
      if (!exe) throw new Error('gh not found in the download');
      return [place(exe, bin, 'gh')];
    }
    throw new Error(`no per-user install for ${name}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Put <home>/bin first on this process's PATH (idempotent).
export function usePortableBin(home, env = process.env) {
  const bin = binDir(home);
  const parts = (env.PATH || '').split(path.delimiter);
  if (!parts.includes(bin)) env.PATH = [bin, ...parts.filter(Boolean)].join(path.delimiter);
  return bin;
}
