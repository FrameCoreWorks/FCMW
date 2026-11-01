// FCWM adapter for HyperFrames (Apache-2.0, https://github.com/heygen-com/hyperframes).
// Not vendored: the CLI runs through npx at one pinned version, with telemetry switched off.
// A HyperFrames film is composed for one canvas size, so it ships in one format (film.json formats[0]).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sheetTimes, tileSheets, byStillTime, clearSheets } from '../../scripts/lib/contact.mjs';
import { fcwmHome } from '../../scripts/lib/setup.mjs';
import { copyLib, copyFonts, copyThree, threeVersion } from '../../scripts/lib/film-assets.mjs';
import { run } from '../../scripts/lib/proc.mjs';
import { stemsIn, masterInto } from '../../scripts/lib/master.mjs';
import { gridJSON } from '../motion-reel/adapter.mjs';

import { HYPERFRAMES_VERSION, HYPERFRAMES_ENV as ENV } from '../../scripts/lib/versions.mjs';
export { HYPERFRAMES_VERSION, ENV };
// Lottie playback: dotlottie-web (MIT, https://github.com/LottieFiles/dotlottie-web), fetched once from npm
// at this pinned version into ~/.fcwm/cache and copied into the film, so renders read only local files.
export const DOTLOTTIE_VERSION = '0.82.0';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIZES = { '9x16': [1080, 1920], '16x9': [1920, 1080], '1x1': [1080, 1080] };

const hf = (args, cwd) => ({ cmd: 'npx', args: ['-y', `hyperframes@${HYPERFRAMES_VERSION}`, ...args], cwd, env: ENV });

// Text that stays off the canvas: HyperFrames reports canvas_overflow only as info, so a title that runs
// off the frame used to pass. A text finding seen at two or more samples is held, not a transition passing
// through (push and slide transitions are off canvas for one sample at most), and fails the check.
export function textOffFrame(report) {
  const findings = report?.layout?.findings || [];
  return findings.filter((f) => f.code === 'canvas_overflow' && f.text && (f.times?.length || f.occurrences || 0) >= 2);
}

export function summarizeCheck(report) {
  const lines = [];
  for (const [name, part] of Object.entries(report || {})) {
    if (!part || typeof part !== 'object' || !Array.isArray(part.findings)) continue;
    for (const f of part.findings) {
      if (f.severity !== 'error' && f.severity !== 'warning') continue;
      lines.push(`${f.severity.toUpperCase()} ${name} ${f.code}${f.selector ? ` ${f.selector}` : ''}${f.time != null ? ` t=${f.time}s` : ''}: ${f.message}`);
    }
  }
  const off = textOffFrame(report);
  // one line per element (glyph spans share their parent): "#title: 22 letters off the frame"
  const groups = new Map();
  for (const f of off) {
    const key = f.selector.split(' > ')[0];
    const g = groups.get(key) || { text: '', times: new Set() };
    g.text += f.text; f.times.forEach((t) => g.times.add(t)); groups.set(key, g);
  }
  for (const [sel, g] of groups) lines.push(`ERROR layout text_off_frame ${sel}: "${g.text.slice(0, 40)}" runs off the frame at ${[...g.times].sort((a, b) => a - b).join(', ')}s; shorten it, make it smaller or wrap it`);
  return { ok: !!report?.ok && off.length === 0, lines, offFrame: off.length };
}

async function runCheck(film) {
  const { code, stdout, stderr } = await run('npx', ['-y', `hyperframes@${HYPERFRAMES_VERSION}`, 'check', film.dir, '--json'], { cwd: film.root, env: ENV, capture: true });
  let report;
  try { report = JSON.parse(stdout.slice(stdout.indexOf('{'))); } catch {
    process.stderr.write(stderr);
    throw new Error(`step failed (lint, runtime and layout check), exit code ${code}, no JSON report`);
  }
  fs.mkdirSync(film.renderDir, { recursive: true });
  fs.writeFileSync(path.join(film.renderDir, 'check.json'), JSON.stringify(report, null, 2) + '\n');
  const sum = summarizeCheck(report);
  for (const l of sum.lines) console.log(`  ${l}`);
  console.log(`  ${sum.ok ? 'check passed' : 'check failed'} (full report: ${path.join(film.renderDir, 'check.json')})`);
  if (!sum.ok) { const e = new Error('the check found problems (listed above); fix them and run --check again'); e.code = 2; throw e; }
}

export default {
  id: 'hyperframes',
  tier: 'free',
  requires: (film) => ['npx', 'ffmpeg', 'ffprobe', ...(film && fs.existsSync(path.join(film.dir, 'audio', 'score.py')) ? ['uv'] : [])],

  scaffoldSteps(root, slug, { duration = 15, formats = ['9x16'], title, alpha = false, lottie, threeD = false, score = false, bpm } = {}) {
    if (formats.length > 1) throw new Error('a HyperFrames film is composed for one format; make one film per format');
    const [W, H] = SIZES[formats[0]];
    const dir = path.join(root, slug);
    if (lottie && threeD) throw new Error('--lottie and --3d are separate starters; pick one');
    const template = lottie ? 'hyperframes-lottie' : threeD ? 'hyperframes-three' : 'hyperframes-blank';
    // --lottie with a file uses that animation; a bare --lottie starts from a neutral sample.
    const source = typeof lottie === 'string' ? path.resolve(root, lottie) : path.join(REPO, 'templates', template, 'sample.json');
    if (lottie && !/\.(lottie|json)$/i.test(source)) throw new Error('--lottie takes a .lottie or Lottie .json file');
    if (lottie && !fs.existsSync(source)) throw new Error(`--lottie: ${source} not found`);
    const cache = path.join(fcwmHome(), 'cache', `dotlottie-web-${DOTLOTTIE_VERSION}`);
    const cached = () => fs.existsSync(path.join(cache, 'package', 'dist', 'dotlottie-player.wasm'));
    const steps = [];
    if (lottie) steps.push(
      { label: `fetch dotlottie-web ${DOTLOTTIE_VERSION} (MIT) into the FCWM cache`, when: () => !cached(),
        fn: () => fs.mkdirSync(cache, { recursive: true }) },
      { label: 'download the dotlottie-web package', when: () => !cached(),
        cmd: 'npm', args: ['pack', `@lottiefiles/dotlottie-web@${DOTLOTTIE_VERSION}`, '--silent'], cwd: cache },
      { label: 'unpack dotlottie-web', when: () => !cached(),
        cmd: 'tar', args: ['-xzf', `lottiefiles-dotlottie-web-${DOTLOTTIE_VERSION}.tgz`], cwd: cache });
    steps.push({ label: `scaffold (FCWM HyperFrames ${lottie ? 'Lottie ' : threeD ? 'three.js ' : ''}starter)`, fn: () => {
      const animation = lottie ? path.basename(source) : '';
      const vars = { W, H, DURATION: duration, FPS: 30, SIZE: Math.round(Math.min(W, H) * 0.13),
        BOX: Math.round(Math.min(W, H) * 0.8), ANIMATION: animation,
        TITLE: (title || slug).replace(/"/g, '\\"'), FORMATS: JSON.stringify(formats),
        // on-screen words: --title, or a placeholder to replace; escaped for a JS string and an HTML attribute
        TEXT_JS: JSON.stringify(title || 'Your title').replace(/</g, '\\u003c'),
        TEXT_ATTR: (title || 'Your title').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
        GROUND: alpha ? 'transparent' : '#111111', EXPORTS: JSON.stringify(alpha ? ['mov-alpha'] : []) };
      fs.mkdirSync(dir);
      for (const name of ['index.html', 'film.json']) {
        const from = fs.existsSync(path.join(REPO, 'templates', template, name)) ? template : 'hyperframes-blank';
        const text = fs.readFileSync(path.join(REPO, 'templates', from, name), 'utf8');
        fs.writeFileSync(path.join(dir, name), text.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k])));
      }
      copyLib(path.join(dir, 'lib', 'fcwm'));
      copyFonts(path.join(dir, 'fonts'));
      for (const d of ['assets', 'audio', 'docs']) fs.mkdirSync(path.join(dir, d));
      if (threeD) copyThree(path.join(dir, 'lib', 'three'));
      // --score: a synthesized score on a beat grid (beats.json, from --bpm), mixed and mastered by fcwm render
      if (score) fs.writeFileSync(path.join(dir, 'beats.json'), JSON.stringify(gridJSON({ bpm: bpm || 120, duration }), null, 1) + '\n');
      if (score) fs.copyFileSync(path.join(REPO, 'templates', 'motion-reel-score', 'score.py'), path.join(dir, 'audio', 'score.py'));
      if (lottie) {
        fs.copyFileSync(source, path.join(dir, 'assets', animation));
        const dest = path.join(dir, 'lib', 'dotlottie-web');
        fs.mkdirSync(dest, { recursive: true });
        for (const f of ['index.js', 'dotlottie-player.wasm']) fs.copyFileSync(path.join(cache, 'package', 'dist', f), path.join(dest, f));
        fs.copyFileSync(path.join(cache, 'package', 'LICENSE'), path.join(dest, 'LICENSE'));
      }
    } });
    return steps;
  },

  // Transparent renders straight from HyperFrames: ProRes 4444 (MOV) or VP9 with alpha (WebM). The page
  // background must be transparent for the alpha to mean anything (film.json "alpha": true in the starter).
  alphaSteps(film, kind, format, out) {
    const container = kind === 'mov-alpha' ? 'mov' : 'webm';
    return [{ label: `render ${format} with alpha (${container})`, ...hf(['render', film.dir, '-o', out, '--format', container,
      '-f', String(film.fps), '-q', 'delivery', '--quiet'], film.root) }];
  },

  plan(film, mode, { at = '' } = {}) {
    const steps = this.planSteps(film, mode, { at });
    // A film written by an agent without a shell (a chat app) may import ./lib/fcwm/ without carrying it:
    // fill it in from this FCWM install, so the hand-off folder stays small and always current.
    const libDir = path.join(film.dir, 'lib', 'fcwm');
    const uses = () => /lib\/fcwm\//.test(fs.readFileSync(path.join(film.dir, 'index.html'), 'utf8'));
    // the same for three.js (lib/three/three.module.js, MIT), which is too large to write from a chat
    const threeDir = path.join(film.dir, 'lib', 'three');
    const usesThree = () => /lib\/three\/three\.module\.js/.test(fs.readFileSync(path.join(film.dir, 'index.html'), 'utf8'));
    return [{ label: 'add FCWM lib (lib/fcwm/) the film imports', when: () => !fs.existsSync(libDir) && uses(), fn: () => copyLib(libDir) },
      { label: `add three.js ${threeVersion()} (lib/three/) the film imports`, when: () => !fs.existsSync(path.join(threeDir, 'three.module.js')) && usesThree(), fn: () => copyThree(threeDir) },
      ...steps];
  },

  planSteps(film, mode, { at = '' } = {}) {
    const { dir, root, renderDir, slug } = film;
    const format = film.formats[0];
    if (mode === 'check') {
      const times = sheetTimes(film);
      const snaps = path.join(renderDir, 'snaps');
      return [
        { label: 'clear old snapshots and sheets', fn: () => { fs.rmSync(snaps, { recursive: true, force: true }); clearSheets(renderDir); } },
        { label: 'lint, runtime and layout check (text must stay inside the frame)', fn: () => runCheck(film) },
        { label: `snapshots on ${times.length} beats`, ...hf(['snapshot', dir, '--at', times.join(','), '--no-end', '-o', snaps], root) },
        { label: 'contact sheets', fn: () => tileSheets(
          fs.readdirSync(snaps).filter((n) => n.endsWith('.png')).sort(byStillTime).map((n) => path.join(snaps, n)),
          renderDir, { prefix: `_${format}` }) },
      ];
    }
    if (mode === 'at') {
      const stills = path.join(renderDir, 'stills');
      return [
        { label: 'clear old stills', fn: () => fs.rmSync(stills, { recursive: true, force: true }) },
        { label: `stills at ${at}`, ...hf(['snapshot', dir, '--at', at, '--no-end', '--no-browser-gpu', '-o', stills], root) },
      ];
    }
    if (mode !== 'full') throw new Error(`hyperframes: unknown mode ${mode}`);
    const video = path.join(renderDir, `${slug}-${format}.mp4`);
    return [
      // a synthesized score (audio/score.py, uv) writes audio/music.wav (and sfx.wav) on the film's beat grid;
      // dsp.py, the synthesis voices it imports, ships with FCWM (engines/motion-reel/scripts/, MIT)
      { label: 'score: audio/score.py', when: () => fs.existsSync(path.join(dir, 'audio', 'score.py')),
        cmd: 'uv', args: ['run', '--quiet', path.join(dir, 'audio', 'score.py')], cwd: root,
        env: { MOTION_REEL_SKILL: path.join(REPO, 'engines', 'motion-reel') } },
      { label: 'output folder', fn: () => fs.mkdirSync(renderDir, { recursive: true }) },
      { label: `render ${format}`, ...hf(['render', dir, '-o', video, '-f', String(film.fps), '-q', 'delivery', '--strict', '--quiet'], root) },
      { label: 'mix audio/ (music, sfx, vo) to -14 LUFS / -1 dBTP and mux', when: () => stemsIn(dir).length > 0,
        fn: () => masterInto(video, stemsIn(dir)) },
    ];
  },
};
