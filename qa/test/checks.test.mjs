import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loudness, frameRate, blankFrames, safeZone, determinism, probe, alphaChannel } from '../checks.mjs';

const hasFfmpeg = !spawnSync('ffmpeg', ['-version']).error && !spawnSync('ffprobe', ['-version']).error;
const skip = hasFfmpeg ? false : 'ffmpeg/ffprobe not on PATH: media checks not run here';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcwm-qa-'));
const f = (n) => path.join(dir, n);
const ff = (...a) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a]); assert.equal(r.status, 0, String(r.stderr)); };
const V = ['-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=4'];
const ENC = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p'];

before(() => {
  if (!hasFfmpeg) return;
  ff(...V, '-f', 'lavfi', '-i', 'anoisesrc=color=pink:duration=4:seed=1', '-af', 'loudnorm=I=-14:TP=-2:LRA=7,aresample=48000', ...ENC, '-c:a', 'aac', '-shortest', f('ok.mp4'));
  ff(...V, '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=4', '-af', 'volume=0dB', ...ENC, '-c:a', 'aac', '-shortest', f('hot.mp4'));
  ff(...V, ...ENC, f('silent.mp4'));
  ff('-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=1', '-f', 'lavfi', '-i', 'color=black:size=320x240:rate=30:duration=1',
    '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=1', '-filter_complex', '[0][1][2]concat=n=3:v=1', ...ENC, f('gap.mp4'));
  ff('-f', 'lavfi', '-i', 'color=c=red@0.5:size=64x64:rate=30:duration=1,format=yuva444p10le', '-c:v', 'prores_ks', '-profile:v', '4', f('alpha.mov'));
  ff(...V, '-vf', "select='not(between(n,30,40))'", '-fps_mode', 'passthrough', ...ENC, f('vfr.mp4'));
});

test('loudness: -14 LUFS passes', { skip }, () => {
  const r = loudness(f('ok.mp4'));
  assert.ok(Math.abs(r.lufs + 14) <= 1, `got ${r.lufs}`);
  assert.equal(r.pass, true);
});
test('loudness: a full-scale tone fails', { skip }, () => assert.equal(loudness(f('hot.mp4')).pass, false));
test('loudness: no audio is skipped, not failed', { skip }, () => {
  const r = loudness(f('silent.mp4'));
  assert.equal(r.pass, true);
  assert.match(r.skipped, /no audio/);
});
test('frameRate: constant 30 fps passes, dropped frames fail', { skip }, () => {
  assert.equal(frameRate(f('silent.mp4'), 30).pass, true);
  assert.equal(frameRate(f('vfr.mp4'), 30).pass, false);
  assert.equal(probe(f('silent.mp4')).width, 320);
});
test('blankFrames: finds the black second, honours allowBlank', { skip }, () => {
  const r = blankFrames(f('gap.mp4'));
  assert.equal(r.pass, false);
  assert.equal(r.spans.length, 1);
  assert.ok(r.spans[0].from >= 0.95 && r.spans[0].to <= 2.0, JSON.stringify(r.spans));
  assert.equal(blankFrames(f('gap.mp4'), [[1, 2]]).pass, true);
  assert.equal(blankFrames(f('silent.mp4')).pass, true);
});
test('safeZone: 9x16 caption near the bottom fails', () => {
  const ok = { x: 100, y: 400, w: 800, h: 200 };
  const low = { x: 100, y: 1700, w: 800, h: 120 };
  assert.equal(safeZone([ok], '9x16', [1080, 1920]).pass, true);
  assert.deepEqual(safeZone([ok, low], '9x16', [1080, 1920]).offenders, [low]);
  assert.match(safeZone(undefined, '9x16', [1080, 1920]).skipped, /FILM_TEXT_BOXES/);
});
test('determinism: compares bytes per time', async () => {
  const write = (tag, same) => [0, 1].map((t) => {
    const p = path.join(dir, `${tag}-${t}.png`);
    fs.writeFileSync(p, same || t === 0 ? 'x' : tag);
    return { t, file: p };
  });
  assert.equal((await determinism((tag) => write(tag, true))).pass, true);
  assert.deepEqual((await determinism((tag) => write(tag, false))).diffs, [1]);
});

test('alphaChannel: ProRes 4444 with alpha passes, H.264 fails', { skip }, () => {
  assert.equal(alphaChannel(f('alpha.mov')).pass, true);
  assert.equal(alphaChannel(f('silent.mp4')).pass, false);
});
