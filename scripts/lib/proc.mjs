// Child processes that work the same on macOS, Linux and Windows, including paths with spaces or '&'.
import { spawn } from 'node:child_process';

// Windows runs npm/npx through .cmd shims, which need a shell; every argument is then quoted.
const WIN_SHIMS = new Set(['npm', 'npx', 'uv', 'uvx']);
const WIN_SPECIAL = /[\s&()^|<>"%!]/;

export function quoteWin(arg) {
  const s = String(arg);
  return WIN_SPECIAL.test(s) || s === '' ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCommand(cmd, args = [], platform = process.platform) {
  if (platform === 'win32' && WIN_SHIMS.has(cmd)) {
    return { file: cmd, args: args.map(quoteWin), shell: true };
  }
  return { file: cmd, args: args.map(String), shell: false };
}

// Run a command; resolves with its exit code. stdio is inherited unless capture is set.
export function run(cmd, args = [], { cwd, env, capture = false } = {}) {
  const c = buildCommand(cmd, args);
  return new Promise((resolve, reject) => {
    const child = spawn(c.file, c.args, {
      cwd, shell: c.shell, env: { ...process.env, ...env },
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '', stderr = '';
    if (capture) {
      child.stdout.on('data', (d) => { stdout += d; });
      child.stderr.on('data', (d) => { stderr += d; });
    }
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}
