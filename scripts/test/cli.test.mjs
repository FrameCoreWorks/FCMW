import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from '../lib/args.mjs';
import { buildCommand, quoteWin } from '../lib/proc.mjs';
import { checkTools } from '../lib/tools.mjs';
import { loadFilm, loadAdapter } from '../lib/film.mjs';
import { main, LOADS_GSAP } from '../fcwm.mjs';
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
    ['--film', 'm', '--fps', '60', '--contact', '--format', '9x16'], ['--film', 'm', '--fps', '60', '--contact', '--format', '1x1']]);
  assert.ok(steps.every((s) => !s.cmd || s.cwd === root));
});

test('motion-reel plan: full keeps the render.sh order and scores first when score.py exists', async () => {
  const root = tmp();
  const dir = makeFilm(root, 'm', { engine: 'motion-reel' }, { 'film.js': 'const HITS = [];' });
  fs.writeFileSync(path.join(dir, 'audio', 'score.py'), '');
  const mr = await loadAdapter('motion-reel');
  const film = loadFilm('m', root);
  const steps = mr.plan(film, 'full');
  assert.deepEqual(steps.map((s) => s.label.split(/[ :]/)[0]), ['score', 'clear', 'picture', 'sound', 'mix', 'deliver']);
  assert.equal(steps[0].cmd, 'uv');
  assert.ok(steps[0].env.MOTION_REEL_SKILL.endsWith(path.join('engines', 'motion-reel')));
  assert.equal(steps[3].when(), true);
  assert.equal(steps[4].when(), false);
  assert.deepEqual(steps[2].args.slice(3, 5), ['--fps', '60']);
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

test('hyperframes adapter: pinned version, telemetry off, exact render args', async () => {
  const { HYPERFRAMES_VERSION, ENV } = await import('../../engines/hyperframes/adapter.mjs');
  const hf = await loadAdapter('hyperframes');
  const root = tmp();
  makeFilm(root, 'h', { engine: 'hyperframes', fps: 30, formats: ['1x1'] });
  const film = loadFilm('h', root);
  const r = hf.plan(film, 'full').find((s) => s.cmd);
  assert.equal(HYPERFRAMES_VERSION, '0.8.226');
  assert.deepEqual(r.args, ['-y', 'hyperframes@0.8.226', 'render', film.dir, '-o', path.join(film.renderDir, 'h-1x1.mp4'),
    '-f', '30', '-q', 'delivery', '--strict', '--quiet']);
  assert.equal(r.env.HYPERFRAMES_NO_TELEMETRY, '1');
  assert.equal(r.env.DO_NOT_TRACK, '1');
  assert.deepEqual(ENV, r.env);
});

test('hyperframes scaffold: template filled for the format, lib copied, one format only', async () => {
  const hf = await loadAdapter('hyperframes');
  const root = tmp();
  const [step] = hf.scaffoldSteps(root, 'sq', { duration: 6, formats: ['1x1'] });
  step.fn();
  const html = fs.readFileSync(path.join(root, 'sq', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /\{\{/);
  assert.match(html, /data-width="1080" data-height="1080"/);
  assert.doesNotMatch(html, LOADS_GSAP);
  assert.match('<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>', LOADS_GSAP);
  assert.ok(fs.existsSync(path.join(root, 'sq', 'lib', 'fcwm', 'core.js')));
  assert.equal(fs.existsSync(path.join(root, 'sq', 'lib', 'fcwm', 'test')), false);
  assert.deepEqual(loadFilm('sq', root).formats, ['1x1']);
  assert.throws(() => hf.scaffoldSteps(root, 'two', { formats: ['1x1', '9x16'] })[0].fn(), /one format/);
});

test('stillTime reads both engines\' still names', async () => {
  const { stillTime } = await import('../lib/contact.mjs');
  assert.equal(stillTime('frame-02-at-3.75s.png'), 3.75);
  assert.equal(stillTime('t0.250_9x16.png'), 0.25);
  assert.ok(Number.isNaN(stillTime('contact.png')));
});

test('hyperframes films have one format: film.json and --format are both checked', async () => {
  const root = tmp();
  makeFilm(root, 'two', { engine: 'hyperframes', formats: ['9x16', '1x1'] });
  assert.throws(() => loadFilm('two', root), /one format/);
  makeFilm(root, 'one', { engine: 'hyperframes', formats: ['9x16'] });
  await assert.rejects(main(['render', 'one', '--format', '16x9', '--dry-run'], { cwd: root, ...quiet }), /only in its own format/);
  await assert.rejects(main(['render', 'one', '--at'], { cwd: root, ...quiet }), /needs times/);
});

test('determinism: a pass that wrote fewer stills fails instead of throwing', async () => {
  const { determinism } = await import('../../qa/checks.mjs');
  const dir = tmp();
  const p = path.join(dir, 'x.png');
  fs.writeFileSync(p, 'x');
  const r = await determinism(async (tag) => (tag === 'a' ? [{ t: 0, file: p }, { t: 1, file: p }] : [{ t: 0, file: p }]));
  assert.equal(r.pass, false);
  assert.match(r.error, /2 and 1/);
});

test('fcwm.mjs runs when started through a symlink (npm bin)', async () => {
  const { spawnSync } = await import('node:child_process');
  const dir = tmp();
  const link = path.join(dir, 'fcwm');
  try { fs.symlinkSync(path.resolve('scripts/fcwm.mjs'), link); } catch { return; } // Windows without symlink rights
  const r = spawnSync(process.execPath, [link, 'engines'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /hyperframes/);
});

test('fcwm new --pathtrace: path tracer lib, sample set, import map and quality block', async () => {
  const root = tmp();
  assert.equal(await main(['new', 'pt', '--pathtrace', '--format', '16x9'], { cwd: root, ...quiet }), 0);
  const dir = path.join(root, 'pt');
  for (const f of ['lib/gl.js', 'lib/pathtrace.js', 'sets/studio.js', 'film.js']) assert.ok(fs.existsSync(path.join(dir, f)), f);
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.match(html, /"three-gpu-pathtracer": "\/node_modules\/three-gpu-pathtracer\/src\/index.js"/);
  assert.match(html, /"three-mesh-bvh": /);
  assert.match(fs.readFileSync(path.join(dir, 'film.js'), 'utf8'), /PT\.renderSet\(/);
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'film.json'), 'utf8'));
  assert.equal(cfg.engine, 'motion-reel');
  assert.deepEqual(cfg.pathtrace, { spp: 256, scale: 1, checkSpp: 32, checkScale: 0.5 });
});

test('motion-reel plan: a path-traced film is checked with few samples at reduced size', async () => {
  const root = tmp();
  makeFilm(root, 'p', { engine: 'motion-reel', formats: ['16x9'], pathtrace: { spp: 512, checkSpp: 8, checkScale: 0.25 } });
  const steps = (await loadAdapter('motion-reel')).plan(loadFilm('p', root), 'check');
  const sheet = steps.find((s) => s.label === 'contact sheet 16x9');
  assert.deepEqual(sheet.args.slice(-4), ['--spp', '8', '--pt-scale', '0.25']);
});

test('pathtrace.js never calls Math.random or the clock to paint', () => {
  const src = fs.readFileSync(new URL('../../engines/motion-reel/assets/lib/pathtrace.js', import.meta.url), 'utf8')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(src, /Date\.now|performance\.now|requestAnimationFrame|setTimeout/);
  assert.doesNotMatch(src, /Math\.random\(\)/);
});

test('exports: parse, transcode args, alpha only from engines that can render it', async () => {
  const { parseExports, exportSteps, exportPath } = await import('../lib/export.mjs');
  assert.deepEqual(parseExports('gif,webm,gif'), ['gif', 'webm']);
  assert.deepEqual(parseExports(undefined), []);
  assert.throws(() => parseExports('avi'), /unknown export avi/);
  const root = tmp();
  makeFilm(root, 'm', { engine: 'motion-reel' }, { 'film.js': '' });
  const film = loadFilm('m', root);
  const mr = await loadAdapter('motion-reel');
  const [gif] = exportSteps(film, mr, ['9x16'], ['gif']);
  assert.equal(gif.cmd, 'ffmpeg');
  assert.equal(gif.args.at(-1), path.join(film.renderDir, 'm-9x16.gif'));
  assert.throws(() => exportSteps(film, mr, ['9x16'], ['mov-alpha']), /cannot render transparency/);
  makeFilm(root, 'h', { engine: 'hyperframes', fps: 30 });
  const hfFilm = loadFilm('h', root);
  const [alpha] = exportSteps(hfFilm, await loadAdapter('hyperframes'), ['9x16'], ['mov-alpha']);
  assert.ok(alpha.args.includes('--format') && alpha.args.includes('mov'));
  assert.equal(alpha.args[alpha.args.indexOf('-o') + 1], exportPath(hfFilm, '9x16', 'mov-alpha'));
});

test('fcwm new --alpha: transparent ground and a mov-alpha export; refused for motion-reel', async () => {
  const root = tmp();
  assert.equal(await main(['new', 'ov', '--alpha', '--duration', '3'], { cwd: root, ...quiet }), 0);
  assert.match(fs.readFileSync(path.join(root, 'ov', 'index.html'), 'utf8'), /--ground: transparent;/);
  assert.deepEqual(loadFilm('ov', root).config.exports, ['mov-alpha']);
  await assert.rejects(main(['new', 'x3', '--alpha', '--engine', 'motion-reel'], { cwd: root, ...quiet }), /HyperFrames/);
});

test('manim adapter: pinned through uv, film size per format, alpha via ProRes 4444', async () => {
  const { MANIM_VERSION } = await import('../../engines/manim/adapter.mjs');
  const mn = await loadAdapter('manim');
  const root = tmp();
  makeFilm(root, 'eq', { engine: 'manim', fps: 30, formats: ['16x9'] });
  const film = loadFilm('eq', root);
  const steps = mn.plan(film, 'full');
  const render = steps.find((s) => s.cmd === 'uv');
  assert.deepEqual(render.args.slice(0, 8), ['run', '--quiet', '--python', '3.12', '--with', `manim==${MANIM_VERSION}`, 'manim', 'render']);
  assert.ok(render.args.join(' ').includes('-r 1920,1080 --fps 30'));
  assert.equal(steps.at(-1).args.at(-1), path.join(film.renderDir, 'eq-16x9.mp4'));
  const [alpha, prores] = mn.alphaSteps(film, 'mov-alpha', '16x9', '/x/out.mov');
  assert.ok(alpha.args.includes('--transparent'));
  assert.ok(prores.args.includes('yuva444p10le'));
  assert.deepEqual(mn.requires(), ['ffmpeg', 'ffprobe', 'uv']);
});

test('fcwm new --engine manim: scene.py and film.json from the starter', async () => {
  const root = tmp();
  assert.equal(await main(['new', 'eq', '--engine', 'manim', '--format', '16x9', '--duration', '6'], { cwd: root, ...quiet }), 0);
  const film = loadFilm('eq', root);
  assert.equal(film.engine, 'manim');
  assert.equal(film.duration, 6);
  assert.equal(film.config.scene, 'Film');
  assert.match(fs.readFileSync(path.join(root, 'eq', 'scene.py'), 'utf8'), /class Film\(Scene\)/);
});
