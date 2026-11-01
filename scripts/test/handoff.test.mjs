import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { handoffCommand, quoteSh, quotePs, normalizeOs } from '../lib/handoff.mjs';
import { installPlan, requirementsFor, detect, ensure, writeState, readState, FULL } from '../lib/setup.mjs';
import { copySource, tempRepoName, cloudPlan } from '../lib/cloud.mjs';
import { main, filmsIn } from '../fcwm.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "fcwm handoff & co's "));
const film = (root, slug, cfg) => {
  const dir = path.join(root, slug);
  fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify(cfg));
  return dir;
};
const VOLUME = "/Volumes/Codex&Claude/Claude/projekty/Klient's film/zażółć";

test('quoteSh keeps spaces, &, quotes and non-ASCII literal in a real shell', { skip: process.platform === 'win32' }, () => {
  for (const s of [VOLUME, 'a"b$c`d\\e', "it's", '']) {
    assert.equal(execFileSync('bash', ['-c', `printf %s ${quoteSh(s)}`], { encoding: 'utf8' }), s);
  }
});

test('quotePs doubles single quotes', () => {
  assert.equal(quotePs("D:\\Klient's & co\\film"), "'D:\\Klient''s & co\\film'");
});

test('handoffCommand: first time downloads the installer, next time only runs', () => {
  assert.equal(handoffCommand({ folder: VOLUME, os: 'mac' }),
    `curl -fsSL https://raw.githubusercontent.com/FrameCoreWorks/FCWM/main/scripts/install.sh | bash -s -- ${quoteSh(VOLUME)}`);
  assert.equal(handoffCommand({ folder: VOLUME, os: 'linux', first: false, cloud: true }),
    `node ~/.fcwm/app/scripts/fcwm.mjs run ${quoteSh(VOLUME)} --cloud`);
  assert.equal(handoffCommand({ folder: 'D:\\Films\\a & b', os: 'windows' }),
    "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/FrameCoreWorks/FCWM/main/scripts/install.ps1))) 'D:\\Films\\a & b'");
  assert.equal(handoffCommand({ folder: 'D:\\x', os: 'win', first: false }), `node "$HOME\\.fcwm\\app\\scripts\\fcwm.mjs" run 'D:\\x'`);
  assert.equal(handoffCommand({ folder: '/f', os: 'macos', first: false, app: '/opt/my fcwm' }), `node '/opt/my fcwm/scripts/fcwm.mjs' run '/f'`);
  assert.throws(() => normalizeOs('amiga'), /--os must be one of/);
});

test('requirementsFor: per engine, uv only for a Python score', () => {
  const root = tmp();
  const hf = { engine: 'hyperframes', dir: film(root, 'a', {}) };
  const mr = { engine: 'motion-reel', dir: film(root, 'b', {}) };
  assert.deepEqual(requirementsFor(hf), ['ffmpeg', 'hyperframes']);
  assert.deepEqual(requirementsFor(mr), ['ffmpeg', 'chromium']);
  fs.writeFileSync(path.join(mr.dir, 'audio', 'score.py'), '');
  assert.deepEqual(requirementsFor(mr), ['ffmpeg', 'chromium', 'uv']);
});

test('installPlan: the package manager of each OS, or a manual step', () => {
  const yes = () => true, no = () => false;
  assert.deepEqual(installPlan('ffmpeg', { platform: 'darwin', hasBin: yes }).args, ['install', 'ffmpeg']);
  // a Mac without Homebrew: per-user installs, no administrator password
  assert.equal(installPlan('ffmpeg', { platform: 'darwin', hasBin: no }).portable, 'ffmpeg');
  assert.equal(installPlan('gh', { platform: 'darwin', hasBin: no }).portable, 'gh');
  assert.match(installPlan('uv', { platform: 'darwin', hasBin: no }).args[1], /astral\.sh\/uv\/install\.sh/);
  assert.deepEqual(installPlan('git', { platform: 'darwin', hasBin: no }).args, ['--install']);
  assert.match(installPlan('pango', { platform: 'darwin', hasBin: no }).manual, /brew\.sh/);
  // Windows without winget, Scoop or Chocolatey
  assert.equal(installPlan('ffmpeg', { platform: 'win32', hasBin: no }).portable, 'ffmpeg');
  assert.match(installPlan('uv', { platform: 'win32', hasBin: no }).args.at(-1), /install\.ps1/);
  assert.deepEqual(installPlan('ffmpeg', { platform: 'win32', hasBin: yes }).args.slice(0, 3), ['install', '--id', 'Gyan.FFmpeg']);
  assert.match(installPlan('gh', { platform: 'linux', hasBin: (b) => b === 'apt-get' || b === 'sudo' }).args[1], /apt-get install -y --no-install-recommends gh$/);
  assert.equal(installPlan('gh', { platform: 'linux', hasBin: (b) => b === 'apt-get' }).portable, 'gh');  // no sudo: per user
  assert.deepEqual(installPlan('chromium', { platform: 'linux', repo: '/r' }).args, ['playwright', 'install', '--with-deps', 'chromium']);
  assert.deepEqual(installPlan('chromium', { platform: 'darwin', repo: '/r' }).args, ['playwright', 'install', 'chromium']);
  assert.deepEqual(installPlan('ffmpeg', { platform: 'win32', hasBin: (b) => b === 'choco' }).args, ['install', 'ffmpeg', '-y', '--no-progress']);
  assert.deepEqual(installPlan('ffmpeg', { platform: 'win32', hasBin: (b) => b === 'scoop' }).args, ['install', 'ffmpeg']);
  assert.deepEqual(installPlan('hyperframes').args.slice(-2), ['browser', 'ensure']);
  assert.ok(installPlan('manim').args.includes('--with') && installPlan('manim').args.some((x) => /^manim==/.test(x)));
  assert.ok(installPlan('bpy').args.some((x) => /^bpy==/.test(x)));
  assert.ok(!installPlan('bpy').args.includes('--offline'));
});

test('FULL: every engine, uv before the Python engines', () => {
  for (const n of ['ffmpeg', 'uv', 'chromium', 'hyperframes', 'manim', 'bpy']) assert.ok(FULL.includes(n), n);
  assert.ok(FULL.indexOf('uv') < FULL.indexOf('manim') && FULL.indexOf('uv') < FULL.indexOf('bpy'));
  const root = tmp();
  assert.deepEqual(requirementsFor({ engine: 'manim', dir: film(root, 'm', {}) }).filter((n) => n !== 'pango'), ['ffmpeg', 'uv', 'manim']);
  assert.deepEqual(requirementsFor({ engine: 'blender', dir: film(root, 'b', {}) }), ['ffmpeg', 'uv', 'bpy']);
});

test('detect + ensure (dry run): nothing on an empty PATH, every tool planned, nothing run', async () => {
  const lines = [];
  const found = detect(['ffmpeg', 'uv'], { envPath: '', platform: 'darwin' });
  assert.deepEqual(found, { ffmpeg: null, uv: null });
  const saved = process.env.PATH;
  process.env.PATH = '';
  try {
    const r = await ensure(['ffmpeg'], { repo: '/r', dryRun: true, log: (l) => lines.push(l) });
    assert.equal(r.ok, false);
    assert.deepEqual(r.missing, ['ffmpeg']);
  } finally { process.env.PATH = saved; }
});

test('state file: written under FCWM_HOME and merged with earlier checks', () => {
  const env = { FCWM_HOME: tmp() };
  writeState({ ffmpeg: '/usr/bin/ffmpeg' }, { version: '0.0.1', env });
  writeState({ uv: null }, { version: '0.0.1', env });
  const s = readState(env);
  assert.deepEqual(s.tools, { ffmpeg: { path: '/usr/bin/ffmpeg' }, uv: null });
  assert.equal(s.fcwm, '0.0.1');
});

test('filmsIn: one film folder, or a project folder of films', () => {
  const root = tmp();
  film(root, 'one', { engine: 'hyperframes' });
  film(root, 'two', { engine: 'motion-reel', formats: ['9x16'] });
  fs.mkdirSync(path.join(root, 'notes'));
  assert.deepEqual(filmsIn(root, '/').map((f) => f.slug), ['one', 'two']);
  assert.deepEqual(filmsIn(path.join(root, 'one'), '/').map((f) => f.slug), ['one']);
  assert.throws(() => filmsIn(path.join(root, 'notes'), '/'), /holds no film/);
  assert.throws(() => filmsIn(path.join(root, 'nope'), '/'), /folder not found/);
});

test('copySource leaves render/, .fcwm/ and .DS_Store behind', () => {
  const root = tmp();
  const dir = film(root, 'f', {});
  for (const p of ['render/x.mp4', '.fcwm/out/a', 'assets/.DS_Store', 'assets/logo.svg', 'assets/render/keep.txt']) {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), '1');
  }
  const to = path.join(root, 'copy');
  copySource(dir, to);
  const list = fs.readdirSync(to, { recursive: true }).map((p) => p.split(path.sep).join('/')).sort();
  assert.deepEqual(list, ['assets', 'assets/logo.svg', 'assets/render', 'assets/render/keep.txt', 'audio', 'film.json']);
});

test('fcwm run --dry-run plans the installs and the render, changes nothing', async () => {
  const root = tmp();
  const dir = film(root, 'dry', { engine: 'hyperframes', duration: 2 });
  const lines = [];
  const code = await main(['run', dir, '--dry-run'], { log: (l) => lines.push(l) });
  assert.equal(code, 0);
  assert.match(lines.join('\n'), /checking the tools for dry/);
  assert.match(lines.join('\n'), /hyperframes@/);
  assert.equal(fs.existsSync(path.join(dir, 'render')), false);
});

test('fcwm run refuses a film made with a newer FCWM', async () => {
  const root = tmp();
  const dir = film(root, 'future', { engine: 'hyperframes', fcwm: '99.0.0' });
  await assert.rejects(main(['run', dir, '--dry-run'], { log: () => {} }), /made with FCWM 99\.0\.0/);
});

test('fcwm command prints the line to paste', async () => {
  const lines = [];
  await main(['command', VOLUME, '--os', 'macos', '--next'], { log: (l) => lines.push(l) });
  assert.deepEqual(lines, [`node ~/.fcwm/app/scripts/fcwm.mjs run ${quoteSh(VOLUME)}`]);
});

test('cloud: a temporary repository per render, deleted after the download; --public on request', () => {
  assert.equal(tempRepoName('Mój Film!', new Date('2026-11-01T16:40:05Z')), 'fcwm-render-m-j-film-20261101-164005');
  const film = { dir: '/f/x', slug: 'x', renderDir: '/f/x/render' };
  const plan = cloudPlan({ film, visibility: 'public' }).join('\n');
  assert.match(plan, /gh repo create <you>\/fcwm-render-x-\d{8}-\d{6} --public/);
  assert.match(plan, /gh repo delete/);
  const kept = cloudPlan({ film, repo: 'renders' }).join('\n');
  assert.match(kept, /--private .*it is kept/);
  assert.doesNotMatch(kept, /gh repo delete/);
  assert.equal(handoffCommand({ folder: '/a b', os: 'macos', first: false, cloud: true, public: true }),
    `node ~/.fcwm/app/scripts/fcwm.mjs run ${quoteSh('/a b')} --cloud --public`);
});

test('run summary: paste-friendly block with failed checks, files and the error', async () => {
  const { runSummary } = await import('../lib/summary.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcwm-sum-'));
  const renderDir = path.join(dir, 'render');
  fs.mkdirSync(renderDir);
  fs.writeFileSync(path.join(renderDir, 'f-9x16.mp4'), '');
  fs.writeFileSync(path.join(renderDir, 'qa.json'), JSON.stringify({ videos: [{ file: 'f-9x16.mp4', loudness: { pass: true },
    composition: { motion: { pass: false }, fill: { pass: true, skipped: 'x' } } }] }));
  const s = runSummary({ version: '1.0.0', os: 'macOS', args: ['run', dir], films: [{ slug: 'f', renderDir }], qaFailed: true, next: 'n' });
  assert.match(s, /^----- FCWM summary/);
  assert.match(s, /FAIL motion: the picture stands still/);
  assert.doesNotMatch(s, /FAIL fill|FAIL loudness/);
  assert.match(s, /files: .*f-9x16\.mp4/);
  assert.match(s, /result: rendered, but QA FAILED/);
  assert.match(runSummary({ version: '1', os: 'Linux', args: ['run'], error: new Error('folder not found: /x\nmore') }), /result: FAILED: folder not found: \/x \| more/);
});
