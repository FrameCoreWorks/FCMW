import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uninstall, MARKER } from '../lib/uninstall.mjs';

function fixture() {
  const user = fs.mkdtempSync(path.join(os.tmpdir(), 'fcwm-un-'));
  const home = path.join(user, '.fcwm');
  for (const d of ['app', 'node', 'bin', 'brand-kits/acme']) fs.mkdirSync(path.join(home, d), { recursive: true });
  fs.writeFileSync(path.join(home, 'state.json'), '{}');
  fs.writeFileSync(path.join(user, '.zprofile'), `export A=1\nexport PATH="${home}/bin:$PATH"  ${MARKER}\n`);
  return { user, home };
}

test('uninstall: without --yes only lists, nothing is removed', () => {
  const { user, home } = fixture();
  const out = [];
  uninstall(home, { log: (m) => out.push(m), platform: 'darwin', userHome: user });
  assert.ok(fs.existsSync(path.join(home, 'app')));
  assert.match(out.join('\n'), /would remove/);
});

test('uninstall --yes: removes FCWM and its PATH line, keeps brand kits and the rest of the profile', () => {
  const { user, home } = fixture();
  uninstall(home, { yes: true, log: () => {}, platform: 'darwin', userHome: user });
  assert.deepEqual(fs.readdirSync(home), ['brand-kits']);
  const prof = fs.readFileSync(path.join(user, '.zprofile'), 'utf8');
  assert.ok(prof.includes('export A=1') && !prof.includes(MARKER));
});

test('uninstall --yes --all: brand kits go too', () => {
  const { user, home } = fixture();
  uninstall(home, { yes: true, all: true, log: () => {}, platform: 'linux', userHome: user });
  assert.deepEqual(fs.readdirSync(home), []);
});
