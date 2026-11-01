import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { portableFor, usePortableBin, sha256, FFMPEG_MAC } from '../lib/portable.mjs';

test('portableFor: Macs (both chips) and Windows get FFmpeg; Linux uses its package manager', () => {
  assert.ok(portableFor('ffmpeg', { platform: 'darwin', arch: 'arm64' }));
  assert.ok(portableFor('ffmpeg', { platform: 'darwin', arch: 'x64' }));
  assert.ok(portableFor('ffmpeg', { platform: 'win32', arch: 'x64' }));
  assert.equal(portableFor('ffmpeg', { platform: 'linux', arch: 'x64' }), null);
  assert.ok(portableFor('gh', { platform: 'darwin', arch: 'arm64' }));
  assert.equal(portableFor('pango', { platform: 'darwin', arch: 'arm64' }), null);
  for (const url of Object.values(FFMPEG_MAC)) assert.match(url, /^https:\/\/ffmpeg\.martin-riedl\.de\/download\/macos\//);
});

test('usePortableBin: puts ~/.fcwm/bin first on PATH once', () => {
  const env = { PATH: ['/usr/bin', '/bin'].join(path.delimiter) };
  const bin = usePortableBin('/h/.fcwm', env);
  usePortableBin('/h/.fcwm', env);
  assert.equal(env.PATH.split(path.delimiter)[0], bin);
  assert.equal(env.PATH.split(path.delimiter).filter((p) => p === bin).length, 1);
});

test('sha256: matches the known digest of a file', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fcwm-sha-')), 'a.txt');
  fs.writeFileSync(f, 'abc');
  assert.equal(sha256(f), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
