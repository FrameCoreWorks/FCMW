import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from '../lib/args.mjs';
import { buildCommand, quoteWin } from '../lib/proc.mjs';
import { checkTools } from '../lib/tools.mjs';
import { loadFilm, loadAdapter } from '../lib/film.mjs';
import { main } from '../fcwm.mjs';
import { gridJSON } from '../../engines/motion-reel/adapter.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fcwm cli '));
const quiet = { log: () => {} };
const makeFilm = (root, slug, cfg, files = {}) => {
  const dir = path.join(root, slug);
  fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify(cfg));
  for (const [n, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, n), body);
  return dir;
};

test('parseArgs: positionals, flags, values, =values', () => {
  assert.deepEqual(parseArgs(['render', 'x', '--check', '--format', '9x16', '--at=1,2']),
    { _: ['render', 'x'], check: true, format: '9x16', at: '1,2' });
  assert.deepEqual(parseArgs(['new', '--3d', 'film'], { booleans: ['3d'] }), { _: ['new', 'film'], '3d': true });
});

test('buildCommand quotes paths with spaces and & for Windows shims only', () => {
  const p = 'C:\\Users\\Jan Kowalski\\Codex&Claude\\film';
  assert.deepEqual(buildCommand('npx', ['render', p], 'win32'), { file: 'npx', args: ['render', `"${p}"`], shell: true });
  assert.deepEqual(buildCommand('npx', ['render', p], 'darwin'), { file: 'npx', args: ['render', p], shell: false });
  assert.deepEqual(buildCommand('ffmpeg', ['-i', p], 'win32').shell, false);
  assert.equal(quoteWin('plain'), 'plain');
});

test('checkTools: an empty PATH reports each tool with an install hint', () => {
  const r = checkTools(['ffmpeg', 'uv'], { path: '', platform: 'darwin' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing.map((m) => m.hint), ['brew install ffmpeg', 'brew install uv']);
});

test('loadFilm: defaults and validation', () => {
  const root = tmp();
  makeFilm(root, 'a', { duration: 10 });
  const f = loadFilm('a', root);
  assert.equal(f.engine, 'hyperframes');
  assert.deepEqual(f.formats, ['9x16']);
  assert.equal(f.renderDir, path.join(root, 'a', 'render'));
  makeFilm(root, 'b', { engine: 'flash' });
  assert.throws(() => loadFilm('b', root), /engine "flash"/);
  assert.throws(() => loadFilm('missing', root), /film.json missing/);
});

test('motion-reel plan: check renders a contact sheet per format', async () => {
  const root = tmp();
  makeFilm(root, 'm', { engine: 'motion-reel', formats: ['9x16', '1x1'] }, { 'film.js': '' });
  const mr = await loadAdapter('motion-reel');
  const steps = mr.plan(loadFilm('m', root), 'check');
  assert.deepEqual(steps.filter((s) => s.cmd).map((s) => s.args.slice(1)), [
    ['--film', 'm', '--contact', '--format', '9x16'], ['--film', 'm', '--contact', '--format', '1x1']]);
  assert.ok(steps.every((s) => !s.cmd || s.cwd === root));
});

test('motion-reel plan: full keeps the render.sh order and scores first when score.py exists', async () => {
  const root = tmp();
  const dir = makeFilm(root, 'm', { engine: 'motion-reel' }, { 'film.js': 'const HITS = [];' });
  fs.writeFileSync(path.join(dir, 'audio', 'score.py'), '');
  const mr = await loadAdapter('motion-reel');
  const film = loadFilm('m', root);
  const steps = mr.plan(film, 'full');
  assert.deepEqual(steps.map((s) => s.label.split(/[ :]/)[0]), ['score', 'picture', 'sound', 'mix', 'deliver']);
  assert.equal(steps[0].cmd, 'uv');
  assert.ok(steps[0].env.MOTION_REEL_SKILL.endsWith(path.join('engines', 'motion-reel')));
  assert.equal(steps[2].when(), true);
  assert.equal(steps[3].when(), false);
  assert.deepEqual(mr.requires(film), ['ffmpeg', 'ffprobe', 'uv']);
});

test('gridJSON: steady grid covers the duration', () => {
  const g = gridJSON({ bpm: 120, duration: 2 });
  assert.equal(g.period, 0.5);
  assert.deepEqual(g.beats, [0, 0.5, 1, 1.5, 2]);
  assert.deepEqual(g.downbeats, [0, 2]);
});

test('fcwm new refuses an existing folder and changes nothing', async () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'taken'));
  fs.writeFileSync(path.join(root, 'taken', 'keep.txt'), 'x');
  await assert.rejects(main(['new', 'taken'], { cwd: root, ...quiet }), /already exists/);
  assert.deepEqual(fs.readdirSync(path.join(root, 'taken')), ['keep.txt']);
  await assert.rejects(main(['new', 'Bad Name'], { cwd: root, ...quiet }), /lowercase/);
});

test('fcwm render --dry-run prints steps and runs nothing', async () => {
  const root = tmp();
  makeFilm(root, 'm', { engine: 'motion-reel' }, { 'film.js': '' });
  const lines = [];
  assert.equal(await main(['render', 'm', '--dry-run'], { cwd: root, log: (l) => lines.push(l) }), 0);
  const out = lines.join('\n');
  assert.match(out, /picture 9x16/);
  assert.match(out, /phone preview/);
  assert.equal(fs.existsSync(path.join(root, 'm', 'render')), false);
});
