// The short block `fcwm run` prints last, made to be copied from the Terminal into a chat: what ran,
// each film's result and files, every failed check with its fix, the error if any, and what to do next.
// The agent on the other side reads it instead of the whole log (skills/fcwm/references/handoff.md).
import fs from 'node:fs';
import path from 'node:path';

const FIX = {
  firstFrame: 'frame 0 is empty: start on the hook',
  fill: '9:16 content too small or high: fill the middle of the frame',
  repeats: 'scenes look copied: give each its own layout',
  motion: 'the picture stands still: keep something moving',
  loudness: 'sound not at -14 LUFS / -1 dBTP',
  frameRate: 'frame rate not constant',
  blankFrames: 'blank frames',
  size: 'wrong canvas size',
};

function filmLines(film) {
  const qaFile = path.join(film.renderDir, 'qa.json');
  if (!fs.existsSync(qaFile)) return [`film ${film.slug}: no QA report (not rendered)`];
  const qa = JSON.parse(fs.readFileSync(qaFile, 'utf8'));
  const lines = [];
  for (const v of qa.videos || []) {
    const checks = { ...v, ...(v.composition || {}) };
    const failed = Object.entries(checks).filter(([k, c]) => FIX[k] && c && typeof c === 'object' && 'pass' in c && !c.pass && !c.skipped);
    lines.push(`film ${film.slug}: ${path.basename(v.file || '')} QA ${failed.length ? 'FAILED' : 'passed'}`);
    for (const [k] of failed) lines.push(`  FAIL ${k}: ${FIX[k]}`);
  }
  const files = fs.readdirSync(film.renderDir).filter((n) => /\.(mp4|mov|webm|gif|png)$/.test(n) && !n.startsWith('.'));
  lines.push(`  files: ${film.renderDir}${files.length ? ` (${files.join(', ')})` : ''}`);
  return lines;
}

export function runSummary({ version, os, args, films = [], error, qaFailed = false, next }) {
  const out = ['----- FCWM summary: copy from here into the chat -----',
    `FCWM ${version} on ${os}, node ${process.versions.node}: fcwm ${args.join(' ')}`];
  for (const f of films) {
    try { out.push(...filmLines(f)); } catch (e) { out.push(`film ${f.slug}: could not read the QA report (${e.message})`); }
  }
  out.push(error ? `result: FAILED: ${String(error.message || error).split('\n').slice(0, 4).join(' | ')}`
    : qaFailed ? 'result: rendered, but QA FAILED (see FAIL lines)' : 'result: OK');
  if (next) out.push(`next: ${next}`);
  out.push('----- end of summary -----');
  return out.join('\n');
}
