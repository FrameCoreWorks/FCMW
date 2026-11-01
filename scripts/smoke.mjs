#!/usr/bin/env node
// End-to-end smoke test: one short film per engine, created, rendered and checked with the real tools.
//   node scripts/smoke.mjs [--keep] [--only hyperframes|motion-reel]
// Needs everything `fcwm doctor` checks. Used by .github/workflows/smoke.yml.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from './fcwm.mjs';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcwm smoke & test '));
const failures = [];

async function step(label, argv) {
  console.log(`\n=== ${label}: fcwm ${argv.join(' ')}`);
  const code = await main(argv, { cwd: dir }).catch((e) => { console.error(e.message); return 1; });
  if (code !== 0) failures.push(`${label} (exit ${code})`);
  return code;
}

const films = [
  { engine: 'hyperframes', slug: 'smoke-hf', extra: [] },
  { engine: 'motion-reel', slug: 'smoke-mr', extra: ['--engine', 'motion-reel'] },
].filter((f) => !only || f.engine === only);

for (const f of films) {
  if ((await step(`${f.engine} new`, ['new', f.slug, '--duration', '3', ...f.extra])) !== 0) continue;
  await step(`${f.engine} check`, ['render', f.slug, '--check']);
  const sheet = path.join(dir, f.slug, 'render', 'contact_9x16_p1.png');
  if (!fs.existsSync(sheet)) failures.push(`${f.engine}: no contact sheet at ${sheet}`);
  await step(`${f.engine} render + QA`, ['render', f.slug]);
  await step(`${f.engine} determinism`, ['qa', f.slug, '--determinism']);
}

console.log(`\nfilms in: ${dir}`);
if (!args.includes('--keep') && !failures.length) fs.rmSync(dir, { recursive: true, force: true });
if (failures.length) { console.error(`\nSMOKE FAILED:\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log('\nsmoke: ok');
