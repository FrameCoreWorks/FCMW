// Remove FCWM from this computer: ~/.fcwm (the app, its Node.js, per-user tools, state) and the PATH
// line the installer added. Brand kits stay unless --all. Shared caches other programs may use (uv,
// npx, Playwright, Homebrew or winget packages) are listed with the command to clear them, never touched.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MARKER = '# FCWM: node and render tools';
const PROFILES = ['.zprofile', '.bash_profile', '.profile', '.bashrc'];

export function uninstallPlan(home, { all = false, platform = process.platform, userHome = os.homedir() } = {}) {
  const entries = fs.existsSync(home) ? fs.readdirSync(home) : [];
  const keep = all ? [] : entries.filter((e) => e === 'brand-kits');
  const remove = entries.filter((e) => !keep.includes(e)).map((e) => path.join(home, e));
  const profiles = platform === 'win32' ? [] : PROFILES.map((f) => path.join(userHome, f))
    .filter((f) => { try { return fs.readFileSync(f, 'utf8').includes(MARKER); } catch { return false; } });
  const shared = [
    'uv cache clean   (Manim and Blender packages, if no other project uses uv)',
    platform === 'win32' ? 'npx clear-npx-cache   (HyperFrames)' : 'rm -rf ~/.npm/_npx   (HyperFrames)',
    'npx playwright uninstall --all   (Chromium, motion-reel only)',
  ];
  return { home, remove, keep: keep.map((e) => path.join(home, e)), profiles, shared };
}

export function uninstall(home, { yes = false, all = false, log = console.log, platform = process.platform, userHome } = {}) {
  const plan = uninstallPlan(home, { all, platform, userHome });
  if (!plan.remove.length && !plan.profiles.length) { log(`FCWM is not installed in ${home}; nothing to remove`); return plan; }
  log(yes ? 'removing:' : 'would remove (add --yes to do it):');
  for (const p of plan.remove) log(`  ${p}`);
  for (const f of plan.profiles) log(`  the FCWM PATH line in ${f}`);
  for (const k of plan.keep) log(`kept: ${k} (your brand kits; add --all to remove them too)`);
  log('shared caches FCWM used, left alone (clear them yourself if nothing else needs them):');
  for (const s of plan.shared) log(`  ${s}`);
  if (!yes) return plan;
  if (platform === 'win32') {
    // Windows cannot delete the running node.exe: hand the user one line for a fresh window
    log(`close this window, open a new PowerShell window and paste:\n  Remove-Item -Recurse -Force ${plan.remove.map((p) => `'${p.replace(/'/g, "''")}'`).join(', ')}`);
    return plan;
  }
  for (const p of plan.remove) fs.rmSync(p, { recursive: true, force: true });
  for (const f of plan.profiles) {
    const lines = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !l.includes(MARKER));
    fs.writeFileSync(f, lines.join('\n'));
  }
  log('FCWM removed. To use it again, run the first-time command.');
  return plan;
}
