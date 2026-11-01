// FCWM adapter for HyperFrames (Apache-2.0, https://github.com/heygen-com/hyperframes).
// Not vendored: the CLI runs through npx at one pinned version, with telemetry switched off.
// A HyperFrames film is composed for one canvas size, so it ships in one format (film.json formats[0]).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sheetTimes, tileSheets, byStillTime } from '../../scripts/lib/contact.mjs';

export const HYPERFRAMES_VERSION = '0.8.226';
export const ENV = { HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1', HYPERFRAMES_SKIP_SKILLS: '1' };
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIZES = { '9x16': [1080, 1920], '16x9': [1920, 1080], '1x1': [1080, 1080] };

const hf = (args, cwd) => ({ cmd: 'npx', args: ['-y', `hyperframes@${HYPERFRAMES_VERSION}`, ...args], cwd, env: ENV });

function copyLib(dest) {
  const src = path.join(REPO, 'lib');
  fs.cpSync(src, dest, { recursive: true, filter: (p) => !/[\\/](test|README\.md)$/.test(p) && !p.endsWith('README.md') });
}

export default {
  id: 'hyperframes',
  tier: 'free',
  requires: () => ['npx', 'ffmpeg', 'ffprobe'],

  scaffoldSteps(root, slug, { duration = 15, formats = ['9x16'], title } = {}) {
    return [{ label: 'scaffold (FCWM HyperFrames starter)', fn: () => {
      if (formats.length > 1) throw new Error('a HyperFrames film is composed for one format; make one film per format');
      const [W, H] = SIZES[formats[0]];
      const vars = { W, H, DURATION: duration, FPS: 30, SIZE: Math.round(Math.min(W, H) * 0.13),
        TITLE: (title || slug).replace(/"/g, '\\"'), FORMATS: JSON.stringify(formats) };
      const dir = path.join(root, slug);
      fs.mkdirSync(dir);
      for (const name of ['index.html', 'film.json']) {
        const text = fs.readFileSync(path.join(REPO, 'templates', 'hyperframes-blank', name), 'utf8');
        fs.writeFileSync(path.join(dir, name), text.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k])));
      }
      copyLib(path.join(dir, 'lib', 'fcwm'));
      for (const d of ['assets', 'audio', 'docs']) fs.mkdirSync(path.join(dir, d));
    } }];
  },

  plan(film, mode, { at = '' } = {}) {
    const { dir, root, renderDir, slug } = film;
    const format = film.formats[0];
    if (mode === 'check') {
      const times = sheetTimes(film);
      const snaps = path.join(renderDir, 'snaps');
      return [
        { label: 'clear old snapshots', fn: () => fs.rmSync(snaps, { recursive: true, force: true }) },
        { label: 'lint, runtime and layout check', ...hf(['check', dir], root) },
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
    return [{ label: 'output folder', fn: () => fs.mkdirSync(renderDir, { recursive: true }) }, { label: `render ${format}`, ...hf(['render', dir, '-o', path.join(renderDir, `${slug}-${format}.mp4`),
      '-f', String(film.fps), '-q', 'delivery', '--strict', '--quiet'], root) }];
  },
};
