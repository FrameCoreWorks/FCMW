// Execute adapter steps in order. A step is either {cmd, args, cwd, env} or {fn}; `when` skips it.
import { run } from './proc.mjs';

export function describe(steps) {
  return steps.map((s, i) => {
    const what = s.fn ? '(internal)' : [s.cmd, ...s.args].map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ');
    return `${i + 1}. ${s.label}${s.when ? ' [if needed]' : ''}\n   ${what}`;
  }).join('\n');
}

export async function runSteps(steps, { log = console.log } = {}) {
  const results = [];
  for (const s of steps) {
    if (s.when && !s.when()) { log(`- skip: ${s.label}`); continue; }
    log(`> ${s.label}`);
    if (s.fn) { results.push(await s.fn()); continue; }
    const { code } = await run(s.cmd, s.args, { cwd: s.cwd, env: s.env });
    if (code !== 0) throw new Error(`step failed (${s.label}), exit code ${code}`);
  }
  return results;
}
