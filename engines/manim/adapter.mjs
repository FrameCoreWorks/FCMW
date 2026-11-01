// FCWM adapter for Manim Community (MIT, https://github.com/ManimCommunity/manim).
// Not vendored: `uv run --with manim==<pinned>` fetches it into uv's cache on first use. A film is
// <film>/scene.py (class named in film.json "scene", default Film) plus film.json. Manim plays its
// animations in order, so stills and contact sheets are cut from a rendered movie with ffmpeg.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sheetTimes, tileSheets, clearSheets } from '../../scripts/lib/contact.mjs';

import { MANIM_VERSION, MANIM_PYTHON as PYTHON } from '../../scripts/lib/versions.mjs';
export { MANIM_VERSION, PYTHON };
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIZES = { '9x16': [1080, 1920], '16x9': [1920, 1080], '1x1': [1080, 1080] };
const FF = ['-hide_banner', '-loglevel', 'error', '-y'];

const work = (film) => path.join(film.dir, '.manim');
const sceneName = (film) => film.config.scene || 'Film';

// One manim render into <film>/.manim; returns [step, path of the file it writes].
function manimStep(film, { w, h, name, extra = [], label }) {
  const ext = extra.includes('--format') ? extra[extra.indexOf('--format') + 1] : 'mp4';
  const args = ['run', '--quiet', '--python', PYTHON, '--with', `manim==${MANIM_VERSION}`, 'manim', 'render',
    path.join(film.dir, 'scene.py'), sceneName(film), '-r', `${w},${h}`, '--fps', String(film.fps),
    '--media_dir', work(film), '--disable_caching', '-o', name, ...extra];
  const out = path.join(work(film), 'videos', 'scene', `${h}p${film.fps}`, `${name}.${ext}`);
  return [{ label, cmd: 'uv', args, cwd: film.dir }, out];
}

function framesAt(src, times, dir, w) {
  return [{ label: 'stills folder', fn: () => fs.mkdirSync(dir, { recursive: true }) }, ...times.map((t) => ({ label: `frame at ${t}s`, cmd: 'ffmpeg',
    args: [...FF, '-ss', String(t), '-i', src, '-frames:v', '1', ...(w ? ['-vf', `scale=${w}:-2`] : []), path.join(dir, `t${t.toFixed(3)}.png`)] }))];
}

export default {
  id: 'manim',
  tier: 'free',
  requires: () => ['ffmpeg', 'ffprobe', 'uv'],

  scaffoldSteps(root, slug, { duration = 10, formats = ['16x9'], title, alpha = false } = {}) {
    return [{ label: 'scaffold (FCWM Manim starter)', fn: () => {
      const dir = path.join(root, slug);
      fs.mkdirSync(dir);
      fs.copyFileSync(path.join(REPO, 'templates', 'manim-blank', 'scene.py'), path.join(dir, 'scene.py'));
      const vars = { TITLE: (title || slug).replace(/"/g, '\\"'), DURATION: duration, FORMATS: JSON.stringify(formats),
        ALPHA: alpha, EXPORTS: JSON.stringify(alpha ? ['mov-alpha'] : []) };
      const cfg = fs.readFileSync(path.join(REPO, 'templates', 'manim-blank', 'film.json'), 'utf8');
      fs.writeFileSync(path.join(dir, 'film.json'), cfg.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k])));
      for (const d of ['assets', 'audio', 'docs']) fs.mkdirSync(path.join(dir, d));
    } }];
  },

  // ProRes 4444 is transcoded from Manim's own transparent QuickTime (qtrle, argb); WebM alpha is native.
  alphaSteps(film, kind, format, out) {
    const [w, h] = SIZES[format];
    const container = kind === 'mov-alpha' ? 'mov' : 'webm';
    const [step, src] = manimStep(film, { w, h, name: `${film.slug}-${format}-alpha`, extra: ['--transparent', '--format', container],
      label: `render ${format} with alpha (${container})` });
    const finish = kind === 'mov-alpha'
      ? { label: 'ProRes 4444 with alpha', cmd: 'ffmpeg', args: [...FF, '-i', src, '-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-an', out] }
      : { label: 'collect', fn: () => fs.copyFileSync(src, out) };
    return [step, finish];
  },

  plan(film, mode, { at = '', formats } = {}) {
    const fmts = formats || film.formats;
    if (mode === 'check') {
      const f = fmts[0];
      const [w, h] = SIZES[f].map((v) => v / 2);
      const [step, src] = manimStep(film, { w, h, name: `${film.slug}-check`, label: `draft render ${f} at half size` });
      const times = sheetTimes(film);
      const dir = path.join(film.renderDir, 'snaps');
      return [
        { label: 'clear old snapshots and sheets', fn: () => { fs.rmSync(dir, { recursive: true, force: true }); clearSheets(film.renderDir); } },
        step, ...framesAt(src, times, dir),
        { label: 'contact sheets', fn: () => tileSheets(times.map((t) => path.join(dir, `t${t.toFixed(3)}.png`)), film.renderDir, { prefix: `_${f}` }) },
      ];
    }
    if (mode === 'at') {
      const f = fmts[0];
      const [w, h] = SIZES[f];
      const times = String(at).split(',').map(Number);
      const [step, src] = manimStep(film, { w, h, name: `${film.slug}-${f}`, label: `render ${f}` });
      const dir = path.join(film.renderDir, 'stills');
      return [{ label: 'clear old stills', fn: () => fs.rmSync(dir, { recursive: true, force: true }) }, step, ...framesAt(src, times, dir)];
    }
    if (mode !== 'full') throw new Error(`manim: unknown mode ${mode}`);
    const steps = [{ label: 'output folder', fn: () => fs.mkdirSync(film.renderDir, { recursive: true }) }];
    for (const f of fmts) {
      const [w, h] = SIZES[f];
      const [step, src] = manimStep(film, { w, h, name: `${film.slug}-${f}`, label: `render ${f}` });
      // H.264 yuv420p with faststart, the same delivery encode as the other engines (keeps Manim's audio)
      steps.push(step, { label: `encode ${f}`, cmd: 'ffmpeg', args: [...FF, '-i', src, '-c:v', 'libx264', '-crf', '16', '-preset', 'slow',
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', path.join(film.renderDir, `${film.slug}-${f}.mp4`)] });
    }
    return steps;
  },
};
