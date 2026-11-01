// Files every new film carries so it renders the same anywhere: FCWM's motion blocks (lib/) and a
// placeholder typeface (templates/fonts/, Inter, OFL-1.1) the user replaces with their own.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// lib/ without tests and READMEs, into <film>/lib/fcwm/ (films import './lib/fcwm/core.js').
export function copyLib(dest) {
  fs.cpSync(path.join(REPO, 'lib'), dest, { recursive: true, filter: (p) => !/[\\/](test|README\.md)$/.test(p) && !p.endsWith('README.md') });
}

// The placeholder face under each name the film's @font-face rules use (e.g. ['display', 'ui']):
// <name>.woff2 (Latin) and <name>-ext.woff2 (Latin Extended), plus the licence. Existing files stay.
export function copyFonts(dest, names = ['display']) {
  const src = path.join(REPO, 'templates', 'fonts');
  fs.mkdirSync(dest, { recursive: true });
  const put = (from, to) => { if (!fs.existsSync(path.join(dest, to))) fs.copyFileSync(path.join(src, from), path.join(dest, to)); };
  for (const n of names) { put('sans.woff2', `${n}.woff2`); put('sans-ext.woff2', `${n}-ext.woff2`); }
  put('OFL.txt', 'OFL.txt');
}


// three.js (MIT) for a HyperFrames 3-D film: the ES module build and its licence, from FCWM's own
// node_modules (installed with FCWM), into <film>/lib/three/.
const THREE_DIR = path.join(REPO, 'node_modules', 'three');
export const threeVersion = () => JSON.parse(fs.readFileSync(path.join(THREE_DIR, 'package.json'), 'utf8')).version;
export function copyThree(dest) {
  if (!fs.existsSync(path.join(THREE_DIR, 'build', 'three.module.js'))) throw new Error(`three.js is missing in ${THREE_DIR}: run npm install in the FCWM folder`);
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ['three.module.js', 'three.core.js']) fs.copyFileSync(path.join(THREE_DIR, 'build', f), path.join(dest, f));
  fs.copyFileSync(path.join(THREE_DIR, 'LICENSE'), path.join(dest, 'LICENSE'));
}
