// FCWM adapter for HyperFrames (Apache-2.0, https://github.com/heygen-com/hyperframes).
// Not vendored: the CLI runs through npx at one pinned version, with telemetry switched off.
// A HyperFrames film is composed for one canvas size, so it ships in one format (film.json formats[0]).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sheetTimes, tileSheets, byStillTime, clearSheets } from '../../scripts/lib/contact.mjs';
import { fcwmHome } from '../../scripts/lib/setup.mjs';

export const HYPERFRAMES_VERSION = '0.8.226';
export const ENV = { HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1', HYPERFRAMES_SKIP_SKILLS: '1' };
// Lottie playback: dotlottie-web (MIT, https://github.com/LottieFiles/dotlottie-web), fetched once from npm
// at this pinned version into ~/.fcwm/cache and copied into the film, so renders read only local files.
export const DOTLOTTIE_VERSION = '0.82.0';
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

  scaffoldSteps(root, slug, { duration = 15, formats = ['9x16'], title, alpha = false, lottie } = {}) {
    if (formats.length > 1) throw new Error('a HyperFrames film is composed for one format; make one film per format');
    const [W, H] = SIZES[formats[0]];
    const dir = path.join(root, slug);
    const template = lottie ? 'hyperframes-lottie' : 'hyperframes-blank';
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
    steps.push({ label: `scaffold (FCWM HyperFrames ${lottie ? 'Lottie ' : ''}starter)`, fn: () => {
      const animation = lottie ? path.basename(source) : '';
      const vars = { W, H, DURATION: duration, FPS: 30, SIZE: Math.round(Math.min(W, H) * 0.13),
        BOX: Math.round(Math.min(W, H) * 0.8), ANIMATION: animation,
        TITLE: (title || slug).replace(/"/g, '\\"'), FORMATS: JSON.stringify(formats),
        GROUND: alpha ? 'transparent' : '#111111', EXPORTS: JSON.stringify(alpha ? ['mov-alpha'] : []) };
      fs.mkdirSync(dir);
      for (const name of ['index.html', 'film.json']) {
        const from = fs.existsSync(path.join(REPO, 'templates', template, name)) ? template : 'hyperframes-blank';
        const text = fs.readFileSync(path.join(REPO, 'templates', from, name), 'utf8');
        fs.writeFileSync(path.join(dir, name), text.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k])));
      }
      copyLib(path.join(dir, 'lib', 'fcwm'));
      for (const d of ['assets', 'audio', 'docs']) fs.mkdirSync(path.join(dir, d));
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
    const { dir, root, renderDir, slug } = film;
    const format = film.formats[0];
    if (mode === 'check') {
      const times = sheetTimes(film);
      const snaps = path.join(renderDir, 'snaps');
      return [
        { label: 'clear old snapshots and sheets', fn: () => { fs.rmSync(snaps, { recursive: true, force: true }); clearSheets(renderDir); } },
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
