import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadTasks, codeSize, scoreTask, report, visualMean } from '../run.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fcwm-evals-'));

test('tasks: every task has an id matching its file, a format and a duration', () => {
  const tasks = loadTasks();
  assert.ok(tasks.length >= 5);
  for (const t of tasks) {
    assert.match(t.id, /^[a-z0-9-]+$/);
    assert.ok(['9x16', '16x9', '1x1'].includes(t.format), t.id);
    assert.ok(t.duration > 0 && t.brief.length > 80, t.id);
  }
});

test('scoreTask without render: made, engine, format and duration checks, code size skips lib copies', () => {
  const root = tmp();
  const dir = path.join(root, 'chart-10s');
  fs.mkdirSync(path.join(dir, 'lib', 'fcwm'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify({ engine: 'manim', formats: ['16x9'], duration: 10 }));
  fs.writeFileSync(path.join(dir, 'scene.py'), 'a\nb\nc');
  fs.writeFileSync(path.join(dir, 'lib', 'fcwm', 'core.js'), 'x\n'.repeat(500));
  assert.equal(codeSize(dir), 3);
  const task = loadTasks().find((t) => t.id === 'chart-10s');
  const row = scoreTask(task, root, { skipRender: true });
  assert.deepEqual([row.made, row.engine, row.formatOk, row.durationOk], [true, 'manim', true, true]);
  assert.equal(scoreTask(loadTasks().find((t) => t.id === 'promo-15s'), root, { skipRender: true }).made, false);
});

test('report: one row per task, one column per model, visual mean when judged', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ model: 'a', tasks: { x: { made: true, render: {}, automatedPass: true, visual: { hook: 8, readability: 9 } } } }));
  fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify({ model: 'b', tasks: { x: { made: false } } }));
  const md = report('test', dir);
  assert.match(md, /\| x \| QA ok, 8\.5 \| not made \|/);
  assert.equal(visualMean({}), null);
});
