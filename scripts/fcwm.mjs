#!/usr/bin/env node
// FCWM command line: new film, render, quality checks. Works on macOS, Windows and Linux.
//
//   node scripts/fcwm.mjs new <name> [--engine hyperframes|motion-reel] [--3d] [--pathtrace] [--format 9x16,16x9]
//                                    [--duration 15] [--bpm 120] [--title "..."] [--alpha]
//   node scripts/fcwm.mjs render <film> [--check | --at 3.2,7.5] [--format 9x16] [--export gif,webm,mov,mov-alpha,webm-alpha] [--no-qa]
//   node scripts/fcwm.mjs qa <film | video.mp4> [--determinism]
//   node scripts/fcwm.mjs run <folder> [--check] [--cloud [--repo fcwm-renders]]   install what is missing, then render
//   node scripts/fcwm.mjs setup [<folder>]           show what is installed and what a film still needs
//   node scripts/fcwm.mjs command <folder> --os macos|windows|linux [--next] [--cloud]   the line to paste
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
import { byStillTime } from './lib/contact.mjs';
import { parseExports, exportSteps, exportPath, EXPORTS } from './lib/export.mjs';
import { checkVideo, determinism, summarize, alphaChannel, probe } from '../qa/checks.mjs';
import { requirementsFor, ensure, detect, readState, statePath, fcwmHome } from './lib/setup.mjs';
import { handoffCommand, normalizeOs } from './lib/handoff.mjs';
import { cloudRender, cloudPlan } from './lib/cloud.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;
const catalog = JSON.parse(fs.readFileSync(path.join(REPO, 'engines', 'catalog.json'), 'utf8'));

// A film loads GSAP when a script tag or an import names it, or it calls gsap.*; a comment does not count.
export const LOADS_GSAP = /<script[^>]*gsap|from\s+['"][^'"]*gsap|\bgsap\.(timeline|to|from|set)\b/i;

class UserError extends Error { constructor(msg, code = 1) { super(msg); this.code = code; } }

const USAGE = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 14).map((l) => l.replace(/^\/\/ ?/, '')).join('\n');

export async function main(argv, { cwd = process.cwd(), log = console.log } = {}) {
  const a = parseArgs(argv, { booleans: ['check', 'dry-run', '3d', 'pathtrace', 'alpha', 'no-qa', 'determinism', 'help', 'cloud', 'next'] });
  const [cmd, target] = a._;
  if (!cmd || a.help || cmd === 'help') { log(USAGE); return 0; }
  if (cmd === 'engines') return engines(log);
  if (cmd === 'doctor') return doctor(log);
  if (cmd === 'new') return newFilm(target, a, cwd, log);
  if (cmd === 'render') return render(target, a, cwd, log);
  if (cmd === 'qa') return qa(target, a, cwd, log);
  if (cmd === 'run') return runFolder(target, a, cwd, log);
  if (cmd === 'setup') return setup(target, a, cwd, log);
  if (cmd === 'command') return command(target, a, cwd, log);
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
  const engine = (a['3d'] || a.pathtrace) ? 'motion-reel' : (a.engine || 'hyperframes');
  if (!ENGINES.includes(engine)) throw new UserError(`--engine must be one of ${ENGINES.join(', ')}`);
  const formats = String(a.format || '9x16').split(',');
  for (const f of formats) if (!FORMATS[f]) throw new UserError(`--format ${f} is not one of ${Object.keys(FORMATS).join(', ')}`);
  if (a.alpha && !['hyperframes', 'manim'].includes(engine)) throw new UserError('--alpha (transparent background) is available for HyperFrames and Manim films; motion-reel renders opaque frames');
  const adapter = await loadAdapter(engine);
  const steps = adapter.scaffoldSteps(cwd, slug, { duration: Number(a.duration) || 15, formats, bpm: Number(a.bpm) || 120, threeD: !!(a['3d'] || a.pathtrace), pathtrace: !!a.pathtrace, title: a.title, alpha: !!a.alpha });
  if (a['dry-run']) { log(describe(steps)); return 0; }
  await runSteps(steps, { log });
  const cfgPath = path.join(dest, 'film.json');
  if (fs.existsSync(cfgPath)) fs.writeFileSync(cfgPath, JSON.stringify({ ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')), fcwm: VERSION }, null, 2) + '\n');
  log(`new ${engine} film: ${dest}\nnext: write the film, then  fcwm render ${slug} --check`);
  return 0;
}

async function prepare(target, a, cwd, log) {
  if (!target) throw new UserError('name the film folder, for example: fcwm render my-film');
  const film = loadFilm(target, cwd);
  const entry = engineEntry(film.engine);
  if (entry.tier !== 'free') log(`note: ${entry.name} is "${entry.tier}" (${entry.license}). ${entry.license_note || entry.notes || ''}`);
  if (entry.status === 'experimental') log(`note: the ${entry.name} engine is experimental in FCWM ${JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'))).version}.`);
  const html = path.join(film.dir, 'index.html');
  if (fs.existsSync(html) && LOADS_GSAP.test(fs.readFileSync(html, 'utf8')))
    log('note: this film loads GSAP, which is "restricted" (GSAP Standard licence: free, custom terms with a no-compete clause, not open source).');
  const pt = film.config.pathtrace && engineEntry(film.engine).modes?.find((m) => m.id === 'pathtrace');
  if (pt) log(`note: path-traced film (${pt.library}, ${pt.license}, "${pt.tier}", ${pt.status}). ${pt.cost}`);
  const adapter = await loadAdapter(film.engine);
  return { film, adapter };
}

async function render(target, a, cwd, log) {
  const { film, adapter } = await prepare(target, a, cwd, log);
  if (a.at === true) throw new UserError('--at needs times in seconds, for example --at 3.2,7.5');
  const mode = a.check ? 'check' : a.at ? 'at' : 'full';
  const formats = a.format ? String(a.format).split(',') : film.formats;
  if (film.engine === 'hyperframes' && formats.join() !== film.formats[0])
    throw new UserError(`a HyperFrames film renders only in its own format (${film.formats[0]}); make another film for ${formats.join(', ')}`);
  const steps = adapter.plan(film, mode, { at: String(a.at || ''), formats });
  const kinds = mode === 'full' ? parseExports(a.export ?? film.config.exports) : [];
  if (mode === 'full') steps.push(previewStep(film, formats[0]), ...exportSteps(film, adapter, formats, kinds));
  if (a['dry-run']) { log(describe(steps)); return 0; }
  await requireRenderTools(film, adapter);
  await runSteps(steps, { log });
  log(`done: ${film.renderDir}`);
  if (mode !== 'full' || a['no-qa']) return 0;
  return qaFilm(film, formats, { ...a, kinds }, log);
}

async function requireRenderTools(film, adapter) {
  await requireTools(adapter.requires(film));
  if (film.engine === 'motion-reel' && !(await hasPlaywright([film.root, REPO])))
    throw new UserError('missing: playwright. In the FCWM folder run  npm install && npx playwright install chromium', 2);
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
    if (!fs.existsSync(file)) {
      // --determinism needs only stills: a slow (path-traced) film can be checked before a full render
      if (a.determinism) { log(`SKIP  video checks for ${f}: not rendered yet`); continue; }
      throw new UserError(`${file} not rendered yet: fcwm render ${film.slug}`);
    }
    const r = checkVideo(file, { fps: film.fps, allowBlank: film.config.allowBlank || [] });
    const [W, H] = FORMATS[f];
    r.size = { pass: r.info.width === W && r.info.height === H, got: `${r.info.width}x${r.info.height}`, want: `${W}x${H}` };
    report.videos.push(r);
    log(`QA ${path.basename(file)}\n${summarize(r)}`);
    ok &&= [r.loudness, r.frameRate, r.blankFrames, r.size].every((c) => c.pass);
  }
  for (const kind of a.kinds || []) {
    for (const f of formats) {
      const file = exportPath(film, f, kind);
      const r = { file, exists: { pass: fs.existsSync(file) } };
      if (r.exists.pass && kind !== 'gif') {
        const info = probe(file);
        const [W, H] = FORMATS[f];
        r.size = { pass: info.width === W && info.height === H, got: `${info.width}x${info.height}` };
      }
      if (r.exists.pass && EXPORTS[kind].alpha) r.alpha = alphaChannel(file);
      (report.exports ||= []).push(r);
      log(`QA ${path.basename(file)}\n${summarize(r)}`);
      ok &&= [r.exists, r.size, r.alpha].filter(Boolean).every((c) => c.pass);
    }
  }
  if (a.determinism) {
    const at = [...(film.config.qaTimes || [0.25, film.duration / 2, Math.max(0, film.duration - 0.25)])].map((t) => +Number(t).toFixed(2)).sort((x, y) => x - y);
    await requireRenderTools(film, await loadAdapter(film.engine));
    const stillsDir = path.join(film.renderDir, 'stills');
    report.determinism = await determinism(async (tag) => {
      await runSteps((await loadAdapter(film.engine)).plan(film, 'at', { at: at.join(','), formats: [formats[0]] }), { log: () => {} });
      const files = fs.readdirSync(stillsDir).filter((n) => n.endsWith('.png')).sort(byStillTime);
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

// A folder is one film (it has film.json) or a project folder whose direct subfolders are films.
export function filmsIn(folder, cwd) {
  const dir = path.resolve(cwd, folder);
  if (!fs.existsSync(dir)) throw new UserError(`folder not found: ${dir}\nCheck the path (drag the folder into the Terminal window to paste its exact path).`);
  if (fs.existsSync(path.join(dir, 'film.json'))) return [loadFilm(dir)];
  const films = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'film.json'))).map((d) => loadFilm(path.join(dir, d.name)));
  if (!films.length) throw new UserError(`${dir} holds no film: a film folder has a film.json`);
  return films;
}

const newer = (a, b) => { const p = (v) => String(v).split('.').map(Number); const [x, y] = [p(a), p(b)];
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

async function runFolder(target, a, cwd, log) {
  if (!target) throw new UserError('usage: fcwm run <film folder> [--check] [--cloud]');
  const films = filmsIn(target, cwd);
  for (const film of films) if (film.config.fcwm && newer(film.config.fcwm, VERSION))
    throw new UserError(`${film.slug} was made with FCWM ${film.config.fcwm}, this computer has ${VERSION}. Update with the first-time command (it downloads the new version).`);
  const os = { darwin: 'macos', win32: 'windows' }[process.platform] || 'linux';
  if (a.cloud) {
    const need = ['git', 'gh'];
    log(`FCWM ${VERSION}: checking the tools for a GitHub Actions render`);
    const r = await ensure(need, { repo: REPO, version: VERSION, log, dryRun: a['dry-run'] });
    if (a['dry-run']) { for (const f of films) log(cloudPlan({ film: f, repo: a.repo, ref: a.ref, mode: a.check ? 'check' : 'full' }).map((l, i) => `${i + 1}. ${l}`).join('\n')); return 0; }
    if (!r.ok) throw new UserError(`still missing: ${r.missing.join(', ')}`, 2);
    for (const film of films) await cloudRender({ film, repoDir: REPO, home: fcwmHome(), repo: a.repo || 'fcwm-renders', ref: a.ref || 'main', mode: a.check ? 'check' : 'full', log });
  } else {
    const need = [...new Set(films.flatMap(requirementsFor))];
    log(`FCWM ${VERSION}: checking the tools for ${films.map((f) => f.slug).join(', ')}`);
    const r = await ensure(need, { repo: REPO, version: VERSION, log, dryRun: a['dry-run'] });
    if (!a['dry-run'] && !r.ok) throw new UserError(`still missing: ${r.missing.join(', ')}. ${r.manual.join(' ')}`, 2);
    if (!a['dry-run']) log(`installed tools are recorded in ${statePath()}; the next render skips them.`);
    let code = 0;
    for (const film of films) code = Math.max(code, await render(film.dir, a, cwd, log));
    if (code) return code;
  }
  if (a['dry-run']) return 0;
  log(`\nfinished files: ${films.map((f) => f.renderDir).join(', ')}`);
  log(`next time this computer only needs:\n  ${handoffCommand({ folder: films.length === 1 ? films[0].dir : path.resolve(cwd, target), os, first: false, cloud: !!a.cloud, app: defaultApp() ? undefined : REPO })}`);
  return 0;
}

const defaultApp = () => !process.env.FCWM_HOME && path.resolve(REPO) === path.join(fcwmHome(), 'app');

async function setup(target, a, cwd, log) {
  const films = target ? filmsIn(target, cwd) : [];
  const need = films.length ? [...new Set(films.flatMap(requirementsFor))] : ['ffmpeg', 'chromium', 'uv', 'git', 'gh'];
  const found = detect(need, { repo: REPO });
  log(`FCWM ${VERSION} in ${REPO}, Node ${process.versions.node}`);
  for (const n of need) log(`${found[n] ? 'ok     ' : 'missing'} ${n}${found[n] ? `  ${found[n]}` : ''}`);
  const state = readState();
  log(state ? `last check: ${state.checked} (${statePath()})` : `no checks recorded yet (${statePath()})`);
  return need.every((n) => found[n]) ? 0 : 2;
}

function command(target, a, cwd, log) {
  if (!target) throw new UserError('usage: fcwm command <film folder> --os macos|windows|linux [--next] [--cloud]');
  let os;
  try { os = normalizeOs(a.os || { darwin: 'macos', win32: 'windows' }[process.platform] || 'linux'); } catch (e) { throw new UserError(e.message); }
  log(handoffCommand({ folder: target, os, first: !a.next, cloud: !!a.cloud, ref: a.ref || 'main' }));
  return 0;
}

const isMain = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (process.argv[1] && isMain()) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(err instanceof UserError || !process.env.FCWM_DEBUG ? `fcwm: ${err.message}` : err.stack);
    process.exit(err.code && Number.isInteger(err.code) ? err.code : 1);
  });
}
export { UserError };
