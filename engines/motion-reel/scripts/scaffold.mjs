// Start a new film directory in the current folder (the project root) from the motion-reel template,
// and check the toolchain the pipeline needs (node, ffmpeg, uv, Playwright).
//
//   node <skill>/scripts/scaffold.mjs <slug> [--title "..."] [--duration 15] [--formats 16x9,9x16] [--3d] [--pathtrace]
//
// Creates <slug>/{index.html, film.js, film.json, lib/motion.js, assets/, docs/, audio/, fonts/}.
// --3d also copies lib/gl.js (three.js sets composited into the 2-D film, references/3d.md) and adds
// an import map to index.html; the project then needs `npm i three opentype.js`.
// --pathtrace (implies --3d) adds lib/pathtrace.js, a path-traced sample film (sets/studio.js) and a
// "pathtrace" block in film.json; the project also needs the pinned path tracer (PATHTRACE_DEPS).
// Refuses to touch an existing directory.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = process.cwd();
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const slug = args[0];
if (!slug || slug.startsWith('--') || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error('usage: scaffold.mjs <slug: lowercase, digits, dashes> [--title] [--duration] [--formats]');
  process.exit(1);
}
const dir = path.join(ROOT, slug);
if (fs.existsSync(dir)) {
  console.error(`${slug}/ already exists; pick another slug or edit it in place`);
  process.exit(1);
}
const title = opt('title', slug);
const duration = Number(opt('duration', 15));
const formats = opt('formats', '16x9').split(',');
const pathtrace = args.includes('--pathtrace');
const three = pathtrace || args.includes('--3d');
// pinned: the WebGL tracer is deprecated upstream and may leave in a later release (references/pathtrace.md)
const PATHTRACE_DEPS = 'three-gpu-pathtracer@0.0.27 three-mesh-bvh@0.9.17';
const bad = formats.filter((f) => !['16x9', '9x16', '1x1'].includes(f));
if (bad.length) { console.error(`unknown format(s): ${bad.join(', ')}`); process.exit(1); }

for (const d of ['lib', 'assets', 'docs', 'audio', 'fonts']) fs.mkdirSync(path.join(dir, d), { recursive: true });
const tpl = path.join(SKILL, 'assets', 'template');
for (const f of ['index.html', 'film.js']) {
  fs.writeFileSync(path.join(dir, f), fs.readFileSync(path.join(tpl, f), 'utf8').replaceAll('__TITLE__', title));
}
fs.copyFileSync(path.join(SKILL, 'assets', 'lib', 'motion.js'), path.join(dir, 'lib', 'motion.js'));
if (three) {
  fs.copyFileSync(path.join(SKILL, 'assets', 'lib', 'gl.js'), path.join(dir, 'lib', 'gl.js'));
  fs.mkdirSync(path.join(dir, 'sets'), { recursive: true });
  // the import map resolves three (and the opentype.js that TTFLoader asks for) from the project's
  // node_modules, which render.mjs serves at /node_modules/: nothing comes from a CDN at render time
  const map = `<script type="importmap">
{ "imports": {
  "three": "/node_modules/three/build/three.module.js",
  "three/addons/": "/node_modules/three/examples/jsm/",${pathtrace ? `
  "three/examples/jsm/": "/node_modules/three/examples/jsm/",
  "three-mesh-bvh": "/node_modules/three-mesh-bvh/src/index.js",
  "three-gpu-pathtracer": "/node_modules/three-gpu-pathtracer/src/index.js",` : ''}
  "https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/+esm": "/node_modules/opentype.js/dist/opentype.module.js"
} }
</script>
</head>`;
  const idx = path.join(dir, 'index.html');
  fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace('</head>', map));
}
if (pathtrace) {
  const ptpl = path.join(tpl, 'pathtrace');
  fs.copyFileSync(path.join(SKILL, 'assets', 'lib', 'pathtrace.js'), path.join(dir, 'lib', 'pathtrace.js'));
  fs.writeFileSync(path.join(dir, 'film.js'), fs.readFileSync(path.join(ptpl, 'film.js'), 'utf8').replaceAll('__TITLE__', title));
  fs.copyFileSync(path.join(ptpl, 'studio.js'), path.join(dir, 'sets', 'studio.js'));
}
fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify({ title, duration, formats, poster: +(duration * 0.87).toFixed(2),
  ...(pathtrace ? { pathtrace: { spp: 256, scale: 1, checkSpp: 32, checkScale: 0.5 } } : {}) }, null, 1) + '\n');

console.log(`${slug}/ ready: index.html film.js film.json lib/motion.js${three ? ' lib/gl.js sets/' : ''}${pathtrace ? ' lib/pathtrace.js sets/studio.js' : ''} assets/ docs/ audio/ fonts/`);
console.log(`primary format ${formats[0]}${formats.length > 1 ? `, also ${formats.slice(1).join(', ')}` : ''}; ${duration}s`);

// ---------------- toolchain check (warn, don't fail: the plan and shot list don't need it yet)
const have = (cmd, a = ['-version']) => spawnSync(cmd, a, { stdio: 'ignore' }).status === 0;
const missing = [];
if (!have('ffmpeg')) missing.push('ffmpeg + ffprobe (brew install ffmpeg)');
if (!have('uv', ['--version'])) missing.push('uv (https://docs.astral.sh/uv/, runs the Python audio scripts)');
let pw = false;
for (const base of [ROOT, SKILL]) {
  try { createRequire(path.join(base, 'noop.js')).resolve('playwright'); pw = true; break; } catch { /* next */ }
}
if (!pw) missing.push('playwright in this folder (npm i -D playwright && npx playwright install chromium)');
if (three) {
  // render.mjs serves /node_modules/ from this folder, else from the FCWM install (three and the path
  // tracer come with FCWM's npm ci)
  const fcwmModules = path.resolve(SKILL, '..', '..', 'node_modules');
  const has = (m) => fs.existsSync(path.join(ROOT, 'node_modules', m)) || fs.existsSync(path.join(fcwmModules, m));
  if (!has('three') || !has('opentype.js')) missing.push('three.js (npm ci in the FCWM folder, or npm i three opentype.js here), for --3d');
  if (pathtrace && (!has('three-gpu-pathtracer') || !has('three-mesh-bvh'))) missing.push(`the path tracer (npm ci in the FCWM folder, or npm i ${PATHTRACE_DEPS} here), for --pathtrace`);
}
if (pathtrace) console.log('\npath-traced mode: seconds per frame on a GPU, far slower without one (GitHub Actions has none). Check with low samples first (film.json pathtrace.checkSpp).');
if (missing.length) console.log(`\nbefore rendering, install:\n  - ${missing.join('\n  - ')}`);
