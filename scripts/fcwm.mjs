#!/usr/bin/env node
// FCWM command line: new film, render, quality checks. Works on macOS, Windows and Linux.
//
//   node scripts/fcwm.mjs new <name> [--engine hyperframes|motion-reel] [--3d] [--format 9x16,16x9]
//                                    [--duration 15] [--bpm 120] [--title "..."]
//   node scripts/fcwm.mjs render <film> [--check | --at 3.2,7.5] [--format 9x16] [--no-qa]
//   node scripts/fcwm.mjs qa <film | video.mp4> [--determinism]
//   node scripts/fcwm.mjs doctor
//   node scripts/fcwm.mjs engines
//
// Every command takes --dry-run (print the steps, run nothing). Exit codes: 0 ok, 1 failed, 2 missing tool.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { loadFilm, loadAdapter, ENGINES, FORMATS } from './lib/film.mjs';
import { describe, runSteps } from './lib/pipeline.mjs';
import { checkTools, hasPlaywright } from './lib/tools.mjs';
import { run } from './lib/proc.mjs';
import { checkVideo, determinism, summarize } from '../qa/checks.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(REPO, 'engines', 'catalog.json'), 'utf8'));

class UserError extends Error { constructor(msg, code = 1) { super(msg); this.code = code; } }

const USAGE = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 11).map((l) => l.replace(/^\/\/ ?/, '')).join('\n');

export async function main(argv, { cwd = process.cwd(), log = console.log } = {}) {
  const a = parseArgs(argv, { booleans: ['check', 'dry-run', '3d', 'no-qa', 'determinism', 'help'] });
  const [cmd, target] = a._;
  if (!cmd || a.help || cmd === 'help') { log(USAGE); return 0; }
  if (cmd === 'engines') return engines(log);
  if (cmd === 'doctor') return doctor(log);
  if (cmd === 'new') return newFilm(target, a, cwd, log);
  if (cmd === 'render') return render(target, a, cwd, log);
  if (cmd === 'qa') return qa(target, a, cwd, log);
  throw new UserError(`unknown command "${cmd}"\n\n${USAGE}`);
}

function engineEntry(id) { return catalog.engines.find((e) => e.id === id); }

function engines(log) {
  for (const e of catalog.engines) log(`${e.id.padEnd(14)} ${e.tier.padEnd(11)} ${e.status.padEnd(16)} ${e.license}\n  ${e.purpose}`);
  return 0;
}

async function requireTools(names, log) {
  const r = checkTools(names);
  if (!r.ok) throw new UserError(r.missing.map((m) => `missing tool: ${m.name}. Install: ${m.hint}`).join('\n'), 2);
}

async function doctor(log) {
  const major = Number(process.versions.node.split('.')[0]);
  log(`${major >= 22 ? 'ok  ' : 'FAIL'} node ${process.versions.node} (needs 22+)`);
  const r = checkTools(['ffmpeg', 'ffprobe', 'npx', 'uv']);
  for (const n of ['ffmpeg', 'ffprobe', 'npx', 'uv']) {
    const m = r.missing.find((x) => x.name === n);
    log(m ? `${n === 'uv' ? 'opt ' : 'FAIL'} ${n}: ${m.hint}${n === 'uv' ? ' (only for motion-reel scores written in Python)' : ''}` : `ok   ${n}`);
  }
  const pw = await hasPlaywright([process.cwd(), REPO]);
  log(pw ? 'ok   playwright (motion-reel)' : 'FAIL playwright (motion-reel): in the FCWM folder run  npm install && npx playwright install chromium');
  const hard = r.missing.filter((m) => m.name !== 'uv');
  return hard.length || major < 22 || !pw ? 2 : 0;
}

async function newFilm(slug, a, cwd, log) {
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new UserError('usage: fcwm new <name>  (lowercase letters, digits and dashes)');
  const dest = path.join(cwd, slug);
  if (fs.existsSync(dest)) throw new UserError(`${dest} already exists; pick another name (nothing was changed)`);
  const engine = a['3d'] ? 'motion-reel' : (a.engine || 'hyperframes');
  if (!ENGINES.includes(engine)) throw new UserError(`--engine must be one of ${ENGINES.join(', ')}`);
  const formats = String(a.format || '9x16').split(',');
  for (const f of formats) if (!FORMATS[f]) throw new UserError(`--format ${f} is not one of ${Object.keys(FORMATS).join(', ')}`);
  const adapter = await loadAdapter(engine);
  const steps = adapter.scaffoldSteps(cwd, slug, { duration: Number(a.duration) || 15, formats, bpm: Number(a.bpm) || 120, threeD: !!a['3d'], title: a.title });
  if (a['dry-run']) { log(describe(steps)); return 0; }
  await runSteps(steps, { log });
  log(`new ${engine} film: ${dest}\nnext: write the film, then  fcwm render ${slug} --check`);
  return 0;
}

async function prepare(target, a, cwd, log) {
  if (!target) throw new UserError('name the film folder, for example: fcwm render my-film');
  const film = loadFilm(target, cwd);
  const entry = engineEntry(film.engine);
  if (entry.tier !== 'free') log(`note: ${entry.name} is "${entry.tier}" (${entry.license}). ${entry.license_note || entry.notes || ''}`);
  if (entry.status === 'experimental') log(`note: the ${entry.name} engine is experimental in FCWM ${JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'))).version}.`);
  const adapter = await loadAdapter(film.engine);
  return { film, adapter };
}

async function render(target, a, cwd, log) {
  const { film, adapter } = await prepare(target, a, cwd, log);
  const mode = a.check ? 'check' : a.at ? 'at' : 'full';
  const formats = a.format ? String(a.format).split(',') : film.formats;
  const steps = adapter.plan(film, mode, { at: String(a.at || ''), formats });
  if (mode === 'full') steps.push(previewStep(film, formats[0]));
  if (a['dry-run']) { log(describe(steps)); return 0; }
  await requireTools(adapter.requires(film), log);
  if (film.engine === 'motion-reel' && !(await hasPlaywright([film.root, REPO])))
    throw new UserError('missing: playwright. In the FCWM folder run  npm install && npx playwright install chromium', 2);
  await runSteps(steps, { log });
  log(`done: ${film.renderDir}`);
  if (mode !== 'full' || a['no-qa']) return 0;
  return qaFilm(film, formats, a, log);
}

function previewStep(film, format) {
  const src = path.join(film.renderDir, `${film.slug}-${format}.mp4`);
  const dst = path.join(film.renderDir, `${film.slug}-preview.mp4`);
  return { label: 'phone preview (540p wide side 960, 30 fps)', cmd: 'ffmpeg',
    args: ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-vf', 'scale=-2:960,fps=30', '-c:v', 'libx264', '-crf', '30',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', dst] };
}

async function qaFilm(film, formats, a, log) {
  const report = { film: film.slug, engine: film.engine, at: new Date().toISOString(), videos: [] };
  let ok = true;
  for (const f of formats) {
    const file = path.join(film.renderDir, `${film.slug}-${f}.mp4`);
    if (!fs.existsSync(file)) throw new UserError(`${file} not rendered yet: fcwm render ${film.slug}`);
    const r = checkVideo(file, { fps: film.fps, allowBlank: film.config.allowBlank || [] });
    const [W, H] = FORMATS[f];
    r.size = { pass: r.info.width === W && r.info.height === H, got: `${r.info.width}x${r.info.height}`, want: `${W}x${H}` };
    report.videos.push(r);
    log(`QA ${path.basename(file)}\n${summarize(r)}`);
    ok &&= [r.loudness, r.frameRate, r.blankFrames, r.size].every((c) => c.pass);
  }
  if (a.determinism) {
    const at = film.config.qaTimes || [0.25, film.duration / 2, Math.max(0, film.duration - 0.25)].map((t) => +t.toFixed(2));
    const stillsDir = path.join(film.renderDir, 'stills');
    report.determinism = await determinism(async (tag) => {
      await runSteps((await loadAdapter(film.engine)).plan(film, 'at', { at: at.join(','), formats: [formats[0]] }), { log: () => {} });
      const files = fs.readdirSync(stillsDir).filter((n) => n.endsWith('.png')).sort();
      const tagged = path.join(film.renderDir, `determinism-${tag}`);
      fs.mkdirSync(tagged, { recursive: true });
      return files.map((n, i) => { const p = path.join(tagged, n); fs.copyFileSync(path.join(stillsDir, n), p); return { t: at[i] ?? n, file: p }; });
    });
    log(summarize({ determinism: report.determinism }));
    ok &&= report.determinism.pass;
  }
  fs.writeFileSync(path.join(film.renderDir, 'qa.json'), JSON.stringify(report, null, 2));
  log(`${ok ? 'QA passed' : 'QA FAILED'}: ${path.join(film.renderDir, 'qa.json')}`);
  return ok ? 0 : 1;
}

async function qa(target, a, cwd, log) {
  if (!target) throw new UserError('usage: fcwm qa <film | video.mp4>');
  const p = path.resolve(cwd, target);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) {
    await requireTools(['ffmpeg', 'ffprobe'], log);
    const r = checkVideo(p, { fps: a.fps ? Number(a.fps) : undefined });
    log(summarize(r));
    return [r.loudness, r.frameRate, r.blankFrames].every((c) => c.pass) ? 0 : 1;
  }
  const { film } = await prepare(target, a, cwd, log);
  await requireTools(['ffmpeg', 'ffprobe'], log);
  return qaFilm(film, a.format ? String(a.format).split(',') : film.formats, a, log);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(err instanceof UserError ? err.message : err.stack);
    process.exit(err.code && Number.isInteger(err.code) ? err.code : 1);
  });
}
export { UserError };
