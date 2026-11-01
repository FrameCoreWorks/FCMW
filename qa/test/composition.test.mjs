import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { frameStats, firstFrame, fill, repeats, holds, motion, compositionChecks } from '../composition.mjs';

const skip = spawnSync('ffmpeg', ['-version']).status !== 0 ? 'ffmpeg not installed' : false;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcwm-comp-'));
// 9:16 frame at 270x480: background #111, optional white box (fractions of the frame)
function png(name, box, { bg = '0x111111', color = 'white' } = {}) {
  const f = path.join(dir, `${name}.png`);
  const vf = box ? `drawbox=x=iw*${box[0]}:y=ih*${box[1]}:w=iw*${box[2]}:h=ih*${box[3]}:color=${color}:t=fill` : 'null';
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${bg}:s=270x480`, '-vf', vf, '-frames:v', '1', f]);
  assert.equal(r.status, 0);
  return f;
}

test('frameStats: background, content share and box', { skip }, () => {
  const s = frameStats(png('centre', [0.1, 0.25, 0.8, 0.5]));
  assert.deepEqual(s.bg, [17, 17, 17]);
  assert.ok(Math.abs(s.content - 0.4) < 0.03, `content ${s.content}`);
  assert.ok(Math.abs(s.box.y0 - 0.25) < 0.02 && Math.abs(s.box.y1 - 0.75) < 0.02, JSON.stringify(s.box));
  assert.equal(frameStats(png('empty', null)).content, 0);
});

test('firstFrame: empty fails, content passes, allowEmptyStart skips', { skip }, () => {
  assert.equal(firstFrame(frameStats(png('e0', null))).pass, false);
  assert.equal(firstFrame(frameStats(png('c0', [0.2, 0.4, 0.6, 0.1]))).pass, true);
  assert.equal(firstFrame(frameStats(png('e1', null)), { allowEmptyStart: true }).pass, true);
});

test('fill: 9:16 content crowded in the top fails; centred passes; 16:9 skipped', { skip }, () => {
  const top = [0, 1, 2].map((i) => frameStats(png(`top${i}`, [0.1, 0.05, 0.8, 0.3])));
  const mid = [0, 1, 2].map((i) => frameStats(png(`mid${i}`, [0.1, 0.2, 0.8, 0.6])));
  assert.equal(fill(top, '9x16').pass, false);
  assert.equal(fill(mid, '9x16').pass, true);
  assert.ok(fill(top, '16x9').skipped);
});

test('repeats: the same frame 3 s apart fails, different frames pass, end card ignored', { skip }, () => {
  const a = png('ra', [0.1, 0.3, 0.5, 0.3]), b = png('rb', [0.3, 0.5, 0.6, 0.2]);
  const fr = (list) => list.map(([t, file]) => ({ t, file, stats: frameStats(file) }));
  assert.deepEqual(repeats(fr([[0, a], [2, b], [4, a]]), 10).pairs, [[0, 4]]);
  assert.equal(repeats(fr([[0, a], [4, b]]), 10).pass, true);
  assert.equal(repeats(fr([[0, a], [9, a]]), 10).pass, true);  // 9 s is inside the 1.5 s end card
  assert.equal(repeats(fr([[0, a], [4, a]]), 10, { allowRepeats: true }).pass, true);
});

test('holds: three identical frames in a row fail, a short hold passes', { skip }, () => {
  const a = png('ha', [0.1, 0.3, 0.5, 0.3]), b = png('hb', [0.2, 0.4, 0.5, 0.3]);
  assert.deepEqual(holds([{ t: 0, file: b }, { t: 1, file: a }, { t: 2, file: a }, { t: 3, file: a }, { t: 4, file: b }], 10).spans, [[1, 3]]);
  assert.equal(holds([{ t: 0, file: a }, { t: 1, file: a }, { t: 2, file: b }], 10).pass, true);
});

test('compositionChecks: one or two frames never crash', { skip }, () => {
  const r = compositionChecks([{ t: 0, file: png('one', [0.1, 0.3, 0.8, 0.4]) }], { duration: 1, format: '9x16' });
  assert.equal(r.firstFrame.pass, true);
  assert.equal(r.holds.pass, true);
  assert.equal(compositionChecks([], { duration: 1, format: '9x16' }).firstFrame.skipped, 'no frames');
});

test('motion: a still picture fails, a moving one passes, allowStill skips', { skip }, () => {
  const vid = (name, src) => {
    const f = path.join(dir, `${name}.mp4`);
    assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', src, '-t', '6', '-pix_fmt', 'yuv420p', f]).status, 0);
    return f;
  };
  const still = vid('still', 'color=c=0x222222:s=270x480:r=30,drawbox=x=40:y=200:w=190:h=60:color=white:t=fill');
  const moving = vid('moving', 'testsrc2=s=270x480:r=30');
  const r = motion(still);
  assert.equal(r.pass, false);
  assert.equal(r.stillShare, 1);
  assert.equal(motion(moving).pass, true);
  assert.equal(motion(still, { allowStill: true }).pass, true);
});
