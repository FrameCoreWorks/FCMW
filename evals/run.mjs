#!/usr/bin/env node
// FCWM eval runner. An agent (any model) makes each task in evals/tasks/ as a film folder named after the
// task id, inside one folder per model. This script scores what it made, without a model:
//
//   node evals/run.mjs score <films-folder> --model <name> [--release 0.4.0] [--tasks promo-15s,chart-10s]
//   node evals/run.mjs report [--release 0.4.0]
//
// score: for each task, checks the film exists, renders it (fcwm render), runs QA and the determinism
// check, and records pass/fail, render time and the size of the film's own code into
// evals/results/<release>/<model>.json. Visual scores (the rubric in qa/README.md, 1-10 per category)
// come from a judge looking at the contact sheets and go into the same file under "visual" by hand or
// with --visual <scores.json>. report: one Markdown table per release, evals/results/<release>/README.md.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../scripts/lib/args.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const CLI = path.join(REPO, 'scripts', 'fcwm.mjs');
const VERSION = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;
const CATEGORIES = ['hook', 'readability', 'motion', 'variety', 'briefFit', 'soundSync'];

export function loadTasks(dir = path.join(HERE, 'tasks')) {
  return fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort().map((n) => {
    const text = fs.readFileSync(path.join(dir, n), 'utf8');
    const [, head, brief] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text) || [];
    if (!head) throw new Error(`${n}: missing front matter`);
    const meta = Object.fromEntries(head.split('\n').map((l) => l.split(/:\s*/, 2)).map(([k, ...v]) => [k.trim(), v.join(':').trim()]));
    return { id: meta.id, engine: meta.engine, format: meta.format, duration: Number(meta.duration), brief: brief.trim() };
  });
}

function fcwm(args, cwd) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', maxBuffer: 64 << 20 });
  return { code: r.status, seconds: Number(process.hrtime.bigint() - t0) / 1e9, out: (r.stdout || '') + (r.stderr || '') };
}

// Lines of the film's own code (not lib copies, vendored players or generated files).
export function codeSize(dir) {
  let lines = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['lib', 'render', 'node_modules', '.manim', '.blender', '.hyperframes', 'brand', 'assets'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(html|js|mjs|py|css)$/.test(e.name)) lines += fs.readFileSync(p, 'utf8').split('\n').length;
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return lines;
}

export function scoreTask(task, filmsDir, { skipRender = false } = {}) {
  const dir = path.join(filmsDir, task.id);
  const row = { task: task.id, made: fs.existsSync(path.join(dir, 'film.json')) };
  if (!row.made) return row;
  const film = JSON.parse(fs.readFileSync(path.join(dir, 'film.json'), 'utf8'));
  Object.assign(row, { engine: film.engine, formats: film.formats, duration: film.duration, codeLines: codeSize(dir),
    formatOk: (film.formats || []).includes(task.format), durationOk: Math.abs(Number(film.duration) - task.duration) <= 0.5 });
  if (skipRender) return row;
  const render = fcwm(['render', task.id], filmsDir);
  row.render = { pass: render.code === 0, seconds: Math.round(render.seconds) };
  const qaFile = path.join(dir, 'render', 'qa.json');
  if (fs.existsSync(qaFile)) {
    const qa = JSON.parse(fs.readFileSync(qaFile, 'utf8'));
    row.qa = Object.fromEntries((qa.videos || []).flatMap((v) => ['loudness', 'frameRate', 'blankFrames', 'size']
      .filter((k) => v[k]).map((k) => [k, v[k].skipped ? 'skip' : v[k].pass ? 'pass' : 'fail'])));
    for (const e of qa.exports || []) row.qa[`export:${path.basename(e.file)}`] = [e.exists, e.size, e.alpha].filter(Boolean).every((c) => c.pass) ? 'pass' : 'fail';
  }
  if (row.render.pass && film.engine !== 'blender') {
    const det = fcwm(['qa', task.id, '--determinism'], filmsDir);
    row.qa = { ...(row.qa || {}), determinism: det.code === 0 ? 'pass' : 'fail' };
  }
  row.automatedPass = row.render.pass && row.formatOk && row.durationOk && Object.values(row.qa || {}).every((v) => v !== 'fail');
  return row;
}

function score(filmsDir, a) {
  if (!filmsDir || !a.model) throw new Error('usage: node evals/run.mjs score <films-folder> --model <name> [--release x.y.z]');
  const release = a.release || VERSION;
  const only = a.tasks ? String(a.tasks).split(',') : null;
  const tasks = loadTasks().filter((t) => !only || only.includes(t.id));
  const out = path.join(HERE, 'results', release, `${a.model}.json`);
  const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : { model: a.model, release, tasks: {} };
  for (const t of tasks) {
    console.log(`> ${a.model} / ${t.id}`);
    prev.tasks[t.id] = { ...prev.tasks[t.id], ...scoreTask(t, path.resolve(filmsDir), { skipRender: !!a['no-render'] }) };
    console.log(JSON.stringify(prev.tasks[t.id]));
  }
  if (a.visual) for (const [id, s] of Object.entries(JSON.parse(fs.readFileSync(a.visual, 'utf8')))) prev.tasks[id] = { ...prev.tasks[id], visual: s };
  prev.scored = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(prev, null, 2) + '\n');
  console.log(`wrote ${out}`);
  return 0;
}

export function visualMean(v) {
  const s = CATEGORIES.map((c) => v?.[c]).filter((x) => typeof x === 'number');
  return s.length ? Math.round((s.reduce((p, x) => p + x, 0) / s.length) * 10) / 10 : null;
}

export function report(release = VERSION, dir = path.join(HERE, 'results', release)) {
  const runs = fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort().map((n) => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')));
  const ids = [...new Set(runs.flatMap((r) => Object.keys(r.tasks)))].sort();
  const cell = (t) => {
    if (!t?.made) return 'not made';
    const auto = t.automatedPass ? 'QA ok' : t.render ? 'QA fail' : 'made';
    const vis = visualMean(t.visual);
    return vis === null ? auto : `${auto}, ${vis}`;
  };
  const lines = [`# Eval results, FCWM ${release}`, '', 'Cell: automated checks (render, QA, determinism, format, duration), then the mean visual score (1-10) when judged.', '',
    `| Task | ${runs.map((r) => r.model).join(' | ')} |`, `| --- |${runs.map(() => ' --- |').join('')}`,
    ...ids.map((id) => `| ${id} | ${runs.map((r) => cell(r.tasks[id])).join(' | ')} |`), ''];
  for (const r of runs) for (const id of ids) {
    const notes = r.tasks[id]?.notes;
    if (notes) lines.push(`- **${r.model} / ${id}:** ${notes}`);
  }
  fs.writeFileSync(path.join(dir, 'README.md'), lines.join('\n') + '\n');
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = parseArgs(process.argv.slice(2), { booleans: ['no-render'] });
  const [cmd, target] = a._;
  try {
    if (cmd === 'score') process.exit(score(target, a));
    if (cmd === 'report') { console.log(report(a.release || VERSION)); process.exit(0); }
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  } catch (e) { console.error(`evals: ${e.message}`); process.exit(1); }
}
