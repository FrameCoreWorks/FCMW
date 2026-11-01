// FCWM adapter for Blender (GPL-3.0-or-later, https://www.blender.org), tier "restricted": free to use,
// and renders belong to the user, but Blender and code linked to it are GPL. Not vendored: the official
// Blender Python module (bpy on PyPI) runs through `uv run --with bpy==<pinned>`, headless, no app
// install. A film is <film>/scene.py with build(scene, film), driven by engines/blender/render.py.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sheetTimes, tileSheets, clearSheets } from '../../scripts/lib/contact.mjs';

import { BPY_VERSION, BPY_PYTHON as PYTHON } from '../../scripts/lib/versions.mjs';
export { BPY_VERSION, PYTHON };
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUNNER = path.join(REPO, 'engines', 'blender', 'render.py');
const FF = ['-hide_banner', '-loglevel', 'error', '-y'];

const work = (film) => path.join(film.dir, '.blender');
export const frameAt = (film, t) => Math.min(Math.max(1, Math.round(film.config.duration * film.fps)), Math.max(1, Math.round(t * film.fps) + 1));
const framePng = (dir, f) => path.join(dir, `frame-${String(f).padStart(5, '0')}.png`);

function blenderStep(film, format, out, { frames = 'all', scale = 1, samples = 0, label }) {
  const args = ['run', '--quiet', '--python', PYTHON, '--with', `bpy==${BPY_VERSION}`, 'python', RUNNER, '--',
    '--film', film.dir, '--format', format, '--out', out, '--frames', String(frames)];
  if (scale !== 1) args.push('--scale', String(scale));
  if (samples) args.push('--samples', String(samples));
  return { label, cmd: 'uv', args, cwd: film.dir };
}

// Frames for one format, rendered once and shared by the MP4 and the alpha exports.
function framesSteps(film, format) {
  const dir = path.join(work(film), format);
  return [dir, [
    { label: `clear old ${format} frames`, fn: () => { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); } },
    blenderStep(film, format, dir, { label: `render ${format} frames (Cycles)` }),
  ]];
}

function audioArgs(film) {
  const track = film.config.audio && path.resolve(film.dir, film.config.audio);
  return track && fs.existsSync(track) ? { input: ['-i', track], codec: ['-c:a', 'aac', '-b:a', '320k', '-shortest'] } : { input: [], codec: ['-an'] };
}

export default {
  id: 'blender',
  tier: 'restricted',
  requires: () => ['ffmpeg', 'ffprobe', 'uv'],

  scaffoldSteps(root, slug, { duration = 10, formats = ['16x9'], title, alpha = false } = {}) {
    return [{ label: 'scaffold (FCWM Blender starter)', fn: () => {
      const dir = path.join(root, slug);
      fs.mkdirSync(dir);
      fs.copyFileSync(path.join(REPO, 'templates', 'blender-blank', 'scene.py'), path.join(dir, 'scene.py'));
      const vars = { TITLE: (title || slug).replace(/"/g, '\\"'), DURATION: duration, FORMATS: JSON.stringify(formats),
        ALPHA: alpha, EXPORTS: JSON.stringify(alpha ? ['mov-alpha'] : []) };
      const cfg = fs.readFileSync(path.join(REPO, 'templates', 'blender-blank', 'film.json'), 'utf8');
      fs.writeFileSync(path.join(dir, 'film.json'), cfg.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k])));
      for (const d of ['assets', 'audio', 'docs']) fs.mkdirSync(path.join(dir, d));
    } }];
  },

  // RGBA frames (film.json "alpha": true makes the world transparent) to ProRes 4444 or VP9 with alpha.
  alphaSteps(film, kind, format, out) {
    if (!film.config.alpha) throw new Error('alpha exports need a transparent Blender film: set "alpha": true in film.json (or start with fcwm new --alpha)');
    const dir = path.join(work(film), format);
    const [, render] = framesSteps(film, format);
    const codec = kind === 'mov-alpha'
      ? ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le']
      : ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '20', '-row-mt', '1'];
    return [
      ...render.map((s) => ({ ...s, when: () => !fs.existsSync(framePng(dir, 1)) })),
      { label: `encode ${format} with alpha (${kind})`, cmd: 'ffmpeg', args: [...FF, '-framerate', String(film.fps), '-i', path.join(dir, 'frame-%05d.png'), ...codec, '-an', out] },
    ];
  },

  plan(film, mode, { at = '', formats } = {}) {
    const fmts = formats || film.formats;
    if (mode === 'check') {
      // Half size and few samples, only the frames on the beat grid: a draft for layout and motion.
      const f = fmts[0];
      const times = sheetTimes(film);
      const frames = times.map((t) => frameAt(film, t));
      const dir = path.join(film.renderDir, 'snaps');
      return [
        { label: 'clear old snapshots and sheets', fn: () => { fs.rmSync(dir, { recursive: true, force: true }); clearSheets(film.renderDir); } },
        blenderStep(film, f, dir, { frames: [...new Set(frames)].join(','), scale: 0.5, samples: 8, label: `draft frames ${f} at half size` }),
        { label: 'contact sheets', fn: () => tileSheets(frames.map((n) => framePng(dir, n)), film.renderDir, { prefix: `_${f}` }) },
      ];
    }
    if (mode === 'at') {
      const f = fmts[0];
      const times = String(at).split(',').map(Number);
      const dir = path.join(film.renderDir, 'stills');
      return [
        { label: 'clear old stills', fn: () => fs.rmSync(dir, { recursive: true, force: true }) },
        blenderStep(film, f, dir, { frames: times.map((t) => frameAt(film, t)).join(','), label: `stills ${f} at ${at}` }),
        // name stills by time like the other engines, so QA and the user can match them to the beat grid
        { label: 'name stills by time', fn: () => {
          times.forEach((t) => fs.copyFileSync(framePng(dir, frameAt(film, t)), path.join(dir, `t${t.toFixed(3)}.png`)));
          for (const n of fs.readdirSync(dir)) if (n.startsWith('frame-')) fs.rmSync(path.join(dir, n));
        } },
      ];
    }
    if (mode !== 'full') throw new Error(`blender: unknown mode ${mode}`);
    const steps = [{ label: 'output folder', fn: () => fs.mkdirSync(film.renderDir, { recursive: true }) }];
    const audio = audioArgs(film);
    for (const f of fmts) {
      const [dir, render] = framesSteps(film, f);
      steps.push(...render, { label: `encode ${f}`, cmd: 'ffmpeg', args: [...FF, '-framerate', String(film.fps), '-i', path.join(dir, 'frame-%05d.png'),
        ...audio.input, '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', ...audio.codec,
        '-movflags', '+faststart', path.join(film.renderDir, `${film.slug}-${f}.mp4`)] });
    }
    return steps;
  },
};
