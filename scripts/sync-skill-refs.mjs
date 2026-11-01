#!/usr/bin/env node
// Copy shared documents into each skill's references/ so a skill installed on its own (for example with
// `npx skills add`, which copies only the skill folder) still has what it links to.
//
//   node scripts/sync-skill-refs.mjs          write the copies
//   node scripts/sync-skill-refs.mjs --check  exit 1 if any copy differs from its source (used by validate)
//
// Edit the source, never the copy: each copy starts with a line naming its source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function renderContract() {
  const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8').replace(/\r\n/g, '\n');
  const start = agents.indexOf('## Render contract');
  const end = agents.indexOf('\n## ', start + 3);
  return '# Render contract\n' + agents.slice(start + '## Render contract'.length, end).trimEnd() + '\n';
}

const engineRefs = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.md')).map((n) => [`${dir}/${n}`, n]);

export const MAP = {
  'skills/directing-motion-films/references': [
    ['knowledge/lessons.md', 'lessons.md'], ['knowledge/checklist.md', 'checklist.md'], ['knowledge/critique.md', 'critique.md'],
    ['AGENTS.md#render-contract', 'render-contract.md']],
  'skills/fcwm-motion-reel/references': [...engineRefs('engines/motion-reel/references'), ['AGENTS.md#render-contract', 'render-contract.md']],
  'skills/fcwm-hyperframes/references': [['engines/hyperframes/README.md', 'adapter.md'], ['AGENTS.md#render-contract', 'render-contract.md']],
};

export function expected() {
  const files = {};
  for (const [dir, pairs] of Object.entries(MAP)) {
    for (const [src, name] of pairs) {
      const body = (src === 'AGENTS.md#render-contract' ? renderContract() : fs.readFileSync(path.join(ROOT, src), 'utf8')).replace(/\r\n/g, '\n');
      files[`${dir}/${name}`] = `<!-- Copied from ${src} by scripts/sync-skill-refs.mjs. Edit the source, then run it again. -->\n${body}`;
    }
  }
  return files;
}

export function drift() {
  return Object.entries(expected()).filter(([rel, body]) => {
    const p = path.join(ROOT, rel);
    const lf = (x) => x.replace(/\r\n/g, '\n');
    return !fs.existsSync(p) || lf(fs.readFileSync(p, 'utf8')) !== lf(body);
  }).map(([rel]) => rel);
}

const isMain = () => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (process.argv[1] && isMain()) {
  if (process.argv.includes('--check')) {
    const d = drift();
    if (d.length) { console.error(`out of date (run node scripts/sync-skill-refs.mjs):\n  ${d.join('\n  ')}`); process.exit(1); }
    console.log('skill references in sync');
  } else {
    for (const [rel, body] of Object.entries(expected())) {
      fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
      fs.writeFileSync(path.join(ROOT, rel), body);
    }
    console.log(`wrote ${Object.keys(expected()).length} reference copies`);
  }
}
